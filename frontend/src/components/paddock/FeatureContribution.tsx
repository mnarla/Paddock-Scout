import { FEATURE_LABELS, type Prediction } from "@/lib/prediction";

interface Props {
  prediction: Prediction;
}

export function FeatureContribution({ prediction }: Props) {
  const maxContrib = Math.max(
    ...prediction.contributions.map((c) => c.weight * c.value),
    0.001
  );
  const totalWeight = prediction.contributions.reduce((acc, c) => acc + c.weight, 0);

  return (
    <section className="rounded-lg border border-hairline bg-card">
      <div className="flex items-baseline justify-between border-b border-hairline px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            How the AI decided
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
            Calibrated v6 — Grid dictatorship dismantled
          </p>
        </div>
        <span className="tabular text-[11px] font-bold text-muted-foreground">
          Σ {(totalWeight * 100).toFixed(1)}%
        </span>
      </div>

      <div className="space-y-2.5 px-4 py-4">
        {prediction.contributions.map((c) => {
          const contrib = c.weight * c.value;
          const barPct = (contrib / maxContrib) * 100;
          return (
            <div key={c.key} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
              <span className="text-[11px] font-medium text-muted-foreground">
                {FEATURE_LABELS[c.key]}
              </span>
              <div className="relative h-2 overflow-hidden rounded-sm bg-secondary">
                <div
                  key={`${c.key}-${barPct.toFixed(1)}`}
                  className="bar-fill h-full bg-gradient-to-r from-f1-red/80 to-f1-red"
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <span className="tabular w-10 text-right text-[11px] font-bold text-foreground">
                {(c.weight * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
