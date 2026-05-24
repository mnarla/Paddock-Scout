"""
src/simulator.py - Monte Carlo Race Simulator

Transitions from individual driver probability scoring to a full-field
Definitive Podium prediction using 1,000 stochastic race simulations.

Each simulation:
  1. Builds each driver's base feature vector (Recent_Form_3R, GridPosition, etc.)
  2. Injects Gaussian noise into Recent_Form_3R
  3. Applies upgrade multiplier for teams with confirmed major packages
  4. Applies weather chaos multiplier for wet races
  5. Scores all drivers through the RF model to get podium probability
  6. Ranks by probability and assigns P1/P2/P3 without clashes
  7. Accumulates finish-position tallies across all simulations
  8. Returns the drivers with the highest P1/P2/P3 counts as the podium

The race_context dict accepts: grand_prix (str), track_type (str),
wetness_factor (float 0-1), upgrade_teams (list), upgrade_score (float 0-1).
"""

import logging
import os
import pickle
import sys
from typing import Any, Dict, List, Optional, Tuple

import glob
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from features import UPGRADE_TEAMS
from utils import get_neutral_values, normalise_color

log = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
MODEL_PATH = "models/f1_podium_predictor.pkl"
DATA_DIR   = "data"

# ── Simulation constants ──────────────────────────────────────────────────────
N_SIMULATIONS         = 1_000
NOISE_SCALE           = 0.5    # base σ for Normal noise on Recent_Form_3R
TECHNICAL_CHAOS_BONUS = 0.4    # extra σ for Miami T11-16 lock-up section
UPGRADE_BOOST         = -0.3   # subtracted from Recent_Form avg (better finish)
WEATHER_NOISE         = 1.8    # extra noise σ multiplier in wet conditions
# 70/30 Sprint-vs-Season blend (per audit spec):
# Miami Sprint/Quali result = 70% of the form signal fed to the model.
# Races from Japan/China/Australia count for only 30%.
WEEKEND_WEIGHT        = 0.70


# ─────────────────────────────────────────────────────────────────────────────
# 1.  LOAD MODEL ARTEFACTS
# ─────────────────────────────────────────────────────────────────────────────
def load_assets(model_path: str = MODEL_PATH) -> Dict[str, Any]:
    with open(model_path, "rb") as fh:
        return pickle.load(fh)


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE CONTRIBUTION  ('How the AI Decided')
# ─────────────────────────────────────────────────────────────────────────────
def get_feature_contributions(
    feature_vector: np.ndarray,
    feature_names: list,
    model,
    baseline_prob: float,
) -> list:
    """
    Compute approximate contribution of each feature by toggling each
    dimension to its field-median value and measuring the probability drop.
    Returns a list of dicts sorted by magnitude, each with keys: feature (str),
    delta (float), and direction ('positive' or 'negative').
    """
    X_base = feature_vector.reshape(1, -1)
    neutral = get_neutral_values()   # shared midfield-neutral values from utils.py
    contributions = []
    for i, name in enumerate(feature_names):
        X_perturbed = X_base.copy()
        X_perturbed[0, i] = neutral.get(name, 0.0)
        perturbed_prob = model.predict_proba(X_perturbed)[0][1]
        delta = baseline_prob - perturbed_prob
        contributions.append({
            "feature":   name,
            "delta":     delta,
            "direction": "positive" if delta > 0 else "negative",
        })
    contributions.sort(key=lambda x: abs(x["delta"]), reverse=True)
    return contributions


