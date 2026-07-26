#!/usr/bin/env node
/**
 * Bake skin textures for the ICT head, from its own geometry.
 *
 *   node scripts/bake-face-textures.mjs <ICT-FaceKit-dir> [--size 1024]
 *
 * ## Why bake rather than paint
 *
 * ICT-FaceKit ships no skin textures — only documentation figures. An untextured
 * head reads as a clay maquette however good the geometry is, and texture is the
 * single largest remaining jump in perceived quality.
 *
 * Painting one by hand needs an artist. Generating one blindly in UV space needs
 * to know where the face IS in that layout, and guessing wrong puts lips on a
 * cheek. So instead this rasterises the mesh INTO UV space, which gives every
 * texel its real 3D position, and then shades from anatomy: a texel is "lip"
 * because it is near the mouth landmarks, not because it is at some hardcoded
 * UV rectangle. The same script would work on a different face model.
 *
 * ## Why the albedo is (nearly) neutral
 *
 * Skin tone is a runtime choice across a 10-entry palette. Baking tone in would
 * mean ten albedo maps and ten times the bundle. three multiplies
 * `material.color * map`, so this bakes a mostly-neutral DETAIL map — variation,
 * creases, a redder mouth, a cooler beard zone — and lets the tone multiply
 * through it. Lips are relatively redder than cheeks on every skin tone, so the
 * relationship survives the multiply where an absolute colour would not.
 *
 * ## Outputs
 *
 *   assets/textures/face_albedo.png     detail/variation, multiplied by tone
 *   assets/textures/face_roughness.png  glossy lips and T-zone, matte cheeks
 *   assets/textures/face_normal.png     pore-scale surface break-up
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

// ------------------------------------------------------------------ PNG ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}
function encodePng(width, height, rgb) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgb.buffer, y * width * 3, width * 3).copy(raw, y * stride + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- noise ----
/** Deterministic hash -> [0,1). Seeded so a rebuild is byte-identical. */
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
function fbm(x, y, z, octaves) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, z * freq) * amp;
    freq *= 2.07;
    amp *= 0.5;
  }
  return sum;
}

// ----------------------------------------------------------------- mesh ----
function readMesh(file) {
  const positions = [];
  const uvs = [];
  const faces = [];
  let material = '(none)';
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const p = line.slice(2).trim().split(/\s+/);
      positions.push(+p[0], +p[1], +p[2]);
    } else if (line.startsWith('vt ')) {
      const p = line.slice(3).trim().split(/\s+/);
      uvs.push(+p[0], +p[1]);
    } else if (line.startsWith('usemtl ')) {
      material = line.slice(7).trim();
    } else if (line.startsWith('f ')) {
      const toks = line.slice(2).trim().split(/\s+/);
      const v = [], vt = [];
      for (const t of toks) {
        const [vi, vti] = t.split('/');
        v.push(parseInt(vi, 10) - 1);
        vt.push(vti ? parseInt(vti, 10) - 1 : -1);
      }
      for (let k = 1; k + 1 < v.length; k++) {
        faces.push({ material, v: [v[0], v[k], v[k + 1]], vt: [vt[0], vt[k], vt[k + 1]] });
      }
    }
  }
  return { positions, uvs, faces };
}

const SKIN_MATERIALS = new Set(['M_Face', 'M_BackHead']);

