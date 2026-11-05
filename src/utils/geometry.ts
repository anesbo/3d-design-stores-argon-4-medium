import {
  DesignVariant,
  DetectedRoom,
  DOMAIN_CONSTRAINTS,
  FurnitureInstance,
  Vertex,
  Wall,
  WallOpening,
} from '../types/domain';
import { getMaterial } from '../data/materials';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function roundM(val: number, decimals = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function clampWorldCoord(v: number): number {
  return roundM(
    clamp(v, DOMAIN_CONSTRAINTS.WORLD_MIN, DOMAIN_CONSTRAINTS.WORLD_MAX),
    3
  );
}

export function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export interface WallGeometry {
  wall: Wall;
  start: Vertex;
  end: Vertex;
  length: number;
  angleRad: number;
  angleDeg: number;
  dirX: number;
  dirY: number;
  normX: number;
  normY: number;
  midX: number;
  midY: number;
  corners: { x: number; y: number }[];
}

export function computeWallGeometry(
  wall: Wall,
  vertexMap: Map<string, Vertex>
): WallGeometry | null {
  const start = vertexMap.get(wall.startVertexId);
  const end = vertexMap.get(wall.endVertexId);
  if (!start || !end) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-5) return null;

  const dirX = dx / length;
  const dirY = dy / length;
  const normX = -dirY;
  const normY = dirX;
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;
  const halfT = wall.thickness / 2;

  const corners = [
    { x: start.x + normX * halfT, y: start.y + normY * halfT },
    { x: end.x + normX * halfT, y: end.y + normY * halfT },
    { x: end.x - normX * halfT, y: end.y - normY * halfT },
    { x: start.x - normX * halfT, y: start.y - normY * halfT },
  ];

  return {
    wall,
    start,
    end,
    length,
    angleRad,
    angleDeg,
    dirX,
    dirY,
    normX,
    normY,
    midX: (start.x + end.x) / 2,
    midY: (start.y + end.y) / 2,
    corners,
  };
}

/**
 * Project a 2D point onto a wall segment and return the distance along wall from start,
 * perpendicular distance, and closest point.
 */
export function projectPointOnWall(
  pt: { x: number; y: number },
  wg: WallGeometry
): {
  offsetAlongWall: number;
  perpDistance: number;
  closestPoint: { x: number; y: number };
} {
  const vx = pt.x - wg.start.x;
  const vy = pt.y - wg.start.y;
  const rawOffset = vx * wg.dirX + vy * wg.dirY;
  const offsetAlongWall = clamp(rawOffset, 0, wg.length);
  const closestPoint = {
    x: wg.start.x + wg.dirX * offsetAlongWall,
    y: wg.start.y + wg.dirY * offsetAlongWall,
  };
  const perpDistance = dist2D(pt, closestPoint);
  return { offsetAlongWall, perpDistance, closestPoint };
}

/**
 * Validates and clamps an opening's width, height, sillHeight, and offset along its host wall
 * so it respects the 0.05m safety margin from wall endpoints and adjacent openings.
 */
export function validateAndClampOpening(
  opening: WallOpening,
  wall: Wall,
  wallLength: number,
  otherOpeningsOnWall: WallOpening[]
): WallOpening {
  const margin = DOMAIN_CONSTRAINTS.OPENING_SAFETY_MARGIN;
  const maxAllowedWidth = Math.max(
    DOMAIN_CONSTRAINTS.OPENING_MIN_WIDTH,
    wallLength - margin * 2
  );
  const width = roundM(
    clamp(opening.width, DOMAIN_CONSTRAINTS.OPENING_MIN_WIDTH, maxAllowedWidth)
  );

  const isDoor =
    opening.type === 'door' ||
    opening.type === 'double-door' ||
    opening.type === 'sliding-door';
  const sillHeight = isDoor
    ? 0
    : roundM(clamp(opening.sillHeight, 0.1, Math.max(0.1, wall.height - 0.35)));

  const maxAllowedHeight = Math.max(
    DOMAIN_CONSTRAINTS.OPENING_MIN_HEIGHT,
    wall.height - sillHeight - margin
  );
  const height = roundM(
    clamp(
      opening.height,
      DOMAIN_CONSTRAINTS.OPENING_MIN_HEIGHT,
      maxAllowedHeight
    )
  );

  const halfW = width / 2;
  const minOffset = margin + halfW;
  const maxOffset = Math.max(minOffset, wallLength - margin - halfW);

  let offset = roundM(clamp(opening.offset, minOffset, maxOffset));

  // Push away from adjacent openings on the same wall if overlapping within safety margin
  const sortedOthers = [...otherOpeningsOnWall]
    .filter((o) => o.id !== opening.id)
    .sort((a, b) => a.offset - b.offset);

  for (const other of sortedOthers) {
    const minCenterDist = width / 2 + other.width / 2 + margin;
    const diff = offset - other.offset;
    if (Math.abs(diff) < minCenterDist) {
      const pushRight = other.offset + minCenterDist;
      const pushLeft = other.offset - minCenterDist;
      if (diff >= 0 && pushRight <= maxOffset) {
        offset = roundM(pushRight);
      } else if (pushLeft >= minOffset) {
        offset = roundM(pushLeft);
      } else if (pushRight <= maxOffset) {
        offset = roundM(pushRight);
      }
    }
  }

  offset = roundM(clamp(offset, minOffset, maxOffset));
  const swingAngle = Math.round(
    clamp(
      opening.swingAngle,
      DOMAIN_CONSTRAINTS.DOOR_SWING_MIN,
      DOMAIN_CONSTRAINTS.DOOR_SWING_MAX
    )
  );

  return {
    ...opening,
    width,
    height,
    sillHeight,
    offset,
    swingAngle,
  };
}

