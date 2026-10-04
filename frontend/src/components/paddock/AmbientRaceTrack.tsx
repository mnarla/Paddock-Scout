import type * as React from "react";

export function AmbientRaceTrack() {
  /**
   * Refined Circuit Centerline Path (1560 x 840 viewBox):
   * Generously scaled, deliberate closed loop that completely surrounds
   * the central cockpit dashboard with ~96px top/bottom and ~254px side clearance:
   * - Top Main Straight (y: 24, length: 680px)
   * - Sweeping Carousel Turn 1 & 2 (Right lobe, apex at x: 1534, y: 420)
   * - Bottom High-Speed Straight (y: 816, length: 680px)
   * - Parabolica Hairpin Turn 3 & 4 (Left lobe, apex at x: 26, y: 420)
   * - C1 tangent continuity with zero wobbles, gracefully framing the entire dashboard.
   */
  const C =
    "M 440,24 L 1120,24 C 1340,24 1534,190 1534,420 C 1534,650 1340,816 1120,816 L 440,816 C 220,816 26,650 26,420 C 26,190 220,24 440,24 Z";

  const racerPathStyle: React.CSSProperties = {
    offsetPath: `path('${C}')`,
    offsetRotate: "auto",
  };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%+240px)] sm:w-[calc(100%+320px)] lg:w-[1480px] xl:w-[1560px] h-[calc(100%+160px)] sm:h-[calc(100%+200px)] lg:h-[820px] xl:h-[860px] max-w-[99vw] max-h-[96vh] z-0 flex items-center justify-center overflow-visible"
    >
      <svg
        className="w-full h-full overflow-visible"
        viewBox="0 0 1560 840"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Subtle dual-color track gradient: F1 Rose Red into Telemetry Cyan */}
          <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* Halved blur radius soft glow filter */}
          <filter id="trackGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Racer 1 Trail (Crimson Red) */}
          <linearGradient id="trail-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0" />
            <stop offset="60%" stopColor="#f43f5e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0.95" />
          </linearGradient>

          {/* Racer 2 Trail (Telemetry Amber / Coral) */}
          <linearGradient id="trail-amber" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.95" />
          </linearGradient>

          {/* Racer 3 Trail (Telemetry Cyan) */}
          <linearGradient id="trail-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0" />
            <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Layer 1: Soft ambient glow halo (subtle, non-distracting) */}
        <path
          d={C}
          fill="none"
          stroke="url(#trackGrad)"
          strokeWidth="6"
          opacity="0.32"
          filter="url(#trackGlow)"
        />

        {/* Layer 2: Clean, thin bright track line (2.5px) */}
        <path
          d={C}
          fill="none"
          stroke="url(#trackGrad)"
          strokeWidth="2.5"
          opacity="0.88"
        />

        {/* Layer 3: Subtle apex dashed centerline */}
        <path
          d={C}
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.8"
          opacity="0.25"
          strokeDasharray="6 14"
        />

        {/* ── CONTINUOUS MOVING RACERS ON CENTERLINE OFFSET-PATH ── */}

        {/* Racer 1: Crimson Red (14s lap) */}
        <g className="track-racer track-racer-red" style={racerPathStyle}>
          {/* Fading trail */}
          <line
            x1="-42"
            y1="0"
            x2="0"
            y2="0"
            stroke="url(#trail-red)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <line
            x1="-26"
            y1="0"
            x2="0"
            y2="0"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.8"
          />
          {/* Outer halo */}
          <circle cx="0" cy="0" r="14" fill="#f43f5e" opacity="0.35" filter="url(#trackGlow)" />
          {/* Main body */}
          <circle cx="0" cy="0" r="8" fill="#f43f5e" />
          {/* Inner core */}
          <circle cx="0" cy="0" r="5" fill="#fda4af" />
          {/* Bright center point */}
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>

        {/* Racer 2: Amber Gold (18s lap) */}
        <g className="track-racer track-racer-coral" style={racerPathStyle}>
          {/* Fading trail */}
          <line
            x1="-42"
            y1="0"
            x2="0"
            y2="0"
            stroke="url(#trail-amber)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <line
            x1="-26"
            y1="0"
            x2="0"
            y2="0"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.8"
          />
          {/* Outer halo */}
          <circle cx="0" cy="0" r="14" fill="#f59e0b" opacity="0.35" filter="url(#trackGlow)" />
          {/* Main body */}
          <circle cx="0" cy="0" r="8" fill="#f59e0b" />
          {/* Inner core */}
          <circle cx="0" cy="0" r="5" fill="#fde68a" />
          {/* Bright center point */}
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>

        {/* Racer 3: Telemetry Cyan (22s lap) */}
        <g className="track-racer track-racer-cyan" style={racerPathStyle}>
          {/* Fading trail */}
          <line
            x1="-42"
            y1="0"
            x2="0"
            y2="0"
            stroke="url(#trail-cyan)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <line
            x1="-26"
            y1="0"
            x2="0"
            y2="0"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.8"
          />
          {/* Outer halo */}
          <circle cx="0" cy="0" r="14" fill="#0ea5e9" opacity="0.35" filter="url(#trackGlow)" />
          {/* Main body */}
          <circle cx="0" cy="0" r="8" fill="#0ea5e9" />
          {/* Inner core */}
          <circle cx="0" cy="0" r="5" fill="#bae6fd" />
          {/* Bright center point */}
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}
