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
    """Ensure a team colour value is a valid CSS hex string."""
    return f"#{str(raw).lstrip('#')}" if raw and pd.notna(raw) else "#AAAAAA"


# ─────────────────────────────────────────────────────────────────────────────
# DRIVER NAMES MAPPING
# ─────────────────────────────────────────────────────────────────────────────
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
    "bearman": "Oliver Bearman",
    "stroll": "Lance Stroll",
    "hadjar": "Isack Hadjar",
}


# ─────────────────────────────────────────────────────────────────────────────
# STANDINGS RANK
# ─────────────────────────────────────────────────────────────────────────────
def standings_rank(ctx_df: pd.DataFrame, driver_fullname: str) -> float:
    """Return the championship standing rank (1 = leader) for a driver."""
    pts = ctx_df.set_index("FullName")["SeasonPoints"]
    ranked = pts.rank(ascending=False, method="min")
    return float(ranked.get(driver_fullname, 10.0))


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE CONTRIBUTION NEUTRALS
# ─────────────────────────────────────────────────────────────────────────────
def get_neutral_values() -> dict:
    """Return midfield-neutral values for each feature used in get_feature_contributions."""
    return {
        "Recent_Form_3R":  10.0,   # midfield average finish
        "GridPosition":    11.0,   # midfield start
        "Car_Rank":         5.0,   # mid-pack car
        "Circuit_Encoded":  0.0,   # first circuit in encoded list
        "Upgrade_Impact":   0.0,   # no upgrade
        "Overtake_Index":   0.0,   # car quality matches grid position
        "Standings_Pos":   10.0,   # midfield in championship
    }

