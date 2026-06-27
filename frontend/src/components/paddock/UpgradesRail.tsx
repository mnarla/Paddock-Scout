import { UPGRADES, type Upgrade } from "@/data/upgrades";
import { TEAMS } from "@/data/teams";

export function UpgradesRail({ upgrades }: { upgrades?: Upgrade[] }) {
  const activeUpgrades = upgrades ?? UPGRADES;
  return (
    <aside className="rounded-lg border border-hairline bg-card flex flex-col max-h-[520px] overflow-hidden">
      <div className="border-b border-hairline px-4 py-3 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Technical upgrades
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          Validated against practice pace
        </p>
      </div>
      <div className="overflow-y-auto flex-1">
        <ul className="divide-y divide-hairline">
          {activeUpgrades.map((u, i) => {
            const team = TEAMS[u.team];
            return (
              <li key={i} className="relative px-4 py-3">
                <div
                  className="absolute left-0 top-0 h-full w-0.5"
                  style={{ background: team.color }}
                />
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: team.color }}
                  >
                    {team.name}
                  </span>
                  <span
                    className={`tabular rounded-sm px-1.5 py-px text-[9px] font-bold ${
                      u.validated
                        ? "bg-f1-green/15 text-f1-green"
                        : "bg-f1-amber/15 text-f1-amber"
                    }`}
                  >
                    {u.validated ? "✓ VALID" : "⚠ UNVERIFIED"}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {u.component}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="uppercase tracking-wider">{u.category}</span>
                  <span
                    className={`tabular font-bold ${
                      u.paceDelta < 0 ? "text-f1-green" : "text-muted-foreground"
                    }`}
                  >
                    {u.paceDelta > 0 ? "+" : ""}
                    {u.paceDelta.toFixed(2)}s
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground/60">
                  src · {u.source}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
