import { useMemo } from "react";
import { UPGRADES, type Upgrade } from "@/data/upgrades";
import { TEAMS } from "@/data/teams";

export function UpgradesRail({ upgrades }: { upgrades?: Upgrade[] }) {
  const activeUpgrades = upgrades ?? UPGRADES;

  // Sort so confirmed upgrades are always first, followed by unconfirmed teams
  const sortedUpgrades = useMemo(() => {
    return [...activeUpgrades].sort((a, b) => {
      const aConf = a.confirmed !== false;
      const bConf = b.confirmed !== false;
      if (aConf && !bConf) return -1;
      if (!aConf && bConf) return 1;
      return 0;
    });
  }, [activeUpgrades]);

  // Determine validation context for header dynamically based on confirmed upgrades
  const distinctAsOf = useMemo(() => {
    const set = new Set<string>();
    for (const u of activeUpgrades) {
      if (u.confirmed !== false && u.asOf) set.add(u.asOf);
    }
    return Array.from(set);
  }, [activeUpgrades]);

  const validationHeader = useMemo(() => {
    if (distinctAsOf.length === 1) {
      return `Validated against ${distinctAsOf[0]} practice pace`;
    }
    return "Validated against most recent practice pace";
  }, [distinctAsOf]);

  return (
    <aside className="rounded-lg border border-hairline bg-card flex flex-col max-h-[520px] overflow-hidden">
      <div className="border-b border-hairline px-4 py-3 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Technical upgrades
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          {validationHeader}
        </p>
      </div>
      <div className="overflow-y-auto flex-1">
        <ul className="divide-y divide-hairline">
          {sortedUpgrades.map((u, i) => {
            const team = TEAMS[u.team];
            const isConfirmed = u.confirmed !== false;

            return (
              <li
                key={i}
                className={`relative px-4 py-3 transition-opacity ${
                  isConfirmed ? "opacity-100" : "opacity-50 bg-secondary/10"
                }`}
              >
                <div
                  className="absolute left-0 top-0 h-full w-0.5"
                  style={{ background: isConfirmed ? team?.color : `${team?.color ?? "#888"}55` }}
                />
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: isConfirmed ? team?.color : "var(--color-muted-foreground)" }}
                  >
                    {team?.name ?? u.team}
                  </span>
                  <span
                    className={`tabular rounded-sm px-1.5 py-px text-[9px] font-bold ${
                      !isConfirmed
                        ? "bg-secondary text-muted-foreground border border-hairline/60"
                        : u.paceDelta > 0
                        ? "bg-f1-red/15 text-f1-red"
                        : u.validated
                        ? "bg-f1-green/15 text-f1-green"
                        : "bg-f1-amber/15 text-f1-amber"
                    }`}
                  >
                    {!isConfirmed
                      ? "— PENDING"
                      : u.paceDelta > 0
                      ? "✕ DEFECTIVE"
                      : u.validated
                      ? "✓ VALID"
                      : "⚠ UNVERIFIED"}
                  </span>
                </div>
                <p
                  className={`mt-1 text-sm ${
                    isConfirmed ? "font-semibold text-foreground" : "font-normal italic text-xs text-muted-foreground"
                  }`}
                >
                  {u.component}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="uppercase tracking-wider">{u.category}</span>
                  <span
                    className={`tabular font-bold ${
                      !isConfirmed
                        ? "text-muted-foreground"
                        : u.paceDelta < 0
                        ? "text-f1-green"
                        : "text-muted-foreground"
                    }`}
                  >
                    {!isConfirmed ? "—" : `${u.paceDelta > 0 ? "+" : ""}${u.paceDelta.toFixed(2)}s`}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/60">
                  <span>src · {u.source}</span>
                  {u.asOf && isConfirmed && (
                    <span className="font-medium text-muted-foreground/80">as of {u.asOf}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

