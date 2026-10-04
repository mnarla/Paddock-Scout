import { useState, useEffect } from "react";
import type { RaceInfo } from "@/data/calendar2026";

export interface CountdownState {
  prefix?: string;
  sessionName: string;
  isComplete: boolean;
  d: number;
  h: number;
  m: number;
  s: number;
}

export function useSessionCountdown(
  race?: RaceInfo,
  calendar?: RaceInfo[]
): CountdownState | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!race && (!calendar || calendar.length === 0)) return null;

  interface SessionEntry {
    prefix?: string;
    name: string;
    shortName: string;
    time: number;
  }

  const allSessions: SessionEntry[] = [];

  const addRaceSessions = (r: RaceInfo, usePrefix: boolean) => {
    if (r.sessions && r.sessions.length > 0) {
      for (const s of r.sessions) {
        allSessions.push({
          prefix: usePrefix ? (r.short || r.name).toUpperCase() : undefined,
          name: s.name,
          shortName: s.shortName,
          time: new Date(s.utcTime).getTime(),
        });
      }
    } else {
      allSessions.push({
        prefix: usePrefix ? (r.short || r.name).toUpperCase() : undefined,
        name: "Grand Prix",
        shortName: "Race",
        time: new Date(r.date + "T14:00:00Z").getTime(),
      });
    }
  };

  if (race) {
    addRaceSessions(race, false);
  }

  if (calendar && calendar.length > 0) {
    const sorted = [...calendar].sort((a, b) => a.round - b.round);
    for (const r of sorted) {
      if (!race || r.round > race.round) {
        addRaceSessions(r, true);
      }
    }
  }

  const nextSession = allSessions.find((s) => s.time > now);

  if (!nextSession) {
    return {
      sessionName: "Season Complete",
      isComplete: true,
      d: 0,
      h: 0,
      m: 0,
      s: 0,
    };
  }

  const diff = Math.max(0, nextSession.time - now);
  const d = Math.floor(diff / 86400_000);
  const h = Math.floor((diff / 3600_000) % 24);
  const m = Math.floor((diff / 60_000) % 60);
  const s = Math.floor((diff / 1000) % 60);

  return {
    prefix: nextSession.prefix,
    sessionName: nextSession.shortName,
    isComplete: false,
    d,
    h,
    m,
    s,
  };
}
