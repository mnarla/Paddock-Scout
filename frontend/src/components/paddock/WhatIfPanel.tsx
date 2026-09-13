import { useEffect, useMemo } from "react";
import { DRIVERS_2026, type Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";

interface Props {
  driver: Driver | null;
  gridPos: number;
  form: number;
  onDriverChange: (id: string) => void;
  onGridChange: (n: number) => void;
  onFormChange: (n: number) => void;
  onReset: () => void;
  drivers?: Driver[];
  isPostQuali?: boolean;
}

export function WhatIfPanel({
  driver,
  gridPos,
  form,
  onDriverChange,
  onGridChange,
  onFormChange,
  onReset,
  drivers,
  isPostQuali = false,
}: Props) {
  const team = driver ? TEAMS[driver.team] : null;
  const activeDrivers = drivers ?? DRIVERS_2026;

  const sortedDrivers = useMemo(() => {
    return [...activeDrivers].sort((a, b) => {
      const nameA = TEAMS[a.team]?.name || "";
      const nameB = TEAMS[b.team]?.name || "";
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB);
      }
      return a.last.localeCompare(b.last);
    });
  }, [activeDrivers]);

  // Subtle effect: snap grid back into bounds if driver changes
  useEffect(() => {
    if (driver && (gridPos < 1 || gridPos > activeDrivers.length)) onReset();
  }, [driver, gridPos, activeDrivers.length, onReset]);

  return (
    <aside className="rounded-lg border border-hairline bg-card">
      <div className="border-b border-hairline px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          What-If Scenario
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          Override grid & form to forecast podium probability.
        </p>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* Driver select */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Driver
          </label>
          <div className="relative">
            <div
              className="absolute left-0 top-0 h-full w-1 rounded-l transition-colors"
              style={{ background: team?.color ?? "var(--color-hairline)" }}
            />
            <select
              value={driver?.id ?? ""}
              onChange={(e) => onDriverChange(e.target.value)}
              className="tabular w-full appearance-none rounded border border-hairline bg-secondary py-2 pl-4 pr-8 text-sm font-semibold text-foreground outline-none focus:border-f1-red"
            >
              <option value="" disabled>
                Select a driver...
              </option>
              {sortedDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.number} {d.first} {d.last} · {TEAMS[d.team].short}
                </option>
              ))}
            </select>
          </div>
          {driver ? (
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Champ. P
                <span className="tabular text-foreground">{driver.standingsRank}</span>
              </span>
              <span>
                Form{" "}
                <span className="tabular text-foreground">
                  {driver.recentForm.toFixed(1)}
                </span>
              </span>
              <span>
                {isPostQuali ? "Q " : "Grid "}
                <span className="tabular text-foreground">
                  P{driver.qualifyingPos}
                </span>
              </span>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-muted-foreground/60 italic">
              Choose a driver to unlock live telemetry & sliders
            </div>
          )}
        </div>

        {/* Grid slider */}
        <SliderRow
          label="Grid Position"
          value={gridPos}
          min={1}
          max={activeDrivers.length}
          step={1}
          format={(v) => `P${v}`}
          onChange={onGridChange}
          disabled={!driver}
        />

        {/* Form slider */}
        <SliderRow
          label="Recent Form (Avg Finish)"
          value={form}
          min={1}
          max={activeDrivers.length}
          step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={onFormChange}
          disabled={!driver}
        />

        <button
          onClick={onReset}
          disabled={!driver}
          className="w-full rounded border border-hairline bg-secondary px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition hover:border-f1-red hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
        >
          {isPostQuali ? "Reset to Qualifying" : "Reset to Default Grid"}
        </button>
      </div>
    </aside>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={disabled ? "opacity-40 pointer-events-none transition-opacity" : "transition-opacity"}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <span className="tabular text-sm font-bold text-foreground">
          {format(value)}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-secondary">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-f1-red"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-f1-red
            [&::-webkit-slider-thumb]:bg-background"
        />
      </div>
    </div>
  );
}
