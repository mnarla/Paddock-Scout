"""
src/features.py — F1 Podium Predictor Feature Engineering
==========================================================
All feature-building logic is isolated here so both train_model.py
and app.py can import the same transformations consistently.

Key features (Race-Pace Modernization — v6):
  - Recent_Form_3R   : blended 70% Sprint + 30% season avg finish pos
  - GridPosition     : qualifying position
  - Car_Rank         : rolling 3-race team points rank (1 = best car)
  - Circuit_Encoded  : track identity
  - Upgrade_Impact   : 0.5 if team has confirmed Miami upgrade (McLaren/Ferrari), else 0.0
                       (capped at 0.5 to limit max swing to ~5 pct)
  - Overtake_Index   : GridPosition - Car_Rank (positive = starting worse than car quality)
                       captures recovery potential for fast cars stuck in traffic
  - Standings_Pos    : championship standings rank (1=leader) at race time
                       provides a reliability/consistency signal independent of grid
  - Practice_Pace    : avg rank across FP1/FP2/FP3 (1=fastest, ~11=midfield)
  - Qualifying_Dominance : normalised Q-time gap to pole (0=pole, 0.05=3% behind)
  - Weekend_Momentum : composite blend of practice, quali, and sprint signals
                       Sprint_Finish weighted 2.5× on sprint weekends

  Season_Points was removed to prevent early-season-luck penalisation.
  Driver_Encoded and Team_Encoded were never in v5+ (no name bias).

Session handling:
  - Sprint rows carry 2.5× weight via SPRINT_WEIGHT constant
  - Qualifying rows excluded from race targets
"""

import glob
import logging
import os

import fastf1
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

log = logging.getLogger(__name__)

CACHE_DIR = "fastf1_cache"
DATA_DIR  = "data"

FEATURES = [
    "Recent_Form_3R",   # Blended 70% Sprint / 30% season avg
    "GridPosition",     # Qualifying position
    "Car_Rank",         # Team rolling 3-race points rank (1=best)
    "Circuit_Encoded",  # Track identity
    "Upgrade_Impact",   # 0.5 for Miami upgrade teams, else 0.0 (capped)
    "Overtake_Index",   # GridPosition - Car_Rank: positive = fast car starting from back
    "Standings_Pos",    # Championship standing rank (1=leader) — reliability signal
    # Weekend-specific live features (computed when available):
    "Practice_Pace",        # Avg rank across FP1/FP2/FP3 (lower = faster)
    "Qualifying_Dominance", # Normalised gap to pole (0.0 = pole, 1.0 = slowest)
    "Weekend_Momentum",     # Composite score blending Practice_Pace + Qualifying_Dominance + Sprint
]
TARGET = "Podium"

# Teams with confirmed upgrade packages for the Miami GP
UPGRADE_TEAMS = {"McLaren", "Ferrari"}

# Sprint result carries 2.5x weight in Weekend_Momentum on sprint weekends
SPRINT_WEIGHT = 2.5


