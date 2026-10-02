import { API_BASE_URL } from "@/lib/config";

export interface WeekendSession {
  name: string;
  shortName: string;
  utcTime: string;
}

export interface RaceInfo {
  round: number;
  name: string;
  short: string;
  country: string;
  flag: string;
  trackType: "Permanent" | "Street";
  date: string; // ISO YYYY-MM-DD
  isSprint: boolean;
  sessions?: WeekendSession[];
}

export async function fetchCalendar(): Promise<RaceInfo[]> {
  const res = await fetch(`${API_BASE_URL}/api/calendar`);
  if (!res.ok) throw new Error("Failed to fetch calendar");
  return res.json();
}

export async function fetchNextRace(): Promise<RaceInfo> {
  const res = await fetch(`${API_BASE_URL}/api/next-race`);
  if (!res.ok) throw new Error("Failed to fetch next race");
  return res.json();
}

// Initial fallback used before the /api/next-race endpoint returns
export const NEXT_RACE: RaceInfo = {
  round: 16,
  name: "Bahrain Grand Prix",
  short: "Sakhir",
  country: "Bahrain",
  flag: "🇧🇭",
  trackType: "Permanent",
  date: "2026-10-04",
  isSprint: false,
  sessions: [
    { name: "Practice 1", shortName: "FP1", utcTime: "2026-10-02T04:30:00Z" },
    { name: "Practice 2", shortName: "FP2", utcTime: "2026-10-02T08:00:00Z" },
    { name: "Practice 3", shortName: "FP3", utcTime: "2026-10-03T04:30:00Z" },
    { name: "Qualifying", shortName: "Qualifying", utcTime: "2026-10-03T08:00:00Z" },
    { name: "Race", shortName: "Grand Prix", utcTime: "2026-10-04T07:00:00Z" },
  ],
};
