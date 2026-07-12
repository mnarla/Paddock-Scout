"""
src/calendar_manager.py
=======================
2026 F1 calendar with AUTOMATIC next-race detection.

Race statuses are now computed dynamically from the current system date —
no more manual "status": "Completed" edits needed after each race.

A race is considered "Completed" once its race date + 1 day is in the past.
A race can be manually marked "Cancelled" to exclude it from detection.

Provides:
  get_next_race()       → (name, track_type) — simple back-compat helper
  get_next_race_full()  → RaceInfo dataclass with date, sprint flag, round index
  get_sprint_races()    → frozenset of race names that have a Sprint weekend
  get_past_races()      → list[RaceInfo] of all completed races, sorted oldest first
  SCHEDULE_2026         → full ordered dict of all races
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Any, FrozenSet, Optional, Tuple


# ── 2026 Sprint weekends ───────────────────────────────────────────────────────
# These races have a Sprint session on Saturday before the main race on Sunday.
SPRINT_RACES_2026: FrozenSet[str] = frozenset({
    "Miami Grand Prix",
    "Canadian Grand Prix",
    "British Grand Prix",
    "Dutch Grand Prix",
    "Singapore Grand Prix",
})


# ── 2026 F1 Schedule ──────────────────────────────────────────────────────────
# Each entry: date = race day (Sunday), round = 1-indexed round number.
# "status" is only needed to manually mark a race as "Cancelled".
# Past/future status is now computed automatically from the race date.
SCHEDULE_2026: Dict[str, Dict[str, Any]] = {
    "Australian Grand Prix": {
        "date":       datetime(2026, 3, 8),
        "round":      1,
        "track_type": "Street",
    },
    "Chinese Grand Prix": {
        "date":       datetime(2026, 3, 15),
        "round":      2,
        "track_type": "Permanent",
    },
    "Japanese Grand Prix": {
        "date":       datetime(2026, 3, 29),
        "round":      3,
        "track_type": "Permanent",
    },
    "Miami Grand Prix": {
        "date":       datetime(2026, 5, 3),
        "round":      4,
        "track_type": "Street",
    },
    "Canadian Grand Prix": {
        "date":       datetime(2026, 5, 24),
        "round":      5,
        "track_type": "Street",
    },
    "Monaco Grand Prix": {
        "date":       datetime(2026, 6, 7),
        "round":      6,
        "track_type": "Street",
    },
    "Barcelona Grand Prix": {
        "date":       datetime(2026, 6, 14),
        "round":      7,
        "track_type": "Permanent",
    },
    "Austrian Grand Prix": {
        "date":       datetime(2026, 6, 28),
        "round":      8,
        "track_type": "Permanent",
    },
    "British Grand Prix": {
        "date":       datetime(2026, 7, 5),
        "round":      9,
        "track_type": "Permanent",
    },
    "Belgian Grand Prix": {
        "date":       datetime(2026, 7, 19),
        "round":      10,
        "track_type": "Permanent",
    },
    "Hungarian Grand Prix": {
        "date":       datetime(2026, 7, 26),
        "round":      11,
        "track_type": "Permanent",
    },
    "Dutch Grand Prix": {
        "date":       datetime(2026, 8, 23),
        "round":      12,
        "track_type": "Permanent",
    },
    "Italian Grand Prix": {
        "date":       datetime(2026, 9, 6),
        "round":      13,
        "track_type": "Permanent",
    },
    "Spanish Grand Prix": {
        "date":       datetime(2026, 9, 13),
        "round":      14,
        "track_type": "Permanent",
    },
    "Azerbaijan Grand Prix": {
        "date":       datetime(2026, 9, 26),
        "round":      15,
        "track_type": "Street",
    },
    "Singapore Grand Prix": {
        "date":       datetime(2026, 10, 11),
        "round":      16,
        "track_type": "Street",
    },
    "United States Grand Prix": {
        "date":       datetime(2026, 10, 25),
        "round":      17,
        "track_type": "Permanent",
    },
    "Mexico City Grand Prix": {
        "date":       datetime(2026, 11, 1),
        "round":      18,
        "track_type": "Permanent",
    },
    "São Paulo Grand Prix": {
        "date":       datetime(2026, 11, 8),
        "round":      19,
        "track_type": "Permanent",
    },
    "Las Vegas Grand Prix": {
        "date":       datetime(2026, 11, 21),
        "round":      20,
        "track_type": "Street",
    },
    "Qatar Grand Prix": {
        "date":       datetime(2026, 11, 29),
        "round":      21,
        "track_type": "Permanent",
    },
    "Abu Dhabi Grand Prix": {
        "date":       datetime(2026, 12, 6),
        "round":      22,
        "track_type": "Permanent",
    },
}


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


# ── Dynamic Status Helper ─────────────────────────────────────────────────────
def _is_cancelled(name: str) -> bool:
    """Return True if a race has been manually marked as Cancelled."""
    return SCHEDULE_2026[name].get("status", "") == "Cancelled"


def _is_past(info: Dict[str, Any], now: datetime) -> bool:
    """Return True if the race date + 1 day grace period is in the past."""
    return info["date"] + timedelta(days=1) <= now


# ── Public API ────────────────────────────────────────────────────────────────
def get_sprint_races() -> FrozenSet[str]:
    """Return the set of 2026 race names that include a Sprint session."""
    return SPRINT_RACES_2026


def get_next_race_full(now: Optional[datetime] = None) -> RaceInfo:
    """
    Return a RaceInfo for the next upcoming (non-cancelled) race.

    Status is determined dynamically from the current system date:
    - Races whose date + 1 day is in the past are considered Completed.
    - Only non-cancelled, non-completed races are candidates.

    Uses the current system time by default. Pass `now` explicitly for testing.
    Falls back to the last race in the schedule if all races are in the past.
    """
    if now is None:
        now = datetime.now()

    candidates = [
        (name, info)
        for name, info in SCHEDULE_2026.items()
        if not _is_cancelled(name) and not _is_past(info, now)
    ]

    if not candidates:
        # Season complete — return Abu Dhabi as the final race
        name = "Abu Dhabi Grand Prix"
        info = SCHEDULE_2026[name]
    else:
        candidates.sort(key=lambda x: x[1]["date"])
        name, info = candidates[0]

    return RaceInfo(
        name       = name,
        track_type = info["track_type"],
        date       = info["date"],
        round_num  = info["round"],
        is_sprint  = name in SPRINT_RACES_2026,
        days_away  = (info["date"] - now).days,
    )


def get_next_race(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    Back-compat helper.  Returns (race_name, track_type).

    Prefer get_next_race_full() for new code.
    """
    info = get_next_race_full(now)
    return info.name, info.track_type


