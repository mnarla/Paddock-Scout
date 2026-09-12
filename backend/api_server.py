import os
import sys
import glob
import json
import logging
import threading
import time
import subprocess
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

import pickle

sys.path.insert(0, os.path.dirname(__file__))
from calendar_manager import get_next_race_full, get_past_races, SCHEDULE_2026, get_sprint_races
from utils import safe_encode, standings_rank, normalise_color, track_type, get_neutral_values
from archive_loader import load_race_results, load_qualifying, load_sprint, load_practice_results, podium_from_results
from features import compute_practice_pace, compute_qualifying_dominance, compute_weekend_momentum
from data_loader import load_event

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'models', 'f1_podium_predictor.pkl')

def load_assets(model_path: str = MODEL_PATH):
    with open(model_path, "rb") as fh:
        return pickle.load(fh)

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

    On memory-constrained production platforms (like Render with a 512MB RAM cap),
    heavy FastF1 telemetry downloading is disabled inside the web service process.
    Ingestion is handled safely by the GitHub Actions workflow (.github/workflows/auto_ingest.yml).
    """
    if os.environ.get("RENDER") or os.environ.get("DISABLE_IN_APP_INGEST"):
        log.info("[auto-ingest] Running in Render production — skipping in-app FastF1 ingestion (managed by GitHub Actions).")
        return

    def _worker():
        past = get_past_races()
        for race in past:
            expected_csv = os.path.join(DATA_DIR, f"results_2026_round{race.round_num:02d}.csv")
            if not os.path.exists(expected_csv):
                log.info(f"[auto-ingest] Missing data for {race.name} (Rd {race.round_num}) — downloading sequentially")
                _ingest_race(race.name, race.round_num)
            else:
                log.debug(f"[auto-ingest] Rd {race.round_num:02d} {race.name}: data present, skipping")

    threading.Thread(target=_worker, daemon=True, name="auto-ingest-worker").start()


from news_agent import build_live_tech_updates

# Trigger auto-ingest once the Flask app context is available
with app.app_context():
    auto_ingest_missing_data()

    # Automatically refresh live technical news in the background if older than 24h or missing
    def _refresh_news():
        try:
            update_path = "live_tech_updates.json"
            needs_update = not os.path.exists(update_path) or (time.time() - os.path.getmtime(update_path) > 86400)
            if needs_update:
                log.info("[news-agent] Automatically scraping fresh F1 technical updates...")
                build_live_tech_updates()
                log.info("[news-agent] ✅ Technical updates refreshed.")
        except Exception as exc:
            log.warning(f"[news-agent] Failed to refresh tech updates: {exc}")

    threading.Thread(target=_refresh_news, daemon=True).start()
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
    "hulkenberg": {"number": 27, "abbr": "HUL", "first": "Nico", "last": "Hülkenberg"},
    "bortoleto": {"number": 5, "abbr": "BOR", "first": "Gabriel", "last": "Bortoleto"},
    "perez": {"number": 11, "abbr": "PER", "first": "Sergio", "last": "Perez"},
    "bottas": {"number": 77, "abbr": "BOT", "first": "Valtteri", "last": "Bottas"},
    "arvid_lindblad": {"number": 41, "abbr": "LIN", "first": "Arvid", "last": "Lindblad"}
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

# ── Context cache ─────────────────────────────────────────────────────────────
# build_2026_context() reads 14+ CSV files from disk and runs several pandas
# aggregations. On Render's throttled CPU this takes 100–400 ms per call.
# We cache the result in memory and invalidate only when a file on disk
# changes (checked via max mtime — O(n) stat() calls, not reads).
#
# Thread safety: GIL protects the dict assignment; the worst case is two
# threads rebuilding simultaneously on a cold start (harmless, both produce
# the same result and one will be discarded).
_CTX_CACHE: dict = {"df": None, "mtime": 0.0, "q_mtime": 0.0}

def _csv_max_mtime(files: list) -> float:
    """Return the maximum modification time across a list of file paths."""
    return max((os.path.getmtime(f) for f in files), default=0.0)

def build_2026_context(force: bool = False):
    """
    Build (or return cached) driver context DataFrame for the 2026 season.

    The cache is invalidated automatically whenever any results CSV or the
    current race's qualifying CSV changes on disk. Pass force=True to bypass
    the cache (e.g. immediately after ingesting new data).
    """
    all_files = sorted(glob.glob(os.path.join(DATA_DIR, "results_2026_round*.csv")))
    if not all_files:
        return pd.DataFrame()

    ri = get_next_race_full()
    q_file = os.path.join(DATA_DIR, f"results_{ri.date.year}_round{ri.round_num:02d}q.csv")

    current_mtime = _csv_max_mtime(all_files)
    current_q_mtime = os.path.getmtime(q_file) if os.path.exists(q_file) else 0.0

    if (
        not force
        and _CTX_CACHE["df"] is not None
        and _CTX_CACHE["mtime"] == current_mtime
        and _CTX_CACHE["q_mtime"] == current_q_mtime
    ):
        log.debug("[ctx-cache] HIT — returning cached context")
        return _CTX_CACHE["df"].copy()

    log.info("[ctx-cache] MISS — rebuilding 2026 context from disk")
    frames = []
    for f in all_files:
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

    # Only populate QualifyingPos if Qualifying has actually taken place
    # FOR THE CURRENT/UPCOMING RACE. If between races (not race weekend),
    # default QualifyingPos to NaN so driver defaults to their Championship Standings rank.
    if os.path.exists(q_file):
        qdf = pd.read_csv(q_file)
        qdf["Position"] = pd.to_numeric(qdf["Position"], errors="coerce")
        ss["QualifyingPos"] = ss["DriverId"].map(qdf.set_index("DriverId")["Position"].dropna().astype(int))
    else:
        ss["QualifyingPos"] = np.nan

    # Store in cache
    _CTX_CACHE["df"] = ss
    _CTX_CACHE["mtime"] = current_mtime
    _CTX_CACHE["q_mtime"] = current_q_mtime
    log.info(f"[ctx-cache] Rebuilt. {len(ss)} drivers, mtime={current_mtime:.0f}")
    return ss.copy()


# ── Session data cache (practice / qualifying / sprint) ───────────────────────
# compute_practice_pace and compute_qualifying_dominance each read multiple CSV
# files from disk on every call. We cache them keyed by (year, round_num) and
# invalidate only when the relevant session files change.
_SESSION_CACHE: dict = {}

def _get_session_data(year: int, round_num: int):
    """
    Return (pp, qd, sf, momentum_series) for the given race, served from cache
    when the underlying session CSV files haven't changed since the last build.
    """
    from features import compute_weekend_momentum

    # Collect the session file paths for this round
    def _mtime_or_zero(path):
        return os.path.getmtime(path) if os.path.exists(path) else 0.0

    fp_files = sorted(glob.glob(os.path.join(DATA_DIR, f"results_{year}_round{round_num:02d}fp*.csv")))
    qd_file  = os.path.join(DATA_DIR, f"results_{year}_round{round_num:02d}q.csv")
    sp_file  = os.path.join(DATA_DIR, f"results_{year}_round{round_num:02d}s.csv")

    current_mtime = max(
        [_mtime_or_zero(f) for f in fp_files] +
        [_mtime_or_zero(qd_file), _mtime_or_zero(sp_file)]
    )

    cache_key = (year, round_num)
    cached = _SESSION_CACHE.get(cache_key)
    if cached is not None and cached["mtime"] == current_mtime:
        log.debug(f"[session-cache] HIT — round {round_num}")
        return cached["pp"], cached["qd"], cached["sf"], cached["momentum"]

    log.info(f"[session-cache] MISS — rebuilding session data for round {round_num}")
    ri_info = get_next_race_full()  # for is_sprint flag; same round context
    pp = compute_practice_pace(DATA_DIR, year, round_num)
    qd = compute_qualifying_dominance(DATA_DIR, year, round_num)

    if os.path.exists(sp_file):
        sdf = pd.read_csv(sp_file)
        sdf["Position"] = pd.to_numeric(sdf["Position"], errors="coerce")
        sf = sdf.set_index("DriverId")["Position"].dropna()
    else:
        sf = pd.Series(dtype=float)

    momentum = compute_weekend_momentum(pp, qd, sf, ri_info.is_sprint)

    _SESSION_CACHE[cache_key] = {
        "pp": pp, "qd": qd, "sf": sf, "momentum": momentum,
        "mtime": current_mtime,
    }
    return pp, qd, sf, momentum


assets = load_assets()
clf = assets["model"]
circuit_enc = assets["circuit_enc"]
grid_scaler = assets.get("grid_scaler")
FEATURES = assets["features"]


@app.route("/api/health", methods=["GET"])
def health_check():
    """Fast health-check endpoint for uptime monitors to prevent Render cold starts."""
    return jsonify({"status": "ok", "service": "paddock-scout-backend"})

# Mapping from the pickle's raw feature names to the frontend's contribution keys.
# Must stay in sync with features.py FEATURES list and prediction.ts FEATURE_LABELS.
_PICKLE_TO_FRONTEND = {
    "GridPosition":          "Grid",
    "Standings_Pos":         "Standings",
    "Car_Rank":              "CarRank",
    "Circuit_Encoded":       "Track",
    "Recent_Form_3R":        "RecentForm",
    "Practice_Pace":         "Practice",
    "Qualifying_Dominance":  "Qualifying",
    "Weekend_Momentum":      "Momentum",
    "Upgrade_Impact":        "Upgrades",
    "Overtake_Index":        "Overtake",
}

# Keys that are only meaningful when live session CSVs exist for the race weekend.
_LIVE_SESSION_FEATURES = {"Practice", "Qualifying", "Momentum"}

@app.route("/api/feature-weights", methods=["GET"])
def feature_weights():
    """
    Returns the trained RF model's real feature_importances_, normalized to sum exactly
    to 1.0 and mapped to the frontend's contribution key names.

    Includes which keys require live session data so the frontend can exclude them
    before a race weekend and re-normalize the remaining weights to 100%.

    Assertion guard: if sklearn ever returns importances that don't sum to ~1.0
    (e.g. after a bad retrain), this endpoint returns 500 instead of silently
    serving wrong data.
    """
    raw = clf.feature_importances_
    raw_sum = float(raw.sum())

    if abs(raw_sum - 1.0) > 1e-4:
        log.error(f"[feature-weights] RF importances sum to {raw_sum:.6f} — expected 1.0")
        return jsonify({"error": f"Model importances sum to {raw_sum:.6f}, not 1.0"}), 500

    weights = {}
    for feat_name, importance in zip(FEATURES, raw):
        key = _PICKLE_TO_FRONTEND.get(feat_name)
        if key:
            weights[key] = float(importance / raw_sum)   # normalize (raw_sum ≈ 1.0 already)

    weight_sum = sum(weights.values())
    if abs(weight_sum - 1.0) > 1e-4:
        log.error(f"[feature-weights] Mapped weights sum to {weight_sum:.6f}")
        return jsonify({"error": f"Mapped weights sum to {weight_sum:.6f}"}), 500

    # Check which live-session features actually have data for the upcoming race
    ri = get_next_race_full()
    pp, qd, sf, momentum_series = _get_session_data(ri.date.year, ri.round_num)
    has_practice   = not pp.empty
    has_qualifying = not qd.empty
    has_sprint     = not sf.empty and ri.is_sprint
    has_momentum   = has_practice or has_qualifying or has_sprint

    unavailable = []
    if not has_practice:
        unavailable.append("Practice")
    if not has_qualifying:
        unavailable.append("Qualifying")
    if not has_momentum:
        unavailable.append("Momentum")

    return jsonify({
        "weights": weights,
        "liveSessionFeatures": list(_LIVE_SESSION_FEATURES),
        "unavailableFeatures": unavailable,
        "modelVersion": "v6",
        "sum": round(weight_sum, 6),
    })

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
            
        standings_rank = idx + 1
        qual_pos = row["QualifyingPos"]
        if pd.isna(qual_pos):
            # Not a race weekend / no Quali yet — default starting grid to championship standings rank
            qual_pos = float(standings_rank)
            
        drivers.append({
            "id": did,
            "number": info["number"],
            "abbr": info["abbr"],
            "first": info["first"],
            "last": info["last"],
            "team": TEAM_NAME_TO_ID.get(row["TeamName"], "audi"),
            "standingsRank": standings_rank,
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
    
    if not driver_id:
        return jsonify({"error": "driverId is required"}), 400

    ctx = build_2026_context()
    driver_rows = ctx[ctx["DriverId"] == driver_id]
    if driver_rows.empty:
        return jsonify({"error": f"Driver {driver_id} not found in context"}), 404
    row = driver_rows.iloc[0]
    team_name = row["TeamName"]
    
    c_enc = safe_encode(circuit_enc, selected_gp)
    car_rank = float(row.get("Car_Rank", 5))
    
    # Dynamic upgrade impact from News Agent (can be positive or negative)
    upgrade = 0.0
    try:
        if os.path.exists("live_tech_updates.json"):
            with open("live_tech_updates.json", "r") as f:
                tech_data = json.load(f)
                if team_name in tech_data:
                    t_info = tech_data[team_name]
                    # Score is positive for working upgrades, negative for failed upgrades
                    upgrade = float(t_info.get("Upgrade_Score", 0.0))
    except Exception:
        upgrade = 0.5 if team_name in UPGRADE_TEAMS else 0.0

    overtake_idx = float(np.clip(grid_pos - car_rank, -10, 15))
    s_rank = standings_rank(ctx, row["FullName"])

    ri = get_next_race_full()
    # Session data (practice pace, qualifying dominance, sprint, momentum) is
    # cached by round + file mtime — avoids re-reading CSVs on every request.
    pp, qd, sf, momentum_series = _get_session_data(ri.date.year, ri.round_num)

    pp_val = float(pp.get(driver_id, 11.0))
    qd_val = float(qd.get(driver_id, 0.02))
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
    raw_prob = float(clf.predict_proba(X)[0][1])
    
    # Smooth momentum influence (if fresh session data exists)
    if not momentum_series.empty:
        raw_prob = min(1.0, max(0.0, raw_prob + (11.0 - wm_val) / 11.0 * 0.10))
        
    # Apply form penalty / bonus smoothly:
    # manual_form: 1.0 is winning form, 11.0 is mid, 20.0 is backmarker
    # Slumping drivers (form > 10) are penalized; on-fire drivers (form < 5) get a boost
    form_factor = (11.0 - manual_form) / 10.0  # +1.0 for form 1, 0.0 for form 11, -0.9 for form 20
    raw_prob = np.clip(raw_prob * (1.0 + 0.35 * form_factor), 0.01, 0.95)

    # Grid steepness factor: starting deep naturally curtails podium chance
    if grid_pos > 10:
        penalty_grid = (grid_pos - 10) * 0.05
        raw_prob = max(0.005, raw_prob * (1.0 - min(0.85, penalty_grid)))

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
        "RecentForm": 0.0,
        "Practice": 0.0,
        "Qualifying": 0.0,
        "Momentum": 0.0,
        "Upgrades": 0.0,
        "Overtake": 0.0
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
        elif k == "Recent_Form_3R":
            mapped_contribs["RecentForm"] += d
        elif k == "Practice_Pace":
            mapped_contribs["Practice"] += d
        elif k == "Qualifying_Dominance":
            mapped_contribs["Qualifying"] += d
        elif k == "Weekend_Momentum":
            mapped_contribs["Momentum"] += d
        elif k == "Upgrade_Impact":
            mapped_contribs["Upgrades"] += d
        elif k == "Overtake_Index":
            mapped_contribs["Overtake"] += d

    # Zero out features that relied on missing session data.
    # pp, qd, sf are Series — empty means no real data was loaded for this race.
    has_practice    = not pp.empty
    has_qualifying  = not qd.empty
    has_sprint      = not sf.empty and ri.is_sprint
    has_momentum    = has_practice or has_qualifying or has_sprint

    if not has_practice:
        mapped_contribs["Practice"] = 0.0
    if not has_qualifying:
        mapped_contribs["Qualifying"] = 0.0
    if not has_sprint:
        pass  # Sprint key doesn't exist in mapped_contribs; handled by frontend isSprint check
    if not has_momentum:
        mapped_contribs["Momentum"] = 0.0

    # Normalize contributions so they sum to exactly 1.0 (= 100%).
    # Previously this was scaled to 0.70 under the assumption that 30% of race
    # outcomes are "random". That is now represented by the UI caption in
    # FeatureContribution.tsx rather than corrupting the numbers shown to users.
    total_delta = sum(mapped_contribs.values())
    if total_delta > 0:
        scale = 1.0 / total_delta
        for k in mapped_contribs:
            mapped_contribs[k] *= scale
    else:
        # All-fallback when model produces zero deltas for everything.
        # Use the real RF feature_importances_ values (not hand-picked guesses).
        # Practice/Qualifying/Momentum default to 0 since no session data is
        # available in this fallback path; the frontend filters them out.
        mapped_contribs = {
            "Grid":       0.2548,
            "Momentum":   0.2648,
            "Qualifying": 0.1134,
            "Overtake":   0.1009,
            "RecentForm": 0.0952,
            "CarRank":    0.0905,
            "Standings":  0.0569,
            "Track":      0.0126,
            "Upgrades":   0.0109,
            "Practice":   0.0,
        }
        # Renormalize to 1.0 (Practice is 0 so excludes itself)
        fb_total = sum(mapped_contribs.values())
        if fb_total > 0:
            for k in mapped_contribs:
                mapped_contribs[k] = mapped_contribs[k] / fb_total

    frontend_contribs = []
    for k, w in mapped_contribs.items():
        if w > 0:  # Only send keys with actual contribution
            frontend_contribs.append({
                "key": k,
                "weight": float(w),
                "value": 1.0
            })

    # Cumulative podium probabilities:
    # p3 = Podium (Finish <= 3) — direct model output
    p3 = float(raw_prob)
    
    # F1 realistic conversion from Podium to Top 2 and Win:
    # Win probability drops off sharply outside pole/front rows and non-contenders
    if grid_pos == 1:
        win_ratio = 0.58
        top2_ratio = 0.82
    elif grid_pos == 2:
        win_ratio = 0.32
        top2_ratio = 0.65
    elif grid_pos == 3:
        win_ratio = 0.16
        top2_ratio = 0.45
    elif grid_pos <= 6:
        win_ratio = 0.06
        top2_ratio = 0.22
    elif grid_pos <= 10:
        win_ratio = 0.015
        top2_ratio = 0.08
    else:
        win_ratio = 0.005
        top2_ratio = 0.02

    standing_factor = max(0.2, (12.0 - min(11.0, float(s_rank))) / 11.0)
    p1 = min(0.95, max(0.005, p3 * win_ratio * standing_factor))
    p2 = min(p3, max(p1 * 1.15, p3 * top2_ratio * standing_factor))
    
    return jsonify({
        "p1": p1,
        "p2": p2,
        "p3": p3,
        "podium": p3,
        "contributions": frontend_contribs
    })


@app.route("/api/archive/<int:round_num>", methods=["GET"])
def get_archive(round_num):
    yr = 2026
    race_df = load_race_results(yr, round_num)
    quali_df = load_qualifying(yr, round_num)
    sprint_df = load_sprint(yr, round_num)
    fp_results = load_practice_results(yr, round_num)
    
    podium = []
    if not race_df.empty:
        podium = podium_from_results(race_df)
        
    return jsonify({
        "race_results": race_df.replace({np.nan: None}).to_dict(orient="records") if not race_df.empty else [],
        "podium": podium,
        "qualifying": quali_df.replace({np.nan: None}).to_dict(orient="records") if not quali_df.empty else [],
        "sprint": sprint_df.replace({np.nan: None}).to_dict(orient="records") if not sprint_df.empty else [],
        "fp1": fp_results.get("fp1", pd.DataFrame()).replace({np.nan: None}).to_dict(orient="records") if not fp_results.get("fp1", pd.DataFrame()).empty else [],
        "fp2": fp_results.get("fp2", pd.DataFrame()).replace({np.nan: None}).to_dict(orient="records") if not fp_results.get("fp2", pd.DataFrame()).empty else [],
        "fp3": fp_results.get("fp3", pd.DataFrame()).replace({np.nan: None}).to_dict(orient="records") if not fp_results.get("fp3", pd.DataFrame()).empty else [],
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
        
    # Determine the latest round with practice validation data
    fp2_files = sorted(glob.glob(os.path.join(DATA_DIR, "results_2026_round*fp2.csv")))
    latest_validation_race = "Previous Race"
    if fp2_files:
        latest_file = os.path.basename(fp2_files[-1])
        parts = latest_file.replace(".csv", "").split("_")
        rnd_raw = parts[2].replace("round", "").replace("fp2", "")
        try:
            rnd_num = int(rnd_raw)
            for r_name, r_data in SCHEDULE_2026.items():
                if r_data.get("round") == rnd_num:
                    latest_validation_race = r_name.replace(" Grand Prix", " GP")
                    break
        except Exception:
            pass

    upgrades = []
    categories = ["Aero", "Power Unit", "Suspension", "Cooling"]
    for team, info in live_tech.items():
        team_id = TEAM_NAME_TO_ID.get(team)
        if not team_id:
            continue
        upg_score = float(info.get("Upgrade_Score", 0.0))
        pwr_boost = float(info.get("Power_Boost", 0.0))
        component = info.get("Component", "Technical Upgrade")
        is_defective = info.get("Is_Defective", False)
        
        # Determine pace delta (negative = faster, positive = slower)
        if "Pace_Delta" in info:
            pace_delta = float(info["Pace_Delta"])
        elif is_defective or upg_score < 0:
            pace_delta = +0.18
        else:
            pace_delta = -float(upg_score * 0.22 + pwr_boost * 0.25)
            
        category = "Power Unit" if pwr_boost > 0 and upg_score == 0 else "Aero"
        as_of = info.get("As_Of", latest_validation_race)
        
        upgrades.append({
            "team": team_id,
            "component": component,
            "category": category,
            "validated": info.get("Upgrade_Validation", not is_defective),
            "paceDelta": round(pace_delta, 2),
            "source": info.get("Sources", ["News Agent"])[0] if info.get("Sources") else "News Agent",
            "asOf": as_of,
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

def run_data_loader_loop():
    time.sleep(5)  # Wait for server to boot fully
    while True:
        # ── Step 1: Pull latest FastF1 session data ──────────────────────────
        try:
            log.info(" Automated background FastF1 sync starting...")
            loader_path = os.path.join(os.path.dirname(__file__), "data_loader.py")
            subprocess.run([sys.executable, loader_path, "--current"], check=True)
            log.info(" Automated background FastF1 sync completed.")
        except Exception as e:
            log.error(f"Error in automated background data loader: {e}")

        # ── Step 2: Scrape latest upgrade news ───────────────────────────────
        try:
            log.info(" Automated background news agent starting...")
            news_path = os.path.join(os.path.dirname(__file__), "news_agent.py")
            subprocess.run([sys.executable, news_path], check=True)
            log.info(" Automated background news agent completed.")
        except Exception as e:
            log.error(f"Error in automated background news agent: {e}")

        time.sleep(10800)  # Repeat every 3 hours

if __name__ == "__main__":
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        threading.Thread(target=run_data_loader_loop, daemon=True).start()
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
