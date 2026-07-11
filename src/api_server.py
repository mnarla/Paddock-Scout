import os
import sys
import glob
import json
import logging
import threading
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(__file__))
from calendar_manager import get_next_race_full, get_past_races, SCHEDULE_2026, get_sprint_races
from simulator import run_simulation, load_assets, build_driver_field, _encode_driver
from utils import safe_encode, standings_rank, normalise_color, track_type, get_neutral_values
from archive_loader import load_race_results, load_qualifying, load_sprint, load_practice_pace, podium_from_results
from features import compute_practice_pace, compute_qualifying_dominance, compute_weekend_momentum
from data_loader import load_event

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

DATA_DIR = "data"


# ── Auto-ingest: download missing CSVs for completed races ─────────────────────
def _ingest_race(race_name: str, round_num: int) -> None:
    """Background thread target: download all sessions for a completed race."""
    try:
        log.info(f"[auto-ingest] Starting download for Round {round_num}: {race_name}")
        load_event(2026, race_name, rnd=round_num, force=False)
        log.info(f"[auto-ingest] ✅ Finished Round {round_num}: {race_name}")
    except Exception as exc:
        log.warning(f"[auto-ingest] ⚠️  Round {round_num} failed: {exc}")


def auto_ingest_missing_data() -> None:
    """
    Scan all completed 2026 races and, for any whose main race CSV is absent,
    spawn a background daemon thread to download it via FastF1.

    This is called once at Flask startup so the server never blocks on ingestion.
    """
    past = get_past_races()
    for race in past:
        expected_csv = os.path.join(DATA_DIR, f"results_2026_round{race.round_num:02d}.csv")
        if not os.path.exists(expected_csv):
            log.info(f"[auto-ingest] Missing data for {race.name} (Rd {race.round_num}) — queuing download")
            t = threading.Thread(
                target=_ingest_race,
                args=(race.name, race.round_num),
                daemon=True,
            )
            t.start()
        else:
            log.debug(f"[auto-ingest] Rd {race.round_num:02d} {race.name}: data present, skipping")


# Trigger auto-ingest once the Flask app context is available
with app.app_context():
    auto_ingest_missing_data()
UPGRADE_TEAMS = {"McLaren", "Ferrari"}

TEAM_NAME_TO_ID = {
    "Mercedes": "mercedes",
    "Ferrari": "ferrari",
    "Red Bull Racing": "red_bull",
    "McLaren": "mclaren",
    "Alpine": "alpine",
    "Racing Bulls": "rb",
    "Williams": "williams",
    "Haas F1 Team": "haas",
    "Aston Martin": "aston_martin",
    "Audi": "audi",
    "Kick Sauber": "audi",
    "Sauber": "audi",
    "Cadillac": "cadillac"
}

DRIVER_INFO = {
    "hamilton": {"number": 44, "abbr": "HAM", "first": "Lewis", "last": "Hamilton"},
    "antonelli": {"number": 12, "abbr": "ANT", "first": "Kimi", "last": "Antonelli"},
    "max_verstappen": {"number": 1, "abbr": "VER", "first": "Max", "last": "Verstappen"},
    "leclerc": {"number": 16, "abbr": "LEC", "first": "Charles", "last": "Leclerc"},
    "russell": {"number": 63, "abbr": "RUS", "first": "George", "last": "Russell"},
    "norris": {"number": 4, "abbr": "NOR", "first": "Lando", "last": "Norris"},
    "piastri": {"number": 81, "abbr": "PIA", "first": "Oscar", "last": "Piastri"},
    "hadjar": {"number": 6, "abbr": "HAD", "first": "Isack", "last": "Hadjar"},
    "sainz": {"number": 55, "abbr": "SAI", "first": "Carlos", "last": "Sainz"},
    "alonso": {"number": 14, "abbr": "ALO", "first": "Fernando", "last": "Alonso"},
    "albon": {"number": 23, "abbr": "ALB", "first": "Alex", "last": "Albon"},
    "gasly": {"number": 10, "abbr": "GAS", "first": "Pierre", "last": "Gasly"},
    "lawson": {"number": 30, "abbr": "LAW", "first": "Liam", "last": "Lawson"},
    "colapinto": {"number": 43, "abbr": "COL", "first": "Franco", "last": "Colapinto"},
    "bearman": {"number": 87, "abbr": "BEA", "first": "Oliver", "last": "Bearman"},
    "stroll": {"number": 18, "abbr": "STR", "first": "Lance", "last": "Stroll"},
    "ocon": {"number": 31, "abbr": "OCO", "first": "Esteban", "last": "Ocon"},
    "tsunoda": {"number": 22, "abbr": "TSU", "first": "Yuki", "last": "Tsunoda"},
    "hulkenberg": {"number": 27, "abbr": "HUL", "first": "Nico", "last": "Hülkenberg"},
    "bortoleto": {"number": 5, "abbr": "BOR", "first": "Gabriel", "last": "Bortoleto"},
    "perez": {"number": 11, "abbr": "PER", "first": "Sergio", "last": "Perez"},
    "bottas": {"number": 77, "abbr": "BOT", "first": "Valtteri", "last": "Bottas"}
}

