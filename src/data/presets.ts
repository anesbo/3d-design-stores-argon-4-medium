import { CatalogItemDef, FurnitureInstance, ProjectFile } from '../types/domain';
import { getCatalogItem } from './catalog';

function makeFurniture(
  id: string,
  catalogId: string,
  x: number,
  y: number,
  rotation = 0,
  overrides: Partial<FurnitureInstance> = {}
): FurnitureInstance {
  const cat: CatalogItemDef = getCatalogItem(catalogId);
  return {
    id,
    catalogId: cat.id,
    shape: cat.shape,
    name: overrides.name ?? cat.name,
    category: cat.category,
    x,
    y,
    elevation: overrides.elevation ?? cat.defaultElevation,
    width: overrides.width ?? cat.defaultWidth,
    depth: overrides.depth ?? cat.defaultDepth,
    height: overrides.height ?? cat.defaultHeight,
    rotation,
    flippedX: overrides.flippedX ?? false,
    flippedY: overrides.flippedY ?? false,
    primaryMaterialId:
      overrides.primaryMaterialId ?? cat.defaultPrimaryMaterialId,
    secondaryMaterialId:
      overrides.secondaryMaterialId ?? cat.defaultSecondaryMaterialId,
    unitCost: overrides.unitCost ?? cat.defaultUnitCost,
    isLight: cat.isLight,
    lightColor: overrides.lightColor ?? cat.defaultLightColor,
    lightIntensity: overrides.lightIntensity ?? cat.defaultLightIntensity,
    lightRange: overrides.lightRange ?? cat.defaultLightRange,
  };
}

