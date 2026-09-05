import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Viewport3D } from './components/Viewport3D';
import { MetricsOverview } from './components/MetricsOverview';
import { CoordinateInput } from './components/CoordinateInput';
import { ApiInspector } from './components/ApiInspector';
import { AtomRecord, GeometryAnalysis } from './types';
import { SAMPLE_STRUCTURES } from './data/samples';
import { Activity, Layers, Cpu } from 'lucide-react';

export const App: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<'connected' | 'checking' | 'error'>('checking');
  const [coordinates, setCoordinates] = useState<number[][]>([]);
  const [sourceTitle, setSourceTitle] = useState<string>('Synthetic Alpha Helix');
  const [atoms, setAtoms] = useState<AtomRecord[] | undefined>(undefined);
  const [analysis, setAnalysis] = useState<GeometryAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [computeTimeMs, setComputeTimeMs] = useState<number | null>(null);
  const [isApiInspectorOpen, setIsApiInspectorOpen] = useState<boolean>(false);

  // Check server health
  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => {
        if (res.ok) setServerStatus('connected');
        else setServerStatus('error');
      })
      .catch(() => setServerStatus('error'));
  }, []);

  // Compute geometry analysis via backend API
  const calculateGeometry = async (coords: number[][]) => {
    if (!coords || coords.length === 0) return;
    setIsLoading(true);
    const start = performance.now();

    try {
      const res = await fetch('/api/v1/geometry/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: coords }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: GeometryAnalysis = await res.json();
      const end = performance.now();
      setAnalysis(data);
      setComputeTimeMs(Math.round((end - start) * 100) / 100);
    } catch {
      // Client-side fallback if network error
      const n = coords.length;
      let x = 0, y = 0, z = 0;
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const pt of coords) {
        x += pt[0]; y += pt[1]; z += pt[2];
        if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
        if (pt[2] < minZ) minZ = pt[2]; if (pt[2] > maxZ) maxZ = pt[2];
      }
      const cx = x / n;
      const cy = y / n;
      const cz = z / n;
      let sumSq = 0;
      let maxDist = 0;
      for (const pt of coords) {
        const d2 = (pt[0] - cx) ** 2 + (pt[1] - cy) ** 2 + (pt[2] - cz) ** 2;
        sumSq += d2;
        const d = Math.sqrt(d2);
        if (d > maxDist) maxDist = d;
      }
      setAnalysis({
        centroid: [cx, cy, cz],
        count: n,
        radiusOfGyration: Math.sqrt(sumSq / n),
        maxDistanceFromCentroid: maxDist,
        boundingBox: {
          min: [minX, minY, minZ],
          max: [maxX, maxY, maxZ],
          dimensions: [maxX - minX, maxY - minY, maxZ - minZ],
        },
      });
      const end = performance.now();
      setComputeTimeMs(Math.round((end - start) * 100) / 100);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const defaultSample = SAMPLE_STRUCTURES.find((s) => s.id === 'helix');
    if (defaultSample && defaultSample.sampleCoords) {
      setCoordinates(defaultSample.sampleCoords);
      setSourceTitle(defaultSample.name);
      calculateGeometry(defaultSample.sampleCoords);
    }
  }, []);

  const handleLoadCoords = (
    newCoords: number[][],
    title: string,
    parsedAtoms?: AtomRecord[]
  ) => {
    setCoordinates(newCoords);
    setSourceTitle(title);
    setAtoms(parsedAtoms);
    calculateGeometry(newCoords);
  };

  return (
    <div id="pro-life-app-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        serverStatus={serverStatus}
        onOpenApiDocs={() => setIsApiInspectorOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Active Structure Headline Banner */}
        <div id="structure-status-bar" className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Active Structure
              </div>
              <div id="active-structure-name" className="text-sm sm:text-base font-bold text-slate-100">
                {sourceTitle}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-300 font-mono">
              {coordinates.length} Coordinate Points
            </div>
            <button
              id="btn-inspect-api-call"
              onClick={() => setIsApiInspectorOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-medium transition cursor-pointer"
            >
              Inspect API Payload
            </button>
          </div>
        </div>

        {/* Core Workspace Layout: 3D Viewport + Analysis Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Left Column: Input and Metric Controls */}
          <div className="lg:col-span-5 flex flex-col gap-6 order-2 lg:order-1">
            <MetricsOverview
              analysis={analysis}
              isLoading={isLoading}
              computeTimeMs={computeTimeMs}
            />

            <CoordinateInput
              onLoadCoords={handleLoadCoords}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column: 3D Interactive Viewport */}
          <div className="lg:col-span-7 flex flex-col min-h-[480px] order-1 lg:order-2">
            <Viewport3D
              coordinates={coordinates}
              centroid={analysis ? analysis.centroid : null}
              analysis={analysis}
              atoms={atoms}
            />
          </div>
        </div>
      </main>

      {/* API Inspector Modal */}
      <ApiInspector
        isOpen={isApiInspectorOpen}
        onClose={() => setIsApiInspectorOpen(false)}
        coordinates={coordinates}
      />
    </div>
  );
};