RACE_METADATA = {
    "Australian Grand Prix": {"short": "AUS", "country": "Australia", "flag": "🇦🇺"},
    "Chinese Grand Prix": {"short": "CHN", "country": "China", "flag": "🇨🇳"},
    "Japanese Grand Prix": {"short": "JPN", "country": "Japan", "flag": "🇯🇵"},
    "Miami Grand Prix": {"short": "MIA", "country": "USA", "flag": "🇺🇸"},
    "Canadian Grand Prix": {"short": "CAN", "country": "Canada", "flag": "🇨🇦"},
    "Monaco Grand Prix": {"short": "MON", "country": "Monaco", "flag": "🇲🇨"},
    "Barcelona Grand Prix": {"short": "BAR", "country": "Spain", "flag": "🇪🇸"},
    "Spanish Grand Prix": {"short": "BAR", "country": "Spain", "flag": "🇪🇸"},
    "Austrian Grand Prix": {"short": "AUT", "country": "Austria", "flag": "🇦🇹"},
    "British Grand Prix": {"short": "GBR", "country": "UK", "flag": "🇬🇧"},
    "Hungarian Grand Prix": {"short": "HUN", "country": "Hungary", "flag": "🇭🇺"},
    "Belgian Grand Prix": {"short": "BEL", "country": "Belgium", "flag": "🇧🇪"},
    "Dutch Grand Prix": {"short": "NED", "country": "Netherlands", "flag": "🇳🇱"},
    "Italian Grand Prix": {"short": "ITA", "country": "Italy", "flag": "🇮🇹"},
    "Azerbaijan Grand Prix": {"short": "AZE", "country": "Azerbaijan", "flag": "🇦🇿"},
    "Singapore Grand Prix": {"short": "SIN", "country": "Singapore", "flag": "🇸🇬"},
    "United States Grand Prix": {"short": "USA", "country": "USA", "flag": "🇺🇸"},
    "Mexico City Grand Prix": {"short": "MEX", "country": "Mexico", "flag": "🇲🇽"},
    "São Paulo Grand Prix": {"short": "BRA", "country": "Brazil", "flag": "🇧🇷"},
    "Las Vegas Grand Prix": {"short": "VEG", "country": "USA", "flag": "🇺🇸"},
    "Qatar Grand Prix": {"short": "QAT", "country": "Qatar", "flag": "🇶🇦"},
    "Abu Dhabi Grand Prix": {"short": "ABU", "country": "UAE", "flag": "🇦🇪"}
}

