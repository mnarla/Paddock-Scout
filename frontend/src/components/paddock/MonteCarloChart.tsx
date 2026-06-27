import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TEAMS } from "@/data/teams";
import { driverById, DRIVERS_2026, type Driver } from "@/data/drivers2026";
import type { RaceInfo } from "@/data/calendar2026";
import { getDriverMedianFinish, runMonteCarloFull } from "@/lib/prediction";
import type { Upgrade } from "@/data/upgrades";

interface Props {
  race: RaceInfo;
  selectedDriverId: string;
  drivers?: Driver[];
  upgrades?: Upgrade[];
  simData?: any;
  isLoading?: boolean;
}

export function MonteCarloCharts({ race, selectedDriverId, drivers, upgrades, simData, isLoading }: Props) {
  const result = useMemo(() => {
    if (simData && simData.rows && simData.positions) return simData;
    return runMonteCarloFull(race, drivers, upgrades);
  }, [race, drivers, upgrades, simData]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <PodiumStackChart
        rows={result.rows}
        selectedDriverId={selectedDriverId}
      />
      <FinishDistributionChart
        positions={result.positions[selectedDriverId] || new Array(20).fill(0)}
        nSimulations={result.nSimulations}
        selectedDriverId={selectedDriverId}
        drivers={drivers}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked podium bar — top 10 by podium %                             */
/* ------------------------------------------------------------------ */

function PodiumStackChart({
  rows,
  selectedDriverId,
}: {
  rows: ReturnType<typeof runMonteCarloFull>["rows"];
  selectedDriverId: string;
}) {
  const data = rows.slice(0, 10).map((r) => ({
    name: r.driver.last.toUpperCase(),
    abbr: r.driver.abbr,
    team: TEAMS[r.driver.team].short,
    color: TEAMS[r.driver.team].color,
    selected: r.driver.id === selectedDriverId,
    P1: Math.round(r.p1 * 100),
    P2: Math.round(r.p2 * 100),
    P3: Math.round(r.p3 * 100),
    Podium: Math.round(r.podium * 100),
  }));

  return (
    <section className="rounded-lg border border-hairline bg-card">
      <Header
        title="Podium share · Monte Carlo"
        subtitle="Top 10 by Σ podium probability · stacked P1 / P2 / P3"
        badge="STACK"
      />
      <div className="px-3 pb-3 pt-2">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            barCategoryGap={4}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
              axisLine={{ stroke: "hsl(var(--hairline))" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={88}
              tick={(props) => <TeamTick {...props} data={data} />}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip content={<PodiumTooltip />} cursor={{ fill: "hsl(var(--secondary) / 0.4)" }} />
            <Bar dataKey="P1" stackId="podium" fill="var(--color-f1-red)" radius={[2, 0, 0, 2]}>
              {data.map((d, i) => (
                <Cell key={i} fillOpacity={d.selected ? 1 : 0.92} />
              ))}
            </Bar>
            <Bar dataKey="P2" stackId="podium" fill="#c0c0c8">
              {data.map((d, i) => (
                <Cell key={i} fillOpacity={d.selected ? 1 : 0.85} />
              ))}
            </Bar>
            <Bar dataKey="P3" stackId="podium" fill="#cd7f32" radius={[0, 2, 2, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fillOpacity={d.selected ? 1 : 0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Legend />
      </div>
    </section>
  );
}

function TeamTick({
  x,
  y,
  payload,
  data,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  data: { name: string; team: string; color: string; selected: boolean }[];
}) {
  const row = data.find((d) => d.name === payload?.value);
  if (!row) return null;
  return (
    <g transform={`translate(${(x ?? 0) - 4},${y ?? 0})`}>
      <rect x={-4} y={-9} width={3} height={18} fill={row.color} />
      <text
        x={-10}
        y={0}
        dy={4}
        textAnchor="end"
        fontSize={11}
        fontWeight={row.selected ? 800 : 700}
        fill={row.selected ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
        style={{ fontFamily: "inherit", letterSpacing: "0.02em" }}
      >
        {row.name}
      </text>
    </g>
  );
}

function PodiumTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-hairline bg-background/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="flex items-center gap-2 pb-1">
        <span className="inline-block h-2 w-2" style={{ background: d.color }} />
        <span className="font-bold tracking-tight">{d.name}</span>
        <span className="text-[10px] text-muted-foreground">{d.team}</span>
      </div>
      <Row label="P1" value={d.P1} color="var(--color-f1-red)" />
      <Row label="P2" value={d.P2} color="#c0c0c8" />
      <Row label="P3" value={d.P3} color="#cd7f32" />
      <div className="mt-1 border-t border-hairline pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Σ Podium <span className="tabular ml-1 font-bold text-foreground">{d.Podium}%</span>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2" style={{ background: color }} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <span className="tabular text-xs font-bold">{value}%</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-2 flex items-center gap-3 px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2" style={{ background: "var(--color-f1-red)" }} />
        P1
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2" style={{ background: "#c0c0c8" }} />
        P2
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2" style={{ background: "#cd7f32" }} />
        P3
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Finishing-position distribution histogram                           */
/* ------------------------------------------------------------------ */

function FinishDistributionChart({
  positions,
  nSimulations,
  selectedDriverId,
  drivers,
}: {
  positions: number[];
  nSimulations: number;
  selectedDriverId: string;
  drivers?: Driver[];
}) {
  const activeDrivers = drivers ?? DRIVERS_2026;
  const driver = activeDrivers.find((d) => d.id === selectedDriverId) || driverById(selectedDriverId);
  const team = TEAMS[driver.team];

  const data = positions.map((count, i) => ({
    pos: i + 1,
    pct: (count / nSimulations) * 100,
  }));

  const median = getDriverMedianFinish(positions);
  const podiumPct = Math.round(
    ((positions[0] + positions[1] + positions[2]) / nSimulations) * 100
  );

  const colorFor = (pos: number) => {
    if (pos <= 3) return "var(--color-f1-red)";
    if (pos <= 10) return team.color;
    return "hsl(var(--muted-foreground))";
  };
  const opacityFor = (pos: number) => {
    if (pos <= 3) return 1;
    if (pos <= 10) return 0.7;
    return 0.35;
  };

  return (
    <section className="rounded-lg border border-hairline bg-card">
      <Header
        title={`Finish distribution · ${driver.last}`}
        subtitle={`Median P${median} · Σ podium ${podiumPct}% · ${nSimulations.toLocaleString()} sims`}
        badge="PDF"
        accent={team.color}
      />
      <div className="px-3 pb-3 pt-2">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
            barCategoryGap={2}
          >
            <XAxis
              dataKey="pos"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              axisLine={{ stroke: "hsl(var(--hairline))" }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<DistTooltip team={team} />} cursor={{ fill: "hsl(var(--secondary) / 0.4)" }} />
            <Bar dataKey="pct" radius={[2, 2, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.pos}
                  fill={colorFor(d.pos)}
                  fillOpacity={opacityFor(d.pos)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center gap-3 px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2" style={{ background: "var(--color-f1-red)" }} />
            Podium zone
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2" style={{ background: team.color, opacity: 0.7 }} />
            Points
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 bg-muted-foreground/40" />
            Outside top 10
          </span>
        </div>
      </div>
    </section>
  );
}

function DistTooltip({ active, payload, team }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-hairline bg-background/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2" style={{ background: team.color }} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Finish</span>
        <span className="tabular font-bold">P{d.pos}</span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Probability <span className="tabular ml-1 font-bold text-foreground">{d.pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared header                                                       */
/* ------------------------------------------------------------------ */

function Header({
  title,
  subtitle,
  badge,
  accent,
}: {
  title: string;
  subtitle: string;
  badge: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">{subtitle}</p>
      </div>
      <span
        className="tabular rounded-sm bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
        style={accent ? { color: accent } : { color: "hsl(var(--muted-foreground))" }}
      >
        {badge}
      </span>
    </div>
  );
}
