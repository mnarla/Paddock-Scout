import assert from "node:assert/strict";
import test from "node:test";
import { getCircuitForRace } from "./circuits.ts";

test("the outline changes when the upcoming weekend changes", () => {
  const mexico = getCircuitForRace({ name: "Mexico City Grand Prix", location: "Mexico City" });
  const brazil = getCircuitForRace({ name: "São Paulo Grand Prix", location: "São Paulo" });
  const vegas = getCircuitForRace({ name: "Las Vegas Grand Prix", location: "Las Vegas" });
  assert.match(mexico.name, /Hermanos Rodríguez/);
  assert.match(brazil.name, /Interlagos/);
  assert.notEqual(mexico.path, brazil.path);
  assert.notEqual(brazil.path, vegas.path);
});

test("the venue overrides a reused event name", () => {
  const relocated = getCircuitForRace({
    name: "Bahrain Grand Prix",
    location: "Kuala Lumpur",
    country: "Malaysia",
  });
  const original = getCircuitForRace({ name: "Bahrain Grand Prix", location: "Sakhir" });
  assert.equal(relocated.id, "my-1999");
  assert.equal(original.id, "bh-2002");
});

test("both Spanish circuits have separate outlines", () => {
  assert.equal(getCircuitForRace({ name: "Spanish Grand Prix", location: "Madrid" }).id, "es-2026");
  assert.equal(
    getCircuitForRace({ name: "Barcelona Grand Prix", location: "Barcelona" }).id,
    "es-1991",
  );
});

test("venue aliases handle accents, punctuation and fallback race data", () => {
  assert.equal(getCircuitForRace({ location: "Montréal" }).id, "ca-1978");
  assert.equal(getCircuitForRace({ location: "Spa-Francorchamps" }).id, "be-1925");
  assert.equal(getCircuitForRace({ short: "Marina Bay" }).id, "sg-2008");
  assert.equal(getCircuitForRace({ name: "Mexico City Grand Prix" }).id, "mx-1962");
});

test("an unknown venue has no invented circuit outline", () => {
  assert.equal(getCircuitForRace({ name: "New Grand Prix", location: "New circuit" }), null);
});

test("every current championship venue has a distinct local layout", () => {
  const venues = [
    "Melbourne",
    "Shanghai",
    "Suzuka",
    "Miami",
    "Montréal",
    "Monaco",
    "Barcelona",
    "Spielberg",
    "Silverstone",
    "Spa-Francorchamps",
    "Budapest",
    "Zandvoort",
    "Monza",
    "Madrid",
    "Baku",
    "Sepang",
    "Singapore",
    "Austin",
    "Mexico City",
    "São Paulo",
    "Las Vegas",
    "Lusail",
    "Yas Island",
  ];
  const circuits = venues.map((location) => getCircuitForRace({ location }));
  assert.equal(new Set(circuits.map((circuit) => circuit.id)).size, 23);
  for (const circuit of circuits) {
    assert.match(circuit.path, /^M[\d.]+,[\d.]+ L/);
    assert.ok(circuit.path.endsWith(" Z"));
    assert.ok(!/NaN|Infinity/.test(circuit.path));
  }
});
