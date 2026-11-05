import {
  DesignVariant,
  DetectedRoom,
  DOMAIN_CONSTRAINTS,
  ProjectFile,
} from '../types/domain';
import { BOMSummary } from './bom';
import {
  clamp,
  clampWorldCoord,
  computeWallGeometry,
  roundM,
  validateAndClampOpening,
} from './geometry';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 1. JSON Export & Schema-Validated Import with Boundary & Tolerance Integrity Checks
 */
export function exportProjectJSON(project: ProjectFile): void {
  const payload: ProjectFile = {
    ...project,
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  downloadBlob(blob, `${safeName || 'forma-project'}.forma.json`);
}

export function validateAndSanitizeProjectJSON(raw: unknown): {
  valid: boolean;
  project?: ProjectFile;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Invalid JSON root object.'], warnings };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== '1.0.0') {
    warnings.push(
      `Schema version "${String(obj.schemaVersion)}" normalized to "1.0.0".`
    );
  }

  if (!Array.isArray(obj.variants) || obj.variants.length === 0) {
    return {
      valid: false,
      errors: ['Project file must contain at least one design variant.'],
      warnings,
    };
  }

  const sanitizedVariants: DesignVariant[] = [];

  for (let i = 0; i < obj.variants.length; i++) {
    const vRaw = obj.variants[i] as Record<string, unknown>;
    if (!vRaw || typeof vRaw !== 'object') continue;

    const rawVertices = Array.isArray(vRaw.vertices) ? vRaw.vertices : [];
    if (rawVertices.length > DOMAIN_CONSTRAINTS.MAX_VERTICES) {
      warnings.push(
        `Variant ${i + 1}: Vertices capped at ${DOMAIN_CONSTRAINTS.MAX_VERTICES}.`
      );
    }

    const vertices = rawVertices
      .slice(0, DOMAIN_CONSTRAINTS.MAX_VERTICES)
      .map((vt: Record<string, unknown>, idx: number) => ({
        id: typeof vt.id === 'string' && vt.id ? vt.id : `v-${idx}`,
        x: clampWorldCoord(Number(vt.x) || 0),
        y: clampWorldCoord(Number(vt.y) || 0),
      }));

    const vertexMap = new Map(vertices.map((vt) => [vt.id, vt]));

    const rawWalls = Array.isArray(vRaw.walls) ? vRaw.walls : [];
    const walls = rawWalls
      .slice(0, DOMAIN_CONSTRAINTS.MAX_WALLS)
      .filter((w: Record<string, unknown>) => {
        const s = vertexMap.get(String(w.startVertexId));
        const e = vertexMap.get(String(w.endVertexId));
        if (!s || !e) return false;
        const len = Math.hypot(e.x - s.x, e.y - s.y);
        return len >= DOMAIN_CONSTRAINTS.WALL_MIN_LENGTH;
      })
      .map((w: Record<string, unknown>, idx: number) => ({
        id: typeof w.id === 'string' && w.id ? w.id : `w-${idx}`,
        startVertexId: String(w.startVertexId),
        endVertexId: String(w.endVertexId),
        thickness: roundM(
          clamp(
            Number(w.thickness) || 0.2,
            DOMAIN_CONSTRAINTS.WALL_MIN_THICKNESS,
            DOMAIN_CONSTRAINTS.WALL_MAX_THICKNESS
          )
        ),
        height: roundM(
          clamp(
            Number(w.height) || 3.0,
            DOMAIN_CONSTRAINTS.WALL_MIN_HEIGHT,
            DOMAIN_CONSTRAINTS.WALL_MAX_HEIGHT
          )
        ),
        materialId:
          typeof w.materialId === 'string'
            ? w.materialId
            : 'wall-drywall-alabaster',
        label: typeof w.label === 'string' ? w.label : undefined,
      }));

    const wallMap = new Map(walls.map((w) => [w.id, w]));

    const rawOpenings = Array.isArray(vRaw.openings) ? vRaw.openings : [];
    const openings = rawOpenings
      .filter((o: Record<string, unknown>) => wallMap.has(String(o.wallId)))
      .map((o: Record<string, unknown>, idx: number) => {
        const wall = wallMap.get(String(o.wallId))!;
        const wg = computeWallGeometry(wall, vertexMap);
        const wallLen = wg ? wg.length : 1.0;
        const baseOp = {
          id: typeof o.id === 'string' && o.id ? o.id : `op-${idx}`,
          wallId: wall.id,
          type: (['door', 'double-door', 'sliding-door', 'window', 'storefront-window'].includes(
            String(o.type)
          )
            ? o.type
            : 'door') as DesignVariant['openings'][number]['type'],
          offset: Number(o.offset) || wallLen / 2,
          width: Number(o.width) || 0.9,
          height: Number(o.height) || 2.1,
          sillHeight: Number(o.sillHeight) || 0,
          swingAngle: Number(o.swingAngle) ?? 75,
          swingDirection: (o.swingDirection === 'right' ? 'right' : 'left') as
            | 'left'
            | 'right',
          flipInOut: Boolean(o.flipInOut),
          frameMaterialId:
            typeof o.frameMaterialId === 'string'
              ? o.frameMaterialId
              : 'metal-matte-black',
          unitCost: Math.max(0, Number(o.unitCost) || 850),
        };
        return validateAndClampOpening(baseOp, wall, wallLen, []);
      });

    const rawFurniture = Array.isArray(vRaw.furniture) ? vRaw.furniture : [];
    let lightCount = 0;
    const furniture = rawFurniture
      .slice(0, DOMAIN_CONSTRAINTS.MAX_FURNITURE)
      .filter((f: Record<string, unknown>) => {
        if (f.isLight) {
          if (lightCount >= DOMAIN_CONSTRAINTS.MAX_LIGHTS) return false;
          lightCount++;
        }
        return true;
      })
      .map((f: Record<string, unknown>, idx: number) => ({
        id: typeof f.id === 'string' && f.id ? f.id : `f-${idx}`,
        catalogId: String(f.catalogId || 'cat-dining-chair'),
        shape: (f.shape || 'dining-chair') as DesignVariant['furniture'][number]['shape'],
        name: String(f.name || 'Commercial Item'),
        category: (f.category || 'seating') as DesignVariant['furniture'][number]['category'],
        x: clampWorldCoord(Number(f.x) || 0),
        y: clampWorldCoord(Number(f.y) || 0),
        elevation: roundM(clamp(Number(f.elevation) || 0, 0, 5.8)),
        width: roundM(
          clamp(
            Number(f.width) || 0.6,
            DOMAIN_CONSTRAINTS.FURNITURE_MIN_SPAN,
            DOMAIN_CONSTRAINTS.FURNITURE_MAX_SPAN
          )
        ),
        depth: roundM(
          clamp(
            Number(f.depth) || 0.6,
            DOMAIN_CONSTRAINTS.FURNITURE_MIN_SPAN,
            DOMAIN_CONSTRAINTS.FURNITURE_MAX_SPAN
          )
        ),
        height: roundM(
          clamp(
            Number(f.height) || 0.75,
            DOMAIN_CONSTRAINTS.FURNITURE_MIN_HEIGHT,
            DOMAIN_CONSTRAINTS.FURNITURE_MAX_HEIGHT
          )
        ),
        rotation: ((Number(f.rotation) || 0) % 360 + 360) % 360,
        flippedX: Boolean(f.flippedX),
        flippedY: Boolean(f.flippedY),
        primaryMaterialId: String(
          f.primaryMaterialId || 'wood-natural-ash'
        ),
        secondaryMaterialId: String(
          f.secondaryMaterialId || 'metal-matte-black'
        ),
        unitCost: Math.max(0, Number(f.unitCost) || 250),
        isLight: Boolean(f.isLight),
        lightColor: typeof f.lightColor === 'string' ? f.lightColor : '#ffdfa8',
        lightIntensity: Number(f.lightIntensity) || 2.0,
        lightRange: Number(f.lightRange) || 7.0,
        locked: Boolean(f.locked),
      }));

    sanitizedVariants.push({
      id: typeof vRaw.id === 'string' && vRaw.id ? vRaw.id : `var-${i + 1}`,
      name:
        typeof vRaw.name === 'string' && vRaw.name
          ? vRaw.name
          : `Option ${String.fromCharCode(65 + i)}`,
      description:
        typeof vRaw.description === 'string' ? vRaw.description : '',
      vertices,
      walls,
      openings,
      furniture,
      defaultFloorMaterialId:
        typeof vRaw.defaultFloorMaterialId === 'string'
          ? vRaw.defaultFloorMaterialId
          : 'floor-oak-plank',
      roomOverrides:
        vRaw.roomOverrides && typeof vRaw.roomOverrides === 'object'
          ? (vRaw.roomOverrides as DesignVariant['roomOverrides'])
          : {},
      ambientLightIntensity: clamp(
        Number(vRaw.ambientLightIntensity) || 0.75,
        0.1,
        2.5
      ),
      sunAzimuth: clamp(Number(vRaw.sunAzimuth) || 140, 0, 360),
      sunElevation: clamp(Number(vRaw.sunElevation) || 48, 5, 90),
    });
  }

  if (sanitizedVariants.length === 0) {
    return {
      valid: false,
      errors: ['No valid design variants found in imported file.'],
      warnings,
    };
  }

  const activeId =
    typeof obj.activeVariantId === 'string' &&
    sanitizedVariants.some((v) => v.id === obj.activeVariantId)
      ? obj.activeVariantId
      : sanitizedVariants[0].id;

  const project: ProjectFile = {
    schemaVersion: '1.0.0',
    id: typeof obj.id === 'string' ? obj.id : `proj-${Date.now()}`,
    name: typeof obj.name === 'string' ? obj.name : 'Imported Forma Project',
    presetId: typeof obj.presetId === 'string' ? obj.presetId : 'custom',
    createdAt:
      typeof obj.createdAt === 'string'
        ? obj.createdAt
        : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeVariantId: activeId,
    variants: sanitizedVariants,
  };

  return { valid: true, project, errors, warnings };
}

