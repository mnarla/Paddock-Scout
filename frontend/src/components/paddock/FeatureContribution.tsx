import { useMemo } from "react";
import { FEATURE_LABELS, type Prediction } from "@/lib/prediction";
import type { FeatureWeightsData } from "@/lib/useFeatureWeights";
import { Clock, Gauge, CheckCircle2, Info } from "lucide-react";

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
    <div className="space-y-3 pt-1">
      {/* Telemetry Stage Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        <div>
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
            Model Feature Weights
          </div>
          <div className="text-[9px] text-slate-500 font-sans">{subheader}</div>
        </div>
        <span className="font-mono text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
          {isWeightsLoading ? "..." : "Σ 100.0%"}
        </span>
      </div>

      {/* Session Stage Status Banner with SVG Icons */}
      {stage === "pre_weekend" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-300/90 font-mono">
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span className="leading-snug">{statusMessage}</span>
        </div>
      )}

      {stage === "friday_practice" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-[10px] text-sky-300/90 font-mono">
          <Gauge className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
          <span className="leading-snug">{statusMessage}</span>
        </div>
      )}

      {stage === "fully_ingested" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-300/90 font-mono">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <span className="leading-snug">{statusMessage}</span>
        </div>
      )}

      {/* Feature Progress Bars */}
      <div className="space-y-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
        {isWeightsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr_45px] items-center gap-3">
              <div className="h-2 w-20 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-1.5 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-2 w-8 animate-pulse rounded bg-white/[0.05]" />
            </div>
          ))
        ) : (
          normalizedEntries.map((entry) => {
            const barPct = (entry.weight / maxWeight) * 100;
            return (
              <div key={entry.key} className="grid grid-cols-[115px_1fr_45px] items-center gap-2.5">
                <span className="text-[10px] font-mono text-slate-300 truncate">
                  {FEATURE_LABELS[entry.key] ?? entry.key}
                </span>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500/80 to-rose-400 transition-all duration-300 ease-out"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="font-mono text-right text-[10px] font-bold text-white tabular">
                  {(entry.weight * 100).toFixed(1)}%
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Uncertainty Note */}
      {!isWeightsLoading && (
        <div className="flex items-start gap-1.5 px-1 text-[9px] font-mono text-slate-500">
          <Info className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
          <span>
            Feature influences reflect the model&apos;s decision breakdown for this driver. Residual uncertainty accounts for race-day chaos, safety cars, weather, and mechanical reliability.
          </span>
        </div>
      )}
    </div>
  );
}
