import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AtomRecord, GeometryAnalysis } from '../types';
import { RotateCw, Eye, Box, Orbit, Compass } from 'lucide-react';

interface Viewport3DProps {
  coordinates: number[][];
  centroid: [number, number, number] | null;
  analysis: GeometryAnalysis | null;
  atoms?: AtomRecord[];
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  coordinates,
  centroid,
  analysis,
  atoms,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showBoundingBox, setShowBoundingBox] = useState(true);
  const [showGyrationSphere, setShowGyrationSphere] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);

  // References to dynamic 3D elements
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Interaction controls
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraDistance = useRef(50);
  const cameraAngle = useRef({ theta: 0.5, phi: 1.0 });

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x030712); // Tailwind slate-950

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.5);
    dirLight1.position.set(50, 50, 50);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xc084fc, 1.0);
    dirLight2.position.set(-50, -50, -50);
    scene.add(dirLight2);

    // Main group for dynamic rotation
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Grid helper
    const gridHelper = new THREE.GridHelper(80, 20, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -20;
    scene.add(gridHelper);

    // Render loop
    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);

      if (autoRotate && !isDragging.current && groupRef.current) {
        groupRef.current.rotation.y += 0.005;
      }

      // Update camera spherical position
      if (cameraRef.current) {
        const { theta, phi } = cameraAngle.current;
        const d = cameraDistance.current;
        cameraRef.current.position.x = d * Math.sin(phi) * Math.sin(theta);
        cameraRef.current.position.y = d * Math.cos(phi);
        cameraRef.current.position.z = d * Math.sin(phi) * Math.cos(theta);
        cameraRef.current.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      resizeObserver.disconnect();
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update 3D Geometry whenever coordinates / centroid changes
  useEffect(() => {
    if (!groupRef.current || coordinates.length === 0) return;

    const group = groupRef.current;
    // Clear previous children in group
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if ('geometry' in obj && (obj as any).geometry) {
        (obj as any).geometry.dispose();
      }
    }

    // Centroid offset to center scene at (0,0,0)
    const [cx, cy, cz] = centroid || [0, 0, 0];

    // Atom rendering strategy: InstancedMesh for performance
    const count = coordinates.length;
    const atomRadius = count > 500 ? 0.4 : 0.6;
    const sphereGeo = new THREE.SphereGeometry(atomRadius, 12, 12);
    const atomMat = new THREE.MeshStandardMaterial({
      roughness: 0.3,
      metalness: 0.2,
    });

    const instancedMesh = new THREE.InstancedMesh(sphereGeo, atomMat, count);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    // Standard CPK colors
    const elementColors: Record<string, number> = {
      C: 0x94a3b8, // Carbon: slate
      N: 0x38bdf8, // Nitrogen: cyan/blue
      O: 0xf43f5e, // Oxygen: red
      S: 0xfacc15, // Sulfur: yellow
      P: 0xf97316, // Phosphorus: orange
      H: 0xffffff, // Hydrogen: white
    };

    for (let i = 0; i < count; i++) {
      const [x, y, z] = coordinates[i];
      // Centered coordinates
      matrix.setPosition(x - cx, y - cy, z - cz);
      instancedMesh.setMatrixAt(i, matrix);

      const elem = atoms?.[i]?.element || 'C';
      const hex = elementColors[elem] || 0x38bdf8;
      color.setHex(hex);
      instancedMesh.setColorAt(i, color);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    group.add(instancedMesh);

    // Centroid Marker at (0,0,0)
    // Golden pulsating core
    const centroidCoreGeo = new THREE.SphereGeometry(1.2, 24, 24);
    const centroidCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15, // Yellow gold
      wireframe: false,
    });
    const centroidMesh = new THREE.Mesh(centroidCoreGeo, centroidCoreMat);
    group.add(centroidMesh);

    // Centroid Crosshair axes
    const crosshairMat = new THREE.LineBasicMaterial({ color: 0xfde047, linewidth: 2 });
    const crossPoints = [
      new THREE.Vector3(-4, 0, 0),
      new THREE.Vector3(4, 0, 0),
      new THREE.Vector3(0, -4, 0),
      new THREE.Vector3(0, 4, 0),
      new THREE.Vector3(0, 0, -4),
      new THREE.Vector3(0, 0, 4),
    ];
    const crosshairGeo = new THREE.BufferGeometry().setFromPoints(crossPoints);
    const crosshairLines = new THREE.LineSegments(crosshairGeo, crosshairMat);
    group.add(crosshairLines);

    // Optional Bounding Box
    if (showBoundingBox && analysis) {
      const { min, max } = analysis.boundingBox;
      const sizeX = max[0] - min[0];
      const sizeY = max[1] - min[1];
      const sizeZ = max[2] - min[2];
      const boxGeo = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
      const boxEdges = new THREE.EdgesGeometry(boxGeo);
      const boxLine = new THREE.LineSegments(
        boxEdges,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, opacity: 0.35, transparent: true })
      );
      // Box center offset from centroid
      const boxCenterX = (min[0] + max[0]) / 2 - cx;
      const boxCenterY = (min[1] + max[1]) / 2 - cy;
      const boxCenterZ = (min[2] + max[2]) / 2 - cz;
      boxLine.position.set(boxCenterX, boxCenterY, boxCenterZ);
      group.add(boxLine);
    }

    // Optional Radius of Gyration Sphere
    if (showGyrationSphere && analysis) {
      const rg = analysis.radiusOfGyration;
      const rgGeo = new THREE.SphereGeometry(rg, 24, 16);
      const rgWireframe = new THREE.WireframeGeometry(rgGeo);
      const rgLine = new THREE.LineSegments(
        rgWireframe,
        new THREE.LineBasicMaterial({ color: 0xa855f7, opacity: 0.25, transparent: true })
      );
      group.add(rgLine);
    }

    // Auto-frame camera based on structure span
    if (analysis) {
      const span = Math.max(...analysis.boundingBox.dimensions);
      cameraDistance.current = Math.max(span * 1.8, 25);
    }
  }, [coordinates, centroid, analysis, atoms, showBoundingBox, showGyrationSphere]);

  // Pointer event handlers for orbiting & zooming
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };

    cameraAngle.current.theta -= deltaX * 0.008;
    cameraAngle.current.phi = Math.max(
      0.1,
      Math.min(Math.PI - 0.1, cameraAngle.current.phi - deltaY * 0.008)
    );
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraDistance.current = Math.max(
      5,
      Math.min(500, cameraDistance.current + e.deltaY * 0.05)
    );
  };

  const handleResetCamera = () => {
    cameraAngle.current = { theta: 0.5, phi: 1.0 };
    if (analysis) {
      const span = Math.max(...analysis.boundingBox.dimensions);
      cameraDistance.current = Math.max(span * 1.8, 25);
    } else {
      cameraDistance.current = 50;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = 0;
    }
  };

  return (
    <div
      id="viewport-3d-wrapper"
      className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col"
    >
      {/* 3D Canvas Target */}
      <div
        id="canvas-render-container"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing flex-1"
      />

      {/* Floating Viewport Controls */}
      <div
        id="viewport-toolbar"
        className="absolute top-4 right-4 flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-md"
      >
        <button
          id="btn-toggle-autorotate"
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-1.5 rounded-lg transition cursor-pointer ${
            autoRotate ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Auto-Rotation"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          id="btn-toggle-bounding-box"
          onClick={() => setShowBoundingBox(!showBoundingBox)}
          className={`p-1.5 rounded-lg transition cursor-pointer ${
            showBoundingBox ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Bounding Box Wireframe"
        >
          <Box className="w-4 h-4" />
        </button>

        <button
          id="btn-toggle-gyration"
          onClick={() => setShowGyrationSphere(!showGyrationSphere)}
          className={`p-1.5 rounded-lg transition cursor-pointer ${
            showGyrationSphere ? 'text-purple-400 bg-purple-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Radius of Gyration Sphere (Rg)"
        >
          <Orbit className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-slate-800" />

        <button
          id="btn-reset-camera"
          onClick={handleResetCamera}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer"
          title="Reset Camera Orientation"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Legend & Help overlay */}
      <div
        id="viewport-legend"
        className="absolute bottom-4 left-4 pointer-events-none bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-center space-x-3"
      >
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block shadow-[0_0_8px_#facc15]" />
          <span className="font-semibold text-yellow-300">Centroid</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
          <span>Atoms</span>
        </div>
        {showGyrationSphere && (
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 border border-purple-400 rounded-full inline-block" />
            <span>Rg Sphere</span>
          </div>
        )}
      </div>
    </div>
  );
};
