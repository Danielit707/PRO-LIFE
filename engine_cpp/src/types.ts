export interface AtomRecord {
  index: number;
  recordType: 'ATOM' | 'HETATM';
  atomName: string;
  residueName: string;
  chainId: string;
  residueSeq: number;
  x: number;
  y: number;
  z: number;
  element: string;
}

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  dimensions: [number, number, number];
}

export interface GeometryAnalysis {
  centroid: [number, number, number];
  count: number;
  radiusOfGyration: number;
  maxDistanceFromCentroid: number;
  boundingBox: BoundingBox;
}

export interface SampleStructure {
  id: string;
  name: string;
  description: string;
  pdbId?: string;
  rawPdb?: string;
  sampleCoords?: number[][];
}