function main() {
  const root = process.argv.find((a) => !a.startsWith('--') && a.includes('ICT'));
  const sizeArg = process.argv.indexOf('--size');
  const SIZE = sizeArg >= 0 ? Number(process.argv[sizeArg + 1]) : 1024;
  if (!root) {
    console.error('usage: bake-face-textures.mjs <ICT-FaceKit-dir> [--size N]');
    process.exit(2);
  }
  const modelDir = join(root, 'FaceXModel');
  const objPath = join(modelDir, 'generic_neutral_mesh.obj');
  if (!existsSync(objPath)) {
    console.error(`No generic_neutral_mesh.obj under ${modelDir}`);
    process.exit(2);
  }

  console.log(`\nBaking ${SIZE}x${SIZE} face textures…`);
  const mesh = readMesh(objPath);
  const indices = JSON.parse(readFileSync(join(modelDir, 'vertex_indices.json'), 'utf8'));
  const lm = indices.idx_to_landmark_verts;
  const P = (i) => [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];

  // --- Rasterise the mesh into UV space -----------------------------------
  // Each texel learns its own 3D position, which is what lets the shading below
  // be anatomical rather than a guess about the UV layout.
  const world = new Float32Array(SIZE * SIZE * 3);
  const filled = new Uint8Array(SIZE * SIZE);
  const skinFaces = mesh.faces.filter((f) => SKIN_MATERIALS.has(f.material));

  for (const f of skinFaces) {
    if (f.vt.some((t) => t < 0)) continue;
    const ux = f.vt.map((t) => mesh.uvs[t * 2] * SIZE);
    const uy = f.vt.map((t) => (1 - mesh.uvs[t * 2 + 1]) * SIZE);
    const p = f.v.map(P);
    const x0 = Math.max(0, Math.floor(Math.min(...ux)) - 1);
    const x1 = Math.min(SIZE - 1, Math.ceil(Math.max(...ux)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(...uy)) - 1);
    const y1 = Math.min(SIZE - 1, Math.ceil(Math.max(...uy)) + 1);
    const area = (ux[1] - ux[0]) * (uy[2] - uy[0]) - (uy[1] - uy[0]) * (ux[2] - ux[0]);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((ux[1] - px) * (uy[2] - py) - (uy[1] - py) * (ux[2] - px)) / area;
        const w1 = ((ux[2] - px) * (uy[0] - py) - (uy[2] - py) * (ux[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        // Slight tolerance so adjacent triangles do not leave a one-texel gap
        // along every shared edge, which would show as a seam grid on the face.
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const o = (y * SIZE + x) * 3;
        world[o] = w0 * p[0][0] + w1 * p[1][0] + w2 * p[2][0];
        world[o + 1] = w0 * p[0][1] + w1 * p[1][1] + w2 * p[2][1];
        world[o + 2] = w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2];
        filled[y * SIZE + x] = 1;
      }
    }
  }
  const coverage = filled.reduce((s, v) => s + v, 0) / (SIZE * SIZE);
  console.log(`  UV coverage ${(coverage * 100).toFixed(1)}%`);
  if (coverage < 0.05) {
    console.error('ABORT: almost nothing rasterised — the UV set is missing or degenerate.');
    process.exit(3);
  }

  // --- Anatomical fields ---------------------------------------------------
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const headScale = dist(P(lm[0]), P(lm[16])) || 1;
  const mouthPts = [];
  for (let i = 48; i <= 67; i++) mouthPts.push(P(lm[i]));
  const nosePts = [P(lm[31]), P(lm[32]), P(lm[33]), P(lm[34]), P(lm[35])];
  const eyePts = [];
  for (let i = 36; i <= 47; i++) eyePts.push(P(lm[i]));
  const browPts = [];
  for (let i = 17; i <= 26; i++) browPts.push(P(lm[i]));
  const chinY = P(lm[8])[1];
  const noseBaseY = P(lm[33])[1];

  const nearest = (pt, set) => {
    let d = Infinity;
    for (const q of set) d = Math.min(d, dist(pt, q));
    return d / headScale;
  };
  /** 1 at the feature, falling to 0 by `range` (in head-widths). */
  const falloff = (d, range) => Math.max(0, 1 - d / range);

  const albedo = new Uint8Array(SIZE * SIZE * 3);
  const rough = new Uint8Array(SIZE * SIZE * 3);
  const height = new Float32Array(SIZE * SIZE);

  for (let i = 0; i < SIZE * SIZE; i++) {
    const o = i * 3;
    if (!filled[i]) {
      // Unmapped texels get neutral values, then get overwritten by the dilate
      // pass below. Leaving them black would bleed dark fringes along every seam
      // once the GPU filters the texture.
      albedo[o] = albedo[o + 1] = albedo[o + 2] = 235;
      rough[o] = rough[o + 1] = rough[o + 2] = 180;
      continue;
    }
    const pt = [world[o], world[o + 1], world[o + 2]];

    const dMouth = nearest(pt, mouthPts);
    const dNose = nearest(pt, nosePts);
    const dEye = nearest(pt, eyePts);
    const dBrow = nearest(pt, browPts);

    const lip = falloff(dMouth, 0.10) ** 2;
    const nostril = falloff(dNose, 0.06) ** 2;
    const socket = falloff(dEye, 0.09) ** 2;
    const brow = falloff(dBrow, 0.07) ** 2;
    // Beard zone: below the nose base, excluding the lips themselves.
    const beardBand = pt[1] < noseBaseY
      ? Math.min(1, (noseBaseY - pt[1]) / Math.max(1e-6, noseBaseY - chinY) * 1.6)
      : 0;
    const beard = Math.max(0, beardBand - lip * 0.8);

    // Mottling at two scales: broad tonal drift plus fine capillary break-up.
    const n = pt.map((c) => c / headScale);
    const broad = fbm(n[0] * 5, n[1] * 5, n[2] * 5, 3);
    const fine = fbm(n[0] * 34, n[1] * 34, n[2] * 34, 2);
    const pore = fbm(n[0] * 150, n[1] * 150, n[2] * 150, 2);

    // Albedo: near-neutral so the palette tone multiplies through cleanly.
    let r = 1, g = 1, b = 1;
    const shade = 1 - (socket * 0.16 + nostril * 0.20 + brow * 0.06);
    r *= shade; g *= shade; b *= shade;
    // Lips read redder than cheeks on every skin tone, so the RELATIVE shift
    // survives the multiply where an absolute lip colour would not.
    r *= 1 + lip * 0.16; g *= 1 - lip * 0.10; b *= 1 - lip * 0.10;
    // Beard shadow is cooler and slightly darker, never a drawn beard.
    r *= 1 - beard * 0.07; g *= 1 - beard * 0.05; b *= 1 - beard * 0.02;
    const drift = (broad - 0.5) * 0.09 + (fine - 0.5) * 0.045;
    r *= 1 + drift * 1.15; g *= 1 + drift * 0.85; b *= 1 + drift * 0.8;

    albedo[o] = Math.max(0, Math.min(255, Math.round(r * 246)));
    albedo[o + 1] = Math.max(0, Math.min(255, Math.round(g * 246)));
    albedo[o + 2] = Math.max(0, Math.min(255, Math.round(b * 246)));

    // Roughness: lips wet, T-zone oilier, cheeks matte. Uniform roughness is a
    // large part of why an untextured head reads as plastic — real skin varies
    // a lot across the face and the highlight shape is what shows it.
    const tzone = Math.max(falloff(dNose, 0.22) * 0.6, falloff(dBrow, 0.20) * 0.45);
    let rg = 0.80 - lip * 0.34 - tzone * 0.16 + (fine - 0.5) * 0.10;
    rg = Math.max(0.18, Math.min(0.96, rg));
    const rv = Math.round(rg * 255);
    rough[o] = rough[o + 1] = rough[o + 2] = rv;

    // Height for the normal map: pores, plus a slight lift on the lips.
    height[i] = (pore - 0.5) * 0.55 + (fine - 0.5) * 0.25 + lip * 0.10;
  }

  // Normal map from the height field. Sobel-ish central difference in UV space.
  const normal = new Uint8Array(SIZE * SIZE * 3);
  const STRENGTH = 2.2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const l = height[y * SIZE + Math.max(0, x - 1)];
      const r = height[y * SIZE + Math.min(SIZE - 1, x + 1)];
      const u = height[Math.max(0, y - 1) * SIZE + x];
      const d = height[Math.min(SIZE - 1, y + 1) * SIZE + x];
      let nx = (l - r) * STRENGTH;
      let ny = (u - d) * STRENGTH;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const o = i * 3;
      normal[o] = Math.round((nx * 0.5 + 0.5) * 255);
      normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }

  // Dilate filled texels outward. Without this the GPU's bilinear filter samples
  // unmapped background across every UV island edge and draws a bright seam
  // along the hairline and jaw — the classic "cracks all over the face".
  const dilate = (buf) => {
    const mask = Uint8Array.from(filled);
    for (let pass = 0; pass < 6; pass++) {
      const next = Uint8Array.from(mask);
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const i = y * SIZE + x;
          if (mask[i]) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nxp = x + dx, nyp = y + dy;
            if (nxp < 0 || nyp < 0 || nxp >= SIZE || nyp >= SIZE) continue;
            const j = nyp * SIZE + nxp;
            if (!mask[j]) continue;
            buf[i * 3] = buf[j * 3];
            buf[i * 3 + 1] = buf[j * 3 + 1];
            buf[i * 3 + 2] = buf[j * 3 + 2];
            next[i] = 1;
            break;
          }
        }
      }
      mask.set(next);
    }
  };
  dilate(albedo);
  dilate(rough);
  dilate(normal);

  mkdirSync('assets/textures', { recursive: true });
  const write = (name, data) => {
    const png = encodePng(SIZE, SIZE, data);
    writeFileSync(`assets/textures/${name}`, png);
    console.log(`  ${name.padEnd(20)} ${(png.byteLength / 1024).toFixed(0)} KB`);
    return png.byteLength;
  };
  /**
   * Box-downsample. Used for the normal map only.
   *
   * Pore noise is high-frequency by construction, so PNG cannot compress it —
   * at 1024 the normal map came out 2.1 MB, larger than the head mesh and the
   * other two textures combined. Halving it costs nothing visible at portrait
   * size (the detail is sub-pixel there) and drops it by ~4x. Albedo and
   * roughness stay full size, because their features are large and a seam or a
   * lip edge at half resolution IS visible.
   */
  const half = (buf, size) => {
    const h = size >> 1;
    const out = new Uint8Array(h * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < h; x++) {
        for (let c = 0; c < 3; c++) {
          const s = (yy, xx) => buf[((yy * size) + xx) * 3 + c];
          out[(y * h + x) * 3 + c] =
            (s(y * 2, x * 2) + s(y * 2, x * 2 + 1) + s(y * 2 + 1, x * 2) + s(y * 2 + 1, x * 2 + 1)) >> 2;
        }
      }
    }
    return { data: out, size: h };
  };

  let total = 0;
  total += write('face_albedo.png', albedo);
  total += write('face_roughness.png', rough);
  const smallNormal = half(normal, SIZE);
  {
    const png = encodePng(smallNormal.size, smallNormal.size, smallNormal.data);
    writeFileSync('assets/textures/face_normal.png', png);
    console.log(`  ${'face_normal.png'.padEnd(20)} ${(png.byteLength / 1024).toFixed(0)} KB  (${smallNormal.size}px)`);
    total += png.byteLength;
  }
  console.log(`\n  total ${(total / 1024 / 1024).toFixed(2)} MB\n`);

  // The head GLB is ~1.3 MB; textures at 1024 should not dwarf it. Loud rather
  // than silent, because bundle growth is invisible until a release.
  if (total > 3 * 1024 * 1024) {
    console.error(`WARNING: ${(total / 1024 / 1024).toFixed(2)} MB of textures. Try --size 512.`);
    process.exitCode = 1;
  }
}

main();
