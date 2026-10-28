"""Source-linked team news and FIA declarations, with separate evidence levels."""

import io
import json
import logging
import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

import requests
from lxml import html
from pypdf import PdfReader

from news_agent import TEAMS, _DIRECT_FEEDS, _GNEWS_RSS, _HEADERS, _parse_rss

log = logging.getLogger(__name__)
CACHE_PATH = Path(__file__).resolve().parent.parent / "data" / "paddock_news.json"
FIA_ROOT = "https://www.fia.com"
FIA_INDEX = f"{FIA_ROOT}/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072"
ALIASES = {
    "Red Bull Racing": ("red bull", "verstappen", "hadjar"),
    "Ferrari": ("ferrari", "leclerc", "hamilton"),
    "Mercedes": ("mercedes", "russell", "antonelli"),
    "McLaren": ("mclaren", "norris", "piastri"),
    "Aston Martin": ("aston martin", "alonso", "stroll"),
    "Alpine": ("alpine", "gasly", "colapinto"),
    "Williams": ("williams", "albon", "sainz"),
    "Racing Bulls": ("racing bulls", "vcarb", "lindblad", "lawson"),
    "Haas F1 Team": ("haas", "bearman", "ocon"),
    "Audi": ("audi", "hulkenberg", "hülkenberg", "bortoleto"),
    "Cadillac": ("cadillac", "perez", "pérez", "bottas"),
}
COMPONENTS = re.compile(r"(?:front |rear )?(?:corner|floor|wing|suspension|brake duct)|floor(?: body| board| edge| fences| corner)?|beam wing|sidepods?|(?:coke/)?engine cover|diffuser|cooling(?: louvres)?|bodywork|nose|halo|chassis|mirror stay", re.I)
_refresh_lock = threading.Lock()


def classify_story(title):
    return "Technical report" if re.search(r"upgrade|floor|wing|aero|reliability|engine|fuel|power unit|suspension|cooling", title, re.I) else "Team news"


def news_for_team(team, articles, now=None):
    now = now or datetime.now(timezone.utc)
    stories, seen = [], set()
    for article in articles:
        try:
            published = parsedate_to_datetime(article.get("pubdate", "")).astimezone(timezone.utc)
        except (ValueError, TypeError, AttributeError):
            continue
        if not now - timedelta(days=21) <= published <= now:
            continue
        title = article.get("title", "")
        if re.search(r"\b(store|cap|hoodie|hooded|sweatshirt|t-shirt|jacket|knit|babywear|gilet|snapback|trucker|midlayer|merchandise|1:2|on this day)\b", title, re.I) or "store" in article.get("source", "").lower():
            continue
        if re.search(r"(?:F1|Formula 1) (?:Racing )?Team [–-]", title, re.I):
            continue
        headline = re.split(r"\s+(?:\||-)\s+", title)[0].strip()
        if not any(re.search(r"\b" + re.escape(alias) + r"\b", title, re.I) for alias in ALIASES[team]):
            continue
        url = article.get("link", "")
        if urlparse(url).scheme not in {"https", "http"} or url in seen or headline.lower() in seen:
            continue
        seen.update((url, headline.lower()))
        source = article.get("source") or (title.rsplit(" - ", 1)[-1] if " - " in title else urlparse(url).hostname)
        stories.append({"title": headline, "url": url, "source": source, "publishedAt": published.isoformat(), "kind": classify_story(title)})
    ordered = sorted(stories, key=lambda s: s["publishedAt"], reverse=True)
    # Keep recent technical reporting available even when team headlines are newer.
    technical = [s for s in ordered if s["kind"] == "Technical report"][:3]
    general = [s for s in ordered if s["kind"] == "Team news"][:3]
    return sorted(technical + general, key=lambda s: s["publishedAt"], reverse=True)


def eligible_upgrade_score(info):
    """An article or a declared component alone cannot establish a pace benefit."""
    if (info.get("Certainty") != "confirmed" or info.get("Upgrade_Validation") != "VALID"
            or not info.get("URL") or info.get("Status") in {"STABLE_SPEC", "PENDING"}):
        return 0.0
    return float(info.get("Upgrade_Score", 0.0))


def parse_fia_pages(pages):
    declarations = {}
    current = None
    for page in pages:
        lines = [re.sub(r"\s+", " ", line).strip() for line in page.splitlines() if line.strip()]
        for line in lines:
            # Team headings are short; body prose mentioning another team is not a heading.
            heading = next((team for team in TEAMS if len(line) < 100 and any(
                alias in line.lower() for alias in ALIASES[team][:1]
            )), None)
            if heading:
                current = heading
                declarations.setdefault(current, {"hasChanges": None, "components": []})
                continue
            if not current:
                continue
            entry = declarations[current]
            if re.search(r"no (?:new )?(?:updates?|changes?|upgrades?)|none submitted", line, re.I):
                if not entry["components"]:
                    entry["hasChanges"] = False
            # PDF table rows place the component before a reason such as Performance.
            row = re.match(r"^\d+\s+(.+?)\s+(?:Performance|Circuit specific|Circuit Specific|Reliability)", line)
            if row:
                label = row.group(1).strip()
                if label not in entry["components"]:
                    entry["components"].append(label)
                    entry["hasChanges"] = True
                continue
            # Extract component labels, not inferred performance or entire report text.
            if COMPONENTS.fullmatch(re.sub(r"^\d+[.)]?\s*", "", line)):
                label = re.sub(r"^\d+[.)]?\s*", "", line)
                if label not in entry["components"]:
                    entry["components"].append(label)
                    entry["hasChanges"] = True
    return declarations


