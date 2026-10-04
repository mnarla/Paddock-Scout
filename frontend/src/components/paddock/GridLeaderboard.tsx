import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";

export function GridLeaderboard({ drivers, onSelectDriver }: { drivers: Driver[], onSelectDriver: (id: string) => void }) {
  // Sort by championship standings for now
  const sorted = [...drivers].sort((a, b) => a.standingsRank - b.standingsRank);
  
  return (
    <div className="rounded-xl border border-hairline bg-card/60 backdrop-blur-md overflow-hidden relative z-10">
      <div className="border-b border-hairline px-5 py-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Grid Forecast Leaderboard</h2>
      </div>
      <div className="divide-y divide-hairline">
        {sorted.map((d, i) => {
          const team = TEAMS[d.team];
          const mockWinProb = Math.max(5, 70 - i * 5); // Just a placeholder for visual effect until prediction integration
          return (
            <button
              key={d.id}
              onClick={() => onSelectDriver(d.id)}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-secondary/40 transition text-left group"
            >
              <div className="w-6 text-center tabular font-mono text-sm font-bold text-muted-foreground">{i + 1}</div>
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: team?.color }} />
              <div className="w-48 font-bold">
                {d.first} <span className="text-foreground">{d.last}</span>
              </div>
              <div className="w-24 text-xs font-bold uppercase tracking-widest text-muted-foreground" style={{ color: team?.color }}>
                {team?.short}
              </div>
              <div className="flex-1 max-w-md mx-auto hidden md:block">
                <div className="h-2 rounded-full bg-secondary overflow-hidden relative">
                  <div 
                    className="absolute top-0 left-0 h-full transition-all" 
                    style={{ width: `${mockWinProb}%`, backgroundColor: team?.color }} 
                  />
                </div>
              </div>
              <div className="w-16 text-right tabular font-mono font-bold">{mockWinProb}%</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
