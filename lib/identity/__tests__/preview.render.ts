/**
 * Visual dev harness — renders heads to PNG sheets so the procedural geometry
 * can actually be LOOKED AT without a device.
 *
 * This is the tool that caught every real defect in `headMesh.ts`: googly eyes
 * sitting in front of the face, a beard mask that ran down the neck, a hairline
 * that rendered as a rectangular window, and a skull with more forehead than
 * face. None of those are expressible as an assertion — you have to see them.
 *
 * SKIPPED unless `PREVIEW_OUT` is set, so it costs CI nothing:
 *
 *     PREVIEW_OUT=/tmp/preview npx jest lib/identity/__tests__/preview.render.ts
 *
 * Writes angles.png, variety.png, aging.png, body.png, styles.png and
 * features.png to that directory.
 *
 * The last two are recent and both exist because of what the first four could
 * not show. Every one of the original sheets uses one or two hair styles, so a
 * spec table missing twenty-three of them looked exactly like a complete one;
 * and all four frame the whole head, at which scale an eye is twenty pixels and
 * a correct almond is indistinguishable from a googly white ball.
 */
import * as fs from 'fs';
import * as zlib from 'zlib';
import {
  buildFacialHairMesh,
  buildHairMesh,
  buildHeadMesh,
  eyePlacement,
  randomizeFace,
  neutralMorphs,
  normalizeBody,
  SKIN_TONES,
  HAIR_COLORS,
  EYE_COLORS,
  EYE_SHELLS,
  EYE_SEGMENTS,
  HAIR_STYLES,
  type MeshData,
  type FaceGenome,
} from '@/lib/identity';

const W = 320, H = 400;

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.subarray(y * width * 3, (y + 1) * width * 3).forEach((v, i) => {
      raw[y * (width * 3 + 1) + 1 + i] = v;
    });
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
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

interface Draw { mesh: MeshData; color: [number, number, number]; spec: number;
  base?: [number, number, number]; brow?: [number, number, number] }

function sphereMesh(cx: number, cy: number, cz: number, r: number, seg = 20): MeshData {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const phi = (i / seg) * Math.PI;
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      pos.push(cx + r * Math.sin(phi) * Math.sin(th), cy + r * Math.cos(phi), cz + r * Math.sin(phi) * Math.cos(th));
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const positions = new Float32Array(pos), indices = new Uint32Array(idx);
  const normals = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const nx = pos[i] - cx, ny = pos[i + 1] - cy, nz = pos[i + 2] - cz;
    const l = Math.hypot(nx, ny, nz) || 1;
    normals[i] = nx / l; normals[i + 1] = ny / l; normals[i + 2] = nz / l;
  }
  return { positions, normals, indices };
}

/**
 * `zoom` frames a detail instead of the whole head: `{ scale, y }` puts model
 * height `y` in the middle of the cell at `scale` pixels per unit.
 *
 * Added for the eyes. At the sheet's normal 150 px/unit an eye is about twenty
 * pixels across, and at that size a correct almond and a googly white ball are
 * the same handful of light pixels — which is how the eyes stayed wrong through
 * several rounds of looking straight at them.
 */
