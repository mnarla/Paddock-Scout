import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";

import { NEXT_RACE, type RaceInfo } from "@/data/calendar2026";
import { DRIVERS_2026, type Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import { API_BASE_URL } from "@/lib/config";
import type { Prediction } from "@/lib/prediction";
import { useFeatureWeights } from "@/lib/useFeatureWeights";

import { PillNav, type NavTab } from "@/components/paddock/PillNav";
import { CockpitDashboard } from "@/components/paddock/CockpitDashboard";
import { PaddockFeed } from "@/components/paddock/PaddockFeed";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Paddock Scout · Formula 1 Predictions" }],
  }),
  component: PaddockScoutCockpit,
});

const predCache = new Map<string, Prediction>();

function PaddockScoutCockpit() {
  const [drivers, setDrivers] = useState<Driver[]>(DRIVERS_2026);
  const [race, setRace] = useState<RaceInfo>(NEXT_RACE);
  const [calendar, setCalendar] = useState<RaceInfo[]>([]);
  const [calendarChanges, setCalendarChanges] = useState<
    { name: string; date: string; status: string; note: string; source: string }[]
  >([]);

  const featureWeights = useFeatureWeights();

  useEffect(() => {
    const refreshDrivers = () =>
      fetch(`${API_BASE_URL}/api/drivers`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.length) {
            setDrivers(data);
          }
        })
        .catch(() => {});
    const refreshRace = () =>
      fetch(`${API_BASE_URL}/api/next-race`)
        .then((res) => {
          if (!res.ok) throw new Error("Next race unavailable");
          return res.json();
        })
        .then((data) => {
          if (data?.name && data?.date && data?.round) setRace(data);
        })
        .catch(() => {});
    void refreshDrivers();
    void refreshRace();
    const refreshTimer = window.setInterval(() => {
      void refreshDrivers();
      void refreshRace();
    }, 60_000);

    fetch(`${API_BASE_URL}/api/calendar-changes`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCalendarChanges(data);
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/calendar`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.length) setCalendar(data);
      })
      .catch(() => {});
    return () => window.clearInterval(refreshTimer);
  }, []);

  const activeDrivers = useMemo(
    () =>
      drivers.map((d, idx) => ({
        ...d,
        standingsRank: d.standingsRank || idx + 1,
        qualifyingPos:
          d.gridSource === "qualifying" && d.gridRound === race.round
            ? d.qualifyingPos
            : Math.min(drivers.length, d.standingsRank || idx + 1),
      })),
    [drivers, race.round],
  );

  const [driverId, setDriverId] = useState<string | null>(null);
  const [navTab, setNavTab] = useState<NavTab>("home");

  const driver = useMemo(
    () => (driverId ? (activeDrivers.find((x) => x.id === driverId) ?? null) : null),
    [activeDrivers, driverId],
  );

  const [gridPos, setGridPos] = useState<number>(1);
  const [form, setForm] = useState<number>(10);
  const isPostQuali = driver?.gridSource === "qualifying" && driver.gridRound === race.round;
  const defaultGrid = driver?.qualifyingPos;
  const defaultForm = driver?.recentForm;

  useEffect(() => {
    if (defaultGrid !== undefined && defaultForm !== undefined) {
      setGridPos(defaultGrid);
      setForm(defaultForm);
    }
  }, [driverId, defaultGrid, defaultForm]);

  const [isPredicting, setIsPredicting] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  useEffect(() => {
    if (!driver) return;
    const cacheKey = `${driver.id}|${gridPos}|${Number(form).toFixed(2)}|${race.name}|${driver.gridSource}`;
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
        .then((data: Prediction) => {
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
  }, [driver, gridPos, form, race.name]);

  const onDriverChange = (id: string | null) => {
    setDriverId(id);
    if (!id) {
      setPrediction(null);
      setIsPredicting(false);
      return;
    }
    const d = activeDrivers.find((x) => x.id === id);
    if (d) {
      setGridPos(d.qualifyingPos);
      setForm(d.recentForm);
      const cacheKey = `${d.id}|${d.qualifyingPos}|${Number(d.recentForm).toFixed(2)}|${race.name}|${d.gridSource}`;
      if (predCache.has(cacheKey)) {
        const cached = predCache.get(cacheKey)!;
        setPrediction(cached);
        setIsPredicting(false);
      } else {
        setPrediction(null);
        setIsPredicting(true);
      }
    }
  };

  const onReset = () => {
    if (!driver) return;
    setGridPos(driver.qualifyingPos);
    setForm(driver.recentForm);
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
    <div className="race-page">
      <PillNav activeTab={navTab} onSelectTab={onNavSelect} race={race} calendar={fullCalendar} />

      <main>
        {navTab === "home" && (
          <CockpitDashboard
            race={race}
            calendar={fullCalendar}
            drivers={activeDrivers}
            selectedDriver={driver}
            onSelectDriver={onDriverChange}
            prediction={prediction}
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
          <div className="timing-console section-page calendar-page">
            <div className="section-page__header">
              <div>
                <h1 className="section-page__title">2026 FIA Formula 1 Calendar</h1>
                <p className="section-page__meta">
                  {fullCalendar.length} Championship Rounds · Next: Round {race.round} (
                  {race.short.toUpperCase()})
                </p>
              </div>
              <div className="section-status section-status--live">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>Next: {race.name}</span>
              </div>
            </div>

            <div className="calendar-layout">
              {/* Full Calendar List */}
              <div className="calendar-column">
                <div className="calendar-list telemetry-scrollbar">
                  {fullCalendar.map((r) => {
                    const isNext = r.round === race.round;
                    const isCompleted = r.round < race.round;
                    return (
                      <div
                        key={r.round}
                        className={`calendar-row ${
                          isNext ? "is-next" : isCompleted ? "is-complete" : "is-upcoming"
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
                                {r.short} · {r.country} · {r.trackType} Circuit
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] font-bold text-slate-300 uppercase font-mono">
                              {new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-GB", {
                                timeZone: "UTC",
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
              <div className="calendar-sidebar">
                <div className="calendar-feature">
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
                        {race.short} · {race.country} · {race.trackType} Track
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-mono font-semibold text-slate-300 border-t border-rose-500/20 pt-2.5 flex items-center justify-between">
                    <span>Race Date</span>
                    <span className="text-rose-400">
                      {new Date(`${race.date}T12:00:00Z`).toLocaleDateString("en-GB", {
                        timeZone: "UTC",
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

                <div className="calendar-intel">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Grand Prix Intel
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Track Type:</span>
                    <span className="font-semibold text-slate-200">{race.trackType}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Weekend Sessions:</span>
                    <span className="font-semibold text-slate-200">
                      {race.sessions?.length ?? 5} Sessions
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Season Progress:</span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {race.round} / {fullCalendar.length} (
                      {Math.round((race.round / fullCalendar.length) * 100)}%)
                    </span>
                  </div>
                </div>
                <div className="calendar-intel calendar-changes">
                  <h2>Calendar changes</h2>
                  {calendarChanges.map((change) => (
                    <div key={`${change.name}-${change.date}`}>
                      <strong>
                        {change.name} · {change.date}
                      </strong>
                      <span className="calendar-change-status">{change.status} — April date</span>
                      <p>{change.note}</p>
                      <a href={change.source} target="_blank" rel="noopener noreferrer">
                        F1 announcement ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {navTab === "upgrades" && (
          <div className="timing-console section-page technical-page">
            <div className="section-page__header">
              <div>
                <h1 className="section-page__title">The Paddock</h1>
                <p className="section-page__meta">
                  Team news &amp; declared car changes · Round {race.round}:{" "}
                  {race.short.toUpperCase()}
                </p>
              </div>
              <div className="section-status">FIA declarations + reported performance</div>
            </div>

            <PaddockFeed />
          </div>
        )}
      </main>
    </div>
  );
}