def fetch_fia_document(event, year=2026):
    index = f"{FIA_INDEX}/event/{quote(event)}"
    response = requests.get(index, headers=_HEADERS, timeout=15)
    response.raise_for_status()
    tree = html.fromstring(response.content)
    links = tree.xpath('//a[contains(translate(@href,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"), "car_presentation")]/@href')
    for link in reversed(links):
        url = urljoin(FIA_ROOT, link)
        if str(year) not in url or not url.endswith(".pdf") or urlparse(url).hostname != "www.fia.com":
            continue
        pdf = requests.get(url, headers=_HEADERS, timeout=20)
        pdf.raise_for_status()
        pages = [page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf.content)).pages]
        if not pages or str(year) not in pages[0]:
            continue
        date_match = re.search(r"Date\s+(\d{1,2}\s+\w+\s+\d{4})", pages[0])
        return {"event": event, "url": url, "publishedAt": date_match.group(1) if date_match else None,
                "teams": parse_fia_pages(pages), "status": "available"}
    return {"event": event, "url": index, "teams": {}, "status": "not_published"}


def load_paddock_news():
    try:
        return json.loads(CACHE_PATH.read_text())
    except (OSError, ValueError):
        return {"updatedAt": None, "teams": [], "fiaDocuments": [], "errors": []}


def refresh_paddock_news():
    if not _refresh_lock.acquire(blocking=False):
        return
    try:
        from calendar_manager import get_next_race_full, get_past_races
        ri = get_next_race_full()
        now = datetime.now(timezone.utc)
        sources = list(_DIRECT_FEEDS)
        for team in TEAMS:
            query = f'"{team}" Formula 1 when:21d (site:formula1.com OR site:the-race.com OR site:autosport.com OR site:racefans.net)'
            sources.append(_GNEWS_RSS.format(query=quote(query)))
        with ThreadPoolExecutor(max_workers=5) as pool:
            articles = [article for group in pool.map(_parse_rss, sources) for article in group]
        previous = load_paddock_news()
        errors, documents = [], []
        past = get_past_races()
        events = [ri.name] + ([past[-1].name] if past else [])
        for event in dict.fromkeys(events):
            try:
                documents.append(fetch_fia_document(event))
            except Exception as exc:
                log.warning("FIA document unavailable for %s: %s", event, exc)
                cached = next((d for d in previous.get("fiaDocuments", []) if d["event"] == event), None)
                documents.append(cached or {"event": event, "url": f"{FIA_INDEX}/event/{quote(event)}", "status": "unavailable", "teams": {}})
                errors.append(f"FIA documents could not be refreshed for {event}.")
        teams = []
        for team in TEAMS:
            stories = news_for_team(team, articles, now)
            if not stories:
                old = next((t for t in previous.get("teams", []) if t["name"] == team), {})
                stories = [s for s in old.get("stories", []) if now - timedelta(days=21) <= datetime.fromisoformat(s["publishedAt"]) <= now]
            declarations = []
            for doc in documents:
                if team in doc["teams"]:
                    declarations.append({**doc["teams"][team], "event": doc["event"], "url": doc["url"], "publishedAt": doc.get("publishedAt")})
            teams.append({"name": team, "stories": stories, "declarations": declarations})
        if not articles:
            errors.append("News sources could not be refreshed; recent saved stories are shown when available.")
        payload = {"updatedAt": now.isoformat(), "newsUpdatedAt": now.isoformat() if articles else previous.get("newsUpdatedAt"),
                   "race": ri.name, "teams": teams, "fiaDocuments": documents, "errors": errors}
        temporary = CACHE_PATH.with_suffix(".tmp")
        temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        os.replace(temporary, CACHE_PATH)
    finally:
        _refresh_lock.release()


def paddock_feed():
    payload = load_paddock_news()
    stamp = payload.get("updatedAt")
    stale = not stamp or datetime.now(timezone.utc) - datetime.fromisoformat(stamp) > timedelta(hours=6)
    payload["isStale"] = bool(stale)
    if stale:
        threading.Thread(target=refresh_paddock_news, daemon=True).start()
    return payload


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    refresh_paddock_news()
    print(json.dumps({"updatedAt": load_paddock_news().get("updatedAt"), "teams": len(load_paddock_news().get("teams", []))}))
