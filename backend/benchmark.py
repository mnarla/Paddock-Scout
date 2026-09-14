"""
backend/benchmark.py — Paddock Scout Accuracy & Benchmarking Suite
==================================================================
Runs an offline walk-forward evaluation across completed Formula 1 races,
measuring ground-truth accuracy metrics:
  - Winner Accuracy (P1)
  - Podium Accuracy (Top-3)
  - Beat-the-Grid Alpha (+% over raw qualifying starting grid)
  - Points Finishers Accuracy (Top-10)
  - Probabilistic Brier Score (Model calibration vs Grid baseline)

Usage:
  python backend/benchmark.py [--season 2026]
"""

import os
import sys
import argparse
import pickle
import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(__file__))

from calendar_manager import SCHEDULE_2026, SPRINT_RACES_2026
from utils import safe_encode, standings_rank, DRIVER_NAMES
from features import compute_practice_pace, compute_qualifying_dominance, compute_weekend_momentum

DATA_DIR = "data"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "f1_podium_predictor.pkl")


ROUNDS_MAP_2026 = {}
for gp_name, info in SCHEDULE_2026.items():
    ROUNDS_MAP_2026[info["round"]] = {
        "name": gp_name,
        "is_sprint": gp_name in SPRINT_RACES_2026
    }

