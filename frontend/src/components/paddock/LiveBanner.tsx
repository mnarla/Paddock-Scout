import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { RaceInfo } from "@/data/calendar2026";

interface Props {
  race: RaceInfo;
  onHome?: () => void;
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
      {
        name: "Sprint Qualifying",
        shortName: "Sprint Shootout",
        time: sundayMs - 2 * DAY_MS + 2.5 * HOUR_MS,
      }, // Fri 16:30
      { name: "Sprint Race", shortName: "Sprint", time: sundayMs - 1 * DAY_MS - 2 * HOUR_MS }, // Sat 12:00
      {
        name: "Grand Prix Qualifying",
        shortName: "Qualifying",
        time: sundayMs - 1 * DAY_MS + 2 * HOUR_MS,
      }, // Sat 16:00
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

export function LiveBanner({ race, onHome }: Props) {
  const c = useCountdown(race.date, !!race.isSprint);
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6 sm:py-4 relative">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
          <Link
            to="/"
            onClick={onHome}
            className="text-base font-black tracking-[0.25em] text-f1-red uppercase transition-opacity hover:opacity-80"
          >
            Paddock Scout
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="live-pulse inline-block h-2.5 w-2.5 rounded-full bg-f1-red shadow-[0_0_10px_var(--color-f1-red)]" />
          <span className="tabular text-[11px] font-bold tracking-[0.2em] text-f1-red">LIVE</span>
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

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            to="/"
            onClick={onHome}
            className="rounded-sm border border-hairline px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-f1-red hover:text-foreground cursor-pointer"
          >
            Home
          </Link>
          <Link
            to="/archive"
            className="rounded-sm border border-hairline px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-f1-red hover:text-foreground cursor-pointer"
          >
            Archive
          </Link>
          <a
            href="https://github.com/mnarla/Paddock-Scout"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-sm border border-hairline bg-secondary/30 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-foreground/50 hover:bg-secondary/70 hover:text-foreground cursor-pointer"
            title="View source on GitHub"
            aria-label="GitHub repository"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
