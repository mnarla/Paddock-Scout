import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { RaceInfo } from "@/data/calendar2026";
import { useSessionCountdown } from "@/lib/useCountdown";
import { F1CarSide } from "./F1Car";

export type NavTab = "home" | "schedule" | "upgrades";

interface PillNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  race?: RaceInfo;
  calendar?: RaceInfo[];
}

const TABS: { id: NavTab; label: string }[] = [
  { id: "home", label: "Prediction" },
  { id: "schedule", label: "Calendar" },
  { id: "upgrades", label: "Paddock" },
];

export function PillNav({ activeTab, onSelectTab, race, calendar }: PillNavProps) {
  const countdown = useSessionCountdown(race, calendar);
  const [turboBoost, setTurboBoost] = useState(false);

  const handleBrandClick = () => {
    onSelectTab("home");
    setTurboBoost(true);
    setTimeout(() => setTurboBoost(false), 4600);
  };

  return (
    <header className="race-masthead">
      <div className="race-masthead__inner">
        <button className="brand-lockup" type="button" onClick={handleBrandClick} title="Paddock Scout (Click to launch speed run!)">
          <img
            src="/icon.png"
            alt="Paddock Scout Logo"
            className="brand-mark"
            width={32}
            height={32}
          />
          <span>
            <strong>Paddock Scout</strong>
            <small>Race intelligence</small>
          </span>
        </button>

        {countdown && !countdown.isComplete && (
          <div className="session-clock" aria-label={`${countdown.sessionName} countdown`}>
            <span className="status-beacon" aria-hidden="true" />
            <span className="session-clock__label">{countdown.sessionName}</span>
            <strong className="tabular">
              {countdown.d > 0 ? `${countdown.d}D ` : ""}
              {String(countdown.h).padStart(2, "0")}:{String(countdown.m).padStart(2, "0")}:
              {String(countdown.s).padStart(2, "0")}
            </strong>
          </div>
        )}

        <nav className="race-nav" aria-label="Primary navigation">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => onSelectTab(tab.id)}
              className={activeTab === tab.id ? "is-active" : ""}
            >
              {tab.label}
            </button>
          ))}
          <Link to="/archive">Archive</Link>
        </nav>
      </div>

      {/* Pit straight animated car riding the red masthead line */}
      <div className={`masthead-pit-straight ${turboBoost ? "is-turbo" : ""}`} aria-hidden="true">
        <div className="masthead-racer">
          <F1CarSide width={36} height={13} color="#ffffff" withSparks withSmoke={turboBoost} />
        </div>
      </div>
    </header>
  );
}
