import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import type { Prediction } from "@/lib/prediction";

interface Props {
  driver: Driver;
  prediction: Prediction;
  baseline: Prediction;
}

export function SelectedDriverCard({ driver, prediction, baseline }: Props) {
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
      </div>

      <div className="border-t border-hairline" />

      {/* Big probability cards */}
      <div className="grid grid-cols-3">
        <ProbCell
          label="P1"
          value={prediction.p1}
          baseline={baseline.p1}
          accent="var(--color-f1-red)"
        />
        <ProbCell
          label="P2"
          value={prediction.p2}
          baseline={baseline.p2}
          accent="#c0c0c8"
        />
        <ProbCell
          label="P3"
          value={prediction.p3}
          baseline={baseline.p3}
          accent="#cd7f32"
          last
        />
      </div>
    </section>
  );
}

function ProbCell({
  label,
  value,
  baseline,
  accent,
  last,
}: {
  label: string;
  value: number;
  baseline: number;
  accent: string;
  last?: boolean;
}) {
  const delta = Math.round((value - baseline) * 100);
  const deltaTone =
    delta > 0 ? "text-f1-green" : delta < 0 ? "text-f1-red" : "text-muted-foreground";
  return (
    <div
      className={`relative px-5 py-5 ${last ? "" : "border-r border-hairline"}`}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="text-[11px] font-black tracking-[0.2em]"
          style={{ color: accent }}
        >
          {label}
        </span>
        <span className={`tabular text-[11px] font-bold ${deltaTone}`}>
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          key={value}
          className="tabular text-4xl font-black leading-none tracking-tight sm:text-5xl"
        >
          {Math.round(value * 100)}
        </span>
        <span className="text-base font-bold text-muted-foreground">%</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="bar-fill h-full"
          style={{ width: `${Math.round(value * 100)}%`, background: accent }}
        />
      </div>
    </div>
  );
}
