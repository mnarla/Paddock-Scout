import { Link } from "@tanstack/react-router";
import { Award, TrendingUp, Compass, CheckCircle2, ArrowUpRight, History } from "lucide-react";

export function ModelTrackRecordCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card">
      {/* Header Strip */}
      <div className="border-b border-hairline bg-secondary/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Model Track Record
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-f1-green">
            <span className="h-1.5 w-1.5 rounded-full bg-f1-green animate-pulse" />
            2026 Walk-Forward Validated
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Calibrated Random Forest ensemble evaluated strictly on completed 2026 Grand Prix rounds.
        </p>
      </div>

      {/* 2x2 Telemetry Benchmark Grid */}
      <div className="grid grid-cols-2 divide-x divide-y divide-hairline border-b border-hairline">
        <div className="p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Award className="h-3.5 w-3.5 text-amber-400" />
            <span>Podium Hit Rate</span>
          </div>
          <p className="tabular mt-1 text-xl font-black tracking-tight text-foreground">66.7%</p>
          <p className="text-[10px] text-muted-foreground/80">2 of 3 podium spots identified</p>
        </div>

        <div className="p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-f1-green" />
            <span>Grid Alpha</span>
          </div>
          <p className="tabular mt-1 text-xl font-black tracking-tight text-f1-green">+4.8%</p>
          <p className="text-[10px] text-muted-foreground/80">Gain over pure qualifying grid</p>
        </div>

        <div className="p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-sky-400" />
            <span>Top-10 Accuracy</span>
          </div>
          <p className="tabular mt-1 text-xl font-black tracking-tight text-foreground">72.1%</p>
          <p className="text-[10px] text-muted-foreground/80">Points retention rate</p>
        </div>

        <div className="p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Compass className="h-3.5 w-3.5 text-purple-400" />
            <span>Brier Score</span>
          </div>
          <p className="tabular mt-1 text-xl font-black tracking-tight text-foreground">0.0812</p>
          <p className="text-[10px] text-muted-foreground/80">Probability calibration error</p>
        </div>
      </div>

      {/* Actions & Links */}
      <div className="space-y-2 p-3.5">
        {/* GitHub Button */}
        <a
          href="https://github.com/mnarla/Paddock-Scout"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex w-full items-center justify-between rounded border border-hairline bg-secondary/50 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-secondary cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <svg
              className="h-4 w-4 fill-current text-foreground transition-transform group-hover:scale-105"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>View Source on GitHub</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="tabular rounded bg-secondary-foreground/10 px-1.5 py-0.5 font-mono">
              v6.0
            </span>
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </a>

        {/* Historical Archive Link */}
        <Link
          to="/archive"
          className="group flex w-full items-center justify-between rounded border border-hairline/60 bg-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-hairline hover:bg-secondary/30 hover:text-foreground cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <History className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
            <span>Season Archive & Race Recaps</span>
          </div>
          <ArrowUpRight className="h-3 w-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
        </Link>
      </div>
    </div>
  );
}
