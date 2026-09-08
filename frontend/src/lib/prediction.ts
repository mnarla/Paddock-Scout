// JS port of the v6 calibration logic from src/simulator.py.
// This is a UI approximation — the real RandomForestClassifier stays in Python.
// To wire to your real model, replace `predictDriver` and `runMonteCarlo`
// with `fetch('/api/predict')` calls.

import type { Driver } from "@/data/drivers2026";
import { DRIVERS_2026 } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import type { RaceInfo } from "@/data/calendar2026";
import { UPGRADES, type Upgrade } from "@/data/upgrades";

// Calibrated feature importances from v6 model (sum < 1; rest is residual noise)
export const FEATURE_WEIGHTS = {
  Grid: 0.254,
  Standings: 0.181,
  CarRank: 0.147,
  Track: 0.082,
  RecentForm: 0.080,
  Practice: 0.060,
  Qualifying: 0.080,
  Momentum: 0.050,
  Upgrades: 0.040,
  Overtake: 0.030,
} as const;

export const FEATURE_LABELS: Record<keyof typeof FEATURE_WEIGHTS, string> = {
  Grid: "Grid Position",
  Standings: "Standings Rank",
  CarRank: "Car Rank",
  Track: "Track Type",
  RecentForm: "Recent Form",
  Practice: "Practice Pace",
  Qualifying: "Qualifying dominance",
  Momentum: "Weekend Momentum",
  Upgrades: "Vehicle Upgrades",
  Overtake: "Overtake Index",
};

export interface PredictionInput {
  driver: Driver;
  gridPos: number;
  form: number;        // blended weekend momentum (lower = better)
  race: RaceInfo;
}

export interface Prediction {
  p1: number;
  p2: number;
  p3: number;
  podium: number;      // P1+P2+P3
  contributions: { key: keyof typeof FEATURE_WEIGHTS; weight: number; value: number }[];
}

// Logistic squash
const sig = (x: number) => 1 / (1 + Math.exp(-x));

export function predictDriver({ driver, gridPos, form, race, upgrades }: PredictionInput & { upgrades?: Upgrade[] }): Prediction {
  const carRank = TEAMS[driver.team].carRank;
  const activeUpgrades = upgrades ?? UPGRADES;
  const upgradeBoost = activeUpgrades
    .filter((u) => u.team === driver.team)
    .reduce((acc, u) => {
      // In F1 telemetry, negative paceDelta means faster (saving time e.g. -0.20s -> boost)
      // Positive paceDelta means slower (correlation failure e.g. +0.18s -> penalty)
      return acc + (-u.paceDelta);
    }, 0);

  // Base score components — higher = better podium chance
  const gridScore      = Math.max(0, (11 - gridPos) / 10);                    // 1 at pole, 0 at 11+
  const standingsScore = Math.max(0, (11 - driver.standingsRank) / 10);
  const carScore       = Math.max(0, (11 - carRank) / 10);
  const trackScore     = race.trackType === "Street" ? 0.6 : 0.7;
  const sprintScore    = race.isSprint ? 2.5 * 0.4 : 0.4;

  // Form penalty (lower form = better — closer to P1)
  const formPenalty = (form - 1) / 19; // 0..1

  // Form factor: 1 is best, 11 is mid, 20 is worst
  const formFactor = (11 - form) / 10; // +1.0 at form 1, 0.0 at form 11, -0.9 at form 20

  let raw =
    FEATURE_WEIGHTS.Grid      * gridScore +
    FEATURE_WEIGHTS.Standings * standingsScore +
    FEATURE_WEIGHTS.CarRank   * carScore +
    FEATURE_WEIGHTS.Track     * trackScore +
    0.065                     * sprintScore +
    0.14                      * formFactor +
    0.15                      * upgradeBoost;

  // Grid penalty beyond top 3 and top 10 (podiums in F1 are heavily biased towards top rows)
  if (gridPos > 3) {
    raw -= (gridPos - 3) * 0.032;
  }
  if (gridPos > 10) {
    raw -= (gridPos - 10) * 0.04;
  }

  // Calibrated sigmoid mapped to realistic F1 podium rarity
  const podium = Math.min(0.92, Math.max(0.01, sig(4.8 * (raw - 0.46))));

  // F1 historical conversion: Win and Top 2 odds heavily favor front rows and championship leaders
  let winRatio = 0.01;
  let top2Ratio = 0.05;
  if (gridPos === 1) {
    winRatio = 0.58;
    top2Ratio = 0.82;
  } else if (gridPos === 2) {
    winRatio = 0.32;
    top2Ratio = 0.65;
  } else if (gridPos === 3) {
    winRatio = 0.16;
    top2Ratio = 0.45;
  } else if (gridPos <= 6) {
    winRatio = 0.06;
    top2Ratio = 0.22;
  } else if (gridPos <= 10) {
    winRatio = 0.015;
    top2Ratio = 0.08;
  }

  const standingFactor = Math.max(0.2, (12 - Math.min(11, driver.standingsRank)) / 11);
  const p1 = Math.min(0.95, Math.max(0.005, podium * winRatio * standingFactor));
  const p2 = Math.min(podium, Math.max(p1 * 1.15, podium * top2Ratio * standingFactor));
  const p3 = podium;

  return {
    p1,
    p2,
    p3,
    podium: p3, // Total cumulative chance of reaching the podium (Finish <= 3)
    contributions: [
      { key: "Grid",       weight: FEATURE_WEIGHTS.Grid,       value: gridScore },
      { key: "Standings",  weight: FEATURE_WEIGHTS.Standings,  value: standingsScore },
      { key: "CarRank",    weight: FEATURE_WEIGHTS.CarRank,    value: carScore },
      { key: "Track",      weight: FEATURE_WEIGHTS.Track,      value: trackScore },
      { key: "RecentForm", weight: FEATURE_WEIGHTS.RecentForm, value: 1 - formPenalty },
      { key: "Practice",   weight: FEATURE_WEIGHTS.Practice,   value: 0.5 },
      { key: "Qualifying", weight: FEATURE_WEIGHTS.Qualifying, value: 0.5 },
      { key: "Momentum",   weight: FEATURE_WEIGHTS.Momentum,   value: 0.5 },
      { key: "Upgrades",   weight: FEATURE_WEIGHTS.Upgrades,   value: upgradeBoost },
      { key: "Overtake",   weight: FEATURE_WEIGHTS.Overtake,   value: (15 - (gridPos - carRank)) / 25 },
    ],
  };
}

