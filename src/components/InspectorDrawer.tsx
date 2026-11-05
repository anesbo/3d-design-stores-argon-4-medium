import React, { useState } from 'react';
import {
  DesignVariant,
  DetectedRoom,
  DOMAIN_CONSTRAINTS,
  SelectionTarget,
} from '../types/domain';
import { MATERIALS } from '../data/materials';
import { BOMSummary } from '../utils/bom';
import {
  clamp,
  clampWorldCoord,
  computeWallGeometry,
  roundM,
  validateAndClampOpening,
} from '../utils/geometry';
import {
  Copy,
  DollarSign,
  Download,
  FlipHorizontal,
  FlipVertical,
  Layers,
  Lock,
  RotateCw,
  Sliders,
  Sun,
  Trash2,
  Unlock,
} from 'lucide-react';

interface InspectorDrawerProps {
  variant: DesignVariant;
  rooms: DetectedRoom[];
  selection: SelectionTarget;
  onSelect: (target: SelectionTarget) => void;
  bom: BOMSummary;
  onUpdateVariant: (
    updater: (prev: DesignVariant) => DesignVariant,
    commitHistory?: boolean
  ) => void;
  onDeleteSelected: () => void;
  onDuplicateFurniture: (id: string) => void;
  onExportCSV: () => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  variant,
  rooms,
  selection,
  onSelect,
  bom,
  onUpdateVariant,
  onDeleteSelected,
  onDuplicateFurniture,
  onExportCSV,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'bom'>('inspector');

  const vertexMap = new Map(variant.vertices.map((v) => [v.id, v]));

  const selectedWall =
    selection?.type === 'wall'
      ? variant.walls.find((w) => w.id === selection.id)
      : undefined;
  const selectedWallGeom = selectedWall
    ? computeWallGeometry(selectedWall, vertexMap)
    : null;

  const selectedVertex =
    selection?.type === 'vertex'
      ? variant.vertices.find((v) => v.id === selection.id)
      : undefined;

  const selectedOpening =
    selection?.type === 'opening'
      ? variant.openings.find((o) => o.id === selection.id)
      : undefined;

  const selectedFurniture =
    selection?.type === 'furniture'
      ? variant.furniture.find((f) => f.id === selection.id)
      : undefined;

  const selectedRoom =
    selection?.type === 'room'
      ? rooms.find((r) => r.key === selection.id)
      : undefined;

  // Adjust wall length by moving endVertex along wall direction vector
  const handleWallLengthChange = (newLenRaw: number) => {
    if (!selectedWall || !selectedWallGeom) return;
    const targetLen = clamp(
      newLenRaw,
      DOMAIN_CONSTRAINTS.WALL_MIN_LENGTH,
      100
    );
    const newEndX = clampWorldCoord(
      selectedWallGeom.start.x + selectedWallGeom.dirX * targetLen
    );
    const newEndY = clampWorldCoord(
      selectedWallGeom.start.y + selectedWallGeom.dirY * targetLen
    );

    onUpdateVariant((prev) => {
      const nextVertices = prev.vertices.map((v) =>
        v.id === selectedWall.endVertexId
          ? { ...v, x: newEndX, y: newEndY }
          : v
      );
      const nextVMap = new Map(nextVertices.map((v) => [v.id, v]));
      const nextOpenings = prev.openings.map((op) => {
        if (op.wallId !== selectedWall.id) return op;
        const wg = computeWallGeometry(selectedWall, nextVMap);
        if (!wg) return op;
        return validateAndClampOpening(
          op,
          selectedWall,
          wg.length,
          prev.openings.filter((o) => o.wallId === selectedWall.id)
        );
      });
      return { ...prev, vertices: nextVertices, openings: nextOpenings };
    }, true);
  };