export function createSundayCafePreset(): ProjectFile {
  // 10m x 8m = 80.00 m² total footprint (-5..+5 in X, -4..+4 in Y)
  // Plus a 2.5m x 2.4m = 6.00 m² enclosed restroom partition in the top-right corner (x: 2.5..5, y: 1.6..4)
  const vertices = [
    { id: 'v1', x: -5.0, y: -4.0 },
    { id: 'v2', x: 5.0, y: -4.0 },
    { id: 'v3', x: 5.0, y: 1.6 },
    { id: 'v4', x: 5.0, y: 4.0 },
    { id: 'v5', x: 2.5, y: 4.0 },
    { id: 'v6', x: -5.0, y: 4.0 },
    { id: 'v7', x: 2.5, y: 1.6 },
  ];

  const walls = [
    {
      id: 'w-south',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.22,
      height: 3.2,
      materialId: 'wall-drywall-alabaster',
      label: 'South Storefront Facade',
    },
    {
      id: 'w-east-main',
      startVertexId: 'v2',
      endVertexId: 'v3',
      thickness: 0.22,
      height: 3.2,
      materialId: 'wall-brick-loft',
      label: 'East Feature Brick Wall',
    },
    {
      id: 'w-east-rest',
      startVertexId: 'v3',
      endVertexId: 'v4',
      thickness: 0.22,
      height: 3.2,
      materialId: 'wall-drywall-alabaster',
      label: 'East Restroom Exterior',
    },
    {
      id: 'w-north-rest',
      startVertexId: 'v4',
      endVertexId: 'v5',
      thickness: 0.22,
      height: 3.2,
      materialId: 'wall-drywall-alabaster',
      label: 'North Restroom Wall',
    },
    {
      id: 'w-north-main',
      startVertexId: 'v5',
      endVertexId: 'v6',
      thickness: 0.22,
      height: 3.2,
      materialId: 'wall-fluted-oak',
      label: 'North Backbar Wall',
    },
    {
      id: 'w-west',
      startVertexId: 'v6',
      endVertexId: 'v1',
      thickness: 0.22,
      height: 3.2,
      materialId: 'wall-drywall-sage',
      label: 'West Banquette Wall',
    },
    // Interior Restroom Partitions
    {
      id: 'w-rest-west',
      startVertexId: 'v5',
      endVertexId: 'v7',
      thickness: 0.14,
      height: 3.2,
      materialId: 'wall-drywall-alabaster',
      label: 'Restroom West Partition',
    },
    {
      id: 'w-rest-south',
      startVertexId: 'v7',
      endVertexId: 'v3',
      thickness: 0.14,
      height: 3.2,
      materialId: 'wall-drywall-alabaster',
      label: 'Restroom Entry Partition',
    },
  ];

  const openings = [
    {
      id: 'op-entry-door',
      wallId: 'w-south',
      type: 'double-door' as const,
      offset: 5.0,
      width: 1.6,
      height: 2.3,
      sillHeight: 0,
      swingAngle: 75,
      swingDirection: 'left' as const,
      flipInOut: false,
      frameMaterialId: 'metal-matte-black',
      unitCost: 1850,
    },
    {
      id: 'op-window-west',
      wallId: 'w-south',
      type: 'storefront-window' as const,
      offset: 2.1,
      width: 2.8,
      height: 2.2,
      sillHeight: 0.35,
      swingAngle: 0,
      swingDirection: 'left' as const,
      flipInOut: false,
      frameMaterialId: 'metal-matte-black',
      unitCost: 1600,
    },
    {
      id: 'op-window-east',
      wallId: 'w-south',
      type: 'storefront-window' as const,
      offset: 7.9,
      width: 2.8,
      height: 2.2,
      sillHeight: 0.35,
      swingAngle: 0,
      swingDirection: 'left' as const,
      flipInOut: false,
      frameMaterialId: 'metal-matte-black',
      unitCost: 1600,
    },
    {
      id: 'op-restroom-door',
      wallId: 'w-rest-south',
      type: 'door' as const,
      offset: 1.25,
      width: 0.85,
      height: 2.15,
      sillHeight: 0,
      swingAngle: 65,
      swingDirection: 'right' as const,
      flipInOut: true,
      frameMaterialId: 'wood-natural-ash',
      unitCost: 780,
    },
  ];

  const restroomRoomKey = ['v3', 'v4', 'v5', 'v7'].sort().join(':');
  const mainCafeRoomKey = ['v1', 'v2', 'v3', 'v7', 'v5', 'v6'].sort().join(':');

  const furnitureOptionA: FurnitureInstance[] = [
    // Espresso & POS Service Zone (North-East / North)
    makeFurniture('f-espresso', 'cat-espresso-bar-station', -2.7, 2.2, 0),
    makeFurniture('f-pos', 'cat-pos-service-counter', -0.2, 2.2, 0),
    makeFurniture('f-pastry', 'cat-pastry-display-case', 1.65, 2.2, 0),
    makeFurniture('f-back-shelf-1', 'cat-modular-wall-shelving', -2.8, 3.68, 0),
    makeFurniture('f-back-shelf-2', 'cat-modular-wall-shelving', -0.9, 3.68, 0),

    // Bar stools along espresso counter
    makeFurniture('f-stool-1', 'cat-bar-stool', -3.3, 1.35, 180),
    makeFurniture('f-stool-2', 'cat-bar-stool', -2.7, 1.35, 180),
    makeFurniture('f-stool-3', 'cat-bar-stool', -2.1, 1.35, 180),

    // West Wall Banquette Seating + Bistro Tables + Chairs
    makeFurniture('f-banq-1', 'cat-banquette-bench', -4.52, -0.3, 90, {
      width: 2.2,
    }),
    makeFurniture('f-banq-2', 'cat-banquette-bench', -4.52, -2.5, 90, {
      width: 2.0,
    }),
    makeFurniture('f-bistro-1', 'cat-bistro-table-round', -3.55, 0.25, 0),
    makeFurniture('f-bistro-2', 'cat-bistro-table-round', -3.55, -0.85, 0),
    makeFurniture('f-bistro-3', 'cat-bistro-table-round', -3.55, -2.0, 0),
    makeFurniture('f-bistro-4', 'cat-bistro-table-round', -3.55, -3.0, 0),
    makeFurniture('f-chair-w1', 'cat-dining-chair', -2.85, 0.25, -90),
    makeFurniture('f-chair-w2', 'cat-dining-chair', -2.85, -0.85, -90),
    makeFurniture('f-chair-w3', 'cat-dining-chair', -2.85, -2.0, -90),
    makeFurniture('f-chair-w4', 'cat-dining-chair', -2.85, -3.0, -90),

    // Central & East Dining Zone
    makeFurniture('f-rect-table-1', 'cat-dining-table-rect', 0.4, -0.8, 0),
    makeFurniture('f-chair-c1', 'cat-dining-chair', -0.05, -0.1, 180),
    makeFurniture('f-chair-c2', 'cat-dining-chair', 0.85, -0.1, 180),
    makeFurniture('f-chair-c3', 'cat-dining-chair', -0.05, -1.5, 0),
    makeFurniture('f-chair-c4', 'cat-dining-chair', 0.85, -1.5, 0),

    // East Window Lounge & Bistro
    makeFurniture('f-armchair-1', 'cat-armchair', 3.4, -2.6, -135),
    makeFurniture('f-armchair-2', 'cat-armchair', 2.2, -2.6, 135),
    makeFurniture('f-bistro-lounge', 'cat-bistro-table-round', 2.8, -2.9, 0, {
      width: 0.65,
      depth: 0.65,
      height: 0.52,
    }),
    makeFurniture('f-bistro-e1', 'cat-bistro-table-round', 3.6, -0.3, 0),
    makeFurniture('f-chair-e1', 'cat-dining-chair', 3.6, 0.42, 180),
    makeFurniture('f-chair-e2', 'cat-dining-chair', 3.6, -1.02, 0),

    // Architecture & Decor (Partition, Plants, Pendant Lamps)
    makeFurniture('f-glass-div', 'cat-glass-partition', 1.65, 0.85, 0, {
      width: 1.5,
    }),
    makeFurniture('f-plant-1', 'cat-potted-plant', -4.3, 3.3, 0),
    makeFurniture('f-plant-2', 'cat-potted-plant', 4.3, -3.3, 25),
    makeFurniture('f-plant-3', 'cat-potted-plant', 2.1, 1.05, 0),

    // Lighting
    makeFurniture('f-pendant-1', 'cat-pendant-light', -2.7, 2.2, 0),
    makeFurniture('f-pendant-2', 'cat-pendant-light', -0.2, 2.2, 0),
    makeFurniture('f-pendant-3', 'cat-pendant-light', -3.55, -0.3, 0),
    makeFurniture('f-pendant-4', 'cat-pendant-light', -3.55, -2.5, 0),
    makeFurniture('f-pendant-5', 'cat-pendant-light', 0.4, -0.8, 0),
    makeFurniture('f-spot-1', 'cat-ceiling-spot-track', 2.9, -1.5, 90),
  ];

  const furnitureOptionB: FurnitureInstance[] = [
    // Service bar preserved on North wall
    makeFurniture('fb-espresso', 'cat-espresso-bar-station', -2.7, 2.2, 0),
    makeFurniture('fb-pos', 'cat-pos-service-counter', -0.2, 2.2, 0),
    makeFurniture('fb-pastry', 'cat-pastry-display-case', 1.65, 2.2, 0),
    makeFurniture('fb-shelf-1', 'cat-modular-wall-shelving', -2.8, 3.68, 0),

    // Grand Communal Roastery Tables + High-Top Co-working Bar
    makeFurniture('fb-communal-1', 'cat-dining-table-rect', -2.2, -1.2, 90, {
      width: 2.4,
      depth: 0.95,
    }),
    makeFurniture('fb-c-chair-1', 'cat-dining-chair', -2.95, -0.5, 90),
    makeFurniture('fb-c-chair-2', 'cat-dining-chair', -2.95, -1.2, 90),
    makeFurniture('fb-c-chair-3', 'cat-dining-chair', -2.95, -1.9, 90),
    makeFurniture('fb-c-chair-4', 'cat-dining-chair', -1.45, -0.5, -90),
    makeFurniture('fb-c-chair-5', 'cat-dining-chair', -1.45, -1.2, -90),
    makeFurniture('fb-c-chair-6', 'cat-dining-chair', -1.45, -1.9, -90),

    makeFurniture('fb-hightop', 'cat-high-top-bar-table', 1.2, -0.5, 0, {
      width: 2.0,
    }),
    makeFurniture('fb-stool-1', 'cat-bar-stool', 0.6, 0.05, 180),
    makeFurniture('fb-stool-2', 'cat-bar-stool', 1.2, 0.05, 180),
    makeFurniture('fb-stool-3', 'cat-bar-stool', 1.8, 0.05, 180),
    makeFurniture('fb-stool-4', 'cat-bar-stool', 0.6, -1.05, 0),
    makeFurniture('fb-stool-5', 'cat-bar-stool', 1.2, -1.05, 0),
    makeFurniture('fb-stool-6', 'cat-bar-stool', 1.8, -1.05, 0),

    makeFurniture('fb-lounge-1', 'cat-armchair', 3.5, -2.4, -145),
    makeFurniture('fb-lounge-2', 'cat-armchair', 2.2, -2.4, 145),
    makeFurniture('fb-plant-1', 'cat-potted-plant', -4.3, -3.2, 0),
    makeFurniture('fb-plant-2', 'cat-potted-plant', 4.3, -3.2, 0),
    makeFurniture('fb-pendant-1', 'cat-pendant-light', -2.2, -1.2, 0),
    makeFurniture('fb-pendant-2', 'cat-pendant-light', 1.2, -0.5, 0),
    makeFurniture('fb-pendant-3', 'cat-pendant-light', -1.4, 2.2, 0),
  ];

  const roomOverrides = {
    [mainCafeRoomKey]: {
      roomKey: mainCafeRoomKey,
      name: 'Main Cafe & Espresso Hall',
      floorMaterialId: 'floor-oak-plank',
    },
    [restroomRoomKey]: {
      roomKey: restroomRoomKey,
      name: 'Guest Restroom Suite',
      floorMaterialId: 'floor-tile-hex',
    },
  };

  return {
    schemaVersion: '1.0.0',
    id: 'proj-sunday-cafe',
    name: 'The Sunday Cafe',
    presetId: 'sunday-cafe',
    createdAt: '2025-01-15T09:00:00.000Z',
    updatedAt: '2025-01-15T09:00:00.000Z',
    activeVariantId: 'var-cafe-a',
    variants: [
      {
        id: 'var-cafe-a',
        name: 'Option A — Bistro & Banquette',
        description:
          '80 m² hospitality layout featuring West banquette booths, espresso bar, pastry vitrine, and enclosed restroom.',
        vertices: structuredClone(vertices),
        walls: structuredClone(walls),
        openings: structuredClone(openings),
        furniture: furnitureOptionA,
        defaultFloorMaterialId: 'floor-oak-plank',
        roomOverrides: structuredClone(roomOverrides),
        ambientLightIntensity: 0.75,
        sunAzimuth: 145,
        sunElevation: 48,
      },
      {
        id: 'var-cafe-b',
        name: 'Option B — Communal Roastery',
        description:
          'Social co-working and tasting room concept with central communal table and standing high-top bar.',
        vertices: structuredClone(vertices),
        walls: structuredClone(walls),
        openings: structuredClone(openings),
        furniture: furnitureOptionB,
        defaultFloorMaterialId: 'floor-terrazzo-venetian',
        roomOverrides: {
          ...structuredClone(roomOverrides),
          [mainCafeRoomKey]: {
            roomKey: mainCafeRoomKey,
            name: 'Roastery Communal Hall',
            floorMaterialId: 'floor-terrazzo-venetian',
          },
        },
        ambientLightIntensity: 0.8,
        sunAzimuth: 130,
        sunElevation: 52,
      },
    ],
  };
}

