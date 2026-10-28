import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, RotateCcw, Sliders } from "lucide-react";
import type { RaceInfo } from "@/data/calendar2026";
import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import type { FeatureWeightsData } from "@/lib/useFeatureWeights";
import type { Prediction } from "@/lib/prediction";
import { useSessionCountdown } from "@/lib/useCountdown";
import { WhatIfPanel } from "./WhatIfPanel";
import { FeatureContribution } from "./FeatureContribution";

interface CockpitDashboardProps {
  race: RaceInfo;
  calendar?: RaceInfo[];
  drivers: Driver[];
  selectedDriver: Driver | null;
  onSelectDriver: (driverId: string | null) => void;
  prediction: Prediction | null;
  isPredicting: boolean;
  featureWeights: FeatureWeightsData;
  gridPos: number;
  form: number;
  onGridChange: (n: number) => void;
  onFormChange: (n: number) => void;
  onReset: () => void;
  isPostQuali?: boolean;
}

export function CockpitDashboard({
  race,
  calendar,
  drivers,
  selectedDriver,
  onSelectDriver,
  prediction,
  isPredicting,
  featureWeights,
  gridPos,
  form,
  onGridChange,
  onFormChange,
  onReset,
  isPostQuali,
}: CockpitDashboardProps) {
  const [activePanel, setActivePanel] = useState<"simulator" | "weights">("simulator");
  const countdown = useSessionCountdown(race, calendar);
  const team = selectedDriver ? TEAMS[selectedDriver.team] : null;
  const teamColor = team?.color ?? "#e10600";
  const winPct = prediction?.p1 !== undefined ? prediction.p1 * 100 : null;
  const top2Pct = prediction?.p2 !== undefined ? prediction.p2 * 100 : null;
  const podiumPct = prediction?.p3 !== undefined ? prediction.p3 * 100 : null;

  const selectFromKeyboard = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectDriver(id);
    }
  };

  return (
    <section className="timing-console" style={{ "--team-accent": teamColor } as CSSProperties}>
      <div className="console-header">
        <div className="console-event">
          <span className="console-event__round tabular">
            R{String(race.round).padStart(2, "0")}
          </span>
          <div>
            <h1>{race.name}</h1>
            <p>
              {race.country} · {race.trackType} circuit
            </p>
          </div>
        </div>
        <div className="console-header__status">
          <span>
            <i className="status-beacon" /> Model online
          </span>
          <strong className="tabular">V6.0</strong>
        </div>
      </div>

      <div className="console-grid">
        <aside className="race-control-spine" aria-label="Race control information">
          <div className="spine-code">{race.short}</div>
          <dl>
            <div>
              <dt>Round</dt>
              <dd>
                {race.round}/{calendar?.length || 24}
              </dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{race.isSprint ? "Sprint" : "Grand Prix"}</dd>
            </div>
            <div>
              <dt>Track</dt>
              <dd>{race.trackType}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>Live</dd>
            </div>
          </dl>
          {countdown && !countdown.isComplete && (
            <div className="spine-session">
              <span>Next session</span>
              <strong>{countdown.sessionName}</strong>
              <em className="tabular">
                {countdown.d > 0 ? `${countdown.d}D ` : ""}
                {String(countdown.h).padStart(2, "0")}:{String(countdown.m).padStart(2, "0")}
              </em>
            </div>
          )}
          <svg
            className="spine-track"
            viewBox="0 0 160 92"
            role="img"
            aria-label="Abstract circuit telemetry line"
          >
            <path d="M18 58C13 35 31 17 52 24c18 6 14 28 33 29 20 1 20-27 42-24 20 3 25 31 9 43-16 12-32-6-48-3-19 4-31 19-49 10-10-5-17-12-21-21Z" />
            <circle cx="18" cy="58" r="3" />
          </svg>
        </aside>

        <section className="timing-tower" aria-label="Driver standings">
          <div className="section-strip">
            <h2>Championship order</h2>
            <span className="tabular">{drivers.length} cars</span>
          </div>
          <div className="timing-tower__scroll telemetry-scrollbar">
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th>Form</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => {
                  const driverTeam = TEAMS[driver.team];
                  const selected = selectedDriver?.id === driver.id;
                  return (
                    <tr
                      key={driver.id}
                      tabIndex={0}
                      role="button"
                      aria-pressed={selected}
                      onClick={() => onSelectDriver(driver.id)}
                      onKeyDown={(event) => selectFromKeyboard(event, driver.id)}
                      className={selected ? "is-selected" : ""}
                      style={{ "--driver-team": driverTeam?.color ?? "#777" } as CSSProperties}
                    >
                      <td className="tabular">P{driver.standingsRank}</td>
                      <td>
                        <strong>{driver.abbr}</strong>
                        <span>{driver.last}</span>
                      </td>
                      <td>{driverTeam?.short ?? driver.team}</td>
                      <td className="tabular">{driver.recentForm?.toFixed(1) ?? "–"}</td>
                      <td className="tabular">{driver.seasonPoints ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="timing-tower__hint">Select a driver to run the race model</p>
        </section>

        <section className="prediction-stage" aria-live="polite">
          {selectedDriver ? (
            <>
              <div className="driver-identity">
                <div>
                  <span>
                    {team?.name} · Car {selectedDriver.number}
                  </span>
                  <h2>
                    {selectedDriver.first} <strong>{selectedDriver.last}</strong>
                  </h2>
                </div>
                <button type="button" onClick={() => onSelectDriver(null)}>
                  Clear driver
                </button>
              </div>
              <div className={`hero-probability ${isPredicting ? "is-calculating" : ""}`}>
                <div className="hero-probability__label">Podium probability</div>
                <div className="hero-probability__value tabular">
                  {isPredicting ? (
                    <span>RUNNING MODEL</span>
                  ) : podiumPct !== null ? (
                    <>
                      {podiumPct.toFixed(1)}
                      <sup>%</sup>
                    </>
                  ) : (
                    <>—</>
                  )}
                </div>
                <div className="prediction-sweep" aria-hidden="true" />
                <div className="probability-support">
                  <div>
                    <span>Win / P1</span>
                    <strong className="tabular">
                      {winPct !== null ? `${winPct.toFixed(1)}%` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Top two</span>
                    <strong className="tabular">
                      {top2Pct !== null ? `${top2Pct.toFixed(1)}%` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>
                      {gridPos !== selectedDriver.qualifyingPos
                        ? "Scenario grid"
                        : isPostQuali
                          ? "Recorded grid"
                          : "Assumed grid"}
                    </span>
                    <strong className="tabular">P{gridPos}</strong>
                  </div>
                  <div>
                    <span>Form index</span>
                    <strong className="tabular">{form.toFixed(1)}</strong>
                  </div>
                </div>
              </div>
              <div className="panel-switcher" role="tablist" aria-label="Prediction details">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanel === "simulator"}
                  onClick={() => setActivePanel("simulator")}
                  className={activePanel === "simulator" ? "is-active" : ""}
                >
                  <Sliders aria-hidden="true" /> Scenario controls
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanel === "weights"}
                  onClick={() => setActivePanel("weights")}
                  className={activePanel === "weights" ? "is-active" : ""}
                >
                  <Activity aria-hidden="true" /> Model influence
                </button>
              </div>
              <div className="prediction-detail telemetry-scrollbar">
                {activePanel === "simulator" ? (
                  <WhatIfPanel
                    driver={selectedDriver}
                    gridPos={gridPos}
                    form={form}
                    onDriverChange={onSelectDriver}
                    onGridChange={onGridChange}
                    onFormChange={onFormChange}
                    onReset={onReset}
                    drivers={drivers}
                    isPostQuali={isPostQuali}
                  />
                ) : (
                  <FeatureContribution prediction={prediction} featureWeights={featureWeights} />
                )}
              </div>
            </>
          ) : (
            <div className="driver-empty-state">
              <span className="driver-empty-state__line" aria-hidden="true" />
              <p>Prediction channel idle</p>
              <h2>
                Select a driver.
                <br />
                Run the race.
              </h2>
              <p className="driver-empty-state__copy">
                Choose any driver from the championship order to calculate win, top-two, and podium
                probabilities against the current race-weekend context.
              </p>
              <div className="quick-select">
                {drivers.slice(0, 4).map((driver) => (
                  <button key={driver.id} type="button" onClick={() => onSelectDriver(driver.id)}>
                    <span style={{ background: TEAMS[driver.team]?.color }} />
                    {driver.abbr}
                    <small>P{driver.standingsRank}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="console-footer">
        <span>Model outputs are informational forecasts, not betting advice.</span>
        <div>
          {selectedDriver && (
            <button type="button" onClick={onReset}>
              <RotateCcw aria-hidden="true" /> Reset scenario
            </button>
          )}
          <Link to="/archive">
            View model archive <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </section>
  );
}
