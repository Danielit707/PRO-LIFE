import React, { useState } from 'react';
import { Download, Upload, FileCode, Play, Sparkles, RefreshCw } from 'lucide-react';
import { SAMPLE_STRUCTURES } from '../data/samples';
import { parsePdb, parseRawCoords } from '../utils/pdbParser';
import { AtomRecord } from '../types';

interface CoordinateInputProps {
  onLoadCoords: (coords: number[][], sourceTitle: string, atoms?: AtomRecord[]) => void;
  isLoading: boolean;
}

export const CoordinateInput: React.FC<CoordinateInputProps> = ({ onLoadCoords, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'samples' | 'pdb' | 'raw' | 'upload'>('samples');
  const [pdbCode, setPdbCode] = useState('');
  const [pdbError, setPdbError] = useState<string | null>(null);
  const [rawText, setRawText] = useState(
    JSON.stringify(
      [
        [17.047, 14.099, 3.625],
        [16.967, 12.784, 4.338],
        [15.685, 12.755, 5.133],
        [15.268, 13.825, 5.594],
        [18.17, 12.703, 5.337],
        [17.923, 11.666, 6.425],
        [16.711, 11.968, 7.307],
        [16.924, 13.256, 8.107],
      ],
      null,
      2
    )
  );

  // Fetch PDB from RCSB via backend proxy
  const handleFetchPdb = async (codeToFetch?: string) => {
    const code = (codeToFetch || pdbCode).trim().toUpperCase();
    if (!code || code.length !== 4) {
      setPdbError('Please enter a valid 4-character PDB code (e.g. 1CRN, 1UBQ).');
      return;
    }

    setPdbError(null);
    try {
      const res = await fetch(`/api/v1/pdb/${code}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to fetch ${code}`);
      }
      const pdbText = await res.text();
      const atoms = parsePdb(pdbText);
      if (atoms.length === 0) {
        throw new Error(`No ATOM/HETATM records parsed in ${code}.`);
      }
      const coords = atoms.map((a) => [a.x, a.y, a.z]);
      onLoadCoords(coords, `RCSB PDB: ${code} (${atoms.length} atoms)`, atoms);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch PDB file.';
      setPdbError(msg);
    }
  };

  const handleSelectSample = async (sampleId: string) => {
    const sample = SAMPLE_STRUCTURES.find((s) => s.id === sampleId);
    if (!sample) return;

    if (sample.sampleCoords) {
      onLoadCoords(sample.sampleCoords, sample.name);
    } else if (sample.pdbId) {
      setPdbCode(sample.pdbId);
      await handleFetchPdb(sample.pdbId);
    }
  };

  const handleRawSubmit = () => {
    const coords = parseRawCoords(rawText);
    if (coords.length === 0) {
      setPdbError('Unable to parse coordinates. Provide JSON [[x,y,z], ...] or 3 columns of numbers.');
      return;
    }
    setPdbError(null);
    onLoadCoords(coords, `Custom Coordinate Set (${coords.length} points)`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      if (file.name.endsWith('.pdb') || text.includes('ATOM  ') || text.includes('HETATM')) {
        const atoms = parsePdb(text);
        if (atoms.length > 0) {
          const coords = atoms.map((a) => [a.x, a.y, a.z]);
          onLoadCoords(coords, file.name, atoms);
          return;
        }
      }

      const coords = parseRawCoords(text);
      if (coords.length > 0) {
        onLoadCoords(coords, file.name);
      } else {
        setPdbError(`Could not extract coordinates from ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="coordinate-input-container" className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
      <div className="flex border-b border-slate-800 pb-2 space-x-2">
        <button
          id="tab-samples"
          onClick={() => setActiveTab('samples')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'samples'
              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <span className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Preset Samples</span>
          </span>
        </button>

        <button
          id="tab-pdb"
          onClick={() => setActiveTab('pdb')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'pdb'
              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <span className="flex items-center space-x-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Fetch PDB ID</span>
          </span>
        </button>

        <button
          id="tab-raw"
          onClick={() => setActiveTab('raw')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'raw'
              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <span className="flex items-center space-x-1.5">
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw Coords</span>
          </span>
        </button>

        <button
          id="tab-upload"
          onClick={() => setActiveTab('upload')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <span className="flex items-center space-x-1.5">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </span>
        </button>
      </div>

      {pdbError && (
        <div id="error-banner" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {pdbError}
        </div>
      )}

      {/* Preset Samples Tab */}
      {activeTab === 'samples' && (
        <div id="panel-samples" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SAMPLE_STRUCTURES.map((s) => (
            <button
              key={s.id}
              id={`sample-item-${s.id}`}
              onClick={() => handleSelectSample(s.id)}
              disabled={isLoading}
              className="p-3 text-left rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 transition group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs text-slate-200 group-hover:text-cyan-300">
                  {s.name}
                </span>
                <Play className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition" />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">{s.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* PDB Fetch Tab */}
      {activeTab === 'pdb' && (
        <div id="panel-pdb" className="space-y-3">
          <p className="text-xs text-slate-400">
            Query the Protein Data Bank (RCSB) directly to fetch 3D atomic structures by 4-letter accession code:
          </p>
          <div className="flex space-x-2">
            <input
              id="input-pdb-code"
              type="text"
              maxLength={4}
              placeholder="e.g. 1CRN, 1UBQ, 4HHB"
              value={pdbCode}
              onChange={(e) => setPdbCode(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-cyan-500 text-slate-100"
            />
            <button
              id="btn-fetch-pdb"
              onClick={() => handleFetchPdb()}
              disabled={isLoading || !pdbCode.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Fetch & Compute</span>
            </button>
          </div>
        </div>
      )}

      {/* Raw Coords Tab */}
      {activeTab === 'raw' && (
        <div id="panel-raw" className="space-y-3">
          <p className="text-xs text-slate-400">
            Paste coordinates as JSON array <code className="text-cyan-300">[[x, y, z], ...]</code> or plain 3-column rows:
          </p>
          <textarea
            id="textarea-raw-coords"
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          <button
            id="btn-compute-raw"
            onClick={handleRawSubmit}
            disabled={isLoading}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Send to PRO-LIFE Geometry Engine</span>
          </button>
        </div>
      )}

      {/* File Upload Tab */}
      {activeTab === 'upload' && (
        <div id="panel-upload" className="space-y-3">
          <p className="text-xs text-slate-400">
            Upload local files (.pdb, .cif, or coordinate text files):
          </p>
          <label
            id="file-drop-zone"
            className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl p-6 cursor-pointer bg-slate-950/40 hover:bg-slate-900/50 transition"
          >
            <Upload className="w-8 h-8 text-cyan-400 mb-2" />
            <span className="text-xs font-semibold text-slate-200">Click or drop PDB / coordinate file here</span>
            <span className="text-[11px] text-slate-500 mt-1">Supports standard .pdb, .txt, .json formats</span>
            <input
              id="file-input-control"
              type="file"
              accept=".pdb,.txt,.json,.cif"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  );
};