export function createBoutiquePreset(): ProjectFile {
  // Exact 69.00 m² L-shaped retail floorplan:
  // Bottom wing: 9m x 6m = 54 m² (x: -4.5..4.5, y: -4.5..1.5)
  // Top-left wing: 5m x 3m = 15 m² (x: -4.5..0.5, y: 1.5..4.5)
  // Total = 69.00 m²
  const vertices = [
    { id: 'bv1', x: -4.5, y: -4.5 },
    { id: 'bv2', x: 4.5, y: -4.5 },
    { id: 'bv3', x: 4.5, y: 1.5 },
    { id: 'bv4', x: 0.5, y: 1.5 },
    { id: 'bv5', x: 0.5, y: 4.5 },
    { id: 'bv6', x: -4.5, y: 4.5 },
  ];

  const walls = [
    {
      id: 'bw-south',
      startVertexId: 'bv1',
      endVertexId: 'bv2',
      thickness: 0.22,
      height: 3.4,
      materialId: 'wall-drywall-alabaster',
      label: 'Avenue Glazed Facade',
    },
    {
      id: 'bw-east',
      startVertexId: 'bv2',
      endVertexId: 'bv3',
      thickness: 0.22,
      height: 3.4,
      materialId: 'wall-fluted-oak',
      label: 'East Apparel Gallery Wall',
    },
    {
      id: 'bw-inner-south',
      startVertexId: 'bv3',
      endVertexId: 'bv4',
      thickness: 0.22,
      height: 3.4,
      materialId: 'wall-drywall-alabaster',
      label: 'Cashwrap Feature Wall',
    },
    {
      id: 'bw-inner-east',
      startVertexId: 'bv4',
      endVertexId: 'bv5',
      thickness: 0.22,
      height: 3.4,
      materialId: 'wall-drywall-sage',
      label: 'Fitting Lounge East Wall',
    },
    {
      id: 'bw-north',
      startVertexId: 'bv5',
      endVertexId: 'bv6',
      thickness: 0.22,
      height: 3.4,
      materialId: 'wall-drywall-alabaster',
      label: 'North Atelier Wall',
    },
    {
      id: 'bw-west',
      startVertexId: 'bv6',
      endVertexId: 'bv1',
      thickness: 0.22,
      height: 3.4,
      materialId: 'wall-drywall-alabaster',
      label: 'West Perimeter Wall',
    },
  ];

  const openings = [
    {
      id: 'bop-entry',
      wallId: 'bw-south',
      type: 'double-door' as const,
      offset: 4.5,
      width: 1.8,
      height: 2.4,
      sillHeight: 0,
      swingAngle: 80,
      swingDirection: 'left' as const,
      flipInOut: false,
      frameMaterialId: 'metal-brushed-brass',
      unitCost: 2200,
    },
    {
      id: 'bop-win-left',
      wallId: 'bw-south',
      type: 'storefront-window' as const,
      offset: 1.8,
      width: 2.6,
      height: 2.4,
      sillHeight: 0.25,
      swingAngle: 0,
      swingDirection: 'left' as const,
      flipInOut: false,
      frameMaterialId: 'metal-brushed-brass',
      unitCost: 1950,
    },
    {
      id: 'bop-win-right',
      wallId: 'bw-south',
      type: 'storefront-window' as const,
      offset: 7.2,
      width: 2.6,
      height: 2.4,
      sillHeight: 0.25,
      swingAngle: 0,
      swingDirection: 'left' as const,
      flipInOut: false,
      frameMaterialId: 'metal-brushed-brass',
      unitCost: 1950,
    },
  ];

  const roomKey = ['bv1', 'bv2', 'bv3', 'bv4', 'bv5', 'bv6'].sort().join(':');

  const furnitureA: FurnitureInstance[] = [
    // Central Display Islands
    makeFurniture('bf-island-1', 'cat-retail-display-island', -1.2, -1.8, 0),
    makeFurniture('bf-island-2', 'cat-retail-display-island', 1.8, -1.8, 0),

    // Boutique Clothing Display Racks
    makeFurniture('bf-rack-1', 'cat-clothing-display-rack', -3.7, -2.5, 90),
    makeFurniture('bf-rack-2', 'cat-clothing-display-rack', -3.7, -0.5, 90),
    makeFurniture('bf-rack-3', 'cat-clothing-display-rack', 3.7, -2.5, -90),
    makeFurniture('bf-rack-4', 'cat-clothing-display-rack', 3.7, -0.5, -90),

    // Checkout POS Counter near inner corner
    makeFurniture('bf-pos', 'cat-pos-service-counter', 2.4, 0.55, 0),

    // North-West VIP Fitting & Lounge Alcove
    makeFurniture('bf-shelf-1', 'cat-modular-wall-shelving', -2.8, 4.1, 0),
    makeFurniture('bf-shelf-2', 'cat-modular-wall-shelving', -0.9, 4.1, 0),
    makeFurniture('bf-armchair-1', 'cat-armchair', -3.2, 2.5, 45),
    makeFurniture('bf-armchair-2', 'cat-armchair', -1.6, 2.5, -45),
    makeFurniture('bf-table-vip', 'cat-bistro-table-round', -2.4, 2.3, 0, {
      width: 0.7,
      depth: 0.7,
      height: 0.48,
    }),
    makeFurniture('bf-partition', 'cat-glass-partition', -0.8, 1.5, 0, {
      width: 1.8,
    }),
    makeFurniture('bf-plant-1', 'cat-potted-plant', -3.9, 3.8, 0),
    makeFurniture('bf-plant-2', 'cat-potted-plant', 3.8, -3.7, 0),

    // Gallery Lighting
    makeFurniture('bf-spot-1', 'cat-ceiling-spot-track', -1.2, -1.8, 0),
    makeFurniture('bf-spot-2', 'cat-ceiling-spot-track', 1.8, -1.8, 0),
    makeFurniture('bf-pendant-1', 'cat-pendant-light', 2.4, 0.55, 0),
    makeFurniture('bf-pendant-2', 'cat-pendant-light', -2.4, 2.3, 0),
  ];

  const furnitureB: FurnitureInstance[] = [
    makeFurniture('bfb-island-1', 'cat-retail-display-island', 0.0, -1.5, 90, {
      width: 2.2,
      depth: 1.1,
    }),
    makeFurniture('bfb-pos', 'cat-pos-service-counter', -2.0, 3.3, 0),
    makeFurniture('bfb-rack-1', 'cat-clothing-display-rack', 2.4, 0.7, 0),
    makeFurniture('bfb-rack-2', 'cat-clothing-display-rack', 3.7, -1.6, -90),
    makeFurniture('bfb-kiosk', 'cat-interactive-kiosk', -2.6, -2.8, 30),
    makeFurniture('bfb-plant-1', 'cat-potted-plant', 3.8, 0.8, 0),
    makeFurniture('bfb-spot-1', 'cat-ceiling-spot-track', 0.0, -1.5, 0),
  ];

  return {
    schemaVersion: '1.0.0',
    id: 'proj-l-boutique',
    name: 'L-Shaped Boutique',
    presetId: 'l-boutique',
    createdAt: '2025-01-15T09:00:00.000Z',
    updatedAt: '2025-01-15T09:00:00.000Z',
    activeVariantId: 'var-boutique-a',
    variants: [
      {
        id: 'var-boutique-a',
        name: 'Option A — Flagship Merchandising',
        description:
          '69 m² luxury fashion boutique with twin marble display islands, brass garment rails, and VIP fitting lounge.',
        vertices: structuredClone(vertices),
        walls: structuredClone(walls),
        openings: structuredClone(openings),
        furniture: furnitureA,
        defaultFloorMaterialId: 'floor-terrazzo-venetian',
        roomOverrides: {
          [roomKey]: {
            roomKey,
            name: 'Flagship Retail Floor',
            floorMaterialId: 'floor-terrazzo-venetian',
          },
        },
        ambientLightIntensity: 0.85,
        sunAzimuth: 160,
        sunElevation: 55,
      },
      {
        id: 'var-boutique-b',
        name: 'Option B — Minimalist Gallery Pop-Up',
        description:
          'Sculptural central runway podium with interactive lookbook kiosk and rear atelier cashwrap.',
        vertices: structuredClone(vertices),
        walls: structuredClone(walls),
        openings: structuredClone(openings),
        furniture: furnitureB,
        defaultFloorMaterialId: 'floor-concrete-polished',
        roomOverrides: {
          [roomKey]: {
            roomKey,
            name: 'Gallery Showroom Floor',
            floorMaterialId: 'floor-concrete-polished',
          },
        },
        ambientLightIntensity: 0.8,
        sunAzimuth: 140,
        sunElevation: 50,
      },
    ],
  };
}

