import type { RaceInfo } from "@/data/calendar2026";
import { getCircuitForRace } from "@/data/circuits";
import { F1CarTopDown } from "./F1Car";

export function CircuitMap({ race }: { race: RaceInfo }) {
  const circuit = getCircuitForRace(race);
  const pathId = circuit ? `track-path-${circuit.id}` : "";

  return (
    <figure className="spine-track" data-circuit-id={circuit?.id}>
      {circuit ? (
        <svg viewBox={circuit.viewBox} role="img" aria-label={`${circuit.name} circuit layout`}>
          <path id={pathId} d={circuit.path} vectorEffect="non-scaling-stroke" />
          <g className="track-gps-beacon">
            <animateMotion dur="12s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#${pathId}`} />
            </animateMotion>
            <circle r="7" fill="rgba(255, 255, 255, 0.2)" className="track-car-glow" />
            <F1CarTopDown color="#ffffff" />
          </g>
        </svg>
      ) : (
        <p className="spine-track__unavailable">Circuit layout unavailable</p>
      )}
      <figcaption>{circuit?.name ?? race.location ?? race.short}</figcaption>
    </figure>
  );
}
