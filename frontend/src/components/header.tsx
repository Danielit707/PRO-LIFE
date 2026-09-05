import React from 'react';
import { Activity, ShieldCheck, Box, Terminal } from 'lucide-react';

interface HeaderProps {
  serverStatus: 'connected' | 'checking' | 'error';
  onOpenApiDocs: () => void;
}

export const Header: React.FC<HeaderProps> = ({ serverStatus, onOpenApiDocs }) => {
  return (
    <header id="app-header" className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
            <Box className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 id="app-title" className="text-lg font-bold text-slate-100 tracking-tight">
                PRO-LIFE
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                v0.1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              High-Performance 3D Protein Geometry & Centroid Engine
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div
            id="engine-status-badge"
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs"
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  serverStatus === 'connected'
                    ? 'bg-emerald-400'
                    : serverStatus === 'checking'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  serverStatus === 'connected'
                    ? 'bg-emerald-500'
                    : serverStatus === 'checking'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
            </span>
            <span className="text-slate-300 font-medium capitalize">
              Engine {serverStatus === 'connected' ? 'Online' : serverStatus}
            </span>
          </div>

          <button
            id="btn-api-inspector-toggle"
            onClick={onOpenApiDocs}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition text-xs font-medium cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>API Docs</span>
          </button>
        </div>
      </div>
    </header>
  );
};