export function createExhibitionBoothPreset(): ProjectFile {
  // 8.0m x 6.0m = 48.00 m² Trade Show Exhibition Booth (-4..+4 in X, -3..+3 in Y)
  const vertices = [
    { id: 'ev1', x: -4.0, y: -3.0 },
    { id: 'ev2', x: 4.0, y: -3.0 },
    { id: 'ev3', x: 4.0, y: 3.0 },
    { id: 'ev4', x: -4.0, y: 3.0 },
  ];

  const walls = [
    {
      id: 'ew-north',
      startVertexId: 'ev4',
      endVertexId: 'ev3',
      thickness: 0.20,
      height: 3.0,
      materialId: 'wall-drywall-charcoal',
      label: 'North Brand Demo Backdrop',
    },
    {
      id: 'ew-west',
      startVertexId: 'ev1',
      endVertexId: 'ev4',
      thickness: 0.20,
      height: 3.0,
      materialId: 'wall-fluted-oak',
      label: 'West Acoustic Wing Wall',
    },
    {
      id: 'ew-east',
      startVertexId: 'ev2',
      endVertexId: 'ev3',
      thickness: 0.16,
      height: 3.0,
      materialId: 'wall-drywall-charcoal',
      label: 'East Exhibition Wing',
    },
    {
      id: 'ew-south',
      startVertexId: 'ev1',
      endVertexId: 'ev2',
      thickness: 0.12,
      height: 3.0,
      materialId: 'wall-drywall-alabaster',
      label: 'South Open Concourse Threshold',
    },
  ];

  const openings = [
    {
      id: 'eop-concourse',
      wallId: 'ew-south',
      type: 'sliding-door' as const,
      offset: 4.0,
      width: 5.2,
      height: 2.7,
      sillHeight: 0,
      swingAngle: 90,
      swingDirection: 'left' as const,
      flipInOut: false,
      frameMaterialId: 'metal-matte-black',
      unitCost: 2400,
    },
  ];

  const roomKey = ['ev1', 'ev2', 'ev3', 'ev4'].sort().join(':');

  const furnitureA: FurnitureInstance[] = [
    // Interactive Demo Kiosks near front concourse
    makeFurniture('ef-kiosk-1', 'cat-interactive-kiosk', -2.4, -1.6, 20),
    makeFurniture('ef-kiosk-2', 'cat-interactive-kiosk', 0.0, -1.8, 0),
    makeFurniture('ef-kiosk-3', 'cat-interactive-kiosk', 2.4, -1.6, -20),

    // Demo Wall Shelving & Reception Counter
    makeFurniture('ef-pos', 'cat-pos-service-counter', 1.8, 1.9, 0, {
      name: 'Brand Welcome Desk',
    }),
    makeFurniture('ef-shelf-1', 'cat-modular-wall-shelving', -2.2, 2.65, 0),
    makeFurniture('ef-shelf-2', 'cat-modular-wall-shelving', -0.4, 2.65, 0),

    // VIP Client Lounge & Meeting Zone
    makeFurniture('ef-arm-1', 'cat-armchair', -2.8, 0.8, 60),
    makeFurniture('ef-arm-2', 'cat-armchair', -2.8, -0.4, 120),
    makeFurniture('ef-bistro', 'cat-bistro-table-round', -2.0, 0.2, 0),
    makeFurniture('ef-hightop', 'cat-high-top-bar-table', 2.2, 0.1, 90, {
      width: 1.5,
    }),
    makeFurniture('ef-stool-1', 'cat-bar-stool', 1.65, -0.3, 90),
    makeFurniture('ef-stool-2', 'cat-bar-stool', 1.65, 0.5, 90),
    makeFurniture('ef-stool-3', 'cat-bar-stool', 2.75, -0.3, -90),
    makeFurniture('ef-stool-4', 'cat-bar-stool', 2.75, 0.5, -90),

    // Architectural Columns, Partition & Plants
    makeFurniture('ef-col-1', 'cat-column-pillar', -3.4, -2.4, 0),
    makeFurniture('ef-col-2', 'cat-column-pillar', 3.4, -2.4, 0),
    makeFurniture('ef-part', 'cat-glass-partition', -1.2, 1.2, 0, {
      width: 1.6,
    }),
    makeFurniture('ef-plant-1', 'cat-potted-plant', 3.3, 2.2, 0),

    // Exhibition Track Lighting
    makeFurniture('ef-spot-1', 'cat-ceiling-spot-track', -1.5, 1.4, 0),
    makeFurniture('ef-spot-2', 'cat-ceiling-spot-track', 1.8, 1.4, 0),
    makeFurniture('ef-spot-3', 'cat-ceiling-spot-track', 0.0, -1.2, 0),
  ];

  const furnitureB: FurnitureInstance[] = [
    makeFurniture('efb-kiosk-1', 'cat-interactive-kiosk', -2.6, -1.5, 25),
    makeFurniture('efb-kiosk-2', 'cat-interactive-kiosk', 2.6, -1.5, -25),
    makeFurniture('efb-table', 'cat-dining-table-rect', 0.0, 0.4, 0, {
      width: 2.2,
      depth: 1.0,
      name: 'Executive Boardroom Demo Table',
    }),
    makeFurniture('efb-c1', 'cat-dining-chair', -0.6, 1.15, 180),
    makeFurniture('efb-c2', 'cat-dining-chair', 0.6, 1.15, 180),
    makeFurniture('efb-c3', 'cat-dining-chair', -0.6, -0.35, 0),
    makeFurniture('efb-c4', 'cat-dining-chair', 0.6, -0.35, 0),
    makeFurniture('efb-spot-1', 'cat-ceiling-spot-track', 0.0, 0.4, 0),
  ];

  return {
    schemaVersion: '1.0.0',
    id: 'proj-exhibition-booth',
    name: 'Exhibition Booth',
    presetId: 'exhibition-booth',
    createdAt: '2025-01-15T09:00:00.000Z',
    updatedAt: '2025-01-15T09:00:00.000Z',
    activeVariantId: 'var-booth-a',
    variants: [
      {
        id: 'var-booth-a',
        name: 'Option A — Interactive Tech Pavilion',
        description:
          '48 m² open-concept tradeshow pavilion with 3 interactive product kiosks, lounge meeting zone, and demo wall.',
        vertices: structuredClone(vertices),
        walls: structuredClone(walls),
        openings: structuredClone(openings),
        furniture: furnitureA,
        defaultFloorMaterialId: 'floor-walnut-herringbone',
        roomOverrides: {
          [roomKey]: {
            roomKey,
            name: 'Exhibition Pavilion Floor',
            floorMaterialId: 'floor-walnut-herringbone',
          },
        },
        ambientLightIntensity: 0.78,
        sunAzimuth: 125,
        sunElevation: 45,
      },
      {
        id: 'var-booth-b',
        name: 'Option B — Executive Briefing Suite',
        description:
          'Focused enterprise briefing layout centered around a 2.2m live demonstration table.',
        vertices: structuredClone(vertices),
        walls: structuredClone(walls),
        openings: structuredClone(openings),
        furniture: furnitureB,
        defaultFloorMaterialId: 'floor-concrete-polished',
        roomOverrides: {
          [roomKey]: {
            roomKey,
            name: 'Briefing Pavilion',
            floorMaterialId: 'floor-concrete-polished',
          },
        },
        ambientLightIntensity: 0.82,
        sunAzimuth: 145,
        sunElevation: 50,
      },
    ],
  };
}

