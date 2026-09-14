import { useMemo } from "react";
import { UPGRADES, type Upgrade } from "@/data/upgrades";
import { TEAMS } from "@/data/teams";
import { Wrench, CheckCircle, AlertTriangle, Clock, ArrowDownRight, ArrowUpRight, ShieldCheck } from "lucide-react";

export function UpgradesRail({ upgrades }: { upgrades?: Upgrade[] }) {
  const activeUpgrades = upgrades ?? UPGRADES;

  // Sort so confirmed upgrades are always first, followed by unconfirmed
  const sortedUpgrades = useMemo(() => {
    return [...activeUpgrades].sort((a, b) => {
      const aConf = a.confirmed !== false;
      const bConf = b.confirmed !== false;
      if (aConf && !bConf) return -1;
      if (!aConf && bConf) return 1;
      return 0;
    });
  }, [activeUpgrades]);

  const confirmedCount = useMemo(() => {
    return activeUpgrades.filter((u) => u.confirmed !== false).length;
  }, [activeUpgrades]);

  const distinctAsOf = useMemo(() => {
    const set = new Set<string>();
    for (const u of activeUpgrades) {
      if (u.confirmed !== false && u.asOf) set.add(u.asOf);
    }
    return Array.from(set);
  }, [activeUpgrades]);

  const validationHeader = useMemo(() => {
    if (distinctAsOf.length === 1) {
      return `Validated against ${distinctAsOf[0]} pace`;
    }
    return "Validated against latest practice pace";
  }, [distinctAsOf]);

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-hairline bg-card">
      {/* Header */}
      <div className="shrink-0 border-b border-hairline bg-secondary/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5 text-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Technical Upgrades
            </p>
          </div>
          <span className="tabular rounded bg-secondary px-1.5 py-0.5 text-[9px] font-mono font-bold text-muted-foreground border border-hairline/60">
            {confirmedCount}/{activeUpgrades.length} ACTIVE
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground/80">
          {validationHeader}
        </p>
      </div>

      {/* Upgrades Scrollable / Stretched Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-hairline telemetry-scrollbar">
        <ul className="divide-y divide-hairline">
          {sortedUpgrades.map((u, i) => {
            const team = TEAMS[u.team];
            const isConfirmed = u.confirmed !== false;
            const teamColor = team?.color ?? "#888888";

            return (
              <li
                key={i}
                className={`relative px-4 py-3 transition-colors hover:bg-secondary/30 ${
                  isConfirmed ? "opacity-100" : "opacity-60 bg-secondary/10"
                }`}
              >
                {/* Team accent line */}
                <div
                  className="absolute bottom-0 left-0 top-0 w-1"
                  style={{ backgroundColor: isConfirmed ? teamColor : `${teamColor}44` }}
                />

                <div className="ml-1.5">
                  {/* Team & Category Header */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className="truncate text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: isConfirmed ? teamColor : "var(--color-muted-foreground)" }}
                    >
                      {team?.name ?? u.team}
                    </span>
                    <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border border-hairline/50">
                      {u.category}
                    </span>
                  </div>

                  {/* Component Name */}
                  <p
                    className={`mt-1 text-xs leading-snug ${
                      isConfirmed ? "font-semibold text-foreground" : "font-normal italic text-muted-foreground"
                    }`}
                  >
                    {u.component}
                  </p>

                  {/* Pace Delta & Status Row */}
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-hairline/50 pt-2">
                    <div className="flex items-center gap-1">
                      {isConfirmed ? (
                        u.paceDelta < 0 ? (
                          <span className="tabular inline-flex items-center gap-0.5 text-xs font-bold text-f1-green">
                            <ArrowDownRight className="h-3 w-3" />
                            {Math.abs(u.paceDelta).toFixed(2)}s/lap
                          </span>
                        ) : u.paceDelta > 0 ? (
                          <span className="tabular inline-flex items-center gap-0.5 text-xs font-bold text-destructive">
                            <ArrowUpRight className="h-3 w-3" />
                            +{u.paceDelta.toFixed(2)}s/lap
                          </span>
                        ) : (
                          <span className="tabular text-xs font-semibold text-muted-foreground">
                            ±0.00s
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Pending Delta
                        </span>
                      )}
                    </div>

                    <div>
                      {!isConfirmed ? (
                        <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground border border-hairline">
                          <Clock className="h-2.5 w-2.5" /> PENDING
                        </span>
                      ) : u.validated ? (
                        <span className="inline-flex items-center gap-1 rounded bg-f1-green/10 px-1.5 py-0.5 text-[9px] font-bold text-f1-green border border-f1-green/20">
                          <CheckCircle className="h-2.5 w-2.5" /> VALID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-f1-amber/10 px-1.5 py-0.5 text-[9px] font-bold text-f1-amber border border-f1-amber/20">
                          <AlertTriangle className="h-2.5 w-2.5" /> UNVERIFIED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attribution & Date */}
                  <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground/70">
                    <span className="truncate max-w-[140px]">src · {u.source}</span>
                    {u.asOf && isConfirmed && (
                      <span className="shrink-0 font-mono">as of {u.asOf}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer telemetry status strip */}
      <div className="shrink-0 border-t border-hairline bg-secondary/30 px-3.5 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-f1-green" />
          <span>FIA Aero Tech Ingest</span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">Live Paddock Feed</span>
      </div>
    </aside>
  );
}
