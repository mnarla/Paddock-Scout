// Probability scores come from fetch('/api/predict'); feature weights from '/api/feature-weights'.
// Authoritative feature importances live in models/f1_podium_predictor.pkl.

// Display labels for each contribution key (pure UI strings).
// Keys match what /api/feature-weights returns.
export const FEATURE_LABELS: Record<string, string> = {
  Grid: "Grid Position",
  Standings: "Standings Rank",
  CarRank: "Car Rank",
  Track: "Track Type",
  RecentForm: "Recent Form",
  Practice: "Practice Pace",
  Qualifying: "Qualifying Dominance",
  Momentum: "Weekend Momentum",
  Upgrades: "Vehicle Upgrades",
  Overtake: "Overtake Index",
};

export interface Prediction {
  p1: number;
  p2: number;
  p3: number;
  podium: number; // P1+P2+P3
  // weight = driver-specific relative importance of this feature in the model's decision
  // value = driver score on this feature (0..1), used for bar opacity/visuals
  contributions: { key: string; weight?: number; value: number }[];
}
