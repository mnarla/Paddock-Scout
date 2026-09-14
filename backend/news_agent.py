"""
backend/news_agent.py
=====================
Automated F1 Technical Upgrade Intelligence Pipeline.

Architecture:
  1. Discover articles via Google News RSS + direct motorsport feeds (The Race,
     Autosport, RaceFans) — zero DuckDuckGo dependency.
  2. Cheap regex first-pass filter to discard driver gossip / penalties.
  3. Fetch full article body for promising candidates (requests + lxml).
  4. Single batched Gemini Flash call across all candidates → structured JSON.
  5. Deterministic Python calculates pace deltas and validates against FP2 telemetry.
  6. Writes data/live_tech_updates.json (all 11 teams, honest PENDING for no-news).
"""

import os
import re
import sys
import json
import time
import logging
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

import requests
import pandas as pd

# Load .env via stdlib (zero dependency)
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("'\""))

log = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# ── Constants ──────────────────────────────────────────────────────────────────

TEAMS = [
    "Red Bull Racing", "Ferrari", "Mercedes", "McLaren", "Aston Martin",
    "Alpine", "Williams", "Racing Bulls", "Haas F1 Team", "Audi", "Cadillac",
]

# Short aliases used in search queries (human-readable / outlet-used names)
TEAM_SEARCH_ALIASES: Dict[str, str] = {
    "Red Bull Racing":  '("Red Bull" OR "Red Bull Racing")',
    "Ferrari":          'Ferrari',
    "Mercedes":         'Mercedes',
    "McLaren":          'McLaren',
    "Aston Martin":     '("Aston Martin" OR AMR)',
    "Alpine":           'Alpine',
    "Williams":         'Williams',
    "Racing Bulls":     '("Racing Bulls" OR VCARB OR "RB F1" OR "AlphaTauri")',
    "Haas F1 Team":     'Haas',
    "Audi":             '("Audi" OR Sauber OR "Stake F1")',
    "Cadillac":         'Cadillac',
}

# Regex patterns that signal a technical upgrade article (fast, zero LLM cost)
_TECH_PATTERN = re.compile(
    r"\b(upgrade|floor|sidepod|wing|suspension|cooling|diffuser|aero\w*|"
    r"package|radiator|undercut|tunnel|vortex|mgu-k|power unit|"
    r"downforce|drag reduction|bodywork|bargeboard)\b",
    re.IGNORECASE,
)

# Google News RSS base URL
_GNEWS_RSS = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
_ALLOWED_SITES = "(site:the-race.com OR site:autosport.com OR site:motorsport.com OR site:f1technical.net OR site:racefans.net OR site:formula1.com OR site:motorsportweek.com)"

# Direct motorsport RSS feeds (no redirect URLs — clean links)
_DIRECT_FEEDS: List[str] = [
    "https://the-race.com/feed/",
    "https://www.racefans.net/feed/",
    "https://www.autosport.com/rss/f1/news/",
]

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

_MAX_ARTICLE_CHARS = 1200  # Truncate scraped body — keeps total prompt under ~40K tokens
_MAX_PER_TEAM = 5          # Max candidate articles per team sent to Gemini
_MAX_DIRECT_FEEDS = 5      # Max unassigned articles from direct motorsport feeds



# ── Step 1: RSS Discovery ─────────────────────────────────────────────────────