export interface SnapGuide {
  type: 'axis-x' | 'axis-y' | 'vertex';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
}

export interface SnapResult {
  x: number;
  y: number;
  snappedVertexId?: string;
  guides: SnapGuide[];
}

/**
 * Snaps a raw 2D world coordinate to existing vertices, vertex guide lines, and grid increments.
 */
export function snapWorldPoint(
  rawPt: { x: number; y: number },
  vertices: Vertex[],
  options: {
    snapToGrid: boolean;
    gridStep: number;
    snapToVertices: boolean;
    snapToAxes: boolean;
    excludeVertexIds?: string[];
    anchorPoint?: { x: number; y: number };
    vertexSnapRadius?: number;
    axisSnapTolerance?: number;
  }
): SnapResult {
  const exclude = new Set(options.excludeVertexIds || []);
  const vertexRadius = options.vertexSnapRadius ?? 0.25;
  const axisTol = options.axisSnapTolerance ?? 0.14;
  const guides: SnapGuide[] = [];

  let x = clampWorldCoord(rawPt.x);
  let y = clampWorldCoord(rawPt.y);

  // 1. Direct vertex snap
  if (options.snapToVertices) {
    let bestV: Vertex | undefined;
    let bestD = vertexRadius;
    for (const v of vertices) {
      if (exclude.has(v.id)) continue;
      const d = Math.hypot(v.x - x, v.y - y);
      if (d < bestD) {
        bestD = d;
        bestV = v;
      }
    }
    if (bestV) {
      guides.push({
        type: 'vertex',
        x1: bestV.x,
        y1: bestV.y,
        x2: bestV.x,
        y2: bestV.y,
        label: 'Vertex',
      });
      return {
        x: bestV.x,
        y: bestV.y,
        snappedVertexId: bestV.id,
        guides,
      };
    }
  }

  // 2. Grid snap first as baseline
  if (options.snapToGrid && options.gridStep > 0) {
    x = roundM(Math.round(x / options.gridStep) * options.gridStep);
    y = roundM(Math.round(y / options.gridStep) * options.gridStep);
  }

  // 3. Axis alignment with anchor point or other vertices
  if (options.snapToAxes) {
    const candidates = vertices.filter((v) => !exclude.has(v.id));
    if (options.anchorPoint) {
      candidates.unshift({
        id: '__anchor__',
        x: options.anchorPoint.x,
        y: options.anchorPoint.y,
      });
    }

    let snappedX = false;
    let snappedY = false;

    for (const c of candidates) {
      if (!snappedX && Math.abs(rawPt.x - c.x) < axisTol) {
        x = c.x;
        snappedX = true;
        guides.push({
          type: 'axis-x',
          x1: c.x,
          y1: c.y,
          x2: c.x,
          y2: y,
        });
      }
      if (!snappedY && Math.abs(rawPt.y - c.y) < axisTol) {
        y = c.y;
        snappedY = true;
        guides.push({
          type: 'axis-y',
          x1: c.x,
          y1: c.y,
          x2: x,
          y2: c.y,
        });
      }
    }
  }

  return {
    x: clampWorldCoord(x),
    y: clampWorldCoord(y),
    guides,
  };
}

/**
 * Signed polygon area via Shoelace formula (positive for CCW, negative for CW in standard cartesian).
 */
export function computeSignedPolygonArea(
  pts: { x: number; y: number }[]
): number {
  let sum = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return sum / 2;
}