# ─────────────────────────────────────────────────────────────────────────────
# 2.  BUILD 2026 DRIVER FIELD
# ─────────────────────────────────────────────────────────────────────────────
def build_driver_field(data_dir: str = DATA_DIR) -> pd.DataFrame:
    """
    Aggregate all 2026 result CSVs into a per-driver context table.

    Produces SeasonPoints, Recent_Form_3R, DefaultGrid, Weekend_Form
    (Sprint finish position, or Qualifying position as fallback), Blended_Form
    (70 pct Sprint plus 30 pct season average), and Momentum_Multiplier
    (1.2 for drivers who improved from Sprint grid to Sprint finish, else 1.0).

    All signals are data-driven. No driver or team names are hard-coded.
    """

    files = sorted(glob.glob(os.path.join(data_dir, "results_2026_round*.csv")))
    if not files:
        raise FileNotFoundError(f"No 2026 CSVs found in {data_dir!r}")

    race_frames   = []
    sprint_frames = []
    quali_frames  = []

    for f in files:
        basename = os.path.basename(f)
        df = pd.read_csv(f)
        df["Position"]    = pd.to_numeric(df["Position"],    errors="coerce")
        df["GridPosition"]= pd.to_numeric(df["GridPosition"],errors="coerce")
        df["Points"]      = pd.to_numeric(df["Points"],      errors="coerce").fillna(0)

        if "04s" in basename:
            sprint_frames.append(df)
        elif "04q" in basename:
            quali_frames.append(df)
        else:
            race_frames.append(df)

    if not race_frames:
        raise FileNotFoundError("No race-result CSVs found.")

    for i, df in enumerate(race_frames):
        df["Round"] = i + 1
    all_races = pd.concat(race_frames, ignore_index=True)

    # Season-level aggregates from race data
    season = all_races.groupby("DriverId").agg(
        FullName     = ("FullName",  "first"),
        TeamName     = ("TeamName",  "last"),
        TeamColor    = ("TeamColor", "last"),
        SeasonPoints = ("Points",    "sum"),
        AvgFinish    = ("Position",  "mean"),
    ).reset_index()

    # Recent form: last 3 race rounds per driver
    sorted_races = all_races.sort_values(["DriverId", "Round"])
    last3 = (
        sorted_races.groupby("DriverId")["Position"]
        .apply(lambda s: s.tail(3).mean())
        .reset_index()
        .rename(columns={"Position": "Recent_Form_3R"})
    )
    field = season.merge(last3, on="DriverId", how="left")

    # ── Sprint & Qualifying data ──────────────────────────────────────────────
    sprint_finish:  Dict[str, float] = {}   # DriverId → sprint finish pos
    sprint_grid:    Dict[str, float] = {}   # DriverId → sprint grid pos
    sprint_top3_ids: set             = set()

    if sprint_frames:
        sprint_df = pd.concat(sprint_frames, ignore_index=True)
        sprint_df["Position"]    = pd.to_numeric(sprint_df["Position"],    errors="coerce")
        sprint_df["GridPosition"]= pd.to_numeric(sprint_df["GridPosition"],errors="coerce")
        for _, r in sprint_df.iterrows():
            did = r["DriverId"]
            if pd.notna(r["Position"]):
                sprint_finish[did] = float(r["Position"])
                if r["Position"] <= 3:
                    sprint_top3_ids.add(did)
            if pd.notna(r["GridPosition"]):
                sprint_grid[did] = float(r["GridPosition"])

    quali_pos:      Dict[str, float] = {}   # DriverId → qualifying position
    quali_top2_ids: set              = set()

    if quali_frames:
        quali_df = pd.concat(quali_frames, ignore_index=True)
        quali_df["Position"] = pd.to_numeric(quali_df["Position"], errors="coerce")
        for _, r in quali_df.iterrows():
            did = r["DriverId"]
            if pd.notna(r["Position"]):
                quali_pos[did] = float(r["Position"])
                if r["Position"] <= 2:
                    quali_top2_ids.add(did)

    # ── Miami-First Rule: Weekend_Form ────────────────────────────────────
    # Priority: Sprint finish > Qualifying position > Recent_Form_3R
    def _weekend_form(row: pd.Series) -> float:
        did = row["DriverId"]
        if did in sprint_finish:
            return sprint_finish[did]       # Sprint result = most recent reality
        if did in quali_pos:
            return quali_pos[did]           # Fallback: qualifying position
        return row["Recent_Form_3R"]        # No sprint weekend data

    field["Weekend_Form"] = field.apply(_weekend_form, axis=1)

    # ── Momentum_Multiplier ────────────────────────────────────────────────
    # 1.2x if driver improved position from Sprint grid start to Sprint finish
    # (lower position number = better), else 1.0
    def _momentum_mult(driver_id: str) -> float:
        if driver_id in sprint_finish and driver_id in sprint_grid:
            if sprint_finish[driver_id] < sprint_grid[driver_id]:   # improved
                return 1.2
        return 1.0

    field["Momentum_Multiplier"] = field["DriverId"].apply(_momentum_mult)


    # Weekend_Form (Sprint/Quali) carries 70% weight; season form 30%.
    # Purely data-driven, no driver names hard-coded.
    field["Blended_Form"] = (
        WEEKEND_WEIGHT * field["Weekend_Form"]
        + (1.0 - WEEKEND_WEIGHT) * field["Recent_Form_3R"]
    ).clip(1.0, 20.0)

    # Standings_Pos: championship rank from season points (1 = leader)
    season_rank = field["SeasonPoints"].rank(ascending=False, method="min").clip(1, 20)
    field["Standings_Pos"] = season_rank

    # Default grid ordering
    field = field.sort_values("Blended_Form").reset_index(drop=True)
    field["DefaultGrid"] = field.index + 1

    field["TeamColor"] = field["TeamColor"].apply(normalise_color)
    return field


