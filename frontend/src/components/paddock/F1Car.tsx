interface F1CarSideProps {
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  withSmoke?: boolean;
  withSparks?: boolean;
}

export function F1CarSide({
  color = "var(--f1-red, #e10600)",
  width = 44,
  height = 16,
  className = "",
  withSmoke = false,
  withSparks = false,
}: F1CarSideProps) {
  return (
    <svg
      viewBox="0 0 44 16"
      width={width}
      height={height}
      className={`f1-car-side ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="F1 Race Car"
    >
      {/* Smoke puffs when wheelspinning/launching */}
      {withSmoke && (
        <g className="f1-car__smoke-trail" aria-hidden="true">
          <circle cx="2" cy="11" r="2.5" fill="rgba(240,240,240,0.7)" className="smoke-puff smoke-1" />
          <circle cx="-1" cy="10" r="3.2" fill="rgba(240,240,240,0.5)" className="smoke-puff smoke-2" />
          <circle cx="-5" cy="8.5" r="4.2" fill="rgba(240,240,240,0.3)" className="smoke-puff smoke-3" />
        </g>
      )}

      {/* Titanium floor sparks */}
      {withSparks && (
        <g className="f1-car__sparks-trail" aria-hidden="true">
          <circle cx="1" cy="14" r="0.8" fill="#ffd15c" className="spark spark-1" />
          <circle cx="-2" cy="14.5" r="0.6" fill="#ff7a00" className="spark spark-2" />
          <circle cx="-5" cy="13.8" r="0.9" fill="#fff" className="spark spark-3" />
        </g>
      )}

      {/* Rear Wing Endplate & Wing */}
      <rect x="2" y="2" width="2" height="9.5" rx="0.5" fill="#1c1f1d" />
      <path d="M 3 3 L 6 3 L 6 6 L 3 6 Z" fill={color} />
      <rect x="3" y="6" width="1" height="5" fill="#0d0f0e" />

      {/* Shark Fin & Engine Cover */}
      <path d="M 5 6 L 15 3.5 L 18 8.5 L 5 8.5 Z" fill={color} />
      <path d="M 14 3.5 L 17 3.5 L 18 6.5 L 15 6.5 Z" fill="#0b0d0c" />

      {/* Driver & Cockpit */}
      <circle cx="19" cy="6.8" r="1.8" fill="#ffd700" />
      <path d="M 17 7 Q 19.5 4.8 22 7.2" stroke="#ffffff" strokeWidth="0.9" strokeLinecap="round" />

      {/* Chassis Body & Nose */}
      <path
        d="M 5 8.5 L 22 8.5 L 32 11 L 38 12 L 38 13.5 L 5 13.5 Z"
        fill={color}
      />
      {/* Front Nose Tip */}
      <path d="M 28 9 L 38 12 L 37.5 13.5 L 28 12.5 Z" fill={color} />

      {/* Front Wing Assembly */}
      <path d="M 35 12 L 41 12.5 L 41 14.5 L 35 14 Z" fill="#f5f2e8" />
      <rect x="40" y="11" width="1.8" height="4.2" rx="0.4" fill="#151715" />

      {/* Carbon Undertray / Floor */}
      <rect x="4" y="13.2" width="32" height="1" rx="0.3" fill="#090a09" />

      {/* Rear Tire & Rim */}
      <circle cx="9.5" cy="11.2" r="4.6" fill="#161816" stroke="#2c302d" strokeWidth="0.8" />
      <circle cx="9.5" cy="11.2" r="2.3" fill="#3f4340" />
      <circle cx="9.5" cy="11.2" r="1" fill={color} />

      {/* Front Tire & Rim */}
      <circle cx="33.5" cy="11.8" r="4" fill="#161816" stroke="#2c302d" strokeWidth="0.8" />
      <circle cx="33.5" cy="11.8" r="2" fill="#3f4340" />
      <circle cx="33.5" cy="11.8" r="0.9" fill={color} />
    </svg>
  );
}

export function F1CarTopDown({ color = "#ffffff" }: { color?: string }) {
  return (
    <g className="f1-car-top-down">
      {/* Rear Wing */}
      <rect x="-6" y="-3.6" width="1.8" height="7.2" rx="0.5" fill="#f5f2e8" />

      {/* Main Body Tub */}
      <path
        d="M -4.5 -2.2 L 0 -2.8 L 2.5 -2 L 5.5 -0.7 L 5.5 0.7 L 2.5 2 L 0 2.8 L -4.5 2.2 Z"
        fill={color}
      />

      {/* Halo / Cockpit */}
      <path d="M -0.5 -1 L 1.8 -0.8 L 1.8 0.8 L -0.5 1 Z" fill="#111311" />
      <circle cx="0.8" cy="0" r="1" fill="#ffd700" />

      {/* Front Wing */}
      <rect x="5.2" y="-3.4" width="1.4" height="6.8" rx="0.4" fill="#f5f2e8" />

      {/* Wheels */}
      <rect x="-4.8" y="-4.6" width="2.6" height="1.5" rx="0.4" fill="#111" />
      <rect x="-4.8" y="3.1" width="2.6" height="1.5" rx="0.4" fill="#111" />
      <rect x="2.6" y="-4.2" width="2.4" height="1.3" rx="0.4" fill="#111" />
      <rect x="2.6" y="2.9" width="2.4" height="1.3" rx="0.4" fill="#111" />
    </g>
  );
}