def build_2026_context():
    files = sorted(glob.glob(os.path.join(DATA_DIR, "results_2026_round*.csv")))
    if not files:
        return pd.DataFrame()
    frames = []
    for f in files:
        basename = os.path.basename(f)
        if basename.endswith("q.csv") or "fp" in basename:
            continue
        df = pd.read_csv(f)
        parts = basename.replace(".csv", "").split("_")
        rnd_raw = parts[2].replace("round", "")
        if rnd_raw.endswith("s"):
            rnd_num = int(rnd_raw[:-1])
        else:
            rnd_num = int(rnd_raw)
        df["Round"] = rnd_num
        frames.append(df)
    if not frames:
        return pd.DataFrame()
    all_r = pd.concat(frames, ignore_index=True)
    all_r["Position"] = pd.to_numeric(all_r["Position"], errors="coerce")
    all_r["Points"] = pd.to_numeric(all_r["Points"], errors="coerce").fillna(0)
    
    ss = all_r.groupby("DriverId").agg(
        SeasonPoints=("Points", "sum"),
        AvgFinish=("Position", "mean"),
        FullName=("FullName", "first"),
        TeamName=("TeamName", "last"),
        TeamColor=("TeamColor", "last")
    ).reset_index()
    
    last3 = (all_r.sort_values(["DriverId", "Round"]).groupby("DriverId")["Position"]
             .apply(lambda s: s.tail(3).mean()).reset_index()
             .rename(columns={"Position": "Recent_Form_3R"}))
    ss = ss.merge(last3, on="DriverId", how="left")
    
    trank = all_r.groupby("TeamName")["Points"].sum().rank(ascending=False, method="min")
    ss["Car_Rank"] = ss["TeamName"].map(trank).fillna(trank.max())
    ss["TeamColor"] = ss["TeamColor"].apply(normalise_color)
    
    qfiles = sorted(glob.glob(os.path.join(DATA_DIR, "results_2026_round*q.csv")))
    if qfiles:
        qdf = pd.read_csv(qfiles[-1])
        qdf["Position"] = pd.to_numeric(qdf["Position"], errors="coerce")
        ss["QualifyingPos"] = ss["DriverId"].map(qdf.set_index("DriverId")["Position"].dropna().astype(int))
    else:
        ss["QualifyingPos"] = np.nan
    return ss

assets = load_assets()
clf = assets["model"]
circuit_enc = assets["circuit_enc"]
grid_scaler = assets.get("grid_scaler")
FEATURES = assets["features"]

@app.route("/api/next-race", methods=["GET"])
def get_next_race():
    ri = get_next_race_full()
    meta = RACE_METADATA.get(ri.name, {"short": "GP", "country": "Unknown", "flag": "🏁"})
    return jsonify({
        "round": ri.round_num,
        "name": ri.name,
        "short": meta["short"],
        "country": meta["country"],
        "flag": meta["flag"],
        "trackType": "Street" if ri.track_type == "Street" else "Permanent",
        "date": ri.date.strftime("%Y-%m-%d"),
        "isSprint": ri.is_sprint
    })

@app.route("/api/calendar", methods=["GET"])
def get_calendar():
    res = []
    sprint_races = get_sprint_races()
    for name, info in SCHEDULE_2026.items():
        meta = RACE_METADATA.get(name, {"short": "GP", "country": "Unknown", "flag": "🏁"})
        res.append({
            "round": info["round"],
            "name": name,
            "short": meta["short"],
            "country": meta["country"],
            "flag": meta["flag"],
            "trackType": "Street" if info["track_type"] == "Street" else "Permanent",
            "date": info["date"].strftime("%Y-%m-%d"),
            "isSprint": name in sprint_races
        })
    return jsonify(res)

