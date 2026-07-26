#!/usr/bin/env node
/**
 * Render the built head GLB to a PNG contact sheet, so it can be LOOKED AT.
 *
 *   node scripts/preview-ict-head.mjs assets/models/head_ict.glb out.png
 *
 * ## Why this exists
 *
 * Every structural check on this asset passes: 21 morphs with the right names,
 * correct binding, inside budget. None of that says the face looks like a face.
 *
 * Earlier in this project a head passed all its assertions and was described as
 * "stylized but coherent"; a screenshot showed it was not. The defects that
 * matter here — a decimator collapsing the eyelid line, a derived morph that
 * widens the jaw by inflating the neck, an inverted normal — are not
 * expressible as assertions. You have to see them.
 *
 * So this rasterises in software: no GPU, no device, no three.js. It renders
 * the neutral head from several angles, then each morph at full influence
 * beside neutral, which is the view that actually answers "does the jawWidth
 * slider widen the jaw".
 */

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
// Imported explicitly rather than leaning on the global: the repo's eslint
// config does not declare Node globals for scripts, and this file is only ever
// run under Node.
import { Buffer } from 'node:buffer';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';

const CELL = 260;

// ---------------------------------------------------------------- PNG ------
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
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ raster ------
/**
 * Z-buffered triangle rasteriser with flat shading from the geometric normal.
 *
 * Flat shading is deliberate. Smooth normals hide exactly the defects worth
 * finding — a collapsed eyelid or a pinched nostril reads as a smooth dent
 * under interpolated normals, and as an obvious facet here.
 */
function render(positions, indices, yaw, size) {
  const rgb = new Uint8Array(size * size * 3);
  for (let i = 0; i < rgb.length; i += 3) {
    const t = Math.floor(i / 3 / size) / size;
    rgb[i] = 12 + t * 8;
    rgb[i + 1] = 14 + t * 10;
    rgb[i + 2] = 22 + t * 14;
  }
  // Larger rotated z is NEARER the viewer, so the buffer keeps the maximum.
  //
  // This started as `fill(Infinity)` with a `z >= zbuf` reject, i.e. inverted.
  // Backface culling hid it almost everywhere — with one layer of front-facing
  // geometry there is nothing to sort — so the head looked fine while every
  // place two front-facing surfaces overlap drew the FARTHER one. The eyeballs,
  // correctly seated behind the lids, were therefore drawn on top of them, and
  // the interior of the skull was drawn through the face. Both read as asset
  // defects; both were this line.
  const zbuf = new Float32Array(size * size).fill(-Infinity);

  // Frame on the bounding box of what we are actually drawing. Targeting the
  // origin instead cropped an earlier asset, because the mesh does not straddle
  // it — the head sits above its own origin.
  let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const scale = (size * 0.78) / extent;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);

  const proj = new Float32Array((positions.length / 3) * 3);
  for (let v = 0, p = 0; v < positions.length; v += 3, p += 3) {
    const x = positions[v] - cx, y = positions[v + 1] - cy, z = positions[v + 2] - cz;
    const rx = x * cos + z * sin;
    const rz = -x * sin + z * cos;
    proj[p] = size / 2 + rx * scale;
    proj[p + 1] = size / 2 - y * scale;
    proj[p + 2] = rz;
  }

  const L = [-0.42, 0.55, 0.72]; // key light, upper-left front
  const Ln = Math.hypot(...L);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ax = proj[a], ay = proj[a + 1], bx = proj[b], by = proj[b + 1], cxp = proj[c], cyp = proj[c + 1];
    const area = (bx - ax) * (cyp - ay) - (by - ay) * (cxp - ax);
    if (area >= 0) continue; // back-facing

    const p0 = indices[t] * 3, p1 = indices[t + 1] * 3, p2 = indices[t + 2] * 3;
    const ux = positions[p1] - positions[p0], uy = positions[p1 + 1] - positions[p0 + 1], uz = positions[p1 + 2] - positions[p0 + 2];
    const vx = positions[p2] - positions[p0], vy = positions[p2 + 1] - positions[p0 + 1], vz = positions[p2 + 2] - positions[p0 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const rnx = nx * cos + nz * sin, rnz = -nx * sin + nz * cos;
    const diff = Math.max(0, (rnx * L[0] + ny * L[1] + rnz * L[2]) / Ln);
    const rim = Math.pow(1 - Math.min(1, Math.abs(rnz)), 3) * 0.35;
    const shade = 0.13 + diff * 0.78 + rim;
    const r = Math.min(255, shade * 232), g = Math.min(255, shade * 196), bl = Math.min(255, shade * 174);

    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cxp)));
    const x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cxp)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cyp)));
    const y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cyp)));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const w0 = (bx - ax) * (y + 0.5 - ay) - (by - ay) * (x + 0.5 - ax);
        const w1 = (cxp - bx) * (y + 0.5 - by) - (cyp - by) * (x + 0.5 - bx);
        const w2 = (ax - cxp) * (y + 0.5 - cyp) - (ay - cyp) * (x + 0.5 - cxp);
        if (w0 > 0 || w1 > 0 || w2 > 0) continue;
        // Barycentric depth, NOT the triangle centroid.
        //
        // Centroid depth was the first version, and it made a correctly-seated
        // eyeball look like a googly disc pasted on the lid: where two surfaces
        // interpenetrate closely, whole triangles win or lose the depth test
        // together instead of pixel by pixel. That is a defect in the renderer
        // that looks exactly like a defect in the asset — the worst kind.
        const sum = w0 + w1 + w2;
        const z = sum === 0
          ? (proj[a + 2] + proj[b + 2] + proj[c + 2]) / 3
          : (w1 * proj[a + 2] + w2 * proj[b + 2] + w0 * proj[c + 2]) / sum;
        const o = y * size + x;
        if (z <= zbuf[o]) continue;
        zbuf[o] = z;
        rgb[o * 3] = r; rgb[o * 3 + 1] = g; rgb[o * 3 + 2] = bl;
      }
    }
  }
  return rgb;
}