export function computePolygonCentroid(pts: { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  let cx = 0;
  let cy = 0;
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const a = p0.x * p1.y - p1.x * p0.y;
    signedArea += a;
    cx += (p0.x + p1.x) * a;
    cy += (p0.y + p1.y) * a;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-5) {
    const avgX = pts.reduce((s, p) => s + p.x, 0) / n;
    const avgY = pts.reduce((s, p) => s + p.y, 0) / n;
    return { x: roundM(avgX, 2), y: roundM(avgY, 2) };
  }
  return {
    x: roundM(cx / (6 * signedArea), 2),
    y: roundM(cy / (6 * signedArea), 2),
  };
}

/**
 * Automatically detects minimal enclosed room polygons from the planar graph of vertices and walls.
 * Uses half-edge planar face traversal (next clockwise edge at each vertex) to extract interior faces.
 */
export function detectClosedRooms(variant: DesignVariant): DetectedRoom[] {
  const vertexMap = new Map<string, Vertex>();
  for (const v of variant.vertices) {
    vertexMap.set(v.id, v);
  }

  // Build adjacency list of undirected edges, ignoring degree-1 dead-end spurs iteratively
  const adj = new Map<string, Set<string>>();
  for (const w of variant.walls) {
    if (w.startVertexId === w.endVertexId) continue;
    if (!vertexMap.has(w.startVertexId) || !vertexMap.has(w.endVertexId))
      continue;
    if (!adj.has(w.startVertexId)) adj.set(w.startVertexId, new Set());
    if (!adj.has(w.endVertexId)) adj.set(w.endVertexId, new Set());
    adj.get(w.startVertexId)!.add(w.endVertexId);
    adj.get(w.endVertexId)!.add(w.startVertexId);
  }

  // Prune degree-1 vertices (open partitions/spurs) so they don't break face cycles
  let pruned = true;
  while (pruned) {
    pruned = false;
    for (const [vid, neighbors] of adj.entries()) {
      if (neighbors.size <= 1) {
        for (const nb of neighbors) {
          adj.get(nb)?.delete(vid);
        }
        adj.delete(vid);
        pruned = true;
      }
    }
  }

  // Sort outgoing neighbors around each vertex by angle
  const sortedNeighbors = new Map<string, string[]>();
  for (const [vid, neighbors] of adj.entries()) {
    const v = vertexMap.get(vid)!;
    const list = Array.from(neighbors).sort((aId, bId) => {
      const va = vertexMap.get(aId)!;
      const vb = vertexMap.get(bId)!;
      const angA = Math.atan2(va.y - v.y, va.x - v.x);
      const angB = Math.atan2(vb.y - v.y, vb.x - v.x);
      return angA - angB;
    });
    sortedNeighbors.set(vid, list);
  }

  const visitedHalfEdges = new Set<string>();
  const rawFaces: {
    vertexIds: string[];
    points: { x: number; y: number }[];
    signedArea: number;
  }[] = [];

  for (const [u, neighbors] of sortedNeighbors.entries()) {
    for (const v of neighbors) {
      const heKey = `${u}->${v}`;
      if (visitedHalfEdges.has(heKey)) continue;

      const cycle: string[] = [];
      let currU = u;
      let currV = v;
      let safety = 0;

      while (!visitedHalfEdges.has(`${currU}->${currV}`) && safety < 500) {
        visitedHalfEdges.add(`${currU}->${currV}`);
        cycle.push(currU);
        safety++;

        const nbrs = sortedNeighbors.get(currV);
        if (!nbrs || nbrs.length === 0) break;

        // Find incoming direction currV -> currU in sorted neighbor list of currV
        const idx = nbrs.indexOf(currU);
        if (idx === -1) break;
        // Pick the previous neighbor in CCW order (clockwise turn) to trace minimal interior face
        const nextIdx = (idx - 1 + nbrs.length) % nbrs.length;
        const nextW = nbrs[nextIdx];
        currU = currV;
        currV = nextW;
      }

      if (cycle.length >= 3 && currU === u && currV === v) {
        const points = cycle.map((id) => {
          const vt = vertexMap.get(id)!;
          return { x: vt.x, y: vt.y };
        });
        const signedArea = computeSignedPolygonArea(points);
        // Only keep interior faces (positive signed area in our traversal, excluding outer unbounded face)
        if (signedArea > 0.25) {
          rawFaces.push({ vertexIds: cycle, points, signedArea });
        }
      }
    }
  }

  // Deduplicate canonical vertex cycles
  const seenKeys = new Set<string>();
  const rooms: DetectedRoom[] = [];

  rawFaces
    .sort((a, b) => b.signedArea - a.signedArea)
    .forEach((face, idx) => {
      const canonicalKey = [...face.vertexIds].sort().join(':');
      if (seenKeys.has(canonicalKey)) return;
      seenKeys.add(canonicalKey);

      let perimeter = 0;
      for (let i = 0; i < face.points.length; i++) {
        const p1 = face.points[i];
        const p2 = face.points[(i + 1) % face.points.length];
        perimeter += dist2D(p1, p2);
      }

      const override = variant.roomOverrides[canonicalKey];
      const floorMatId =
        override?.floorMaterialId || variant.defaultFloorMaterialId;
      const mat = getMaterial(floorMatId);
      const defaultName =
        idx === 0 && rawFaces.length === 1
          ? 'Main Commercial Space'
          : idx === 0
          ? 'Primary Zone'
          : `Zone ${idx + 1}`;

      rooms.push({
        key: canonicalKey,
        name: override?.name || defaultName,
        vertexIds: face.vertexIds,
        points: face.points,
        areaSqm: roundM(Math.abs(face.signedArea), 2),
        perimeterM: roundM(perimeter, 2),
        centroid: computePolygonCentroid(face.points),
        floorMaterialId: floorMatId,
        costPerSqm: mat.costPerSqm,
      });
    });

  return rooms;
}

