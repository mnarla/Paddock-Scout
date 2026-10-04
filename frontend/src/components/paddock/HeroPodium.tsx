import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";

export function HeroPodium({ drivers }: { drivers: Driver[] }) {
  const top3 = drivers.slice(0, 3);
  const odds = ["68%", "54%", "41%"];
  
  return (
    <div className="mb-6 relative z-10">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Race Forecast Podium</h2>
      <div className="flex gap-4">
        {top3.map((d, i) => {
          const team = TEAMS[d.team];
          return (
            <div key={d.id} className="flex-1 rounded-xl border border-hairline bg-card/60 p-5 relative overflow-hidden backdrop-blur-md shadow-lg transition hover:bg-card/80">
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: team?.color }} />
              <div className="text-6xl font-black opacity-[0.03] absolute -right-2 -bottom-4 italic">P{i + 1}</div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: team?.color }}>{team?.name}</p>
              <h3 className="text-xl sm:text-2xl font-bold">{d.first} <span className="text-foreground">{d.last}</span></h3>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Win Prob</p>
                  <p className="text-2xl font-mono font-bold">{odds[i]}</p>
                </div>
                <div className="text-4xl font-black italic tracking-tighter" style={{ color: team?.color }}>
                  P{i + 1}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