/**
 * 2. Architectural SVG Export (1:10 Scale Vector Floorplan)
 * Features wall footprints, wall centerlines, dimension lines with ticks, door swing arcs,
 * furniture shapes, room area labels, and architectural title block.
 */
export function exportArchitecturalSVG(
  project: ProjectFile,
  variant: DesignVariant,
  rooms: DetectedRoom[],
  bom: BOMSummary
): void {
  const vertexMap = new Map(variant.vertices.map((v) => [v.id, v]));

  // Determine bounding box in meters
  let minX = -6;
  let maxX = 6;
  let minY = -5;
  let maxY = 5;

  if (variant.vertices.length > 0) {
    minX = Math.min(...variant.vertices.map((v) => v.x)) - 2.0;
    maxX = Math.max(...variant.vertices.map((v) => v.x)) + 2.0;
    minY = Math.min(...variant.vertices.map((v) => v.y)) - 2.0;
    maxY = Math.max(...variant.vertices.map((v) => v.y)) + 2.5;
  }

  // 1:10 Scale: 1 meter in design = 100mm on sheet (100 user units per meter)
  const SCALE = 100;
  const widthM = maxX - minX;
  const heightM = maxY - minY;
  const svgW = Math.round(widthM * SCALE);
  const svgH = Math.round(heightM * SCALE);

  const tx = (x: number) => roundM((x - minX) * SCALE, 2);
  const ty = (y: number) => roundM((y - minY) * SCALE, 2);

  const roomPolys = rooms
    .map((r) => {
      const pts = r.points.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ');
      const cx = tx(r.centroid.x);
      const cy = ty(r.centroid.y);
      return `
      <g class="room-zone">
        <polygon points="${pts}" fill="#f5f3ef" stroke="#d6d3cd" stroke-width="1" />
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="#1c1917">${escapeXml(
        r.name.toUpperCase()
      )}</text>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#57534e">AREA: ${r.areaSqm.toFixed(
        2
      )} m² | PERIM: ${r.perimeterM.toFixed(2)} m</text>
      </g>`;
    })
    .join('\n');

  const furnitureEls = variant.furniture
    .map((f) => {
      const cx = tx(f.x);
      const cy = ty(f.y);
      const w = roundM(f.width * SCALE, 2);
      const d = roundM(f.depth * SCALE, 2);
      const isRound =
        f.shape === 'bistro-table-round' ||
        f.shape === 'bar-stool' ||
        f.shape === 'potted-plant' ||
        f.shape === 'pendant-light';
      return `
      <g transform="translate(${cx}, ${cy}) rotate(${f.rotation})">
        ${
          isRound
            ? `<ellipse cx="0" cy="0" rx="${w / 2}" ry="${
                d / 2
              }" fill="#ffffff" fill-opacity="0.88" stroke="#44403c" stroke-width="1.4" ${
                f.isLight ? 'stroke-dasharray="4 3"' : ''
              } />`
            : `<rect x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" rx="3" fill="#ffffff" fill-opacity="0.88" stroke="#44403c" stroke-width="1.4" />`
        }
        <text x="0" y="3" text-anchor="middle" font-family="Inter, sans-serif" font-size="8" fill="#292524">${escapeXml(
          f.name.slice(0, 18)
        )}</text>
      </g>`;
    })
    .join('\n');

  const wallAndDimEls = variant.walls
    .map((w) => {
      const wg = computeWallGeometry(w, vertexMap);
      if (!wg) return '';
      const pts = wg.corners.map((c) => `${tx(c.x)},${ty(c.y)}`).join(' ');
      const x1 = tx(wg.start.x);
      const y1 = ty(wg.start.y);
      const x2 = tx(wg.end.x);
      const y2 = ty(wg.end.y);

      // Offset dimension line 0.45m outward along wall normal
      const dimOffset = 0.48;
      const dx1 = tx(wg.start.x + wg.normX * dimOffset);
      const dy1 = ty(wg.start.y + wg.normY * dimOffset);
      const dx2 = tx(wg.end.x + wg.normX * dimOffset);
      const dy2 = ty(wg.end.y + wg.normY * dimOffset);
      const dmx = (dx1 + dx2) / 2;
      const dmy = (dy1 + dy2) / 2;

      return `
      <g class="wall-assembly">
        <polygon points="${pts}" fill="#292524" stroke="#0c0a09" stroke-width="1.5" />
        <!-- Wall Centerline -->
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f59e0b" stroke-width="0.9" stroke-dasharray="6 4" />
        <!-- Architectural Dimension Line -->
        <line x1="${x1}" y1="${y1}" x2="${dx1}" y2="${dy1}" stroke="#78716c" stroke-width="0.6" stroke-dasharray="2 2" />
        <line x1="${x2}" y1="${y2}" x2="${dx2}" y2="${dy2}" stroke="#78716c" stroke-width="0.6" stroke-dasharray="2 2" />
        <line x1="${dx1}" y1="${dy1}" x2="${dx2}" y2="${dy2}" stroke="#44403c" stroke-width="1" />
        <circle cx="${dx1}" cy="${dy1}" r="2.2" fill="#1c1917" />
        <circle cx="${dx2}" cy="${dy2}" r="2.2" fill="#1c1917" />
        <rect x="${dmx - 26}" y="${dmy - 8}" width="52" height="15" rx="2" fill="#fafaf9" stroke="#a8a29e" stroke-width="0.7" />
        <text x="${dmx}" y="${dmy + 3}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="600" fill="#1c1917">${wg.length.toFixed(
        2
      )}m</text>
      </g>`;
    })
    .join('\n');

  const openingEls = variant.openings
    .map((op) => {
      const wall = variant.walls.find((w) => w.id === op.wallId);
      if (!wall) return '';
      const wg = computeWallGeometry(wall, vertexMap);
      if (!wg) return '';

      const cx = tx(wg.start.x + wg.dirX * op.offset);
      const cy = ty(wg.start.y + wg.dirY * op.offset);
      const wPx = roundM(op.width * SCALE, 2);
      const tPx = roundM(wall.thickness * SCALE, 2);
      const isDoor = op.type === 'door' || op.type === 'double-door';

      let swingMarkup = '';
      if (isDoor && op.swingAngle > 0) {
        const radius = op.type === 'double-door' ? wPx / 2 : wPx;
        const rad = (op.swingAngle * Math.PI) / 180;
        const sign = op.flipInOut ? -1 : 1;
        const hingeX = op.swingDirection === 'left' ? -wPx / 2 : wPx / 2;
        const dirSign = op.swingDirection === 'left' ? 1 : -1;
        const tipX = hingeX + dirSign * radius * Math.cos(rad);
        const tipY = sign * radius * Math.sin(rad);
        const arcEndX = hingeX + dirSign * radius;
        swingMarkup = `
          <line x1="${hingeX}" y1="0" x2="${tipX}" y2="${tipY}" stroke="#b45309" stroke-width="2" />
          <path d="M ${arcEndX} 0 A ${radius} ${radius} 0 0 ${
          sign * dirSign > 0 ? 1 : 0
        } ${tipX} ${tipY}" fill="none" stroke="#d97706" stroke-width="1.1" stroke-dasharray="4 3" />
        `;
      }

      return `
      <g transform="translate(${cx}, ${cy}) rotate(${wg.angleDeg})">
        <rect x="${-wPx / 2}" y="${
        -tPx / 2 - 1
      }" width="${wPx}" height="${tPx + 2}" fill="#fafaf9" stroke="#44403c" stroke-width="1" />
        ${
          op.type.includes('window')
            ? `<line x1="${-wPx / 2}" y1="-2" x2="${wPx / 2}" y2="-2" stroke="#0284c7" stroke-width="1.5" />
               <line x1="${-wPx / 2}" y1="2" x2="${wPx / 2}" y2="2" stroke="#0284c7" stroke-width="1.5" />`
            : swingMarkup
        }
      </g>`;
    })
    .join('\n');

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}mm" height="${svgH}mm">
  <defs>
    <pattern id="grid1m" width="${SCALE}" height="${SCALE}" patternUnits="userSpaceOnUse">
      <path d="M ${SCALE} 0 L 0 0 0 ${SCALE}" fill="none" stroke="#e7e5e4" stroke-width="0.9"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="#fafaf9" />
  <rect width="100%" height="100%" fill="url(#grid1m)" />

  <!-- Room Polygons & Area Labels -->
  ${roomPolys}

  <!-- Furniture & Fixtures -->
  ${furnitureEls}

  <!-- Walls, Centerlines & Dimensions -->
  ${wallAndDimEls}

  <!-- Doors & Windows -->
  ${openingEls}

  <!-- Architectural Scale Title Block (1:10 Scale) -->
  <g transform="translate(24, ${svgH - 84})">
    <rect x="0" y="0" width="440" height="62" rx="4" fill="#1c1917" />
    <text x="16" y="24" font-family="Inter, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#fafaf9">FORMA ARCHITECTURAL PLAN — ${escapeXml(
      project.name.toUpperCase()
    )}</text>
    <text x="16" y="44" font-family="JetBrains Mono, monospace" font-size="10" fill="#d6d3d1">VARIANT: ${escapeXml(
      variant.name
    )} | SCALE: 1:10 | AREA: ${bom.totalFloorAreaSqm.toFixed(
    2
  )} m² | EST: $${bom.grandTotalCost.toLocaleString()}</text>
  </g>
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  downloadBlob(blob, `${safeName}-1-10-plan.svg`);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 3. CSV Schedule Export (Formatted Bill of Materials)
 */
export function exportBOMScheduleCSV(
  project: ProjectFile,
  variant: DesignVariant,
  bom: BOMSummary
): void {
  const headers = [
    'Item Name',
    'Category',
    'Dimensions',
    'Material Finish',
    'Quantity',
    'Unit',
    'Unit Rate (USD)',
    'Total Cost (USD)',
  ];

  const escapeCsv = (val: string | number) => {
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = bom.lineItems.map((item) =>
    [
      item.itemName,
      item.category,
      item.dimensions,
      item.materialName,
      item.quantity,
      item.unit,
      item.unitRate.toFixed(2),
      item.totalCost.toFixed(2),
    ]
      .map(escapeCsv)
      .join(',')
  );

  rows.push('');
  rows.push(
    [
      `PROJECT SUMMARY: ${project.name} (${variant.name})`,
      'TOTALS',
      `Floor: ${bom.totalFloorAreaSqm.toFixed(2)} m² | Net Wall: ${bom.totalNetWallAreaSqm.toFixed(2)} m²`,
      '',
      bom.totalFurnitureCount + bom.totalLightsCount + bom.totalOpeningsCount,
      'items',
      `${bom.costPerSqm.toFixed(2)} /m²`,
      bom.grandTotalCost.toFixed(2),
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  downloadBlob(blob, `${safeName}-bom-schedule.csv`);
}

