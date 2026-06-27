import type { TeamId } from "./teams";

export interface Driver {
  id: string;
  number: number;
  abbr: string;
  first: string;
  last: string;
  team: TeamId;
  standingsRank: number;   // current 2026 championship position
  seasonPoints: number;
  recentForm: number;      // avg finish over last 3 rounds (lower = better)
  qualifyingPos: number;   // last qualifying result (becomes default grid)
}

// Pulled from results_2026_round05.csv (Canadian GP) + reasonable extrapolation
export const DRIVERS_2026: Driver[] = [
  { id: "hamilton",       number: 44, abbr: "HAM", first: "Lewis",     last: "Hamilton",   team: "ferrari",      standingsRank: 1,  seasonPoints: 168, recentForm: 2.3, qualifyingPos: 1 },
  { id: "antonelli",      number: 12, abbr: "ANT", first: "Kimi",      last: "Antonelli",  team: "mercedes",     standingsRank: 2,  seasonPoints: 152, recentForm: 2.7, qualifyingPos: 2 },
  { id: "max_verstappen", number: 1,  abbr: "VER", first: "Max",       last: "Verstappen", team: "red_bull",     standingsRank: 3,  seasonPoints: 140, recentForm: 3.0, qualifyingPos: 3 },
  { id: "leclerc",        number: 16, abbr: "LEC", first: "Charles",   last: "Leclerc",    team: "ferrari",      standingsRank: 4,  seasonPoints: 131, recentForm: 4.3, qualifyingPos: 4 },
  { id: "russell",        number: 63, abbr: "RUS", first: "George",    last: "Russell",    team: "mercedes",     standingsRank: 5,  seasonPoints: 118, recentForm: 4.7, qualifyingPos: 6 },
  { id: "norris",         number: 4,  abbr: "NOR", first: "Lando",     last: "Norris",     team: "mclaren",      standingsRank: 6,  seasonPoints: 109, recentForm: 5.0, qualifyingPos: 5 },
  { id: "piastri",        number: 81, abbr: "PIA", first: "Oscar",     last: "Piastri",    team: "mclaren",      standingsRank: 7,  seasonPoints: 96,  recentForm: 6.3, qualifyingPos: 9 },
  { id: "hadjar",         number: 6,  abbr: "HAD", first: "Isack",     last: "Hadjar",     team: "red_bull",     standingsRank: 8,  seasonPoints: 71,  recentForm: 6.7, qualifyingPos: 7 },
  { id: "sainz",          number: 55, abbr: "SAI", first: "Carlos",    last: "Sainz",      team: "williams",     standingsRank: 9,  seasonPoints: 58,  recentForm: 8.7, qualifyingPos: 11 },
  { id: "alonso",         number: 14, abbr: "ALO", first: "Fernando",  last: "Alonso",     team: "aston_martin", standingsRank: 10, seasonPoints: 47,  recentForm: 9.3, qualifyingPos: 10 },
  { id: "albon",          number: 23, abbr: "ALB", first: "Alex",      last: "Albon",      team: "williams",     standingsRank: 11, seasonPoints: 41,  recentForm: 10.0, qualifyingPos: 13 },
  { id: "gasly",          number: 10, abbr: "GAS", first: "Pierre",    last: "Gasly",      team: "alpine",       standingsRank: 12, seasonPoints: 33,  recentForm: 10.7, qualifyingPos: 14 },
  { id: "lawson",         number: 30, abbr: "LAW", first: "Liam",      last: "Lawson",     team: "rb",           standingsRank: 13, seasonPoints: 28,  recentForm: 11.0, qualifyingPos: 12 },
  { id: "colapinto",      number: 43, abbr: "COL", first: "Franco",    last: "Colapinto",  team: "alpine",       standingsRank: 14, seasonPoints: 22,  recentForm: 11.7, qualifyingPos: 16 },
  { id: "bearman",        number: 87, abbr: "BEA", first: "Oliver",    last: "Bearman",    team: "haas",         standingsRank: 15, seasonPoints: 18,  recentForm: 12.3, qualifyingPos: 15 },
  { id: "stroll",         number: 18, abbr: "STR", first: "Lance",     last: "Stroll",     team: "aston_martin", standingsRank: 16, seasonPoints: 14,  recentForm: 13.0, qualifyingPos: 17 },
  { id: "ocon",           number: 31, abbr: "OCO", first: "Esteban",   last: "Ocon",       team: "haas",         standingsRank: 17, seasonPoints: 9,   recentForm: 13.7, qualifyingPos: 18 },
  { id: "tsunoda",        number: 22, abbr: "TSU", first: "Yuki",      last: "Tsunoda",    team: "rb",           standingsRank: 18, seasonPoints: 7,   recentForm: 14.3, qualifyingPos: 8 },
  { id: "hulkenberg",     number: 27, abbr: "HUL", first: "Nico",      last: "Hülkenberg", team: "sauber",       standingsRank: 19, seasonPoints: 3,   recentForm: 15.3, qualifyingPos: 19 },
  { id: "bortoleto",      number: 5,  abbr: "BOR", first: "Gabriel",   last: "Bortoleto",  team: "sauber",       standingsRank: 20, seasonPoints: 1,   recentForm: 16.0, qualifyingPos: 20 },
];

export function driverById(id: string): Driver {
  const d = DRIVERS_2026.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown driver: ${id}`);
  return d;
}
