import { DesignVariant, DetectedRoom } from '../types/domain';
import { getMaterial } from '../data/materials';
import { computeWallGeometry, roundM } from './geometry';

export interface BOMLineItem {
  id: string;
  itemName: string;
  category: 'Flooring' | 'Wall Finishes' | 'Openings & Glazing' | 'Furniture & Fixtures' | 'Lighting';
  dimensions: string;
  materialName: string;
  quantity: number;
  unit: 'm²' | 'ea';
  unitRate: number;
  totalCost: number;
}

export interface BOMSummary {
  totalFloorAreaSqm: number;
  totalNetWallAreaSqm: number;
  totalOpeningsCount: number;
  totalFurnitureCount: number;
  totalLightsCount: number;
  flooringCost: number;
  wallFinishCost: number;
  openingsCost: number;
  furnitureCost: number;
  lightingCost: number;
  grandTotalCost: number;
  costPerSqm: number;
  lineItems: BOMLineItem[];
}

export function calculateBOM(
  variant: DesignVariant,
  detectedRooms: DetectedRoom[]
): BOMSummary {
  const lineItems: BOMLineItem[] = [];
  const vertexMap = new Map(variant.vertices.map((v) => [v.id, v]));

  // 1. Flooring Area & Costs (by floor material across detected rooms)
  const floorGroupMap = new Map<
    string,
    { materialName: string; areaSqm: number; unitRate: number; roomNames: string[] }
  >();

  let totalFloorAreaSqm = 0;

  for (const room of detectedRooms) {
    const mat = getMaterial(room.floorMaterialId);
    totalFloorAreaSqm += room.areaSqm;
    const existing = floorGroupMap.get(mat.id);
    if (existing) {
      existing.areaSqm = roundM(existing.areaSqm + room.areaSqm, 2);
      existing.roomNames.push(room.name);
    } else {
      floorGroupMap.set(mat.id, {
        materialName: mat.name,
        areaSqm: roundM(room.areaSqm, 2),
        unitRate: mat.costPerSqm,
        roomNames: [room.name],
      });
    }
  }

  let flooringCost = 0;
  for (const [matId, group] of floorGroupMap.entries()) {
    const cost = roundM(group.areaSqm * group.unitRate, 2);
    flooringCost += cost;
    lineItems.push({
      id: `floor-${matId}`,
      itemName: `Flooring — ${group.materialName}`,
      category: 'Flooring',
      dimensions: `${group.areaSqm.toFixed(2)} m² (${group.roomNames.join(', ')})`,
      materialName: group.materialName,
      quantity: group.areaSqm,
      unit: 'm²',
      unitRate: group.unitRate,
      totalCost: cost,
    });
  }

  // 2. Wall Finishes (Net surface area = 2 * length * height minus opening cutouts on that wall)
  const wallGroupMap = new Map<
    string,
    { materialName: string; netAreaSqm: number; unitRate: number; wallCount: number }
  >();
  let totalNetWallAreaSqm = 0;

  for (const wall of variant.walls) {
    const wg = computeWallGeometry(wall, vertexMap);
    if (!wg) continue;
    const grossTwoSidedArea = wg.length * wall.height * 2;
    const wallOpenings = variant.openings.filter((o) => o.wallId === wall.id);
    const cutoutsArea = wallOpenings.reduce(
      (sum, o) => sum + o.width * o.height * 2,
      0
    );
    const netArea = Math.max(0, roundM(grossTwoSidedArea - cutoutsArea, 2));
    totalNetWallAreaSqm += netArea;

    const mat = getMaterial(wall.materialId);
    const unitRate = wall.unitCostPerSqm ?? mat.costPerSqm;
    const key = `${mat.id}:${unitRate}`;
    const existing = wallGroupMap.get(key);
    if (existing) {
      existing.netAreaSqm = roundM(existing.netAreaSqm + netArea, 2);
      existing.wallCount += 1;
    } else {
      wallGroupMap.set(key, {
        materialName: mat.name,
        netAreaSqm: netArea,
        unitRate,
        wallCount: 1,
      });
    }
  }

  let wallFinishCost = 0;
  for (const [key, group] of wallGroupMap.entries()) {
    const cost = roundM(group.netAreaSqm * group.unitRate, 2);
    wallFinishCost += cost;
    lineItems.push({
      id: `wall-${key}`,
      itemName: `Wall Finish — ${group.materialName}`,
      category: 'Wall Finishes',
      dimensions: `${group.netAreaSqm.toFixed(2)} m² (${group.wallCount} walls, 2-sided net)`,
      materialName: group.materialName,
      quantity: group.netAreaSqm,
      unit: 'm²',
      unitRate: group.unitRate,
      totalCost: cost,
    });
  }

  // 3. Openings (Doors & Windows)
  const openingGroupMap = new Map<
    string,
    {
      name: string;
      dimensions: string;
      materialName: string;
      quantity: number;
      unitRate: number;
    }
  >();

  for (const op of variant.openings) {
    const mat = getMaterial(op.frameMaterialId);
    const typeName =
      op.type === 'door'
        ? 'Single Swing Architectural Door'
        : op.type === 'double-door'
        ? 'Double French Commercial Door'
        : op.type === 'sliding-door'
        ? 'Acoustic Pocket/Sliding Door'
        : op.type === 'storefront-window'
        ? 'Storefront Mullion Glazing System'
        : 'Architectural Framed Window';
    const dimStr = `${op.width.toFixed(2)}m × ${op.height.toFixed(2)}m`;
    const key = `${op.type}:${dimStr}:${mat.id}:${op.unitCost}`;
    const existing = openingGroupMap.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      openingGroupMap.set(key, {
        name: typeName,
        dimensions: dimStr,
        materialName: mat.name,
        quantity: 1,
        unitRate: op.unitCost,
      });
    }
  }

  let openingsCost = 0;
  for (const [key, group] of openingGroupMap.entries()) {
    const cost = roundM(group.quantity * group.unitRate, 2);
    openingsCost += cost;
    lineItems.push({
      id: `opening-${key}`,
      itemName: group.name,
      category: 'Openings & Glazing',
      dimensions: group.dimensions,
      materialName: group.materialName,
      quantity: group.quantity,
      unit: 'ea',
      unitRate: group.unitRate,
      totalCost: cost,
    });
  }

  // 4. Furniture & Lighting Schedule
  const furnGroupMap = new Map<
    string,
    {
      name: string;
      category: 'Furniture & Fixtures' | 'Lighting';
      dimensions: string;
      materialName: string;
      quantity: number;
      unitRate: number;
    }
  >();

  let totalFurnitureCount = 0;
  let totalLightsCount = 0;

  for (const item of variant.furniture) {
    if (item.isLight) {
      totalLightsCount += 1;
    } else {
      totalFurnitureCount += 1;
    }
    const pMat = getMaterial(item.primaryMaterialId);
    const sMat = getMaterial(item.secondaryMaterialId);
    const dimStr = `${item.width.toFixed(2)}m × ${item.depth.toFixed(2)}m × ${item.height.toFixed(2)}m`;
    const key = `${item.catalogId}:${item.name}:${dimStr}:${pMat.id}:${sMat.id}:${item.unitCost}`;
    const existing = furnGroupMap.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      furnGroupMap.set(key, {
        name: item.name,
        category: item.isLight ? 'Lighting' : 'Furniture & Fixtures',
        dimensions: dimStr,
        materialName: `${pMat.name} / ${sMat.name}`,
        quantity: 1,
        unitRate: item.unitCost,
      });
    }
  }

  let furnitureCost = 0;
  let lightingCost = 0;
  for (const [key, group] of furnGroupMap.entries()) {
    const cost = roundM(group.quantity * group.unitRate, 2);
    if (group.category === 'Lighting') {
      lightingCost += cost;
    } else {
      furnitureCost += cost;
    }
    lineItems.push({
      id: `furn-${key}`,
      itemName: group.name,
      category: group.category,
      dimensions: group.dimensions,
      materialName: group.materialName,
      quantity: group.quantity,
      unit: 'ea',
      unitRate: group.unitRate,
      totalCost: cost,
    });
  }

  const grandTotalCost = roundM(
    flooringCost + wallFinishCost + openingsCost + furnitureCost + lightingCost,
    2
  );
  const costPerSqm =
    totalFloorAreaSqm > 0 ? roundM(grandTotalCost / totalFloorAreaSqm, 2) : 0;

  return {
    totalFloorAreaSqm: roundM(totalFloorAreaSqm, 2),
    totalNetWallAreaSqm: roundM(totalNetWallAreaSqm, 2),
    totalOpeningsCount: variant.openings.length,
    totalFurnitureCount,
    totalLightsCount,
    flooringCost: roundM(flooringCost, 2),
    wallFinishCost: roundM(wallFinishCost, 2),
    openingsCost: roundM(openingsCost, 2),
    furnitureCost: roundM(furnitureCost, 2),
    lightingCost: roundM(lightingCost, 2),
    grandTotalCost,
    costPerSqm,
    lineItems,
  };
}

