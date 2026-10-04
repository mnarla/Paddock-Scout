import { Award, Compass, CheckCircle2, ArrowUpRight } from "lucide-react";
import benchmarks from "@/data/benchmarks.json";

export function ModelTrackRecordCard() {
  const {
    podiumHits,
    totalPodiumSlots,
    podiumPct,
    top10Pct,
    modelBrier,
    nRounds,
  } = benchmarks;

  const avgPerRace = nRounds > 0 ? Math.round((podiumHits / nRounds) * 10) / 10 : 0;
  const avgLabel = Number.isInteger(avgPerRace)
    ? `${avgPerRace}/3 podium spots`
    : `~${avgPerRace}/3 podium spots`;

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-[#0a0d14]/90 p-5 shadow-lg">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Model Track Record &amp; Validation
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              2026 Walk-Forward Validated
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Calibrated Random Forest ensemble evaluated strictly on completed 2026 Grand Prix rounds ({nRounds} rounds run to date).
          </p>
        </div>

        <a
          href="https://github.com/mnarla/Paddock-Scout"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg border border-slate-700/60 bg-slate-800/70 hover:bg-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:text-white transition shadow-sm"
        >
          <svg
            className="h-3.5 w-3.5 fill-current text-white"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
          <span>GitHub v6.0</span>
          <ArrowUpRight className="h-3 w-3 text-slate-400" />
        </a>
      </div>

      {/* 3 Telemetry Benchmark Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Podium accuracy */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-amber-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" />
              <span>Podium Accuracy</span>
            </span>
            <span className="font-mono text-xs">{podiumPct}%</span>
          </div>
          <div className="tabular text-2xl font-black font-mono text-white">
            {podiumHits} / {totalPodiumSlots}
          </div>
          <p className="text-[10px] text-amber-300/80 mt-1">Avg. {avgLabel}</p>
        </div>

        {/* Top-10 Accuracy */}
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-sky-400 mb-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Top-10 Accuracy</span>
            </span>
            <span className="font-mono text-xs">{top10Pct}%</span>
          </div>
          <div className="tabular text-2xl font-black font-mono text-white">
            {top10Pct}%
          </div>
          <p className="text-[10px] text-sky-300/80 mt-1">Points finishes correctly captured</p>
        </div>

        {/* Brier Score */}
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-purple-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              <span>Brier Score</span>
            </span>
            <span className="font-mono text-xs">Calibrated</span>
          </div>
          <div className="tabular text-2xl font-black font-mono text-white">
            {modelBrier}
          </div>
          <p className="text-[10px] text-purple-300/80 mt-1">Multi-class probability error (lower is better)</p>
        </div>
      </div>
    </section>
  );
}
