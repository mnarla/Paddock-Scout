import { Link } from "@tanstack/react-router";
import type { RaceInfo } from "@/data/calendar2026";

import { useSessionCountdown } from "@/lib/useCountdown";

export type NavTab = "home" | "schedule" | "upgrades";

interface PillNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  race?: RaceInfo;
  calendar?: RaceInfo[];
}

const TABS: { id: NavTab; label: string }[] = [
  { id: "home", label: "Dashboard" },
  { id: "schedule", label: "Schedule" },
  { id: "upgrades", label: "Upgrades" },
];

export function PillNav({ activeTab, onSelectTab, race, calendar }: PillNavProps) {
  const c = useSessionCountdown(race, calendar);

  return (
    <header className="fixed top-5 left-0 right-0 z-50 flex justify-center px-4 pointer-events-auto">
      <nav className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-full bg-[#101422]/85 backdrop-blur-xl border border-slate-700/50 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {c && !c.isComplete && (
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 font-mono text-[10px] sm:text-[11px] border-r border-slate-700/60 mr-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span className="text-slate-400 font-sans font-bold uppercase truncate max-w-[80px] sm:max-w-none">
              {c.prefix ? `${c.prefix} ` : ""}{c.sessionName}:
            </span>
            <span className="text-rose-400 font-bold tabular shrink-0">
              {c.d > 0 ? `${c.d}d ` : ""}
              {String(c.h).padStart(2, "0")}h {String(c.m).padStart(2, "0")}m {String(c.s).padStart(2, "0")}s
            </span>
          </div>
        )}
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === t.id
                ? "bg-[#1f2638] text-white shadow-inner border border-slate-600/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
        <Link
          to="/archive"
          className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-all"
        >
          Archive
        </Link>
      </nav>
    </header>
  );
}
