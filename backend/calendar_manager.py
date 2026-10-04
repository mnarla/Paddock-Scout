"""
backend/calendar_manager.py
===========================
Dynamic F1 calendar with AUTOMATIC next-race detection via FastF1.

The schedule is fetched dynamically from FastF1 (cached locally in fastf1_cache),
ensuring official round numbers, race dates, sprint formats, and track characteristics
are always up to date.

Provides:
  get_next_race()       → (name, track_type) — simple back-compat helper
  get_next_race_full()  → RaceInfo dataclass with date, sprint flag, round index, flag, short name
  get_sprint_races()    → frozenset of race names that have a Sprint weekend
  get_past_races()      → list[RaceInfo] of all completed races, sorted oldest first
  SCHEDULE_2026         → full ordered dict of all races for 2026
"""

import os
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, FrozenSet, Optional, Tuple, List
import pandas as pd
import fastf1

log = logging.getLogger(__name__)

CACHE_DIR = "fastf1_cache"
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

# ── Circuit characteristics & metadata ─────────────────────────────────────────
STREET_CIRCUITS: FrozenSet[str] = frozenset({
    "Australian Grand Prix",
    "Miami Grand Prix",
    "Canadian Grand Prix",
    "Monaco Grand Prix",
    "Azerbaijan Grand Prix",
    "Singapore Grand Prix",
    "Las Vegas Grand Prix",
})

COUNTRY_FLAGS: Dict[str, str] = {
    "Australia": "🇦🇺",
    "China": "🇨🇳",
    "Japan": "🇯🇵",
    "United States": "🇺🇸",
    "Canada": "🇨🇦",
    "Monaco": "🇲🇨",
    "Spain": "🇪🇸",
    "Austria": "🇦🇹",
    "United Kingdom": "🇬🇧",
    "Belgium": "🇧🇪",
    "Hungary": "🇭🇺",
    "Netherlands": "🇳🇱",
    "Italy": "🇮🇹",
    "Azerbaijan": "🇦🇿",
    "Bahrain": "🇧🇭",
    "Singapore": "🇸🇬",
    "Mexico": "🇲🇽",
    "Brazil": "🇧🇷",
    "Qatar": "🇶🇦",
    "United Arab Emirates": "🇦🇪",
}

SHORT_NAMES: Dict[str, str] = {
    "Australian Grand Prix": "Melbourne",
    "Chinese Grand Prix": "Shanghai",
    "Japanese Grand Prix": "Suzuka",
    "Miami Grand Prix": "Miami",
    "Canadian Grand Prix": "Montréal",
    "Monaco Grand Prix": "Monaco",
    "Barcelona Grand Prix": "Barcelona",
    "Austrian Grand Prix": "Spielberg",
    "British Grand Prix": "Silverstone",
    "Belgian Grand Prix": "Spa",
    "Hungarian Grand Prix": "Budapest",
    "Dutch Grand Prix": "Zandvoort",
    "Italian Grand Prix": "Monza",
    "Spanish Grand Prix": "Madrid",
    "Azerbaijan Grand Prix": "Baku",
    "Bahrain Grand Prix": "Sakhir",
    "Singapore Grand Prix": "Marina Bay",
    "United States Grand Prix": "Austin",
    "Mexico City Grand Prix": "Mexico City",
    "São Paulo Grand Prix": "Interlagos",
    "Las Vegas Grand Prix": "Las Vegas",
    "Qatar Grand Prix": "Lusail",
    "Abu Dhabi Grand Prix": "Yas Marina",
}


def fetch_season_schedule(year: int = 2026) -> Dict[str, Dict[str, Any]]:
    """
    Dynamically fetch the official F1 season schedule via FastF1.
    Returns an ordered dict mapping EventName -> info dict.
    """
    try:
        sched = fastf1.get_event_schedule(year)
        races = sched[sched["RoundNumber"] > 0]
        schedule = {}
        for _, row in races.iterrows():
            name = str(row["EventName"])
            country = str(row["Country"])
            location = str(row["Location"])
            round_num = int(row["RoundNumber"])
            date = row["EventDate"].to_pydatetime()
            is_sprint = "sprint" in str(row.get("EventFormat", "")).lower()
            track_type = "Street" if name in STREET_CIRCUITS else "Permanent"
            flag = COUNTRY_FLAGS.get(country, "🏁")
            short = SHORT_NAMES.get(name, location)

            sessions = []
            for i in range(1, 6):
                s_name = str(row.get(f"Session{i}", f"Session {i}"))
                s_utc = row.get(f"Session{i}DateUtc")
                if pd.notna(s_utc):
                    iso_str = s_utc.strftime("%Y-%m-%dT%H:%M:%SZ") if hasattr(s_utc, "strftime") else str(s_utc)
                    short_s = "FP1" if s_name == "Practice 1" else \
                              "FP2" if s_name == "Practice 2" else \
                              "FP3" if s_name == "Practice 3" else \
                              "Sprint Shootout" if ("Sprint" in s_name and "Qualifying" in s_name) else \
                              "Sprint" if s_name == "Sprint" else \
                              "Qualifying" if s_name == "Qualifying" else \
                              "Grand Prix" if s_name == "Race" else s_name
                    sessions.append({
                        "name": s_name,
                        "shortName": short_s,
                        "utcTime": iso_str,
                    })

            schedule[name] = {
                "date": date,
                "round": round_num,
                "track_type": track_type,
                "country": country,
                "location": location,
                "flag": flag,
                "short": short,
                "is_sprint": is_sprint,
                "sessions": sessions,
            }
        if schedule:
            return schedule
    except Exception as exc:
        log.warning(f"Could not load {year} schedule from FastF1: {exc}")

    return {}


