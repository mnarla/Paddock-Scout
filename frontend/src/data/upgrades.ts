import type { TeamId } from "./teams";

export interface Upgrade {
  team: TeamId;
  component: string;
  category: "Aero" | "Power Unit" | "Suspension" | "Cooling";
  validated: boolean;          // confirmed via practice pace correlation
  paceDelta: number;           // seconds, negative = faster (0 for unconfirmed)
  source: string;
  url?: string;                // direct article link if available
  asOf?: string;               // e.g. "Azerbaijan GP"
  confirmed: boolean;          // true = real confirmed news report; false = no report yet
  status?: string;             // "VALID" | "UNVERIFIED" | "DEFECTIVE" | "PENDING" | "NEW_THIS_WEEKEND" | "ACTIVE_SPEC" | "STABLE_SPEC"
  isCurrentWeekend?: boolean;
  badge?: string;
}

// Static fallback shown before the /api/upgrades endpoint loads.
// All 11 constructors on the 2026 grid — honest PENDING for teams with no report.
export const UPGRADES: Upgrade[] = [
  // Confirmed entries will be replaced by live API data at runtime.
  // These are shown only if the API is unreachable.
  { team: "ferrari",      component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "mercedes",     component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "mclaren",      component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "red_bull",     component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "aston_martin", component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "alpine",       component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "williams",     component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "rb",           component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "haas",         component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "audi",         component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
  { team: "cadillac",     component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta: 0.00, source: "Awaiting reports", confirmed: false, status: "PENDING" },
];
