"""
src/news_agent.py
=================
Automated Web Intelligence Engineer for F1 technical updates.

Searches The Race, F1Technical.net, and Motorsport.com for team upgrades.
Scores them, validates against FP2, and outputs to live_tech_updates.json.
"""

import os
import json
import time
import logging
import pandas as pd
from typing import Dict, Any

log = logging.getLogger(__name__)

try:
    from duckduckgo_search import DDGS
    DDGS_AVAILABLE = True
except ImportError:
    DDGS_AVAILABLE = False
    log.warning("duckduckgo_search not installed.")

DATA_DIR = "data"

TEAMS = [
    "Red Bull Racing", "Ferrari", "Mercedes", "McLaren", "Aston Martin",
    "Alpine", "Williams", "Racing Bulls", "Audi", "Haas F1 Team", "Cadillac"
]

# Legacy cache for fetch_race_intelligence
_CACHE: Dict[str, Dict[str, Any]] = {}

def _ddg_search(query: str, max_results: int = 5) -> str:
    """Run a DuckDuckGo text search and return concatenated snippets."""
    if not DDGS_AVAILABLE:
        return ""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        return " ".join(r.get("body", "") for r in results)
    except Exception as exc:
        log.warning(f"DuckDuckGo search failed for '{query}': {exc}")
        return ""

def _get_fp2_position(team_name: str, year: int, rnd: int) -> float:
    """Return the best FP2 position for a given team. If no FP2 data, return 1.0"""
    path = os.path.join(DATA_DIR, f"results_{year}_round{rnd:02d}fp2.csv")
    if not os.path.exists(path):
        return 1.0
    df = pd.read_csv(path)
    df["Position"] = pd.to_numeric(df["Position"], errors="coerce")
    team_df = df[df["TeamName"] == team_name]
    if team_df.empty:
        return 1.0
    return team_df["Position"].min()

def build_live_tech_updates() -> Dict[str, dict]:
    from calendar_manager import get_next_race_full
    from datetime import datetime
    
    ri = get_next_race_full()
    target_race = ri.name
    track_type = ri.track_type
    year = ri.date.year
    round_num = ri.round_num
    
    log.info(f"Building tech updates for {target_race} ...")
    
    sites = "site:the-race.com OR site:f1technical.net OR site:motorsport.com"
    updates = {}
    
    # Intelligent Matching
    track_keywords = ""
    if track_type == "Street":
        track_keywords = "OR Wall clearance OR Low-speed traction"
    else:  # Permanent/Power
        track_keywords = "OR ERS deployment OR Straight-line speed"
    
    current_month = datetime.now().strftime('%B %Y')
    
    for team in TEAMS:
        # Dynamic Keyword Generation
        query = (
            f'"{team}" ({target_race} GP Technical Upgrades OR '
            f'F1 2026 {target_race} Aero Package OR '
            f'2026 Power Unit clipping {target_race} {track_keywords}) '
            f'{current_month} F1 tech news {sites}'
        )
        
        text = _ddg_search(query, max_results=3).lower()
        time.sleep(1)  # Rate limit
        
        upg_score = 0.0
        pwr_boost = 0.0
        
        if "major floor" in text or "sidepod" in text:
            upg_score = 0.8
        elif "minor wing" in text or "endplate" in text:
            upg_score = 0.3
            
        if "mgu-k" in text or "software map" in text:
            pwr_boost = 0.5
            
        # Validation
        upg_valid = True
        fp2_pos = _get_fp2_position(team, year, round_num)
        
        # If the news says 'Major Upgrade' but the driver is P15 or worse in FP2
        if upg_score == 0.8 and fp2_pos >= 15:
            upg_valid = False
            
        if upg_score > 0 or pwr_boost > 0:
            updates[team] = {
                "Upgrade_Score": upg_score,
                "Power_Boost": pwr_boost,
                "Upgrade_Validation": upg_valid,
                "FP2_Best_Pos": float(fp2_pos),
                "Sources": ["The Race", "F1Technical", "Motorsport.com"]
            }
            
    with open("live_tech_updates.json", "w") as f:
        json.dump(updates, f, indent=4)
        
    return updates


# ── Legacy function for app.py compatibility ──────────────────────────────────
def fetch_race_intelligence(race_name: str, force_live: bool = False) -> Dict[str, Any]:
    """Returns Wetness_Factor for Monte Carlo, and triggers Tech Updates."""
    if race_name in _CACHE and not force_live:
        return _CACHE[race_name]

    # Quick dummy DDG for weather just to keep app.py happy
    weather_query = f"{race_name} 2026 F1 weather forecast race day"
    weather_text = _ddg_search(weather_query, max_results=3).lower() if DDGS_AVAILABLE else ""
    
    wetness = 0.38
    if "rain" in weather_text or "wet" in weather_text:
        wetness = 0.60
        
    intel = {
        "race_name": race_name,
        "Upgrade_Score": 0.5, # handled via json now
        "Wetness_Factor": wetness,
        "upgrade_summary": "Check live_tech_updates.json for details.",
        "weather_summary": "Weather analyzed.",
        "sources": ["duckduckgo"]
    }
    _CACHE[race_name] = intel
    return intel


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from calendar_manager import get_next_race_full
    
    logging.basicConfig(level=logging.INFO)
    
    ri = get_next_race_full()
    print(f"Fetching Tech Updates for {ri.name}...")
    updates = build_live_tech_updates()
    print(json.dumps(updates, indent=4))