@app.route("/api/drivers", methods=["GET"])
def get_drivers():
    ctx = build_2026_context()
    if ctx.empty:
        return jsonify([])
        
    drivers = []
    ctx_sorted = ctx.sort_values("SeasonPoints", ascending=False).reset_index(drop=True)
    
    # Timing and practice pacing for next weekend
    ri = get_next_race_full()
    pp = compute_practice_pace(DATA_DIR, ri.date.year, ri.round_num)
    qd = compute_qualifying_dominance(DATA_DIR, ri.date.year, ri.round_num)
    
    sp_path = os.path.join(DATA_DIR, f"results_{ri.date.year}_round{ri.round_num:02d}s.csv")
    if os.path.exists(sp_path):
        sdf = pd.read_csv(sp_path)
        sdf["Position"] = pd.to_numeric(sdf["Position"], errors="coerce")
        sf = sdf.set_index("DriverId")["Position"].dropna()
    else:
        sf = pd.Series(dtype=float)
        
    from features import compute_weekend_momentum
    momentum_series = compute_weekend_momentum(pp, qd, sf, ri.is_sprint)
    
    for idx, row in ctx_sorted.iterrows():
        did = row["DriverId"]
        if did not in DRIVER_INFO:
            continue
        info = DRIVER_INFO[did]
        
        # Recent form defaults to recent_form_3R or weekend momentum if available
        form_val = float(momentum_series.get(did, row["Recent_Form_3R"]))
        if pd.isna(form_val):
            form_val = float(row["Recent_Form_3R"])
            
        qual_pos = row["QualifyingPos"]
        if pd.isna(qual_pos):
            qual_pos = 10.0
            
        drivers.append({
            "id": did,
            "number": info["number"],
            "abbr": info["abbr"],
            "first": info["first"],
            "last": info["last"],
            "team": TEAM_NAME_TO_ID.get(row["TeamName"], "sauber"),
            "standingsRank": idx + 1,
            "seasonPoints": int(row["SeasonPoints"]),
            "recentForm": round(form_val, 2),
            "qualifyingPos": int(qual_pos)
        })
    return jsonify(drivers)

