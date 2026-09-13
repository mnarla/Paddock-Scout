import os
import sys
import json
import datetime
import numpy as np
import pandas as pd

import warnings
warnings.filterwarnings("ignore")

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from calendar_manager import get_next_race_full
from utils import safe_encode, standings_rank, get_neutral_values
from features import compute_practice_pace, compute_qualifying_dominance, compute_weekend_momentum
import pickle

DATA_DIR = "data"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "f1_podium_predictor.pkl")

DRIVER_NAMES = {
    "norris": "Lando Norris",
    "antonelli": "Andrea Kimi Antonelli",
    "max_verstappen": "Max Verstappen",
    "hamilton": "Lewis Hamilton",
    "leclerc": "Charles Leclerc",
    "russell": "George Russell",
    "piastri": "Oscar Piastri",
    "lawson": "Liam Lawson",
    "colapinto": "Franco Colapinto",
    "arvid_lindblad": "Arvid Lindblad",
    "hulkenberg": "Nico Hülkenberg",
    "bortoleto": "Gabriel Bortoleto",
    "ocon": "Esteban Ocon",
    "gasly": "Pierre Gasly",
    "tsunoda": "Yuki Tsunoda",
    "albon": "Alexander Albon",
    "sainz": "Carlos Sainz",
    "alonso": "Fernando Alonso",
    "perez": "Sergio Pérez",
    "bottas": "Valtteri Bottas",
}

