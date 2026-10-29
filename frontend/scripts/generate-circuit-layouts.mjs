// Regenerate the bundled SVG paths from a pinned, MIT-licensed coordinate source.
import { writeFile } from "node:fs/promises";

const revision = "8094e957b8d6aa8b9f4510c93968556cccd30e02";
const base = `https://raw.githubusercontent.com/bacinger/f1-circuits/${revision}`;
const selected = new Set([
  "au-1953",
  "bh-2002",
  "cn-2004",
  "es-1991",
  "mc-1929",
  "ca-1978",
  "at-1969",
  "gb-1948",
  "hu-1986",
  "be-1925",
  "it-1922",
  "sg-2008",
  "jp-1962",
  "us-2012",
  "mx-1962",
  "br-1940",
  "ae-2009",
  "my-1999",
  "nl-1948",
  "sa-2021",
  "us-2022",
  "qa-2004",
  "es-2026",
  "az-2016",
  "us-2023",
]);

async function download(path) {
  const response = await fetch(`${base}/${path}`);
  if (!response.ok) throw new Error(`Circuit source returned HTTP ${response.status}`);
  return response.text();
}

// A local equirectangular projection corrects longitude for latitude. Uniform
// scaling preserves the circuit's proportions; SVG Y increases downwards.
function svgPath(coordinates) {
  const latitude = coordinates.reduce((sum, point) => sum + point[1], 0) / coordinates.length;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);
  const points = coordinates.map(([lon, lat]) => [lon * longitudeScale, -lat]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  if (!width || !height) throw new Error("Circuit geometry has no area");
  const scale = Math.min(216 / width, 116 / height);
  const offsetX = (240 - width * scale) / 2;
  const offsetY = (140 - height * scale) / 2;
  return (
    points
      .map(
        ([x, y], index) =>
          `${index ? "L" : "M"}${((x - minX) * scale + offsetX).toFixed(2)},${((y - minY) * scale + offsetY).toFixed(2)}`,
      )
      .join(" ") + " Z"
  );
}

const collection = JSON.parse(await download("f1-circuits.geojson"));
const layouts = collection.features
  .filter((feature) => selected.has(feature.properties.id))
  .map((feature) => {
    if (feature.geometry.type !== "LineString") throw new Error("Unsupported circuit geometry");
    return {
      id: feature.properties.id,
      name: feature.properties.Name,
      location: feature.properties.Location,
      viewBox: "0 0 240 140",
      path: svgPath(feature.geometry.coordinates),
    };
  });
if (layouts.length !== selected.size)
  throw new Error("A requested circuit is missing from the source");
await writeFile(
  new URL("../src/data/circuitLayouts.json", import.meta.url),
  JSON.stringify(layouts, null, 2) + "\n",
);
await writeFile(
  new URL("../public/circuit-data-license.txt", import.meta.url),
  await download("LICENSE.md"),
);
console.log(`Generated ${layouts.length} circuit layouts from ${revision}`);
