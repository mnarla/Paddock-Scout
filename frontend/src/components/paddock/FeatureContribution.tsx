import { FEATURE_LABELS, type Prediction } from "@/lib/prediction";
import type { FeatureWeightsData } from "@/lib/useFeatureWeights";

interface Props {
  prediction: Prediction;
  featureWeights: FeatureWeightsData;
}

export function FeatureContribution({ prediction, featureWeights }: Props) {
  const {
    weights,
    unavailableFeatures,
    sessionStage,
    subheader: apiSubheader,
    statusMessage: apiStatusMessage,
    isSprint,
    isLoading
  } = featureWeights;

  // Build a map of driver values from the local prediction (for bar opacity).
  const valueMap: Record<string, number> = {};
  for (const c of (prediction?.contributions || [])) {
    valueMap[c.key] = c.value;
  }

  // Check which session tiers are active
  const hasPractice = !unavailableFeatures.has("Practice");
  const hasQualifying = !unavailableFeatures.has("Qualifying");

  const stage = sessionStage ?? (
    !hasPractice && !hasQualifying
      ? "pre_weekend"
      : hasPractice && !hasQualifying
      ? "friday_practice"
      : "fully_ingested"
  );

  const subheader = apiSubheader ?? (
    stage === "pre_weekend"
      ? (isSprint ? "Pre-race form weighting — awaiting FP1 & Sprint Qualifying" : "Pre-race form weighting — awaiting FP1 & FP2")
      : stage === "friday_practice"
      ? (isSprint ? "Friday session pace active — awaiting Sprint & qualifying" : "Friday practice pace active — awaiting FP3 & qualifying")
      : "Pre-race session data fully ingested"
  );

  const statusMessage = apiStatusMessage ?? (
    stage === "pre_weekend"
      ? (isSprint ? "Live session data unavailable — showing pre-race form weighting only. Awaiting Friday FP1, Sprint Qualifying, and Saturday Sprint data." : "Live session data unavailable — showing pre-race form weighting only. Awaiting Friday practice (FP1 & FP2) and Saturday qualifying data.")
      : stage === "friday_practice"
      ? (isSprint ? "Friday session data active (FP1 & Sprint Qualifying) — Saturday Sprint and Grand Prix qualifying data are currently being awaited." : "Friday Practice 1 & 2 data active — Saturday practice (FP3) and qualifying data are currently being awaited.")
      : (isSprint ? "Pre-race session data is fully ingested (FP1, Sprint & Qualifying). Live sprint results and starting grid are actively driving predictions." : "Pre-race session data is fully ingested (FP1–FP3 & Qualifying). Live grid positions and weekend momentum are actively driving predictions.")
  );

  // Exclude any feature that is marked unavailable by the backend API
  const availableEntries = Object.entries(weights).filter(([key]) => {
    if (unavailableFeatures.has(key)) return false;
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
            {subheader}
          </p>
        </div>
        <span className="tabular text-[11px] font-bold text-muted-foreground">
          {isLoading ? "—" : "Σ 100.0%"}
        </span>
      </div>

      {stage === "pre_weekend" && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400">
          <span className="shrink-0 text-xs">⏳</span>
          <span>{statusMessage}</span>
        </div>
      )}

      {stage === "friday_practice" && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-400">
          <span className="shrink-0 text-xs">🏎️</span>
          <span>{statusMessage}</span>
        </div>
      )}

      {stage === "fully_ingested" && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400">
          <span className="shrink-0 text-xs">✅</span>
          <span>{statusMessage}</span>
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

