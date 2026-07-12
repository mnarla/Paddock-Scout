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
  { round: 1, short: "AUS", flag: "🇦🇺", name: "Australian Grand Prix" },
  { round: 2, short: "CHN", flag: "🇨🇳", name: "Chinese Grand Prix" },
  { round: 3, short: "JPN", flag: "🇯🇵", name: "Japanese Grand Prix" },
  { round: 4, short: "MIA", flag: "🇺🇸", name: "Miami Grand Prix" },
  { round: 5, short: "CAN", flag: "🇨🇦", name: "Canadian Grand Prix" },
  { round: 6, short: "MON", flag: "🇲🇨", name: "Monaco Grand Prix" },
  { round: 7, short: "BAR", flag: "🇪🇸", name: "Barcelona Grand Prix" },
  { round: 8, short: "AUT", flag: "🇦🇹", name: "Austrian Grand Prix" },
  { round: 9, short: "GBR", flag: "🇬🇧", name: "British Grand Prix" },
];

export const ARCHIVE_DRIVERS: ArchiveDriver[] = [
  { id: "antonelli",      abbr: "ANT", last: "Antonelli",  team: "mercedes", cumulative: [18.0, 47.0, 72.0, 101.0, 132.0, 157.0, 157.0, 172.0, 180.0] },
  { id: "russell",        abbr: "RUS", last: "Russell",    team: "mercedes", cumulative: [25.0, 51.0, 63.0,  80.0,  88.0,  88.0, 106.0, 131.0, 154.0] },
  { id: "hamilton",       abbr: "HAM", last: "Hamilton",   team: "ferrari",  cumulative: [12.0, 33.0, 41.0,  52.0,  73.0,  91.0, 116.0, 126.0, 148.0] },
  { id: "leclerc",        abbr: "LEC", last: "Leclerc",    team: "ferrari",  cumulative: [15.0, 34.0, 49.0,  59.0,  75.0,  75.0,  75.0,  79.0, 108.0] },
  { id: "norris",         abbr: "NOR", last: "Norris",     team: "mclaren",  cumulative: [10.0, 15.0, 25.0,  51.0,  58.0,  58.0,  73.0,  79.0,  97.0] },
  { id: "piastri",        abbr: "PIA", last: "Piastri",    team: "mclaren",  cumulative: [ 0.0,  3.0, 21.0,  43.0,  48.0,  58.0,  68.0,  80.0,  82.0] },
  { id: "max_verstappen", abbr: "VER", last: "Verstappen", team: "red_bull", cumulative: [ 8.0,  8.0, 12.0,  24.0,  41.0,  41.0,  53.0,  71.0,  74.0] },
  { id: "hadjar",         abbr: "HAD", last: "Hadjar",     team: "red_bull", cumulative: [ 0.0,  4.0,  4.0,   4.0,  14.0,  26.0,  34.0,  42.0,  52.0] },
];

export const ARCHIVE_PODIUMS: { round: number; p1: string; p2: string; p3: string }[] = [
  { round: 1, p1: "RUS", p2: "ANT", p3: "LEC" },
  { round: 2, p1: "ANT", p2: "RUS", p3: "HAM" },
  { round: 3, p1: "ANT", p2: "PIA", p3: "LEC" },
  { round: 4, p1: "ANT", p2: "NOR", p3: "PIA" },
  { round: 5, p1: "ANT", p2: "HAM", p3: "VER" },
  { round: 6, p1: "ANT", p2: "HAM", p3: "GAS" },
  { round: 7, p1: "HAM", p2: "RUS", p3: "NOR" },
  { round: 8, p1: "RUS", p2: "VER", p3: "ANT" },
  { round: 9, p1: "LEC", p2: "RUS", p3: "HAM" },
];
