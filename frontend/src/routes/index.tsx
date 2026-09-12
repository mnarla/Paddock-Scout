import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";

import { NEXT_RACE, type RaceInfo } from "@/data/calendar2026";
import { DRIVERS_2026, driverById, type Driver } from "@/data/drivers2026";
import { predictDriver } from "@/lib/prediction";
import { UPGRADES, type Upgrade } from "@/data/upgrades";
import { API_BASE_URL } from "@/lib/config";
import { useFeatureWeights } from "@/lib/useFeatureWeights";

import { LiveBanner } from "@/components/paddock/LiveBanner";
import { WhatIfPanel } from "@/components/paddock/WhatIfPanel";
import { SelectedDriverCard } from "@/components/paddock/SelectedDriverCard";
import { FeatureContribution } from "@/components/paddock/FeatureContribution";
import { UpgradesRail } from "@/components/paddock/UpgradesRail";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paddock Scout · Live Prediction" },
      {
        name: "description",
        content:
          "Live F1 podium predictions for the 2026 season. What-if scoring, calibrated feature contributions, and technical upgrades.",
      },
      { property: "og:title", content: "Paddock Scout · Live Prediction" },
      {
        property: "og:description",
        content:
          "F1 2026 podium probability dashboard with validated technical upgrades.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaddockScoutLive,
});

// Helper to determine if the upcoming Grand Prix has official Qualifying results ready.
// Qualifying takes place Saturday afternoon (~24-28 hours before Sunday race start).
// If the Grand Prix is more than 28 hours away (or outside race weekend), qualifying has not occurred yet.
function isPostQualifyingWeekend(raceDateStr?: string): boolean {
  if (!raceDateStr) return false;
  const raceTimestamp = new Date(`${raceDateStr}T14:00:00Z`).getTime();
  const diffHours = (raceTimestamp - Date.now()) / (1000 * 60 * 60);
  return diffHours <= 28 && diffHours >= -6;
}

// Module-level prediction cache — persists across driver changes, resets on hard refresh.
// Key: `${driverId}|${gridPos}|${form}|${raceName}`
const predCache = new Map<string, any>();


