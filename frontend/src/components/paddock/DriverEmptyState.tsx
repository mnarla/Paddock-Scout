import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import type { FeatureWeightsData } from "@/lib/useFeatureWeights";
import { Trophy, Zap, Sliders, ChevronRight } from "lucide-react";

interface Props {
  drivers: Driver[];
  onSelectDriver: (driverId: string) => void;
  featureWeights?: FeatureWeightsData;
}

export function DriverEmptyState({ drivers, onSelectDriver }: Props) {
  return (
    <div className="space-y-4">
      {/* Hero Welcome Card */}
      <section className="relative overflow-hidden rounded-lg border border-hairline bg-card p-5 sm:p-6">
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-f1-red/5 blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-f1-red/30 bg-f1-red/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-f1-red">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-f1-red" />
              Model Ready
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              2026 Season Forecast
            </span>
          </div>

          <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Select a Driver to Analyze
          </h2>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Choose a driver from the grid below or the What-If panel to inspect calibrated Win, Top 2, and Podium probabilities, weekend telemetry breakdown, and custom what-if scenarios.
          </p>

          {/* Quick value badges */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded border border-hairline/70 bg-secondary/40 px-3 py-2">
              <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
              <div className="text-[11px]">
                <p className="font-semibold text-foreground">Podium Forecast</p>
                <p className="text-[10px] text-muted-foreground">Win, Top 2 & P3 odds</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded border border-hairline/70 bg-secondary/40 px-3 py-2">
              <Zap className="h-4 w-4 shrink-0 text-f1-red" />
              <div className="text-[11px]">
                <p className="font-semibold text-foreground">Live Telemetry</p>
                <p className="text-[10px] text-muted-foreground">Session pace & momentum</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded border border-hairline/70 bg-secondary/40 px-3 py-2">
              <Sliders className="h-4 w-4 shrink-0 text-sky-400" />
              <div className="text-[11px]">
                <p className="font-semibold text-foreground">What-If Scenarios</p>
                <p className="text-[10px] text-muted-foreground">Adjust grid & form</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Driver Selection Grid */}
      <section className="rounded-lg border border-hairline bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Quick Driver Selection
          </p>
          <span className="text-[10px] text-muted-foreground/60">
            Click any driver to load
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {drivers.map((d) => {
            const team = TEAMS[d.team];
            const teamColor = team?.color ?? "#888888";
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDriver(d.id)}
                className="group relative flex items-center justify-between overflow-hidden rounded-md border border-hairline bg-secondary/30 p-2.5 text-left transition hover:border-foreground/30 hover:bg-secondary/70 focus:outline-none focus:ring-1 focus:ring-f1-red"
              >
                {/* Team color accent bar */}
                <div
                  className="absolute bottom-0 left-0 top-0 w-1 transition-all group-hover:w-1.5"
                  style={{ backgroundColor: teamColor }}
                />

                <div className="ml-2 flex items-center gap-2.5 min-w-0">
                  <span
                    className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-black"
                    style={{
                      backgroundColor: `${teamColor}22`,
                      color: teamColor,
                    }}
                  >
                    #{d.number}
                  </span>
                  <div className="truncate">
                    <p className="truncate text-xs font-bold text-foreground group-hover:text-f1-red transition-colors">
                      {d.first} {d.last}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {team?.name ?? d.team}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 pl-2 text-right">
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">P</span>
                    <span className="tabular font-bold text-foreground">{d.standingsRank}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
