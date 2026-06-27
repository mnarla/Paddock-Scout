"""
src/archive_loader.py
=====================
Loads historical race weekend data from local CSVs for the Archive tab.
No ML, no FastF1 calls — purely reads what's already in data/.
"""
import os
import glob
import pandas as pd
import numpy as np

DATA_DIR = "data"

_MEDAL = {1: "🥇", 2: "🥈", 3: "🥉"}


def _csv(year: int, rnd: int, suffix: str = "") -> str:
    return os.path.join(DATA_DIR, f"results_{year}_round{rnd:02d}{suffix}.csv")


def load_race_results(year: int, rnd: int) -> pd.DataFrame:
    """Return sorted race results or empty DataFrame if not found."""
    path = _csv(year, rnd)
    if not os.path.exists(path):
        return pd.DataFrame()
    df = pd.read_csv(path)
    df["Position"] = pd.to_numeric(df["Position"], errors="coerce")
    df["Points"]   = pd.to_numeric(df["Points"],   errors="coerce").fillna(0)
    df["GridPosition"] = pd.to_numeric(df["GridPosition"], errors="coerce")
    df = df.sort_values("Position").reset_index(drop=True)
    df["Medal"] = df["Position"].apply(lambda p: _MEDAL.get(int(p), "") if pd.notna(p) else "")
    df["Positions Gained"] = (df["GridPosition"] - df["Position"]).apply(
        lambda x: f"+{int(x)}" if pd.notna(x) and x > 0 else (str(int(x)) if pd.notna(x) else "–")
    )
    return df


def load_qualifying(year: int, rnd: int) -> pd.DataFrame:
    """Return qualifying grid sorted by position."""
    path = _csv(year, rnd, "q")
    if not os.path.exists(path):
        return pd.DataFrame()
    df = pd.read_csv(path)
    df["Position"] = pd.to_numeric(df["Position"], errors="coerce")
    return df.sort_values("Position").reset_index(drop=True)


def load_sprint(year: int, rnd: int) -> pd.DataFrame:
    """Return sprint results or empty DataFrame."""
    path = _csv(year, rnd, "s")
    if not os.path.exists(path):
        return pd.DataFrame()
    df = pd.read_csv(path)
    df["Position"] = pd.to_numeric(df["Position"], errors="coerce")
    df = df.sort_values("Position").reset_index(drop=True)
    df["Medal"] = df["Position"].apply(lambda p: _MEDAL.get(int(p), "") if pd.notna(p) else "")
    return df


def load_practice_pace(year: int, rnd: int) -> pd.DataFrame:
    """Return practice pace table averaged across FP1/FP2/FP3."""
    frames = []
    for s in ["fp1", "fp2", "fp3"]:
        path = _csv(year, rnd, s)
        if os.path.exists(path):
            df = pd.read_csv(path)[["FullName", "TeamName", "Position"]].copy()
            df["Position"] = pd.to_numeric(df["Position"], errors="coerce")
            df["Session"] = s.upper()
            frames.append(df)
    if not frames:
        return pd.DataFrame()
    combined = pd.concat(frames, ignore_index=True)
    if combined["Position"].isna().all():
        return pd.DataFrame()
    pace = (
        combined.groupby(["FullName", "TeamName"])["Position"]
        .mean()
        .reset_index()
        .rename(columns={"Position": "FP Avg Pos"})
        .sort_values("FP Avg Pos")
        .reset_index(drop=True)
    )
    pace.index += 1
    pace["FP Avg Pos"] = pace["FP Avg Pos"].apply(lambda x: f"P{x:.1f}")
    return pace


def podium_from_results(race_df: pd.DataFrame) -> list:
    """Extract top-3 drivers as a list of dicts for card rendering."""
    medals = ["🥇", "🥈", "🥉"]
    result = []
    for i, (_, row) in enumerate(race_df.head(3).iterrows()):
        result.append({
            "position": i + 1,
            "medal":    medals[i],
            "driver":   row.get("FullName", "–"),
            "team":     row.get("TeamName", "–"),
            "color":    f"#{str(row.get('TeamColor','888888')).lstrip('#')[:6]}",
            "points":   int(row.get("Points", 0)),
            "grid":     int(row["GridPosition"]) if pd.notna(row.get("GridPosition")) else "–",
        })
    return result