/**
 * Resolves 2D circle vs wall segment & furniture collisions for First-Person Walkthrough mode.
 * Allows passing through door openings whose swingAngle >= 45 degrees or sliding doors!
 */
export function resolveWalkthroughCollision(
  desiredPos: { x: number; y: number },
  variant: DesignVariant,
  radius = DOMAIN_CONSTRAINTS.WALKTHROUGH_COLLISION_RADIUS
): { x: number; y: number } {
  let px = clamp(
    desiredPos.x,
    DOMAIN_CONSTRAINTS.WORLD_MIN + 0.5,
    DOMAIN_CONSTRAINTS.WORLD_MAX - 0.5
  );
  let py = clamp(
    desiredPos.y,
    DOMAIN_CONSTRAINTS.WORLD_MIN + 0.5,
    DOMAIN_CONSTRAINTS.WORLD_MAX - 0.5
  );

  const vertexMap = new Map(variant.vertices.map((v) => [v.id, v]));

  // Check walls
  for (const wall of variant.walls) {
    const wg = computeWallGeometry(wall, vertexMap);
    if (!wg) continue;

    const proj = projectPointOnWall({ x: px, y: py }, wg);
    const minSep = wall.thickness / 2 + radius;

    if (proj.perpDistance < minSep) {
      // Check if player is inside a passable door opening on this wall
      const openingsOnWall = variant.openings.filter(
        (o) => o.wallId === wall.id
      );
      let inPassableDoor = false;
      for (const op of openingsOnWall) {
        const isDoor =
          op.type === 'door' ||
          op.type === 'double-door' ||
          op.type === 'sliding-door';
        const isPassable =
          isDoor && (op.type === 'sliding-door' || op.swingAngle >= 40);
        if (isPassable) {
          const halfEffective = Math.max(0.1, op.width / 2 - radius * 0.6);
          if (Math.abs(proj.offsetAlongWall - op.offset) <= halfEffective) {
            inPassableDoor = true;
            break;
          }
        }
      }

      if (!inPassableDoor) {
        const dx = px - proj.closestPoint.x;
        const dy = py - proj.closestPoint.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-4) {
          const push = minSep - d;
          px += (dx / d) * push;
          py += (dy / d) * push;
        } else {
          px += wg.normX * minSep;
          py += wg.normY * minSep;
        }
      }
    }
  }

  // Check floor-standing furniture items (elevation < 1.4m)
  for (const item of variant.furniture) {
    if (item.elevation >= 1.4) continue;
    // Transform player position into furniture local space
    const dx = px - item.x;
    const dy = py - item.y;
    const rad = (-item.rotation * Math.PI) / 180;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);

    const hw = item.width / 2;
    const hd = item.depth / 2;
    const cx = clamp(lx, -hw, hw);
    const cy = clamp(ly, -hd, hd);
    const distLocal = Math.hypot(lx - cx, ly - cy);

    if (distLocal < radius && distLocal > 1e-5) {
      const push = radius - distLocal;
      const nx = (lx - cx) / distLocal;
      const ny = (ly - cy) / distLocal;
      // Rotate normal back to world space
      const posRad = (item.rotation * Math.PI) / 180;
      const wnx = nx * Math.cos(posRad) - ny * Math.sin(posRad);
      const wny = nx * Math.sin(posRad) + ny * Math.cos(posRad);
      px += wnx * push;
      py += wny * push;
    }
  }

  return { x: px, y: py };
}

