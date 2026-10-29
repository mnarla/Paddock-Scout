import { useState, useMemo } from "react";
import { Award, Activity, CheckCircle2 } from "lucide-react";
import type { Driver } from "@/data/drivers2026";
import { TEAMS, type TeamId } from "@/data/teams";
import benchmarks from "@/data/benchmarks.json";

interface TowerFooterWidgetProps {
  drivers: Driver[];
}

export function TowerFooterWidget({ drivers }: TowerFooterWidgetProps) {
  const [activeTab, setActiveTab] = useState<"constructors" | "model">("constructors");

  const constructors = useMemo(() => {
    const pointsMap: Record<string, number> = {};
    for (const d of drivers) {
      pointsMap[d.team] = (pointsMap[d.team] || 0) + (d.seasonPoints || 0);
    }

    const teamEntries = (Object.keys(TEAMS) as TeamId[]).map((id) => {
      const team = TEAMS[id];
      return {
        id,
        name: team.name,
        short: team.short,
        color: team.color,
        points: pointsMap[id] || 0,
      };
    });

    teamEntries.sort((a, b) => b.points - a.points);
    return teamEntries;
  }, [drivers]);

  const maxPoints = constructors[0]?.points || 1;

  return (
    <div className="tower-footer">
      <div className="tower-footer__tabs" role="tablist" aria-label="Timing tower secondary view">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "constructors"}
          onClick={() => setActiveTab("constructors")}
          className={activeTab === "constructors" ? "is-active" : ""}
        >
          <Award className="h-3 w-3" aria-hidden="true" />
          <span>Constructors</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "model"}
          onClick={() => setActiveTab("model")}
          className={activeTab === "model" ? "is-active" : ""}
        >
          <Activity className="h-3 w-3" aria-hidden="true" />
          <span>Model Track Record</span>
        </button>
      </div>

      <div className="tower-footer__panel telemetry-scrollbar">
        {activeTab === "constructors" ? (
          <div className="wcc-list">
            <div className="wcc-header">
              <span>Pos</span>
              <span>Team</span>
              <span>Gap</span>
              <span className="text-right">Pts</span>
            </div>
            {constructors.map((team, idx) => {
              const gap = constructors[0].points - team.points;
              const barWidth = Math.max(4, Math.round((team.points / maxPoints) * 100));
              return (
                <div key={team.id} className="wcc-row">
                  <div
                    className="wcc-row__bar"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: `${team.color}18`,
                      borderLeft: `2px solid ${team.color}`,
                    }}
                    aria-hidden="true"
                  />
                  <div className="wcc-row__rank tabular font-mono">P{idx + 1}</div>
                  <div className="wcc-row__name">
                    <span className="wcc-badge" style={{ backgroundColor: team.color }} />
                    <strong>{team.name}</strong>
                  </div>
                  <div className="wcc-row__gap tabular font-mono">
                    {idx === 0 ? "Leader" : `-${gap}`}
                  </div>
                  <div className="wcc-row__points tabular font-mono font-bold">
                    {team.points}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="model-intel">
            <div className="model-intel__status">
              <span className="status-beacon" />
              <span>2026 Walk-Forward ({benchmarks.nRounds} Rounds)</span>
              <span className="model-intel__badge">V6.0 Calibrated</span>
            </div>

            <div className="model-intel__grid">
              <div className="model-intel__card">
                <span className="model-intel__label">Podium Hit Rate</span>
                <strong className="model-intel__value tabular font-mono text-emerald-400">
                  {benchmarks.podiumPct.toFixed(1)}%
                </strong>
                <span className="model-intel__sub text-emerald-400/90 font-mono">
                  +{benchmarks.podiumAlphaPct}% Alpha vs Grid
                </span>
              </div>

              <div className="model-intel__card">
                <span className="model-intel__label">Race Winner (P1)</span>
                <strong className="model-intel__value tabular font-mono text-white">
                  {benchmarks.winnerPct.toFixed(1)}%
                </strong>
                <span className="model-intel__sub font-mono">
                  {benchmarks.winnerHits} / {benchmarks.nRounds} Races
                </span>
              </div>

              <div className="model-intel__card">
                <span className="model-intel__label">Points (Top 10)</span>
                <strong className="model-intel__value tabular font-mono text-white">
                  {benchmarks.top10Pct.toFixed(1)}%
                </strong>
                <span className="model-intel__sub font-mono">
                  {benchmarks.top10Hits} / {benchmarks.totalTop10Slots} Cars
                </span>
              </div>

              <div className="model-intel__card">
                <span className="model-intel__label">Brier Multi-Class</span>
                <strong className="model-intel__value tabular font-mono text-rose-400">
                  {benchmarks.modelBrier}
                </strong>
                <span className="model-intel__sub text-rose-400/80">Beats 0.0841 Baseline</span>
              </div>
            </div>

            <div className="model-intel__footnote">
              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
              <span>Multi-session FP1–FP3 practice pace & aero upgrade regularized</span>
            </div>
          </div>
        )}
      </div>

      <p className="timing-tower__hint">Select a driver above to run race model</p>
    </div>
  );
}

