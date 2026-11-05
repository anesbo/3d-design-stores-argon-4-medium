import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActiveTool,
  Camera3DMode,
  DesignVariant,
  DOMAIN_CONSTRAINTS,
  FurnitureInstance,
  OpeningType,
  ProjectFile,
  SelectionTarget,
  ViewLayoutMode,
  WallOpening,
} from './types/domain';
import { getCatalogItem } from './data/catalog';
import {
  createSundayCafePreset,
  PRESET_LIST,
} from './data/presets';
import {
  computeWallGeometry,
  detectClosedRooms,
  roundM,
  validateAndClampOpening,
} from './utils/geometry';
import { calculateBOM } from './utils/bom';
import {
  exportArchitecturalSVG,
  exportBOMScheduleCSV,
  exportProjectJSON,
  validateAndSanitizeProjectJSON,
} from './utils/exporters';
import { TopHeader } from './components/TopHeader';
import { CatalogSidebar } from './components/CatalogSidebar';
import { Canvas2D } from './components/Canvas2D';
import { Viewport3D } from './components/Viewport3D';
import { InspectorDrawer } from './components/InspectorDrawer';

const STORAGE_KEY = 'forma_commercial_designer_project_v1';

export function App() {
  // Load initial project from localStorage or default to "The Sunday Cafe" (80 m² cafe)
  const [project, setProject] = useState<ProjectFile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const res = validateAndSanitizeProjectJSON(parsed);
        if (res.valid && res.project) {
          return res.project;
        }
      }
    } catch {
      // Fallback to default preset
    }
    return createSundayCafePreset();
  });

  // Immutable Undo / Redo Transaction Stack (up to 80 steps)
  const [undoStack, setUndoStack] = useState<ProjectFile[]>([]);
  const [redoStack, setRedoStack] = useState<ProjectFile[]>([]);
  const dragSnapshotRef = useRef<ProjectFile | null>(null);

  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [viewLayout, setViewLayout] = useState<ViewLayoutMode>('split');
  const [camera3DMode, setCamera3DMode] = useState<Camera3DMode>('orbit');

  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [snapToVertices, setSnapToVertices] = useState<boolean>(true);
  const [gridStep] = useState<number>(0.1);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const snapshotTriggerRef = useRef<(() => void) | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Auto-persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // Ignore quota errors
    }
  }, [project]);

  const activeVariant: DesignVariant = useMemo(() => {
    return (
      project.variants.find((v) => v.id === project.activeVariantId) ||
      project.variants[0]
    );
  }, [project]);

  // Real-time room polygon auto-detection & BOM calculation
  const detectedRooms = useMemo(
    () => detectClosedRooms(activeVariant),
    [activeVariant]
  );

  const bom = useMemo(
    () => calculateBOM(activeVariant, detectedRooms),
    [activeVariant, detectedRooms]
  );

  /**
   * Updates the active variant immutably.
   * When commitHistory=false (during continuous drag), captures the pre-drag snapshot once.
   * When commitHistory=true, pushes the pre-drag or previous state onto the 80-step Undo stack.
   */
  const handleUpdateVariant = useCallback(
    (
      updater: (prev: DesignVariant) => DesignVariant,
      commitHistory = true
    ) => {
      setProject((prevProj) => {
        if (!commitHistory && !dragSnapshotRef.current) {
          dragSnapshotRef.current = structuredClone(prevProj);
        }

        const currentVar =
          prevProj.variants.find((v) => v.id === prevProj.activeVariantId) ||
          prevProj.variants[0];
        const nextVar = updater(currentVar);

        const nextProj: ProjectFile = {
          ...prevProj,
          updatedAt: new Date().toISOString(),
          variants: prevProj.variants.map((v) =>
            v.id === currentVar.id ? nextVar : v
          ),
        };

        if (commitHistory) {
          const snapshotToPush = dragSnapshotRef.current || prevProj;
          dragSnapshotRef.current = null;
          setUndoStack((u) =>
            [...u, snapshotToPush].slice(-DOMAIN_CONSTRAINTS.MAX_HISTORY)
          );
          setRedoStack([]);
        }

        return nextProj;
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previousState = prevUndo[prevUndo.length - 1];
      setRedoStack((prevRedo) =>
        [...prevRedo, project].slice(-DOMAIN_CONSTRAINTS.MAX_HISTORY)
      );
      setProject(previousState);
      return prevUndo.slice(0, -1);
    });
  }, [project]);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const nextState = prevRedo[prevRedo.length - 1];
      setUndoStack((prevUndo) =>
        [...prevUndo, project].slice(-DOMAIN_CONSTRAINTS.MAX_HISTORY)
      );
      setProject(nextState);
      return prevRedo.slice(0, -1);
    });
  }, [project]);

  // Delete currently selected element
  const handleDeleteSelected = useCallback(() => {
    if (!selection) return;
    handleUpdateVariant((prev) => {
      if (selection.type === 'furniture') {
        return {
          ...prev,
          furniture: prev.furniture.filter((f) => f.id !== selection.id),
        };
      }
      if (selection.type === 'opening') {
        return {
          ...prev,
          openings: prev.openings.filter((o) => o.id !== selection.id),
        };
      }
      if (selection.type === 'wall') {
        return {
          ...prev,
          walls: prev.walls.filter((w) => w.id !== selection.id),
          openings: prev.openings.filter((o) => o.wallId !== selection.id),
        };
      }
      if (selection.type === 'vertex') {
        const removedWallIds = new Set(
          prev.walls
            .filter(
              (w) =>
                w.startVertexId === selection.id ||
                w.endVertexId === selection.id
            )
            .map((w) => w.id)
        );
        return {
          ...prev,
          vertices: prev.vertices.filter((v) => v.id !== selection.id),
          walls: prev.walls.filter((w) => !removedWallIds.has(w.id)),
          openings: prev.openings.filter((o) => !removedWallIds.has(o.wallId)),
        };
      }
      return prev;
    }, true);
    setSelection(null);
  }, [selection, handleUpdateVariant]);

  // Duplicate furniture item
  const handleDuplicateFurniture = useCallback(
    (furnitureId: string) => {
      const target = activeVariant.furniture.find((f) => f.id === furnitureId);
      if (!target) return;
      if (activeVariant.furniture.length >= DOMAIN_CONSTRAINTS.MAX_FURNITURE) {
        showToast(
          `Performance cap reached (${DOMAIN_CONSTRAINTS.MAX_FURNITURE} furniture items).`
        );
        return;
      }
      const lightCount = activeVariant.furniture.filter((f) => f.isLight).length;
      if (target.isLight && lightCount >= DOMAIN_CONSTRAINTS.MAX_LIGHTS) {
        showToast(
          `Performance cap reached (${DOMAIN_CONSTRAINTS.MAX_LIGHTS} lights).`
        );
        return;
      }

      const newId = `furn-${Date.now().toString(36)}`;
      const clone: FurnitureInstance = {
        ...target,
        id: newId,
        x: roundM(target.x + 0.45, 2),
        y: roundM(target.y + 0.45, 2),
        locked: false,
      };
      handleUpdateVariant(
        (prev) => ({
          ...prev,
          furniture: [...prev.furniture, clone],
        }),
        true
      );
      setSelection({ type: 'furniture', id: newId });
    },
    [activeVariant.furniture, handleUpdateVariant, showToast]
  );

  // Add catalog item at specific coordinates
  const handleAddCatalogItemAt = useCallback(
    (catalogId: string, x: number, y: number) => {
      if (activeVariant.furniture.length >= DOMAIN_CONSTRAINTS.MAX_FURNITURE) {
        showToast(
          `Maximum of ${DOMAIN_CONSTRAINTS.MAX_FURNITURE} furniture items reached.`
        );
        return;
      }
      const cat = getCatalogItem(catalogId);
      const currentLights = activeVariant.furniture.filter(
        (f) => f.isLight
      ).length;
      if (cat.isLight && currentLights >= DOMAIN_CONSTRAINTS.MAX_LIGHTS) {
        showToast(
          `Maximum of ${DOMAIN_CONSTRAINTS.MAX_LIGHTS} active lights reached.`
        );
        return;
      }

      const newId = `furn-${Date.now().toString(36)}`;
      const instance: FurnitureInstance = {
        id: newId,
        catalogId: cat.id,
        shape: cat.shape,
        name: cat.name,
        category: cat.category,
        x: roundM(x, 2),
        y: roundM(y, 2),
        elevation: cat.defaultElevation,
        width: cat.defaultWidth,
        depth: cat.defaultDepth,
        height: cat.defaultHeight,
        rotation: 0,
        flippedX: false,
        flippedY: false,
        primaryMaterialId: cat.defaultPrimaryMaterialId,
        secondaryMaterialId: cat.defaultSecondaryMaterialId,
        unitCost: cat.defaultUnitCost,
        isLight: cat.isLight,
        lightColor: cat.defaultLightColor,
        lightIntensity: cat.defaultLightIntensity,
        lightRange: cat.defaultLightRange,
      };

      handleUpdateVariant(
        (prev) => ({
          ...prev,
          furniture: [...prev.furniture, instance],
        }),
        true
      );
      setSelection({ type: 'furniture', id: newId });
      setActiveTool('select');
    },
    [activeVariant.furniture, handleUpdateVariant, showToast]
  );

  // Add wall segment between two points
  const handleAddWallSegment = useCallback(
    (
      p1: { x: number; y: number; existingVertexId?: string },
      p2: { x: number; y: number; existingVertexId?: string }
    ) => {
      if (activeVariant.walls.length >= DOMAIN_CONSTRAINTS.MAX_WALLS) {
        showToast(
          `Performance cap reached (${DOMAIN_CONSTRAINTS.MAX_WALLS} walls).`
        );
        return;
      }
      if (
        activeVariant.vertices.length + 2 >
        DOMAIN_CONSTRAINTS.MAX_VERTICES
      ) {
        showToast(
          `Performance cap reached (${DOMAIN_CONSTRAINTS.MAX_VERTICES} vertices).`
        );
        return;
      }

      const newWallId = `wall-${Date.now().toString(36)}`;

      handleUpdateVariant((prev) => {
        const nextVertices = [...prev.vertices];

        let startId = p1.existingVertexId;
        if (!startId) {
          const found = nextVertices.find(
            (v) => Math.hypot(v.x - p1.x, v.y - p1.y) < 0.05
          );
          if (found) {
            startId = found.id;
          } else {
            startId = `v-${Date.now().toString(36)}-a`;
            nextVertices.push({ id: startId, x: p1.x, y: p1.y });
          }
        }

        let endId = p2.existingVertexId;
        if (!endId) {
          const found = nextVertices.find(
            (v) => Math.hypot(v.x - p2.x, v.y - p2.y) < 0.05
          );
          if (found) {
            endId = found.id;
          } else {
            endId = `v-${Date.now().toString(36)}-b`;
            nextVertices.push({ id: endId, x: p2.x, y: p2.y });
          }
        }

        if (startId === endId) return prev;

        return {
          ...prev,
          vertices: nextVertices,
          walls: [
            ...prev.walls,
            {
              id: newWallId,
              startVertexId: startId,
              endVertexId: endId,
              thickness: 0.2,
              height: 3.2,
              materialId: 'wall-drywall-alabaster',
              label: `Partition Wall ${prev.walls.length + 1}`,
            },
          ],
        };
      }, true);

      setSelection({ type: 'wall', id: newWallId });
    },
    [
      activeVariant.walls.length,
      activeVariant.vertices.length,
      handleUpdateVariant,
      showToast,
    ]
  );

  // Add door or window opening onto host wall
  const handleAddOpeningOnWall = useCallback(
    (wallId: string, type: OpeningType, offset: number) => {
      const hostWall = activeVariant.walls.find((w) => w.id === wallId);
      if (!hostWall) return;
      const vertexMap = new Map(activeVariant.vertices.map((v) => [v.id, v]));
      const wg = computeWallGeometry(hostWall, vertexMap);
      if (!wg) return;

      const isWindow = type.includes('window');
      const defaultW =
        type === 'double-door'
          ? 1.6
          : type === 'sliding-door'
          ? 1.8
          : type === 'storefront-window'
          ? 2.2
          : isWindow
          ? 1.4
          : 0.9;
      const defaultH = isWindow ? 1.5 : 2.15;
      const defaultSill =
        type === 'storefront-window' ? 0.3 : isWindow ? 0.85 : 0;

      const newOpId = `op-${Date.now().toString(36)}`;
      const rawOp: WallOpening = {
        id: newOpId,
        wallId,
        type,
        offset,
        width: defaultW,
        height: defaultH,
        sillHeight: defaultSill,
        swingAngle: isWindow ? 0 : 75,
        swingDirection: 'left',
        flipInOut: false,
        frameMaterialId: 'metal-matte-black',
        unitCost:
          type === 'storefront-window'
            ? 1650
            : type === 'double-door'
            ? 1750
            : 850,
      };

      const others = activeVariant.openings.filter((o) => o.wallId === wallId);
      const validated = validateAndClampOpening(rawOp, hostWall, wg.length, others);

      handleUpdateVariant(
        (prev) => ({
          ...prev,
          openings: [...prev.openings, validated],
        }),
        true
      );
      setSelection({ type: 'opening', id: newOpId });
      setActiveTool('select');
    },
    [
      activeVariant.walls,
      activeVariant.vertices,
      activeVariant.openings,
      handleUpdateVariant,
    ]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'd' &&
        selection?.type === 'furniture'
      ) {
        e.preventDefault();
        handleDuplicateFurniture(selection.id);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }
      if (e.key.toLowerCase() === 'v' && camera3DMode !== 'walkthrough') {
        setActiveTool('select');
      }
      if (e.key.toLowerCase() === 'w' && camera3DMode !== 'walkthrough') {
        setActiveTool('wall');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleDuplicateFurniture,
    selection,
    camera3DMode,
  ]);

  // Preset Switching
  const handleSelectPreset = (presetId: string) => {
    const entry = PRESET_LIST.find((p) => p.id === presetId);
    if (!entry) return;
    setUndoStack((u) =>
      [...u, project].slice(-DOMAIN_CONSTRAINTS.MAX_HISTORY)
    );
    setRedoStack([]);
    setSelection(null);
    setProject(entry.create());
    showToast(`Loaded preset space: "${entry.name}" (${entry.areaLabel})`);
  };

  // Variant / Design Alternative Switching, Duplicating & Deleting
  const handleSelectVariant = (variantId: string) => {
    setSelection(null);
    setProject((prev) => ({
      ...prev,
      activeVariantId: variantId,
    }));
  };

  const handleDuplicateVariant = () => {
    const nextLetter = String.fromCharCode(65 + project.variants.length);
    const newId = `var-${Date.now().toString(36)}`;
    const cloned: DesignVariant = {
      ...structuredClone(activeVariant),
      id: newId,
      name: `Option ${nextLetter} — Variant`,
    };
    setUndoStack((u) =>
      [...u, project].slice(-DOMAIN_CONSTRAINTS.MAX_HISTORY)
    );
    setRedoStack([]);
    setProject((prev) => ({
      ...prev,
      activeVariantId: newId,
      variants: [...prev.variants, cloned],
    }));
    showToast(`Created design alternative "${cloned.name}"`);
  };

  const handleDeleteVariant = (variantId: string) => {
    if (project.variants.length <= 1) return;
    setUndoStack((u) =>
      [...u, project].slice(-DOMAIN_CONSTRAINTS.MAX_HISTORY)
    );
    setRedoStack([]);
    setProject((prev) => {
      const remaining = prev.variants.filter((v) => v.id !== variantId);
      return {
        ...prev,
        activeVariantId: remaining[0].id,
        variants: remaining,
      };
    });
    showToast('Deleted design variant.');
  };

  // JSON Import Handler
  const handleImportJSONFile = async (file: File) => {
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const res = validateAndSanitizeProjectJSON(raw);
      if (!res.valid || !res.project) {
        showToast(`Import failed: ${res.errors.join(' ')}`);
        return;
      }
      setUndoStack((u) =>
        [...u, project].slice(-DOMAIN_CONSTRAINTS.MAX_HISTORY)
      );
      setRedoStack([]);
      setSelection(null);
      setProject(res.project);
      showToast(
        `Imported "${res.project.name}" (${res.project.variants.length} design variants)`
      );
    } catch {
      showToast('Invalid JSON project file.');
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-stone-950 text-stone-100 overflow-hidden">
      {/* Top Navigation & Project / Alternative / Export Bar */}
      <TopHeader
        project={project}
        bom={bom}
        viewLayout={viewLayout}
        onViewLayoutChange={setViewLayout}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        undoCount={undoStack.length}
        redoCount={redoStack.length}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSelectPreset={handleSelectPreset}
        onSelectVariant={handleSelectVariant}
        onDuplicateVariant={handleDuplicateVariant}
        onDeleteVariant={handleDeleteVariant}
        onExportJSON={() => {
          exportProjectJSON(project);
          showToast('Exported schema-validated .forma.json project file.');
        }}
        onImportJSONFile={handleImportJSONFile}
        onExportSVG={() => {
          exportArchitecturalSVG(
            project,
            activeVariant,
            detectedRooms,
            bom
          );
          showToast('Exported 1:10 Architectural Vector Floorplan (.svg).');
        }}
        onExportCSV={() => {
          exportBOMScheduleCSV(project, activeVariant, bom);
          showToast('Exported Bill of Materials Schedule (.csv).');
        }}
        onExportPNGSnapshot={() => {
          if (viewLayout === '2d-only') {
            setViewLayout('split');
            setTimeout(() => {
              snapshotTriggerRef.current?.();
              showToast('Captured clean 3D WebGL PNG snapshot.');
            }, 150);
          } else {
            snapshotTriggerRef.current?.();
            showToast('Captured clean 3D WebGL PNG snapshot.');
          }
        }}
      />

      {/* Main Workspace: Left Catalog + Synchronized Dual 2D/3D Views + Right Inspector/BOM */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <CatalogSidebar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onAddCatalogItemCenter={(catalogId) =>
            handleAddCatalogItemAt(catalogId, 0, 0)
          }
          variant={activeVariant}
        />

        {/* Center Synchronized Dual Viewport Area */}
        <main className="flex-1 flex min-w-0 h-full relative bg-stone-950">
          {viewLayout !== '3d-only' && (
            <div
              className={`${
                viewLayout === 'split'
                  ? 'w-1/2 border-r border-stone-800'
                  : 'w-full'
              } h-full relative`}
            >
              <Canvas2D
                variant={activeVariant}
                rooms={detectedRooms}
                selection={selection}
                onSelect={setSelection}
                activeTool={activeTool}
                onToolChange={setActiveTool}
                snapToGrid={snapToGrid}
                onToggleSnapGrid={() => setSnapToGrid((v) => !v)}
                snapToVertices={snapToVertices}
                onToggleSnapVertices={() => setSnapToVertices((v) => !v)}
                gridStep={gridStep}
                onUpdateVariant={handleUpdateVariant}
                onDropCatalogItem={handleAddCatalogItemAt}
                onAddWallSegment={handleAddWallSegment}
                onAddOpeningOnWall={handleAddOpeningOnWall}
              />
            </div>
          )}

          {viewLayout !== '2d-only' && (
            <div
              className={`${
                viewLayout === 'split' ? 'w-1/2' : 'w-full'
              } h-full relative`}
            >
              <Viewport3D
                variant={activeVariant}
                rooms={detectedRooms}
                selection={selection}
                onSelect={setSelection}
                cameraMode={camera3DMode}
                onCameraModeChange={setCamera3DMode}
                registerSnapshotTrigger={(fn) => {
                  snapshotTriggerRef.current = fn;
                }}
              />
            </div>
          )}
        </main>

        {/* Right Bi-directional Property Inspector & BOM Schedule Drawer */}
        <InspectorDrawer
          variant={activeVariant}
          rooms={detectedRooms}
          selection={selection}
          onSelect={setSelection}
          bom={bom}
          onUpdateVariant={handleUpdateVariant}
          onDeleteSelected={handleDeleteSelected}
          onDuplicateFurniture={handleDuplicateFurniture}
          onExportCSV={() => {
            exportBOMScheduleCSV(project, activeVariant, bom);
            showToast('Exported Bill of Materials Schedule (.csv).');
          }}
        />

        {/* Floating Status Toast */}
        {toastMessage && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-stone-900/95 border border-amber-500/60 text-amber-200 text-xs font-medium shadow-2xl backdrop-blur-md z-50">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

