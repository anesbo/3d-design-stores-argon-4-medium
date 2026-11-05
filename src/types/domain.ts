export type MaterialCategory =
  | 'floor'
  | 'wall'
  | 'wood'
  | 'metal'
  | 'fabric'
  | 'stone'
  | 'glass';

export type MaterialPattern =
  | 'concrete'
  | 'hardwood'
  | 'herringbone'
  | 'terrazzo'
  | 'checker-tile'
  | 'hex-tile'
  | 'drywall'
  | 'brick'
  | 'fluted-wood'
  | 'brushed-brass'
  | 'matte-black'
  | 'stainless'
  | 'boucle'
  | 'leather'
  | 'marble'
  | 'glass-clear'
  | 'glass-frosted';

export interface MaterialDef {
  id: string;
  name: string;
  category: MaterialCategory;
  color: string;
  secondaryColor?: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  pattern: MaterialPattern;
  costPerSqm: number;
}

export interface Vertex {
  id: string;
  x: number; // -50m to +50m
  y: number; // -50m to +50m
}

export interface Wall {
  id: string;
  startVertexId: string;
  endVertexId: string;
  thickness: number; // 0.06m to 0.80m
  height: number; // 0.30m to 6.0m
  materialId: string;
  unitCostPerSqm?: number;
  label?: string;
}

export type OpeningType =
  | 'door'
  | 'double-door'
  | 'sliding-door'
  | 'window'
  | 'storefront-window';

export interface WallOpening {
  id: string;
  wallId: string;
  type: OpeningType;
  /** Distance in meters from wall startVertex along the wall axis to the center of the opening */
  offset: number;
  width: number; // >= 0.3m
  height: number; // >= 0.3m
  sillHeight: number; // 0m for doors, >0m for windows
  swingAngle: number; // 0 to 110 degrees
  swingDirection: 'left' | 'right';
  flipInOut: boolean;
  frameMaterialId: string;
  unitCost: number;
}

export type CatalogCategory =
  | 'seating'
  | 'surfaces'
  | 'retail'
  | 'architecture';

export type ProceduralShapeType =
  | 'dining-chair'
  | 'armchair'
  | 'bar-stool'
  | 'banquette-bench'
  | 'bistro-table-round'
  | 'dining-table-rect'
  | 'high-top-bar-table'
  | 'pos-service-counter'
  | 'espresso-bar-station'
  | 'modular-wall-shelving'
  | 'pastry-display-case'
  | 'clothing-display-rack'
  | 'retail-display-island'
  | 'glass-partition'
  | 'column-pillar'
  | 'potted-plant'
  | 'pendant-light'
  | 'ceiling-spot-track'
  | 'interactive-kiosk';

export interface CatalogItemDef {
  id: string;
  shape: ProceduralShapeType;
  name: string;
  category: CatalogCategory;
  description: string;
  defaultWidth: number;
  defaultDepth: number;
  defaultHeight: number;
  defaultElevation: number;
  defaultPrimaryMaterialId: string;
  defaultSecondaryMaterialId: string;
  defaultUnitCost: number;
  isLight?: boolean;
  defaultLightColor?: string;
  defaultLightIntensity?: number;
  defaultLightRange?: number;
}

export interface FurnitureInstance {
  id: string;
  catalogId: string;
  shape: ProceduralShapeType;
  name: string;
  category: CatalogCategory;
  x: number;
  y: number;
  elevation: number;
  width: number; // 0.1m to 10m
  depth: number; // 0.1m to 10m
  height: number; // 0.005m to 6.0m
  rotation: number; // degrees 0..360
  flippedX: boolean;
  flippedY: boolean;
  primaryMaterialId: string;
  secondaryMaterialId: string;
  unitCost: number;
  isLight?: boolean;
  lightColor?: string;
  lightIntensity?: number;
  lightRange?: number;
  locked?: boolean;
}

export interface RoomOverride {
  roomKey: string;
  name: string;
  floorMaterialId: string;
}

export interface DetectedRoom {
  key: string;
  name: string;
  vertexIds: string[];
  points: { x: number; y: number }[];
  areaSqm: number;
  perimeterM: number;
  centroid: { x: number; y: number };
  floorMaterialId: string;
  costPerSqm: number;
}

export interface DesignVariant {
  id: string;
  name: string;
  description: string;
  vertices: Vertex[];
  walls: Wall[];
  openings: WallOpening[];
  furniture: FurnitureInstance[];
  defaultFloorMaterialId: string;
  roomOverrides: Record<string, RoomOverride>;
  ambientLightIntensity: number;
  sunAzimuth: number;
  sunElevation: number;
}

export interface ProjectFile {
  schemaVersion: '1.0.0';
  id: string;
  name: string;
  presetId: string;
  createdAt: string;
  updatedAt: string;
  activeVariantId: string;
  variants: DesignVariant[];
}

export type SelectionTarget =
  | { type: 'wall'; id: string }
  | { type: 'vertex'; id: string }
  | { type: 'opening'; id: string }
  | { type: 'furniture'; id: string }
  | { type: 'room'; id: string }
  | null;

export type ActiveTool =
  | 'select'
  | 'wall'
  | 'door'
  | 'double-door'
  | 'sliding-door'
  | 'window'
  | 'storefront-window'
  | 'measure'
  | 'pan';

export type ViewLayoutMode = 'split' | '2d-only' | '3d-only';
export type Camera3DMode = 'orbit' | 'walkthrough';

export const DOMAIN_CONSTRAINTS = {
  WORLD_MIN: -50,
  WORLD_MAX: 50,
  WALL_MIN_LENGTH: 0.1,
  WALL_MIN_THICKNESS: 0.06,
  WALL_MAX_THICKNESS: 0.80,
  WALL_MIN_HEIGHT: 0.30,
  WALL_MAX_HEIGHT: 6.0,
  OPENING_MIN_WIDTH: 0.3,
  OPENING_MIN_HEIGHT: 0.3,
  OPENING_SAFETY_MARGIN: 0.05,
  DOOR_SWING_MIN: 0,
  DOOR_SWING_MAX: 110,
  FURNITURE_MIN_SPAN: 0.1,
  FURNITURE_MAX_SPAN: 10.0,
  FURNITURE_MIN_HEIGHT: 0.005,
  FURNITURE_MAX_HEIGHT: 6.0,
  MAX_WALLS: 200,
  MAX_VERTICES: 400,
  MAX_FURNITURE: 500,
  MAX_LIGHTS: 40,
  MAX_HISTORY: 80,
  WALKTHROUGH_EYE_HEIGHT: 1.6,
  WALKTHROUGH_COLLISION_RADIUS: 0.32,
} as const;

