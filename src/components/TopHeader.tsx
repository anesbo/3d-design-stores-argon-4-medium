import React, { useRef, useState } from 'react';
import {
  ProjectFile,
  ViewLayoutMode,
} from '../types/domain';
import { PRESET_LIST } from '../data/presets';
import { BOMSummary } from '../utils/bom';
import {
  Camera,
  ChevronDown,
  Columns,
  CopyPlus,
  Download,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
  GitBranch,
  Layers,
  Redo2,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';

interface TopHeaderProps {
  project: ProjectFile;
  bom: BOMSummary;
  viewLayout: ViewLayoutMode;
  onViewLayoutChange: (mode: ViewLayoutMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onSelectPreset: (presetId: string) => void;
  onSelectVariant: (variantId: string) => void;
  onDuplicateVariant: () => void;
  onDeleteVariant: (variantId: string) => void;
  onExportJSON: () => void;
  onImportJSONFile: (file: File) => void;
  onExportSVG: () => void;
  onExportCSV: () => void;
  onExportPNGSnapshot: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  project,
  bom,
  viewLayout,
  onViewLayoutChange,
  canUndo,
  canRedo,
  undoCount,
  redoCount,
  onUndo,
  onRedo,
  onSelectPreset,
  onSelectVariant,
  onDuplicateVariant,
  onDeleteVariant,
  onExportJSON,
  onImportJSONFile,
  onExportSVG,
  onExportCSV,
  onExportPNGSnapshot,
}) => {
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeVariant =
    project.variants.find((v) => v.id === project.activeVariantId) ||
    project.variants[0];

  return (
    <header className="h-13 px-3 py-2 bg-stone-950 border-b border-stone-800 flex items-center justify-between gap-3 shrink-0 select-none z-30">
      {/* Left: Brand + Preset Space Switcher + Design Alternatives */}
      <div className="flex items-center gap-3">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 pr-2 border-r border-stone-800">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 font-black text-sm shadow">
            F
          </div>
          <div>
            <div className="text-xs font-bold tracking-wider uppercase text-stone-100 leading-none">
              FORMA
            </div>
            <div className="text-[9px] font-mono text-stone-400 tracking-tight">
              COMMERCIAL SPACE DESIGNER
            </div>
          </div>
        </div>

        {/* Preset Spaces Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setPresetMenuOpen((v) => !v);
              setExportMenuOpen(false);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700/80 text-xs font-semibold text-stone-100 transition"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>{project.name}</span>
            <span className="px-1.5 py-0.2 rounded bg-stone-800 text-[10px] font-mono text-amber-300">
              {bom.totalFloorAreaSqm.toFixed(0)} m²
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          </button>

          {presetMenuOpen && (
            <div
              className="absolute left-0 mt-1.5 w-72 rounded-xl bg-stone-900 border border-stone-700 shadow-2xl p-1.5 z-50 space-y-1"
              onMouseLeave={() => setPresetMenuOpen(false)}
            >
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-stone-400">
                Built-in Pre-Engineered Spaces
              </div>
              {PRESET_LIST.map((preset) => {
                const isCurrent = project.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onSelectPreset(preset.id);
                      setPresetMenuOpen(false);
                    }}
                    className={`w-full p-2 rounded-lg text-left flex items-center justify-between transition ${
                      isCurrent
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                        : 'hover:bg-stone-800 text-stone-200'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{preset.name}</div>
                      <div className="text-[10px] text-stone-400">
                        {preset.subtitle}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-stone-950 font-mono text-[11px] text-amber-400">
                      {preset.areaLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Design Variants / Alternatives Bar */}
        <div className="flex items-center gap-1 bg-stone-900/90 border border-stone-800 rounded-lg p-1">
          <GitBranch className="w-3.5 h-3.5 text-amber-400 ml-1.5 mr-0.5" />
          {project.variants.map((v) => {
            const isActive = v.id === activeVariant.id;
            return (
              <div key={v.id} className="flex items-center">
                <button
                  onClick={() => onSelectVariant(v.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    isActive
                      ? 'bg-amber-500 text-stone-950 font-semibold shadow'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {v.name}
                </button>
                {isActive && project.variants.length > 1 && (
                  <button
                    onClick={() => onDeleteVariant(v.id)}
                    title="Delete this design alternative"
                    className="p-1 text-stone-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={onDuplicateVariant}
            title="Create new Design Alternative / Option from current layout"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-300 hover:bg-stone-800 transition"
          >
            <CopyPlus className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">New Option</span>
          </button>
        </div>
      </div>

      {/* Center: Dual-View Layout Switcher (2D | Split | 3D) */}
      <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 rounded-lg p-1">
        <button
          onClick={() => onViewLayoutChange('2d-only')}
          className={`px-2.5 py-1 rounded text-xs font-medium transition ${
            viewLayout === '2d-only'
              ? 'bg-amber-500 text-stone-950 font-semibold'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          2D Plan
        </button>
        <button
          onClick={() => onViewLayoutChange('split')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
            viewLayout === 'split'
              ? 'bg-amber-500 text-stone-950 font-semibold'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Columns className="w-3.5 h-3.5" />
          <span>Dual Split</span>
        </button>
        <button
          onClick={() => onViewLayoutChange('3d-only')}
          className={`px-2.5 py-1 rounded text-xs font-medium transition ${
            viewLayout === '3d-only'
              ? 'bg-amber-500 text-stone-950 font-semibold'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          3D Scene
        </button>
      </div>

      {/* Right: Live Budget Pill, Undo/Redo Stack (80 steps), & Export Engine */}
      <div className="flex items-center gap-2">
        {/* Live Cost & Area Pill */}
        <div className="hidden lg:flex items-center gap-3 px-3 py-1 rounded-lg bg-stone-900 border border-stone-800 font-mono text-xs">
          <div>
            <span className="text-stone-500 mr-1">AREA:</span>
            <span className="text-stone-200 font-semibold">
              {bom.totalFloorAreaSqm.toFixed(1)} m²
            </span>
          </div>
          <div className="h-3.5 w-px bg-stone-800" />
          <div>
            <span className="text-stone-500 mr-1">BUDGET:</span>
            <span className="text-amber-400 font-semibold">
              ${bom.grandTotalCost.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Transaction Undo / Redo Stack */}
        <div className="flex items-center gap-0.5 bg-stone-900 border border-stone-800 rounded-lg p-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title={`Undo (Ctrl+Z) — ${undoCount} steps available`}
            className="p-1.5 rounded text-stone-300 hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
          >
            <Undo2 className="w-3.5 h-3.5" />
            {undoCount > 0 && (
              <span className="text-[10px] font-mono text-stone-400">
                {undoCount}
              </span>
            )}
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title={`Redo (Ctrl+Y) — ${redoCount} steps available`}
            className="p-1.5 rounded text-stone-300 hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
          >
            <Redo2 className="w-3.5 h-3.5" />
            {redoCount > 0 && (
              <span className="text-[10px] font-mono text-stone-400">
                {redoCount}
              </span>
            )}
          </button>
        </div>

        {/* Import / Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setExportMenuOpen((v) => !v);
              setPresetMenuOpen(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs shadow transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Persistence &amp; Export</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {exportMenuOpen && (
            <div
              className="absolute right-0 mt-1.5 w-64 rounded-xl bg-stone-900 border border-stone-700 shadow-2xl p-1.5 z-50 space-y-1"
              onMouseLeave={() => setExportMenuOpen(false)}
            >
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setExportMenuOpen(false);
                }}
                className="w-full p-2 rounded-lg hover:bg-stone-800 text-left flex items-center gap-2.5 text-xs text-stone-200"
              >
                <Upload className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-semibold">Import Project JSON</div>
                  <div className="text-[10px] text-stone-400">
                    Schema-validated .forma.json
                  </div>
                </div>
              </button>

              <div className="h-px bg-stone-800 my-1" />

              <button
                onClick={() => {
                  onExportJSON();
                  setExportMenuOpen(false);
                }}
                className="w-full p-2 rounded-lg hover:bg-stone-800 text-left flex items-center gap-2.5 text-xs text-stone-200"
              >
                <FileJson className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-semibold">Export Project JSON</div>
                  <div className="text-[10px] text-stone-400">
                    Full vertices, walls &amp; variants
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onExportSVG();
                  setExportMenuOpen(false);
                }}
                className="w-full p-2 rounded-lg hover:bg-stone-800 text-left flex items-center gap-2.5 text-xs text-stone-200"
              >
                <FileCode className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="font-semibold">
                    Export Architectural SVG (1:10)
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Centerlines, dimensions &amp; swing arcs
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onExportCSV();
                  setExportMenuOpen(false);
                }}
                className="w-full p-2 rounded-lg hover:bg-stone-800 text-left flex items-center gap-2.5 text-xs text-stone-200"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-semibold">Export BOM Schedule CSV</div>
                  <div className="text-[10px] text-stone-400">
                    Quantities, unit rates &amp; subtotals
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onExportPNGSnapshot();
                  setExportMenuOpen(false);
                }}
                className="w-full p-2 rounded-lg hover:bg-stone-800 text-left flex items-center gap-2.5 text-xs text-stone-200"
              >
                <Camera className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="font-semibold">Export 3D PNG Snapshot</div>
                  <div className="text-[10px] text-stone-400">
                    Clean high-res WebGL capture
                  </div>
                </div>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportJSONFile(file);
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>
    </header>
  );
};

