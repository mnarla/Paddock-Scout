import { FEATURE_LABELS, type Prediction } from "@/lib/prediction";
import type { FeatureWeightsData } from "@/lib/useFeatureWeights";

interface Props {
  prediction: Prediction;
  featureWeights: FeatureWeightsData;
}

export function FeatureContribution({ prediction, featureWeights }: Props) {
  const { weights, unavailableFeatures, liveSessionFeatures, isLoading } = featureWeights;

  // Build a map of driver values from the local prediction (for bar opacity).
  const valueMap: Record<string, number> = {};
  for (const c of (prediction?.contributions || [])) {
    valueMap[c.key] = c.value;
  }

  // Pre-race detection: true if any live session feature is unavailable
  const isPreRace = unavailableFeatures.size > 0;

  // Collect available entries from the API weights.
  // In pre-race mode, unconditionally exclude any key in unavailableFeatures or liveSessionFeatures
  // (Practice, Qualifying, Momentum) so they never leak into the pre-race breakdown.
  const availableEntries = Object.entries(weights).filter(([key]) => {
    if (unavailableFeatures.has(key)) return false;
    if (isPreRace && liveSessionFeatures.has(key)) return false;
    return true;
  });

  // Re-normalize so the displayed rows always sum to exactly 1.0 (100%).
  const availableTotal = availableEntries.reduce((sum, [, w]) => sum + w, 0);
  const normalizedEntries = availableEntries.map(([key, w]) => ({
    key,
    weight: availableTotal > 0 ? w / availableTotal : 0,
    value: Math.min(1, Math.max(0, valueMap[key] ?? 0.5)),
  }));

  // Sort descending by weight so most important feature is at the top.
  normalizedEntries.sort((a, b) => b.weight - a.weight);

  const maxWeight = Math.max(...normalizedEntries.map((e) => e.weight), 0.001);



  return (
    <section className="rounded-lg border border-hairline bg-card">
      <div className="flex items-baseline justify-between border-b border-hairline px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            How the AI decided
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
            {isPreRace
              ? "Pre-race form weighting — live session data unavailable"
              : "Calibrated v6 — Grid dictatorship dismantled"}
          </p>
        </div>
        <span className="tabular text-[11px] font-bold text-muted-foreground">
          {isLoading ? "—" : "Σ 100.0%"}
        </span>
      </div>

      {isPreRace && (
        <div className="mx-4 mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400">
          Live session data unavailable — showing pre-race form weighting only.
          Weights will update automatically once practice or qualifying data is ingested.
        </div>
      )}

      <div className="space-y-2.5 px-4 py-4">
        {isLoading ? (
          // Skeleton rows while weights are fetching
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
              <div className="h-2.5 w-20 animate-pulse rounded bg-secondary" />
              <div className="h-2 animate-pulse rounded-sm bg-secondary" />
              <div className="h-2.5 w-10 animate-pulse rounded bg-secondary" />
            </div>
          ))
        ) : (
          normalizedEntries.map((entry) => {
            const barPct = (entry.weight / maxWeight) * 100;
            return (
              <div key={entry.key} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {FEATURE_LABELS[entry.key] ?? entry.key}
                </span>
                <div className="relative h-2 overflow-hidden rounded-sm bg-secondary">
                  <div
                    key={`${entry.key}-${barPct.toFixed(1)}`}
                    className="bar-fill h-full bg-gradient-to-r from-f1-red/80 to-f1-red"
                    style={{ width: `${barPct}%`, opacity: 0.3 + 0.7 * entry.value }}
                  />
                </div>
                <span className="tabular w-10 text-right text-[11px] font-bold text-foreground">
                  {(entry.weight * 100).toFixed(1)}%
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Race-day uncertainty note — kept separate from the weights so the numbers stay honest */}
      {!isLoading && (
        <p className="border-t border-hairline px-4 pb-3 pt-2.5 text-[10px] text-muted-foreground/60">
          * Weights reflect relative model influence. Residual uncertainty accounts for
          race-day chaos, safety cars, weather, and mechanical reliability.
        </p>
      )}
    </section>
  );
}

