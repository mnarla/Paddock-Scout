import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import type { Prediction } from "@/lib/prediction";

interface Props {
  driver: Driver;
  prediction?: Prediction | null;
  baseline?: Prediction | null;
  isPredicting?: boolean;
  onHome?: () => void;
}

export function SelectedDriverCard({ driver, prediction, baseline, isPredicting = false, onHome }: Props) {
  const team = TEAMS[driver.team];

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-card">
      {/* Driver header strip */}
      <div className="relative flex items-center gap-4 px-5 py-4">
        <div
          className="absolute left-0 top-0 h-full w-1.5"
          style={{ background: team.color }}
        />
        <div
          className="tabular grid h-14 w-14 shrink-0 place-items-center rounded text-2xl font-black text-foreground"
          style={{
            background: `linear-gradient(135deg, ${team.color}26, ${team.color}08)`,
            border: `1px solid ${team.color}55`,
          }}
        >
          {driver.number}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Selected driver
          </p>
          <h2 className="truncate text-xl font-black tracking-tight sm:text-2xl">
            {driver.first.toUpperCase()}{" "}
            <span className="text-foreground">{driver.last.toUpperCase()}</span>
          </h2>
          <p
            className="truncate text-[11px] font-bold uppercase tracking-wider"
            style={{ color: team.color }}
          >
            {team.name}
          </p>
        </div>
        {onHome && (
          <button
            type="button"
            onClick={onHome}
            className="flex shrink-0 items-center gap-1.5 rounded border border-hairline bg-secondary/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition hover:border-f1-red hover:text-foreground"
            title="Return to driver selection"
          >
            <span>←</span> Home
          </button>
        )}
      </div>

      <div className="border-t border-hairline" />

      {/* Cumulative Probability Cards */}
      <div className="grid grid-cols-3">
        <ProbCell
          label="WIN (P1)"
          sublabel="1st Place"
          value={prediction?.p1}
          baseline={baseline?.p1}
          accent="var(--color-f1-red)"
          isPredicting={isPredicting}
        />
        <ProbCell
          label="TOP 2"
          sublabel="1st or 2nd"
          value={prediction?.p2}
          baseline={baseline?.p2}
          accent="#c0c0c8"
          isPredicting={isPredicting}
        />
        <ProbCell
          label="PODIUM"
          sublabel="Top 3 Finish"
          value={prediction?.p3}
          baseline={baseline?.p3}
          accent="#cd7f32"
          last
          isPredicting={isPredicting}
        />
      </div>

      <div className="border-t border-hairline bg-secondary/20 px-4 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>* Probabilities represent cumulative milestone thresholds (Win, Top 2, and any Podium step).</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">Cumulative Milestones</span>
      </div>
    </section>
  );
}

function ProbCell({
  label,
  sublabel,
  value,
  baseline,
  accent,
  last,
  isPredicting,
}: {
  label: string;
  sublabel?: string;
  value?: number;
  baseline?: number;
  accent: string;
  last?: boolean;
  isPredicting?: boolean;
}) {
  const isLoading = isPredicting || value == null || baseline == null;
  const numValue = value != null ? value * 100 : 0;
  const delta = (baseline != null && value != null)
    ? Number(((value - baseline) * 100).toFixed(1))
    : 0;

  const showDelta = !isLoading && Math.abs(delta) >= 0.1;
  const deltaTone =
    delta > 0 ? "text-f1-green" : delta < 0 ? "text-f1-red" : "text-muted-foreground";

  return (
    <div
      className={`relative px-5 py-5 ${last ? "" : "border-r border-hairline"}`}
    >
      <div className="flex items-baseline justify-between min-h-[28px]">
        <div>
          <span
            className="text-[11px] font-black tracking-[0.2em] block"
            style={{ color: accent }}
          >
            {label}
          </span>
          {sublabel && (
            <span className="text-[9px] font-medium text-muted-foreground/80 tracking-normal block mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
        {showDelta ? (
          <span className={`tabular text-[11px] font-bold ${deltaTone}`}>
            {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-2 flex items-baseline gap-1 animate-pulse">
          <div className="h-9 w-20 sm:h-11 sm:w-24 rounded bg-secondary/80" />
          <span className="text-base font-bold text-muted-foreground/40">%</span>
        </div>
      ) : (
        <div className="mt-1 flex items-baseline gap-1 transition-opacity duration-300">
          <span
            key={numValue}
            className="tabular text-3xl font-black leading-none tracking-tight sm:text-4xl lg:text-5xl"
          >
            {numValue.toFixed(1)}
          </span>
          <span className="text-base font-bold text-muted-foreground">%</span>
        </div>
      )}

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="bar-fill h-full transition-all duration-500"
          style={{
            width: isLoading ? "0%" : `${Math.min(100, Math.max(0, numValue))}%`,
            background: accent,
          }}
        />
      </div>
    </div>
  );
}
