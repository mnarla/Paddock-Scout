// Mock cumulative championship points across the first 5 rounds of 2026.
// Pulled in spirit from results_2026_round01-05.csv in the Paddock-Scout repo.

import type { TeamId } from "./teams";

export interface ArchiveDriver {
  id: string;
  abbr: string;
  last: string;
  team: TeamId;
  // Cumulative points after each round (index 0 = after RD01).
  cumulative: number[];
}

export const ARCHIVE_ROUNDS = [
  { round: 1, short: "AUS", flag: "🇦🇺" },
  { round: 2, short: "CHN", flag: "🇨🇳" },
  { round: 3, short: "JPN", flag: "🇯🇵" },
  { round: 4, short: "MIA", flag: "🇺🇸" },
  { round: 5, short: "CAN", flag: "🇨🇦" },
];

export const ARCHIVE_DRIVERS: ArchiveDriver[] = [
  { id: "hamilton",       abbr: "HAM", last: "Hamilton",   team: "ferrari",  cumulative: [25, 51,  76, 118, 168] },
  { id: "antonelli",      abbr: "ANT", last: "Antonelli",  team: "mercedes", cumulative: [18, 43,  68, 110, 152] },
  { id: "max_verstappen", abbr: "VER", last: "Verstappen", team: "red_bull", cumulative: [15, 33,  58,  95, 140] },
  { id: "leclerc",        abbr: "LEC", last: "Leclerc",    team: "ferrari",  cumulative: [12, 30,  55,  88, 131] },
  { id: "russell",        abbr: "RUS", last: "Russell",    team: "mercedes", cumulative: [10, 24,  46,  78, 118] },
  { id: "norris",         abbr: "NOR", last: "Norris",     team: "mclaren",  cumulative: [ 8, 22,  44,  74, 109] },
  { id: "piastri",        abbr: "PIA", last: "Piastri",    team: "mclaren",  cumulative: [ 6, 18,  36,  64,  96] },
  { id: "hadjar",         abbr: "HAD", last: "Hadjar",     team: "red_bull", cumulative: [ 4, 12,  28,  48,  71] },
];

// Per-round podium (mock — used in the small archive table).
export const ARCHIVE_PODIUMS: { round: number; p1: string; p2: string; p3: string }[] = [
  { round: 1, p1: "HAM", p2: "ANT", p3: "VER" },
  { round: 2, p1: "ANT", p2: "HAM", p3: "LEC" },
  { round: 3, p1: "HAM", p2: "VER", p3: "ANT" },
  { round: 4, p1: "ANT", p2: "HAM", p3: "LEC" },
  { round: 5, p1: "HAM", p2: "ANT", p3: "VER" },
];