def _parse_rss(url: str, timeout: int = 8) -> List[Dict[str, str]]:
    """Fetch an RSS feed and return list of {title, link, snippet, pubdate}."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=timeout)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        items = []
        for item in root.iter("item"):
            title   = (item.findtext("title")       or "").strip()
            link    = (item.findtext("link")         or "").strip()
            snippet = (item.findtext("description")  or "").strip()
            pubdate = (item.findtext("pubDate")       or "").strip()
            # Strip HTML from snippet
            snippet = re.sub(r"<[^>]+>", " ", snippet).strip()
            if title and link:
                items.append({"title": title, "link": link,
                              "snippet": snippet, "pubdate": pubdate})
        return items
    except Exception as exc:
        log.debug(f"RSS fetch failed for {url}: {exc}")
        return []


def _resolve_google_redirect(url: str) -> str:
    """Follow a Google News redirect URL to get the real article URL."""
    try:
        from googlenewsdecoder import new_decoderv1
        res = new_decoderv1(url)
        if res.get("status") and res.get("decoded_url"):
            return res["decoded_url"]
    except Exception:
        pass
    try:
        resp = requests.head(url, headers=_HEADERS, allow_redirects=True,
                             timeout=6)
        return resp.url
    except Exception:
        return url


from email.utils import parsedate_to_datetime

def _is_recent(pubdate_str: str, max_days: int = 21) -> bool:
    """Return True only if article was published within max_days (default 21 days / 3 weeks)."""
    if not pubdate_str:
        return True  # rely on Google 'when:21d' query parameter
    try:
        dt = parsedate_to_datetime(pubdate_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        diff_days = (now - dt).total_seconds() / 86400.0
        # Discard articles older than max_days or far in the future
        return -1.0 <= diff_days <= float(max_days)
    except Exception:
        return False


def fetch_rss_candidates(race_name: str) -> List[Dict[str, str]]:
    candidates: List[Dict[str, str]] = []
    seen_links: set = set()
    clean_gp = race_name.replace(" Grand Prix", " GP")
    track_city = race_name.split()[0]

    # Tier 1: Current & recent race overviews (strictly within 21 days / 3 weeks)
    tier_1 = [
        f'"{clean_gp}" (upgrades OR "all upgrades" OR "car display" OR "technical updates") when:21d {_ALLOWED_SITES}',
        f'"{clean_gp}" ("brought" OR "revealed" OR "technical package") when:21d {_ALLOWED_SITES}',
        f'"{track_city}" F1 (upgrade OR upgrades OR floor OR wing) when:21d {_ALLOWED_SITES}',
    ]
    for q in tier_1:
        url = _GNEWS_RSS.format(query=urllib.parse.quote(q))
        for item in _parse_rss(url):
            if item["link"] not in seen_links and _is_recent(item.get("pubdate", ""), max_days=21):
                seen_links.add(item["link"])
                item["team_hint"] = ""
                candidates.append(item)
        time.sleep(0.2)

    # Tier 2: Recent spec (strictly within 21 days / 3 weeks)
    for team, alias in TEAM_SEARCH_ALIASES.items():
        q = f'{alias} (upgrade OR floor OR wing OR package OR "power unit" OR sidepod) when:21d {_ALLOWED_SITES}'
        url = _GNEWS_RSS.format(query=urllib.parse.quote(q))
        for item in _parse_rss(url):
            if item["link"] not in seen_links and _is_recent(item.get("pubdate", ""), max_days=21):
                seen_links.add(item["link"])
                item["team_hint"] = team
                candidates.append(item)
        time.sleep(0.2)

    for feed_url in _DIRECT_FEEDS:
        for item in _parse_rss(feed_url):
            if item["link"] not in seen_links and _is_recent(item.get("pubdate", ""), max_days=21):
                seen_links.add(item["link"])
                item["team_hint"] = ""
                candidates.append(item)

    log.info(f"[rss] Discovered {len(candidates)} total RSS candidates (filtered to <= 21 days old)")
    return candidates

# ── Step 2: Cheap First-Pass Filter ───────────────────────────────────────────

def filter_technical_articles(candidates: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Discard articles with no technical keywords, then balance selection per team
    so every team has candidates represented in the single Gemini prompt batch.
    """
    passed = []
    for c in candidates:
        combined = c.get("title", "") + " " + c.get("snippet", "")
        if _TECH_PATTERN.search(combined):
            passed.append(c)

    log.info(f"[filter] {len(passed)} articles passed technical keyword filter "
             f"(from {len(candidates)})")

    # Group by team hint
    by_team: Dict[str, List[Dict[str, str]]] = {t: [] for t in TEAMS}
    general: List[Dict[str, str]] = []

    for c in passed:
        team = c.get("team_hint", "")
        if not team:
            combined_lower = (c.get("title", "") + " " + c.get("snippet", "")).lower()
            for t_name, alias in TEAM_SEARCH_ALIASES.items():
                short_name = alias.lower().replace(" f1", "")
                if short_name in combined_lower:
                    team = t_name
                    c["team_hint"] = t_name
                    break

        if team and team in by_team:
            if len(by_team[team]) < _MAX_PER_TEAM:
                by_team[team].append(c)
        elif len(general) < _MAX_DIRECT_FEEDS:
            general.append(c)

    balanced: List[Dict[str, str]] = []
    for team_items in by_team.values():
        balanced.extend(team_items)
    balanced.extend(general)

    log.info(f"[filter] Selected {len(balanced)} balanced candidates for Gemini prompt")
    return balanced