  return (
    <aside className="w-80 bg-stone-900/95 border-l border-stone-800 flex flex-col h-full shrink-0 select-none">
      {/* Top Drawer Switcher: Property Inspector vs Live BOM Schedule */}
      <div className="grid grid-cols-2 p-2 gap-1 border-b border-stone-800 bg-stone-950/60">
        <button
          onClick={() => setActiveTab('inspector')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-semibold transition ${
            activeTab === 'inspector'
              ? 'bg-amber-500 text-stone-950 shadow'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </button>
        <button
          onClick={() => setActiveTab('bom')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-semibold transition ${
            activeTab === 'bom'
              ? 'bg-amber-500 text-stone-950 shadow'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>BOM (${Math.round(bom.grandTotalCost / 1000)}k)</span>
        </button>
      </div>

      {activeTab === 'inspector' ? (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {/* === WALL INSPECTOR === */}
          {selectedWall && selectedWallGeom && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    Structural Wall
                  </span>
                  <h3 className="text-sm font-semibold text-stone-100">
                    {selectedWall.label || `Wall ${selectedWall.id}`}
                  </h3>
                </div>
                <button
                  onClick={onDeleteSelected}
                  title="Delete Wall (Del)"
                  className="p-1.5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-stone-400 mb-1">
                  Wall Label
                </label>
                <input
                  type="text"
                  value={selectedWall.label || ''}
                  onChange={(e) =>
                    onUpdateVariant(
                      (prev) => ({
                        ...prev,
                        walls: prev.walls.map((w) =>
                          w.id === selectedWall.id
                            ? { ...w, label: e.target.value }
                            : w
                        ),
                      }),
                      true
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs text-stone-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Length (m)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={DOMAIN_CONSTRAINTS.WALL_MIN_LENGTH}
                    value={roundM(selectedWallGeom.length, 3)}
                    onChange={(e) =>
                      handleWallLengthChange(parseFloat(e.target.value) || 0.1)
                    }
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Thick (m)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={DOMAIN_CONSTRAINTS.WALL_MIN_THICKNESS}
                    max={DOMAIN_CONSTRAINTS.WALL_MAX_THICKNESS}
                    value={selectedWall.thickness}
                    onChange={(e) => {
                      const val = roundM(
                        clamp(
                          parseFloat(e.target.value) || 0.2,
                          DOMAIN_CONSTRAINTS.WALL_MIN_THICKNESS,
                          DOMAIN_CONSTRAINTS.WALL_MAX_THICKNESS
                        ),
                        3
                      );
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          walls: prev.walls.map((w) =>
                            w.id === selectedWall.id
                              ? { ...w, thickness: val }
                              : w
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Height (m)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={DOMAIN_CONSTRAINTS.WALL_MIN_HEIGHT}
                    max={DOMAIN_CONSTRAINTS.WALL_MAX_HEIGHT}
                    value={selectedWall.height}
                    onChange={(e) => {
                      const val = roundM(
                        clamp(
                          parseFloat(e.target.value) || 3.0,
                          DOMAIN_CONSTRAINTS.WALL_MIN_HEIGHT,
                          DOMAIN_CONSTRAINTS.WALL_MAX_HEIGHT
                        ),
                        3
                      );
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          walls: prev.walls.map((w) =>
                            w.id === selectedWall.id
                              ? { ...w, height: val }
                              : w
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-stone-400 mb-1">
                  Surface Material Finish
                </label>
                <select
                  value={selectedWall.materialId}
                  onChange={(e) =>
                    onUpdateVariant(
                      (prev) => ({
                        ...prev,
                        walls: prev.walls.map((w) =>
                          w.id === selectedWall.id
                            ? { ...w, materialId: e.target.value }
                            : w
                        ),
                      }),
                      true
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs text-stone-100"
                >
                  {MATERIALS.filter(
                    (m) =>
                      m.category === 'wall' ||
                      m.category === 'wood' ||
                      m.category === 'stone'
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (${m.costPerSqm}/m²)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* === VERTEX INSPECTOR === */}
          {selectedVertex && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    Wall Corner Vertex
                  </span>
                  <h3 className="text-sm font-semibold text-stone-100">
                    Node {selectedVertex.id}
                  </h3>
                </div>
                <button
                  onClick={onDeleteSelected}
                  className="p-1.5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    X Coordinate (m)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={DOMAIN_CONSTRAINTS.WORLD_MIN}
                    max={DOMAIN_CONSTRAINTS.WORLD_MAX}
                    value={selectedVertex.x}
                    onChange={(e) => {
                      const nx = clampWorldCoord(
                        parseFloat(e.target.value) || 0
                      );
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          vertices: prev.vertices.map((v) =>
                            v.id === selectedVertex.id ? { ...v, x: nx } : v
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Y Coordinate (m)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={DOMAIN_CONSTRAINTS.WORLD_MIN}
                    max={DOMAIN_CONSTRAINTS.WORLD_MAX}
                    value={selectedVertex.y}
                    onChange={(e) => {
                      const ny = clampWorldCoord(
                        parseFloat(e.target.value) || 0
                      );
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          vertices: prev.vertices.map((v) =>
                            v.id === selectedVertex.id ? { ...v, y: ny } : v
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* === OPENING INSPECTOR (DOORS & WINDOWS) === */}
          {selectedOpening && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    Wall Opening
                  </span>
                  <h3 className="text-sm font-semibold text-stone-100 capitalize">
                    {selectedOpening.type.replace('-', ' ')}
                  </h3>
                </div>
                <button
                  onClick={onDeleteSelected}
                  className="p-1.5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Width (m, min 0.3)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={DOMAIN_CONSTRAINTS.OPENING_MIN_WIDTH}
                    value={selectedOpening.width}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0.3;
                      onUpdateVariant((prev) => {
                        const wall = prev.walls.find(
                          (w) => w.id === selectedOpening.wallId
                        );
                        if (!wall) return prev;
                        const wg = computeWallGeometry(wall, vertexMap);
                        if (!wg) return prev;
                        const others = prev.openings.filter(
                          (o) =>
                            o.wallId === wall.id && o.id !== selectedOpening.id
                        );
                        return {
                          ...prev,
                          openings: prev.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? validateAndClampOpening(
                                  { ...o, width: val },
                                  wall,
                                  wg.length,
                                  others
                                )
                              : o
                          ),
                        };
                      }, true);
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Height (m, min 0.3)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={DOMAIN_CONSTRAINTS.OPENING_MIN_HEIGHT}
                    value={selectedOpening.height}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0.3;
                      onUpdateVariant((prev) => {
                        const wall = prev.walls.find(
                          (w) => w.id === selectedOpening.wallId
                        );
                        if (!wall) return prev;
                        const wg = computeWallGeometry(wall, vertexMap);
                        if (!wg) return prev;
                        const others = prev.openings.filter(
                          (o) =>
                            o.wallId === wall.id && o.id !== selectedOpening.id
                        );
                        return {
                          ...prev,
                          openings: prev.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? validateAndClampOpening(
                                  { ...o, height: val },
                                  wall,
                                  wg.length,
                                  others
                                )
                              : o
                          ),
                        };
                      }, true);
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Offset from Start (m)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={selectedOpening.offset}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0.3;
                      onUpdateVariant((prev) => {
                        const wall = prev.walls.find(
                          (w) => w.id === selectedOpening.wallId
                        );
                        if (!wall) return prev;
                        const wg = computeWallGeometry(wall, vertexMap);
                        if (!wg) return prev;
                        const others = prev.openings.filter(
                          (o) =>
                            o.wallId === wall.id && o.id !== selectedOpening.id
                        );
                        return {
                          ...prev,
                          openings: prev.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? validateAndClampOpening(
                                  { ...o, offset: val },
                                  wall,
                                  wg.length,
                                  others
                                )
                              : o
                          ),
                        };
                      }, true);
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Sill Height (m)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={0}
                    disabled={!selectedOpening.type.includes('window')}
                    value={selectedOpening.sillHeight}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateVariant((prev) => {
                        const wall = prev.walls.find(
                          (w) => w.id === selectedOpening.wallId
                        );
                        if (!wall) return prev;
                        const wg = computeWallGeometry(wall, vertexMap);
                        if (!wg) return prev;
                        const others = prev.openings.filter(
                          (o) =>
                            o.wallId === wall.id && o.id !== selectedOpening.id
                        );
                        return {
                          ...prev,
                          openings: prev.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? validateAndClampOpening(
                                  { ...o, sillHeight: val },
                                  wall,
                                  wg.length,
                                  others
                                )
                              : o
                          ),
                        };
                      }, true);
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100 disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Door Swing Angle (0° to 110°) & Handing */}
              {!selectedOpening.type.includes('window') && (
                <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-300 font-medium">
                      Door Swing Arc (0°–110°)
                    </span>
                    <span className="font-mono text-amber-400 font-semibold">
                      {selectedOpening.swingAngle}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={DOMAIN_CONSTRAINTS.DOOR_SWING_MIN}
                    max={DOMAIN_CONSTRAINTS.DOOR_SWING_MAX}
                    value={selectedOpening.swingAngle}
                    onChange={(e) => {
                      const ang = parseInt(e.target.value, 10);
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          openings: prev.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? { ...o, swingAngle: ang }
                              : o
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-full accent-amber-500"
                  />
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      onClick={() =>
                        onUpdateVariant(
                          (prev) => ({
                            ...prev,
                            openings: prev.openings.map((o) =>
                              o.id === selectedOpening.id
                                ? {
                                    ...o,
                                    swingDirection:
                                      o.swingDirection === 'left'
                                        ? 'right'
                                        : 'left',
                                  }
                                : o
                            ),
                          }),
                          true
                        )
                      }
                      className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[11px] text-stone-200 flex items-center justify-center gap-1"
                    >
                      <FlipHorizontal className="w-3.5 h-3.5" />
                      <span>Hinge: {selectedOpening.swingDirection}</span>
                    </button>
                    <button
                      onClick={() =>
                        onUpdateVariant(
                          (prev) => ({
                            ...prev,
                            openings: prev.openings.map((o) =>
                              o.id === selectedOpening.id
                                ? { ...o, flipInOut: !o.flipInOut }
                                : o
                            ),
                          }),
                          true
                        )
                      }
                      className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[11px] text-stone-200 flex items-center justify-center gap-1"
                    >
                      <FlipVertical className="w-3.5 h-3.5" />
                      <span>Flip In/Out</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Frame Finish
                  </label>
                  <select
                    value={selectedOpening.frameMaterialId}
                    onChange={(e) =>
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          openings: prev.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? { ...o, frameMaterialId: e.target.value }
                              : o
                          ),
                        }),
                        true
                      )
                    }
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs text-stone-100"
                  >
                    {MATERIALS.filter(
                      (m) => m.category === 'metal' || m.category === 'wood'
                    ).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Unit Rate ($ USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={selectedOpening.unitCost}
                    onChange={(e) => {
                      const rate = Math.max(0, parseFloat(e.target.value) || 0);
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          openings: prev.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? { ...o, unitCost: rate }
                              : o
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* === FURNITURE & LIGHTING INSPECTOR === */}
          {selectedFurniture && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    {selectedFurniture.isLight
                      ? 'Architectural Luminaire'
                      : `Catalog · ${selectedFurniture.category}`}
                  </span>
                  <h3 className="text-sm font-semibold text-stone-100">
                    {selectedFurniture.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          furniture: prev.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, locked: !f.locked }
                              : f
                          ),
                        }),
                        true
                      )
                    }
                    title={selectedFurniture.locked ? 'Unlock' : 'Lock Position'}
                    className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                  >
                    {selectedFurniture.locked ? (
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => onDuplicateFurniture(selectedFurniture.id)}
                    title="Duplicate Item (Ctrl+D)"
                    className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onDeleteSelected}
                    title="Delete Item (Del)"
                    className="p-1.5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Dimensions (Precision 0.001m) */}
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1.5">
                  Dimensions (Precision 0.001m)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1">
                      Width (m)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min={DOMAIN_CONSTRAINTS.FURNITURE_MIN_SPAN}
                      max={DOMAIN_CONSTRAINTS.FURNITURE_MAX_SPAN}
                      value={selectedFurniture.width}
                      onChange={(e) => {
                        const val = roundM(
                          clamp(
                            parseFloat(e.target.value) || 0.1,
                            DOMAIN_CONSTRAINTS.FURNITURE_MIN_SPAN,
                            DOMAIN_CONSTRAINTS.FURNITURE_MAX_SPAN
                          ),
                          3
                        );
                        onUpdateVariant(
                          (prev) => ({
                            ...prev,
                            furniture: prev.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? { ...f, width: val }
                                : f
                            ),
                          }),
                          true
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1">
                      Depth (m)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min={DOMAIN_CONSTRAINTS.FURNITURE_MIN_SPAN}
                      max={DOMAIN_CONSTRAINTS.FURNITURE_MAX_SPAN}
                      value={selectedFurniture.depth}
                      onChange={(e) => {
                        const val = roundM(
                          clamp(
                            parseFloat(e.target.value) || 0.1,
                            DOMAIN_CONSTRAINTS.FURNITURE_MIN_SPAN,
                            DOMAIN_CONSTRAINTS.FURNITURE_MAX_SPAN
                          ),
                          3
                        );
                        onUpdateVariant(
                          (prev) => ({
                            ...prev,
                            furniture: prev.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? { ...f, depth: val }
                                : f
                            ),
                          }),
                          true
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1">
                      Height (m)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min={DOMAIN_CONSTRAINTS.FURNITURE_MIN_HEIGHT}
                      max={DOMAIN_CONSTRAINTS.FURNITURE_MAX_HEIGHT}
                      value={selectedFurniture.height}
                      onChange={(e) => {
                        const val = roundM(
                          clamp(
                            parseFloat(e.target.value) || 0.005,
                            DOMAIN_CONSTRAINTS.FURNITURE_MIN_HEIGHT,
                            DOMAIN_CONSTRAINTS.FURNITURE_MAX_HEIGHT
                          ),
                          3
                        );
                        onUpdateVariant(
                          (prev) => ({
                            ...prev,
                            furniture: prev.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? { ...f, height: val }
                                : f
                            ),
                          }),
                          true
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                    />
                  </div>
                </div>
              </div>

              {/* Position & Elevation */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    X Pos (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedFurniture.x}
                    onChange={(e) => {
                      const val = clampWorldCoord(
                        parseFloat(e.target.value) || 0
                      );
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          furniture: prev.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, x: val }
                              : f
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Y Pos (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedFurniture.y}
                    onChange={(e) => {
                      const val = clampWorldCoord(
                        parseFloat(e.target.value) || 0
                      );
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          furniture: prev.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, y: val }
                              : f
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Elevation (m)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={5.8}
                    value={selectedFurniture.elevation}
                    onChange={(e) => {
                      const val = roundM(
                        clamp(parseFloat(e.target.value) || 0, 0, 5.8),
                        3
                      );
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          furniture: prev.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, elevation: val }
                              : f
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100"
                  />
                </div>
              </div>

              {/* Rotation (Step & Free) + Mirror Flip */}
              <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">
                    Rotation Angle (°)
                  </span>
                  <input
                    type="number"
                    step="1"
                    value={selectedFurniture.rotation}
                    onChange={(e) => {
                      const deg =
                        ((parseFloat(e.target.value) || 0) % 360 + 360) % 360;
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          furniture: prev.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, rotation: roundM(deg, 1) }
                              : f
                          ),
                        }),
                        true
                      );
                    }}
                    className="w-20 px-2 py-1 rounded bg-stone-900 border border-stone-700 text-xs font-mono text-amber-400 text-right"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[15, 45, 90].map((step) => (
                    <button
                      key={step}
                      onClick={() =>
                        onUpdateVariant(
                          (prev) => ({
                            ...prev,
                            furniture: prev.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? {
                                    ...f,
                                    rotation: (f.rotation + step) % 360,
                                  }
                                : f
                            ),
                          }),
                          true
                        )
                      }
                      className="px-1.5 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-[11px] font-mono text-stone-300 flex items-center justify-center gap-0.5"
                    >
                      <RotateCw className="w-3 h-3" />+{step}°
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          furniture: prev.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, flippedX: !f.flippedX }
                              : f
                          ),
                        }),
                        true
                      )
                    }
                    className={`px-1.5 py-1 rounded border text-[11px] flex items-center justify-center gap-0.5 ${
                      selectedFurniture.flippedX
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-stone-900 border-stone-800 text-stone-300'
                    }`}
                  >
                    <FlipHorizontal className="w-3 h-3" />
                    Flip
                  </button>
                </div>
              </div>

              {/* PBR Material Finishes */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Primary Finish Material
                  </label>
                  <select
                    value={selectedFurniture.primaryMaterialId}
                    onChange={(e) =>
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          furniture: prev.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, primaryMaterialId: e.target.value }
                              : f
                          ),
                        }),
                        true
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs text-stone-100"
                  >
                    {MATERIALS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1">
                    Secondary / Accent Material
                  </label>
                  <select
                    value={selectedFurniture.secondaryMaterialId}
                    onChange={(e) =>
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          furniture: prev.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, secondaryMaterialId: e.target.value }
                              : f
                          ),
                        }),
                        true
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs text-stone-100"
                  >
                    {MATERIALS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Luminaire Controls if Light */}
              {selectedFurniture.isLight && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
                    <span>Photometric Output</span>
                    <input
                      type="color"
                      value={selectedFurniture.lightColor || '#ffdfa8'}
                      onChange={(e) =>
                        onUpdateVariant(
                          (prev) => ({
                            ...prev,
                            furniture: prev.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? { ...f, lightColor: e.target.value }
                                : f
                            ),
                          }),
                          true
                        )
                      }
                      className="w-6 h-5 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-stone-300">
                      <span>Intensity</span>
                      <span>
                        {(selectedFurniture.lightIntensity ?? 2.4).toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={6.0}
                      step={0.1}
                      value={selectedFurniture.lightIntensity ?? 2.4}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateVariant(
                          (prev) => ({
                            ...prev,
                            furniture: prev.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? { ...f, lightIntensity: val }
                                : f
                            ),
                          }),
                          true
                        );
                      }}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Unit Pricing Rate */}
              <div>
                <label className="block text-[10px] text-stone-400 mb-1">
                  Unit Rate ($ USD)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={selectedFurniture.unitCost}
                  onChange={(e) => {
                    const cost = Math.max(0, parseFloat(e.target.value) || 0);
                    onUpdateVariant(
                      (prev) => ({
                        ...prev,
                        furniture: prev.furniture.map((f) =>
                          f.id === selectedFurniture.id
                            ? { ...f, unitCost: cost }
                            : f
                        ),
                      }),
                      true
                    );
                  }}
                  className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs font-mono text-amber-400 font-semibold"
                />
              </div>
            </div>
          )}

          {/* === ROOM POLYGON INSPECTOR === */}
          {selectedRoom && (
            <div className="space-y-3.5">
              <div className="pb-2 border-b border-stone-800">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                  Detected Enclosed Room Polygon
                </span>
                <h3 className="text-sm font-semibold text-stone-100">
                  {selectedRoom.name}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-stone-950 border border-stone-800 font-mono text-xs">
                <div>
                  <span className="block text-[10px] text-stone-400">
                    NET FLOOR AREA
                  </span>
                  <span className="text-amber-400 font-semibold">
                    {selectedRoom.areaSqm.toFixed(2)} m²
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-stone-400">
                    PERIMETER
                  </span>
                  <span className="text-stone-200">
                    {selectedRoom.perimeterM.toFixed(2)} m
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-stone-400 mb-1">
                  Zone Name
                </label>
                <input
                  type="text"
                  value={selectedRoom.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    onUpdateVariant(
                      (prev) => ({
                        ...prev,
                        roomOverrides: {
                          ...prev.roomOverrides,
                          [selectedRoom.key]: {
                            roomKey: selectedRoom.key,
                            name,
                            floorMaterialId: selectedRoom.floorMaterialId,
                          },
                        },
                      }),
                      true
                    );
                  }}
                  className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs text-stone-100"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-400 mb-1">
                  Flooring PBR Material
                </label>
                <select
                  value={selectedRoom.floorMaterialId}
                  onChange={(e) => {
                    const matId = e.target.value;
                    onUpdateVariant(
                      (prev) => ({
                        ...prev,
                        roomOverrides: {
                          ...prev.roomOverrides,
                          [selectedRoom.key]: {
                            roomKey: selectedRoom.key,
                            name: selectedRoom.name,
                            floorMaterialId: matId,
                          },
                        },
                      }),
                      true
                    );
                  }}
                  className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs text-stone-100"
                >
                  {MATERIALS.filter((m) => m.category === 'floor').map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (${m.costPerSqm}/m²)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* === DEFAULT SCENE / DAYLIGHTING INSPECTOR WHEN NOTHING SELECTED === */}
          {!selection && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-stone-800">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                  Global Variant Settings
                </span>
                <h3 className="text-sm font-semibold text-stone-100">
                  {variant.name}
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  {variant.description ||
                    'Click any wall, door, window, room zone, or catalog item in 2D or 3D to inspect and fine-tune.'}
                </p>
              </div>

              {/* Default Floor Finish */}
              <div>
                <label className="block text-[11px] text-stone-400 mb-1">
                  Default Space Flooring Material
                </label>
                <select
                  value={variant.defaultFloorMaterialId}
                  onChange={(e) =>
                    onUpdateVariant(
                      (prev) => ({
                        ...prev,
                        defaultFloorMaterialId: e.target.value,
                      }),
                      true
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-xs text-stone-100"
                >
                  {MATERIALS.filter((m) => m.category === 'floor').map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (${m.costPerSqm}/m²)
                    </option>
                  ))}
                </select>
              </div>

              {/* Studio Daylight & Sun Orientation */}
              <div className="p-3 rounded-lg bg-stone-950 border border-stone-800 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-200">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>3D Studio Daylight &amp; Sun</span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-stone-400">
                    <span>Ambient Exposure</span>
                    <span className="font-mono text-stone-200">
                      {variant.ambientLightIntensity.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.8}
                    step={0.05}
                    value={variant.ambientLightIntensity}
                    onChange={(e) =>
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          ambientLightIntensity: parseFloat(e.target.value),
                        }),
                        false
                      )
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-stone-400">
                    <span>Sun Azimuth (°)</span>
                    <span className="font-mono text-stone-200">
                      {variant.sunAzimuth}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={variant.sunAzimuth}
                    onChange={(e) =>
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          sunAzimuth: parseInt(e.target.value, 10),
                        }),
                        false
                      )
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-stone-400">
                    <span>Sun Elevation (°)</span>
                    <span className="font-mono text-stone-200">
                      {variant.sunElevation}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={85}
                    step={2}
                    value={variant.sunElevation}
                    onChange={(e) =>
                      onUpdateVariant(
                        (prev) => ({
                          ...prev,
                          sunElevation: parseInt(e.target.value, 10),
                        }),
                        false
                      )
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              {/* Quick Detected Rooms List */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Detected Room Zones ({rooms.length})</span>
                </span>
                {rooms.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => onSelect({ type: 'room', id: r.key })}
                    className="w-full p-2 rounded bg-stone-950 hover:bg-stone-800/80 border border-stone-800 flex items-center justify-between text-left transition"
                  >
                    <div>
                      <div className="text-xs font-medium text-stone-200">
                        {r.name}
                      </div>
                      <div className="text-[10px] font-mono text-stone-400">
                        Perim: {r.perimeterM.toFixed(2)}m
                      </div>
                    </div>
                    <span className="text-xs font-mono text-amber-400 font-semibold">
                      {r.areaSqm.toFixed(2)} m²
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* === BILL OF MATERIALS (BOM) & LIVE BUDGET ESTIMATION TAB === */
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
          {/* Grand Total Card */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 via-stone-900 to-stone-950 border border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                Estimated Turnkey Budget
              </span>
              <span className="text-[11px] font-mono text-stone-300">
                ${bom.costPerSqm.toLocaleString()}/m²
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              ${bom.grandTotalCost.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-800/80 text-[11px] font-mono">
              <div>
                <span className="text-stone-400 block text-[9px]">
                  FLOOR FINISH AREA
                </span>
                <span className="text-stone-100 font-semibold">
                  {bom.totalFloorAreaSqm.toFixed(2)} m²
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-[9px]">
                  NET WALL AREA (2-SIDED)
                </span>
                <span className="text-stone-100 font-semibold">
                  {bom.totalNetWallAreaSqm.toFixed(2)} m²
                </span>
              </div>
            </div>
          </div>

          {/* Category Subtotals */}
          <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-300">
              <span>Flooring Finishes</span>
              <span className="font-mono">
                ${bom.flooringCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-stone-300">
              <span>Wall Paint, Brick &amp; Paneling</span>
              <span className="font-mono">
                ${bom.wallFinishCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-stone-300">
              <span>Doors &amp; Storefront Glazing</span>
              <span className="font-mono">
                ${bom.openingsCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-stone-300">
              <span>Commercial FF&amp;E ({bom.totalFurnitureCount})</span>
              <span className="font-mono">
                ${bom.furnitureCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-stone-300">
              <span>Architectural Lighting ({bom.totalLightsCount})</span>
              <span className="font-mono">
                ${bom.lightingCost.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={onExportCSV}
            className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs flex items-center justify-center gap-1.5 shadow transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Schedule</span>
          </button>

          {/* Line Items Schedule */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
              Quantity Schedule ({bom.lineItems.length} entries)
            </span>
            {bom.lineItems.map((li) => (
              <div
                key={li.id}
                className="p-2 rounded bg-stone-950/90 border border-stone-800/80 text-xs space-y-0.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-stone-200 leading-tight">
                    {li.itemName}
                  </span>
                  <span className="font-mono text-amber-400 font-semibold shrink-0">
                    ${li.totalCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                  <span className="truncate max-w-[165px]">{li.dimensions}</span>
                  <span>
                    {li.quantity} {li.unit} × ${li.unitRate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

