import React from 'react';
import { Terminal, X } from 'lucide-react';

interface ApiInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates: number[][];
}

export const ApiInspector: React.FC<ApiInspectorProps> = ({ isOpen, onClose, coordinates }) => {
  if (!isOpen) return null;

  const payload = {
    method: 'POST',
    endpoint: '/api/v1/geometry/analysis',
    body: {
      coordinates,
    },
    meta: {
      pointCount: coordinates.length,
      example: coordinates[0] ?? [0, 0, 0],
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <Terminal className="h-4 w-4" />
            <span className="text-sm font-semibold">API Payload Inspector</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            aria-label="Close API inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
            <p className="mb-2 font-medium text-slate-200">Request</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-6 text-cyan-200">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
