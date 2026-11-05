import React, { useState } from 'react';
import {
  ActiveTool,
  CatalogCategory,
  CatalogItemDef,
  DesignVariant,
  DOMAIN_CONSTRAINTS,
} from '../types/domain';
import { CATALOG_ITEMS } from '../data/catalog';
import { getMaterial } from '../data/materials';
import {
  Armchair,
  Columns,
  DoorOpen,
  Hand,
  LampCeiling,
  MousePointer,
  PenTool,
  Plus,
  Ruler,
  Search,
  ShoppingBag,
  Sparkles,
  Square,
  Table,
} from 'lucide-react';

interface CatalogSidebarProps {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  onAddCatalogItemCenter: (catalogId: string) => void;
  variant: DesignVariant;
}

export const CatalogSidebar: React.FC<CatalogSidebarProps> = ({
  activeTool,
  onToolChange,
  onAddCatalogItemCenter,
  variant,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    CatalogCategory | 'all'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = CATALOG_ITEMS.filter((item) => {
    const matchesCat =
      selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const lightCount = variant.furniture.filter((f) => f.isLight).length;

  const toolButtons: {
    id: ActiveTool;
    label: string;
    hint: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'select',
      label: 'Select',
      hint: 'Select, drag, rotate & inspect (V)',
      icon: <MousePointer className="w-3.5 h-3.5" />,
    },
    {
      id: 'wall',
      label: 'Wall',
      hint: 'Draw structural or partition walls (W)',
      icon: <PenTool className="w-3.5 h-3.5" />,
    },
    {
      id: 'door',
      label: 'Single Door',
      hint: 'Place hinged swing door on any wall',
      icon: <DoorOpen className="w-3.5 h-3.5" />,
    },
    {
      id: 'double-door',
      label: 'Double Door',
      hint: 'Place commercial French double door on wall',
      icon: <DoorOpen className="w-3.5 h-3.5" />,
    },
    {
      id: 'sliding-door',
      label: 'Sliding Door',
      hint: 'Place wide sliding glass door on wall',
      icon: <Columns className="w-3.5 h-3.5" />,
    },
    {
      id: 'window',
      label: 'Window',
      hint: 'Place architectural window on wall',
      icon: <Square className="w-3.5 h-3.5" />,
    },
    {
      id: 'storefront-window',
      label: 'Storefront',
      hint: 'Place mullioned commercial storefront glazing',
      icon: <Square className="w-3.5 h-3.5" />,
    },
    {
      id: 'measure',
      label: 'Measure',
      hint: 'Point-to-point precision tape measure',
      icon: <Ruler className="w-3.5 h-3.5" />,
    },
    {
      id: 'pan',
      label: 'Pan Canvas',
      hint: 'Pan 2D plan view',
      icon: <Hand className="w-3.5 h-3.5" />,
    },
  ];

  const categories: {
    id: CatalogCategory | 'all';
    label: string;
    icon: React.ReactNode;
  }[] = [
    { id: 'all', label: 'All (19)', icon: <Sparkles className="w-3 h-3" /> },
    { id: 'seating', label: 'Seating', icon: <Armchair className="w-3 h-3" /> },
    { id: 'surfaces', label: 'Surfaces', icon: <Table className="w-3 h-3" /> },
    {
      id: 'retail',
      label: 'Retail & Bar',
      icon: <ShoppingBag className="w-3 h-3" />,
    },
    {
      id: 'architecture',
      label: 'Arch & Light',
      icon: <LampCeiling className="w-3 h-3" />,
    },
  ];

  return (
    <aside className="w-72 bg-stone-900/95 border-r border-stone-800 flex flex-col h-full shrink-0 select-none">
      {/* 1. Architectural Authoring Tools */}
      <div className="p-3 border-b border-stone-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Architectural Tools
          </span>
          <span className="text-[10px] font-mono text-amber-400/90">
            1:10 Metric
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {toolButtons.map((tb) => {
            const active = activeTool === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => onToolChange(tb.id)}
                title={tb.hint}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-md border text-[11px] font-medium transition ${
                  active
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-stone-950/60 border-stone-800/80 text-stone-300 hover:bg-stone-800/80 hover:text-white'
                }`}
              >
                {tb.icon}
                <span className="truncate w-full text-center">{tb.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Procedural 3D Commercial Catalog Header & Search */}
      <div className="p-3 border-b border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Procedural 3D Catalog
          </span>
          <span className="text-[10px] text-stone-500">Drag or Click +</span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chairs, POS, espresso, lights..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-stone-950 border border-stone-800 rounded-md text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-stone-950 font-semibold'
                  : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Scrollable Procedural Catalog Cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredItems.map((item: CatalogItemDef) => {
          const pMat = getMaterial(item.defaultPrimaryMaterialId);
          const sMat = getMaterial(item.defaultSecondaryMaterialId);
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/forma-catalog-id',
                  item.id
                );
              }}
              className="group p-2.5 rounded-lg bg-stone-950/75 border border-stone-800/90 hover:border-amber-500/50 transition flex flex-col gap-1.5 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-stone-100 group-hover:text-amber-300 transition flex items-center gap-1.5">
                    <span>{item.name}</span>
                    {item.isLight && (
                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[9px] font-mono">
                        LIGHT
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 line-clamp-2 mt-0.5 leading-snug">
                    {item.description}
                  </p>
                </div>
                <button
                  onClick={() => onAddCatalogItemCenter(item.id)}
                  title="Place item in center of plan"
                  className="p-1.5 rounded-md bg-stone-800 hover:bg-amber-500 text-stone-200 hover:text-stone-950 transition shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-stone-800/70 text-[10px] font-mono text-stone-400">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-stone-600"
                    style={{ backgroundColor: pMat.color }}
                    title={pMat.name}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-stone-600"
                    style={{ backgroundColor: sMat.color }}
                    title={sMat.name}
                  />
                  <span>
                    {item.defaultWidth.toFixed(2)}×{item.defaultDepth.toFixed(2)}×
                    {item.defaultHeight.toFixed(2)}m
                  </span>
                </div>
                <span className="text-amber-400 font-semibold">
                  ${item.defaultUnitCost.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Scene Performance Telemetry Footer */}
      <div className="p-2.5 border-t border-stone-800 bg-stone-950/90 text-[10px] font-mono text-stone-400 space-y-1">
        <div className="flex justify-between">
          <span>
            WALLS: {variant.walls.length}/{DOMAIN_CONSTRAINTS.MAX_WALLS}
          </span>
          <span>
            VERTICES: {variant.vertices.length}/{DOMAIN_CONSTRAINTS.MAX_VERTICES}
          </span>
        </div>
        <div className="flex justify-between">
          <span>
            FF&amp;E: {variant.furniture.length}/{DOMAIN_CONSTRAINTS.MAX_FURNITURE}
          </span>
          <span>
            LIGHTS: {lightCount}/{DOMAIN_CONSTRAINTS.MAX_LIGHTS}
          </span>
        </div>
      </div>
    </aside>
  );
};