function render(draws: Draw[], yaw: number, zoom?: { scale: number; y: number }): Uint8Array {
  const img = new Uint8Array(W * H * 3);
  for (let i = 0; i < img.length; i += 3) { img[i] = 22; img[i + 1] = 27; img[i + 2] = 38; }
  const depth = new Float32Array(W * H).fill(-Infinity);

  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const scale = zoom ? zoom.scale : 150;
  const ox = W / 2, oy = zoom ? H / 2 + zoom.y * scale : H / 2 - 20;
  // Key light from upper-front-left, plus fill.
  const L = [-0.45, 0.6, 0.75]; const Ll = Math.hypot(...L as [number, number, number]);
  const lx = L[0] / Ll, ly = L[1] / Ll, lz = L[2] / Ll;

  for (const { mesh, color, spec, base, brow } of draws) {
    const { positions, normals, indices } = mesh;
    for (let t = 0; t < indices.length; t += 3) {
      const p: number[][] = [], n: number[][] = []; const cov: number[] = [];
      const brw: number[] = [];
      for (let k = 0; k < 3; k++) {
        const i = indices[t + k] * 3;
        cov.push(mesh.coverage ? mesh.coverage[indices[t + k]] : 1);
        brw.push(mesh.brow ? mesh.brow[indices[t + k]] : 0);
        const x = positions[i], y = positions[i + 1], z = positions[i + 2];
        const rx = x * cy + z * sy, rz = -x * sy + z * cy;
        p.push([ox + rx * scale, oy - y * scale, rz]);
        const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
        n.push([nx * cy + nz * sy, ny, -nx * sy + nz * cy]);
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
        if (nz < 0) continue;
        depth[di] = z;
        // WRAP DIFFUSE, not plain Lambert. Skin scatters, so its terminator is
        // soft and a crease never reaches black — and the app's renderer lights
        // the head with an environment map, where a crease picks up bounce.
        //
        // Plain Lambert here crushed every concave feature to the 0.26 ambient
        // floor, which made the mouth read as a black gash on every face in
        // every sheet. That was the instrument lying: the seam was chased from
        // 0.042 down to 0.009 before it was clear that the geometry was fine
        // and the lighting model was not.
        const ndotl = nx * lx + ny * ly + nz * lz;
        const diff = Math.max(0, (ndotl + 0.38) / 1.38);
        const rim = Math.pow(1 - Math.max(0, nz), 3) * 0.35;
        const half = [lx, ly, lz + 1];
        const hl = Math.hypot(...half as [number, number, number]);
        const specV = spec * Math.pow(Math.max(0, (nx * half[0] + ny * half[1] + nz * half[2]) / hl), 28);
        const light = 0.26 + diff * 0.82;
        // Blend toward the underlying skin by coverage — this is what turns the
        // stair-stepped hairline into a soft one.
        const a = Math.max(0, Math.min(1, w0 * cov[0] + w1 * cov[1] + w2 * cov[2]));
        // Eyebrows: a tint on the skin, not a mesh of their own.
        const eb = brow ? Math.max(0, Math.min(1, w0 * brw[0] + w1 * brw[1] + w2 * brw[2])) : 0;
        for (let c = 0; c < 3; c++) {
          let src = color[c] * a + (base ? base[c] : color[c]) * (1 - a);
          if (eb > 0 && brow) src = src * (1 - eb) + brow[c] * eb;
          img[di * 3 + c] = Math.min(255, src * light + specV * 255 * a * (1 - eb) + rim * 120);
        }
      }
    }
  }
  return img;
}

/**
 * Eyebrow colour: the hair colour darkened, then floored so it always reads
 * against the skin it sits on.
 */
