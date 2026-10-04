import { useMemo } from "react";
import { UPGRADES, type Upgrade } from "@/data/upgrades";
import { TEAMS } from "@/data/teams";
import { Wrench, CheckCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, ShieldCheck } from "lucide-react";

export function isConfirmedUpgrade(u: Upgrade): boolean {
  return (
    u.confirmed !== false &&
    u.status !== "PENDING" &&
    u.status !== "STABLE_SPEC" &&
    u.source !== "Baseline" &&
    u.source !== "Awaiting reports" &&
    u.component !== "Stable Aerodynamic Package" &&
    !u.component.toLowerCase().includes("no confirmed upgrade")
  );
}

export function UpgradesRail({ upgrades }: { upgrades?: Upgrade[] }) {
  const activeUpgrades = upgrades ?? UPGRADES;

  // Filter strictly to confirmed upgrades only
  const confirmedUpgrades = useMemo(() => {
    return activeUpgrades.filter(isConfirmedUpgrade);
  }, [activeUpgrades]);

  const distinctAsOf = useMemo(() => {
    const set = new Set<string>();
    for (const u of confirmedUpgrades) {
      if (u.asOf) set.add(u.asOf);
    }
    return Array.from(set);
  }, [confirmedUpgrades]);

  const validationHeader = useMemo(() => {
    if (distinctAsOf.length === 1) {
      return `Validated against ${distinctAsOf[0]} practice & telemetry`;
    }
    return "Validated against official session pace & telemetry";
  }, [distinctAsOf]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black/40 shadow-lg">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.08] bg-white/[0.03] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5 text-rose-400" />
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-200">
              Confirmed Technical Upgrades
            </p>
          </div>
          <span className="font-mono text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded">
            {confirmedUpgrades.length} CONFIRMED
          </span>
        </div>
        <p className="mt-1 text-[10px] font-mono text-slate-400">
          {validationHeader}
        </p>
      </div>

      {/* Upgrades Scrollable Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/[0.04] telemetry-scrollbar">
        {confirmedUpgrades.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500">
            No confirmed technical upgrades reported for this round. All constructors currently running baseline specifications.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {confirmedUpgrades.map((u, i) => {
              const team = TEAMS[u.team];
              const teamColor = team?.color ?? "#888888";

              return (
                <li
                  key={i}
                  className="relative px-4 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  {/* Team accent line */}
                  <div
                    className="absolute bottom-0 left-0 top-0 w-1"
                    style={{ backgroundColor: teamColor }}
                  />

                  <div className="ml-1.5">
                    {/* Team & Category Header */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="truncate text-[10px] font-mono font-bold uppercase tracking-wider"
                        style={{ color: teamColor }}
                      >
                        {team?.name ?? u.team}
                      </span>
                      <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-300 border border-white/[0.08]">
                        {u.category}
                      </span>
                    </div>

                    {/* Component Name */}
                    <p className="mt-1 text-xs font-semibold text-white leading-snug">
                      {u.component}
                    </p>

                    {u.badge && (
                      <p className="mt-1.5 text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                        {u.status === "NEW_THIS_WEEKEND" ? (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ) : u.status === "ACTIVE_SPEC" ? (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400" />
                        ) : u.status === "DEFECTIVE" ? (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        ) : null}
                        <span className={u.status === "DEFECTIVE" ? "text-rose-400 font-semibold" : ""}>
                          {u.badge}
                        </span>
                      </p>
                    )}

                    {/* Pace Delta & Status Row */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.04] pt-2">
                      <div className="flex items-center gap-1 font-mono">
                        {u.paceDelta < 0 ? (
                          <span className="tabular inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400">
                            <ArrowDownRight className="h-3 w-3" />
                            {Math.abs(u.paceDelta).toFixed(2)}s/lap
                          </span>
                        ) : u.paceDelta > 0 ? (
                          <span className="tabular inline-flex items-center gap-0.5 text-xs font-bold text-rose-400">
                            <ArrowUpRight className="h-3 w-3" />
                            +{u.paceDelta.toFixed(2)}s/lap
                          </span>
                        ) : (
                          <span className="tabular text-xs font-semibold text-slate-400">
                            ±0.00s
                          </span>
                        )}
                      </div>

                      <div>
                        {u.status === "DEFECTIVE" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="h-2.5 w-2.5" /> DEFECTIVE
                          </span>
                        ) : u.status === "NEW_THIS_WEEKEND" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="h-2.5 w-2.5" /> NEW
                          </span>
                        ) : u.status === "ACTIVE_SPEC" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-sky-400 border border-sky-500/30">
                            <ShieldCheck className="h-2.5 w-2.5" /> ACTIVE
                          </span>
                        ) : u.validated || u.status === "VALID" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="h-2.5 w-2.5" /> VALID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="h-2.5 w-2.5" /> UNVERIFIED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Attribution & Date */}
                    <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-slate-500">
                      {u.url ? (
                        <a
                          href={u.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate max-w-[180px] underline-offset-2 hover:underline hover:text-slate-300 transition-colors"
                        >
                          src · {u.source}
                        </a>
                      ) : (
                        <span className="truncate max-w-[180px]">src · {u.source}</span>
                      )}
                      {u.asOf && (
                        <span className="shrink-0 text-slate-400">as of {u.asOf}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer telemetry status strip */}
      <div className="shrink-0 border-t border-white/[0.08] bg-black/50 px-3.5 py-2 text-[10px] font-mono text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          <span>FIA Aero Tech Ingest</span>
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-500">Confirmed Specifications</span>
      </div>
    </div>
  );
}