# ─────────────────────────────────────────────────────────────────────────────
# 3.  ENCODE A SINGLE DRIVER'S FEATURE VECTOR
# ─────────────────────────────────────────────────────────────────────────────
def _encode_driver(
    row: pd.Series,
    circuit_enc,
    circuit_name: str,
    grid_pos: int,
    car_rank: float,
    grid_scaler=None,
) -> Optional[np.ndarray]:
    """Return 7-element feature array matching FEATURES order, or None on failure."""
    try:
        c = circuit_enc.transform([circuit_name])[0]
    except ValueError:
        c = 0

    # Upgrade_Impact: capped at 0.5 (limits max swing to ~5%)
    upgrade = 0.5 if row["TeamName"] in UPGRADE_TEAMS else 0.0

    # Overtake_Index: how far behind car quality the driver starts
    # positive = fast car stuck in traffic (recovery potential)
    overtake_index = float(np.clip(grid_pos - car_rank, -10, 15))

    # Standings_Pos: 1 = championship leader (reliability/consistency signal)
    standings_pos = float(row.get("Standings_Pos", 10.0))

    if grid_scaler:
        grid_pos_val = float(grid_scaler.transform([[grid_pos]])[0][0])
    else:
        grid_pos_val = float(grid_pos)

    # Fetch weekend-specific live features
    practice_pace = float(row.get("Practice_Pace", 11.0))
    quali_dom = float(row.get("Qualifying_Dominance", 0.02))
    weekend_momentum = float(row.get("Weekend_Momentum", 11.0))

    # Feature order must match features.py FEATURES list exactly:
    # Recent_Form_3R, GridPosition, Car_Rank, Circuit_Encoded,
    # Upgrade_Impact, Overtake_Index, Standings_Pos,
    # Practice_Pace, Qualifying_Dominance, Weekend_Momentum
    return np.array([
        row["Recent_Form_3R"],   # col 0
        grid_pos_val,            # col 1
        car_rank,                # col 2
        c,                       # col 3
        upgrade,                 # col 4
        overtake_index,          # col 5
        standings_pos,           # col 6
        practice_pace,           # col 7
        quali_dom,               # col 8
        weekend_momentum         # col 9
    ], dtype=float)


