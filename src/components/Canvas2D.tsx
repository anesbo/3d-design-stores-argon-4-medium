import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActiveTool,
  DesignVariant,
  DetectedRoom,
  DOMAIN_CONSTRAINTS,
  FurnitureInstance,
  OpeningType,
  SelectionTarget,
  WallOpening,
} from '../types/domain';
import { getMaterial } from '../data/materials';
import {
  clamp,
  computeWallGeometry,
  dist2D,
  projectPointOnWall,
  roundM,
  SnapGuide,
  snapWorldPoint,
  validateAndClampOpening,
  WallGeometry,
} from '../utils/geometry';
import {
  Compass,
  Grid,
   Magnet,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface Canvas2DProps {
  variant: DesignVariant;
  rooms: DetectedRoom[];
  selection: SelectionTarget;
  onSelect: (target: SelectionTarget) => void;
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  snapToGrid: boolean;
  onToggleSnapGrid: () => void;
  snapToVertices: boolean;
  onToggleSnapVertices: () => void;
  gridStep: number;
  onUpdateVariant: (
    updater: (prev: DesignVariant) => DesignVariant,
    commitHistory?: boolean
  ) => void;
  onDropCatalogItem: (catalogId: string, x: number, y: number) => void;
  onAddWallSegment: (
    p1: { x: number; y: number; existingVertexId?: string },
    p2: { x: number; y: number; existingVertexId?: string }
  ) => void;
  onAddOpeningOnWall: (
    wallId: string,
    type: OpeningType,
    offset: number
  ) => void;
}

type DragState =
  | {
      mode: 'pan';
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      mode: 'vertex';
      vertexId: string;
      initialVariant: DesignVariant;
    }
  | {
      mode: 'wall-move';
      wallId: string;
      startWorld: { x: number; y: number };
      initialVariant: DesignVariant;
    }
  | {
      mode: 'furniture-move';
      furnitureId: string;
      offsetX: number;
      offsetY: number;
      initialVariant: DesignVariant;
    }
  | {
      mode: 'furniture-rotate';
      furnitureId: string;
      centerX: number;
      centerY: number;
      initialVariant: DesignVariant;
    }
  | {
      mode: 'furniture-resize';
      furnitureId: string;
      initialVariant: DesignVariant;
    }
  | {
      mode: 'opening-slide';
      openingId: string;
      wallId: string;
      initialVariant: DesignVariant;
    }
  | {
      mode: 'door-swing';
      openingId: string;
      wallId: string;
      initialVariant: DesignVariant;
    }
  | null;

export const Canvas2D: React.FC<Canvas2DProps> = ({
  variant,
  rooms,
  selection,
  onSelect,
  activeTool,
  onToolChange,
  snapToGrid,
  onToggleSnapGrid,
  snapToVertices,
  onToggleSnapVertices,
  gridStep,
  onUpdateVariant,
  onDropCatalogItem,
  onAddWallSegment,
  onAddOpeningOnWall,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Camera state: panX, panY in world meters (center of viewport), zoom in pixels per meter
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(48); // 48 px per meter default
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
    w: 900,
    h: 700,
  });

  const [dragState, setDragState] = useState<DragState>(null);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  // Wall drawing state
  const [wallDraftStart, setWallDraftStart] = useState<{
    x: number;
    y: number;
    vertexId?: string;
  } | null>(null);

  // Measurement tool state
  const [measurePts, setMeasurePts] = useState<{
    start: { x: number; y: number } | null;
    end: { x: number; y: number } | null;
  }>({ start: null, end: null });

  // Observe container resize
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setViewportSize({ w: width, h: height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Convert screen client coordinates to world meters
  const clientToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const wx = pan.x + (sx - viewportSize.w / 2) / zoom;
      const wy = pan.y + (sy - viewportSize.h / 2) / zoom;
      return { x: roundM(wx, 3), y: roundM(wy, 3) };
    },
    [pan, zoom, viewportSize]
  );

  const fitViewToContent = useCallback(() => {
    if (variant.vertices.length === 0 && variant.furniture.length === 0) {
      setPan({ x: 0, y: 0 });
      setZoom(48);
      return;
    }
    const xs = [
      ...variant.vertices.map((v) => v.x),
      ...variant.furniture.map((f) => f.x),
    ];
    const ys = [
      ...variant.vertices.map((v) => v.y),
      ...variant.furniture.map((f) => f.y),
    ];
    const minX = Math.min(...xs) - 2.2;
    const maxX = Math.max(...xs) + 2.2;
    const minY = Math.min(...ys) - 2.2;
    const maxY = Math.max(...ys) + 2.2;
    const spanX = Math.max(4, maxX - minX);
    const spanY = Math.max(4, maxY - minY);
    const nextZoom = clamp(
      Math.min(viewportSize.w / spanX, viewportSize.h / spanY),
      10,
      140
    );
    setPan({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
    setZoom(nextZoom);
  }, [variant.vertices, variant.furniture, viewportSize]);

  // Clear wall draft on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWallDraftStart(null);
        setMeasurePts({ start: null, end: null });
        if (activeTool !== 'select') {
          onToolChange('select');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, onToolChange]);

  const vertexMap = new Map(variant.vertices.map((v) => [v.id, v]));
  const wallGeometries: WallGeometry[] = [];
  for (const w of variant.walls) {
    const wg = computeWallGeometry(w, vertexMap);
    if (wg) wallGeometries.push(wg);
  }

  // Find closest host wall when an opening tool is active
  const isOpeningTool =
    activeTool === 'door' ||
    activeTool === 'double-door' ||
    activeTool === 'sliding-door' ||
    activeTool === 'window' ||
    activeTool === 'storefront-window';

  let hoveredOpeningPreview: {
    wallId: string;
    wg: WallGeometry;
    offset: number;
    width: number;
  } | null = null;

  if (isOpeningTool) {
    let bestWg: WallGeometry | null = null;
    let bestDist = 0.65;
    let bestOffset = 0;

    for (const wg of wallGeometries) {
      const proj = projectPointOnWall(cursorWorld, wg);
      if (proj.perpDistance < bestDist) {
        bestDist = proj.perpDistance;
        bestWg = wg;
        bestOffset = proj.offsetAlongWall;
      }
    }

    if (bestWg) {
      const defaultW =
        activeTool === 'double-door'
          ? 1.6
          : activeTool === 'sliding-door'
          ? 1.8
          : activeTool === 'storefront-window'
          ? 2.2
          : activeTool === 'window'
          ? 1.4
          : 0.9;
      hoveredOpeningPreview = {
        wallId: bestWg.wall.id,
        wg: bestWg,
        offset: clamp(
          bestOffset,
          defaultW / 2 + DOMAIN_CONSTRAINTS.OPENING_SAFETY_MARGIN,
          Math.max(
            defaultW / 2 + DOMAIN_CONSTRAINTS.OPENING_SAFETY_MARGIN,
            bestWg.length - defaultW / 2 - DOMAIN_CONSTRAINTS.OPENING_SAFETY_MARGIN
          )
        ),
        width: Math.min(defaultW, Math.max(0.3, bestWg.length - 0.1)),
      };
    }
  }

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = clamp(zoom * factor, 8, 180);
    // Zoom toward mouse position
    const before = clientToWorld(e.clientX, e.clientY);
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const nextPanX = before.x - (sx - viewportSize.w / 2) / nextZoom;
      const nextPanY = before.y - (sy - viewportSize.h / 2) / nextZoom;
      setPan({ x: nextPanX, y: nextPanY });
    }
    setZoom(nextZoom);
  };

  const handlePointerDownCanvas = (e: React.PointerEvent<SVGSVGElement>) => {
    // Middle mouse or Pan tool or Spacebar pans canvas
    if (e.button === 1 || activeTool === 'pan') {
      e.preventDefault();
      setDragState({
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      });
      return;
    }

    if (e.button !== 0) return;

    const raw = clientToWorld(e.clientX, e.clientY);
    const snapped = snapWorldPoint(raw, variant.vertices, {
      snapToGrid,
      gridStep,
      snapToVertices,
      snapToAxes: true,
      anchorPoint: wallDraftStart || undefined,
      vertexSnapRadius: 12 / zoom,
    });

    if (activeTool === 'wall') {
      if (!wallDraftStart) {
        setWallDraftStart({
          x: snapped.x,
          y: snapped.y,
          vertexId: snapped.snappedVertexId,
        });
      } else {
        const d = dist2D(wallDraftStart, snapped);
        if (d >= DOMAIN_CONSTRAINTS.WALL_MIN_LENGTH) {
          onAddWallSegment(
            {
              x: wallDraftStart.x,
              y: wallDraftStart.y,
              existingVertexId: wallDraftStart.vertexId,
            },
            {
              x: snapped.x,
              y: snapped.y,
              existingVertexId: snapped.snappedVertexId,
            }
          );
          // Continue chain unless snapped to an existing closed vertex
          if (snapped.snappedVertexId) {
            setWallDraftStart(null);
          } else {
            setWallDraftStart({
              x: snapped.x,
              y: snapped.y,
            });
          }
        }
      }
      return;
    }

    if (isOpeningTool && hoveredOpeningPreview) {
      onAddOpeningOnWall(
        hoveredOpeningPreview.wallId,
        activeTool as OpeningType,
        hoveredOpeningPreview.offset
      );
      return;
    }

    if (activeTool === 'measure') {
      if (!measurePts.start || (measurePts.start && measurePts.end)) {
        setMeasurePts({ start: { x: snapped.x, y: snapped.y }, end: null });
      } else {
        setMeasurePts({
          start: measurePts.start,
          end: { x: snapped.x, y: snapped.y },
        });
      }
      return;
    }

    // Clicking empty background deselects or starts panning
    if (e.target === svgRef.current || (e.target as Element).getAttribute('data-bg') === 'true') {
      onSelect(null);
      setDragState({
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const raw = clientToWorld(e.clientX, e.clientY);

    if (!dragState) {
      const snapped = snapWorldPoint(raw, variant.vertices, {
        snapToGrid,
        gridStep,
        snapToVertices,
        snapToAxes: activeTool === 'wall' || activeTool === 'measure',
        anchorPoint: wallDraftStart || measurePts.start || undefined,
        vertexSnapRadius: 12 / zoom,
      });
      setCursorWorld({ x: snapped.x, y: snapped.y });
      setSnapGuides(snapped.guides);
      return;
    }

    if (dragState.mode === 'pan') {
      const dx = (e.clientX - dragState.startClientX) / zoom;
      const dy = (e.clientY - dragState.startClientY) / zoom;
      setPan({
        x: dragState.startPanX - dx,
        y: dragState.startPanY - dy,
      });
      return;
    }

    if (dragState.mode === 'vertex') {
      const snapped = snapWorldPoint(raw, variant.vertices, {
        snapToGrid,
        gridStep,
        snapToVertices: false,
        snapToAxes: true,
        excludeVertexIds: [dragState.vertexId],
      });
      setSnapGuides(snapped.guides);

      onUpdateVariant((prev) => {
        // Verify no connected wall becomes shorter than WALL_MIN_LENGTH (0.1m)
        const connectedWalls = prev.walls.filter(
          (w) =>
            w.startVertexId === dragState.vertexId ||
            w.endVertexId === dragState.vertexId
        );
        for (const cw of connectedWalls) {
          const otherId =
            cw.startVertexId === dragState.vertexId
              ? cw.endVertexId
              : cw.startVertexId;
          const otherV = prev.vertices.find((v) => v.id === otherId);
          if (otherV && dist2D(snapped, otherV) < DOMAIN_CONSTRAINTS.WALL_MIN_LENGTH) {
            return prev;
          }
        }

        const nextVertices = prev.vertices.map((v) =>
          v.id === dragState.vertexId ? { ...v, x: snapped.x, y: snapped.y } : v
        );
        const nextVMap = new Map(nextVertices.map((v) => [v.id, v]));

        // Re-validate openings on affected walls
        const nextOpenings = prev.openings.map((op) => {
          const hostWall = prev.walls.find((w) => w.id === op.wallId);
          if (!hostWall) return op;
          const wg = computeWallGeometry(hostWall, nextVMap);
          if (!wg) return op;
          return validateAndClampOpening(
            op,
            hostWall,
            wg.length,
            prev.openings.filter((o) => o.wallId === hostWall.id)
          );
        });

        return {
          ...prev,
          vertices: nextVertices,
          openings: nextOpenings,
        };
      }, false);
      return;
    }

    if (dragState.mode === 'wall-move') {
      const wall = dragState.initialVariant.walls.find(
        (w) => w.id === dragState.wallId
      );
      if (!wall) return;
      const initVMap = new Map(
        dragState.initialVariant.vertices.map((v) => [v.id, v])
      );
      const wg = computeWallGeometry(wall, initVMap);
      if (!wg) return;

      // Project movement along wall normal
      const deltaX = raw.x - dragState.startWorld.x;
      const deltaY = raw.y - dragState.startWorld.y;
      let normalShift = deltaX * wg.normX + deltaY * wg.normY;
      if (snapToGrid && gridStep > 0) {
        normalShift = Math.round(normalShift / gridStep) * gridStep;
      }

      const moveDx = roundM(wg.normX * normalShift);
      const moveDy = roundM(wg.normY * normalShift);

      onUpdateVariant((prev) => {
        const nextVertices = prev.vertices.map((v) => {
          if (v.id === wall.startVertexId || v.id === wall.endVertexId) {
            const orig = initVMap.get(v.id)!;
            return {
              ...v,
              x: clamp(
                roundM(orig.x + moveDx),
                DOMAIN_CONSTRAINTS.WORLD_MIN,
                DOMAIN_CONSTRAINTS.WORLD_MAX
              ),
              y: clamp(
                roundM(orig.y + moveDy),
                DOMAIN_CONSTRAINTS.WORLD_MIN,
                DOMAIN_CONSTRAINTS.WORLD_MAX
              ),
            };
          }
          return v;
        });
        return { ...prev, vertices: nextVertices };
      }, false);
      return;
    }

    if (dragState.mode === 'furniture-move') {
      let targetX = raw.x - dragState.offsetX;
      let targetY = raw.y - dragState.offsetY;
      if (snapToGrid && gridStep > 0) {
        targetX = roundM(Math.round(targetX / gridStep) * gridStep);
        targetY = roundM(Math.round(targetY / gridStep) * gridStep);
      }
      targetX = clamp(
        targetX,
        DOMAIN_CONSTRAINTS.WORLD_MIN,
        DOMAIN_CONSTRAINTS.WORLD_MAX
      );
      targetY = clamp(
        targetY,
        DOMAIN_CONSTRAINTS.WORLD_MIN,
        DOMAIN_CONSTRAINTS.WORLD_MAX
      );

      onUpdateVariant(
        (prev) => ({
          ...prev,
          furniture: prev.furniture.map((f) =>
            f.id === dragState.furnitureId && !f.locked
              ? { ...f, x: targetX, y: targetY }
              : f
          ),
        }),
        false
      );
      return;
    }

    if (dragState.mode === 'furniture-rotate') {
      const angRad = Math.atan2(
        raw.y - dragState.centerY,
        raw.x - dragState.centerX
      );
      let deg = ((angRad * 180) / Math.PI + 90 + 360) % 360;
      // Step snap to 15° unless Shift key is held for free rotation
      if (!e.shiftKey) {
        deg = Math.round(deg / 15) * 15;
      } else {
        deg = roundM(deg, 1);
      }

      onUpdateVariant(
        (prev) => ({
          ...prev,
          furniture: prev.furniture.map((f) =>
            f.id === dragState.furnitureId && !f.locked
              ? { ...f, rotation: deg % 360 }
              : f
          ),
        }),
        false
      );
      return;
    }

    if (dragState.mode === 'furniture-resize') {
      const item = variant.furniture.find(
        (f) => f.id === dragState.furnitureId
      );
      if (!item || item.locked) return;
      const dx = raw.x - item.x;
      const dy = raw.y - item.y;
      const rad = (-item.rotation * Math.PI) / 180;
      const lx = Math.abs(dx * Math.cos(rad) - dy * Math.sin(rad)) * 2;
      const ly = Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad)) * 2;

      const nextW = roundM(
        clamp(
          lx,
          DOMAIN_CONSTRAINTS.FURNITURE_MIN_SPAN,
          DOMAIN_CONSTRAINTS.FURNITURE_MAX_SPAN
        ),
        2
      );
      const nextD = roundM(
        clamp(
          ly,
          DOMAIN_CONSTRAINTS.FURNITURE_MIN_SPAN,
          DOMAIN_CONSTRAINTS.FURNITURE_MAX_SPAN
        ),
        2
      );

      onUpdateVariant(
        (prev) => ({
          ...prev,
          furniture: prev.furniture.map((f) =>
            f.id === dragState.furnitureId
              ? { ...f, width: nextW, depth: nextD }
              : f
          ),
        }),
        false
      );
      return;
    }

    if (dragState.mode === 'opening-slide') {
      const wall = variant.walls.find((w) => w.id === dragState.wallId);
      if (!wall) return;
      const wg = computeWallGeometry(wall, vertexMap);
      if (!wg) return;

      const proj = projectPointOnWall(raw, wg);
      let newOffset = proj.offsetAlongWall;
      if (snapToGrid && gridStep > 0) {
        newOffset = Math.round(newOffset / gridStep) * gridStep;
      }

      onUpdateVariant((prev) => {
        const others = prev.openings.filter(
          (o) => o.wallId === wall.id && o.id !== dragState.openingId
        );
        return {
          ...prev,
          openings: prev.openings.map((op) =>
            op.id === dragState.openingId
              ? validateAndClampOpening(
                  { ...op, offset: newOffset },
                  wall,
                  wg.length,
                  others
                )
              : op
          ),
        };
      }, false);
      return;
    }

    if (dragState.mode === 'door-swing') {
      const wall = variant.walls.find((w) => w.id === dragState.wallId);
      const op = variant.openings.find((o) => o.id === dragState.openingId);
      if (!wall || !op) return;
      const wg = computeWallGeometry(wall, vertexMap);
      if (!wg) return;

      // Transform mouse world coords into opening local frame
      const cx = wg.start.x + wg.dirX * op.offset;
      const cy = wg.start.y + wg.dirY * op.offset;
      const dx = raw.x - cx;
      const dy = raw.y - cy;
      const lx = dx * wg.dirX + dy * wg.dirY;
      const ly = dx * wg.normX + dy * wg.normY;

      const hingeX = op.swingDirection === 'left' ? -op.width / 2 : op.width / 2;
      const relX = Math.abs(lx - hingeX);
      const relY = Math.abs(ly);
      const angleDeg = Math.round(
        clamp(
          (Math.atan2(relY, Math.max(0.01, relX)) * 180) / Math.PI,
          DOMAIN_CONSTRAINTS.DOOR_SWING_MIN,
          DOMAIN_CONSTRAINTS.DOOR_SWING_MAX
        )
      );

      onUpdateVariant(
        (prev) => ({
          ...prev,
          openings: prev.openings.map((o) =>
            o.id === dragState.openingId ? { ...o, swingAngle: angleDeg } : o
          ),
        }),
        false
      );
      return;
    }
  };

  const handlePointerUp = () => {
    if (dragState && dragState.mode !== 'pan') {
      // Commit transaction to history stack on mouse release
      onUpdateVariant((prev) => ({ ...prev }), true);
    }
    setDragState(null);
    setSnapGuides([]);
  };

  // Drag & drop from left Catalog panel
  const handleDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const catalogId = e.dataTransfer.getData('application/forma-catalog-id');
    if (!catalogId) return;
    const raw = clientToWorld(e.clientX, e.clientY);
    const snapped = snapWorldPoint(raw, variant.vertices, {
      snapToGrid,
      gridStep,
      snapToVertices: false,
      snapToAxes: false,
    });
    onDropCatalogItem(catalogId, snapped.x, snapped.y);
  };

  // Compute SVG viewBox in world meters
  const viewW = viewportSize.w / zoom;
  const viewH = viewportSize.h / zoom;
  const viewMinX = pan.x - viewW / 2;
  const viewMinY = pan.y - viewH / 2;

  const px = (n: number) => n / zoom; // Convert screen pixels to SVG world units

  return (
    <div className="relative w-full h-full bg-stone-950 overflow-hidden select-none">
      <svg
        ref={svgRef}
        className={`w-full h-full ${
          activeTool === 'pan' || dragState?.mode === 'pan'
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'wall' || activeTool === 'measure' || isOpeningTool
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
        viewBox={`${viewMinX} ${viewMinY} ${viewW} ${viewH}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDownCanvas}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <defs>
          {/* Minor 0.25m Grid */}
          <pattern
            id="minor-grid"
            width={0.25}
            height={0.25}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0.25 0 L 0 0 0 0.25"
              fill="none"
              stroke="rgba(168, 162, 158, 0.07)"
              strokeWidth={px(0.8)}
            />
          </pattern>
          {/* Major 1.0m Grid */}
          <pattern
            id="major-grid"
            width={1.0}
            height={1.0}
            patternUnits="userSpaceOnUse"
          >
            <rect width={1.0} height={1.0} fill="url(#minor-grid)" />
            <path
              d="M 1.0 0 L 0 0 0 1.0"
              fill="none"
              stroke="rgba(168, 162, 158, 0.16)"
              strokeWidth={px(1.1)}
            />
          </pattern>
        </defs>

        {/* Background Grid across -50m to +50m */}
        <rect
          data-bg="true"
          x={DOMAIN_CONSTRAINTS.WORLD_MIN}
          y={DOMAIN_CONSTRAINTS.WORLD_MIN}
          width={DOMAIN_CONSTRAINTS.WORLD_MAX - DOMAIN_CONSTRAINTS.WORLD_MIN}
          height={DOMAIN_CONSTRAINTS.WORLD_MAX - DOMAIN_CONSTRAINTS.WORLD_MIN}
          fill="url(#major-grid)"
          stroke="rgba(245, 158, 11, 0.28)"
          strokeWidth={px(1.5)}
          strokeDasharray={`${px(8)} ${px(6)}`}
        />

        {/* World Origin Crosshair (0,0) */}
        <line
          x1={DOMAIN_CONSTRAINTS.WORLD_MIN}
          y1={0}
          x2={DOMAIN_CONSTRAINTS.WORLD_MAX}
          y2={0}
          stroke="rgba(245, 158, 11, 0.14)"
          strokeWidth={px(1)}
          pointerEvents="none"
        />
        <line
          x1={0}
          y1={DOMAIN_CONSTRAINTS.WORLD_MIN}
          x2={0}
          y2={DOMAIN_CONSTRAINTS.WORLD_MAX}
          stroke="rgba(245, 158, 11, 0.14)"
          strokeWidth={px(1)}
          pointerEvents="none"
        />

        {/* 1. Detected Closed Room Polygons */}
        {rooms.map((room) => {
          const isSelected =
            selection?.type === 'room' && selection.id === room.key;
          const mat = getMaterial(room.floorMaterialId);
          const pts = room.points.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <g
              key={room.key}
              onClick={(e) => {
                if (activeTool !== 'select') return;
                e.stopPropagation();
                onSelect({ type: 'room', id: room.key });
              }}
              className="cursor-pointer"
            >
              <polygon
                points={pts}
                fill={mat.color}
                fillOpacity={isSelected ? 0.34 : 0.22}
                stroke={isSelected ? '#f59e0b' : 'rgba(255,255,255,0.12)'}
                strokeWidth={px(isSelected ? 2.5 : 1)}
              />
              {/* Room Label & Live Area Badge */}
              <g
                transform={`translate(${room.centroid.x}, ${room.centroid.y})`}
                pointerEvents="none"
              >
                <rect
                  x={px(-68)}
                  y={px(-20)}
                  width={px(136)}
                  height={px(38)}
                  rx={px(5)}
                  fill="rgba(12, 10, 9, 0.82)"
                  stroke={
                    isSelected
                      ? 'rgba(245, 158, 11, 0.8)'
                      : 'rgba(120, 113, 108, 0.4)'
                  }
                  strokeWidth={px(1)}
                />
                <text
                  x={0}
                  y={px(-5)}
                  textAnchor="middle"
                  fill="#f5f5f4"
                  fontSize={px(10.5)}
                  fontWeight={600}
                >
                  {room.name}
                </text>
                <text
                  x={0}
                  y={px(10)}
                  textAnchor="middle"
                  fill="#fbbf24"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={px(9.5)}
                >
                  {room.areaSqm.toFixed(2)} m² · {mat.name.split(' ')[0]}
                </text>
              </g>
            </g>
          );
        })}

        {/* 2. Furniture & Architectural Catalog Items */}
        {variant.furniture.map((item) => (
          <Furniture2DSymbol
            key={item.id}
            item={item}
            isSelected={
              selection?.type === 'furniture' && selection.id === item.id
            }
            px={px}
            onPointerDownItem={(e) => {
              if (activeTool !== 'select') return;
              e.stopPropagation();
              onSelect({ type: 'furniture', id: item.id });
              const raw = clientToWorld(e.clientX, e.clientY);
              setDragState({
                mode: 'furniture-move',
                furnitureId: item.id,
                offsetX: raw.x - item.x,
                offsetY: raw.y - item.y,
                initialVariant: variant,
              });
            }}
            onPointerDownRotate={(e) => {
              e.stopPropagation();
              setDragState({
                mode: 'furniture-rotate',
                furnitureId: item.id,
                centerX: item.x,
                centerY: item.y,
                initialVariant: variant,
              });
            }}
            onPointerDownResize={(e) => {
              e.stopPropagation();
              setDragState({
                mode: 'furniture-resize',
                furnitureId: item.id,
                initialVariant: variant,
              });
            }}
          />
        ))}

        {/* 3. Walls & Architectural Dimension Callouts */}
        {wallGeometries.map((wg) => {
          const isSelected =
            selection?.type === 'wall' && selection.id === wg.wall.id;
          const pts = wg.corners.map((c) => `${c.x},${c.y}`).join(' ');
          const mat = getMaterial(wg.wall.materialId);

          return (
            <g key={wg.wall.id}>
              {/* Wall Polygon */}
              <polygon
                points={pts}
                fill={isSelected ? '#451a03' : '#292524'}
                stroke={isSelected ? '#f59e0b' : mat.color}
                strokeWidth={px(isSelected ? 2.4 : 1.5)}
                className="cursor-move"
                onPointerDown={(e) => {
                  if (activeTool !== 'select') return;
                  e.stopPropagation();
                  onSelect({ type: 'wall', id: wg.wall.id });
                  const raw = clientToWorld(e.clientX, e.clientY);
                  setDragState({
                    mode: 'wall-move',
                    wallId: wg.wall.id,
                    startWorld: raw,
                    initialVariant: variant,
                  });
                }}
              />
              {/* Wall Centerline */}
              <line
                x1={wg.start.x}
                y1={wg.start.y}
                x2={wg.end.x}
                y2={wg.end.y}
                stroke={
                  isSelected
                    ? 'rgba(251, 191, 36, 0.8)'
                    : 'rgba(168, 162, 158, 0.35)'
                }
                strokeWidth={px(1)}
                strokeDasharray={`${px(4)} ${px(3)}`}
                pointerEvents="none"
              />
              {/* Wall Length Pill */}
              <g
                transform={`translate(${
                  wg.midX + wg.normX * (wg.wall.thickness / 2 + px(14))
                }, ${wg.midY + wg.normY * (wg.wall.thickness / 2 + px(14))})`}
                pointerEvents="none"
              >
                <rect
                  x={px(-24)}
                  y={px(-8)}
                  width={px(48)}
                  height={px(16)}
                  rx={px(3)}
                  fill="rgba(12, 10, 9, 0.85)"
                  stroke={
                    isSelected
                      ? '#f59e0b'
                      : 'rgba(120, 113, 108, 0.45)'
                  }
                  strokeWidth={px(1)}
                />
                <text
                  x={0}
                  y={px(3.5)}
                  textAnchor="middle"
                  fill={isSelected ? '#fbbf24' : '#d6d3d1'}
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={px(9.5)}
                >
                  {wg.length.toFixed(2)}m
                </text>
              </g>
            </g>
          );
        })}

        {/* 4. Wall Openings (Doors, Double Doors, Sliding Doors, Windows) & Swing Arc Handles */}
        {variant.openings.map((op) => {
          const wg = wallGeometries.find((g) => g.wall.id === op.wallId);
          if (!wg) return null;
          const isSelected =
            selection?.type === 'opening' && selection.id === op.id;

          return (
            <Opening2DSymbol
              key={op.id}
              opening={op}
              wg={wg}
              isSelected={isSelected}
              px={px}
              onPointerDownOpening={(e) => {
                if (activeTool !== 'select') return;
                e.stopPropagation();
                onSelect({ type: 'opening', id: op.id });
                setDragState({
                  mode: 'opening-slide',
                  openingId: op.id,
                  wallId: op.wallId,
                  initialVariant: variant,
                });
              }}
              onPointerDownSwingHandle={(e) => {
                e.stopPropagation();
                onSelect({ type: 'opening', id: op.id });
                setDragState({
                  mode: 'door-swing',
                  openingId: op.id,
                  wallId: op.wallId,
                  initialVariant: variant,
                });
              }}
            />
          );
        })}

        {/* 5. Wall Vertices (Draggable Corner Nodes) */}
        {variant.vertices.map((v) => {
          const isSelected =
            selection?.type === 'vertex' && selection.id === v.id;
          return (
            <g
              key={v.id}
              transform={`translate(${v.x}, ${v.y})`}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                if (activeTool !== 'select') return;
                e.stopPropagation();
                onSelect({ type: 'vertex', id: v.id });
                setDragState({
                  mode: 'vertex',
                  vertexId: v.id,
                  initialVariant: variant,
                });
              }}
            >
              <circle
                r={px(isSelected ? 7.5 : 5.5)}
                fill={isSelected ? '#f59e0b' : '#1c1917'}
                stroke={isSelected ? '#fef3c7' : '#a8a29e'}
                strokeWidth={px(2)}
              />
            </g>
          );
        })}

        {/* 6. Active Opening Placement Preview */}
        {hoveredOpeningPreview && (
          <g
            transform={`translate(${
              hoveredOpeningPreview.wg.start.x +
              hoveredOpeningPreview.wg.dirX * hoveredOpeningPreview.offset
            }, ${
              hoveredOpeningPreview.wg.start.y +
              hoveredOpeningPreview.wg.dirY * hoveredOpeningPreview.offset
            }) rotate(${hoveredOpeningPreview.wg.angleDeg})`}
            pointerEvents="none"
          >
            <rect
              x={-hoveredOpeningPreview.width / 2}
              y={-hoveredOpeningPreview.wg.wall.thickness / 2 - 0.03}
              width={hoveredOpeningPreview.width}
              height={hoveredOpeningPreview.wg.wall.thickness + 0.06}
              fill="rgba(245, 158, 11, 0.35)"
              stroke="#fbbf24"
              strokeWidth={px(2)}
              strokeDasharray={`${px(4)} ${px(2)}`}
            />
          </g>
        )}

        {/* 7. Active Wall Drawing Draft Line */}
        {activeTool === 'wall' && wallDraftStart && (
          <g pointerEvents="none">
            <line
              x1={wallDraftStart.x}
              y1={wallDraftStart.y}
              x2={cursorWorld.x}
              y2={cursorWorld.y}
              stroke="#f59e0b"
              strokeWidth={0.2}
              strokeOpacity={0.5}
            />
            <line
              x1={wallDraftStart.x}
              y1={wallDraftStart.y}
              x2={cursorWorld.x}
              y2={cursorWorld.y}
              stroke="#fbbf24"
              strokeWidth={px(2)}
              strokeDasharray={`${px(5)} ${px(4)}`}
            />
            <g
              transform={`translate(${(wallDraftStart.x + cursorWorld.x) / 2}, ${
                (wallDraftStart.y + cursorWorld.y) / 2 - px(16)
              })`}
            >
              <rect
                x={px(-42)}
                y={px(-10)}
                width={px(84)}
                height={px(20)}
                rx={px(4)}
                fill="#0c0a09"
                stroke="#f59e0b"
                strokeWidth={px(1.2)}
              />
              <text
                x={0}
                y={px(4)}
                textAnchor="middle"
                fill="#fbbf24"
                fontFamily="JetBrains Mono, monospace"
                fontSize={px(10)}
              >
                {dist2D(wallDraftStart, cursorWorld).toFixed(3)}m
              </text>
            </g>
          </g>
        )}

        {/* 8. Interactive Measurement Tape Overlay */}
        {(activeTool === 'measure' || measurePts.start) && measurePts.start && (
          <g pointerEvents="none">
            {(() => {
              const p1 = measurePts.start!;
              const p2 = measurePts.end || cursorWorld;
              const dist = dist2D(p1, p2);
              return (
                <>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#38bdf8"
                    strokeWidth={px(2)}
                    strokeDasharray={`${px(5)} ${px(3)}`}
                  />
                  <circle cx={p1.x} cy={p1.y} r={px(4.5)} fill="#38bdf8" />
                  <circle cx={p2.x} cy={p2.y} r={px(4.5)} fill="#38bdf8" />
                  <g
                    transform={`translate(${(p1.x + p2.x) / 2}, ${
                      (p1.y + p2.y) / 2 - px(16)
                    })`}
                  >
                    <rect
                      x={px(-48)}
                      y={px(-11)}
                      width={px(96)}
                      height={px(22)}
                      rx={px(4)}
                      fill="#082f49"
                      stroke="#38bdf8"
                      strokeWidth={px(1.2)}
                    />
                    <text
                      x={0}
                      y={px(4)}
                      textAnchor="middle"
                      fill="#e0f2fe"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize={px(10.5)}
                      fontWeight={600}
                    >
                      {dist.toFixed(3)} m
                    </text>
                  </g>
                </>
              );
            })()}
          </g>
        )}

        {/* 9. Real-time Vertex & Axis Snapping Guidelines */}
        {snapGuides.map((g, i) => (
          <line
            key={i}
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            stroke="#fbbf24"
            strokeWidth={px(1.2)}
            strokeDasharray={`${px(4)} ${px(4)}`}
            pointerEvents="none"
          />
        ))}
      </svg>

      {/* Top-Left 2D Viewport Badge & Live Cursor Coordinates */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <div className="px-2.5 py-1 rounded-md bg-stone-900/90 border border-stone-800 backdrop-blur-md flex items-center gap-2 shadow-lg">
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-stone-200">
            2D Plan View
          </span>
          <span className="text-[11px] font-mono text-stone-400 border-l border-stone-700 pl-2">
            X: {cursorWorld.x.toFixed(2)}m · Y: {cursorWorld.y.toFixed(2)}m
          </span>
        </div>
        {activeTool !== 'select' && (
          <div className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-medium">
            Tool: <strong className="uppercase">{activeTool}</strong> (ESC to exit)
          </div>
        )}
      </div>

      {/* Bottom-Left 2D Snap & Zoom HUD Controls */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-stone-900/90 border border-stone-800/90 rounded-lg p-1 backdrop-blur-md shadow-xl">
        <button
          onClick={onToggleSnapGrid}
          title={`Toggle Grid Snapping (${gridStep}m)`}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
            snapToGrid
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Grid {gridStep}m</span>
        </button>

        <button
          onClick={onToggleSnapVertices}
          title="Toggle Vertex & Axis Guideline Snapping"
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
            snapToVertices
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Magnet className="w-3.5 h-3.5" />
          <span>Snap</span>
        </button>

        <div className="h-4 w-px bg-stone-800 mx-0.5" />

        <button
          onClick={() => setZoom((z) => clamp(z / 1.2, 8, 180))}
          title="Zoom Out"
          className="p-1.5 rounded text-stone-400 hover:text-stone-100 hover:bg-stone-800"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-mono text-stone-300 px-1 min-w-[44px] text-center">
          {Math.round((zoom / 48) * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => clamp(z * 1.2, 8, 180))}
          title="Zoom In"
          className="p-1.5 rounded text-stone-400 hover:text-stone-100 hover:bg-stone-800"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={fitViewToContent}
          title="Fit Plan to Screen"
          className="p-1.5 rounded text-stone-400 hover:text-stone-100 hover:bg-stone-800"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface Opening2DSymbolProps {
  opening: WallOpening;
  wg: WallGeometry;
  isSelected: boolean;
  px: (n: number) => number;
  onPointerDownOpening: (e: React.PointerEvent) => void;
  onPointerDownSwingHandle: (e: React.PointerEvent) => void;
}

const Opening2DSymbol: React.FC<Opening2DSymbolProps> = ({
  opening,
  wg,
  isSelected,
  px,
  onPointerDownOpening,
  onPointerDownSwingHandle,
}) => {
  const cx = wg.start.x + wg.dirX * opening.offset;
  const cy = wg.start.y + wg.dirY * opening.offset;
  const W = opening.width;
  const T = wg.wall.thickness;

  const isDoor =
    opening.type === 'door' ||
    opening.type === 'double-door' ||
    opening.type === 'sliding-door';

  const rad = (opening.swingAngle * Math.PI) / 180;
  const sign = opening.flipInOut ? -1 : 1;
  const hingeX = opening.swingDirection === 'left' ? -W / 2 : W / 2;
  const dirSign = opening.swingDirection === 'left' ? 1 : -1;
  const leafRadius = opening.type === 'double-door' ? W / 2 : W;
  const tipX = hingeX + dirSign * leafRadius * Math.cos(rad);
  const tipY = sign * leafRadius * Math.sin(rad);
  const arcStartX = hingeX + dirSign * leafRadius;

  return (
    <g
      transform={`translate(${cx}, ${cy}) rotate(${wg.angleDeg})`}
      className="cursor-pointer"
      onPointerDown={onPointerDownOpening}
    >
      {/* Wall Cutout Mask */}
      <rect
        x={-W / 2}
        y={-T / 2 - px(1.5)}
        width={W}
        height={T + px(3)}
        fill="#141210"
        stroke={isSelected ? '#f59e0b' : '#78716c'}
        strokeWidth={px(isSelected ? 2 : 1.2)}
      />

      {/* Window Glazing Lines */}
      {!isDoor && (
        <>
          <line
            x1={-W / 2}
            y1={-T * 0.18}
            x2={W / 2}
            y2={-T * 0.18}
            stroke="#38bdf8"
            strokeWidth={px(1.8)}
          />
          <line
            x1={-W / 2}
            y1={T * 0.18}
            x2={W / 2}
            y2={T * 0.18}
            stroke="#38bdf8"
            strokeWidth={px(1.8)}
          />
        </>
      )}

      {/* Sliding Door Panels */}
      {opening.type === 'sliding-door' && (
        <>
          <line
            x1={-W * 0.45}
            y1={-px(2)}
            x2={W * 0.05}
            y2={-px(2)}
            stroke="#fbbf24"
            strokeWidth={px(2.5)}
          />
          <line
            x1={-W * 0.05}
            y1={px(2)}
            x2={W * 0.45}
            y2={px(2)}
            stroke="#fbbf24"
            strokeWidth={px(2.5)}
          />
        </>
      )}

      {/* Swing Door Leaf & Interactive Swing Arc (0° to 110°) */}
      {(opening.type === 'door' || opening.type === 'double-door') && (
        <>
          {/* Door Swing Arc */}
          {opening.swingAngle > 2 && (
            <path
              d={`M ${arcStartX} 0 A ${leafRadius} ${leafRadius} 0 0 ${
                sign * dirSign > 0 ? 1 : 0
              } ${tipX} ${tipY}`}
              fill="rgba(245, 158, 11, 0.12)"
              stroke={isSelected ? '#fbbf24' : '#d97706'}
              strokeWidth={px(1.3)}
              strokeDasharray={`${px(4)} ${px(3)}`}
            />
          )}
          {/* Door Leaf */}
          <line
            x1={hingeX}
            y1={0}
            x2={tipX}
            y2={tipY}
            stroke={isSelected ? '#fde68a' : '#f59e0b'}
            strokeWidth={px(3)}
            strokeLinecap="round"
          />
          {/* Second leaf for double-door */}
          {opening.type === 'double-door' && (
            <line
              x1={-hingeX}
              y1={0}
              x2={-hingeX - dirSign * leafRadius * Math.cos(rad)}
              y2={tipY}
              stroke={isSelected ? '#fde68a' : '#f59e0b'}
              strokeWidth={px(3)}
              strokeLinecap="round"
            />
          )}
          {/* Interactive Swing Angle Drag Handle at Door Tip */}
          <circle
            cx={tipX}
            cy={tipY}
            r={px(isSelected ? 5.5 : 4)}
            fill="#f59e0b"
            stroke="#0c0a09"
            strokeWidth={px(1.5)}
            className="cursor-ew-resize"
            onPointerDown={onPointerDownSwingHandle}
          >
            <title>Drag to adjust door swing arc ({opening.swingAngle}°)</title>
          </circle>
        </>
      )}
    </g>
  );
};

interface Furniture2DSymbolProps {
  item: FurnitureInstance;
  isSelected: boolean;
  px: (n: number) => number;
  onPointerDownItem: (e: React.PointerEvent) => void;
  onPointerDownRotate: (e: React.PointerEvent) => void;
  onPointerDownResize: (e: React.PointerEvent) => void;
}

const Furniture2DSymbol: React.FC<Furniture2DSymbolProps> = ({
  item,
  isSelected,
  px,
  onPointerDownItem,
  onPointerDownRotate,
  onPointerDownResize,
}) => {
  const W = item.width;
  const D = item.depth;
  const pMat = getMaterial(item.primaryMaterialId);
  const sMat = getMaterial(item.secondaryMaterialId);

  const isRound =
    item.shape === 'bistro-table-round' ||
    item.shape === 'bar-stool' ||
    item.shape === 'potted-plant' ||
    item.shape === 'pendant-light';

  return (
    <g
      transform={`translate(${item.x}, ${item.y}) rotate(${item.rotation})`}
      className="cursor-move"
      onPointerDown={onPointerDownItem}
    >
      {/* Base Shape */}
      {isRound ? (
        <ellipse
          cx={0}
          cy={0}
          rx={W / 2}
          ry={D / 2}
          fill={item.isLight ? 'rgba(251, 191, 36, 0.18)' : pMat.color}
          fillOpacity={item.isLight ? 0.35 : 0.85}
          stroke={
            isSelected
              ? '#f59e0b'
              : item.isLight
              ? '#fbbf24'
              : '#1c1917'
          }
          strokeWidth={px(isSelected ? 2.4 : 1.4)}
          strokeDasharray={item.isLight ? `${px(4)} ${px(3)}` : undefined}
        />
      ) : (
        <rect
          x={-W / 2}
          y={-D / 2}
          width={W}
          height={D}
          rx={Math.min(0.06, Math.min(W, D) * 0.12)}
          fill={pMat.color}
          fillOpacity={item.isLight ? 0.35 : 0.88}
          stroke={isSelected ? '#f59e0b' : '#1c1917'}
          strokeWidth={px(isSelected ? 2.4 : 1.4)}
        />
      )}

      {/* Architectural 2D Plan Detail Accents */}
      {(item.shape === 'dining-chair' ||
        item.shape === 'armchair' ||
        item.shape === 'banquette-bench') && (
        <rect
          x={-W * 0.44}
          y={-D / 2 + 0.02}
          width={W * 0.88}
          height={D * 0.22}
          rx={0.02}
          fill={sMat.color}
          pointerEvents="none"
        />
      )}

      {item.shape === 'potted-plant' && (
        <circle
          cx={0}
          cy={0}
          r={Math.min(W, D) * 0.25}
          fill={sMat.color}
          pointerEvents="none"
        />
      )}

      {item.isLight && (
        <>
          <line
            x1={-W * 0.3}
            y1={0}
            x2={W * 0.3}
            y2={0}
            stroke="#fbbf24"
            strokeWidth={px(1.2)}
            pointerEvents="none"
          />
          <line
            x1={0}
            y1={-D * 0.3}
            x2={0}
            y2={D * 0.3}
            stroke="#fbbf24"
            strokeWidth={px(1.2)}
            pointerEvents="none"
          />
        </>
      )}

      {/* Item Label */}
      {Math.min(W, D) >= 0.55 && (
        <text
          x={0}
          y={px(3)}
          textAnchor="middle"
          fill="#fafaf9"
          fontSize={px(8.5)}
          fontWeight={500}
          pointerEvents="none"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
        >
          {item.name.split(' ').slice(0, 2).join(' ')}
        </text>
      )}

      {/* Selection Manipulation Handles: Rotation Stem + Corner Resize */}
      {isSelected && !item.locked && (
        <g>
          {/* Rotation Handle above front (+Y or -Y) */}
          <line
            x1={0}
            y1={-D / 2}
            x2={0}
            y2={-D / 2 - px(18)}
            stroke="#f59e0b"
            strokeWidth={px(1.5)}
          />
          <circle
            cx={0}
            cy={-D / 2 - px(18)}
            r={px(5.5)}
            fill="#f59e0b"
            stroke="#0c0a09"
            strokeWidth={px(1.5)}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDownRotate}
          >
            <title>Drag to rotate (Hold Shift for free angle)</title>
          </circle>

          {/* Bottom-Right Resize Handle */}
          <rect
            x={W / 2 - px(4.5)}
            y={D / 2 - px(4.5)}
            width={px(9)}
            height={px(9)}
            rx={px(1.5)}
            fill="#fef3c7"
            stroke="#d97706"
            strokeWidth={px(1.5)}
            className="cursor-nwse-resize"
            onPointerDown={onPointerDownResize}
          >
            <title>Drag to resize width & depth</title>
          </rect>
        </g>
      )}
    </g>
  );
};

