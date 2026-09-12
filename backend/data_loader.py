"""
backend/data_loader.py — Live-First F1 Data Loader
================================================
Downloads race results, qualifying, sprint, AND practice sessions
for the current race weekend as soon as they are available in the FastF1 API.

Session mapping per weekend type:
  Standard weekend : FP1, FP2, FP3, Qualifying, Race
  Sprint weekend   : FP1, Sprint Qualifying (SQ), Sprint, Qualifying, Race

CSV naming convention:
  results_{year}_round{rnd:02d}.csv        ← Race
  results_{year}_round{rnd:02d}q.csv       ← Qualifying
  results_{year}_round{rnd:02d}s.csv       ← Sprint
  results_{year}_round{rnd:02d}fp1.csv     ← FP1
  results_{year}_round{rnd:02d}fp2.csv     ← FP2
  results_{year}_round{rnd:02d}fp3.csv     ← FP3

Usage:
  python backend/data_loader.py              # load all seasons
  python backend/data_loader.py --current   # load current race weekend only
"""

import argparse
import logging
import os
import sys
from typing import List, Optional

import fastf1
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from calendar_manager import get_next_race_full, get_past_races, get_sprint_races, SCHEDULE_2026

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger(__name__)

CACHE_DIR = "fastf1_cache"
DATA_DIR  = "data"
SEASONS   = [2023, 2024, 2025, 2026]

# FastF1 session identifiers for each slot
sessions_to_fetch = ['FP1', 'FP2', 'FP3', 'Q', 'S', 'R']

SPRINT_RACES = get_sprint_races()


