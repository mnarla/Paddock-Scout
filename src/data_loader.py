"""
src/data_loader.py — Live-First F1 Data Loader
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
  python src/data_loader.py              # load all seasons
  python src/data_loader.py --current   # load current race weekend only
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
    (future race, cancelled, or API error).

    Parameters
    ----------
    year, event_name, rnd : race identity
    ff1_key  : FastF1 session identifier e.g. 'R', 'Q', 'FP1', 'Sprint'
    suffix   : CSV filename suffix  e.g. '', 'q', 's', 'fp1'
    session_weight : written into Session_Weight column (2.5 for Sprint)
    force    : overwrite an existing CSV even if it already exists
    """
    path = _csv_path(year, rnd, suffix)
    if os.path.exists(path) and not force:
        log.debug(f"  Already cached: {path}")
        return True

    try:
        session = fastf1.get_session(year, event_name, ff1_key)
        session.load(telemetry=False, laps=False, weather=False, messages=False)
        results = session.results
        if results is None or results.empty:
            log.warning(f"  No results: {year} {event_name} [{ff1_key}]")
            return False

        results = results.copy()
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
def load_event(year: int, event_name: str, rnd: int, force: bool = False) -> None:
    """
    Download all available sessions for one race weekend.
    Attempts to fetch ['FP1', 'FP2', 'FP3', 'Q', 'S', 'R'].
    If a session doesn't exist, it catches the error and continues.
    """
    log.info(f"Processing {year} Round {rnd:02d}: {event_name}")

    sessions_to_fetch = ['FP1', 'FP2', 'FP3', 'Q', 'S', 'R']
    
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
def load_current_weekend(force: bool = False) -> None:
    """
    Download all available sessions for the next/current race weekend.

    Called automatically on app startup to pull the latest FP, Sprint,
    and Qualifying results as soon as they hit the FastF1 API.
    """
    ri = get_next_race_full()
    log.info(f"Current weekend: {ri.name} (Round {ri.round_num}, {ri.date:%Y-%m-%d})")
    load_event(
        year       = ri.date.year,
        event_name = ri.name,
        rnd        = ri.round_num,
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
        expected_csv = os.path.join(DATA_DIR, f"results_2026_round{race.round_num:02d}.csv")
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
    parser.add_argument("--past-missing", action="store_true",
                        help="Ingest any completed race that is missing its CSV (used by CI)")
    parser.add_argument("--force", action="store_true",
                        help="Re-download even if CSV already exists")
    args = parser.parse_args()

    if args.current:
        load_current_weekend(force=args.force)
    elif args.past_missing:
        ingest_past_missing(force=args.force)
    else:
        log.info("Loading all historical seasons …")
        for year in SEASONS:
            load_season(year, force=args.force)

    log.info(f"Done.  Data: '{DATA_DIR}/'   Cache: '{CACHE_DIR}/'")


if __name__ == "__main__":
    main()
