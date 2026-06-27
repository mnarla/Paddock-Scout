import { useMemo } from "react";
import { TEAMS } from "@/data/teams";
import type { RaceInfo } from "@/data/calendar2026";
import { runMonteCarlo } from "@/lib/prediction";
import type { Driver } from "@/data/drivers2026";
import type { Upgrade } from "@/data/upgrades";

interface Props {
  race: RaceInfo;
  selectedDriverId: string;
  drivers?: Driver[];
  upgrades?: Upgrade[];
  simData?: any;
  isLoading?: boolean;
}

export function MonteCarloTable({ race, selectedDriverId, drivers, upgrades, simData, isLoading }: Props) {
  const rows = useMemo(() => {
    if (simData && simData.rows) return simData.rows;
    return runMonteCarlo(race, drivers, upgrades);
  }, [race, drivers, upgrades, simData]);

  return (
    <section className="rounded-lg border border-hairline bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Monte Carlo simulator
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
            1,000 stochastic race simulations · weather & upgrade noise injected
          </p>
        </div>
        <span className="tabular rounded-sm bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          N = 1,000
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="w-8 px-2 py-2"></th>
              <th className="w-10 px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Driver</th>
              <th className="px-2 py-2 text-left">Team</th>
              <th className="px-2 py-2 text-right">P1</th>
              <th className="px-2 py-2 text-right">P2</th>
              <th className="px-2 py-2 text-right">P3</th>
              <th className="px-2 py-2 text-right">Σ Podium</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const team = TEAMS[r.driver.team];
              const isSel = r.driver.id === selectedDriverId;
              return (
                <tr
                  key={r.driver.id}
                  className={`group border-b border-hairline/60 transition ${
                    isSel ? "bg-f1-red/[0.06]" : "hover:bg-secondary/40"
                  }`}
                >
                  <td className="relative px-0 py-2">
                    <div
                      className="absolute left-0 top-1 h-[calc(100%-8px)] w-1"
                      style={{ background: team.color }}
                    />
                    <span className="tabular ml-3 inline-block w-5 text-right text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                  </td>
                  <td className="tabular px-2 py-2 text-left text-xs font-bold text-muted-foreground">
                    {r.driver.number}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tracking-tight">
                        {r.driver.last.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {r.driver.abbr}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-[11px]" style={{ color: team.color }}>
                    {team.short}
                  </td>
                  <BarCell value={r.p1} color="var(--color-f1-red)" />
                  <BarCell value={r.p2} color="#c0c0c8" />
                  <BarCell value={r.p3} color="#cd7f32" />
                  <td className="tabular px-2 py-2 text-right text-sm font-bold">
                    {Math.round(r.podium * 100)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BarCell({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <td className="px-2 py-2 text-right">
      <div className="flex items-center justify-end gap-2">
        <div className="relative h-1.5 w-12 overflow-hidden rounded-sm bg-secondary">
          <div
            className="h-full"
            style={{ width: `${Math.min(100, pct)}%`, background: color }}
          />
        </div>
        <span className="tabular w-9 text-right text-xs font-semibold text-foreground">
          {pct}%
        </span>
      </div>
    </td>
  );
}
