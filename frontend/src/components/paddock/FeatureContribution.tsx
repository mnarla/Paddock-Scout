import { useMemo } from "react";
import { FEATURE_LABELS, type Prediction } from "@/lib/prediction";
import type { FeatureWeightsData } from "@/lib/useFeatureWeights";

interface Props {
  prediction?: Prediction | null;
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
    isLoading: isWeightsLoading,
  } = featureWeights;

  // Build a map of driver values from the local prediction.
  const valueMap: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of prediction?.contributions || []) {
      map[c.key] = c.value ?? 1.0;
    }
    return map;
  }, [prediction?.contributions]);

  // Check which session tiers are active
  const hasPractice = !unavailableFeatures.has("Practice");
  const hasQualifying = !unavailableFeatures.has("Qualifying");

  const stage =
    sessionStage ??
    (!hasPractice && !hasQualifying
      ? "pre_weekend"
      : hasPractice && !hasQualifying
      ? "friday_practice"
      : "fully_ingested");

  const subheader =
    apiSubheader ??
    (stage === "pre_weekend"
      ? isSprint
        ? "Pre-race form weighting — awaiting FP1 & Sprint Qualifying"
        : "Pre-race form weighting — awaiting FP1 & FP2"
      : stage === "friday_practice"
      ? isSprint
        ? "Friday session pace active — awaiting Sprint & qualifying"
        : "Friday practice pace active — awaiting FP3 & qualifying"
      : "Pre-race session data fully ingested");

  const statusMessage =
    apiStatusMessage ??
    (stage === "pre_weekend"
      ? isSprint
        ? "Live session data unavailable — showing pre-race form weighting only. Awaiting Friday FP1, Sprint Qualifying, and Saturday Sprint data."
        : "Live session data unavailable — showing pre-race form weighting only. Awaiting Friday practice (FP1 & FP2) and Saturday qualifying data."
      : stage === "friday_practice"
      ? isSprint
        ? "Friday session data active (FP1 & Sprint Qualifying) — Saturday Sprint and Grand Prix qualifying data are currently being awaited."
        : "Friday Practice 1 & 2 data active — Saturday practice (FP3) and qualifying data are currently being awaited."
      : isSprint
      ? "Pre-race session data is fully ingested (FP1, Sprint & Qualifying). Live sprint results and starting grid are actively driving predictions."
      : "Pre-race session data is fully ingested (FP1–FP3 & Qualifying). Live grid positions and weekend momentum are actively driving predictions.");

  // If driver-specific contributions exist on the prediction object, use them!
  // Otherwise fall back to the model's global baseline weights.
  const rawEntries: { key: string; weight: number; value: number }[] = useMemo(() => {
    if (prediction?.contributions && prediction.contributions.length > 0) {
      return prediction.contributions
        .filter((c) => (c.weight ?? 0) > 0.0005 && !unavailableFeatures.has(c.key))
        .map((c) => ({
          key: c.key,
          weight: c.weight ?? 0,
          value: c.value ?? 1.0,
        }));
    }

    return Object.entries(weights)
      .filter(([key, w]) => !unavailableFeatures.has(key) && w > 0.0005)
      .map(([key, w]) => ({
        key,
        weight: w,
        value: valueMap[key] ?? 0.5,
      }));
  }, [prediction?.contributions, weights, unavailableFeatures, valueMap]);

  // Re-normalize so the displayed rows always sum to exactly 1.0 (100.0%).
  const availableTotal = rawEntries.reduce((sum, e) => sum + e.weight, 0);
  const normalizedEntries = useMemo(() => {
    const list = rawEntries.map((e) => ({
      key: e.key,
      weight: availableTotal > 0 ? e.weight / availableTotal : 0,
      value: Math.min(1, Math.max(0, e.value)),
    }));
    // Sort descending by weight so the most influential feature for this driver is at the top.
    list.sort((a, b) => b.weight - a.weight);
    return list;
  }, [rawEntries, availableTotal]);

  const maxWeight = Math.max(...normalizedEntries.map((e) => e.weight), 0.001);

  return (
    <section className="rounded-lg border border-hairline bg-card">
      <div className="flex items-baseline justify-between border-b border-hairline px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            How the AI decided
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">{subheader}</p>
        </div>
        <span className="tabular text-[11px] font-bold text-muted-foreground">
          {isWeightsLoading ? "—" : "Σ 100.0%"}
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
        {isWeightsLoading ? (
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
                    className="h-full bg-gradient-to-r from-f1-red/80 to-f1-red transition-all duration-500 ease-out"
                    style={{ width: `${barPct}%` }}
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

      {/* Race-day uncertainty note */}
      {!isWeightsLoading && (
        <p className="border-t border-hairline px-4 pb-3 pt-2.5 text-[10px] text-muted-foreground/60">
          * Feature influences reflect the model&apos;s decision breakdown for this driver. Residual uncertainty accounts for race-day chaos, safety cars, weather, and mechanical reliability.
        </p>
      )}
    </section>
  );
}