def run_season_benchmark(season: int = 2026, verbose: bool = True):
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")

    with open(MODEL_PATH, "rb") as fh:
        model_bundle = pickle.load(fh)

    clf = model_bundle["model"]
    FEATURES = model_bundle["features"]
    circuit_enc = model_bundle["circuit_enc"]
    grid_scaler = model_bundle.get("grid_scaler")

    round_results = []

    # Detect all completed race files for the season
    race_files = sorted([
        f for f in os.listdir(DATA_DIR)
        if f.startswith(f"results_{season}_round") and f.endswith(".csv")
        and not f.endswith("q.csv") and not f.endswith("s.csv") and "fp" not in f
    ])

    for rfile in race_files:
        rnd_str = rfile.replace(f"results_{season}_round", "").replace(".csv", "")
        try:
            rnd = int(rnd_str)
        except ValueError:
            continue

        race_path = os.path.join(DATA_DIR, rfile)
        quali_path = os.path.join(DATA_DIR, f"results_{season}_round{rnd:02d}q.csv")
        if not os.path.exists(quali_path):
            continue

        gp_info = ROUNDS_MAP_2026.get(rnd, {"name": f"Round {rnd}", "is_sprint": False})
        gp_name = gp_info["name"]
        is_sprint = gp_info["is_sprint"]

        # 1. Historical context strictly BEFORE round `rnd`
        prior_race_files = [os.path.join(DATA_DIR, f"results_{season}_round{r:02d}.csv") for r in range(1, rnd)]
        prior_frames = [pd.read_csv(f) for f in prior_race_files if os.path.exists(f)]

        if prior_frames:
            all_r = pd.concat(prior_frames, ignore_index=True)
            all_r["Position"] = pd.to_numeric(all_r["Position"], errors="coerce")
            all_r["Points"] = pd.to_numeric(all_r["Points"], errors="coerce").fillna(0)
            ss = all_r.groupby("DriverId").agg(
                SeasonPoints=("Points", "sum"),
                AvgFinish=("Position", "mean"),
                FullName=("FullName", "first"),
                TeamName=("TeamName", "last"),
            ).reset_index()

            recent_frames = prior_frames[-3:]
            rec_df = pd.concat(recent_frames, ignore_index=True)
            rec_df["Position"] = pd.to_numeric(rec_df["Position"], errors="coerce")
            rf = rec_df.groupby("DriverId")["Position"].mean().rename("Recent_Form_3R").reset_index()
            ss = ss.merge(rf, on="DriverId", how="left")
            ss["Recent_Form_3R"] = ss["Recent_Form_3R"].fillna(11.0)

            team_points = ss.groupby("TeamName")["SeasonPoints"].sum().sort_values(ascending=False)
            team_ranks = {team: rank + 1 for rank, team in enumerate(team_points.index)}
            ss["Car_Rank"] = ss["TeamName"].map(team_ranks).fillna(5.5)
        else:
            ss = pd.DataFrame(columns=["DriverId", "SeasonPoints", "AvgFinish", "FullName", "TeamName", "Recent_Form_3R", "Car_Rank"])

        # 2. Session features for round `rnd`
        q_df = pd.read_csv(quali_path)
        q_df["Position"] = pd.to_numeric(q_df["Position"], errors="coerce")
        q_map = q_df.dropna(subset=["Position"]).set_index("DriverId")["Position"].to_dict()

        pp = compute_practice_pace(DATA_DIR, season, rnd)
        qd = compute_qualifying_dominance(DATA_DIR, season, rnd)
        sp_path = os.path.join(DATA_DIR, f"results_{season}_round{rnd:02d}s.csv")
        if os.path.exists(sp_path):
            sdf = pd.read_csv(sp_path)
            sdf["Position"] = pd.to_numeric(sdf["Position"], errors="coerce")
            sf = sdf.set_index("DriverId")["Position"].dropna()
        else:
            sf = pd.Series(dtype=float)

        momentum_series = compute_weekend_momentum(pp, qd, sf, is_sprint)
        c_enc = safe_encode(circuit_enc, gp_name)

        # 3. Model Predictions for each driver on the starting grid
        drivers_list = []
        for did, grid_pos in q_map.items():
            grid_pos = int(grid_pos)
            row_match = ss[ss["DriverId"] == did]
            if not row_match.empty:
                row = row_match.iloc[0]
                full_name = row["FullName"] if pd.notna(row["FullName"]) else DRIVER_NAMES.get(did, did)
                team_name = row["TeamName"] if pd.notna(row["TeamName"]) else "Unknown"
                car_rank = float(row.get("Car_Rank", 5.5))
                recent_form = float(row.get("Recent_Form_3R", 11.0))
                s_rank = standings_rank(ss, full_name)
            else:
                full_name = DRIVER_NAMES.get(did, did)
                team_name = "Unknown"
                car_rank = 6.0
                recent_form = 11.0
                s_rank = 11.0

            overtake_idx = float(np.clip(grid_pos - car_rank, -10, 15))
            pp_val = float(pp.get(did, 11.0))
            qd_val = float(qd.get(did, 0.02))
            wm_val = float(momentum_series.get(did, 11.0))

            feature_dict = {
                "Recent_Form_3R": recent_form,
                "GridPosition": float(grid_scaler.transform([[grid_pos]])[0][0]) if grid_scaler else float(grid_pos),
                "Car_Rank": car_rank,
                "Circuit_Encoded": c_enc,
                "Upgrade_Impact": 0.0,
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
                "gridPos": grid_pos,
                "winProb": p1,
                "top2Prob": p2,
                "podiumProb": p3,
            })

        # 4. Load ground truth race results
        race_df = pd.read_csv(race_path)
        race_df["Position"] = pd.to_numeric(race_df["Position"], errors="coerce")
        race_sorted = race_df.sort_values("Position").reset_index(drop=True)

        actual_winner = race_sorted.iloc[0]["DriverId"]
        actual_winner_name = race_sorted.iloc[0]["FullName"]
        actual_podium = race_sorted.iloc[:3]["DriverId"].tolist()
        actual_podium_names = race_sorted.iloc[:3]["FullName"].tolist()
        actual_top10 = race_sorted.iloc[:10]["DriverId"].tolist()

        # Sort model predictions
        pred_by_win = sorted(drivers_list, key=lambda x: x["winProb"], reverse=True)
        pred_winner = pred_by_win[0]["driverId"]
        pred_winner_name = pred_by_win[0]["fullName"]

        pred_by_podium = sorted(drivers_list, key=lambda x: (x["podiumProb"], x["winProb"]), reverse=True)
        pred_podium = [d["driverId"] for d in pred_by_podium[:3]]
        pred_top10 = [d["driverId"] for d in pred_by_podium[:10]]

        # Starting grid top 3 baseline
        grid_sorted = sorted(drivers_list, key=lambda x: x["gridPos"])
        grid_top3 = [d["driverId"] for d in grid_sorted[:3]]
        pole_sitter = grid_sorted[0]["driverId"]

        # Calculate hits
        winner_hit = (actual_winner == pred_winner)
        pole_winner_hit = (actual_winner == pole_sitter)

        podium_hits = len(set(pred_podium).intersection(set(actual_podium)))
        grid_podium_hits = len(set(grid_top3).intersection(set(actual_podium)))

        top10_hits = len(set(pred_top10).intersection(set(actual_top10)))
        grid_top10_hits = len(set([d["driverId"] for d in grid_sorted[:10]]).intersection(set(actual_top10)))

        # Standings baseline (top drivers in championship prior to this round)
        if not ss.empty:
            ss_sorted = ss.sort_values("SeasonPoints", ascending=False)
            standings_top3 = ss_sorted.iloc[:3]["DriverId"].tolist()
            standings_top10 = ss_sorted.iloc[:10]["DriverId"].tolist()
            standings_winner = standings_top3[0] if standings_top3 else None
        else:
            standings_top3 = grid_top3
            standings_top10 = [d["driverId"] for d in grid_sorted[:10]]
            standings_winner = pole_sitter

        standings_podium_hits = len(set(standings_top3).intersection(set(actual_podium)))
        standings_top10_hits = len(set(standings_top10).intersection(set(actual_top10)))
        standings_winner_hit = (actual_winner == standings_winner)

        # Brier score
        finish_map = race_df.set_index("DriverId")["Position"].to_dict()
        model_briers = []
        grid_briers = []
        standings_briers = []
        for d in drivers_list:
            did = d["driverId"]
            finish_pos = finish_map.get(did, np.nan)
            y_podium = 1.0 if pd.notna(finish_pos) and finish_pos <= 3 else 0.0
            model_briers.append((d["podiumProb"] - y_podium) ** 2)
            grid_p = 0.70 if d["gridPos"] <= 3 else 0.05
            grid_briers.append((grid_p - y_podium) ** 2)
            standings_p = 0.70 if did in standings_top3 else 0.05
            standings_briers.append((standings_p - y_podium) ** 2)

        m_brier = float(np.mean(model_briers))
        g_brier = float(np.mean(grid_briers))
        s_brier = float(np.mean(standings_briers))

        round_results.append({
            "round": rnd,
            "name": gp_name,
            "actual_winner": actual_winner_name,
            "pred_winner": pred_winner_name,
            "winner_hit": winner_hit,
            "pole_winner_hit": pole_winner_hit,
            "standings_winner_hit": standings_winner_hit,
            "actual_podium": actual_podium_names,
            "podium_hits": podium_hits,
            "grid_podium_hits": grid_podium_hits,
            "standings_podium_hits": standings_podium_hits,
            "top10_hits": top10_hits,
            "grid_top10_hits": grid_top10_hits,
            "standings_top10_hits": standings_top10_hits,
            "model_brier": m_brier,
            "grid_brier": g_brier,
            "standings_brier": s_brier,
        })

    total_winner_hits = sum(1 for r in round_results if r["winner_hit"])
    total_pole_winner_hits = sum(1 for r in round_results if r["pole_winner_hit"])
    total_standings_winner_hits = sum(1 for r in round_results if r["standings_winner_hit"])

    total_podium_hits = sum(r["podium_hits"] for r in round_results)
    total_grid_podium_hits = sum(r["grid_podium_hits"] for r in round_results)
    total_standings_podium_hits = sum(r["standings_podium_hits"] for r in round_results)

    total_top10_hits = sum(r["top10_hits"] for r in round_results)
    total_grid_top10_hits = sum(r["grid_top10_hits"] for r in round_results)
    total_standings_top10_hits = sum(r["standings_top10_hits"] for r in round_results)

    model_briers = [r["model_brier"] for r in round_results]
    grid_briers = [r["grid_brier"] for r in round_results]
    standings_briers = [r["standings_brier"] for r in round_results]

    # Attrition
    total_starters = 0
    total_dnfs = 0
    for rfile in race_files:
        rpath = os.path.join(DATA_DIR, rfile)
        if os.path.exists(rpath):
            rdf = pd.read_csv(rpath)
            total_starters += len(rdf)
            dnf_mask = rdf['Status'].str.contains('Retired|Accident|Collision|Engine|Brakes|Spun|Gearbox|Power|Hydraulics|Damage|Out', case=False, na=False) | (rdf['ClassifiedPosition'].astype(str).str.upper().isin(['R', 'D', 'W', 'NC']))
            total_dnfs += int(dnf_mask.sum())

    n_rounds = len(round_results)

    metrics_summary = {
        "season": season,
        "n_rounds": n_rounds,
        "total_starters": total_starters,
        "total_dnfs": total_dnfs,
        "dnf_pct": (total_dnfs / total_starters * 100) if total_starters > 0 else 0.0,
        "avg_dnfs_per_race": (total_dnfs / n_rounds) if n_rounds > 0 else 0.0,
        # Winner
        "winner_hits": total_winner_hits,
        "winner_pct": (total_winner_hits / n_rounds * 100) if n_rounds > 0 else 0.0,
        "pole_hits": total_pole_winner_hits,
        "pole_pct": (total_pole_winner_hits / n_rounds * 100) if n_rounds > 0 else 0.0,
        "standings_winner_hits": total_standings_winner_hits,
        "standings_winner_pct": (total_standings_winner_hits / n_rounds * 100) if n_rounds > 0 else 0.0,
        # Podium
        "podium_hits": total_podium_hits,
        "total_podium_slots": n_rounds * 3,
        "podium_pct": (total_podium_hits / (n_rounds * 3) * 100) if n_rounds > 0 else 0.0,
        "grid_podium_hits": total_grid_podium_hits,
        "grid_podium_pct": (total_grid_podium_hits / (n_rounds * 3) * 100) if n_rounds > 0 else 0.0,
        "standings_podium_hits": total_standings_podium_hits,
        "standings_podium_pct": (total_standings_podium_hits / (n_rounds * 3) * 100) if n_rounds > 0 else 0.0,
        "podium_alpha_pct": ((total_podium_hits - total_grid_podium_hits) / (n_rounds * 3) * 100) if n_rounds > 0 else 0.0,
        # Top 10
        "top10_hits": total_top10_hits,
        "total_top10_slots": n_rounds * 10,
        "top10_pct": (total_top10_hits / (n_rounds * 10) * 100) if n_rounds > 0 else 0.0,
        "grid_top10_hits": total_grid_top10_hits,
        "grid_top10_pct": (total_grid_top10_hits / (n_rounds * 10) * 100) if n_rounds > 0 else 0.0,
        "standings_top10_hits": total_standings_top10_hits,
        "standings_top10_pct": (total_standings_top10_hits / (n_rounds * 10) * 100) if n_rounds > 0 else 0.0,
        "top10_alpha_pct": ((total_top10_hits - total_grid_top10_hits) / (n_rounds * 10) * 100) if n_rounds > 0 else 0.0,
        # Brier
        "model_brier": float(np.mean(model_briers)) if model_briers else 0.0,
        "grid_brier": float(np.mean(grid_briers)) if grid_briers else 0.0,
        "standings_brier": float(np.mean(standings_briers)) if standings_briers else 0.0,
        "round_results": round_results,
    }

    if verbose:
        print("=" * 95)
        print(f"🏁 {season} SEASON WALK-FORWARD ACCURACY BENCHMARK ({n_rounds} Grand Prix Evaluated)")
        print("=" * 95)
        print(f"{'Rnd':<4} {'Grand Prix':<24} {'Pred Winner':<20} {'Actual Winner':<20} {'P1 Hit':<7} {'Podium':<8} {'Top10':<7}")
        print("-" * 95)
        for r in round_results:
            hit_sym = "✅ HIT" if r["winner_hit"] else "❌ MISS"
            p_hit = r["podium_hits"]
            t_hit = r["top10_hits"]
            print(f"{r['round']:<4} {r['name']:<24} {r['pred_winner']:<20} {r['actual_winner']:<20} {hit_sym:<7} {p_hit}/3 ({p_hit/3*100:>3.0f}%) {t_hit}/10 ({t_hit*10}%)")

        print("=" * 95)
        print(f"📊 AGGREGATE {season} PERFORMANCE METRICS:")
        print("=" * 95)
        print(f"1. RACE WINNER ACCURACY (P1):")
        print(f"   - Model Winner Pick:      {total_winner_hits} / {n_rounds} ({metrics_summary['winner_pct']:.1f}%)")
        print(f"   - Pole Sitter Benchmark:  {total_pole_winner_hits} / {n_rounds} ({metrics_summary['pole_pct']:.1f}%)")
        print(f"   - Standings Leader Pick:  {total_standings_winner_hits} / {n_rounds} ({metrics_summary['standings_winner_pct']:.1f}%)")

        print(f"\n2. PODIUM ACCURACY (Top-3):")
        print(f"   - Model Top-3 Hit Rate:   {total_podium_hits} / {n_rounds * 3} ({metrics_summary['podium_pct']:.1f}%)")
        print(f"   - Starting Grid Baseline: {total_grid_podium_hits} / {n_rounds * 3} ({metrics_summary['grid_podium_pct']:.1f}%)")
        print(f"   - Standings Top-3 Baseline:{total_standings_podium_hits} / {n_rounds * 3} ({metrics_summary['standings_podium_pct']:.1f}%)")
        podium_alpha = total_podium_hits - total_grid_podium_hits
        if podium_alpha > 0:
            print(f"   - Beat the Grid?          🏆 YES (+{podium_alpha} more correct podium finishers than Qualifying Grid)")
        elif podium_alpha == 0:
            print(f"   - Beat the Grid?          ⚖️ TIED with Qualifying Grid")
        else:
            print(f"   - Beat the Grid?          🔻 Grid was higher (+{abs(podium_alpha)} podium hits)")

        print(f"\n3. POINTS FINISHERS ACCURACY (Top-10):")
        print(f"   - Model Top-10 Hit Rate:  {total_top10_hits} / {n_rounds * 10} ({metrics_summary['top10_pct']:.1f}%)")
        print(f"   - Starting Grid Baseline: {total_grid_top10_hits} / {n_rounds * 10} ({metrics_summary['grid_top10_pct']:.1f}%)")
        print(f"   - Standings Top-10 Base:  {total_standings_top10_hits} / {n_rounds * 10} ({metrics_summary['standings_top10_pct']:.1f}%)")

        print(f"\n4. PROBABILISTIC CALIBRATION (Brier Score):")
        print(f"   - Model Average Brier:    {metrics_summary['model_brier']:.4f}")
        print(f"   - Grid Baseline Brier:    {metrics_summary['grid_brier']:.4f}")
        print(f"   - Standings Baseline Brier:{metrics_summary['standings_brier']:.4f}")

        print(f"\n5. EMPIRICAL ATTRITION & DNF RATE:")
        print(f"   - Total Entries:          {total_starters} driver entries across {n_rounds} races")
        print(f"   - Total Retirements:      {total_dnfs} classified DNFs ({metrics_summary['dnf_pct']:.1f}%)")
        print(f"   - Average per Grand Prix: {metrics_summary['avg_dnfs_per_race']:.2f} cars / race")
        print("=" * 95)

    return metrics_summary

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Paddock Scout Accuracy Benchmark")
    parser.add_argument("--season", type=int, default=2026, help="F1 season to evaluate (default: 2026)")
    args = parser.parse_args()
    run_season_benchmark(args.season)
