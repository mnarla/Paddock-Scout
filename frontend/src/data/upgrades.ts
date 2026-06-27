import type { TeamId } from "./teams";

export interface Upgrade {
  team: TeamId;
  component: string;
  category: "Aero" | "Power Unit" | "Suspension" | "Cooling";
  validated: boolean;          // confirmed via practice pace correlation
  paceDelta: number;           // seconds, negative = faster
  source: string;
}

export const UPGRADES: Upgrade[] = [
  { team: "ferrari",      component: "Floor v3 — Vortex Reset",      category: "Aero",        validated: true,  paceDelta: -0.18, source: "F1Technical" },
  { team: "mercedes",     component: "Rear Wing — Mexico Spec",      category: "Aero",        validated: true,  paceDelta: -0.12, source: "Motorsport.com" },
  { team: "mclaren",      component: "MGU-K Mapping Update",          category: "Power Unit",  validated: false, paceDelta:  0.04, source: "The Race" },
  { team: "red_bull",     component: "Front Suspension Geometry",     category: "Suspension",  validated: true,  paceDelta: -0.09, source: "F1Technical" },
  { team: "williams",     component: "Sidepod Inlet — Hot Climate",   category: "Cooling",     validated: true,  paceDelta: -0.06, source: "Autosport" },
  { team: "alpine",       component: "Beam Wing Revision",            category: "Aero",        validated: false, paceDelta:  0.02, source: "Motorsport.com" },
];
