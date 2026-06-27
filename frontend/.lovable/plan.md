## Add Monte Carlo charts above the table

Add two Recharts visualizations into a new `MonteCarloChart.tsx` component, rendered above the existing `MonteCarloTable` in `src/routes/index.tsx`. No changes to prediction logic.

### 1. Stacked podium bar (full field)
- Horizontal stacked bar chart, top 10 drivers by Σ podium %.
- Three stacked segments per row: P1 (F1 red), P2 (silver), P3 (bronze) — matches table color language.
- Y-axis: driver last name + team short tag, colored by team accent.
- Tooltip: P1/P2/P3 % + total podium %.
- Selected driver row highlighted with a left rail in team color.

### 2. Finishing-position distribution (selected driver)
- Bar histogram, x-axis = finishing position 1–20, y-axis = % of 1,000 sims.
- Bars 1–3 tinted F1 red (podium zone), bars 4–10 muted, bars 11–20 faded.
- Header shows selected driver name + median finish + podium %.
- Requires a small extension to `runMonteCarlo` to also tally **full finishing positions** (not just P1/P2/P3) — returns an additional `positions: Record<driverId, number[20]>` map. Existing return shape preserved (additive only).

### Layout
```text
[ stacked podium bar ]  [ distribution histogram ]
[          MonteCarloTable (unchanged)           ]
```
Two-column on desktop (≥1024px), stacked on mobile. Same `rounded-lg border border-hairline bg-card` shell as the table for visual consistency.

### Technical
- New file: `src/components/paddock/MonteCarloChart.tsx` (exports `PodiumStackChart` + `FinishDistributionChart`).
- `src/lib/prediction.ts`: extend `runMonteCarlo` to also record final sorted position for every driver each sim; export helper `getDriverPositionHistogram(rows, driverId)`.
- `src/routes/index.tsx`: insert the new chart row above `<MonteCarloTable />`, pass `race` + `selectedDriverId`.
- Recharts is already in the project (`src/components/ui/chart.tsx`) — no new deps.
