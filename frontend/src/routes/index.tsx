import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";

import { NEXT_RACE, type RaceInfo } from "@/data/calendar2026";
import { DRIVERS_2026, driverById, type Driver } from "@/data/drivers2026";
import { predictDriver } from "@/lib/prediction";
import { UPGRADES, type Upgrade } from "@/data/upgrades";

import { LiveBanner } from "@/components/paddock/LiveBanner";
import { WhatIfPanel } from "@/components/paddock/WhatIfPanel";
import { SelectedDriverCard } from "@/components/paddock/SelectedDriverCard";
import { FeatureContribution } from "@/components/paddock/FeatureContribution";
import { UpgradesRail } from "@/components/paddock/UpgradesRail";
import { MonteCarloTable } from "@/components/paddock/MonteCarloTable";
import { MonteCarloCharts } from "@/components/paddock/MonteCarloChart";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paddock Scout · Live Prediction" },
      {
        name: "description",
        content:
          "Live F1 podium predictions for the 2026 season. What-if scoring, calibrated feature contributions, and 1,000-run Monte Carlo race simulations.",
      },
      { property: "og:title", content: "Paddock Scout · Live Prediction" },
      {
        property: "og:description",
        content:
          "F1 2026 podium probability dashboard with Monte Carlo simulator and validated technical upgrades.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaddockScoutLive,
});

function PaddockScoutLive() {
  const [drivers, setDrivers] = useState<Driver[]>(DRIVERS_2026);
  const [race, setRace] = useState<RaceInfo>(NEXT_RACE);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(UPGRADES);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/drivers")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) setDrivers(data);
      })
      .catch((err) => console.error("Error fetching drivers:", err));

    fetch("http://127.0.0.1:8000/api/next-race")
      .then((res) => res.json())
      .then((data) => {
        if (data) setRace(data);
      })
      .catch((err) => console.error("Error fetching next-race:", err));

    fetch("http://127.0.0.1:8000/api/upgrades")
      .then((res) => res.json())
      .then((data) => {
        if (data) setUpgrades(data);
      })
      .catch((err) => console.error("Error fetching upgrades:", err));
  }, []);

  const [driverId, setDriverId] = useState<string>("hamilton");
  
  const driver = useMemo(() => {
    return drivers.find((x) => x.id === driverId) || drivers[0] || DRIVERS_2026[0];
  }, [drivers, driverId]);

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

  const [simData, setSimData] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Update baseline state when driver, race or upgrades change
  useEffect(() => {
    const localBaseline = predictDriver({
      driver,
      gridPos: driver.qualifyingPos,
      form: driver.recentForm,
      race,
      upgrades,
    });
    setBaseline(localBaseline);

    fetch("http://127.0.0.1:8000/api/predict", {
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
        if (data && data.podium !== undefined) {
          setBaseline(data);
        }
      })
      .catch((err) => console.error("Error fetching baseline prediction:", err));
  }, [driver, race, upgrades]);

  // Update what-if prediction state when inputs change
  useEffect(() => {
    const localPred = predictDriver({ driver, gridPos, form, race, upgrades });
    setPrediction(localPred);

    const handler = setTimeout(() => {
      fetch("http://127.0.0.1:8000/api/predict", {
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
          if (data && data.podium !== undefined) {
            setPrediction(data);
          }
        })
        .catch((err) => console.error("Error fetching current prediction:", err));
    }, 150); // Debounce to avoid spamming the backend

    return () => clearTimeout(handler);
  }, [driver, gridPos, form, race, upgrades]);

  // Update Monte Carlo simulations
  useEffect(() => {
    setIsSimulating(true);
    fetch("http://127.0.0.1:8000/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grandPrix: race.name,
        wetnessFactor: 0.3,
        upgradeTeams: upgrades.filter(u => u.validated).map(u => u.team),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.rows) {
          setSimData(data);
        }
        setIsSimulating(false);
      })
      .catch((err) => {
        console.error("Error fetching simulation data:", err);
        setIsSimulating(false);
      });
  }, [race, upgrades]);

  const onDriverChange = (id: string) => {
    setDriverId(id);
    const d = drivers.find((x) => x.id === id) || DRIVERS_2026.find((x) => x.id === id);
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
            drivers={drivers}
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

        {/* Monte Carlo full-width */}
        <div className="mt-4 space-y-4">
          <MonteCarloCharts 
            race={race} 
            selectedDriverId={driverId} 
            drivers={drivers} 
            upgrades={upgrades} 
            simData={simData}
            isLoading={isSimulating}
          />
          <MonteCarloTable 
            race={race} 
            selectedDriverId={driverId} 
            drivers={drivers} 
            upgrades={upgrades} 
            simData={simData}
            isLoading={isSimulating}
          />
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
