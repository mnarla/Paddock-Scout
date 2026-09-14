import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import type { FeatureWeightsData } from "@/lib/useFeatureWeights";
import { ChevronRight, Radio, Activity, Sparkles } from "lucide-react";

interface Props {
  drivers: Driver[];
  onSelectDriver: (driverId: string) => void;
  featureWeights?: FeatureWeightsData;
}

export function DriverEmptyState({ drivers, onSelectDriver, featureWeights }: Props) {
  return (
    <div className="space-y-4">
      {/* Paddock Telemetry Command Header */}
      <section className="rounded-lg border border-hairline bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded border border-f1-red/30 bg-f1-red/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-f1-red">
              <Radio className="h-3 w-3 animate-pulse text-f1-red" />
              Paddock Timing Board
            </span>
            <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-hairline">
              2026 Grid · 22 Drivers
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-f1-green" />
              <span>Calibrated Ensemble v6</span>
            </span>
            <span>·</span>
            <span className="tabular font-mono">
              Grid α:{" "}
              {featureWeights?.isLoading
                ? "—"
                : `${((featureWeights?.weights["Grid"] ?? 0) * 100).toFixed(1)}%`}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Select a Driver to Inspect Telemetry & What-If Forecasts
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Engage the model by clicking any driver on the grid below. You can simulate starting
            positions, review empirical feature weights, and inspect calibrated Win, Top 2, and
            Podium probabilities.
          </p>
        </div>
      </section>

      {/* Driver Selection Grid */}
      <section className="rounded-lg border border-hairline bg-card p-4 sm:p-5">
        <div className="mb-3.5 flex items-center justify-between border-b border-hairline/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Official 2026 Entry List
            </span>
            <span className="tabular rounded bg-secondary/80 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
              Ordered by Championship Standing
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
            Click driver card to load telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {drivers.map((d) => {
            const team = TEAMS[d.team];
            const teamColor = team?.color ?? "#888888";

            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDriver(d.id)}
                className="group relative flex items-center justify-between overflow-hidden rounded-md border border-hairline bg-secondary/25 p-3 text-left transition-colors duration-150 hover:border-foreground/30 hover:bg-secondary/60 focus:outline-none focus:ring-1 focus:ring-f1-red cursor-pointer"
              >
                {/* Team color accent strip */}
                <div
                  className="absolute bottom-0 left-0 top-0 w-1 transition-all duration-150 group-hover:w-1.5"
                  style={{ backgroundColor: teamColor }}
                />

                <div className="ml-2 flex items-center gap-3 min-w-0">
                  {/* Driver Number Badge */}
                  <span
                    className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-black font-mono border"
                    style={{
                      backgroundColor: `${teamColor}18`,
                      borderColor: `${teamColor}44`,
                      color: teamColor,
                    }}
                  >
                    #{d.number}
                  </span>

                  {/* Driver Name & Constructor */}
                  <div className="truncate min-w-0">
                    <p className="truncate text-xs text-foreground group-hover:text-f1-red transition-colors">
                      <span className="font-medium text-foreground/80">{d.first} </span>
                      <span className="font-black uppercase tracking-tight">{d.last}</span>
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                      <span className="font-semibold" style={{ color: teamColor }}>
                        {team?.short ?? d.team}
                      </span>
                      <span>·</span>
                      <span className="truncate">{team?.name ?? d.team}</span>
                    </div>
                  </div>
                </div>

                {/* Performance & Standings Badges */}
                <div className="flex shrink-0 items-center gap-2.5 pl-2 text-right">
                  <div className="text-[10px]">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Rank
                      </span>
                      <span className="tabular font-black text-foreground">P{d.standingsRank}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[9px] text-muted-foreground/80">Pts</span>
                      <span className="tabular font-mono text-[10px] font-semibold text-muted-foreground">
                        {d.seasonPoints}
                      </span>
                    </div>
                  </div>

                  <div className="flex h-6 w-6 items-center justify-center rounded bg-secondary text-muted-foreground/50 transition-colors group-hover:bg-foreground/10 group-hover:text-foreground">
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