function PaddockScoutLive() {
  const [drivers, setDrivers] = useState<Driver[]>(DRIVERS_2026);
  const [race, setRace] = useState<RaceInfo>(NEXT_RACE);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(UPGRADES);

  // Fetch real RF feature importances from the model — used by FeatureContribution.
  const featureWeights = useFeatureWeights();


  // Stable serialized key for upgrades — prevents object-reference churn from triggering
  // prediction re-fetches on every render when the upgrades array contents haven't changed.
  const upgradesKey = useMemo(() => JSON.stringify(upgrades), [upgrades]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/drivers`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) setDrivers(data);
      })
      .catch((err) => console.error("Error fetching drivers:", err));

    fetch(`${API_BASE_URL}/api/next-race`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setRace(data);
      })
      .catch((err) => console.error("Error fetching next-race:", err));

    fetch(`${API_BASE_URL}/api/upgrades`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setUpgrades(data);
      })
      .catch((err) => console.error("Error fetching upgrades:", err));
  }, []);

  const isPostQuali = useMemo(() => isPostQualifyingWeekend(race?.date), [race?.date]);

  // When outside race weekend or before Qualifying, default starting grid to championship standings rank
  const activeDrivers = useMemo(() => {
    return drivers.map((d, idx) => {
      const standingsRank = d.standingsRank || idx + 1;
      return {
        ...d,
        standingsRank,
        qualifyingPos: isPostQuali && d.qualifyingPos ? d.qualifyingPos : standingsRank,
      };
    });
  }, [drivers, isPostQuali]);

  const [driverId, setDriverId] = useState<string>("hamilton");
  
  const driver = useMemo(() => {
    return activeDrivers.find((x) => x.id === driverId) || activeDrivers[0] || DRIVERS_2026[0];
  }, [activeDrivers, driverId]);

  const [gridPos, setGridPos] = useState(driver.qualifyingPos);
  const [form, setForm] = useState(driver.recentForm);

  useEffect(() => {
    setGridPos(driver.qualifyingPos);
    setForm(driver.recentForm);
  }, [driver]);

  // ── Client-side prediction cache ────────────────────────────────────────────
  // Caches server predictions keyed by driverId+gridPos+form+raceName.
  // Prevents identical round-trips when the user switches to a driver they've
  // already inspected, or when the what-if sliders return to their default pos.
  // Cache is a module-level Map so it persists across driver changes but resets
  // on hard refresh (acceptable — stale after a model redeploy anyway).
  const [isPredicting, setIsPredicting] = useState(false);

  const [baseline, setBaseline] = useState<any>(() =>
    predictDriver({
      driver,
      gridPos: driver.qualifyingPos,
      form: driver.recentForm,
      race,
      upgrades,
    })
  );

  const [prediction, setPrediction] = useState<any>(() =>
    predictDriver({ driver, gridPos, form, race, upgrades })
  );

  // Fetch BASELINE when driver/race/upgrades change.
  // Also updates prediction when sliders are still at default (avoids duplicate request).
  useEffect(() => {
    const localBase = predictDriver({
      driver,
      gridPos: driver.qualifyingPos,
      form: driver.recentForm,
      race,
      upgrades,
    });
    setBaseline(localBase);

    // If sliders haven't moved, mirror baseline into prediction immediately.
    if (gridPos === driver.qualifyingPos && form === driver.recentForm) {
      setPrediction(localBase);
    }

    const cacheKey = `${driver.id}|${driver.qualifyingPos}|${driver.recentForm}|${race.name}`;
    if (predCache.has(cacheKey)) {
      const cached = predCache.get(cacheKey)!;
      setBaseline(cached);
      if (gridPos === driver.qualifyingPos && form === driver.recentForm) {
        setPrediction(cached);
      }
      return;
    }

    let cancelled = false;
    setIsPredicting(true);
    fetch(`${API_BASE_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId: driver.id,
        gridPos: driver.qualifyingPos,
        form: driver.recentForm,
        grandPrix: race.name,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.podium !== undefined) {
          predCache.set(cacheKey, data);
          setBaseline(data);
          // If sliders still at default, promote to prediction too.
          if (gridPos === driver.qualifyingPos && form === driver.recentForm) {
            setPrediction(data);
          }
        }
      })
      .catch((err) => console.error("Error fetching baseline prediction:", err))
      .finally(() => { if (!cancelled) setIsPredicting(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver.id, driver.qualifyingPos, driver.recentForm, race.name, upgradesKey]);

  // Fetch WHAT-IF prediction when sliders move away from default.
  // Skips the network call when sliders are at default (baseline already covers it).
  useEffect(() => {
    const isAtDefault = gridPos === driver.qualifyingPos && form === driver.recentForm;
    setPrediction(predictDriver({ driver, gridPos, form, race, upgrades }));

    if (isAtDefault) {
      // Sliders are at default — no extra fetch needed; baseline effect handles it.
      return;
    }

    const cacheKey = `${driver.id}|${gridPos}|${form}|${race.name}`;
    if (predCache.has(cacheKey)) {
      setPrediction(predCache.get(cacheKey)!);
      return;
    }

    let cancelled = false;
    const handler = setTimeout(() => {
      setIsPredicting(true);
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
          if (!cancelled && data && data.podium !== undefined) {
            predCache.set(cacheKey, data);
            setPrediction(data);
          }
        })
        .catch((err) => console.error("Error fetching current prediction:", err))
        .finally(() => { if (!cancelled) setIsPredicting(false); });
    }, 200);

    return () => { cancelled = true; clearTimeout(handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver.id, gridPos, form, race.name, upgradesKey]);

  const onDriverChange = (id: string) => {
    setDriverId(id);
    const d = activeDrivers.find((x) => x.id === id) || DRIVERS_2026.find((x) => x.id === id);
    if (d) {
      setGridPos(d.qualifyingPos);
      setForm(d.recentForm);
    }
  };

  const onReset = () => {
    setGridPos(driver.qualifyingPos);
    setForm(driver.recentForm);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LiveBanner race={race} />

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 rounded-md border border-hairline/60 bg-secondary/15 px-4 py-2.5 text-xs text-muted-foreground">
          <strong>Disclaimer:</strong> Predictions are based on season form when qualifying or practice data for the next race are not yet available.
        </div>

        {/* Top 3-column grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
          <WhatIfPanel
            driver={driver}
            gridPos={gridPos}
            form={form}
            onDriverChange={onDriverChange}
            onGridChange={setGridPos}
            onFormChange={setForm}
            onReset={onReset}
            drivers={activeDrivers}
            isPostQuali={isPostQuali}
          />

          <div className="space-y-4">
            <SelectedDriverCard
              driver={driver}
              prediction={prediction}
              baseline={baseline}
              isPredicting={isPredicting}
            />
            <FeatureContribution prediction={prediction} featureWeights={featureWeights} />
          </div>

          <UpgradesRail upgrades={upgrades} />
        </div>



        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>
            Paddock Scout · 2026 Season · Model v6 (RandomForest, calibrated)
          </span>
          <span className="tabular">
            {drivers.length} drivers · Grid α {featureWeights.isLoading ? "—" : `${((featureWeights.weights["Grid"] ?? 0) * 100).toFixed(1)}%`} · Sprint 2.5×
          </span>
        </footer>
      </main>
    </div>
  );
}
