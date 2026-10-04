import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import { Compass, Sliders, Activity, Flag, ArrowRight } from "lucide-react";

interface CockpitGuideProps {
  drivers: Driver[];
  onSelectDriver: (driverId: string) => void;
}

export function CockpitGuide({ drivers, onSelectDriver }: CockpitGuideProps) {
  // Top 6 championship contenders for quick start
  const topContenders = drivers.slice(0, 6);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5 flex flex-col justify-between min-h-[445px] shadow-md">
      {/* ── HEADER ── */}
      <div>
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5 mb-3.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-rose-400" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-300">
              Paddock Scout // Quick Guide
            </span>
          </div>
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded font-bold uppercase">
            Awaiting Driver Select
          </span>
        </div>

        <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight font-sans">
          Paddock Scout
        </h2>
        <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-rose-400 mt-0.5">
          Formula 1 Race Simulation & Podium Prediction Dashboard
        </p>
        <p className="mt-2 text-xs text-slate-300 leading-relaxed font-sans">
          Welcome to Paddock Scout. Powered by a regularized machine learning model trained on historical telemetry with 2026 ground-effect aerodynamics weighting, this dashboard calculates live <strong className="text-white">Win (P1)</strong>, <strong className="text-white">Top 2</strong>, and <strong className="text-white">Podium</strong> finish probabilities using practice session pace, qualifying dominance, starting grid order, and confirmed technical upgrades.
        </p>

        {/* ── 3-STEP SYSTEM MANUAL ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
          {/* Step 1 */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-rose-400 mb-1.5">
                <Flag className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider">01 · Select Contender</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Pick any driver from the Timing Tower or quick-start pills to calculate live P1 Win, Top 2, and Podium probabilities.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sky-400 mb-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider">02 · What-If Simulator</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Simulate grid penalties or recovery drives. Between race weekends (pre-qualifying), initial starting slots and baseline factors default to current championship standings.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider">03 · Feature Influence</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Inspect real-time decision weights showing how starting grid slot, car performance rank, momentum, and session pace shape each outcome.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK START CONTENDERS ── */}
      <div className="mt-4 pt-3.5 border-t border-white/[0.06]">
        <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center justify-between">
          <span>Quick Start · Top Contenders</span>
          <span className="text-slate-500 font-normal">Click to initialize</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {topContenders.map((d) => {
            const team = TEAMS[d.team];
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDriver(d.id)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer group"
              >
                <div
                  className="w-1.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: team?.color ?? "#888" }}
                />
                <span className="font-mono text-xs font-bold text-white tracking-wider">
                  {d.abbr}
                </span>
                <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors">
                  {d.last}
                </span>
                <span className="font-mono text-[9px] text-slate-500">
                  P{d.standingsRank}
                </span>
                <ArrowRight className="w-2.5 h-2.5 text-slate-500 group-hover:text-rose-400 transition-colors" />
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span>Select any driver from the Timing Tower on the left or click a contender above to begin live predictions.</span>
        </div>
      </div>
    </div>
  );
}
