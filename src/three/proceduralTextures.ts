import * as THREE from 'three';
import { MaterialDef } from '../types/domain';
import { getMaterial } from '../data/materials';

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function createProceduralCanvasTexture(
  mat: MaterialDef,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const baseColor = mat.color;
  const secColor = mat.secondaryColor || '#44403c';

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  switch (mat.pattern) {
    case 'concrete': {
      // Troweled architectural concrete with micro-variations
      for (let i = 0; i < 2400; i++) {
        const x = (i * 73) % 512;
        const y = (i * 137) % 512;
        const r = (i % 5) + 1;
        ctx.fillStyle = i % 2 === 0 ? secColor : '#94908b';
        ctx.globalAlpha = 0.08;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = secColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 508, 508);
      break;
    }

    case 'hardwood': {
      // Wide-plank timber flooring with grain lines and staggered joints
      const numPlanks = 6;
      const plankH = 512 / numPlanks;
      for (let p = 0; p < numPlanks; p++) {
        const y0 = p * plankH;
        ctx.fillStyle = p % 2 === 0 ? baseColor : secColor;
        ctx.globalAlpha = p % 2 === 0 ? 0.04 : 0.12;
        ctx.fillRect(0, y0, 512, plankH);

        // Wood grain streaks
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = secColor;
        ctx.lineWidth = 1.2;
        for (let g = 0; g < 10; g++) {
          const gy = y0 + (g + 0.5) * (plankH / 10);
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(
            170,
            gy + ((g % 3) - 1) * 3,
            340,
            gy - ((g % 2) - 0.5) * 3,
            512,
            gy
          );
          ctx.stroke();
        }

        // Plank horizontal seam
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#291c12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.lineTo(512, y0);
        ctx.stroke();

        // Vertical butt joint
        const jointX = ((p * 193 + 80) % 420) + 40;
        ctx.beginPath();
        ctx.moveTo(jointX, y0);
        ctx.lineTo(jointX, y0 + plankH);
        ctx.stroke();
      }
      break;
    }

    case 'herringbone': {
      const step = 64;
      ctx.strokeStyle = secColor;
      ctx.lineWidth = 2;
      for (let y = -step; y < 512 + step; y += step) {
        for (let x = -step; x < 512 + step; x += step) {
          ctx.globalAlpha = ((x + y) / step) % 2 === 0 ? 0.18 : 0.06;
          ctx.fillStyle = secColor;
          ctx.fillRect(x, y, step, step);
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(x, y + step / 2);
          ctx.lineTo(x + step / 2, y);
          ctx.lineTo(x + step, y + step / 2);
          ctx.stroke();
        }
      }
      break;
    }

    case 'terrazzo': {
      const palette = [secColor, '#57534e', '#c29b6d', '#fafaf9', '#78716c'];
      for (let i = 0; i < 420; i++) {
        const cx = (i * 97 + 13) % 500;
        const cy = (i * 151 + 29) % 500;
        const rx = 3 + (i % 9);
        const ry = 2 + ((i * 3) % 7);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((i % 12) * 0.5);
        ctx.fillStyle = palette[i % palette.length];
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(-rx, -ry);
        ctx.lineTo(rx, -ry * 0.5);
        ctx.lineTo(rx * 0.7, ry);
        ctx.lineTo(-rx * 0.6, ry * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'checker-tile': {
      const cells = 4;
      const sz = 512 / cells;
      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? baseColor : secColor;
          ctx.globalAlpha = 1;
          ctx.fillRect(c * sz, r * sz, sz, sz);
          ctx.strokeStyle = '#78716c';
          ctx.lineWidth = 3;
          ctx.strokeRect(c * sz, r * sz, sz, sz);
        }
      }
      break;
    }

    case 'hex-tile': {
      const r = 36;
      const dx = r * 1.5;
      const dy = r * Math.sqrt(3);
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 3;
      for (let col = -1; col < 12; col++) {
        for (let row = -1; row < 10; row++) {
          const cx = col * dx;
          const cy = row * dy + (col % 2 === 0 ? 0 : dy / 2);
          ctx.fillStyle = (col + row) % 3 === 0 ? secColor : baseColor;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const ang = (Math.PI / 3) * k;
            const px = cx + r * Math.cos(ang);
            const py = cy + r * Math.sin(ang);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
      break;
    }

    case 'brick': {
      const rows = 10;
      const cols = 4;
      const bh = 512 / rows;
      const bw = 512 / cols;
      ctx.fillStyle = '#c7c2b8'; // mortar
      ctx.fillRect(0, 0, 512, 512);
      for (let r = 0; r < rows; r++) {
        const offset = r % 2 === 0 ? 0 : bw / 2;
        for (let c = -1; c <= cols; c++) {
          const x = c * bw + offset;
          const y = r * bh;
          ctx.fillStyle = (r + c) % 3 === 0 ? secColor : baseColor;
          ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        }
      }
      break;
    }

    case 'fluted-wood': {
      const slats = 24;
      const sw = 512 / slats;
      for (let i = 0; i < slats; i++) {
        const x = i * sw;
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, 0, sw * 0.72, 512);
        ctx.fillStyle = secColor;
        ctx.fillRect(x + sw * 0.72, 0, sw * 0.28, 512);
      }
      break;
    }

    case 'marble': {
      ctx.strokeStyle = secColor;
      ctx.globalAlpha = 0.25;
      for (let v = 0; v < 8; v++) {
        ctx.lineWidth = (v % 3) + 1;
        ctx.beginPath();
        let x = (v * 83) % 512;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 512) {
          y += 32;
          x += Math.sin(y * 0.03 + v) * 18;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }

    default: {
      // Subtle grain for drywall, boucle, leather, metals
      for (let i = 0; i < 1200; i++) {
        const x = (i * 89) % 512;
        const y = (i * 131) % 512;
        ctx.fillStyle = secColor;
        ctx.globalAlpha = 0.05;
        ctx.fillRect(x, y, 2, 2);
      }
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function getThreeMaterial(
  materialId: string,
  repeatX = 1,
  repeatY = 1,
  highlighted = false
): THREE.MeshStandardMaterial {
  const mat = getMaterial(materialId);
  const key = `${mat.id}:${repeatX.toFixed(1)}:${repeatY.toFixed(1)}:${highlighted}`;
  const cached = materialCache.get(key);
  if (cached) return cached;

  const isGlass = mat.category === 'glass';
  const tex = isGlass
    ? undefined
    : createProceduralCanvasTexture(mat, repeatX, repeatY);

  const threeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(mat.color),
    map: tex,
    roughness: mat.roughness,
    metalness: mat.metalness,
    transparent: isGlass || (mat.opacity !== undefined && mat.opacity < 1),
    opacity: mat.opacity ?? 1.0,
    emissive: highlighted ? new THREE.Color('#f59e0b') : new THREE.Color('#000000'),
    emissiveIntensity: highlighted ? 0.28 : 0,
    side: THREE.DoubleSide,
  });

  materialCache.set(key, threeMat);
  return threeMat;
}

