import type { RaceInfo } from "@/data/calendar2026";
import { getCircuitForRace } from "@/data/circuits";

export function CircuitMap({ race }: { race: RaceInfo }) {
  const circuit = getCircuitForRace(race);

  return (
    <figure className="spine-track" data-circuit-id={circuit?.id}>
      {circuit ? (
        <svg viewBox={circuit.viewBox} role="img" aria-label={`${circuit.name} circuit layout`}>
          <path d={circuit.path} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <p className="spine-track__unavailable">Circuit layout unavailable</p>
      )}
      <figcaption>{circuit?.name ?? race.location ?? race.short}</figcaption>
    </figure>
  );
}
