import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";

import { NEXT_RACE, type RaceInfo } from "@/data/calendar2026";
import { DRIVERS_2026, driverById, type Driver } from "@/data/drivers2026";
import { predictDriver } from "@/lib/prediction";
import { UPGRADES, type Upgrade } from "@/data/upgrades";
import { API_BASE_URL } from "@/lib/config";

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

function PaddockScoutLive() {
  const [drivers, setDrivers] = useState<Driver[]>(DRIVERS_2026);
  const [race, setRace] = useState<RaceInfo>(NEXT_RACE);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(UPGRADES);

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

  // Update BASELINE when driver/race/upgrades change (independent of what-if sliders).
  // Uses upgradesKey (stable string) so a new array object from a re-render doesn't re-fire.
  useEffect(() => {
    // Optimistic local prediction first
    setBaseline(predictDriver({
      driver,
      gridPos: driver.qualifyingPos,
      form: driver.recentForm,
      race,
      upgrades,
    }));

    // Then refine with server model
    let cancelled = false;
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
        if (!cancelled && data && data.podium !== undefined) setBaseline(data);
      })
      .catch((err) => console.error("Error fetching baseline prediction:", err));

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver.id, driver.qualifyingPos, driver.recentForm, race.name, upgradesKey]);

  // Update WHAT-IF prediction when sliders or driver change.
  // Never touches baseline — keeps the two states fully independent.
  useEffect(() => {
    setPrediction(predictDriver({ driver, gridPos, form, race, upgrades }));

    let cancelled = false;
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
          if (!cancelled && data && data.podium !== undefined) setPrediction(data);
        })
        .catch((err) => console.error("Error fetching current prediction:", err));
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
            />
            <FeatureContribution prediction={prediction} />
          </div>

          <UpgradesRail upgrades={upgrades} />
        </div>



        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>
            Paddock Scout · 2026 Season · Model v6 (RandomForest, calibrated)
          </span>
          <span className="tabular">
            {drivers.length} drivers · Grid α 25.4% · Sprint 2.5×
          </span>
        </footer>
      </main>
    </div>
  );
}
