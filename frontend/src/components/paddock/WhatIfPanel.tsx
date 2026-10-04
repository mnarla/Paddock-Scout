import { useEffect } from "react";
import { type Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import { RotateCcw, Minus, Plus, Sliders } from "lucide-react";

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
  onGridChange,
  onFormChange,
  onReset,
  drivers,
  isPostQuali = false,
}: Props) {
  const team = driver ? TEAMS[driver.team] : null;
  const maxGrid = drivers?.length ?? 22;

  const isModified =
    driver &&
    (gridPos !== driver.qualifyingPos || Math.abs(form - driver.recentForm) > 0.05);

  // Snap grid back into bounds if driver changes
  useEffect(() => {
    if (driver && (gridPos < 1 || gridPos > maxGrid)) onReset();
  }, [driver, gridPos, maxGrid, onReset]);

  return (
    <div className="space-y-3 pt-1">
      {/* Telemetry Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
            Telemetry Overrides
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isModified ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
              SIMULATED
            </span>
          ) : (
            <span className="text-[9px] font-mono text-slate-500 uppercase">
              BASELINE REALITY
            </span>
          )}
        </div>
      </div>

      {/* Grid Position Slider Row */}
      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              Starting Grid Slot
            </div>
            <div className="text-[9px] text-slate-500">
              {isPostQuali ? "Official Qualifying Result" : "Projected Grid Rank"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!driver || gridPos <= 1}
              onClick={() => onGridChange(Math.max(1, gridPos - 1))}
              className="w-5 h-5 flex items-center justify-center rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-xs"
              aria-label="Decrease grid position"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono text-base font-black text-white tabular w-9 text-center bg-white/[0.04] py-0.5 rounded border border-white/[0.08]">
              P{gridPos}
            </span>
            <button
              type="button"
              disabled={!driver || gridPos >= maxGrid}
              onClick={() => onGridChange(Math.min(maxGrid, gridPos + 1))}
              className="w-5 h-5 flex items-center justify-center rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-xs"
              aria-label="Increase grid position"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Custom Telemetry Slider */}
        <div className="relative pt-1 pb-1">
          <input
            type="range"
            min={1}
            max={maxGrid}
            step={1}
            value={gridPos}
            disabled={!driver}
            onChange={(e) => onGridChange(Number(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
          />
          <div className="flex justify-between text-[8px] font-mono text-slate-500 mt-1 px-0.5">
            <span>P1 (Pole)</span>
            <span>P5</span>
            <span>P10</span>
            <span>P15</span>
            <span>P{maxGrid}</span>
          </div>
        </div>
      </div>

      {/* Recent Form Slider Row */}
      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              Recent Form Metric
            </div>
            <div className="text-[9px] text-slate-500">
              Rolling 3-Race Weighted Finish (Lower = Faster)
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!driver || form <= 1}
              onClick={() => onFormChange(Math.max(1, Number((form - 0.5).toFixed(1))))}
              className="w-5 h-5 flex items-center justify-center rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-xs"
              aria-label="Improve form"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono text-base font-black text-emerald-400 tabular w-12 text-center bg-white/[0.04] py-0.5 rounded border border-white/[0.08]">
              {form.toFixed(1)}
            </span>
            <button
              type="button"
              disabled={!driver || form >= maxGrid}
              onClick={() => onFormChange(Math.min(maxGrid, Number((form + 0.5).toFixed(1))))}
              className="w-5 h-5 flex items-center justify-center rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-xs"
              aria-label="Worsen form"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Custom Telemetry Slider */}
        <div className="relative pt-1 pb-1">
          <input
            type="range"
            min={1}
            max={maxGrid}
            step={0.1}
            value={form}
            disabled={!driver}
            onChange={(e) => onFormChange(Number(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
          <div className="flex justify-between text-[8px] font-mono text-slate-500 mt-1 px-0.5">
            <span className="text-emerald-400">1.0 (Dominant)</span>
            <span>5.0</span>
            <span>10.0</span>
            <span>15.0</span>
            <span>{maxGrid}.0 (Back)</span>
          </div>
        </div>
      </div>

      {/* Reset Action */}
      {isModified && (
        <button
          type="button"
          onClick={onReset}
          className="w-full py-1.5 px-3 rounded-lg border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.07] text-[10px] font-mono font-bold text-slate-300 hover:text-white uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <RotateCcw className="w-3 h-3 text-rose-400" />
          <span>Reset Overrides to Baseline (P{driver?.qualifyingPos} · {driver?.recentForm.toFixed(1)})</span>
        </button>
      )}
    </div>
  );
}
