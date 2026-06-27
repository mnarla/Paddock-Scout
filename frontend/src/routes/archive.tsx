import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import { TEAMS } from "@/data/teams";
import {
  ARCHIVE_DRIVERS,
  ARCHIVE_PODIUMS,
  ARCHIVE_ROUNDS,
  type ArchiveDriver,
} from "@/data/archive";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Paddock Scout · Archive" },
      {
        name: "description",
        content:
          "Season archive — cumulative championship points across the 2026 rounds run so far.",
      },
      { property: "og:title", content: "Paddock Scout · Archive" },
      {
        property: "og:description",
        content: "Cumulative driver points across the 2026 season to date.",
      },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const [rounds, setRounds] = useState(ARCHIVE_ROUNDS);
  const [drivers, setDrivers] = useState<ArchiveDriver[]>(ARCHIVE_DRIVERS);
  const [podiums, setPodiums] = useState(ARCHIVE_PODIUMS);

  // States for detailed round view
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [activeTab, setActiveTab] = useState("Race");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/archive-progression")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.rounds) setRounds(data.rounds);
          if (data.drivers) setDrivers(data.drivers);
          if (data.podiums) setPodiums(data.podiums);
        }
      })
      .catch((err) => console.error("Error fetching archive progression:", err));
  }, []);

  // Fetch detailed round info when selectedRound changes
  useEffect(() => {
    if (selectedRound === null) {
      setSessionData(null);
      return;
    }
    setIsFetchingData(true);
    fetch(`http://127.0.0.1:8000/api/archive/${selectedRound}`)
      .then((res) => res.json())
      .then((data) => {
        setSessionData(data);
        setIsFetchingData(false);
        setActiveTab("Race"); // Reset to Race Results tab on change
      })
      .catch((err) => {
        console.error("Error fetching session data:", err);
        setIsFetchingData(false);
      });
  }, [selectedRound]);

  // Reshape into the row-per-round structure Recharts expects.
  const chartData = rounds.map((r, idx) => {
    const row: Record<string, number | string> = {
      label: `RD${String(r.round).padStart(2, "0")} ${r.short}`,
    };
    for (const d of drivers) {
      row[d.abbr] = d.cumulative[idx] !== undefined ? d.cumulative[idx] : 0;
    }
    return row;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-hairline bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <span className="tabular text-[11px] font-bold tracking-[0.2em] text-f1-red">
            ARCHIVE
          </span>
          <div className="hidden h-6 w-px bg-hairline sm:block" />
          <h1 className="text-sm font-bold tracking-tight sm:text-base">
            2026 SEASON · CHAMPIONSHIP PROGRESSION
          </h1>
          <div className="ml-auto">
            <Link
              to="/"
              className="rounded-sm border border-hairline px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-f1-red hover:text-foreground"
            >
              ← Live
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <section className="rounded-md border border-hairline bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Cumulative Points
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Rounds 1–{rounds.length} · top {drivers.length} drivers · team-coloured lines
              </p>
            </div>
            <span className="tabular text-[10px] uppercase tracking-wider text-muted-foreground">
              {rounds.length} rounds archived
            </span>
          </div>

          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="plainline"
                />
                {drivers.map((d) => (
                  <Line
                    key={d.id}
                    type="monotone"
                    dataKey={d.abbr}
                    stroke={TEAMS[d.team]?.color || "#ffffff"}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: TEAMS[d.team]?.color || "#ffffff" }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-4 rounded-md border border-hairline bg-card p-4 sm:p-5">
          <div className="mb-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Podiums by Round
            </h2>
            <p className="text-[11px] text-muted-foreground/60">
              Click on a round below to view its full session telemetry details.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 text-left font-semibold">Round</th>
                  <th className="px-2 py-2 text-left font-semibold">P1</th>
                  <th className="px-2 py-2 text-left font-semibold">P2</th>
                  <th className="px-2 py-2 text-left font-semibold">P3</th>
                </tr>
              </thead>
              <tbody>
                {podiums.map((row) => {
                  const meta = rounds.find((r) => r.round === row.round);
                  if (!meta) return null;
                  const isSel = selectedRound === row.round;
                  return (
                    <tr 
                      key={row.round} 
                      onClick={() => setSelectedRound(isSel ? null : row.round)}
                      className={`border-b border-hairline/60 last:border-0 cursor-pointer transition ${
                        isSel ? "bg-f1-red/[0.08]" : "hover:bg-secondary/40"
                      }`}
                    >
                      <td className="tabular px-2 py-2 text-muted-foreground">
                        <span className="mr-2">{meta.flag}</span>
                        RD{String(row.round).padStart(2, "0")} · {meta.short}
                      </td>
                      <td className="tabular px-2 py-2 font-bold text-f1-red">{row.p1}</td>
                      <td className="tabular px-2 py-2 font-semibold">{row.p2}</td>
                      <td className="tabular px-2 py-2 font-semibold text-muted-foreground">{row.p3}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {selectedRound !== null && (
          <section className="mt-4 rounded-md border border-hairline bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-hairline pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">
                  📁 {rounds.find((r) => r.round === selectedRound)?.name.toUpperCase()} · SESSION TELEMETRY
                </h2>
                <p className="text-[11px] text-muted-foreground">Round {selectedRound} · Actual Recorded Data</p>
              </div>
              <button 
                onClick={() => setSelectedRound(null)}
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground border border-hairline rounded px-2.5 py-1"
              >
                Close [X]
              </button>
            </div>

            {isFetchingData ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Loading session data...</div>
            ) : sessionData ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5 border-b border-hairline/65 pb-2">
                  {["Race", "Qualifying", "Practice", ...(sessionData.sprint && sessionData.sprint.length > 0 ? ["Sprint"] : [])].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                        activeTab === tab 
                          ? "bg-f1-red text-white" 
                          : "text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      {tab === "Race" ? "🏁 Race Results" : tab === "Qualifying" ? "⏱️ Qualifying Grid" : tab === "Practice" ? "📊 Practice Pace" : "⚡ Sprint Results"}
                    </button>
                  ))}
                </div>

                {activeTab === "Race" && (
                  <div className="overflow-x-auto">
                    {sessionData.race_results.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">No race data available for this round.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-hairline text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="px-2 py-2 text-left w-12">Pos</th>
                            <th className="px-2 py-2 text-left">Driver</th>
                            <th className="px-2 py-2 text-left">Team</th>
                            <th className="px-2 py-2 text-center">Grid</th>
                            <th className="px-2 py-2 text-center">Gain</th>
                            <th className="px-2 py-2 text-center">Laps</th>
                            <th className="px-2 py-2 text-left">Status</th>
                            <th className="px-2 py-2 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionData.race_results.map((row: any) => (
                            <tr key={row.DriverId} className="border-b border-hairline/60 last:border-0 hover:bg-secondary/20">
                              <td className="tabular px-2 py-2 font-bold">{row.Medal || row.Position}</td>
                              <td className="px-2 py-2 font-semibold">{row.FullName}</td>
                              <td className="px-2 py-2 text-xs text-muted-foreground">{row.TeamName}</td>
                              <td className="tabular px-2 py-2 text-center">{row.GridPosition}</td>
                              <td className="tabular px-2 py-2 text-center text-xs font-semibold">{row["Positions Gained"] || "–"}</td>
                              <td className="tabular px-2 py-2 text-center">{row.Laps}</td>
                              <td className="px-2 py-2 text-xs text-muted-foreground">{row.Status}</td>
                              <td className="tabular px-2 py-2 text-right font-bold text-f1-red">{row.Points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === "Qualifying" && (
                  <div className="overflow-x-auto">
                    {sessionData.qualifying.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">No qualifying data available for this round.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-hairline text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="px-2 py-2 text-left w-12">Grid</th>
                            <th className="px-2 py-2 text-left">Driver</th>
                            <th className="px-2 py-2 text-left">Team</th>
                            <th className="px-2 py-2 text-center">Q1</th>
                            <th className="px-2 py-2 text-center">Q2</th>
                            <th className="px-2 py-2 text-center">Q3</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionData.qualifying.map((row: any) => (
                            <tr key={row.DriverId} className="border-b border-hairline/60 last:border-0 hover:bg-secondary/20">
                              <td className="tabular px-2 py-2 font-bold">P{row.Position}</td>
                              <td className="px-2 py-2 font-semibold">{row.FullName}</td>
                              <td className="px-2 py-2 text-xs text-muted-foreground">{row.TeamName}</td>
                              <td className="tabular px-2 py-2 text-center text-xs">{row.Q1 || "–"}</td>
                              <td className="tabular px-2 py-2 text-center text-xs">{row.Q2 || "–"}</td>
                              <td className="tabular px-2 py-2 text-center text-xs">{row.Q3 || "–"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === "Practice" && (
                  <div className="overflow-x-auto">
                    {sessionData.practice.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">No practice pace telemetry available.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-hairline text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="px-2 py-2 text-left w-12">Rank</th>
                            <th className="px-2 py-2 text-left">Driver</th>
                            <th className="px-2 py-2 text-left">Team</th>
                            <th className="px-2 py-2 text-right">Practice Avg Position</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionData.practice.map((row: any, idx: number) => (
                            <tr key={row.FullName} className="border-b border-hairline/60 last:border-0 hover:bg-secondary/20">
                              <td className="tabular px-2 py-2 font-bold">{idx + 1}</td>
                              <td className="px-2 py-2 font-semibold">{row.FullName}</td>
                              <td className="px-2 py-2 text-xs text-muted-foreground">{row.TeamName}</td>
                              <td className="tabular px-2 py-2 text-right font-semibold text-f1-green">{row["FP Avg Pos"]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === "Sprint" && (
                  <div className="overflow-x-auto">
                    {sessionData.sprint.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">No sprint results available for this round.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-hairline text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="px-2 py-2 text-left w-12">Pos</th>
                            <th className="px-2 py-2 text-left">Driver</th>
                            <th className="px-2 py-2 text-left">Team</th>
                            <th className="px-2 py-2 text-center">Grid</th>
                            <th className="px-2 py-2 text-center">Laps</th>
                            <th className="px-2 py-2 text-left">Status</th>
                            <th className="px-2 py-2 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionData.sprint.map((row: any) => (
                            <tr key={row.DriverId} className="border-b border-hairline/60 last:border-0 hover:bg-secondary/20">
                              <td className="tabular px-2 py-2 font-bold">{row.Medal || row.Position}</td>
                              <td className="px-2 py-2 font-semibold">{row.FullName}</td>
                              <td className="px-2 py-2 text-xs text-muted-foreground">{row.TeamName}</td>
                              <td className="tabular px-2 py-2 text-center">{row.GridPosition}</td>
                              <td className="tabular px-2 py-2 text-center">{row.Laps}</td>
                              <td className="px-2 py-2 text-xs text-muted-foreground">{row.Status}</td>
                              <td className="tabular px-2 py-2 text-right font-bold text-f1-red">{row.Points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">No data found for this round.</div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
