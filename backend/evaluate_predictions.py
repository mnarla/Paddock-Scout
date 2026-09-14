import os
import sys
import json
import argparse
import pandas as pd
import numpy as np

DATA_DIR = "data"

def evaluate_round(year: int = 2026, rnd: int = 14):
    pred_path = os.path.join(DATA_DIR, f"predictions_{year}_round{rnd:02d}_prerace.json")
    results_path = os.path.join(DATA_DIR, f"results_{year}_round{rnd:02d}.csv")
    quali_path = os.path.join(DATA_DIR, f"results_{year}_round{rnd:02d}q.csv")

    if not os.path.exists(pred_path):
        print(f"❌ Error: Pre-race snapshot not found at {pred_path}")
        return

    with open(pred_path, "r") as f:
        snapshot = json.load(f)

    if not os.path.exists(results_path):
        print(f"⚠️  Race results file {results_path} not found.")
        print(f"Run the Sunday auto-ingest or `PYTHONPATH=backend python3 backend/data_loader.py --current --day sunday` after the Grand Prix finishes.")
        return

    results_df = pd.read_csv(results_path)
    results_df["Position"] = pd.to_numeric(results_df["Position"], errors="coerce")
    results_sorted = results_df.sort_values("Position").reset_index(drop=True)

    actual_winner = results_sorted.iloc[0]["DriverId"]
    actual_winner_name = results_sorted.iloc[0]["FullName"]

    actual_podium_drivers = results_sorted.iloc[:3]["DriverId"].tolist()
    actual_podium_names = results_sorted.iloc[:3]["FullName"].tolist()

    actual_top10_drivers = results_sorted.iloc[:10]["DriverId"].tolist()

    # Predictions
    preds = snapshot["predictions"]
    # Sort by win prob
    pred_by_win = sorted(preds, key=lambda x: x["winProb"], reverse=True)
    pred_winner = pred_by_win[0]["driverId"]
    pred_winner_name = pred_by_win[0]["fullName"]

    # Sort by podium prob
    pred_by_podium = sorted(preds, key=lambda x: x["podiumProb"], reverse=True)
    pred_podium_drivers = [d["driverId"] for d in pred_by_podium[:3]]
    pred_podium_names = [d["fullName"] for d in pred_by_podium[:3]]

    pred_top10_drivers = [d["driverId"] for d in pred_by_podium[:10]]

    # Grid Top 3 (Beat the Grid baseline)
    grid_sorted = sorted(preds, key=lambda x: x["gridPos"])
    grid_top3_drivers = [d["driverId"] for d in grid_sorted[:3]]
    grid_top3_names = [d["fullName"] for d in grid_sorted[:3]]
    pole_sitter = grid_sorted[0]["driverId"]
    pole_sitter_name = grid_sorted[0]["fullName"]

    # Overlaps
    podium_overlap = set(pred_podium_drivers).intersection(set(actual_podium_drivers))
    grid_podium_overlap = set(grid_top3_drivers).intersection(set(actual_podium_drivers))
    top10_overlap = set(pred_top10_drivers).intersection(set(actual_top10_drivers))

    # Brier Score calculation
    brier_scores = []
    finish_map = results_df.set_index("DriverId")["Position"].to_dict()
    status_map = results_df.set_index("DriverId")["Status"].to_dict() if "Status" in results_df.columns else {}

    dnfs = []
    for d in preds:
        did = d["driverId"]
        finish_pos = finish_map.get(did, np.nan)
        status = status_map.get(did, "Finished")
        if pd.isna(finish_pos) or "Retired" in str(status) or "Accident" in str(status) or "Collision" in str(status) or "Engine" in str(status):
            dnfs.append((d["fullName"], status, d["podiumProb"]))

        actual_podium = 1.0 if pd.notna(finish_pos) and finish_pos <= 3 else 0.0
        brier_scores.append((d["podiumProb"] - actual_podium) ** 2)

    model_brier = float(np.mean(brier_scores))

    # Grid baseline brier score (assume grid top 3 has 0.70 podium prob, rest 0.05)
    grid_brier_scores = []
    for d in preds:
        did = d["driverId"]
        finish_pos = finish_map.get(did, np.nan)
        actual_podium = 1.0 if pd.notna(finish_pos) and finish_pos <= 3 else 0.0
        grid_prob = 0.70 if d["gridPos"] <= 3 else 0.05
        grid_brier_scores.append((grid_prob - actual_podium) ** 2)
    grid_brier = float(np.mean(grid_brier_scores))

    # Output Report
    print("=" * 80)
    print(f"📊 ACCURACY REPORT: {snapshot['metadata']['eventName']} (Round {rnd}, {year})")
    print("=" * 80)
    print(f"\n1. WINNER ACCURACY:")
    print(f"   - Actual Winner:    {actual_winner_name}")
    print(f"   - Model Top Pick:   {pred_winner_name} (Win Prob: {pred_by_win[0]['winProb']*100:.1f}%)")
    print(f"   - Pole Sitter:      {pole_sitter_name}")
    winner_hit = (actual_winner == pred_winner)
    print(f"   - Result:           {'✅ HIT' if winner_hit else '❌ MISS'}")

    print(f"\n2. PODIUM ACCURACY (Top-3):")
    print(f"   - Actual Podium:    {', '.join(actual_podium_names)}")
    print(f"   - Model Top 3:      {', '.join(pred_podium_names)}")
    print(f"   - Starting Grid:    {', '.join(grid_top3_names)}")
    print(f"   - Model Hit Rate:   {len(podium_overlap)} / 3 ({len(podium_overlap)/3*100:.0f}%)")
    print(f"   - Grid Hit Rate:    {len(grid_podium_overlap)} / 3 ({len(grid_podium_overlap)/3*100:.0f}%)")
    if len(podium_overlap) > len(grid_podium_overlap):
        print("   - Beat the Grid?    🏆 YES (+Alpha generated over Qualifying!)")
    elif len(podium_overlap) == len(grid_podium_overlap):
        print("   - Beat the Grid?    ⚖️ TIED with Qualifying")
    else:
        print("   - Beat the Grid?    🔻 NO (Qualifying grid was more accurate)")

    print(f"\n3. POINTS FINISHERS (Top-10):")
    print(f"   - Model Top-10 Hit: {len(top10_overlap)} / 10 ({len(top10_overlap)*10}%)")

    print(f"\n4. PROBABILISTIC CALIBRATION (Brier Score - lower is better):")
    print(f"   - Model Brier:      {model_brier:.4f}")
    print(f"   - Grid Baseline:    {grid_brier:.4f}")
    brier_delta = (grid_brier - model_brier) / grid_brier * 100
    if model_brier < grid_brier:
        print(f"   - Calibration:      ✅ Model was {brier_delta:.1f}% better calibrated than the raw grid.")
    else:
        print(f"   - Calibration:      Raw grid baseline was {abs(brier_delta):.1f}% better.")

    if dnfs:
        print(f"\n5. INCIDENTS / DNFs:")
        for name, status, prob in dnfs:
            print(f"   - {name}: {status} (Predicted Podium Prob: {prob*100:.1f}%)")

    print("=" * 80)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--round", type=int, default=14)
    args = parser.parse_args()
    evaluate_round(args.year, args.round)