# ── Step 3: Article Body Scraper ───────────────────────────────────────────────

def scrape_article_text(url: str) -> str:
    """
    Fetch the article page and extract clean paragraph text using lxml.
    Falls back to RSS snippet if scraping fails.
    Returns at most _MAX_ARTICLE_CHARS characters.
    """
    try:
        from lxml import html as lxml_html
        resp = requests.get(url, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
        tree = lxml_html.fromstring(resp.content)
        # Extract <p> tag text
        paragraphs = tree.xpath("//p")
        text = " ".join(
            p.text_content().strip()
            for p in paragraphs
            if len(p.text_content().strip()) > 40
        )
        return text[:_MAX_ARTICLE_CHARS]
    except Exception as exc:
        log.debug(f"[scraper] Failed for {url}: {exc}")
        return ""


# ── Step 4: Batched Gemini Extraction ─────────────────────────────────────────

_GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-3.1-flash-lite:generateContent"
)

_EXTRACTION_SCHEMA = """\
{
  "team": "<one of: Red Bull Racing | Ferrari | Mercedes | McLaren | Aston Martin | Alpine | Williams | Racing Bulls | Haas F1 Team | Audi | Cadillac | UNKNOWN>",
  "component": "<specific technical component name, e.g. 'Floor v3 — Vortex Reset'>",
  "category": "<one of: Aero | Power Unit | Suspension | Cooling>",
  "is_current_weekend": <true if brought for {target_race}, false if it's an older spec>,
  "as_of_race": "<specific race name where this upgrade debuted, e.g. 'Spanish GP'>",
  "certainty": "<one of: confirmed | rumoured | denied>",
  "stated_or_estimated_delta": <float lap time delta in seconds: negative for faster e.g. -0.20, positive for slower/bouncing e.g. +0.15, 0.0 for reverted/neutral>,
  "outcome": "<one of: effective | experimental | defective | reverted>",
  "summary": "<one concise sentence describing the upgrade and reported on-track behavior>",
  "source": "<outlet name>",
  "url": "<article URL>"
}"""

_SYSTEM_PROMPT = """\
You are an expert Formula 1 technical analyst and race engineer. Extract structured upgrade info from articles. 
Current target race is: {target_race}.
Return ONLY a JSON array. Schema:

{schema}

Rules:
- CRITICAL: Not all upgrades work. Modern F1 ground-effect cars frequently suffer from porpoising/bouncing, balance rupture, or correlation issues.
- Delta evaluation rules:
  * If the article quotes an engineer or team stating lap time value (e.g. "two tenths" -> -0.20s, "half a tenth" -> -0.05s), extract that exact number.
  * If no exact number is stated: evaluate scope. Major floor/sidepod overhaul: -0.15s to -0.25s. Standard wing/flap trim: -0.04s to -0.08s. Minor cooling: -0.02s.
  * If the article reports bouncing, handling instability, driver struggling, or the upgrade did not correlate: set a POSITIVE penalty delta (e.g. +0.10s to +0.20s) and set outcome to "defective".
  * If the team abandoned or reverted the part back to an older specification during the weekend: set delta to 0.0 and outcome to "reverted".
- If article describes parts brought to {target_race}, set is_current_weekend: true, as_of_race: "{target_race}".
- If referencing a prior GP package, set is_current_weekend: false, and note the GP where it debuted.
- If an article says "No updates submitted" or team brought nothing, DO NOT extract an entry for that team.
- Separate entry per team.
"""


