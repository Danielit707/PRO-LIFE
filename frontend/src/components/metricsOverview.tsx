import React, { useState } from 'react';
import { Crosshair, Orbit, Layers, Maximize2, Copy, Check } from 'lucide-react';
import { GeometryAnalysis } from '../types';

interface MetricsOverviewProps {
  analysis: GeometryAnalysis | null;
  isLoading: boolean;
  computeTimeMs?: number | null;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  analysis,
  isLoading,
  computeTimeMs,
}) => {
  const [copied, setCopied] = useState(false);

  if (!analysis) {
    return (
      <div id="metrics-placeholder" className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
        <p className="text-slate-400 text-sm">Load protein coordinates to calculate centroid & geometry.</p>
      </div>
    );
  }

  const [cx, cy, cz] = analysis.centroid;
  const centroidFormatted = `[${cx.toFixed(4)}, ${cy.toFixed(4)}, ${cz.toFixed(4)}]`;

  const copyCentroid = () => {
    navigator.clipboard.writeText(centroidFormatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="metrics-overview-panel" className="space-y-4">
      {/* Primary Centroid Display */}
      <div
        id="centroid-metric-card"
        className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-cyan-500/30 shadow-lg relative overflow-hidden"
      >
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Crosshair className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Computed 3D Centroid
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {computeTimeMs !== null && computeTimeMs !== undefined && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {computeTimeMs}ms
              </span>
            )}
            <button
              id="btn-copy-centroid"
              onClick={copyCentroid}
              title="Copy centroid coordinates"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mt-2">
          <div id="centroid-x-card" className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="block text-[11px] font-mono text-cyan-400/80 mb-0.5">X Axis</span>
            <span className="text-lg font-bold font-mono text-white tracking-tight">{cx.toFixed(4)}</span>
            <span className="text-[10px] text-slate-500 block">Ångströms (Å)</span>
          </div>
          <div id="centroid-y-card" className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="block text-[11px] font-mono text-emerald-400/80 mb-0.5">Y Axis</span>
            <span className="text-lg font-bold font-mono text-white tracking-tight">{cy.toFixed(4)}</span>
            <span className="text-[10px] text-slate-500 block">Ångströms (Å)</span>
          </div>
          <div id="centroid-z-card" className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="block text-[11px] font-mono text-amber-400/80 mb-0.5">Z Axis</span>
            <span className="text-lg font-bold font-mono text-white tracking-tight">{cz.toFixed(4)}</span>
            <span className="text-[10px] text-slate-500 block">Ångströms (Å)</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div id="metric-atom-count" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs">Atom Count</span>
          </div>
          <span className="text-base font-semibold text-slate-100 font-mono">
            {analysis.count.toLocaleString()}
          </span>
        </div>

        <div id="metric-radius-gyration" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Orbit className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs">Radius of Gyration</span>
          </div>
          <span className="text-base font-semibold text-slate-100 font-mono">
            {analysis.radiusOfGyration.toFixed(2)} Å
          </span>
        </div>

        <div id="metric-bounding-dim" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs">Span (ΔX×ΔY×ΔZ)</span>
          </div>
          <span className="text-xs font-medium text-slate-200 font-mono block truncate">
            {analysis.boundingBox.dimensions.map((d) => d.toFixed(1)).join(' × ')} Å
          </span>
        </div>
      </div>
    </div>
  );
};
