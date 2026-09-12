import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { RaceInfo } from "@/data/calendar2026";

interface Props {
  race: RaceInfo;
}

interface WeekendSession {
  name: string;
  shortName: string;
  time: number;
}

function getWeekendSessions(raceDateIso: string, isSprint: boolean): WeekendSession[] {
  // Base date is Sunday race day at 14:00 local
  const sunday = new Date(raceDateIso + "T14:00:00");
  const sundayMs = sunday.getTime();
  const DAY_MS = 86_400_000;
  const HOUR_MS = 3_600_000;

  if (isSprint) {
    return [
      { name: "Practice 1", shortName: "FP1", time: sundayMs - 2 * DAY_MS - 1.5 * HOUR_MS }, // Fri 12:30
      { name: "Sprint Qualifying", shortName: "Sprint Shootout", time: sundayMs - 2 * DAY_MS + 2.5 * HOUR_MS }, // Fri 16:30
      { name: "Sprint Race", shortName: "Sprint", time: sundayMs - 1 * DAY_MS - 2 * HOUR_MS }, // Sat 12:00
      { name: "Grand Prix Qualifying", shortName: "Qualifying", time: sundayMs - 1 * DAY_MS + 2 * HOUR_MS }, // Sat 16:00
      { name: "Grand Prix Race", shortName: "Grand Prix", time: sundayMs }, // Sun 14:00
    ];
  }

  return [
    { name: "Practice 1", shortName: "FP1", time: sundayMs - 2 * DAY_MS - 1.5 * HOUR_MS }, // Fri 12:30
    { name: "Practice 2", shortName: "FP2", time: sundayMs - 2 * DAY_MS + 2 * HOUR_MS }, // Fri 16:00
    { name: "Practice 3", shortName: "FP3", time: sundayMs - 1 * DAY_MS - 1.5 * HOUR_MS }, // Sat 12:30
    { name: "Qualifying", shortName: "Qualifying", time: sundayMs - 1 * DAY_MS + 2 * HOUR_MS }, // Sat 16:00
    { name: "Grand Prix Race", shortName: "Grand Prix", time: sundayMs }, // Sun 14:00
  ];
}

function useCountdown(raceDateIso: string, isSprint: boolean = false) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sessions = getWeekendSessions(raceDateIso, isSprint);
  // Find the first upcoming session
  const nextSession = sessions.find((s) => s.time > now) ?? sessions[sessions.length - 1];

  const diff = Math.max(0, nextSession.time - now);
  const d = Math.floor(diff / 86400_000);
  const h = Math.floor((diff / 3600_000) % 24);
  const m = Math.floor((diff / 60_000) % 60);
  const s = Math.floor((diff / 1000) % 60);

  return {
    sessionName: nextSession.shortName,
    fullName: nextSession.name,
    isComplete: nextSession.time <= now,
    d,
    h,
    m,
    s,
  };
}

export function LiveBanner({ race }: Props) {
  const c = useCountdown(race.date, !!race.isSprint);
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6 sm:py-4 relative">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
          <span className="text-base font-black tracking-[0.25em] text-f1-red uppercase">
            Paddock Scout
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="live-pulse inline-block h-2.5 w-2.5 rounded-full bg-f1-red shadow-[0_0_10px_var(--color-f1-red)]" />
          <span className="tabular text-[11px] font-bold tracking-[0.2em] text-f1-red">
            LIVE
          </span>
        </div>

        <div className="hidden h-6 w-px bg-hairline sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <span className="tabular shrink-0 rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground">
            RD {String(race.round).padStart(2, "0")}
          </span>
          <span className="text-xl shrink-0">{race.flag}</span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold leading-tight tracking-tight sm:text-base">
              {race.name.toUpperCase()}
            </h1>
            <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              {race.short} · {race.trackType}
              {race.isSprint && (
                <span className="ml-2 rounded-sm bg-f1-amber/15 px-1.5 py-px font-bold text-f1-amber">
                  SPRINT
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-1.5 md:flex">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Next: <strong className="text-foreground font-bold">{c.sessionName}</strong>
          </span>
          <span className="tabular ml-1.5 text-sm font-bold" suppressHydrationWarning>
            {String(c.d).padStart(2, "0")}d {String(c.h).padStart(2, "0")}:
            {String(c.m).padStart(2, "0")}:{String(c.s).padStart(2, "0")}
          </span>
        </div>

        <Link
          to="/archive"
          className="ml-2 rounded-sm border border-hairline px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-f1-red hover:text-foreground"
        >
          Archive
        </Link>
      </div>
    </header>
  );
}
