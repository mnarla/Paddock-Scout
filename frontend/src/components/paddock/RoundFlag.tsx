interface RoundFlagProps {
  code: string;
  size?: number;
}

export function RoundFlag({ code, size = 22 }: RoundFlagProps) {
  const c = code.toUpperCase();

  return (
    <div
      className="inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden shadow-sm border border-slate-300/60"
      style={{ width: size, height: size }}
    >
      {c === "NL" && (
        <svg viewBox="0 0 30 30" className="w-full h-full">
          <rect y="0" width="30" height="10" fill="#ae1c28" />
          <rect y="10" width="30" height="10" fill="#ffffff" />
          <rect y="20" width="30" height="10" fill="#21468b" />
        </svg>
      )}

      {(c === "PAPAYA" || c === "MCLAREN") && (
        <svg viewBox="0 0 30 30" className="w-full h-full">
          <circle cx="15" cy="15" r="15" fill="#f47600" />
          <path d="M 9,15 C 9,10 18,7 22,12 C 18,12 14,15 14,18 C 14,21 18,21 21,19 C 18,23 9,21 9,15 Z" fill="#111111" />
        </svg>
      )}

      {c === "IT" && (
        <svg viewBox="0 0 30 30" className="w-full h-full">
          <rect x="0" width="10" height="30" fill="#009246" />
          <rect x="10" width="10" height="30" fill="#ffffff" />
          <rect x="20" width="10" height="30" fill="#ce2b37" />
        </svg>
      )}

      {c === "ES" && (
        <svg viewBox="0 0 30 30" className="w-full h-full">
          <rect y="0" width="30" height="8" fill="#aa151b" />
          <rect y="8" width="30" height="14" fill="#f1bf00" />
          <rect y="22" width="30" height="8" fill="#aa151b" />
        </svg>
      )}

      {c === "UK" && (
        <svg viewBox="0 0 30 30" className="w-full h-full bg-[#012169]">
          <path d="M 0,0 L 30,30 M 30,0 L 0,30" stroke="#ffffff" strokeWidth="4" />
          <path d="M 0,0 L 30,30 M 30,0 L 0,30" stroke="#c8102e" strokeWidth="2" />
          <path d="M 15,0 L 15,30 M 0,15 L 30,15" stroke="#ffffff" strokeWidth="6" />
          <path d="M 15,0 L 15,30 M 0,15 L 30,15" stroke="#c8102e" strokeWidth="3.5" />
        </svg>
      )}

      {(c === "US" || c === "USA" || c === "UR") && (
        <svg viewBox="0 0 30 30" className="w-full h-full bg-[#b22234]">
          <rect y="4" width="30" height="4" fill="#ffffff" />
          <rect y="12" width="30" height="4" fill="#ffffff" />
          <rect y="20" width="30" height="4" fill="#ffffff" />
          <rect width="14" height="16" fill="#3c3b6e" />
          <circle cx="7" cy="8" r="2" fill="#ffffff" />
        </svg>
      )}

      {c === "MC" && (
        <svg viewBox="0 0 30 30" className="w-full h-full">
          <rect y="0" width="30" height="15" fill="#ce1126" />
          <rect y="15" width="30" height="15" fill="#ffffff" />
        </svg>
      )}

      {c === "AU" && (
        <svg viewBox="0 0 30 30" className="w-full h-full bg-[#00008b]">
          <circle cx="21" cy="9" r="1.5" fill="#ffffff" />
          <circle cx="23" cy="18" r="1.5" fill="#ffffff" />
          <circle cx="16" cy="22" r="1.5" fill="#ffffff" />
          <circle cx="19" cy="14" r="1" fill="#ffffff" />
          <rect width="13" height="13" fill="#012169" />
          <path d="M 0,0 L 13,13 M 13,0 L 0,13" stroke="#ffffff" strokeWidth="2" />
          <path d="M 6.5,0 L 6.5,13 M 0,6.5 L 13,6.5" stroke="#c8102e" strokeWidth="1.5" />
        </svg>
      )}

      {!["NL", "PAPAYA", "MCLAREN", "IT", "ES", "UK", "US", "USA", "UR", "MC", "AU"].includes(c) && (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[9px] font-black text-slate-700">
          {c.slice(0, 2)}
        </div>
      )}
    </div>
  );
}
