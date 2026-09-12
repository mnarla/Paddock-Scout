/**
 * useFeatureWeights — fetches the real RF model feature importances from the backend.
 *
 * Returns:
 *   weights            — map of frontend key → normalized importance (all keys present, sum = 1.0)
 *   liveSessionFeatures — set of keys that require live session data (Practice, Qualifying, Momentum)
 *   isLoading          — true while the first fetch is in flight
 *   error              — true if the fetch failed; caller should fall back gracefully
 */

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";

export interface FeatureWeightsData {
  weights: Record<string, number>;
  liveSessionFeatures: Set<string>;
  isLoading: boolean;
  error: boolean;
}

const EMPTY: FeatureWeightsData = {
  weights: {},
  liveSessionFeatures: new Set(["Practice", "Qualifying", "Momentum"]),
  isLoading: true,
  error: false,
};

export function useFeatureWeights(): FeatureWeightsData {
  const [state, setState] = useState<FeatureWeightsData>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE_URL}/api/feature-weights`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { weights: Record<string, number>; liveSessionFeatures: string[] }) => {
        if (cancelled) return;

        const weights = data.weights ?? {};
        const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);

        // Client-side sanity check — mirrors the server-side assertion.
        if (Object.keys(weights).length > 0 && Math.abs(weightSum - 1.0) > 1e-3) {
          console.warn(
            `[useFeatureWeights] Server returned weights summing to ${weightSum.toFixed(4)}, expected 1.0`
          );
        }

        setState({
          weights,
          liveSessionFeatures: new Set(data.liveSessionFeatures ?? ["Practice", "Qualifying", "Momentum"]),
          isLoading: false,
          error: false,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[useFeatureWeights] Failed to fetch feature weights:", err);
        setState({
          weights: {},
          liveSessionFeatures: new Set(["Practice", "Qualifying", "Momentum"]),
          isLoading: false,
          error: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []); // fetch once — weights are static until model is retrained

  return state;
}