function browColour(
  hair: [number, number, number], skin: [number, number, number],
): [number, number, number] {
  const lum = (c: [number, number, number]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const out = hair.map((c) => c * 0.62) as [number, number, number];
  const target = lum(skin) * 0.55;
  const have = lum(out);
  if (have > target && have > 1) {
    const k = target / have;
    return [out[0] * k, out[1] * k, out[2] * k];
  }
  return out;
}

function renderFace(g: FaceGenome, age: number, bodyFat: number, yaw: number,
  zoom?: { scale: number; y: number }, muscle = 45): Uint8Array {
  const body = normalizeBody({ bodyFatPct: bodyFat, muscle });
  const head = buildHeadMesh(g, { age, body });
  const hair = buildHairMesh(head, g.hairStyle, age);
  const beard = buildFacialHairMesh(head, g.facialHair, g);
  const eyes = eyePlacement(head, g, age);
  const skin = hexToRgb(SKIN_TONES[g.skinTone]);
  const hairC = hexToRgb(HAIR_COLORS[g.hairColor]);
  const eyeC = hexToRgb(EYE_COLORS[g.eyeColor]);

  // Brows follow the hair colour, darkened — the same rule the scanned head
  // uses. A bald character keeps their brows: eyebrows do not fall out with a
  // shaved head.
  //
  // With a contrast floor against the skin, because hair colour alone is not
  // enough: black hair on the darkest skin tone put the brow within a few units
  // of the face and it disappeared, which is how it first rendered. The floor is
  // loose (72% of skin luminance) so a blond stays faint-browed, as blonds are.
  const browC = browColour(hairC, skin);
  const draws: Draw[] = [{ mesh: head, color: skin, spec: 0.10, brow: browC }];
  for (const e of [eyes.left, eyes.right]) {
    draws.push({ mesh: sphereMesh(e.x, e.y, e.z, e.radius), color: [242, 242, 240], spec: 0.5 });
    draws.push({ mesh: sphereMesh(e.x, e.y, e.z + e.radius * EYE_SHELLS.irisOffset, e.radius * EYE_SHELLS.irisRadius, EYE_SEGMENTS.iris[0]), color: eyeC, spec: 0.6 });
    draws.push({ mesh: sphereMesh(e.x, e.y, e.z + e.radius * EYE_SHELLS.pupilOffset, e.radius * EYE_SHELLS.pupilRadius, EYE_SEGMENTS.pupil[0]), color: [12, 12, 14], spec: 0.7 });
  }
  if (beard) draws.push({ mesh: beard, color: hairC.map((c) => c * 0.55) as [number, number, number], spec: 0.05, base: skin });
  if (hair) draws.push({ mesh: hair, color: hairC, spec: 0.2, base: skin });
  return render(draws, yaw, zoom);
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

(OUT ? it : it.skip)('renders preview sheets', () => {
  fs.mkdirSync(OUT!, { recursive: true });

  // Sheet 1: one face, several angles.
  const hero = { ...randomizeFace('hero-7', { sex: 'male' }), hairStyle: 'short' as const, facialHair: 'stubble' as const };
  const angles = [-0.6, -0.3, 0, 0.3, 0.6].map((a) => renderFace(hero, 30, 20, a));
  let t = tile(angles, 5);
  fs.writeFileSync(`${OUT!}/angles.png`, encodePng(t.w, t.h, t.data));

  // Sheet 2: variety.
  const variety = Array.from({ length: 10 }, (_, i) =>
    renderFace(randomizeFace(`v${i}`, { sex: i % 2 ? 'male' : 'female' }), 28, 20, -0.25));
  t = tile(variety, 5);
  fs.writeFileSync(`${OUT!}/variety.png`, encodePng(t.w, t.h, t.data));

  // Sheet 3: one genome aging.
  const ages = [3, 6, 10, 16, 25, 40, 60, 80].map((a) => renderFace(hero, a, 22, -0.25));
  t = tile(ages, 4);
  fs.writeFileSync(`${OUT!}/aging.png`, encodePng(t.w, t.h, t.data));

  // Sheet 4: body fat + neutral reference.
  const neutral = { ...randomizeFace('neu'), morphs: neutralMorphs(), hairStyle: 'medium' as const, facialHair: 'none' as const };
  // Two rows: body fat across its range, then muscle across its range at a
  // fixed fat. The second row is new — the sheet only ever swept fat, so the
  // muscle path had never been looked at at all.
  const bodies = [
    ...[8, 18, 28, 40, 55].map((f) => renderFace(neutral, 30, f, -0.25)),
    ...[5, 30, 55, 75, 95].map((mu) => renderFace(neutral, 30, 22, -0.25, undefined, mu)),
  ];
  t = tile(bodies, 5);
  fs.writeFileSync(`${OUT!}/body.png`, encodePng(t.w, t.h, t.data));

  // Sheet 5: EVERY hair style, one face.
  //
  // The sheet that was missing, and the reason the fallback shipped with
  // twenty-four styles rendering as the same haircut: the four sheets above all
  // use one or two styles, so a table with twenty-three entries missing looked
  // exactly like a table with none missing. `hairSpec.test.ts` now asserts the
  // table is complete; this shows whether the entries in it do anything.
  const styleFace = { ...randomizeFace('sty-3', { sex: 'male' }), facialHair: 'none' as const };
  const styles = HAIR_STYLES.map((s) => renderFace({ ...styleFace, hairStyle: s }, 28, 20, -0.25));
  t = tile(styles, 6);
  fs.writeFileSync(`${OUT!}/styles.png`, encodePng(t.w, t.h, t.data));

  // Sheet 6: the features, close enough to see. See `render`'s `zoom`.
  //
  // The eye row exists because at the sheets' normal 150 px/unit an eye is
  // about twenty pixels across, and at that size a correct almond and a googly
  // white ball are the same handful of light pixels. The mouth row is here for
  // the same reason.
  const details = [
    ...[-0.5, -0.2, 0.1].map((a) => renderFace(hero, 30, 20, a, { scale: 620, y: 0.13 })),
    ...[-0.5, -0.2, 0.1].map((a) => renderFace(hero, 30, 20, a, { scale: 620, y: -0.36 })),
  ];
  t = tile(details, 3);
  fs.writeFileSync(`${OUT!}/features.png`, encodePng(t.w, t.h, t.data));

  // Sheet 7: EVERY morph at both ends of its range, in pairs.
  //
  // The sheet that was missing. Sweeping the morphs numerically says how far
  // each one moves the mesh, and that number is honest for a whole-head morph
  // and misleading for a local one — a nose morph moves 26 vertices out of
  // 9409, so its mean is indistinguishable from zero however strong it is. And
  // for a morph that TRANSLATES a feature rather than growing it, the furthest
  // vertex barely moves however far the mouth travels. Only looking settles it.
  const morphFace = { ...randomizeFace('morph-2', { sex: 'male' }), morphs: neutralMorphs(), hairStyle: 'short' as const, facialHair: 'none' as const };
  const morphShots: Uint8Array[] = [];
  for (const key of Object.keys(morphFace.morphs).sort()) {
    for (const v of [0, 1]) {
      morphShots.push(renderFace(
        { ...morphFace, morphs: { ...morphFace.morphs, [key]: v } },
        30, 20, -0.18,
      ));
    }
  }
  t = tile(morphShots, 8);
  fs.writeFileSync(`${OUT!}/morphs.png`, encodePng(t.w, t.h, t.data));

  expect(fs.existsSync(`${OUT!}/angles.png`)).toBe(true);
});
