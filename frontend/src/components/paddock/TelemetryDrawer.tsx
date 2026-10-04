import type { Driver } from "@/data/drivers2026";
import { TEAMS } from "@/data/teams";
import { WhatIfPanel } from "./WhatIfPanel";
import { FeatureContribution } from "./FeatureContribution";
import type { Prediction } from "@/lib/prediction";
import type { FeatureWeightsData } from "@/lib/useFeatureWeights";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver | null;
  prediction: Prediction | null;
  baseline: Prediction | null;
  isPredicting: boolean;
  featureWeights: FeatureWeightsData;
  gridPos: number;
  form: number;
  onGridChange: (n: number) => void;
  onFormChange: (n: number) => void;
  onReset: () => void;
}

export function TelemetryDrawer({
  isOpen, onClose, driver, prediction, baseline, isPredicting, featureWeights, gridPos, form, onGridChange, onFormChange, onReset
}: Props) {
  if (!driver) return null;
  const team = TEAMS[driver.team];

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-card/95 backdrop-blur-xl border-l border-hairline z-50 transform transition-transform duration-300 ease-out overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="sticky top-0 bg-card/90 backdrop-blur-md px-6 py-4 border-b border-hairline flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: team?.color }} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Telemetry Inspector</p>
              <h2 className="text-xl font-bold mt-1">{driver.first} <span className="text-foreground">{driver.last}</span></h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Milestone Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="border border-hairline rounded-lg p-3 bg-secondary/20">
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Win</p>
              <p className="text-xl font-mono font-bold" style={{ color: "var(--color-f1-red)" }}>
                {prediction?.p1 ? `${(prediction.p1 * 100).toFixed(1)}%` : '--'}
              </p>
            </div>
            <div className="border border-hairline rounded-lg p-3 bg-secondary/20">
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Top 2</p>
              <p className="text-xl font-mono font-bold" style={{ color: "#c0c0c8" }}>
                {prediction?.p2 ? `${(prediction.p2 * 100).toFixed(1)}%` : '--'}
              </p>
            </div>
            <div className="border border-hairline rounded-lg p-3 bg-secondary/20">
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Podium</p>
              <p className="text-xl font-mono font-bold" style={{ color: "#cd7f32" }}>
                {prediction?.p3 ? `${(prediction.p3 * 100).toFixed(1)}%` : '--'}
              </p>
            </div>
          </div>

          <WhatIfPanel
            driver={driver}
            gridPos={gridPos}
            form={form}
            onDriverChange={() => {}} // Disabled driver change in drawer
            onGridChange={onGridChange}
            onFormChange={onFormChange}
            onReset={onReset}
          />
          
          <FeatureContribution prediction={prediction} featureWeights={featureWeights} />
        </div>
      </div>
    </>
  );
}
