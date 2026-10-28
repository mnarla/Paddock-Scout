# Design System

## Direction

Paddock Scout uses a broadcast timing-graphics system crossed with a pit-wall engineering terminal. The interface is an operational race instrument: dense, direct, restrained, and organized by timing-board rules rather than floating dashboard cards.

## Differentiation Anchor

The persistent red race-control spine combines the circuit code, round, format, track type, live model state, and an authored circuit telemetry line. It is the product's recognizable signature across prediction, calendar, technical, and archive surfaces.

## Typography

- Barlow Condensed 600/700: display titles, race names, navigation, driver identities, and major probability figures.
- IBM Plex Sans 400/500/600: interface copy and supporting information.
- JetBrains Mono 400/500/700: times, probabilities, standings, inputs, and other measured data.

Avoid tiny uppercase text for explanatory copy. Uppercase condensed or mono text is reserved for short labels and operational status.

## Color

- Base: near-black `#090a0a` and panel black `#111312`.
- Primary ink: warm white `#f3f1e9`.
- Global action/status accent: race red `#e10600`.
- Contextual accent: the currently selected constructor color.
- Amber and green appear only for waiting/warning and ready/success semantics.

Do not distribute several decorative accent colors at equal visual weight. Do not use purple SaaS gradients or decorative glass surfaces.

## Geometry and Layout

- Use continuous surfaces, shared rules, and adjoining cells.
- Corners stay square; hierarchy comes from line weight, proportion, and contrast.
- The main prediction is asymmetrically dominant.
- Cards are reserved for content that genuinely separates from the timing surface.
- The desktop prediction surface uses a race-control spine, timing tower, and prediction stage. On mobile these stack in that order.

## Motion

- The console enters once with a horizontal timing-board reveal.
- A single telemetry sweep communicates active model calculation.
- Live status may blink subtly.
- Respect `prefers-reduced-motion`; do not add perpetual decorative motion.

## Interaction

- Team color marks the current driver and model context.
- Keyboard focus uses a visible red outline.
- Driver rows are keyboard-selectable.
- Empty states give a direct next action and a short contender list.
- Loading text names the real operation: running the model.

## Responsive Behavior

- At tablet widths, the race-control spine becomes a horizontal status rail.
- At phone widths, lower-priority standings columns are removed and all four primary destinations remain available in a fixed bottom navigation bar.
- Major outcomes remain large and readable; supporting metrics become a two-column grid.

## Evidence and News

- Label pre-qualifying grid inputs as assumed; label edited inputs as scenarios. Recorded qualifying positions must come from the current round's ingested data, with a note that penalties can change the starting grid.
- The Paddock separates FIA-declared component changes from dated technical reporting and team news. An FIA declaration records a change and its intended purpose, not a verified performance gain.
- Every news item and declaration links to its source. Show refresh times, unavailable documents, and saved-data states explicitly.
- Keep cancelled dates in calendar change history rather than adding them to numbered championship rounds. Event names and physical venues are separate facts.
