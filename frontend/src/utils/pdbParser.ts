import { AtomRecord } from '../types';

const parseFloatValue = (value: string) => Number.parseFloat(value.trim());

export function parsePdb(pdbText: string): AtomRecord[] {
  const atoms: AtomRecord[] = [];
  const lines = pdbText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;

    const recordType = line.startsWith('ATOM') ? 'ATOM' : 'HETATM';
    const atomName = line.slice(12, 16).trim();
    const residueName = line.slice(17, 20).trim();
    const chainId = line.slice(21, 22).trim() || 'A';
    const residueSeq = Number.parseInt(line.slice(22, 26).trim(), 10) || 0;
    const x = parseFloatValue(line.slice(30, 38));
    const y = parseFloatValue(line.slice(38, 46));
    const z = parseFloatValue(line.slice(46, 54));
    const element = line.slice(76, 78).trim() || atomName.replace(/[^A-Za-z]/g, '').slice(0, 1) || 'C';

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

    atoms.push({
      index: atoms.length,
      recordType,
      atomName,
      residueName,
      chainId,
      residueSeq,
      x,
      y,
      z,
      element,
    });
  }

  return atoms;
}

export function parseRawCoords(rawText: string): number[][] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      const values = parsed as unknown[];
      const coords = values
        .map((entry) => {
          if (Array.isArray(entry) && entry.length >= 3) {
            const [x, y, z] = entry.map((v) => Number(v));
            if ([x, y, z].every((n) => Number.isFinite(n))) {
              return [x, y, z] as number[];
            }
          }
          return null;
        })
        .filter((value): value is number[] => value !== null);
      return coords;
    }
  } catch {
    // Ignore JSON parse failures and fall through to line-based parsing.
  }

  const rows = trimmed
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/).map((value) => Number(value)))
    .filter((values) => values.length >= 3 && values.every((n) => Number.isFinite(n)));

  return rows.map((values) => [values[0], values[1], values[2]]);
}