def generate_snapshot():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")

    with open(MODEL_PATH, "rb") as fh:
        model_bundle = pickle.load(fh)

    clf = model_bundle["model"]
    FEATURES = model_bundle["features"]
    circuit_enc = model_bundle["circuit_enc"]
    grid_scaler = model_bundle.get("grid_scaler")

    ri = get_next_race_full()
    yr = ri.date.year
    rnd = ri.round_num
    gp_name = ri.name

    print(f"Generating Pre-Race Snapshot for: {gp_name} (Year: {yr}, Round: {rnd})")

    # Load 2026 context
    all_files = sorted([os.path.join(DATA_DIR, f) for f in os.listdir(DATA_DIR) if f.startswith("results_2026_round") and f.endswith(".csv")])
    frames = []
    for f in all_files:
        basename = os.path.basename(f)
        if basename.endswith("q.csv") or "fp" in basename:
            continue
        df = pd.read_csv(f)
        frames.append(df)

    if frames:
        all_r = pd.concat(frames, ignore_index=True)
        all_r["Position"] = pd.to_numeric(all_r["Position"], errors="coerce")
        all_r["Points"] = pd.to_numeric(all_r["Points"], errors="coerce").fillna(0)
        ss = all_r.groupby("DriverId").agg(
            SeasonPoints=("Points", "sum"),
            AvgFinish=("Position", "mean"),
            FullName=("FullName", "first"),
            TeamName=("TeamName", "last"),
        ).reset_index()
    else:
        ss = pd.DataFrame(columns=["DriverId", "SeasonPoints", "AvgFinish", "FullName", "TeamName"])

    # Recent form
    recent_frames = []
    for f in all_files[-3:]:
        basename = os.path.basename(f)
        if not (basename.endswith("q.csv") or "fp" in basename):
            recent_frames.append(pd.read_csv(f))
    if recent_frames:
        rec_df = pd.concat(recent_frames, ignore_index=True)
        rec_df["Position"] = pd.to_numeric(rec_df["Position"], errors="coerce")
        rf = rec_df.groupby("DriverId")["Position"].mean().rename("Recent_Form_3R").reset_index()
        ss = ss.merge(rf, on="DriverId", how="left")
    else:
        ss["Recent_Form_3R"] = 11.0
    ss["Recent_Form_3R"] = ss["Recent_Form_3R"].fillna(11.0)

    # Car rank
    team_points = ss.groupby("TeamName")["SeasonPoints"].sum().sort_values(ascending=False)
    team_ranks = {team: rank + 1 for rank, team in enumerate(team_points.index)}
    ss["Car_Rank"] = ss["TeamName"].map(team_ranks).fillna(5.0)

    # Qualifying file
    q_file = os.path.join(DATA_DIR, f"results_{yr}_round{rnd:02d}q.csv")
    if os.path.exists(q_file):
        q_df = pd.read_csv(q_file)
        q_df["Position"] = pd.to_numeric(q_df["Position"], errors="coerce")
        q_map = q_df.set_index("DriverId")["Position"].to_dict()
    else:
        q_map = {}

    # Session features
    pp = compute_practice_pace(DATA_DIR, yr, rnd)
    qd = compute_qualifying_dominance(DATA_DIR, yr, rnd)
    sp_path = os.path.join(DATA_DIR, f"results_{yr}_round{rnd:02d}s.csv")
    if os.path.exists(sp_path):
        sdf = pd.read_csv(sp_path)
        sdf["Position"] = pd.to_numeric(sdf["Position"], errors="coerce")
        sf = sdf.set_index("DriverId")["Position"].dropna()
    else:
        sf = pd.Series(dtype=float)

    momentum_series = compute_weekend_momentum(pp, qd, sf, ri.is_sprint)
    c_enc = safe_encode(circuit_enc, gp_name)

    drivers_list = []
    # If driver not in ss, add from q_map
    all_driver_ids = set(ss["DriverId"].tolist()).union(set(q_map.keys()))

    for did in all_driver_ids:
        row_match = ss[ss["DriverId"] == did]
        if not row_match.empty:
            row = row_match.iloc[0]
            full_name = row["FullName"] if pd.notna(row["FullName"]) else DRIVER_NAMES.get(did, did)
            team_name = row["TeamName"] if pd.notna(row["TeamName"]) else "Unknown"
            car_rank = float(row.get("Car_Rank", 5.0))
            season_pts = float(row.get("SeasonPoints", 0.0))
            recent_form = float(row.get("Recent_Form_3R", 11.0))
        else:
            full_name = DRIVER_NAMES.get(did, did)
            team_name = "Unknown"
            car_rank = 6.0
            season_pts = 0.0
            recent_form = 11.0

        grid_pos = int(q_map.get(did, 15))
        overtake_idx = float(np.clip(grid_pos - car_rank, -10, 15))
        s_rank = standings_rank(ss, full_name) if not ss.empty else 10.0

        pp_val = float(pp.get(did, 11.0))
        qd_val = float(qd.get(did, 0.02))
        wm_val = float(momentum_series.get(did, 11.0))

        # Upgrade impact
        team_upgrades = {
            "Ferrari": -0.18,
            "Mercedes": -0.12,
            "McLaren": 0.04,
            "Red Bull Racing": -0.09,
            "Williams": -0.06,
            "Alpine": 0.02,
        }
        upgrade = -team_upgrades.get(team_name, 0.0)

        feature_dict = {
            "Recent_Form_3R": recent_form,
            "GridPosition": float(grid_scaler.transform([[grid_pos]])[0][0]) if grid_scaler else float(grid_pos),
            "Car_Rank": car_rank,
            "Circuit_Encoded": c_enc,
            "Upgrade_Impact": upgrade,
            "Overtake_Index": overtake_idx,
            "Standings_Pos": s_rank,
            "Practice_Pace": pp_val,
            "Qualifying_Dominance": qd_val,
            "Weekend_Momentum": wm_val,
        }

        X = np.array([[feature_dict.get(f, 0.0) for f in FEATURES]])
        raw_prob = float(clf.predict_proba(X)[0][1])

        if grid_pos > 10:
            penalty_grid = (grid_pos - 10) * 0.05
            raw_prob = max(0.005, raw_prob * (1.0 - min(0.85, penalty_grid)))

        p3 = float(raw_prob)

        if grid_pos == 1:
            win_ratio, top2_ratio = 0.58, 0.82
        elif grid_pos == 2:
            win_ratio, top2_ratio = 0.32, 0.65
        elif grid_pos == 3:
            win_ratio, top2_ratio = 0.16, 0.45
        elif grid_pos <= 6:
            win_ratio, top2_ratio = 0.06, 0.22
        elif grid_pos <= 10:
            win_ratio, top2_ratio = 0.015, 0.08
        else:
            win_ratio, top2_ratio = 0.005, 0.02

        standing_factor = max(0.2, (12.0 - min(11.0, float(s_rank))) / 11.0)
        p1 = min(0.95, max(0.005, p3 * win_ratio * standing_factor))
        p2 = min(p3, max(p1 * 1.15, p3 * top2_ratio * standing_factor))

        drivers_list.append({
            "driverId": did,
            "fullName": full_name,
            "teamName": team_name,
            "gridPos": grid_pos,
            "winProb": round(p1, 4),
            "top2Prob": round(p2, 4),
            "podiumProb": round(p3, 4),
            "weekendMomentum": round(wm_val, 2),
            "practicePace": round(pp_val, 2),
            "recentForm": round(recent_form, 2),
        })

    # Sort by podium probability descending
    drivers_list.sort(key=lambda d: (d["podiumProb"], d["winProb"]), reverse=True)

    snapshot_data = {
        "metadata": {
            "season": yr,
            "round": rnd,
            "eventName": gp_name,
            "sessionStage": "fully_ingested",
            "timestampUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "ingestedSessions": ["FP1", "FP2", "FP3", "Qualifying"],
            "gridTop3": sorted([d for d in drivers_list], key=lambda x: x["gridPos"])[:3],
        },
        "predictions": drivers_list,
    }

    # Format output path
    output_filename = f"predictions_{yr}_round{rnd:02d}_prerace.json"
    output_path = os.path.join(DATA_DIR, output_filename)
    with open(output_path, "w") as f:
        json.dump(snapshot_data, f, indent=2)

    print(f"\n✅ Snapshot saved to: {output_path}\n")

    # Print clean summary table
    print(f"{'Pos':<4} {'Driver':<24} {'Team':<18} {'Grid':<6} {'Win %':<8} {'Top2 %':<8} {'Podium %':<9} {'Momentum':<9}")
    print("-" * 90)
    for idx, d in enumerate(drivers_list):
        print(f"{idx+1:<4} {d['fullName']:<24} {d['teamName']:<18} P{d['gridPos']:<5} {d['winProb']*100:>5.1f}%  {d['top2Prob']*100:>5.1f}%  {d['podiumProb']*100:>6.1f}%   {d['weekendMomentum']:>5.2f}")

    return snapshot_data

if __name__ == "__main__":
    generate_snapshot()
