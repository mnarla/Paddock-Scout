import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { RaceInfo } from "@/data/calendar2026";
import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import { WhatIfPanel } from "./WhatIfPanel";
import { FeatureContribution } from "./FeatureContribution";
import { CockpitGuide } from "./CockpitGuide";
import type { FeatureWeightsData } from "@/lib/useFeatureWeights";
import { useSessionCountdown } from "@/lib/useCountdown";
import { Sliders, Activity, ArrowUpRight, Trophy } from "lucide-react";

interface CockpitDashboardProps {
  race: RaceInfo;
  calendar?: RaceInfo[];
  drivers: Driver[];
  selectedDriver: Driver | null;
  onSelectDriver: (driverId: string | null) => void;
  prediction: any;
  baseline: any;
  isPredicting: boolean;
  featureWeights: FeatureWeightsData;
  gridPos: number;
  form: number;
  onGridChange: (n: number) => void;
  onFormChange: (n: number) => void;
  onReset: () => void;
  isPostQuali?: boolean;
}

export function CockpitDashboard({
  race,
  calendar,
  drivers,
  selectedDriver,
  onSelectDriver,
  prediction,
  isPredicting,
  featureWeights,
  gridPos,
  form,
  onGridChange,
  onFormChange,
  onReset,
  isPostQuali,
}: CockpitDashboardProps) {
  const [activeRightTab, setActiveRightTab] = useState<"simulator" | "weights">("simulator");
  const currentDriver = selectedDriver;
  const currentTeam = currentDriver ? TEAMS[currentDriver.team] : null;
  const countdown = useSessionCountdown(race, calendar);

  const winPct = prediction?.p1 !== undefined ? prediction.p1 * 100 : null;
  const top2Pct = prediction?.p2 !== undefined ? prediction.p2 * 100 : null;
  const podiumPct = prediction?.p3 !== undefined ? prediction.p3 * 100 : null;

  return (
    <div className="relative z-10 w-full max-w-5xl mx-auto rounded-2xl bg-[#090b10]/95 backdrop-blur-2xl border border-white/[0.08] p-4 sm:p-5 shadow-[0_24px_64px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      {/* ── CHASSIS HEADER ── */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-3 gap-2.5">
        <div className="flex items-center gap-3">
          <span className="text-2xl sm:text-3xl drop-shadow-md select-none shrink-0">
            {race.flag}
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-white font-sans">
                {race.name}
              </h1>
              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.07] text-slate-300 border border-white/[0.08] tracking-widest uppercase">
                R{race.round} // 2026
              </span>
            </div>
            <p className="text-[10px] font-mono tracking-wider text-slate-400 uppercase mt-0.5">
              FIA Formula 1 World Championship · {race.circuit}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 self-end sm:self-auto">
          {countdown && !countdown.isComplete && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 font-mono text-[10px] text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.12)]">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <span className="text-slate-400 font-sans font-bold uppercase truncate max-w-[80px] sm:max-w-none">
                {countdown.prefix ? `${countdown.prefix} ` : ""}{countdown.sessionName}:
              </span>
              <span className="text-rose-400 font-bold tabular shrink-0">
                {countdown.d > 0 ? `${countdown.d}d ` : ""}
                {String(countdown.h).padStart(2, "0")}h {String(countdown.m).padStart(2, "0")}m {String(countdown.s).padStart(2, "0")}s
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400">
              Live Model v6.0
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN CHASSIS GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── LEFT: BROADCAST TIMING TOWER ── */}
        <div className="lg:col-span-5 flex flex-col rounded-xl border border-white/[0.08] bg-black/40 overflow-hidden shadow-lg">
          <div className="px-3 py-2 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-200">
                Timing Tower Standings
              </span>
            </div>
            {selectedDriver ? (
              <button
                type="button"
                onClick={() => onSelectDriver(null)}
                className="text-[9px] font-mono font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider transition cursor-pointer"
              >
                Reset [×]
              </button>
            ) : (
              <span className="text-[9px] font-mono font-medium text-slate-500 uppercase">
                {drivers.length} Drivers
              </span>
            )}
          </div>

          {/* Scrollable Leaderboard */}
          <div className="max-h-[385px] overflow-y-auto telemetry-scrollbar divide-y divide-white/[0.04]">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead className="sticky top-0 z-10 bg-[#0e1118] border-b border-white/[0.08] shadow-sm">
                <tr className="text-[9px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  <th className="py-1.5 px-2 w-10 text-center">Pos</th>
                  <th className="py-1.5 px-2">Driver</th>
                  <th className="py-1.5 px-1.5 text-center">Team</th>
                  <th className="py-1.5 px-2 text-center w-12">Form</th>
                  <th className="py-1.5 px-2.5 text-right pr-3 w-12">Pts</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => {
                  const team = TEAMS[d.team];
                  const isSelected = currentDriver?.id === d.id;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => onSelectDriver(d.id)}
                      className={`cursor-pointer transition-colors duration-150 border-b border-white/[0.03] ${
                        isSelected
                          ? "bg-white/[0.08] border-l-[3px] border-l-rose-500 text-white"
                          : "hover:bg-white/[0.04] text-slate-300"
                      }`}
                    >
                      <td className={`py-1.5 px-2 text-center font-mono font-bold text-[11px] ${isSelected ? "text-rose-400" : "text-slate-500"}`}>
                        P{d.standingsRank}
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: team?.color ?? "#888" }}
                          />
                          <div className="truncate flex items-baseline gap-1.5">
                            <span className="font-mono font-black text-xs text-white tracking-wider">
                              {d.abbr}
                            </span>
                            <span className="text-[11px] text-slate-400 font-sans truncate hidden sm:inline">
                              {d.last}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td
                        className="py-1.5 px-1.5 text-center text-[10px] font-mono font-bold uppercase tracking-wider"
                        style={{ color: team?.color ?? "#888" }}
                      >
                        {team?.short ?? d.team}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-emerald-400 text-[11px]">
                        {d.recentForm?.toFixed(1) ?? "–"}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-black pr-3 text-white text-[11px]">
                        {d.seasonPoints ?? "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-3 py-1.5 bg-black/50 border-t border-white/[0.06] text-[9px] font-mono text-slate-500 text-center">
            Select any driver to feed cockpit telemetry
          </div>
        </div>

        {/* ── RIGHT: TELEMETRY PROBABILITY HUD & SIMULATOR ── */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {currentDriver ? (
            <>
              {/* Driver Identity Card & F1 Probability Gauges */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 shadow-md">
                {/* Driver Identity Bar */}
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-1.5 h-8 rounded-full shrink-0"
                      style={{ backgroundColor: currentTeam?.color ?? "#ff1801" }}
                    />
                    <div>
                      <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400">
                        {currentTeam?.name} · CAR #{currentDriver.number}
                      </div>
                      <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight leading-tight">
                        {currentDriver.first} {currentDriver.last}
                      </h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400">
                      Standings
                    </div>
                    <div className="text-base font-black font-mono text-white">
                      P{currentDriver.standingsRank}
                      <span className="text-[10px] text-slate-500 ml-1 font-normal font-sans">
                        ({currentDriver.seasonPoints} pts)
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── F1 PROBABILITY PROGRESSION METERS ── */}
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Gauge 1: P1 Win */}
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono uppercase font-bold tracking-wider text-rose-300">
                        P1 Win
                      </span>
                      <Trophy className="w-3 h-3 text-rose-400/80" />
                    </div>
                    <div className="font-mono text-xl sm:text-2xl font-black text-rose-400 tracking-tight my-0.5">
                      {isPredicting ? (
                        <span className="text-xs font-normal text-slate-400 animate-pulse">Calc...</span>
                      ) : winPct !== null ? (
                        `${winPct.toFixed(1)}%`
                      ) : (
                        "--"
                      )}
                    </div>
                    {/* Telemetry Precision Progress Bar */}
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mt-1">
                      <div
                        className="bg-gradient-to-r from-rose-600 to-rose-400 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, Math.max(0, winPct ?? 0))}%` }}
                      />
                    </div>
                  </div>

                  {/* Gauge 2: Top 2 */}
                  <div className="rounded-lg border border-sky-500/25 bg-sky-500/[0.04] p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono uppercase font-bold tracking-wider text-sky-300">
                        Top 2
                      </span>
                      <span className="text-[9px] font-mono text-sky-400/80">P1-P2</span>
                    </div>
                    <div className="font-mono text-xl sm:text-2xl font-black text-slate-100 tracking-tight my-0.5">
                      {isPredicting ? (
                        <span className="text-xs font-normal text-slate-400 animate-pulse">Calc...</span>
                      ) : top2Pct !== null ? (
                        `${top2Pct.toFixed(1)}%`
                      ) : (
                        "--"
                      )}
                    </div>
                    {/* Telemetry Precision Progress Bar */}
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mt-1">
                      <div
                        className="bg-gradient-to-r from-sky-600 to-sky-400 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, Math.max(0, top2Pct ?? 0))}%` }}
                      />
                    </div>
                  </div>

                  {/* Gauge 3: Podium */}
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono uppercase font-bold tracking-wider text-amber-300">
                        Podium
                      </span>
                      <span className="text-[9px] font-mono text-amber-400/80">Top 3</span>
                    </div>
                    <div className="font-mono text-xl sm:text-2xl font-black text-amber-400 tracking-tight my-0.5">
                      {isPredicting ? (
                        <span className="text-xs font-normal text-slate-400 animate-pulse">Calc...</span>
                      ) : podiumPct !== null ? (
                        `${podiumPct.toFixed(1)}%`
                      ) : (
                        "--"
                      )}
                    </div>
                    {/* Telemetry Precision Progress Bar */}
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mt-1">
                      <div
                        className="bg-gradient-to-r from-amber-600 to-amber-400 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, Math.max(0, podiumPct ?? 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Segmented Sub-tab Toggle */}
              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setActiveRightTab("simulator")}
                  className={`flex-1 py-1.5 px-3 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeRightTab === "simulator"
                      ? "bg-white/[0.09] text-white shadow-sm border border-white/[0.1]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sliders className="w-3 h-3 text-rose-400" />
                  <span>Scenario Simulator</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab("weights")}
                  className={`flex-1 py-1.5 px-3 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeRightTab === "weights"
                      ? "bg-white/[0.09] text-white shadow-sm border border-white/[0.1]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span>AI Feature Breakdown</span>
                </button>
              </div>

              {/* Active Tab Panel */}
              <div className="max-h-[260px] overflow-y-auto telemetry-scrollbar pr-1">
                {activeRightTab === "simulator" ? (
                  <WhatIfPanel
                    driver={currentDriver}
                    gridPos={gridPos}
                    form={form}
                    onDriverChange={(id) => onSelectDriver(id)}
                    onGridChange={onGridChange}
                    onFormChange={onFormChange}
                    onReset={onReset}
                    drivers={drivers}
                    isPostQuali={isPostQuali}
                  />
                ) : (
                  <FeatureContribution
                    prediction={prediction}
                    featureWeights={featureWeights}
                  />
                )}
              </div>
            </>
          ) : (
            <CockpitGuide drivers={drivers} onSelectDriver={onSelectDriver} />
          )}
        </div>
      </div>

      {/* ── CHASSIS FOOTER ── */}
      <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-1 text-[10px] font-mono text-slate-500">
        <span>
          <strong className="text-slate-400">NOTE:</strong> Calibrated against 2026 ground-effect regulations & historical telemetry.
        </span>
        <Link
          to="/archive"
          className="text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors group cursor-pointer"
        >
          <span>Model v6 · Calibrated Random Forest</span>
          <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[9px] group-hover:border-emerald-500/50 flex items-center gap-0.5">
            Track Record
            <ArrowUpRight className="w-2.5 h-2.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
