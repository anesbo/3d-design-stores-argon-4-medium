import * as THREE from 'three';
import {
  FurnitureInstance,
  Wall,
  WallOpening,
} from '../types/domain';
import { WallGeometry } from '../utils/geometry';
import { getThreeMaterial } from './proceduralTextures';

/**
 * Builds a complete 3D procedural Furniture/Architecture/Lighting group for a FurnitureInstance.
 * Local origin is at bottom center (y=0 on floor, or at item.elevation).
 */
export function buildProceduralFurnitureGroup(
  item: FurnitureInstance,
  isSelected: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.userData = { selectionType: 'furniture', id: item.id };

  const W = item.width;
  const D = item.depth;
  const H = item.height;

  const pMat = getThreeMaterial(item.primaryMaterialId, 1, 1, isSelected);
  const sMat = getThreeMaterial(item.secondaryMaterialId, 1, 1, isSelected);
  const darkMetal = getThreeMaterial('metal-matte-black', 1, 1, isSelected);
  const brassMat = getThreeMaterial('metal-brushed-brass', 1, 1, isSelected);
  const steelMat = getThreeMaterial('metal-stainless', 1, 1, isSelected);
  const glassMat = getThreeMaterial(
    'glass-architectural-clear',
    1,
    1,
    isSelected
  );

  const addMesh = (
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0
  ) => {
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.castShadow = !item.isLight;
    m.receiveShadow = true;
    m.userData = { selectionType: 'furniture', id: item.id };
    group.add(m);
    return m;
  };

  switch (item.shape) {
    case 'dining-chair': {
      const seatH = H * 0.56;
      const legR = 0.02;
      const insetX = W * 0.38;
      const insetZ = D * 0.38;
      // 4 legs
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addMesh(
            new THREE.CylinderGeometry(legR * 0.75, legR, seatH, 10),
            pMat,
            sx * insetX,
            seatH / 2,
            sz * insetZ
          );
        }
      }
      // Seat frame & upholstered pad
      addMesh(
        new THREE.BoxGeometry(W * 0.9, 0.04, D * 0.88),
        pMat,
        0,
        seatH,
        0
      );
      addMesh(
        new THREE.CylinderGeometry(W * 0.42, W * 0.42, 0.035, 20),
        sMat,
        0,
        seatH + 0.03,
        0.01
      );
      // Backrest uprights + curved top rail
      const backH = H - seatH;
      for (const sx of [-1, 1]) {
        addMesh(
          new THREE.CylinderGeometry(0.016, 0.018, backH, 8),
          pMat,
          sx * insetX,
          seatH + backH / 2,
          -insetZ
        );
      }
      addMesh(
        new THREE.BoxGeometry(W * 0.88, backH * 0.45, 0.035),
        pMat,
        0,
        H - backH * 0.25,
        -insetZ
      );
      break;
    }

    case 'armchair': {
      const baseH = H * 0.25;
      const seatH = H * 0.24;
      // Timber/steel sleigh legs
      for (const sx of [-1, 1]) {
        addMesh(
          new THREE.BoxGeometry(0.045, baseH, D * 0.82),
          sMat,
          sx * (W * 0.42),
          baseH / 2,
          0
        );
      }
      // Plush seat cushion
      addMesh(
        new THREE.BoxGeometry(W * 0.82, seatH, D * 0.8),
        pMat,
        0,
        baseH + seatH / 2,
        D * 0.04
      );
      // Angled backrest cushion
      addMesh(
        new THREE.BoxGeometry(W * 0.82, H * 0.52, D * 0.24),
        pMat,
        0,
        baseH + seatH + H * 0.2,
        -D * 0.32,
        -0.15
      );
      // Left & Right armrests
      for (const sx of [-1, 1]) {
        addMesh(
          new THREE.BoxGeometry(W * 0.14, H * 0.38, D * 0.84),
          pMat,
          sx * (W * 0.43),
          baseH + H * 0.19,
          0
        );
      }
      break;
    }

    case 'bar-stool': {
      const seatY = H - 0.06;
      const r = Math.min(W, D) * 0.42;
      // 4 tapered legs
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addMesh(
            new THREE.CylinderGeometry(0.014, 0.02, seatY, 8),
            sMat,
            sx * r * 0.65,
            seatY / 2,
            sz * r * 0.65
          );
        }
      }
      // Brass footrest ring
      addMesh(
        new THREE.TorusGeometry(r * 0.72, 0.012, 8, 24),
        brassMat,
        0,
        H * 0.32,
        0,
        Math.PI / 2
      );
      // Upholstered round seat + low lip back
      addMesh(
        new THREE.CylinderGeometry(r, r * 0.95, 0.07, 24),
        pMat,
        0,
        seatY,
        0
      );
      addMesh(
        new THREE.BoxGeometry(r * 1.4, 0.12, 0.05),
        pMat,
        0,
        seatY + 0.07,
        -r * 0.75
      );
      break;
    }

    case 'banquette-bench': {
      const plinthH = 0.18;
      const seatH = 0.26;
      const backW = D * 0.28;
      // Wooden fluted plinth base
      addMesh(
        new THREE.BoxGeometry(W, plinthH, D * 0.94),
        sMat,
        0,
        plinthH / 2,
        0
      );
      // Bench seat cushion
      addMesh(
        new THREE.BoxGeometry(W, seatH, D * 0.96),
        pMat,
        0,
        plinthH + seatH / 2,
        D * 0.02
      );
      // Channel-tufted vertical backrest segments
      const backH = H - (plinthH + seatH * 0.5);
      const channels = Math.max(4, Math.round(W / 0.22));
      const chW = W / channels;
      for (let i = 0; i < channels; i++) {
        const cx = -W / 2 + (i + 0.5) * chW;
        addMesh(
          new THREE.BoxGeometry(chW * 0.92, backH, backW),
          pMat,
          cx,
          plinthH + seatH * 0.5 + backH / 2,
          -D / 2 + backW / 2
        );
      }
      break;
    }

    case 'bistro-table-round': {
      const r = Math.min(W, D) / 2;
      const topThick = 0.04;
      // Cast-iron base disc
      addMesh(
        new THREE.CylinderGeometry(r * 0.55, r * 0.6, 0.03, 24),
        sMat,
        0,
        0.015,
        0
      );
      // Central pedestal column
      addMesh(
        new THREE.CylinderGeometry(0.04, 0.055, H - topThick, 16),
        sMat,
        0,
        (H - topThick) / 2,
        0
      );
      // Tabletop with brass rim
      addMesh(
        new THREE.CylinderGeometry(r, r, topThick, 32),
        pMat,
        0,
        H - topThick / 2,
        0
      );
      break;
    }

    case 'dining-table-rect': {
      const topT = 0.05;
      const legH = H - topT;
      // Tabletop
      addMesh(
        new THREE.BoxGeometry(W, topT, D),
        pMat,
        0,
        H - topT / 2,
        0
      );
      // Trestle frame legs at ends
      const legX = W * 0.38;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addMesh(
            new THREE.BoxGeometry(0.055, legH, 0.055),
            sMat,
            sx * legX,
            legH / 2,
            sz * (D * 0.36)
          );
        }
        addMesh(
          new THREE.BoxGeometry(0.05, 0.045, D * 0.74),
          sMat,
          sx * legX,
          0.16,
          0
        );
      }
      // Central stretcher bar
      addMesh(
        new THREE.BoxGeometry(legX * 2, 0.04, 0.05),
        sMat,
        0,
        0.16,
        0
      );
      break;
    }

    case 'high-top-bar-table': {
      const topT = 0.055;
      const legH = H - topT;
      addMesh(
        new THREE.BoxGeometry(W, topT, D),
        pMat,
        0,
        H - topT / 2,
        0
      );
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addMesh(
            new THREE.BoxGeometry(0.05, legH, 0.05),
            darkMetal,
            sx * (W * 0.44),
            legH / 2,
            sz * (D * 0.4)
          );
        }
      }
      // Brass foot rail around perimeter
      addMesh(
        new THREE.BoxGeometry(W * 0.9, 0.025, D * 0.84),
        sMat,
        0,
        0.26,
        0
      );
      break;
    }

    case 'pos-service-counter': {
      const topT = 0.06;
      const bodyH = H - topT;
      // Recessed toe kick
      addMesh(
        new THREE.BoxGeometry(W * 0.94, 0.1, D * 0.86),
        darkMetal,
        0,
        0.05,
        0
      );
      // Main fluted cabinet body
      addMesh(
        new THREE.BoxGeometry(W * 0.98, bodyH - 0.1, D * 0.94),
        pMat,
        0,
        0.1 + (bodyH - 0.1) / 2,
        0
      );
      // Stone countertop overhang
      addMesh(
        new THREE.BoxGeometry(W, topT, D),
        sMat,
        0,
        H - topT / 2,
        0
      );
      // Dual POS touch terminals on top
      for (const tx of [-W * 0.22, W * 0.22]) {
        addMesh(
          new THREE.CylinderGeometry(0.06, 0.09, 0.12, 12),
          darkMetal,
          tx,
          H + 0.06,
          0
        );
        addMesh(
          new THREE.BoxGeometry(0.32, 0.22, 0.025),
          darkMetal,
          tx,
          H + 0.18,
          0,
          -0.45
        );
      }
      break;
    }

    case 'espresso-bar-station': {
      const topT = 0.06;
      const bodyH = H - topT;
      addMesh(
        new THREE.BoxGeometry(W * 0.98, bodyH, D * 0.95),
        pMat,
        0,
        bodyH / 2,
        0
      );
      addMesh(
        new THREE.BoxGeometry(W, topT, D),
        sMat,
        0,
        H - topT / 2,
        0
      );
      // Commercial 2-group Espresso Machine on left-center
      const ex = -W * 0.18;
      addMesh(
        new THREE.BoxGeometry(0.78, 0.46, 0.52),
        steelMat,
        ex,
        H + 0.23,
        -0.04
      );
      // Cup warmer rail & group heads
      addMesh(
        new THREE.BoxGeometry(0.74, 0.04, 0.48),
        brassMat,
        ex,
        H + 0.48,
        -0.04
      );
      // Two conical burr espresso grinders on right
      for (const gx of [W * 0.18, W * 0.34]) {
        addMesh(
          new THREE.CylinderGeometry(0.09, 0.11, 0.32, 16),
          darkMetal,
          gx,
          H + 0.16,
          0
        );
        addMesh(
          new THREE.CylinderGeometry(0.11, 0.06, 0.22, 16),
          glassMat,
          gx,
          H + 0.42,
          0
        );
      }
      break;
    }

    case 'pastry-display-case': {
      const baseH = H * 0.44;
      const glassH = H - baseH;
      // Marble base plinth
      addMesh(
        new THREE.BoxGeometry(W, baseH, D),
        pMat,
        0,
        baseH / 2,
        0
      );
      // Glass vitrine enclosure
      addMesh(
        new THREE.BoxGeometry(W * 0.96, glassH, D * 0.92),
        glassMat,
        0,
        baseH + glassH / 2,
        0
      );
      // Brass frame trim & 2 internal pastry shelves
      for (const tier of [0.33, 0.66]) {
        addMesh(
          new THREE.BoxGeometry(W * 0.9, 0.02, D * 0.76),
          brassMat,
          0,
          baseH + glassH * tier,
          0
        );
      }
      break;
    }

    case 'modular-wall-shelving': {
      // Vertical steel uprights
      const cols = 3;
      for (let i = 0; i < cols; i++) {
        const ux = -W * 0.46 + (i / (cols - 1)) * (W * 0.92);
        addMesh(
          new THREE.BoxGeometry(0.035, H, D * 0.9),
          sMat,
          ux,
          H / 2,
          0
        );
      }
      // 5 horizontal wooden shelves + decorative merchandise blocks
      const tiers = 5;
      for (let t = 0; t < tiers; t++) {
        const sy = 0.2 + (t / (tiers - 1)) * (H - 0.32);
        addMesh(
          new THREE.BoxGeometry(W, 0.035, D),
          pMat,
          0,
          sy,
          0
        );
        if (t < tiers - 1) {
          addMesh(
            new THREE.BoxGeometry(W * 0.22, 0.18, D * 0.6),
            brassMat,
            ((t % 2 === 0 ? -1 : 1) * W) * 0.24,
            sy + 0.11,
            0
          );
        }
      }
      break;
    }

    case 'clothing-display-rack': {
      const plinthH = 0.12;
      // Wooden bottom shoe plinth
      addMesh(
        new THREE.BoxGeometry(W, plinthH, D),
        sMat,
        0,
        plinthH / 2,
        0
      );
      // Brass upright arch frame
      const railH = H - plinthH;
      for (const sx of [-1, 1]) {
        addMesh(
          new THREE.CylinderGeometry(0.02, 0.02, railH, 12),
          pMat,
          sx * (W * 0.45),
          plinthH + railH / 2,
          0
        );
      }
      addMesh(
        new THREE.CylinderGeometry(0.02, 0.02, W * 0.9, 12),
        pMat,
        0,
        H - 0.04,
        0,
        0,
        0,
        Math.PI / 2
      );
      // Hanging garment silhouettes
      const garments = 6;
      const gMat1 = getThreeMaterial('fabric-cream-boucle', 1, 1, isSelected);
      const gMat2 = getThreeMaterial('fabric-olive-velvet', 1, 1, isSelected);
      for (let g = 0; g < garments; g++) {
        const gx = -W * 0.34 + (g / (garments - 1)) * (W * 0.68);
        addMesh(
          new THREE.BoxGeometry(0.07, H * 0.56, D * 0.72),
          g % 2 === 0 ? gMat1 : gMat2,
          gx,
          H - 0.12 - H * 0.28,
          0
        );
      }
      break;
    }

    case 'retail-display-island': {
      const lowerH = H * 0.55;
      // Lower wider walnut podium
      addMesh(
        new THREE.BoxGeometry(W, 0.08, D),
        sMat,
        0,
        lowerH,
        0
      );
      addMesh(
        new THREE.BoxGeometry(W * 0.75, lowerH, D * 0.75),
        sMat,
        0,
        lowerH / 2,
        0
      );
      // Upper marble feature tier
      addMesh(
        new THREE.BoxGeometry(W * 0.68, H - lowerH, D * 0.62),
        pMat,
        0,
        lowerH + (H - lowerH) / 2,
        0
      );
      break;
    }

    case 'interactive-kiosk': {
      // Weighted base plate
      addMesh(
        new THREE.BoxGeometry(W * 0.85, 0.04, D * 0.85),
        pMat,
        0,
        0.02,
        0
      );
      // Angled totem column
      addMesh(
        new THREE.BoxGeometry(W * 0.48, H * 0.75, D * 0.32),
        pMat,
        0,
        H * 0.38,
        0
      );
      // Tilted touchscreen display bezel & glowing screen
      addMesh(
        new THREE.BoxGeometry(W * 0.92, H * 0.42, 0.05),
        sMat,
        0,
        H * 0.82,
        0.04,
        -0.38
      );
      break;
    }

    case 'glass-partition': {
      const frameT = Math.max(0.04, D);
      // Glass sheet
      addMesh(
        new THREE.BoxGeometry(W - 0.06, H - 0.06, frameT * 0.35),
        sMat,
        0,
        H / 2,
        0
      );
      // Perimeter & Crittall grid mullions
      addMesh(
        new THREE.BoxGeometry(W, 0.045, frameT),
        pMat,
        0,
        0.022,
        0
      );
      addMesh(
        new THREE.BoxGeometry(W, 0.045, frameT),
        pMat,
        0,
        H - 0.022,
        0
      );
      const vBays = Math.max(2, Math.round(W / 0.65));
      for (let i = 0; i <= vBays; i++) {
        const vx = -W / 2 + (i / vBays) * W;
        addMesh(
          new THREE.BoxGeometry(0.035, H, frameT),
          pMat,
          vx,
          H / 2,
          0
        );
      }
      for (const hy of [H * 0.33, H * 0.67]) {
        addMesh(
          new THREE.BoxGeometry(W, 0.03, frameT),
          pMat,
          0,
          hy,
          0
        );
      }
      break;
    }

    case 'column-pillar': {
      addMesh(
        new THREE.BoxGeometry(W * 1.12, 0.14, D * 1.12),
        sMat,
        0,
        0.07,
        0
      );
      addMesh(
        new THREE.BoxGeometry(W, H - 0.24, D),
        pMat,
        0,
        H / 2,
        0
      );
      addMesh(
        new THREE.BoxGeometry(W * 1.1, 0.1, D * 1.1),
        sMat,
        0,
        H - 0.05,
        0
      );
      break;
    }

    case 'potted-plant': {
      const potR = Math.min(W, D) * 0.36;
      const potH = H * 0.34;
      // Ceramic tapered planter
      addMesh(
        new THREE.CylinderGeometry(potR, potR * 0.78, potH, 20),
        sMat,
        0,
        potH / 2,
        0
      );
      // Trunk
      const trunkMat = getThreeMaterial(
        'wood-american-walnut',
        1,
        1,
        isSelected
      );
      addMesh(
        new THREE.CylinderGeometry(0.03, 0.045, H * 0.55, 8),
        trunkMat,
        0,
        potH + H * 0.22,
        0
      );
      // Multi-sphere lush foliage canopy
      const canopyCenters = [
        [0, H * 0.78, 0, potR * 1.15],
        [-potR * 0.55, H * 0.66, potR * 0.3, potR * 0.85],
        [potR * 0.55, H * 0.7, -potR * 0.3, potR * 0.9],
        [0, H * 0.9, potR * 0.2, potR * 0.75],
      ];
      for (const [cx, cy, cz, cr] of canopyCenters) {
        addMesh(
          new THREE.DodecahedronGeometry(cr, 1),
          pMat,
          cx,
          cy,
          cz
        );
      }
      break;
    }

    case 'pendant-light': {
      const r = Math.min(W, D) / 2;
      // Ceiling canopy rose & drop cord
      addMesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16),
        pMat,
        0,
        H - 0.02,
        0
      );
      addMesh(
        new THREE.CylinderGeometry(0.008, 0.008, H * 0.75, 8),
        darkMetal,
        0,
        H * 0.6,
        0
      );
      // Brass dome shade
      addMesh(
        new THREE.SphereGeometry(
          r,
          24,
          16,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.55
        ),
        pMat,
        0,
        r * 0.5,
        0
      );
      // Glowing opal diffuser bulb
      const glowMat = new THREE.MeshStandardMaterial({
        color: item.lightColor || '#ffdfa8',
        emissive: new THREE.Color(item.lightColor || '#ffdfa8'),
        emissiveIntensity: 1.8,
        roughness: 0.2,
      });
      addMesh(
        new THREE.SphereGeometry(r * 0.38, 16, 16),
        glowMat,
        0,
        r * 0.32,
        0
      );
      break;
    }

    case 'ceiling-spot-track': {
      // Track bar
      addMesh(
        new THREE.BoxGeometry(W, 0.04, 0.06),
        pMat,
        0,
        H - 0.02,
        0
      );
      const glowMat = new THREE.MeshStandardMaterial({
        color: item.lightColor || '#fff2d6',
        emissive: new THREE.Color(item.lightColor || '#fff2d6'),
        emissiveIntensity: 2.0,
      });
      // 4 spotlight heads along the track
      const spots = 4;
      for (let i = 0; i < spots; i++) {
        const sx = -W * 0.38 + (i / (spots - 1)) * (W * 0.76);
        addMesh(
          new THREE.CylinderGeometry(0.045, 0.055, 0.16, 14),
          sMat,
          sx,
          H - 0.12,
          0,
          (i % 2 === 0 ? 1 : -1) * 0.25
        );
        addMesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12),
          glowMat,
          sx,
          H - 0.2,
          0
        );
      }
      break;
    }

    default: {
      addMesh(new THREE.BoxGeometry(W, H, D), pMat, 0, H / 2, 0);
      break;
    }
  }

  // Apply flip & position/rotation in world 3D space (Three.js X = plan X, Z = plan Y, Y = elevation)
  group.scale.set(item.flippedX ? -1 : 1, 1, item.flippedY ? -1 : 1);
  group.position.set(item.x, item.elevation, item.y);
  group.rotation.y = (-item.rotation * Math.PI) / 180;

  return group;
}

