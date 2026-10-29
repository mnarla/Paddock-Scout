# Circuit outlines

`circuitLayouts.json` contains local SVG path data for the 23 current championship
venues, plus Sakhir and Jeddah. Maps are selected by physical venue before event
name, so a relocated event does not accidentally display its original circuit.

Source: [Tomislav Bacinger's f1-circuits](https://github.com/bacinger/f1-circuits),
revision `8094e957b8d6aa8b9f4510c93968556cccd30e02`, under the MIT license.
The complete license is bundled at `/circuit-data-license.txt`.

To regenerate from the pinned coordinate source:

```sh
node scripts/generate-circuit-layouts.mjs
```

The generator projects the geographic coordinates into a north-up SVG view box,
corrects longitude for latitude, and preserves the circuit's proportions. It does
not invent a start/finish location from the first coordinate. These are unofficial
outline maps, not surveyed or live telemetry. New or modified layouts require a
reviewed source update, regeneration, and an alias if their venue name is new.

Run the dependency-free selection tests with:

```sh
node --test src/data/circuits.test.mjs
```
