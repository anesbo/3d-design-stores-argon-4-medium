import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Camera3DMode,
  DesignVariant,
  DetectedRoom,
  DOMAIN_CONSTRAINTS,
  SelectionTarget,
} from '../types/domain';
import {
  clamp,
  computeWallGeometry,
  resolveWalkthroughCollision,
} from '../utils/geometry';
import { getThreeMaterial } from '../three/proceduralTextures';
import {
  buildProceduralFurnitureGroup,
  buildProceduralWallAssembly,
} from '../three/proceduralCatalog3D';
import {
  Box,
  Camera,
  Eye,
  Footprints,
  RotateCcw,
  Sun,
} from 'lucide-react';

interface Viewport3DProps {
  variant: DesignVariant;
  rooms: DetectedRoom[];
  selection: SelectionTarget;
  onSelect: (target: SelectionTarget) => void;
  cameraMode: Camera3DMode;
  onCameraModeChange: (mode: Camera3DMode) => void;
  registerSnapshotTrigger: (fn: () => void) => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  variant,
  rooms,
  selection,
  onSelect,
  cameraMode,
  onCameraModeChange,
  registerSnapshotTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const contentGroupRef = useRef<THREE.Group | null>(null);

  // Orbit Camera Spherical Coordinates
  const orbitRef = useRef({
    target: new THREE.Vector3(0, 0.8, 0),
    radius: 14.5,
    theta: Math.PI * 0.22, // horizontal angle
    phi: Math.PI * 0.32, // vertical angle from pole
    isDragging: false,
    isPanning: false,
    startX: 0,
    startY: 0,
    movedDistance: 0,
  });

  // First-Person Walkthrough State (Eye Level = 1.6m)
  const walkRef = useRef({
    pos: new THREE.Vector3(0, DOMAIN_CONSTRAINTS.WALKTHROUGH_EYE_HEIGHT, 2.5),
    yaw: 0,
    pitch: -0.05,
    keys: new Set<string>(),
    isDraggingLook: false,
    lastMouseX: 0,
    lastMouseY: 0,
  });

  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const variantRef = useRef(variant);
  variantRef.current = variant;

