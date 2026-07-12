"""
F1 Podium Predictor — ML Training Pipeline
============================================
- Training set  : 2023–2026 (all years, 2026 weighted ×20)
- Validation set: 2026 races only
- Target        : Podium (Top 3) — binary 0/1
- Model         : RandomForestClassifier (regularised to avoid name memorisation)
- Features      : see src/features.py
"""

import logging
import os
import pickle
import warnings

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import ConfusionMatrixDisplay, classification_report, confusion_matrix

# All feature logic lives in features.py
import sys
sys.path.insert(0, os.path.dirname(__file__))
from features import FEATURES, TARGET, engineer_features, load_all_results

warnings.filterwarnings("ignore")

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-8s  %(message)s")
log = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
DATA_DIR   = "data"
MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)

MODEL_PATH    = os.path.join(MODELS_DIR, "f1_podium_predictor.pkl")
REPORT_PATH   = os.path.join(MODELS_DIR, "classification_report.txt")
FI_CHART_PATH = os.path.join(MODELS_DIR, "feature_importance.png")
CM_CHART_PATH = os.path.join(MODELS_DIR, "confusion_matrix.png")

# ── Sample weights ───────────────────────────────────────────────────────────
# 2026 regulations completely changed the car/team hierarchy.
# Weight 2026 rows ×100 so the forest almost exclusively learns from them.
# The entire 2023-25 era is kept at ×0.5 as weak structural priors only.
YEAR_WEIGHTS = {2023: 0.5, 2024: 0.5, 2025: 0.5, 2026: 100.0}


# ─────────────────────────────────────────────────────────────────────────────
# SPLIT
# ─────────────────────────────────────────────────────────────────────────────
def split_data(df):
    train_df = df.copy()                      # all years in training
    val_df   = df[df["Year"] == 2026].copy()  # 2026 held out for eval
    n2026    = (train_df["Year"] == 2026).sum()
    log.info(f"Train: {len(train_df):,} rows  |  Val (2026): {len(val_df):,} rows")
    log.info(f"  ↳  2026 rows: {n2026} (×20 weight)  |  2023–25: {len(train_df)-n2026} (×0.5 weight)")
    return train_df, val_df


# ─────────────────────────────────────────────────────────────────────────────
# SAMPLE WEIGHTS
# ─────────────────────────────────────────────────────────────────────────────
def build_sample_weights(train_df):
    weights = train_df["Year"].map(YEAR_WEIGHTS).fillna(0.5).to_numpy()
    unique, counts = np.unique(weights, return_counts=True)
    log.info("Weights → " + ", ".join(f"{w:.1f}×{c}" for w, c in zip(unique, counts)))
    return weights


# ─────────────────────────────────────────────────────────────────────────────
# TRAIN
# ─────────────────────────────────────────────────────────────────────────────
def train_model(X_train, y_train, sample_weights):
    clf = RandomForestClassifier(
        n_estimators=500,
        max_depth=8,
        min_samples_split=6,
        min_samples_leaf=8,        # ← increased to prevent driver-name memorisation
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_train, y_train, sample_weight=sample_weights)
    log.info("Training complete.")
    return clf


# ─────────────────────────────────────────────────────────────────────────────
# EVALUATE
# ─────────────────────────────────────────────────────────────────────────────
def evaluate(clf, X_val, y_val, feature_names):
    y_pred = clf.predict(X_val)
    report = classification_report(y_val, y_pred, target_names=["No Podium", "Podium"])

    print("\n" + "=" * 60)
    print("CLASSIFICATION REPORT  (Validation: 2026 races)")
    print("=" * 60)
    print(report)
    with open(REPORT_PATH, "w") as fh:
        fh.write(report)

    # ── Feature Importance chart ─────────────────────────────────────────────
    importances   = clf.feature_importances_
    indices       = np.argsort(importances)[::-1]
    sorted_names  = [feature_names[i] for i in indices]
    sorted_values = importances[indices]

    team_colors = ["#E8002D", "#FF8000", "#00D2BE", "#1E3160", "#9B59B6", "#AAAAAA"]
    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.barh(sorted_names[::-1], sorted_values[::-1],
                   color=team_colors[:len(sorted_names)])
    ax.set_xlabel("Relative Importance", fontsize=12)
    ax.set_title("🏎️  Feature Importance — F1 Podium Predictor (2026 Regulations)",
                 fontsize=13, fontweight="bold")
    ax.xaxis.set_major_formatter(mticker.PercentFormatter(xmax=1))
    for bar, val in zip(bars, sorted_values[::-1]):
        ax.text(val + 0.003, bar.get_y() + bar.get_height() / 2,
                f"{val:.1%}", va="center", fontsize=10)
    ax.set_xlim(0, max(sorted_values) * 1.30)
    plt.tight_layout()
    fig.savefig(FI_CHART_PATH, dpi=150)
    plt.close(fig)
    log.info(f"Feature importance chart → {FI_CHART_PATH}")

    # ── Confusion matrix ─────────────────────────────────────────────────────
    cm = confusion_matrix(y_val, y_pred)
    fig2, ax2 = plt.subplots(figsize=(6, 5))
    ConfusionMatrixDisplay(cm, display_labels=["No Podium", "Podium"]).plot(
        ax=ax2, cmap="Reds", colorbar=False
    )
    ax2.set_title("Confusion Matrix — 2026 Validation", fontsize=13, fontweight="bold")
    plt.tight_layout()
    fig2.savefig(CM_CHART_PATH, dpi=150)
    plt.close(fig2)
    log.info(f"Confusion matrix → {CM_CHART_PATH}")


# ─────────────────────────────────────────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────────────────────────────────────────
def save_model(clf, circuit_enc, grid_scaler):
    """Persist model + encoders. Only circuit_enc is needed for inference."""
    payload = {
        "model":       clf,
        "circuit_enc": circuit_enc,
        "grid_scaler": grid_scaler,
        "features":    FEATURES,
    }
    with open(MODEL_PATH, "wb") as fh:
        pickle.dump(payload, fh)
    log.info(f"Model saved → {MODEL_PATH}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    log.info("Loading results …")
    raw = load_all_results(DATA_DIR)

    log.info("Engineering features (Car_Rank instead of Team/Driver encoded) …")
    df, circuit_enc = engineer_features(raw)

    # Normalize GridPosition to reduce its dominance (Coefficient Calibration)
    from sklearn.preprocessing import StandardScaler
    grid_scaler = StandardScaler()
    df["GridPosition"] = grid_scaler.fit_transform(df[["GridPosition"]])

    train_df, val_df = split_data(df)

    X_train = train_df[FEATURES].to_numpy()
    y_train = train_df[TARGET].to_numpy()
    X_val   = val_df[FEATURES].to_numpy()
    y_val   = val_df[TARGET].to_numpy()

    weights = build_sample_weights(train_df)

    log.info("Training RandomForestClassifier (regularised) …")
    clf = train_model(X_train, y_train, weights)

    log.info("Evaluating on 2026 validation set …")
    evaluate(clf, X_val, y_val, FEATURES)

    log.info("Saving artefacts …")
    save_model(clf, circuit_enc, grid_scaler)
    log.info("✅  Done!")


if __name__ == "__main__":
    main()