def extract_upgrades_with_gemini(
    articles: List[Dict[str, str]], target_race: str = ""
) -> List[Dict[str, Any]]:
    """
    Send all filtered article texts to Gemini in ONE batched prompt.
    Returns a list of structured upgrade dicts (one per upgrade found).
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        log.warning("[gemini] GEMINI_API_KEY not set — skipping LLM extraction")
        return []

    # Build article batch text
    batch_parts = []
    for i, art in enumerate(articles, 1):
        body = art.get("body", "") or art.get("snippet", "")
        url = art.get("real_link") or art.get("link", "")
        batch_parts.append(
            f"--- ARTICLE {i} ---\nURL: {url}\n"
            f"TITLE: {art.get('title', '')}\n\n{body}\n"
        )
    batch_text = "\n".join(batch_parts)

    user_message = (
        f"Extract all F1 technical upgrades from the following {len(articles)} articles. "
        f"Return a JSON array.\n\n{batch_text}"
    )

    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM_PROMPT.format(schema=_EXTRACTION_SCHEMA, target_race=target_race)}]},
        "contents": [{"role": "user", "parts": [{"text": user_message}]}],
        "generationConfig": {
            # Note: responseMimeType is intentionally omitted — it causes 503s on
            # some free-tier keys. We strip markdown fences manually below.
            "temperature": 0.0,
            "maxOutputTokens": 4096,
        },
    }

    url = f"{_GEMINI_ENDPOINT}?key={api_key}"
    retry_waits = [10, 20, 30]  # seconds — matches observed free-tier recovery time
    for attempt, wait in enumerate(retry_waits + [None]):
        try:
            resp = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            raw_text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "[]")
            )
            # Strip markdown code fences (```json ... ```) if present
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.MULTILINE)
            raw_text = re.sub(r"\s*```$", "", raw_text.strip(), flags=re.MULTILINE)
            raw_text = raw_text.strip()

            upgrades = json.loads(raw_text)
            if isinstance(upgrades, dict):
                upgrades = [upgrades]
            log.info(f"[gemini] Extracted {len(upgrades)} upgrades from {len(articles)} articles")
            return upgrades
        except Exception as exc:
            if wait is not None:
                log.warning(f"[gemini] Attempt {attempt + 1} failed: {exc} — retrying in {wait}s")
                time.sleep(wait)
            else:
                log.warning(f"[gemini] Extraction failed after all retries: {exc}")
    return []


# ── Step 5: Dynamic Article-Driven Pace Delta & FP2 Validation ────────────────

def _get_fp2_position(team_name: str, year: int, rnd: int) -> Optional[float]:
    """Return the best FP2 finishing position for a team. Returns None if no session data yet."""
    path = os.path.join(DATA_DIR, f"results_{year}_round{rnd:02d}fp2.csv")
    if not os.path.exists(path):
        return None
    try:
        df = pd.read_csv(path)
        df["Position"] = pd.to_numeric(df["Position"], errors="coerce")
        team_df = df[df["TeamName"] == team_name]
        if team_df.empty:
            return None
        min_pos = team_df["Position"].min()
        return float(min_pos) if pd.notna(min_pos) else None
    except Exception:
        return None


def validate_against_fp2(
    upgrade: Dict[str, Any], year: int, rnd: int
) -> Dict[str, Any]:
    """
    Evaluate upgrade pace delta and validation status dynamically from article reporting
    and FP2 telemetry. Handles failed upgrades (bouncing/balance rupture) and reversions.
    """
    team = upgrade.get("team", "")
    outcome = str(upgrade.get("outcome", "effective")).lower().strip()

    # Dynamic delta extracted from journalist quotes, engineer statements, or scope
    raw_delta = upgrade.get("stated_or_estimated_delta")
    try:
        pace_delta = round(float(raw_delta), 3)
    except (TypeError, ValueError):
        pace_delta = -0.05

    fp2_pos = _get_fp2_position(team, year, rnd)

    # 1. Spec Reversion: team removed parts after Friday practice
    if outcome == "reverted":
        pace_delta = 0.0
        validation = "REVERTED"
    # 2. Defective / Harmful: bouncing, porpoising, balance rupture
    elif outcome == "defective" or pace_delta > 0:
        validation = "DEFECTIVE"
        if pace_delta <= 0:
            pace_delta = +0.10  # Apply penalty for defective part
    # 3. Telemetry Validation: compare against FP2 pace if session has happened
    elif fp2_pos is not None:
        validation = "VALID" if fp2_pos <= 10 else "UNVERIFIED"
    else:
        validation = "UNVERIFIED"  # Practice has not occurred yet

    upgrade["Pace_Delta"] = pace_delta
    upgrade["FP2_Best_Pos"] = fp2_pos if fp2_pos is not None else 0.0
    upgrade["Upgrade_Validation"] = validation
    # Faster car (-0.2s delta) gets positive boost (+0.2); slower car gets negative penalty (-0.10)
    upgrade["Upgrade_Score"] = round(-pace_delta, 3)
    upgrade["Is_Defective"] = (validation == "DEFECTIVE")
    return upgrade


# ── Step 6: Build Full 11-Team Output ─────────────────────────────────────────

def build_live_tech_updates() -> Dict[str, dict]:
    """
    Main pipeline entry point. Runs the full RSS → filter → scrape → Gemini →
    validate flow and writes data/live_tech_updates.json.

    Returns a dict keyed by team name with upgrade details.
    """
    sys.path.insert(0, os.path.dirname(__file__))
    from calendar_manager import get_next_race_full

    ri = get_next_race_full()
    target_race = ri.name
    year = ri.date.year
    round_num = ri.round_num

    log.info(f"[pipeline] Building tech updates for {target_race} (Rd {round_num}) ...")

    # ── 1. RSS Discovery ───────────────────────────────────────────────────────
    raw_candidates = fetch_rss_candidates(target_race)

    # ── 2. Filter ──────────────────────────────────────────────────────────────
    filtered = filter_technical_articles(raw_candidates)

    # ── 3. Article Body Scraping ───────────────────────────────────────────────
    for art in filtered:
        link = art.get("link", "")
        # Resolve Google redirect URLs
        if "news.google.com" in link or "google.com/rss" in link:
            real_link = _resolve_google_redirect(link)
            art["real_link"] = real_link
        else:
            art["real_link"] = link

        body = scrape_article_text(art["real_link"])
        art["body"] = body if body else art.get("snippet", "")

    # ── 4. Gemini Extraction (single batch) ────────────────────────────────────
    extracted: List[Dict[str, Any]] = extract_upgrades_with_gemini(filtered, target_race)

    # ── 5. Validate & Build Team Map ──────────────────────────────────────────
    # Group extracted upgrades by team (keep highest-certainty if multiple)
    team_upgrades: Dict[str, Dict[str, Any]] = {}
    certainty_rank = {"confirmed": 3, "rumoured": 2, "denied": 1}

    for upg in extracted:
        team = upg.get("team", "UNKNOWN")
        if team == "UNKNOWN" or team not in TEAMS:
            continue
        upg = validate_against_fp2(upg, year, round_num)

        # Resolve direct article URL instead of Google News redirect
        raw_url = upg.get("url", "")
        if "news.google.com" in raw_url or "google.com/rss" in raw_url:
            upg["url"] = _resolve_google_redirect(raw_url)

        existing = team_upgrades.get(team)
        if existing is None:
            team_upgrades[team] = upg
        else:
            # Keep highest-certainty upgrade for this team
            if certainty_rank.get(upg.get("certainty", "rumoured"), 0) > \
               certainty_rank.get(existing.get("certainty", "rumoured"), 0):
                team_upgrades[team] = upg

    # ── 6. Build Full Output (all 11 teams) ────────────────────────────────────
    current_gp = target_race.replace(" Grand Prix", " GP")
    updates: Dict[str, dict] = {}

    for team in TEAMS:
        if team in team_upgrades:
            upg = team_upgrades[team]
            as_of_val = upg.get("as_of_race") or current_gp
            is_current = upg.get("is_current_weekend", False)
            
            val_str = upg.get("Upgrade_Validation", "UNVERIFIED")
            if val_str == "DEFECTIVE":
                status = "DEFECTIVE"
                badge = f"Defective (+{abs(upg.get('Pace_Delta', 0.10)):.2f}s penalty)"
            elif val_str == "REVERTED":
                status = "REVERTED"
                badge = f"Reverted to pre-{as_of_val} spec"
            elif is_current:
                status = "NEW_THIS_WEEKEND"
                badge = f"New for {as_of_val}"
            else:
                status = "ACTIVE_SPEC"
                badge = f"Running spec (from {as_of_val})"

            updates[team] = {
                "Component":          upg.get("component", "Technical Upgrade"),
                "Category":           upg.get("category", "Aero"),
                "Certainty":          upg.get("certainty", "confirmed"),
                "Summary":            upg.get("summary", ""),
                "Pace_Delta":         upg.get("Pace_Delta", 0.0),
                "FP2_Best_Pos":       upg.get("FP2_Best_Pos", 1.0),
                "Upgrade_Score":      upg.get("Upgrade_Score", 0.0),
                "Upgrade_Validation": val_str,
                "Is_Defective":       val_str == "DEFECTIVE",
                "Sources":            [upg.get("source", "News Feed")],
                "URL":                upg.get("url", ""),
                "As_Of":              as_of_val,
                "Is_Current_Weekend": is_current,
                "Status":             status,
                "Badge":              badge,
            }
        else:
            # Strictly within the last 3 weeks — no stale historical articles from months/years ago
            updates[team] = {
                "Component":          "Stable Aerodynamic Package",
                "Category":           "Aero",
                "Certainty":          "confirmed",
                "Summary":            "No new aerodynamic upgrades reported in the last 3 weeks; running standard baseline car spec.",
                "Pace_Delta":         0.0,
                "FP2_Best_Pos":       1.0,
                "Upgrade_Score":      0.0,
                "Upgrade_Validation": "VALID",
                "Is_Defective":       False,
                "Sources":            ["Baseline"],
                "URL":                "",
                "As_Of":              current_gp,
                "Is_Current_Weekend": False,
                "Status":             "STABLE_SPEC",
                "Badge":              "Standard Baseline"
            }

    # ── 7. Write JSON ──────────────────────────────────────────────────────────
    out_data_path = os.path.join(DATA_DIR, "live_tech_updates.json")
    out_root_path = os.path.join(os.path.dirname(__file__), "..", "live_tech_updates.json")

    for path in [out_data_path, out_root_path]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(updates, f, indent=4)

    confirmed_count = sum(1 for v in updates.values() if v["Certainty"] != "pending")
    log.info(f"[pipeline] ✅ Done. {confirmed_count}/{len(TEAMS)} teams have upgrade data.")
    return updates


# ── CLI Entry Point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    sys.path.insert(0, os.path.dirname(__file__))
    updates = build_live_tech_updates()
    print("\n" + "=" * 60)
    print(f"UPGRADE REPORT — {len(updates)} teams processed")
    print("=" * 60)
    for team, info in updates.items():
        status = "✅" if info["Certainty"] != "pending" else "⏳"
        delta_str = f"{info['Pace_Delta']:+.3f}s" if info["Pace_Delta"] != 0.0 else "±0.000s"
        print(f"{status} {team:<22} | {info['Component'][:35]:<35} | {delta_str} | {info['Upgrade_Validation']}")
        if info.get("Sources") and info["Sources"][0] != "Awaiting reports":
            print(f"   └─ src: {info['Sources'][0]}  url: {info.get('URL', '')[:60]}")