function blit(sheet, sheetW, cell, size, col, row) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 3;
      const d = ((row * size + y) * sheetW + col * size + x) * 3;
      sheet[d] = cell[s]; sheet[d + 1] = cell[s + 1]; sheet[d + 2] = cell[s + 2];
    }
  }
}

// -------------------------------------------------------------- main ------
async function main() {
  const [input = 'assets/models/head_ict.glb', out = 'head-preview.png'] = process.argv.slice(2);
  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
  const doc = await io.read(input);
  // Positions are quantized ints on disk; without this every vertex would land
  // in the wrong place and the render would be meaningless rather than wrong.
  await doc.transform(dequantize());

  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const base = prim.getAttribute('POSITION').getArray();
  const indices = prim.getIndices().getArray();
  const targets = prim.listTargets();
  console.log(`${base.length / 3} verts, ${indices.length / 3} tris, ${targets.length} morphs`);

  const applied = (name, amount) => {
    const p = Float32Array.from(base);
    if (name) {
      const t = targets.find((x) => x.getName() === name);
      if (!t) throw new Error(`no morph target named ${name}`);
      const d = t.getAttribute('POSITION').getArray();
      for (let i = 0; i < p.length; i++) p[i] += d[i] * amount;
    }
    return p;
  };

  // Row 0: neutral from four angles. Rows 1+: each morph at full, in pairs.
  const names = targets.map((t) => t.getName());
  const cols = 4;
  const rows = 1 + Math.ceil(names.length / 2);
  const sheetW = cols * CELL, sheetH = rows * CELL;
  const sheet = new Uint8Array(sheetW * sheetH * 3);

  const neutral = applied(null, 0);
  [0, -0.6, -1.2, -Math.PI / 2].forEach((yaw, i) => {
    blit(sheet, sheetW, render(neutral, indices, yaw, CELL), CELL, i, 0);
  });

  names.forEach((name, i) => {
    const col = (i % 2) * 2;
    const row = 1 + Math.floor(i / 2);
    blit(sheet, sheetW, render(applied(name, 1), indices, 0, CELL), CELL, col, row);
    blit(sheet, sheetW, render(applied(name, 1), indices, -0.7, CELL), CELL, col + 1, row);
    console.log(`  row ${row} col ${col}: ${name}`);
  });

  writeFileSync(out, encodePng(sheetW, sheetH, sheet));
  console.log(`\nWrote ${out} (${sheetW}x${sheetH})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