export function createBlankPreset(): ProjectFile {
  return {
    schemaVersion: '1.0.0',
    id: 'proj-blank-canvas',
    name: 'Blank Project',
    presetId: 'blank',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeVariantId: 'var-blank-a',
    variants: [
      {
        id: 'var-blank-a',
        name: 'Option A — Base Scheme',
        description: 'Empty 50m × 50m architectural grid ready for custom commercial space planning.',
        vertices: [],
        walls: [],
        openings: [],
        furniture: [],
        defaultFloorMaterialId: 'floor-concrete-polished',
        roomOverrides: {},
        ambientLightIntensity: 0.8,
        sunAzimuth: 140,
        sunElevation: 50,
      },
    ],
  };
}

export const PRESET_LIST = [
  {
    id: 'sunday-cafe',
    name: 'The Sunday Cafe',
    areaLabel: '80 m²',
    subtitle: 'Hospitality / Specialty Coffee & Bakery',
    create: createSundayCafePreset,
  },
  {
    id: 'l-boutique',
    name: 'L-Shaped Boutique',
    areaLabel: '69 m²',
    subtitle: 'Luxury Fashion & Apparel Retail',
    create: createBoutiquePreset,
  },
  {
    id: 'exhibition-booth',
    name: 'Exhibition Booth',
    areaLabel: '48 m²',
    subtitle: 'Open-Concept Tradeshow Pavilion',
    create: createExhibitionBoothPreset,
  },
  {
    id: 'blank',
    name: 'Blank Project',
    areaLabel: '0 m²',
    subtitle: 'Empty Grid (-50m to +50m)',
    create: createBlankPreset,
  },
] as const;

