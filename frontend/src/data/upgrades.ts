import type { TeamId } from "./teams";

export interface Upgrade {
  team: TeamId;
  component: string;
  category: "Aero" | "Power Unit" | "Suspension" | "Cooling";
  validated: boolean;          // confirmed via practice pace correlation
  paceDelta: number;           // seconds, negative = faster (0 for unconfirmed)
  source: string;
  asOf?: string;               // e.g. "Italian GP" or "Dutch GP"
  confirmed: boolean;          // true = real confirmed news report; false = no report yet
}

export const UPGRADES: Upgrade[] = [
  // Confirmed, source-cited technical upgrades
  { team: "ferrari",      component: "Floor v3 — Vortex Reset",      category: "Aero",        validated: true,  paceDelta: -0.18, source: "F1Technical",   asOf: "Italian GP", confirmed: true },
  { team: "mercedes",     component: "Rear Wing — Mexico Spec",      category: "Aero",        validated: true,  paceDelta: -0.12, source: "Motorsport.com", asOf: "Italian GP", confirmed: true },
  { team: "mclaren",      component: "MGU-K Mapping Update",          category: "Power Unit",  validated: false, paceDelta:  0.04, source: "The Race",        asOf: "Italian GP", confirmed: true },
  { team: "red_bull",     component: "Front Suspension Geometry",     category: "Suspension",  validated: true,  paceDelta: -0.09, source: "F1Technical",   asOf: "Italian GP", confirmed: true },
  { team: "williams",     component: "Sidepod Inlet — Hot Climate",   category: "Cooling",     validated: true,  paceDelta: -0.06, source: "Autosport",     asOf: "Italian GP", confirmed: true },
  { team: "alpine",       component: "Beam Wing Revision",            category: "Aero",        validated: false, paceDelta:  0.02, source: "Motorsport.com", asOf: "Italian GP", confirmed: true },

  // Honest placeholders: teams with no confirmed upgrade reports
  { team: "aston_martin", component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta:  0.00, source: "Awaiting reports",  asOf: "Italian GP", confirmed: false },
  { team: "rb",           component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta:  0.00, source: "Awaiting reports",  asOf: "Italian GP", confirmed: false },
  { team: "haas",         component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta:  0.00, source: "Awaiting reports",  asOf: "Italian GP", confirmed: false },
  { team: "audi",         component: "No confirmed upgrade data yet", category: "Aero",        validated: false, paceDelta:  0.00, source: "Awaiting reports",  asOf: "Italian GP", confirmed: false },
];