@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.json
    driver_id = data.get("driverId")
    grid_pos = int(data.get("gridPos", 10))
    manual_form = float(data.get("form", 11.0))
    selected_gp = data.get("grandPrix", get_next_race_full().name)
    
    ctx = build_2026_context()
    row = ctx[ctx["DriverId"] == driver_id].iloc[0]
    team_name = row["TeamName"]
    
    c_enc = safe_encode(circuit_enc, selected_gp)
    car_rank = float(row.get("Car_Rank", 5))
    upgrade = 0.5 if team_name in UPGRADE_TEAMS else 0.0
    overtake_idx = float(np.clip(grid_pos - car_rank, -10, 15))
    s_rank = standings_rank(ctx, row["FullName"])
    
    ri = get_next_race_full()
    pp = compute_practice_pace(DATA_DIR, ri.date.year, ri.round_num)
    qd = compute_qualifying_dominance(DATA_DIR, ri.date.year, ri.round_num)
    
    pp_val = float(pp.get(driver_id, 11.0))
    qd_val = float(qd.get(driver_id, 0.02))
    
    sp_path = os.path.join(DATA_DIR, f"results_{ri.date.year}_round{ri.round_num:02d}s.csv")
    if os.path.exists(sp_path):
        sdf = pd.read_csv(sp_path)
        sdf["Position"] = pd.to_numeric(sdf["Position"], errors="coerce")
        sf = sdf.set_index("DriverId")["Position"].dropna()
    else:
        sf = pd.Series(dtype=float)
        
    from features import compute_weekend_momentum
    momentum_series = compute_weekend_momentum(pp, qd, sf, ri.is_sprint)
    wm_val = float(momentum_series.get(driver_id, 11.0))

    feature_dict = {
        "Recent_Form_3R": manual_form,
        "GridPosition": float(grid_scaler.transform([[grid_pos]])[0][0]) if grid_scaler else float(grid_pos),
        "Car_Rank": car_rank,
        "Circuit_Encoded": c_enc,
        "Upgrade_Impact": upgrade,
        "Overtake_Index": overtake_idx,
        "Standings_Pos": s_rank,
        "Practice_Pace": pp_val,
        "Qualifying_Dominance": qd_val,
        "Weekend_Momentum": wm_val
    }
    
    X = np.array([[feature_dict.get(f, 0.0) for f in FEATURES]])
    raw_prob = clf.predict_proba(X)[0][1]
    
    if not momentum_series.empty:
        raw_prob = min(1.0, raw_prob + max(0.0, (11.0 - wm_val) / 11.0 * 0.15))
        
    # Champion's Aura: Non-linear decay floor. P1 gets 70% floor if in Top 10.
    if grid_pos <= 10:
        floor = 0.70 * (0.80 ** (s_rank - 1))
        raw_prob = max(raw_prob, floor)
        
    # Car_Rank Alpha
    if car_rank == 1 and grid_pos > 5:
        raw_prob = min(1.0, raw_prob + 0.15)
    elif car_rank <= 2 and grid_pos > 3:
        gap = min(grid_pos - 3, 7)
        raw_prob = min(1.0, raw_prob * (1.0 + 0.015 * gap))
        
    # Feature contributions
    contribs = []
    neutral = get_neutral_values()
    for i, name in enumerate(FEATURES):
        X_perturbed = X.copy()
        X_perturbed[0, i] = neutral.get(name, 0.0)
        perturbed_prob = clf.predict_proba(X_perturbed)[0][1]
        delta = raw_prob - perturbed_prob
        contribs.append({
            "key": name,
            "delta": float(delta),
            "direction": "positive" if delta > 0 else "negative"
        })
        
    contribs.sort(key=lambda x: abs(x["delta"]), reverse=True)
    
    # Feature contributions mapped to React keys
    mapped_contribs = {
        "Grid": 0.0,
        "Standings": 0.0,
        "CarRank": 0.0,
        "Track": 0.0,
        "Sprint": 0.0
    }
    
    for item in contribs:
        k = item["key"]
        d = abs(item["delta"])
        if k == "GridPosition":
            mapped_contribs["Grid"] += d
        elif k == "Standings_Pos":
            mapped_contribs["Standings"] += d
        elif k == "Car_Rank":
            mapped_contribs["CarRank"] += d
        elif k == "Circuit_Encoded":
            mapped_contribs["Track"] += d
        else:
            mapped_contribs["Sprint"] += d
            
    # Normalize to a total sum of ~0.70 to fit the importance display scale nicely
    total_delta = sum(mapped_contribs.values())
    if total_delta > 0:
        scale = 0.70 / total_delta
        for k in mapped_contribs:
            mapped_contribs[k] *= scale
    else:
        mapped_contribs = {
            "Grid": 0.254,
            "Standings": 0.181,
            "CarRank": 0.147,
            "Track": 0.082,
            "Sprint": 0.065
        }
        
    frontend_contribs = []
    for k, w in mapped_contribs.items():
        frontend_contribs.append({
            "key": k,
            "weight": float(w),
            "value": 1.0
        })

    # Approximate split into P1, P2, P3
    p3 = raw_prob
    p2 = raw_prob * 0.72
    p1 = raw_prob * 0.45
    
    return jsonify({
        "p1": p1,
        "p2": p2,
        "p3": p3,
        "podium": p3,
        "contributions": frontend_contribs
    })