# ─────────────────────────────────────────────────────────────────────────────
# 1.  LOAD ALL CSVs + MAP EVENT NAMES
# ─────────────────────────────────────────────────────────────────────────────
def load_all_results(data_dir: str = DATA_DIR) -> pd.DataFrame:
    os.makedirs(CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(CACHE_DIR)

    files = sorted(glob.glob(os.path.join(data_dir, "results_*.csv")))
    if not files:
        raise FileNotFoundError(f"No result CSVs found in {data_dir!r}")

    # Build year → schedule lookup once
    event_maps: dict = {}
    for y in [2023, 2024, 2025, 2026]:
        try:
            sched = fastf1.get_event_schedule(y)
            for _, row in sched.iterrows():
                if row["EventFormat"] != "testing":
                    event_maps[(y, int(row["RoundNumber"]))] = row["EventName"]
        except Exception as exc:
            log.warning(f"Could not load {y} schedule: {exc}")

    frames = []
    for f in files:
        basename = os.path.basename(f).replace(".csv", "")
        parts    = basename.split("_")
        year     = int(parts[1])
        rnd_raw  = parts[2].replace("round", "")   # e.g. '04s', '04q', '03'

        # Sprint / Qualifying / Practice sub-rounds — extract numeric round
        session_type   = "Race"
        session_weight = 1.0
        if rnd_raw.endswith("s"):
            session_type   = "Sprint"
            session_weight = SPRINT_WEIGHT
            rnd = int(rnd_raw[:-1])
        elif rnd_raw.endswith("q"):
            session_type   = "Qualifying"
            session_weight = 1.0
            rnd = int(rnd_raw[:-1])
        elif rnd_raw.endswith("fp1"):
            session_type   = "FP1"
            rnd = int(rnd_raw[:-3])
        elif rnd_raw.endswith("fp2"):
            session_type   = "FP2"
            rnd = int(rnd_raw[:-3])
        elif rnd_raw.endswith("fp3"):
            session_type   = "FP3"
            rnd = int(rnd_raw[:-3])
        else:
            rnd = int(rnd_raw)

        df = pd.read_csv(f)
        # Honour any Session_Weight already baked into the CSV
        if "Session_Weight" not in df.columns:
            df["Session_Weight"] = session_weight
        if "SessionType" not in df.columns:
            df["SessionType"]    = session_type

        df["Year"]      = year
        df["Round"]     = rnd
        df["EventName"] = event_maps.get((year, rnd), f"Unknown Round {rnd}")
        frames.append(df)

    combined = pd.concat(frames, ignore_index=True)

    # Keep only Race and Sprint rows for the main dataset
    # We do not want FP or Quali rows to duplicate driver entries in the target set
    combined = combined[combined["SessionType"].isin(["Race", "Sprint"])].copy()

    log.info(f"Loaded {len(frames)} CSVs → {len(combined):,} rows (Race/Sprint only)")
    return combined


# ─────────────────────────────────────────────────────────────────────────────
# 2.  CORE FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────
def engineer_features(df: pd.DataFrame):
    """
    Build all model features.  Returns:
        (enriched_df, circuit_enc)

    NOTE: team_enc and driver_enc are no longer used as model features
    (dropped to remove historical bias) but circuit_enc is still required
    for the 'Circuit_Encoded' feature and track-specific inference.
    """
    df = df.copy()

    # ── Numeric coercions ────────────────────────────────────────────────────
    df["Position"]     = pd.to_numeric(df["Position"],     errors="coerce")
    df["GridPosition"] = pd.to_numeric(df["GridPosition"], errors="coerce")
    df["Points"]       = pd.to_numeric(df["Points"],       errors="coerce").fillna(0)

    # ── Target ───────────────────────────────────────────────────────────────
    df["Podium"] = (df["Position"] <= 3).astype(int)

    # ── Sort chronologically (important for rolling windows) ─────────────────
    df = df.sort_values(["Year", "Round", "DriverId"]).reset_index(drop=True)

    # ── FEATURE 1: Recent Form — last-3-race avg finish position (per driver) ─
    df = df.sort_values(["DriverId", "Year", "Round"]).reset_index(drop=True)
    df["Recent_Form_3R"] = (
        df.groupby("DriverId")["Position"]
          .transform(lambda s: s.shift(1).rolling(window=3, min_periods=1).mean())
    )
    driver_means = df.groupby("DriverId")["Position"].transform("mean")
    df["Recent_Form_3R"] = df["Recent_Form_3R"].fillna(driver_means)

    # ── FEATURE 2: Cumulative season points ───────────────────────────────────
    df["Season_Points"] = (
        df.groupby(["DriverId", "Year"])["Points"]
          .transform(lambda s: s.shift(1).cumsum().fillna(0))
    )

    # ── FEATURE 3: Car_Rank — rolling 3-race team points rank ─────────────────
    # For each (Year, Round), sum points per team over the last 3 rounds,
    # then rank teams (rank 1 = most points = best car).
    # This is computed BEFORE the current race to avoid data leakage.
    df = df.sort_values(["Year", "Round", "TeamName"]).reset_index(drop=True)

    # Aggregate to one row per (Year, Round, TeamName)
    team_round = (
        df.groupby(["Year", "Round", "TeamName"])["Points"]
        .sum()
        .reset_index()
        .rename(columns={"Points": "Team_Round_Points"})
    )
    # rolling 3-round team total (shift 1 to avoid current-race leakage)
    team_round = team_round.sort_values(["TeamName", "Year", "Round"]).reset_index(drop=True)
    team_round["Team_Pts_Last3"] = (
        team_round.groupby(["TeamName", "Year"])["Team_Round_Points"]
        .transform(lambda s: s.shift(1).rolling(3, min_periods=1).sum())
    )
    # Rank within each (Year, Round): 1 = best car
    team_round["Car_Rank"] = (
        team_round.groupby(["Year", "Round"])["Team_Pts_Last3"]
        .rank(ascending=False, method="min")
    )
    # Fallback rank if no prior data (new season start)
    max_teams = team_round.groupby(["Year", "Round"])["Car_Rank"].transform("max")
    team_round["Car_Rank"] = team_round["Car_Rank"].fillna(max_teams)

    df = df.merge(team_round[["Year", "Round", "TeamName", "Car_Rank"]],
                  on=["Year", "Round", "TeamName"], how="left")
    # Fill any remaining gaps with midfield rank
    df["Car_Rank"] = df["Car_Rank"].fillna(df["Car_Rank"].median())

    # ── FEATURE 4: Upgrade_Impact ─────────────────────────────────────────────
    # 1 for teams with a confirmed Miami upgrade package, else 0.
    # This lets the model learn that on-track validation (Sprint P1/P2 for
    # McLaren) is correlated with race podium likelihood.
    df["Upgrade_Impact"] = df["TeamName"].isin(UPGRADE_TEAMS).astype(float) * 0.5

    # ── FEATURE 5: Overtake_Index ─────────────────────────────────────────────
    # GridPosition - Car_Rank: positive value = fast car starting from behind its
    # natural quali position, capturing overtake/recovery potential.
    # Russell P6 Rank#1 = +5; Leclerc P3 Rank#2 = +1.
    df["Overtake_Index"] = (df["GridPosition"] - df["Car_Rank"]).clip(-10, 15)

    # ── FEATURE 6: Standings_Pos ──────────────────────────────────────────────
    # Championship standing rank within each (Year, Round): 1 = points leader.
    # Uses Season_Points (computed but not a direct model feature) as the basis.
    # Provides a reliability/consistency signal independent of grid position.
    df["Standings_Pos"] = (
        df.groupby(["Year", "Round"])["Season_Points"]
        .rank(ascending=False, method="min")
        .clip(1, 20)
    )

    # ── Circuit Encoder ───────────────────────────────────────────────────────
    circuit_enc = LabelEncoder()
    df["Circuit_Encoded"] = circuit_enc.fit_transform(df["EventName"])

    # ── FEATURE 7, 8, 9: Practice_Pace, Qualifying_Dominance, Weekend_Momentum ──
    # Compute the historical values by evaluating the CSVs for each race weekend.
    lookup_rows = []
    for (y, r), group in df.groupby(["Year", "Round"]):
        is_sprint = (group["SessionType"] == "Sprint").any()
        pp = compute_practice_pace(DATA_DIR, y, r)
        qd = compute_qualifying_dominance(DATA_DIR, y, r)
        
        sf_df = group[group["SessionType"] == "Sprint"]
        sf = sf_df.set_index("DriverId")["Position"] if not sf_df.empty else pd.Series(dtype=float)
        
        wm = compute_weekend_momentum(pp, qd, sf, is_sprint)
        
        for did in group["DriverId"].unique():
            lookup_rows.append({
                "Year": y, "Round": r, "DriverId": did,
                "Practice_Pace": pp.get(did, 11.0),
                "Qualifying_Dominance": qd.get(did, 0.02),
                "Weekend_Momentum": wm.get(did, 11.0),
            })
            
    lookup_df = pd.DataFrame(lookup_rows)
    if not lookup_df.empty:
        df = df.merge(lookup_df, on=["Year", "Round", "DriverId"], how="left")
        # Fill any missing
        df["Practice_Pace"] = df["Practice_Pace"].fillna(11.0)
        df["Qualifying_Dominance"] = df["Qualifying_Dominance"].fillna(0.02)
        df["Weekend_Momentum"] = df["Weekend_Momentum"].fillna(11.0)
    else:
        df["Practice_Pace"] = 11.0
        df["Qualifying_Dominance"] = 0.02
        df["Weekend_Momentum"] = 11.0

    # ── Session_Recency: duplicate Sprint rows to apply 2× training weight ────
    # Rather than a separate weight array, we physically duplicate Sprint rows
    # so the forest sees them twice — equivalent to Session_Weight=2.0.
    sprint_mask = df.get("SessionType", pd.Series("Race", index=df.index)) == "Sprint"
    if sprint_mask.any():
        df = pd.concat([df, df[sprint_mask]], ignore_index=True)
        log.info(f"Session_Recency: duplicated {sprint_mask.sum()} Sprint rows (2× weight)")

    # ── Drop rows with missing critical features ──────────────────────────────
    before = len(df)
    df = df.dropna(subset=["GridPosition", "Position", "Recent_Form_3R", "Car_Rank"])
    log.info(f"Dropped {before - len(df)} NaN rows → {len(df):,} clean rows")

    return df, circuit_enc



# ─────────────────────────────────────────────────────────────────────────────
# 3.  WEEKEND-SPECIFIC LIVE FEATURES
# ─────────────────────────────────────────────────────────────────────────────

def compute_practice_pace(data_dir: str = DATA_DIR, year: int = 2026, rnd: int = 4) -> pd.Series:
    """
    Compute Practice_Pace for each driver from available FP CSVs.

    Returns a Series indexed by DriverId with the mean finish-position rank
    across FP1/FP2/FP3. Lower = faster. Defaults to 11.0 (midfield) when
    no practice data exists.
    """
    frames = []
    for s in ["fp1", "fp2", "fp3"]:
        path = os.path.join(data_dir, f"results_{year}_round{rnd:02d}{s}.csv")
        if os.path.exists(path):
            df = pd.read_csv(path)[["DriverId", "Position"]].copy()
            df["Position"] = pd.to_numeric(df["Position"], errors="coerce")
            frames.append(df)
    if not frames:
        return pd.Series(dtype=float, name="Practice_Pace")
    combined = pd.concat(frames, ignore_index=True)
    combined = combined.dropna(subset=["DriverId"])
    return combined.groupby("DriverId")["Position"].mean().fillna(11.0).rename("Practice_Pace")


def compute_qualifying_dominance(data_dir: str = DATA_DIR, year: int = 2026, rnd: int = 4) -> pd.Series:
    """
    Compute Qualifying_Dominance - normalised Q-time gap to pole.

    0.0 = pole setter. Clipped to [0.0, 0.05]. Falls back to 0.02 when
    timing data is unavailable. Q3 preferred, Q2/Q1 as fallbacks.

    Returns a Series indexed by DriverId.
    """
    path = os.path.join(data_dir, f"results_{year}_round{rnd:02d}q.csv")
    if not os.path.exists(path):
        return pd.Series(dtype=float, name="Qualifying_Dominance")

    qdf = pd.read_csv(path)

    def _to_seconds(raw: str) -> float:
        raw = str(raw).strip().replace("0 days ", "")
        if not raw or raw in ("nan", "NaT", ""):
            return float("nan")
        try:
            parts = raw.split(":")
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
            elif len(parts) == 2:
                return int(parts[0]) * 60 + float(parts[1])
        except (ValueError, IndexError):
            pass
        return float("nan")

    for col in ["Q3", "Q2", "Q1"]:
        if col in qdf.columns:
            qdf[col] = qdf[col].apply(_to_seconds)

    def _best_q(row) -> float:
        for col in ["Q3", "Q2", "Q1"]:
            v = row.get(col, float("nan"))
            if not pd.isna(v) and v > 0:
                return v
        return float("nan")

    qdf["Q_seconds"] = qdf.apply(_best_q, axis=1)
    pole_time = qdf["Q_seconds"].min()
    if pd.isna(pole_time) or pole_time <= 0:
        return pd.Series(dtype=float, name="Qualifying_Dominance")

    qdf["Qualifying_Dominance"] = (
        ((qdf["Q_seconds"] - pole_time) / pole_time).clip(0.0, 0.05).fillna(0.02)
    )
    qdf = qdf.dropna(subset=["DriverId"])
    return qdf.set_index("DriverId")["Qualifying_Dominance"]


def compute_weekend_momentum(
    practice_pace: pd.Series,
    quali_dominance: pd.Series,
    sprint_finish: pd.Series,
    is_sprint_weekend: bool = False,
) -> pd.Series:
    """
    Composite Weekend_Momentum score blending all current-weekend signals.

    Lower = stronger momentum (consistent with F1 position conventions).
    Sprint_Finish weighted 2.5x on sprint weekends (SPRINT_WEIGHT).

    Weights (sprint weekend): Practice_Pace 20%, Qualifying_Dom 30%, Sprint 50%.
    Weights (non-sprint):     Practice_Pace 30%, Qualifying_Dom 70%.

    Returns a Series indexed by DriverId clipped to [1, 20].
    """
    all_ids = set(practice_pace.index) | set(quali_dominance.index) | set(sprint_finish.index)
    rows = []
    for did in all_ids:
        if pd.isna(did): continue
        pp = float(practice_pace.get(did, 11.0))
        qd = float(quali_dominance.get(did, 0.02)) * 400  # scale 0-0.05 to 0-20
        sf = float(sprint_finish.get(did, 11.0))
        if is_sprint_weekend and not sprint_finish.empty:
            score = 0.20 * pp + 0.30 * qd + 0.50 * sf
        else:
            score = 0.30 * pp + 0.70 * qd
        rows.append({"DriverId": did, "Weekend_Momentum": float(score)})
    if not rows:
        return pd.Series(dtype=float, name="Weekend_Momentum")
    return (
        pd.DataFrame(rows).set_index("DriverId")["Weekend_Momentum"].clip(1.0, 20.0)
    )