  const updateCameraFromOrbit = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const o = orbitRef.current;
    const sinPhi = Math.sin(o.phi);
    const x = o.target.x + o.radius * sinPhi * Math.sin(o.theta);
    const y = o.target.y + o.radius * Math.cos(o.phi);
    const z = o.target.z + o.radius * sinPhi * Math.cos(o.theta);
    cam.position.set(x, y, z);
    cam.lookAt(o.target);
  }, []);

  const updateCameraFromWalk = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const w = walkRef.current;
    cam.position.set(
      w.pos.x,
      DOMAIN_CONSTRAINTS.WALKTHROUGH_EYE_HEIGHT,
      w.pos.z
    );
    const lookDir = new THREE.Vector3(
      -Math.sin(w.yaw) * Math.cos(w.pitch),
      Math.sin(w.pitch),
      -Math.cos(w.yaw) * Math.cos(w.pitch)
    );
    cam.lookAt(cam.position.clone().add(lookDir));
  }, []);

  // Initialize Three.js WebGLRenderer, Scene, Camera, Sky/Grid, and Animation Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c0a09');
    scene.fog = new THREE.FogExp2('#0c0a09', 0.015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      52,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      180
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ground architectural reference grid (-50m to +50m = 100m span)
    const gridHelper = new THREE.GridHelper(100, 100, '#44403c', '#1c1917');
    gridHelper.position.y = -0.008;
    scene.add(gridHelper);

    // Subtle ground receiver plane
    const groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({
        color: '#110f0e',
        roughness: 0.95,
        metalness: 0.0,
      })
    );
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.015;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    const contentGroup = new THREE.Group();
    scene.add(contentGroup);
    contentGroupRef.current = contentGroup;

    updateCameraFromOrbit();

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    });
    ro.observe(container);

    // 60fps animation & walkthrough physics loop
    let animId = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (walkRef.current.keys.size > 0) {
        const w = walkRef.current;
        const speed = w.keys.has('ShiftLeft') ? 5.2 : 3.2;
        let forward = 0;
        let strafe = 0;
        if (w.keys.has('KeyW') || w.keys.has('ArrowUp')) forward += 1;
        if (w.keys.has('KeyS') || w.keys.has('ArrowDown')) forward -= 1;
        if (w.keys.has('KeyD') || w.keys.has('ArrowRight')) strafe += 1;
        if (w.keys.has('KeyA') || w.keys.has('ArrowLeft')) strafe -= 1;

        if (forward !== 0 || strafe !== 0) {
          const len = Math.hypot(forward, strafe);
          forward /= len;
          strafe /= len;

          const fx = -Math.sin(w.yaw);
          const fz = -Math.cos(w.yaw);
          const rx = Math.cos(w.yaw);
          const rz = -Math.sin(w.yaw);

          const desiredX =
            w.pos.x + (fx * forward + rx * strafe) * speed * dt;
          const desiredZ =
            w.pos.z + (fz * forward + rz * strafe) * speed * dt;

          const resolved = resolveWalkthroughCollision(
            { x: desiredX, y: desiredZ },
            variantRef.current
          );
          w.pos.x = resolved.x;
          w.pos.z = resolved.y;
          updateCameraFromWalk();
        }
      }

      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.dispose();
    };
  }, [updateCameraFromOrbit, updateCameraFromWalk]);

  // Register high-res PNG snapshot trigger
  useEffect(() => {
    registerSnapshotTrigger(() => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return;

      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `forma-3d-snapshot-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }, [registerSnapshotTrigger]);

  // Synchronize camera mode changes (Orbit <-> First-Person Walkthrough)
  useEffect(() => {
    if (cameraMode === 'walkthrough') {
      updateCameraFromWalk();
    } else {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      walkRef.current.keys.clear();
      updateCameraFromOrbit();
    }
  }, [cameraMode, updateCameraFromOrbit, updateCameraFromWalk]);

  // Keyboard & Pointer Lock listeners for Walkthrough mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (cameraMode !== 'walkthrough') return;
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft'].includes(
          e.code
        )
      ) {
        walkRef.current.keys.add(e.code);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      walkRef.current.keys.delete(e.code);
    };
    const onPointerLockChange = () => {
      const locked =
        document.pointerLockElement === rendererRef.current?.domElement;
      setIsPointerLocked(locked);
    };
    const onMouseMoveDocument = (e: MouseEvent) => {
      if (cameraMode !== 'walkthrough') return;
      if (document.pointerLockElement === rendererRef.current?.domElement) {
        walkRef.current.yaw -= e.movementX * 0.0024;
        walkRef.current.pitch = clamp(
          walkRef.current.pitch - e.movementY * 0.0022,
          -Math.PI * 0.44,
          Math.PI * 0.44
        );
        updateCameraFromWalk();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMoveDocument);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMoveDocument);
    };
  }, [cameraMode, updateCameraFromWalk]);

  // Rebuild 3D Scene Content whenever Variant, Rooms, or Selection changes
  useEffect(() => {
    const group = contentGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // 1. Studio & Architectural Lighting
    const hemiLight = new THREE.HemisphereLight(
      '#fff8eb',
      '#292524',
      variant.ambientLightIntensity * 0.9
    );
    hemiLight.position.set(0, 15, 0);
    group.add(hemiLight);

    const azRad = (variant.sunAzimuth * Math.PI) / 180;
    const elRad = (variant.sunElevation * Math.PI) / 180;
    const sunDist = 22;
    const dirLight = new THREE.DirectionalLight(
      '#fff5e4',
      variant.ambientLightIntensity * 1.45
    );
    dirLight.position.set(
      sunDist * Math.cos(elRad) * Math.sin(azRad),
      sunDist * Math.sin(elRad),
      sunDist * Math.cos(elRad) * Math.cos(azRad)
    );
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 60;
    const d = 16;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    group.add(dirLight);

    // 2. Detected Room Floor Polygons
    for (const room of rooms) {
      if (room.points.length < 3) continue;
      const isRoomSelected =
        selection?.type === 'room' && selection.id === room.key;
      const shape = new THREE.Shape();
      shape.moveTo(room.points[0].x, room.points[0].y);
      for (let i = 1; i < room.points.length; i++) {
        shape.lineTo(room.points[i].x, room.points[i].y);
      }
      shape.closePath();

      const geom = new THREE.ShapeGeometry(shape);
      // Scale UVs so textures tile realistically every 2m
      const posAttr = geom.attributes.position;
      const uvs: number[] = [];
      for (let i = 0; i < posAttr.count; i++) {
        uvs.push(posAttr.getX(i) / 2.2, posAttr.getY(i) / 2.2);
      }
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

      const floorMat = getThreeMaterial(
        room.floorMaterialId,
        1,
        1,
        isRoomSelected
      );
      const floorMesh = new THREE.Mesh(geom, floorMat);
      floorMesh.rotation.x = Math.PI / 2;
      floorMesh.position.y = 0.004;
      floorMesh.receiveShadow = true;
      floorMesh.userData = { selectionType: 'room', id: room.key };
      group.add(floorMesh);
    }

    // 3. Walls & Wall Openings (Doors with Swing Angle & Windows)
    const vertexMap = new Map(variant.vertices.map((v) => [v.id, v]));
    const selectedWallId =
      selection?.type === 'wall' ? selection.id : null;
    const selectedOpeningId =
      selection?.type === 'opening' ? selection.id : null;

    for (const wall of variant.walls) {
      const wg = computeWallGeometry(wall, vertexMap);
      if (!wg) continue;
      const wallOps = variant.openings.filter((o) => o.wallId === wall.id);
      const wallAssembly = buildProceduralWallAssembly(
        wall,
        wg,
        wallOps,
        selectedWallId,
        selectedOpeningId
      );
      group.add(wallAssembly);
    }

    // 4. Procedural Catalog Items & Point Lights (capped at MAX_LIGHTS = 40)
    const selectedFurnId =
      selection?.type === 'furniture' ? selection.id : null;
    let activeLightCount = 0;

    for (const item of variant.furniture) {
      const itemGroup = buildProceduralFurnitureGroup(
        item,
        selectedFurnId === item.id
      );
      group.add(itemGroup);

      if (item.isLight && activeLightCount < DOMAIN_CONSTRAINTS.MAX_LIGHTS) {
        activeLightCount++;
        const ptLight = new THREE.PointLight(
          item.lightColor || '#ffdfa8',
          item.lightIntensity ?? 2.2,
          item.lightRange ?? 8.0,
          1.6
        );
        ptLight.position.set(
          item.x,
          Math.max(0.5, item.elevation + 0.1),
          item.y
        );
        group.add(ptLight);
      }
    }
  }, [variant, rooms, selection]);

  // Mouse interaction handlers on 3D Canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (cameraMode === 'walkthrough') {
      const domEl = rendererRef.current?.domElement;
      if (domEl && document.pointerLockElement !== domEl && e.button === 0) {
        domEl.requestPointerLock?.();
      }
      walkRef.current.isDraggingLook = true;
      walkRef.current.lastMouseX = e.clientX;
      walkRef.current.lastMouseY = e.clientY;
      return;
    }

    const o = orbitRef.current;
    o.isDragging = true;
    o.isPanning = e.button === 2 || e.button === 1 || e.shiftKey;
    o.startX = e.clientX;
    o.startY = e.clientY;
    o.movedDistance = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (cameraMode === 'walkthrough') {
      if (
        walkRef.current.isDraggingLook &&
        document.pointerLockElement !== rendererRef.current?.domElement
      ) {
        const dx = e.clientX - walkRef.current.lastMouseX;
        const dy = e.clientY - walkRef.current.lastMouseY;
        walkRef.current.lastMouseX = e.clientX;
        walkRef.current.lastMouseY = e.clientY;
        walkRef.current.yaw -= dx * 0.004;
        walkRef.current.pitch = clamp(
          walkRef.current.pitch - dy * 0.004,
          -Math.PI * 0.44,
          Math.PI * 0.44
        );
        updateCameraFromWalk();
      }
      return;
    }

    const o = orbitRef.current;
    if (!o.isDragging) return;

    const dx = e.clientX - o.startX;
    const dy = e.clientY - o.startY;
    o.startX = e.clientX;
    o.startY = e.clientY;
    o.movedDistance += Math.hypot(dx, dy);

    if (o.isPanning) {
      const panSpeed = o.radius * 0.0014;
      const right = new THREE.Vector3(
        Math.cos(o.theta),
        0,
        -Math.sin(o.theta)
      );
      const forward = new THREE.Vector3(
        Math.sin(o.theta),
        0,
        Math.cos(o.theta)
      );
      o.target.addScaledVector(right, -dx * panSpeed);
      o.target.addScaledVector(forward, -dy * panSpeed);
    } else {
      o.theta -= dx * 0.0065;
      o.phi = clamp(o.phi - dy * 0.0065, 0.08, Math.PI * 0.47);
    }

    updateCameraFromOrbit();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    walkRef.current.isDraggingLook = false;

    const o = orbitRef.current;
    const wasClick = o.movedDistance < 5 && e.button === 0;
    o.isDragging = false;

    if (wasClick && cameraMode === 'orbit') {
      // Raycast into 3D scene for bi-directional selection!
      const container = containerRef.current;
      const camera = cameraRef.current;
      const contentGroup = contentGroupRef.current;
      if (!container || !camera || !contentGroup) return;

      const rect = container.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hits = raycaster.intersectObjects(contentGroup.children, true);

      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.selectionType && obj.userData?.id) {
            onSelect({
              type: obj.userData.selectionType,
              id: obj.userData.id,
            });
            return;
          }
          obj = obj.parent;
        }
      }

      onSelect(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (cameraMode !== 'orbit') return;
    const o = orbitRef.current;
    const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    o.radius = clamp(o.radius * factor, 2.2, 65);
    updateCameraFromOrbit();
  };

  const setPresetOrbit = (theta: number, phi: number, radius = 14.5) => {
    onCameraModeChange('orbit');
    orbitRef.current.target.set(0, 0.8, 0);
    orbitRef.current.theta = theta;
    orbitRef.current.phi = phi;
    orbitRef.current.radius = radius;
    updateCameraFromOrbit();
  };

  return (
    <div
      className="relative w-full h-full bg-stone-950 overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Top-Left 3D Mode Switcher & Camera Status */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
        <div className="p-1 rounded-lg bg-stone-900/90 border border-stone-800 backdrop-blur-md flex items-center gap-1 shadow-lg">
          <button
            onClick={() => onCameraModeChange('orbit')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              cameraMode === 'orbit'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Orbit Studio</span>
          </button>
          <button
            onClick={() => onCameraModeChange('walkthrough')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              cameraMode === 'walkthrough'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <Footprints className="w-3.5 h-3.5" />
            <span>Walkthrough (1.6m)</span>
          </button>
        </div>

        {cameraMode === 'walkthrough' && (
          <div className="px-3 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2 backdrop-blur-md">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {isPointerLocked
                ? 'WASD / Arrows to walk · Mouse to look · ESC to unlock cursor'
                : 'Click 3D view to lock mouse look · WASD / Arrows to walk (Wall collision active)'}
            </span>
          </div>
        )}
      </div>

      {/* First-Person Crosshair when in Walkthrough mode */}
      {cameraMode === 'walkthrough' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-amber-400/80 ring-4 ring-stone-950/50" />
        </div>
      )}

      {/* Bottom-Left 3D Camera Angles & Snapshot Controls */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-stone-900/90 border border-stone-800/90 rounded-lg p-1 backdrop-blur-md shadow-xl">
        <button
          onClick={() => setPresetOrbit(Math.PI * 0.22, Math.PI * 0.32, 14.5)}
          className="px-2 py-1 rounded text-xs text-stone-300 hover:text-white hover:bg-stone-800 transition"
          title="Isometric Studio Angle"
        >
          Isometric
        </button>
        <button
          onClick={() => setPresetOrbit(0, 0.1, 16)}
          className="px-2 py-1 rounded text-xs text-stone-300 hover:text-white hover:bg-stone-800 transition"
          title="Top-Down Bird's Eye"
        >
          Top
        </button>
        <button
          onClick={() => setPresetOrbit(0, Math.PI * 0.42, 13)}
          className="px-2 py-1 rounded text-xs text-stone-300 hover:text-white hover:bg-stone-800 transition"
          title="South Elevation View"
        >
          Front
        </button>
        <button
          onClick={() => setPresetOrbit(Math.PI * 0.22, Math.PI * 0.32, 14.5)}
          className="p-1.5 rounded text-stone-400 hover:text-white hover:bg-stone-800"
          title="Reset Camera"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