# ─────────────────────────────────────────────────────────────────────────────
# 4.  MONTE CARLO SIMULATION
# ─────────────────────────────────────────────────────────────────────────────
def run_simulation(
    race_context: Dict[str, Any],
    grid_overrides: Optional[Dict[str, int]] = None,
    n_simulations: int = N_SIMULATIONS,
) -> Dict[str, Any]:
    """
    Run n_simulations stochastic races and return the most frequent podium.

    race_context accepts keys: grand_prix, track_type, wetness_factor,
    upgrade_teams, upgrade_score.
    grid_overrides is an optional dict mapping DriverId to grid_position.
    n_simulations defaults to 1000.

    Returns a dict with keys: podium (list of position dicts), full_counts
    (DataFrame of finish-position tallies), n_simulations (int), circuit (str),
    and wetness_factor (float).
    """
    # ── Load assets ──────────────────────────────────────────────────
    assets     = load_assets()
    model      = assets["model"]
    circuit_enc= assets["circuit_enc"]
    grid_scaler= assets.get("grid_scaler")

    # ── Build field ──────────────────────────────────────────────────
    field = build_driver_field()
    n_drivers = len(field)

    circuit_name    = race_context.get("grand_prix",      "Miami Grand Prix")
    wetness_factor  = float(race_context.get("wetness_factor", 0.3))
    upgrade_teams   = [t.lower() for t in race_context.get("upgrade_teams", [])]
    upgrade_score   = float(race_context.get("upgrade_score", 0.5))

    # Effective noise amplifier — wet races = more chaos
    wet_multiplier = 1.0 + wetness_factor * WEATHER_NOISE

    # ── Precompute per-driver base vectors, upgrade flags, and Car_Rank ───────
    # Car_Rank from 2026 cumulative team points (rank 1 = best)
    team_pts_rank = field.groupby("TeamName")["SeasonPoints"].sum().rank(
        ascending=False, method="min"
    )
    field["Car_Rank"] = field["TeamName"].map(team_pts_rank).fillna(team_pts_rank.max())

    base_vectors: List[np.ndarray] = []
    has_upgrade:  List[bool]       = []
    valid_drivers: List[int]       = []

    for idx, row in field.iterrows():
        grid = (grid_overrides or {}).get(row["DriverId"], int(row["DefaultGrid"]))

        # Use the 80/20 Blended_Form instead of raw Recent_Form_3R.
        # No driver names — purely data-driven blend of weekend vs season.
        row_for_enc = row.copy()
        row_for_enc["Recent_Form_3R"] = row["Blended_Form"]

        vec = _encode_driver(row_for_enc, circuit_enc, circuit_name, grid, row["Car_Rank"], grid_scaler)
        if vec is not None:
            base_vectors.append(vec)
            has_upgrade.append(row["TeamName"].lower() in upgrade_teams)
            valid_drivers.append(idx)

    n_valid = len(valid_drivers)
    if n_valid < 3:
        raise ValueError(f"Only {n_valid} encodable drivers — cannot simulate a podium.")

    # Position-frequency matrix: shape (n_valid, n_valid)
    # pos_counts[driver_i, pos_j] = # times driver i finished in position j+1
    pos_counts = np.zeros((n_valid, n_valid), dtype=int)

    # --- Load Team Tech Updates ------------------------------------------
    live_tech = {}
    try:
        import json
        if os.path.exists("live_tech_updates.json"):
            with open("live_tech_updates.json", "r") as f:
                live_tech = json.load(f)
    except Exception:
        pass

    # ── 1 000 simulations ─────────────────────────────────────────────────
    rng = np.random.default_rng(seed=None)  # non-reproducible for true stochasm

    X_batch = np.array(base_vectors, dtype=float)  # (n_valid × 6)

    for _ in range(n_simulations):
        X_sim = X_batch.copy()

        # --- Inject noise into Recent_Form_3R (col index 0) -----------------
        # Miami T11-16 technical section adds extra lock-up chaos
        effective_sigma = (NOISE_SCALE + TECHNICAL_CHAOS_BONUS) * wet_multiplier
        noise = rng.normal(0.0, effective_sigma, size=n_valid)
        X_sim[:, 0] += noise
        X_sim[:, 0] = np.clip(X_sim[:, 0], 1.0, 20.0)

        # --- Apply team upgrade boost ----------------------------------------
        for i, vi in enumerate(valid_drivers):
            team_name = field.loc[vi, "TeamName"]
            tech_info = live_tech.get(team_name, {})
            
            # Apply static context upgrades if applicable (backward compatibility)
            if has_upgrade[i]:
                boost = UPGRADE_BOOST * upgrade_score
                X_sim[i, 0] += boost
                X_sim[i, 0] = max(1.0, X_sim[i, 0])
                
            # Apply dynamic live tech upgrades if valid
            if tech_info and tech_info.get("Upgrade_Validation", False):
                upg_score = tech_info.get("Upgrade_Score", 0.0)
                pwr_boost = tech_info.get("Power_Boost", 0.0)
                
                # Combine scores
                total_boost = UPGRADE_BOOST * (upg_score + pwr_boost)
                X_sim[i, 0] += total_boost
                X_sim[i, 0] = max(1.0, X_sim[i, 0])

        # --- Score all drivers -----------------------------------------------
        probs = model.predict_proba(X_sim)[:, 1]              # podium probability

        # --- Momentum_Multiplier (data-driven: Sprint position improvers) ----
        # 1.2x for any driver who moved up in the Sprint.
        for i, vi in enumerate(valid_drivers):
            mult = field.loc[vi, "Momentum_Multiplier"]
            if mult != 1.0:
                probs[i] = min(1.0, probs[i] * mult)

        # --- Recovery_Boost & Champion's Aura --------------------------------
        for i, vi in enumerate(valid_drivers):
            car_r = field.loc[vi, "Car_Rank"]
            drv_id = field.loc[vi, "DriverId"]
            actual_grid = (grid_overrides or {}).get(drv_id, int(field.loc[vi, "DefaultGrid"]))
            s_rank = field.loc[vi, "Standings_Pos"]
            
            # Car_Rank Alpha: #1 ranked car gets +15% Recovery Probability when starting outside Top 5
            if car_r == 1 and actual_grid > 5:
                probs[i] = min(1.0, probs[i] + 0.15)
            elif car_r <= 2 and actual_grid > 3:
                gap = min(actual_grid - 3, 7)
                recovery_factor = 1.0 + (0.015 * gap)
                probs[i] = min(1.0, probs[i] * recovery_factor)
                
            # Champion's Aura: Non-linear decay. P1 gets 70% floor if in Top 10
            if s_rank == 1 and actual_grid <= 10:
                probs[i] = max(probs[i], 0.70)
            elif s_rank <= 3 and actual_grid <= 8:
                probs[i] = max(probs[i], 0.60)

        # --- Add tiny random tie-breaker to prevent dead heats ---------------
        probs += rng.uniform(0.0, 1e-6, size=n_valid)

        # --- Rank drivers by probability (highest = P1) ---------------------
        ranking = np.argsort(probs)[::-1]                     # descending

        # --- Record each driver's finish position ---------------------------
        for finish_pos, driver_i in enumerate(ranking):
            if finish_pos < n_valid:
                pos_counts[driver_i, finish_pos] += 1

    # ── Determine definitive podium ────────────────────────────────────────
    # P1: driver who most often finished 1st
    # P2: among remaining, most often finished 2nd
    # P3: among remaining, most often finished 3rd
    podium_indices: List[int] = []
    excluded = set()

    for target_pos in range(3):
        best_count = -1
        best_driver = -1
        for i in range(n_valid):
            if i in excluded:
                continue
            count = pos_counts[i, target_pos]
            if count > best_count:
                best_count  = count
                best_driver = i
        podium_indices.append(best_driver)
        excluded.add(best_driver)

    # ── Build podium dicts ─────────────────────────────────────────────────
    medals = ["🥇", "🥈", "🥉"]
    podium = []
    for finish, driver_i in enumerate(podium_indices):
        vi  = valid_drivers[driver_i]
        row = field.loc[vi]
        # position_freq: how often this driver occupied THIS specific slot (P1/P2/P3)
        position_count = pos_counts[driver_i, finish]
        position_pct   = position_count / n_simulations * 100
        # podium_freq: how often this driver appeared anywhere in the top 3
        podium_pct     = pos_counts[driver_i, :3].sum() / n_simulations * 100
        podium.append({
            "position":      finish + 1,
            "medal":         medals[finish],
            "driver":        row["FullName"],
            "team":          row["TeamName"],
            "color":         row["TeamColor"],
            "driver_id":     row["DriverId"],
            "position_freq": position_pct,          # e.g. 37.9 (float, no %)
            "podium_freq":   podium_pct,             # e.g. 100.0 (float, no %)
            # legacy string fields kept for CLI output
            "p1_freq":       f"{pos_counts[driver_i, 0] / n_simulations * 100:.1f}%",
        })

    # Summary counts DataFrame for detailed analysis
    driver_names = [field.loc[valid_drivers[i], "FullName"] for i in range(n_valid)]
    counts_df = pd.DataFrame(
        pos_counts[:, :5],
        index=driver_names,
        columns=["P1_count", "P2_count", "P3_count", "P4_count", "P5_count"],
    ).sort_values("P1_count", ascending=False)

    return {
        "podium":        podium,
        "full_counts":   counts_df,
        "n_simulations": n_simulations,
        "circuit":       circuit_name,
        "wetness_factor":wetness_factor,
    }


# ─────────────────────────────────────────────────────────────────────────────
# CLI DEMO
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-8s  %(message)s")

    context = {
        "grand_prix":      "Miami Grand Prix",
        "track_type":      "Street",
        "wetness_factor":  0.38,
        "upgrade_teams":   ["Ferrari", "McLaren"],
        "upgrade_score":   0.82,
    }

    print(f"\n🏁 Running {N_SIMULATIONS:,} simulations for {context['grand_prix']} …\n")
    result = run_simulation(context)

    print("=" * 50)
    print("      PREDICTED PODIUM")
    print("=" * 50)
    for p in result["podium"]:
        print(f"  {p['medal']}  P{p['position']}  {p['driver']:<22}  ({p['team']})")
        print(f"        P1 frequency: {p['p1_freq']}  |  Podium frequency: {p['podium_freq']}")
    print()
    print("Top-5 P1 appearance counts:")
    print(result["full_counts"].head(5)[["P1_count","P2_count","P3_count"]].to_string())
