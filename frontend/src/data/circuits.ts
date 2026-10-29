import layouts from "./circuitLayouts.json" with { type: "json" };
import type { RaceInfo } from "./calendar2026";

export type CircuitLayout = (typeof layouts)[number];

const aliases: Record<string, string[]> = {
  "au-1953": ["Australian Grand Prix", "Albert Park"],
  "bh-2002": ["Bahrain Grand Prix"],
  "cn-2004": ["Chinese Grand Prix"],
  "es-1991": ["Barcelona Grand Prix", "Barcelona-Catalunya Grand Prix", "Montmelo"],
  "mc-1929": ["Monaco Grand Prix", "Monte Carlo"],
  "ca-1978": ["Canadian Grand Prix", "Montreal", "Ile Notre Dame"],
  "at-1969": ["Austrian Grand Prix"],
  "gb-1948": ["British Grand Prix"],
  "hu-1986": ["Hungarian Grand Prix", "Mogyorod"],
  "be-1925": ["Belgian Grand Prix", "Spa", "Spa-Francorchamps"],
  "it-1922": ["Italian Grand Prix"],
  "sg-2008": ["Singapore Grand Prix", "Marina Bay"],
  "jp-1962": ["Japanese Grand Prix"],
  "us-2012": ["United States Grand Prix", "COTA"],
  "mx-1962": ["Mexico City Grand Prix", "Mexican Grand Prix", "Mexico"],
  "br-1940": ["São Paulo Grand Prix", "Brazilian Grand Prix", "Interlagos"],
  "ae-2009": ["Abu Dhabi Grand Prix", "Yas Island", "Abu Dhabi"],
  "my-1999": ["Malaysian Grand Prix", "Kuala Lumpur"],
  "nl-1948": ["Dutch Grand Prix"],
  "sa-2021": ["Saudi Arabian Grand Prix"],
  "us-2022": ["Miami Grand Prix"],
  "qa-2004": ["Qatar Grand Prix", "Losail"],
  "es-2026": ["Spanish Grand Prix", "Madrid Grand Prix", "Madring"],
  "az-2016": ["Azerbaijan Grand Prix"],
  "us-2023": ["Las Vegas Grand Prix"],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const byVenue = new Map<string, CircuitLayout>();
for (const layout of layouts) {
  for (const alias of [layout.location, layout.name, ...(aliases[layout.id] ?? [])]) {
    byVenue.set(normalize(alias), layout);
  }
}

// A venue takes precedence over the Grand Prix title: an event can move circuits.
export function getCircuitForRace(
  race: Partial<Pick<RaceInfo, "name" | "location" | "short" | "country">>,
): CircuitLayout | null {
  for (const venue of [race.location, race.short]) {
    const layout = venue ? byVenue.get(normalize(venue)) : undefined;
    if (layout) return layout;
  }
  if (race.location) return null;
  if (race.name === "Bahrain Grand Prix" && race.country === "Malaysia") {
    return byVenue.get(normalize("Sepang")) ?? null;
  }
  return race.name ? (byVenue.get(normalize(race.name)) ?? null) : null;
}
