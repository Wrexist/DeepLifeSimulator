/**
 * Visual dev harness for the luxury showcase models.
 *
 * The img2threejs methodology is explicit that every build pass must be VERIFIED
 * against the reference by looking at a render — a script may enforce, but only
 * eyes may score. This is that step, and it is the same rasterizer that caught
 * four real defects in the procedural head.
 *
 * SKIPPED unless `PREVIEW_OUT` is set, so CI pays nothing:
 *
 *     PREVIEW_OUT=/tmp/lux npx jest lib/luxury/models/__tests__/preview.render.ts
 */

import * as fs from 'fs';
import * as zlib from 'zlib';
import { buildLuxuryModel, LUXURY_MODEL_IDS } from '@/lib/luxury/models';
import type { ProceduralModel } from '@/lib/luxury/models/types';

const W = 460, H = 460;

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

let CRC_TABLE: number[] | null = null;
function crc32(buf: Buffer): number {
  if (!CRC_TABLE) {
    CRC_TABLE = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let i = 0; i < width * 3; i++) raw[y * (width * 3 + 1) + 1 + i] = rgb[y * width * 3 + i];
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Renders the model. Transmissive parts are approximated by alpha-blending with
 * an extra internal-reflection term — the software rasterizer cannot refract, so
 * a diamond here reads dimmer and flatter than it will on the GPU. Stated
 * plainly rather than glossed: this view verifies GEOMETRY, not final material.
 */
function render(model: ProceduralModel, yaw: number, pitch: number): Uint8Array {
  const img = new Uint8Array(W * H * 3);
  for (let i = 0; i < img.length; i += 3) { img[i] = 16; img[i + 1] = 20; img[i + 2] = 30; }
  const depth = new Float32Array(W * H).fill(-Infinity);

  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const fit = model.radius > 0 ? (H * 0.36) / model.radius : 100;
  const ox = W / 2, oy = H / 2;

  const L = [-0.4, 0.75, 0.62];
  const Ll = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / Ll, ly = L[1] / Ll, lz = L[2] / Ll;

  for (const part of model.parts) {
    const { mesh, material } = part;
    const color = hexToRgb(material.color);
    // PREVIEW_OPAQUE forces every material opaque. The rasterizer cannot
    // refract, so a transmissive part blended against a dark background hides
    // the very geometry this harness exists to check — the diamond's pavilion
    // vanished entirely on the first pass. Opaque mode verifies SHAPE; the GPU
    // verifies material.
    const alpha = process.env.PREVIEW_OPAQUE ? 1 : (material.opacity ?? 1);
    const spec = 1 - material.roughness;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const p: number[][] = [], n: number[][] = [];
      for (let k = 0; k < 3; k++) {
        const i = mesh.indices[t + k] * 3;
        let x = mesh.positions[i], y = mesh.positions[i + 1], z = mesh.positions[i + 2];
        let rx = x * cy + z * sy, rz = -x * sy + z * cy;
        let ry = y * cp - rz * sp; rz = y * sp + rz * cp;
        p.push([ox + rx * fit, oy - ry * fit, rz]);
        let nx = mesh.normals[i], ny = mesh.normals[i + 1], nz = mesh.normals[i + 2];
        let nrx = nx * cy + nz * sy, nrz = -nx * sy + nz * cy;
        const nry = ny * cp - nrz * sp; nrz = ny * sp + nrz * cp;
        n.push([nrx, nry, nrz]);
        void x; void y; void z;
      }
      const minX = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0])));
      const maxX = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
      const minY = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])));
      const maxY = Math.min(H - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
      const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
      if (Math.abs(area) < 1e-9) continue;

      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const w0 = ((p[1][0] - px) * (p[2][1] - py) - (p[2][0] - px) * (p[1][1] - py)) / area;
        const w1 = ((p[2][0] - px) * (p[0][1] - py) - (p[0][0] - px) * (p[2][1] - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2];
        const di = py * W + px;
        if (z <= depth[di]) continue;
        let nx = w0 * n[0][0] + w1 * n[1][0] + w2 * n[2][0];
        let ny = w0 * n[0][1] + w1 * n[1][1] + w2 * n[2][1];
        let nz = w0 * n[0][2] + w1 * n[1][2] + w2 * n[2][2];
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        // Transmissive parts show their back faces too — that is most of what a
        // gemstone looks like — so only cull for opaque materials.
        if (nz < 0 && alpha >= 1) continue;
        depth[di] = z;
        const diff = Math.abs(nx * lx + ny * ly + nz * lz);
        const hl = Math.hypot(lx, ly, lz + 1);
        const specV = spec * Math.pow(Math.max(0, (nx * lx + ny * ly + nz * (lz + 1)) / hl), 42);
        const rim = Math.pow(1 - Math.abs(nz), 3) * 0.4;
        const light = 0.22 + diff * 0.85;
        for (let c = 0; c < 3; c++) {
          const lit = Math.min(255, color[c] * light + specV * 255 + rim * 90);
          img[di * 3 + c] = Math.min(255, img[di * 3 + c] * (1 - alpha) + lit * alpha);
        }
      }
    }
  }
  return img;
}

function tile(images: Uint8Array[], cols: number): { data: Uint8Array; w: number; h: number } {
  const rows = Math.ceil(images.length / cols);
  const w = W * cols, h = H * rows;
  const out = new Uint8Array(w * h * 3);
  images.forEach((img, i) => {
    const cx = (i % cols) * W, cyy = Math.floor(i / cols) * H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 3, d = ((cyy + y) * w + cx + x) * 3;
      out[d] = img[s]; out[d + 1] = img[s + 1]; out[d + 2] = img[s + 2];
    }
  });
  return { data: out, w, h };
}

const OUT = process.env.PREVIEW_OUT;

(OUT ? it : it.skip)('renders every luxury model from several angles', () => {
  fs.mkdirSync(OUT!, { recursive: true });
  for (const id of LUXURY_MODEL_IDS) {
    const model = buildLuxuryModel(id)!;
    const views = [-0.5, -0.15, 0.35, 1.2].map((yaw) => render(model, yaw, model.defaultPitch ?? -0.18));
    const t = tile(views, 4);
    fs.writeFileSync(`${OUT!}/${id}.png`, encodePng(t.w, t.h, t.data));
  }
  expect(fs.existsSync(`${OUT!}/museum_diamond.png`)).toBe(true);
});
