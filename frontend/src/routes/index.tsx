import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";

import { NEXT_RACE, type RaceInfo } from "@/data/calendar2026";
import { DRIVERS_2026, type Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import { UPGRADES, type Upgrade } from "@/data/upgrades";
import { API_BASE_URL } from "@/lib/config";
import { useFeatureWeights } from "@/lib/useFeatureWeights";

import { AmbientRaceTrack } from "@/components/paddock/AmbientRaceTrack";
import { PillNav, type NavTab } from "@/components/paddock/PillNav";
import { CockpitDashboard } from "@/components/paddock/CockpitDashboard";
import { UpgradesRail } from "@/components/paddock/UpgradesRail";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Paddock Scout · Formula 1 Predictions" }],
  }),
  component: PaddockScoutCockpit,
});

function isPostQualifyingWeekend(raceDateStr?: string): boolean {
  if (!raceDateStr) return false;
  const raceTimestamp = new Date(`${raceDateStr}T14:00:00Z`).getTime();
  const diffHours = (raceTimestamp - Date.now()) / (1000 * 60 * 60);
  return diffHours <= 28 && diffHours >= -6;
}

const predCache = new Map<string, any>();

function PaddockScoutCockpit() {
  const [drivers, setDrivers] = useState<Driver[]>(DRIVERS_2026);
  const [race, setRace] = useState<RaceInfo>(NEXT_RACE);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(UPGRADES);
  const [calendar, setCalendar] = useState<RaceInfo[]>([]);

  const featureWeights = useFeatureWeights();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/drivers`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.length) {
          setDrivers(data);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/next-race`)
      .then((res) => res.json())
      .then((data) => { if (data) setRace(data); })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/upgrades`)
      .then((res) => res.json())
      .then((data) => { if (data) setUpgrades(data); })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/calendar`)
      .then((res) => res.json())
      .then((data) => { if (data?.length) setCalendar(data); })
      .catch(() => {});
  }, []);

  const isPostQuali = useMemo(() => isPostQualifyingWeekend(race?.date), [race?.date]);

  const activeDrivers = useMemo(
    () =>
      drivers.map((d, idx) => ({
        ...d,
        standingsRank: d.standingsRank || idx + 1,
        qualifyingPos:
          isPostQuali && d.qualifyingPos ? d.qualifyingPos : d.standingsRank || idx + 1,
      })),
    [drivers, isPostQuali]
  );

  const [driverId, setDriverId] = useState<string | null>(null);
  const [navTab, setNavTab] = useState<NavTab>("home");

  const driver = useMemo(
    () => (driverId ? activeDrivers.find((x) => x.id === driverId) ?? null : null),
    [activeDrivers, driverId]
  );

  const [gridPos, setGridPos] = useState<number>(1);
  const [form, setForm] = useState<number>(10);

  useEffect(() => {
    if (driver) {
      setGridPos(driver.qualifyingPos);
      setForm(driver.recentForm);
    }
  }, [driver?.id, driver?.qualifyingPos, driver?.recentForm]);

  const [isPredicting, setIsPredicting] = useState(false);
  const [baseline, setBaseline] = useState<any>(null);
  const [prediction, setPrediction] = useState<any>(null);

  useEffect(() => {
    if (!driver) return;
    const isAtDefault =
      gridPos === driver.qualifyingPos && Math.abs(form - driver.recentForm) < 0.05;
    if (isAtDefault && baseline) {
      setPrediction(baseline);
      return;
    }

    const cacheKey = `${driver.id}|${gridPos}|${Number(form).toFixed(2)}|${race.name}`;
    if (predCache.has(cacheKey)) {
      setPrediction(predCache.get(cacheKey)!);
      setIsPredicting(false);
      return;
    }

    let cancelled = false;
    setIsPredicting(true);
    const handler = setTimeout(() => {
      fetch(`${API_BASE_URL}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: driver.id,
          gridPos,
          form,
          grandPrix: race.name,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data?.podium !== undefined) {
            predCache.set(cacheKey, data);
            setPrediction(data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setIsPredicting(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
  }, [driver?.id, gridPos, form, race.name, driver?.qualifyingPos, driver?.recentForm, baseline]);

  const onDriverChange = (id: string | null) => {
    setDriverId(id);
    if (!id) {
      setBaseline(null);
      setPrediction(null);
      setIsPredicting(false);
      return;
    }
    const d = activeDrivers.find((x) => x.id === id);
    if (d) {
      setGridPos(d.qualifyingPos);
      setForm(d.recentForm);
      const cacheKey = `${d.id}|${d.qualifyingPos}|${Number(d.recentForm).toFixed(2)}|${race.name}`;
      if (predCache.has(cacheKey)) {
        const cached = predCache.get(cacheKey)!;
        setBaseline(cached);
        setPrediction(cached);
        setIsPredicting(false);
      } else {
        setBaseline(null);
        setPrediction(null);
        setIsPredicting(true);
      }
    }
  };

  const onReset = () => {
    if (!driver) return;
    setGridPos(driver.qualifyingPos);
    setForm(driver.recentForm);
    if (baseline) setPrediction(baseline);
  };

  const onNavSelect = (tab: NavTab) => {
    setNavTab(tab);
  };

  // Full calendar sorted by round number
  const fullCalendar = useMemo(() => {
    if (calendar.length > 0) {
      return [...calendar].sort((a, b) => a.round - b.round);
    }
    return [race];
  }, [calendar, race]);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 relative selection:bg-rose-500/30 overflow-x-hidden flex flex-col justify-center items-center py-20 px-4 sm:px-6">
      <PillNav activeTab={navTab} onSelectTab={onNavSelect} race={race} calendar={fullCalendar} />

      <main className="w-full max-w-5xl relative z-10 flex items-center justify-center my-auto py-8">
        <AmbientRaceTrack />

        {navTab === "home" && (
          <CockpitDashboard
            race={race}
            calendar={fullCalendar}
            drivers={activeDrivers}
            selectedDriver={driver}
            onSelectDriver={onDriverChange}
            prediction={prediction}
            baseline={baseline}
            isPredicting={isPredicting}
            featureWeights={featureWeights}
            gridPos={gridPos}
            form={form}
            onGridChange={setGridPos}
            onFormChange={setForm}
            onReset={onReset}
            isPostQuali={isPostQuali}
          />
        )}

        {navTab === "schedule" && (
          <div className="relative z-10 w-full max-w-5xl mx-auto rounded-2xl bg-[#090b10]/95 backdrop-blur-2xl border border-white/[0.08] p-4 sm:p-5 shadow-[0_24px_64px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-white font-sans">
                  2026 FIA Formula 1 Calendar
                </h1>
                <p className="text-[10px] font-mono tracking-wider text-slate-400 uppercase mt-0.5">
                  {fullCalendar.length} Championship Rounds · Next: Round {race.round} ({race.short.toUpperCase()})
                </p>
              </div>
              <div className="text-[10px] font-mono font-bold text-rose-400 uppercase flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/25 px-2.5 py-1 rounded-md">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>Next: {race.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Full Calendar List */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="space-y-2 max-h-[390px] overflow-y-auto pr-1">
                  {fullCalendar.map((r) => {
                    const isNext = r.round === race.round;
                    const isCompleted = r.round < race.round;
                    return (
                      <div
                        key={r.round}
                        className={`rounded-lg border p-2.5 transition-all ${
                          isNext
                            ? "border-rose-500/70 bg-rose-500/10 shadow-[0_0_16px_rgba(239,68,68,0.15)] ring-1 ring-rose-500/40"
                            : isCompleted
                            ? "border-slate-800/80 bg-[#0e121e]/70 opacity-75 hover:opacity-100"
                            : "border-slate-700/60 bg-[#121625]/90 hover:border-slate-500/80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{r.flag}</span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="tabular text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                  RD{String(r.round).padStart(2, "0")}
                                </span>
                                {isNext ? (
                                  <span className="text-[9px] font-extrabold text-rose-400 uppercase tracking-wider bg-rose-500/20 px-1.5 py-0.5 rounded">
                                    Next Race
                                  </span>
                                ) : isCompleted ? (
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800/80 px-1 py-0.5 rounded">
                                    Completed
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wider bg-sky-500/10 px-1 py-0.5 rounded">
                                    Upcoming
                                  </span>
                                )}
                                {r.isSprint && (
                                  <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Sprint
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-extrabold text-white uppercase tracking-wide">
                                {r.name}
                              </div>
                              <div className="text-[10px] font-medium text-slate-400 uppercase">
                                {r.short} · {r.trackType} Circuit
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] font-bold text-slate-300 uppercase font-mono">
                              {new Date(r.date).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}
                            </div>
                          </div>
                        </div>

                        {isNext && r.sessions && r.sessions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-rose-500/20 flex flex-wrap gap-1.5">
                            {r.sessions.map((s) => (
                              <span
                                key={s.shortName}
                                className="text-[9px] font-semibold text-slate-200 bg-slate-800/90 border border-slate-700/60 px-1.5 py-0.5 rounded"
                              >
                                {s.shortName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Next Grand Prix Details */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-rose-400">
                      Upcoming Event
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      Round {race.round}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{race.flag}</span>
                    <div>
                      <h2 className="text-base font-black uppercase text-white tracking-wide leading-tight">
                        {race.name}
                      </h2>
                      <p className="text-[11px] text-slate-400 font-medium uppercase mt-0.5">
                        {race.short} · {race.trackType} Track
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-mono font-semibold text-slate-300 border-t border-rose-500/20 pt-2.5 flex items-center justify-between">
                    <span>Race Date</span>
                    <span className="text-rose-400">
                      {new Date(race.date).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {race.isSprint && (
                    <div className="mt-2 text-[10px] font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2 py-1 rounded text-center uppercase tracking-wider">
                      Sprint Weekend Format
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-700/60 bg-[#0a0d14]/90 p-3.5 text-xs text-slate-400 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Grand Prix Intel
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Track Type:</span>
                    <span className="font-semibold text-slate-200">{race.trackType}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Weekend Sessions:</span>
                    <span className="font-semibold text-slate-200">{race.sessions?.length ?? 5} Sessions</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Season Progress:</span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {race.round} / {fullCalendar.length} ({Math.round((race.round / fullCalendar.length) * 100)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {navTab === "upgrades" && (
          <div className="relative z-10 w-full max-w-5xl mx-auto rounded-2xl bg-[#090b10]/95 backdrop-blur-2xl border border-white/[0.08] p-4 sm:p-5 shadow-[0_24px_64px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-white font-sans">
                  Technical Upgrades &amp; Aero Specifications
                </h1>
                <p className="text-[10px] font-mono tracking-wider text-slate-400 uppercase mt-0.5">
                  FIA Aerodynamic Packages · Round {race.round}: {race.short.toUpperCase()} ({race.name})
                </p>
              </div>
              <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-md">
                Confirmed Specs Only
              </div>
            </div>

            <div className="max-h-[420px] overflow-hidden flex flex-col w-full">
              <UpgradesRail upgrades={upgrades} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