# ── Dynamically loaded schedule & sprint list ─────────────────────────────────
SCHEDULE_2026: Dict[str, Dict[str, Any]] = fetch_season_schedule(2026)

SPRINT_RACES_2026: FrozenSet[str] = frozenset(
    name for name, info in SCHEDULE_2026.items() if info.get("is_sprint")
)


# ── RaceInfo dataclass ────────────────────────────────────────────────────────
@dataclass
class RaceInfo:
    """Full context for a single race weekend."""
    name:        str
    track_type:  str
    date:        datetime
    round_num:   int
    is_sprint:   bool
    days_away:   int
    short:       str = "GP"
    country:     str = "Unknown"
    flag:        str = "🏁"
    sessions:    List[Dict[str, Any]] = field(default_factory=list)


# ── Dynamic Status Helper ─────────────────────────────────────────────────────
def _is_cancelled(name: str) -> bool:
    """Return True if a race has been manually marked as Cancelled."""
    return SCHEDULE_2026.get(name, {}).get("status", "") == "Cancelled"


def _is_past(info: Dict[str, Any], now: datetime) -> bool:
    """Return True if the race is completed (results CSV exists, race session + 3.5h is past, or race date + 1 day in UTC is past)."""
    rnd = info.get("round")
    if rnd:
        csv_path = os.path.join(os.path.dirname(__file__), "..", "data", f"results_2026_round{rnd:02d}.csv")
        if os.path.exists(csv_path):
            return True

    # If session timings are available, check if the Grand Prix race has concluded on track (+3.5 hours)
    for session in info.get("sessions", []):
        if session.get("shortName") in ("Grand Prix", "Race") or "Race" in session.get("name", ""):
            utc_str = session.get("utcTime")
            if utc_str:
                try:
                    race_time = datetime.fromisoformat(utc_str.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
                    if race_time + timedelta(hours=3, minutes=30) <= now:
                        return True
                except Exception:
                    pass

    return info["date"] + timedelta(days=1) <= now


# ── Public API ────────────────────────────────────────────────────────────────
def get_sprint_races() -> FrozenSet[str]:
    """Return the set of 2026 race names that include a Sprint session."""
    return SPRINT_RACES_2026


def get_next_race_full(now: Optional[datetime] = None) -> RaceInfo:
    """
    Return a RaceInfo for the next upcoming (non-cancelled) race.

    Status is determined dynamically from UTC system date and completed results:
    - Races with completed result CSVs or whose date + 1 day in UTC is past are Completed.
    - Only non-cancelled, non-completed races are candidates.

    Uses UTC time by default. Pass `now` explicitly for testing.
    Falls back to the last race in the schedule if all races are in the past.
    """
    if now is None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

    candidates = [
        (name, info)
        for name, info in SCHEDULE_2026.items()
        if not _is_cancelled(name) and not _is_past(info, now)
    ]

    if not candidates:
        # Season complete — return last race in schedule
        if SCHEDULE_2026:
            name, info = sorted(SCHEDULE_2026.items(), key=lambda x: x[1]["round"])[-1]
        else:
            name, info = "Abu Dhabi Grand Prix", {
                "track_type": "Permanent", "date": datetime(2026, 12, 6), "round": 23,
                "is_sprint": False, "short": "Yas Marina", "country": "UAE", "flag": "🇦🇪"
            }
    else:
        candidates.sort(key=lambda x: x[1]["date"])
        name, info = candidates[0]

    return RaceInfo(
        name       = name,
        track_type = info["track_type"],
        date       = info["date"],
        round_num  = info["round"],
        is_sprint  = info.get("is_sprint", False),
        days_away  = (info["date"] - now).days,
        short      = info.get("short", "GP"),
        country    = info.get("country", "Unknown"),
        flag       = info.get("flag", "🏁"),
        sessions   = info.get("sessions", []),
    )


def get_next_race(now: Optional[datetime] = None) -> Tuple[str, str]:
    """Back-compat helper. Returns (race_name, track_type)."""
    info = get_next_race_full(now)
    return info.name, info.track_type


def get_past_races(now: Optional[datetime] = None) -> list:
    """Return a list of RaceInfo for all completed 2026 races."""
    if now is None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

    past = []
    for name, info in SCHEDULE_2026.items():
        if _is_cancelled(name):
            continue
        if _is_past(info, now):
            past.append(RaceInfo(
                name       = name,
                track_type = info["track_type"],
                date       = info["date"],
                round_num  = info["round"],
                is_sprint  = info.get("is_sprint", False),
                days_away  = (info["date"] - now).days,
                short      = info.get("short", "GP"),
                country    = info.get("country", "Unknown"),
                flag       = info.get("flag", "🏁"),
                sessions   = info.get("sessions", []),
            ))

    past.sort(key=lambda r: r.date)
    return past


# ── Module-level convenience ──────────────────────────────────────────────────
NEXT_RACE_NAME, NEXT_TRACK_TYPE = get_next_race()

if __name__ == "__main__":
    ri = get_next_race_full()
    sprint_tag = " 🏎️ Sprint weekend" if ri.is_sprint else ""
    print(f"Current Date : {datetime.now():%Y-%m-%d %H:%M}")
    print(f"Next Race    : {ri.flag} {ri.name} ({ri.short}) (Round {ri.round_num}){sprint_tag}")
    print(f"Race Date    : {ri.date:%Y-%m-%d}  ({ri.days_away} days away)")
    print(f"Track Type   : {ri.track_type}")
    print()
    print("Past races this season:")
    for r in get_past_races():
        days_ago = abs(r.days_away)
        print(f"  Rd {r.round_num:02d}  {r.flag} {r.name:<30} ({days_ago} days ago)")