@app.route("/api/simulate", methods=["POST"])
def simulate():
    data = request.json or {}
    grand_prix = data.get("grandPrix", get_next_race_full().name)
    wetness_factor = float(data.get("wetnessFactor", 0.3))
    upgrade_teams = data.get("upgradeTeams", ["Ferrari", "McLaren"])
    grid_overrides = data.get("gridOverrides", None)
    
    context = {
        "grand_prix": grand_prix,
        "track_type": track_type(grand_prix),
        "wetness_factor": wetness_factor,
        "upgrade_teams": upgrade_teams,
        "upgrade_score": 0.8
    }
    
    res = run_simulation(context, grid_overrides=grid_overrides)
    
    # Map the simulator result counts_df back to React format
    rows = []
    positions = {}
    
    # Get details for mapped drivers
    ctx = build_2026_context()
    driver_lookup = {}
    for idx, row in ctx.iterrows():
        did = row["DriverId"]
        if did in DRIVER_INFO:
            driver_lookup[row["FullName"]] = {
                "id": did,
                "driver": {
                    "id": did,
                    "number": DRIVER_INFO[did]["number"],
                    "abbr": DRIVER_INFO[did]["abbr"],
                    "first": DRIVER_INFO[did]["first"],
                    "last": DRIVER_INFO[did]["last"],
                    "team": TEAM_NAME_TO_ID.get(row["TeamName"], "sauber")
                }
            }
            
    # Iterate over full counts
    counts_df = res["full_counts"]
    for fullname, row in counts_df.iterrows():
        if fullname not in driver_lookup:
            continue
        dl = driver_lookup[fullname]
        did = dl["id"]
        
        # Calculate rates
        p1_rate = float(row.get("P1_count", 0)) / 1000.0
        p2_rate = float(row.get("P2_count", 0)) / 1000.0
        p3_rate = float(row.get("P3_count", 0)) / 1000.0
        podium_rate = p1_rate + p2_rate + p3_rate
        
        rows.append({
            "driver": dl["driver"],
            "p1": p1_rate,
            "p2": p2_rate,
            "p3": p3_rate,
            "podium": podium_rate
        })
        
        # Approximate 20 placements based on P1-P5 counts for charting
        placement_array = [0] * 20
        placement_array[0] = int(row.get("P1_count", 0))
        placement_array[1] = int(row.get("P2_count", 0))
        placement_array[2] = int(row.get("P3_count", 0))
        placement_array[3] = int(row.get("P4_count", 0))
        placement_array[4] = int(row.get("P5_count", 0))
        
        # Distribute remaining to make it sum to 1000
        sum_five = sum(placement_array[:5])
        rem = 1000 - sum_five
        if rem > 0:
            for p in range(5, 20):
                placement_array[p] = rem // 15
            placement_array[19] += rem % 15
            
        positions[did] = placement_array
        
    rows.sort(key=lambda x: x["podium"], reverse=True)
    
    return jsonify({
        "rows": rows,
        "positions": positions,
        "nSimulations": 1000
    })

@app.route("/api/archive/<int:round_num>", methods=["GET"])
def get_archive(round_num):
    yr = 2026
    race_df = load_race_results(yr, round_num)
    quali_df = load_qualifying(yr, round_num)
    sprint_df = load_sprint(yr, round_num)
    fp_df = load_practice_pace(yr, round_num)
    
    podium = []
    if not race_df.empty:
        podium = podium_from_results(race_df)
        
    return jsonify({
        "race_results": race_df.replace({np.nan: None}).to_dict(orient="records") if not race_df.empty else [],
        "podium": podium,
        "qualifying": quali_df.replace({np.nan: None}).to_dict(orient="records") if not quali_df.empty else [],
        "sprint": sprint_df.replace({np.nan: None}).to_dict(orient="records") if not sprint_df.empty else [],
        "practice": fp_df.replace({np.nan: None}).to_dict(orient="records") if not fp_df.empty else []
    })

@app.route("/api/upgrades", methods=["GET"])
def get_upgrades():
    live_tech = {}
    try:
        if os.path.exists("live_tech_updates.json"):
            with open("live_tech_updates.json", "r") as f:
                live_tech = json.load(f)
    except Exception:
        pass
        
    upgrades = []
    categories = ["Aero", "Power Unit", "Suspension", "Cooling"]
    for team, info in live_tech.items():
        team_id = TEAM_NAME_TO_ID.get(team)
        if not team_id:
            continue
        upg_score = info.get("Upgrade_Score", 0.0)
        pwr_boost = info.get("Power_Boost", 0.0)
        
        if upg_score > 0:
            upgrades.append({
                "team": team_id,
                "component": f"Floor & Wing Upgrade Package (Score: {upg_score})",
                "category": "Aero",
                "validated": info.get("Upgrade_Validation", True),
                "paceDelta": -float(upg_score) * 0.25,
                "source": "News Agent scraper"
            })
        if pwr_boost > 0:
            upgrades.append({
                "team": team_id,
                "component": f"Software & MGU-K Calibration Update (Boost: {pwr_boost})",
                "category": "Power Unit",
                "validated": info.get("Upgrade_Validation", True),
                "paceDelta": -float(pwr_boost) * 0.30,
                "source": "News Agent scraper"
            })
            
    return jsonify(upgrades)