// Seeded RNG for reproducible Monte Carlo
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MonteCarloRow {
  driver: Driver;
  p1: number;
  p2: number;
  p3: number;
  podium: number;
}

const N_SIMULATIONS = 1000;
const NOISE_SCALE = 2.5; // realistic race-day chaos

// Box-Muller
function gauss(rand: () => number, sigma: number) {
  const u1 = Math.max(1e-9, rand());
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
}

export interface MonteCarloResult {
  rows: MonteCarloRow[];
  /** per-driver: count of times the driver finished in each position (index 0 = P1, 19 = P20) */
  positions: Record<string, number[]>;
  nSimulations: number;
}

export function runMonteCarloFull(race: RaceInfo, driversList?: Driver[], upgradesList?: Upgrade[], seed = 42): MonteCarloResult {
  const rand = mulberry32(seed);
  const activeDrivers = driversList ?? DRIVERS_2026;
  const activeUpgrades = upgradesList ?? UPGRADES;
  
  const tally: Record<string, { p1: number; p2: number; p3: number }> = {};
  const positions: Record<string, number[]> = {};
  for (const d of activeDrivers) {
    tally[d.id] = { p1: 0, p2: 0, p3: 0 };
    positions[d.id] = new Array(20).fill(0);
  }

  for (let sim = 0; sim < N_SIMULATIONS; sim++) {
    const scored = activeDrivers.map((d) => {
      const noisyForm = d.recentForm + gauss(rand, NOISE_SCALE);
      const wetSigma = race.trackType === "Street" ? 1.8 : 1.0;
      const noisyGrid = d.qualifyingPos + gauss(rand, 1.2 * wetSigma);
      const pred = predictDriver({
        driver: d,
        gridPos: Math.max(1, Math.min(20, Math.round(noisyGrid))),
        form: Math.max(1, Math.min(20, noisyForm)),
        race,
        upgrades: activeUpgrades
      });
      const dnf = rand() < 0.06;
      return { d, score: dnf ? -1 : pred.p3 + gauss(rand, 0.45) };
    }).sort((a, b) => b.score - a.score);

    tally[scored[0].d.id].p1 += 1;
    tally[scored[1].d.id].p2 += 1;
    tally[scored[2].d.id].p3 += 1;

    for (let pos = 0; pos < scored.length && pos < 20; pos++) {
      positions[scored[pos].d.id][pos] += 1;
    }
  }

  const rows = activeDrivers.map((d) => {
    const t = tally[d.id];
    return {
      driver: d,
      p1: t.p1 / N_SIMULATIONS,
      p2: t.p2 / N_SIMULATIONS,
      p3: t.p3 / N_SIMULATIONS,
      podium: (t.p1 + t.p2 + t.p3) / N_SIMULATIONS,
    };
  }).sort((a, b) => b.podium - a.podium);

  return { rows, positions, nSimulations: N_SIMULATIONS };
}

export function runMonteCarlo(race: RaceInfo, driversList?: Driver[], upgradesList?: Upgrade[], seed = 42): MonteCarloRow[] {
  return runMonteCarloFull(race, driversList, upgradesList, seed).rows;
}

export function getDriverMedianFinish(positions: number[]): number {
  const total = positions.reduce((a, b) => a + b, 0);
  if (!total) return 20;
  let cum = 0;
  for (let i = 0; i < positions.length; i++) {
    cum += positions[i];
    if (cum >= total / 2) return i + 1;
  }
  return 20;
}