/**
 * Builds a complete 3D wall assembly with exact cutouts for doors & windows,
 * plus 3D door frames, hinged door leaves rotated to `swingAngle`, and window glazing!
 */
export function buildProceduralWallAssembly(
  wall: Wall,
  wg: WallGeometry,
  openingsOnWall: WallOpening[],
  selectedWallId: string | null,
  selectedOpeningId: string | null
): THREE.Group {
  const assembly = new THREE.Group();
  const isWallSelected = selectedWallId === wall.id;

  const L = wg.length;
  const H = wall.height;
  const T = wall.thickness;

  const wallMat = getThreeMaterial(
    wall.materialId,
    Math.max(1, L / 2),
    Math.max(1, H / 2),
    isWallSelected
  );

  // Sort openings along the wall by offset
  const sortedOps = [...openingsOnWall].sort((a, b) => a.offset - b.offset);

  const addWallSegmentBox = (
    xStart: number,
    xEnd: number,
    yBottom: number,
    yTop: number
  ) => {
    const segLen = xEnd - xStart;
    const segH = yTop - yBottom;
    if (segLen <= 0.005 || segH <= 0.005) return;
    const geom = new THREE.BoxGeometry(segLen, segH, T);
    const mesh = new THREE.Mesh(geom, wallMat);
    mesh.position.set(
      -L / 2 + (xStart + xEnd) / 2,
      (yBottom + yTop) / 2,
      0
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { selectionType: 'wall', id: wall.id };
    assembly.add(mesh);
  };

  let cursorX = 0;
  for (const op of sortedOps) {
    const opLeft = Math.max(0, op.offset - op.width / 2);
    const opRight = Math.min(L, op.offset + op.width / 2);

    // Solid full-height wall before this opening
    if (opLeft > cursorX) {
      addWallSegmentBox(cursorX, opLeft, 0, H);
    }

    // Sill wall below window (if sillHeight > 0)
    if (op.sillHeight > 0.01) {
      addWallSegmentBox(opLeft, opRight, 0, op.sillHeight);
    }

    // Header lintel wall above opening
    const opTop = op.sillHeight + op.height;
    if (opTop < H - 0.01) {
      addWallSegmentBox(opLeft, opRight, opTop, H);
    }

    // Build the 3D Door or Window assembly inside the cutout
    const opGroup = buildOpening3DGroup(
      op,
      T,
      L,
      selectedOpeningId === op.id
    );
    assembly.add(opGroup);

    cursorX = opRight;
  }

  // Remaining solid full-height wall after last opening
  if (cursorX < L) {
    addWallSegmentBox(cursorX, L, 0, H);
  }

  // Position & orient wall assembly at wall midpoint in 3D world space
  assembly.position.set(wg.midX, 0, wg.midY);
  assembly.rotation.y = -wg.angleRad;

  return assembly;
}

function buildOpening3DGroup(
  op: WallOpening,
  wallThickness: number,
  wallLength: number,
  isSelected: boolean
): THREE.Group {
  const group = new THREE.Group();
  const cx = -wallLength / 2 + op.offset;
  group.position.set(cx, op.sillHeight, 0);
  group.userData = { selectionType: 'opening', id: op.id };

  const W = op.width;
  const H = op.height;
  const frameDepth = wallThickness + 0.03;
  const jambThick = 0.045;

  const frameMat = getThreeMaterial(op.frameMaterialId, 1, 1, isSelected);
  const glassMat = getThreeMaterial(
    'glass-architectural-clear',
    1,
    1,
    isSelected
  );
  const handleMat = getThreeMaterial('metal-brushed-brass', 1, 1, isSelected);

  const addPart = (
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number
  ) => {
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { selectionType: 'opening', id: op.id };
    group.add(m);
    return m;
  };

  // Perimeter Jambs & Header
  addPart(
    new THREE.BoxGeometry(jambThick, H, frameDepth),
    frameMat,
    -W / 2 + jambThick / 2,
    H / 2,
    0
  );
  addPart(
    new THREE.BoxGeometry(jambThick, H, frameDepth),
    frameMat,
    W / 2 - jambThick / 2,
    H / 2,
    0
  );
  addPart(
    new THREE.BoxGeometry(W, jambThick, frameDepth),
    frameMat,
    0,
    H - jambThick / 2,
    0
  );

  const innerW = W - jambThick * 2;
  const innerH = H - jambThick;

  if (op.type === 'window' || op.type === 'storefront-window') {
    // Bottom sill
    addPart(
      new THREE.BoxGeometry(W + 0.04, jambThick, frameDepth + 0.04),
      frameMat,
      0,
      jambThick / 2,
      0
    );
    // Glass pane
    addPart(
      new THREE.BoxGeometry(innerW, innerH - jambThick, 0.02),
      glassMat,
      0,
      H / 2,
      0
    );
    // Storefront vertical mullions
    if (op.type === 'storefront-window' && W > 1.2) {
      const bays = Math.max(2, Math.round(W / 0.95));
      for (let i = 1; i < bays; i++) {
        const mx = -innerW / 2 + (i / bays) * innerW;
        addPart(
          new THREE.BoxGeometry(0.035, innerH, frameDepth * 0.7),
          frameMat,
          mx,
          H / 2,
          0
        );
      }
    }
  } else if (op.type === 'sliding-door') {
    // Two overlapping glass/frame sliding panels open proportional to swingAngle (0..110)
    const openRatio = (op.swingAngle / 110) * 0.42;
    const panelW = innerW * 0.52;
    for (const side of [-1, 1]) {
      const px = side * (innerW * 0.24 + side * innerW * openRatio * 0.5);
      addPart(
        new THREE.BoxGeometry(panelW, innerH, 0.04),
        glassMat,
        px,
        innerH / 2,
        side * 0.025
      );
    }
  } else if (op.type === 'double-door') {
    const leafW = innerW / 2;
    const swingRad = (op.swingAngle * Math.PI) / 180;
    const flipSign = op.flipInOut ? -1 : 1;

    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (innerW / 2), 0, 0);
      pivot.rotation.y = side * flipSign * swingRad;

      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(leafW, innerH, 0.045),
        frameMat
      );
      leaf.position.set(-side * (leafW / 2), innerH / 2, 0);
      leaf.castShadow = true;
      leaf.userData = { selectionType: 'opening', id: op.id };
      pivot.add(leaf);

      // Glazed vision panel in each leaf
      const vision = new THREE.Mesh(
        new THREE.BoxGeometry(leafW * 0.65, innerH * 0.65, 0.052),
        glassMat
      );
      vision.position.set(-side * (leafW / 2), innerH * 0.55, 0);
      vision.userData = { selectionType: 'opening', id: op.id };
      pivot.add(vision);

      group.add(pivot);
    }
  } else {
    // Single swing architectural door
    const swingRad = (op.swingAngle * Math.PI) / 180;
    const isLeftHinge = op.swingDirection === 'left';
    const flipSign = op.flipInOut ? -1 : 1;
    const hingeX = isLeftHinge ? -innerW / 2 : innerW / 2;
    const dirSign = isLeftHinge ? 1 : -1;

    const pivot = new THREE.Group();
    pivot.position.set(hingeX, 0, 0);
    pivot.rotation.y = -dirSign * flipSign * swingRad;

    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(innerW, innerH, 0.045),
      frameMat
    );
    leaf.position.set(dirSign * (innerW / 2), innerH / 2, 0);
    leaf.castShadow = true;
    leaf.userData = { selectionType: 'opening', id: op.id };
    pivot.add(leaf);

    // Brass lever handle
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.025, 0.14),
      handleMat
    );
    handle.position.set(dirSign * (innerW - 0.1), 1.0, 0);
    handle.userData = { selectionType: 'opening', id: op.id };
    pivot.add(handle);

    group.add(pivot);
  }

  return group;
}