# ─────────────────────────────────────────────────────────────────────────────
def setup_environment() -> None:
    """Create cache and data directories, enable FastF1 cache."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(CACHE_DIR)
    log.info(f"FastF1 cache enabled at: {CACHE_DIR}")


# ─────────────────────────────────────────────────────────────────────────────
def _session_type_label(suffix: str) -> str:
    """Map CSV suffix to a human-readable SessionType string."""
    return {
        "":    "Race",
        "q":   "Qualifying",
        "s":   "Sprint",
        "sq":  "SprintQualifying",
        "fp1": "FP1",
        "fp2": "FP2",
        "fp3": "FP3",
    }.get(suffix, suffix.upper())


def _csv_path(year: int, rnd: int, suffix: str) -> str:
    """Build the canonical CSV path for a session."""
    return os.path.join(DATA_DIR, f"results_{year}_round{rnd:02d}{suffix}.csv")


def _is_session_results_populated(results: pd.DataFrame) -> bool:
    """Check whether session results DataFrame contains non-null positions or lap times."""
    if results is None or results.empty:
        return False
    has_pos = "Position" in results.columns and results["Position"].dropna().count() > 0
    has_time = "Time" in results.columns and results["Time"].dropna().count() > 0
    return bool(has_pos or has_time)


def _is_csv_populated(path: str) -> bool:
    """Check whether a CSV on disk has non-null positions or times."""
    if not os.path.exists(path):
        return False
    try:
        df = pd.read_csv(path)
        return _is_session_results_populated(df)
    except Exception:
        return False


def get_sessions_for_day(day: str, is_sprint: bool) -> List[str]:
    """
    Determine which FastF1 sessions should be fetched for a given day:
      - 'friday':   FP1 and FP2 (or FP1 and SQ if sprint weekend)
      - 'saturday': FP3 and Q (or Sprint and Q if sprint weekend)
      - 'sunday':   Grand Prix Race (R)
      - 'all':      All weekend sessions
    """
    day = day.lower().strip()
    if day == "friday":
        return ["FP1", "SQ", "FP2"] if is_sprint else ["FP1", "FP2"]
    elif day == "saturday":
        return ["S", "Q"] if is_sprint else ["FP3", "Q"]
    elif day == "sunday":
        return ["R"]
    elif day == "all":
        return ["FP1", "FP2", "FP3", "Q", "S", "R"]
    else:
        raise ValueError(f"Unknown day '{day}'. Allowed: 'friday', 'saturday', 'sunday', 'all', 'auto'.")


def resolve_auto_day(now: Optional[object] = None) -> str:
    """
    Auto-detect session day based on current weekday:
      - Friday (weekday 4): 'friday'
      - Saturday (weekday 5): 'saturday'
      - Sunday (weekday 6) or Monday (weekday 0): 'sunday'
      - Other days: 'all'
    """
    if now is None:
        from datetime import datetime
        now = datetime.now()
    wd = now.weekday()
    if wd == 4:
        return "friday"
    elif wd == 5:
        return "saturday"
    elif wd in (6, 0):
        return "sunday"
    return "all"


ABBR_TO_DRIVER_ID = {
    "HAM": "hamilton", "VER": "max_verstappen", "NOR": "norris", "LEC": "leclerc",
    "RUS": "russell", "ANT": "antonelli", "PIA": "piastri", "ALO": "alonso",
    "SAI": "sainz", "GAS": "gasly", "ALB": "albon", "TSU": "tsunoda",
    "STR": "stroll", "HUL": "hulkenberg", "OCO": "ocon", "BEA": "bearman",
    "COL": "colapinto", "BOR": "bortoleto", "LAW": "lawson", "BOT": "bottas",
    "PER": "perez", "LIN": "arvid_lindblad", "HAD": "hadjar"
}

TEAM_NAME_TO_TEAM_ID = {
    "Ferrari": "ferrari", "Mercedes": "mercedes", "McLaren": "mclaren",
    "Red Bull Racing": "red_bull", "Aston Martin": "aston_martin",
    "Alpine": "alpine", "Williams": "williams", "Racing Bulls": "rb",
    "Haas F1 Team": "haas", "Audi": "audi", "Cadillac": "cadillac"
}


def _is_session_results_populated(results: pd.DataFrame, is_practice: bool = False) -> bool:
    """Check whether session results DataFrame contains completed session data."""
    if results is None or results.empty:
        return False
    if is_practice:
        return len(results) >= 10
    has_pos = "Position" in results.columns and results["Position"].dropna().count() > 0
    has_time = "Time" in results.columns and results["Time"].dropna().count() > 0
    return bool(has_pos or has_time)


def _is_csv_populated(path: str, is_practice: bool = False) -> bool:
    """Check whether a CSV on disk has valid session data."""
    if not os.path.exists(path):
        return False
    try:
        df = pd.read_csv(path)
        return _is_session_results_populated(df, is_practice=is_practice)
    except Exception:
        return False


def _save_session(
    year:           int,
    event_name:     str,
    rnd:            int,
    ff1_key:        str,
    suffix:         str,
    session_weight: float,
    force:          bool = False,
) -> bool:
    """
    Download a single FastF1 session and save results to CSV.

    Returns True if saved successfully, False if the session is unavailable
    (future race, cancelled, no completed results yet, or API error).
    """
    is_practice = ff1_key in ('FP1', 'FP2', 'FP3')
    path = _csv_path(year, rnd, suffix)
    if os.path.exists(path) and not force:
        if _is_csv_populated(path, is_practice=is_practice):
            log.debug(f"  Already cached: {path}")
            return True
        else:
            log.info(f"  Existing file {path} has no classified data — attempting refresh")

    try:
        session = fastf1.get_session(year, event_name, ff1_key)
        session.load(telemetry=False, laps=False, weather=False, messages=False)
        results = session.results
        if not _is_session_results_populated(results, is_practice=is_practice):
            log.warning(f"  No completed timings/positions yet: {year} {event_name} [{ff1_key}] — skipping save")
            return False

        results = results.copy()
        if "DriverId" not in results.columns or results["DriverId"].isna().all() or (results["DriverId"] == "").all():
            results["DriverId"] = results["Abbreviation"].map(ABBR_TO_DRIVER_ID)
        else:
            results["DriverId"] = results["DriverId"].fillna(results["Abbreviation"].map(ABBR_TO_DRIVER_ID))

        if "TeamId" not in results.columns or results["TeamId"].isna().all() or (results["TeamId"] == "").all():
            results["TeamId"] = results["TeamName"].map(TEAM_NAME_TO_TEAM_ID)
        else:
            results["TeamId"] = results["TeamId"].fillna(results["TeamName"].map(TEAM_NAME_TO_TEAM_ID))

        results["Year"]           = year
        results["Round"]          = rnd
        results["EventName"]      = event_name
        results["SessionType"]    = _session_type_label(suffix)
        results["Session_Weight"] = session_weight
        results.to_csv(path, index=False)
        log.info(f"  ✅ Saved {path}")
        return True

    except Exception as exc:
        log.warning(f"  ⚠️  {year} {event_name} [{ff1_key}]: {exc}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
def load_event(
    year: int,
    event_name: str,
    rnd: int,
    sessions: Optional[List[str]] = None,
    force: bool = False,
) -> None:
    """
    Download specified sessions for one race weekend.
    Defaults to all sessions if not specified.
    """
    log.info(f"Processing {year} Round {rnd:02d}: {event_name}")

    sessions_to_fetch = sessions if sessions is not None else ['FP1', 'FP2', 'FP3', 'Q', 'S', 'R']

    for ff1_key in sessions_to_fetch:
        suffix = ff1_key.lower() if ff1_key != 'R' else ''
        weight = 2.5 if ff1_key == 'S' else 1.0

        _save_session(year, event_name, rnd, ff1_key, suffix, weight, force=force)


# ─────────────────────────────────────────────────────────────────────────────
def load_season(year: int, force: bool = False) -> None:
    """Download all available sessions for every race in a given year."""
    log.info(f"=== Loading {year} season ===")
    try:
        schedule = fastf1.get_event_schedule(year)
    except Exception as exc:
        log.error(f"Could not fetch {year} schedule: {exc}")
        return

    for _, event in schedule.iterrows():
        if event["EventFormat"] == "testing":
            continue
        load_event(
            year       = year,
            event_name = event["EventName"],
            rnd        = int(event["RoundNumber"]),
            force      = force,
        )


# ─────────────────────────────────────────────────────────────────────────────
def load_current_weekend(day: str = "all", force: bool = False) -> None:
    """
    Download sessions for the next/current race weekend targeted by day:
      - 'friday':   FP1 and FP2 (and SQ if sprint weekend)
      - 'saturday': FP3 and Qualifying (and Sprint if sprint weekend)
      - 'sunday':   Grand Prix Race (R)
      - 'auto':     Infers day based on current weekday
      - 'all':      All weekend sessions
    """
    ri = get_next_race_full()
    target_day = resolve_auto_day() if day == "auto" else day
    sessions = get_sessions_for_day(target_day, ri.is_sprint)

    log.info(f"Current weekend: {ri.name} (Round {ri.round_num}, {ri.date:%Y-%m-%d}) | Target day: {target_day} | Sessions: {sessions}")
    load_event(
        year       = ri.date.year,
        event_name = ri.name,
        rnd        = ri.round_num,
        sessions   = sessions,
        force      = force,
    )


# ─────────────────────────────────────────────────────────────────────────────
def ingest_past_missing(force: bool = False) -> None:
    """
    Download telemetry for every completed race that is missing its race CSV.

    This is the function called by the GitHub Actions cron job so that
    new race data is fetched and committed automatically each Monday.
    """
    past = get_past_races()
    if not past:
        log.info("No completed races found yet this season.")
        return

    for race in past:
        expected_csv = os.path.join(DATA_DIR, f"results_{year}_round{race.round_num:02d}.csv") if 'year' in locals() else os.path.join(DATA_DIR, f"results_{race.date.year}_round{race.round_num:02d}.csv")
        if not os.path.exists(expected_csv) or force:
            log.info(f"Missing data for Round {race.round_num} ({race.name}) — downloading …")
            load_event(
                year       = race.date.year,
                event_name = race.name,
                rnd        = race.round_num,
                force      = force,
            )
        else:
            log.info(f"Rd {race.round_num:02d} {race.name}: already present, skipping.")


# ─────────────────────────────────────────────────────────────────────────────
def main() -> None:
    setup_environment()
    parser = argparse.ArgumentParser(description="F1 Live Data Loader")
    parser.add_argument("--current", action="store_true",
                        help="Only load the current race weekend (fast)")
    parser.add_argument("--day", choices=["friday", "saturday", "sunday", "auto", "all"],
                        default="all",
                        help="Which day's sessions to load: friday (FP1, FP2), saturday (FP3, Q, Sprint), sunday (Race), auto, or all")
    parser.add_argument("--friday", action="store_const", dest="day", const="friday",
                        help="Shortcut for --day friday (FP1, FP2)")
    parser.add_argument("--saturday", action="store_const", dest="day", const="saturday",
                        help="Shortcut for --day saturday (FP3, Q, Sprint)")
    parser.add_argument("--sunday", action="store_const", dest="day", const="sunday",
                        help="Shortcut for --day sunday (Race)")
    parser.add_argument("--past-missing", action="store_true",
                        help="Ingest any completed race that is missing its CSV (used by CI)")
    parser.add_argument("--force", action="store_true",
                        help="Re-download even if CSV already exists")
    args = parser.parse_args()

    if args.current:
        load_current_weekend(day=args.day, force=args.force)
    elif args.past_missing:
        ingest_past_missing(force=args.force)
    else:
        log.info("Loading all historical seasons …")
        for year in SEASONS:
            load_season(year, force=args.force)

    log.info(f"Done.  Data: '{DATA_DIR}/'   Cache: '{CACHE_DIR}/'")


if __name__ == "__main__":
    main()
