"""
src/utils.py — Shared Non-ML Helpers
=====================================
Pure helper functions used by app.py, simulator.py, and train_model.py.
No ML logic lives here; this module has zero imports from the rest of the project.

Functions
---------
safe_encode(enc, val, fallback)
    Safely transform a categorical value through a LabelEncoder.
normalise_color(raw)
    Ensure a hex colour string has a leading '#'.
standings_rank(ctx_df, driver_fullname)
    Compute championship standing rank for a driver from a context DataFrame.
get_neutral_values()
    Return the midfield-neutral feature values used by get_feature_contributions.
FEATURE_LABELS
    Dict mapping internal feature names to human-readable UI labels.
"""

import numpy as np
import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
# DISPLAY LABELS
# ─────────────────────────────────────────────────────────────────────────────
FEATURE_LABELS: dict = {
    "Recent_Form_3R":  "Weekend Pace (70% Sprint / 30% Season)",
    "GridPosition":    "Grid Position",
    "Car_Rank":        "Car Performance Rank (1 = Best)",
    "Circuit_Encoded": "Circuit Character",
    "Upgrade_Impact":  "Miami Upgrade Package (capped 5%)",
    "Overtake_Index":  "Recovery Potential (Grid vs Car Quality)",
    "Standings_Pos":   "Championship Standing (1 = Leader)",
}


# ─────────────────────────────────────────────────────────────────────────────
# ENCODER HELPER
# ─────────────────────────────────────────────────────────────────────────────
def safe_encode(enc, val: str, fallback: int = 0) -> int:
    """
    Encode a categorical string value through a fitted LabelEncoder.

    Returns fallback (default 0) if val is not in the encoder's known classes,
    preventing ValueError crashes on unseen circuits or drivers.
    """
    try:
        return int(enc.transform([val])[0])
    except (ValueError, TypeError):
        return fallback


# ─────────────────────────────────────────────────────────────────────────────
# COLOUR NORMALISATION
# ─────────────────────────────────────────────────────────────────────────────
def normalise_color(raw) -> str:
    """
    Ensure a team colour value is a valid CSS hex string.

    The raw CSV value may be a bare 6-digit hex (e.g. 'E8002D') or already
    '#E8002D'. Falls back to '#AAAAAA' if the value is null or empty.
    """
    if not raw or pd.isna(raw):
        return "#AAAAAA"
    s = str(raw).strip()
    return s if s.startswith("#") else f"#{s}"


# ─────────────────────────────────────────────────────────────────────────────
# STANDINGS RANK
# ─────────────────────────────────────────────────────────────────────────────
def standings_rank(ctx_df: pd.DataFrame, driver_fullname: str) -> float:
    """
    Return the championship standing rank (1 = leader) for a driver.

    Computed on-the-fly from the SeasonPoints column in ctx_df.
    Returns 10.0 (midfield) if the driver is not found.

    Parameters
    ----------
    ctx_df : pd.DataFrame
        Driver context table with columns 'FullName' and 'SeasonPoints'.
    driver_fullname : str
        The driver's full name as it appears in ctx_df.
    """
    pts = ctx_df.set_index("FullName")["SeasonPoints"]
    ranked = pts.rank(ascending=False, method="min")
    return float(ranked.get(driver_fullname, 10.0))


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE CONTRIBUTION NEUTRALS
# ─────────────────────────────────────────────────────────────────────────────
def get_neutral_values() -> dict:
    """
    Return midfield-neutral values for each feature used in get_feature_contributions.

    When a feature is perturbed to its 'neutral' value, the probability delta
    reveals how much that feature contributed to the baseline prediction.
    Values represent a hypothetical midfield driver who is unremarkable in every way.
    """
    return {
        "Recent_Form_3R":  10.0,   # midfield average finish
        "GridPosition":    11.0,   # midfield start
        "Car_Rank":         5.0,   # mid-pack car
        "Circuit_Encoded":  0.0,   # first circuit in encoded list
        "Upgrade_Impact":   0.0,   # no upgrade
        "Overtake_Index":   0.0,   # car quality matches grid position
        "Standings_Pos":   10.0,   # midfield in championship
    }


# ─────────────────────────────────────────────────────────────────────────────
# TRACK TYPE CLASSIFIER
# ─────────────────────────────────────────────────────────────────────────────
_STREET_CIRCUITS = frozenset({
    "Monaco Grand Prix",
    "Singapore Grand Prix",
    "Miami Grand Prix",
    "Azerbaijan Grand Prix",
    "Las Vegas Grand Prix",
    "Saudi Arabian Grand Prix",
})

def track_type(grand_prix: str) -> str:
    """
    Return 'Street' for known street circuits, 'Permanent' otherwise.

    Used to set race_context['track_type'] in the simulation.
    """
    return "Street" if grand_prix in _STREET_CIRCUITS else "Permanent"