def get_past_races(now: Optional[datetime] = None) -> list:
    """
    Return a list of RaceInfo for all completed 2026 races.

    A race is considered past when its race date + 1 day is in the past.
    Manually cancelled races are excluded.
    Results are sorted chronologically (earliest first).

    Parameters
    ----------
    now : datetime, optional
        Current time. Defaults to datetime.now().

    Returns
    -------
    list[RaceInfo]
        May be empty at the start of the season.
    """
    if now is None:
        now = datetime.now()

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
                is_sprint  = name in SPRINT_RACES_2026,
                days_away  = (info["date"] - now).days,  # negative = days ago
            ))

    past.sort(key=lambda r: r.date)
    return past


# ── Module-level convenience ──────────────────────────────────────────────────
NEXT_RACE_NAME, NEXT_TRACK_TYPE = get_next_race()

if __name__ == "__main__":
    ri = get_next_race_full()
    sprint_tag = " 🏎️ Sprint weekend" if ri.is_sprint else ""
    print(f"Current Date : {datetime.now():%Y-%m-%d %H:%M}")
    print(f"Next Race    : {ri.name} (Round {ri.round_num}){sprint_tag}")
    print(f"Race Date    : {ri.date:%Y-%m-%d}  ({ri.days_away} days away)")
    print(f"Track Type   : {ri.track_type}")
    print()
    print("Past races this season:")
    for r in get_past_races():
        days_ago = abs(r.days_away)
        print(f"  Rd {r.round_num:02d}  {r.name:<35} ({days_ago} days ago)")