@app.route("/api/archive-progression", methods=["GET"])
def get_archive_progression():
    # Find all completed rounds by searching for results_2026_round*.csv
    race_files = sorted(glob.glob(os.path.join(DATA_DIR, "results_2026_round[0-9][0-9].csv")))
    
    rounds = []
    completed_rounds = []
    for f in race_files:
        basename = os.path.basename(f)
        parts = basename.replace(".csv", "").split("_")
        rnd_num = int(parts[2].replace("round", ""))
        completed_rounds.append(rnd_num)
    
    completed_rounds = sorted(list(set(completed_rounds)))
    
    driver_points = {}
    driver_abbr = {}
    driver_last = {}
    driver_team = {}
    podiums = []
    current_totals = {}
    
    for r in completed_rounds:
        race_path = os.path.join(DATA_DIR, f"results_2026_round{r:02d}.csv")
        if not os.path.exists(race_path):
            continue
            
        rdf = pd.read_csv(race_path)
        rdf["Points"] = pd.to_numeric(rdf["Points"], errors="coerce").fillna(0)
        rdf["Position"] = pd.to_numeric(rdf["Position"], errors="coerce").fillna(999)
        
        sprint_path = os.path.join(DATA_DIR, f"results_2026_round{r:02d}s.csv")
        sprint_points = {}
        if os.path.exists(sprint_path):
            sdf = pd.read_csv(sprint_path)
            sdf["Points"] = pd.to_numeric(sdf["Points"], errors="coerce").fillna(0)
            for _, srow in sdf.iterrows():
                sprint_points[srow["DriverId"]] = float(srow["Points"])
                
        # Update point totals for this round
        for _, row in rdf.iterrows():
            did = row["DriverId"]
            points_won = float(row["Points"]) + sprint_points.get(did, 0.0)
            
            driver_abbr[did] = row["Abbreviation"]
            driver_last[did] = row["LastName"]
            driver_team[did] = TEAM_NAME_TO_ID.get(row["TeamName"], "sauber")
            
            current_totals[did] = current_totals.get(did, 0.0) + points_won
            
        # For any driver not in this round but existing in previous rounds
        for did in current_totals:
            if did not in driver_points:
                driver_points[did] = []
            driver_points[did].append(current_totals[did])
            
        # Get podium Top 3
        p1 = rdf[rdf["Position"] == 1.0].iloc[0]["Abbreviation"] if not rdf[rdf["Position"] == 1.0].empty else "Unknown"
        p2 = rdf[rdf["Position"] == 2.0].iloc[0]["Abbreviation"] if not rdf[rdf["Position"] == 2.0].empty else "Unknown"
        p3 = rdf[rdf["Position"] == 3.0].iloc[0]["Abbreviation"] if not rdf[rdf["Position"] == 3.0].empty else "Unknown"
        
        s_name = "Unknown GP"
        for name, s_info in SCHEDULE_2026.items():
            if s_info["round"] == r:
                s_name = name
                break
                
        meta = RACE_METADATA.get(s_name, {"short": "GP", "country": "Unknown", "flag": "🏁"})
        rounds.append({
            "round": r,
            "short": meta["short"],
            "flag": meta["flag"],
            "name": s_name
        })
        
        podiums.append({
            "round": r,
            "p1": p1,
            "p2": p2,
            "p3": p3
        })
        
    sorted_drivers = sorted(current_totals.keys(), key=lambda d: current_totals[d], reverse=True)
    top_drivers = sorted_drivers[:8]
    
    archive_drivers = []
    for did in top_drivers:
        archive_drivers.append({
            "id": did,
            "abbr": driver_abbr[did],
            "last": driver_last[did],
            "team": driver_team[did],
            "cumulative": driver_points[did]
        })
        
    return jsonify({
        "rounds": rounds,
        "drivers": archive_drivers,
        "podiums": podiums
    })

if __name__ == "__main__":
    app.run(port=8000, debug=True)
