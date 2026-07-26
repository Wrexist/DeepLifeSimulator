#!/usr/bin/env node
/**
 * ICT-FaceKit -> a shippable head GLB with SEMANTIC morph targets.
 *
 *   node scripts/build-ict-head.mjs <ICT-FaceKit-dir> [out.glb] [--report-only]
 *
 * ## The problem this solves
 *
 * ICT-FaceKit gives us 100 identity shape modes derived from Light Stage scans
 * of real people. That basis is exactly what makes output read as a person
 * rather than a game character: any face inside it is a face that a real skull
 * could produce.
 *
 * But the modes are STATISTICAL, not semantic. `identity017` is a principal
 * component — a correlated smear of jaw, brow and cheek change — not "jaw
 * width". The app's 24 sliders are semantic. Wiring a slider straight to a mode
 * would move six features at once and feel broken.
 *
 * ## How the semantic axes are derived
 *
 * ICT ships 68 facial landmarks (`idx_to_landmark_verts`). Each app morph is
 * defined as a MEASUREMENT over those landmarks — `jawWidth` is the distance
 * between the two jaw-contour points, `noseLength` is bridge-to-base, and so on.
 * Then, for each mode, we measure how much it moves each measurement. That
 * gives a matrix M where `M[j][i]` is the change in measurement j per unit of
 * mode i.
 *
 * Finding the coefficients for one semantic axis is then: solve `M c = e_j` —
 * change measurement j by one unit and every other measurement by zero. There
 * are 100 modes and only ~24 measurements, so the system is underdetermined and
 * has infinitely many solutions. We take the MINIMUM-NORM one:
 *
 *     c = M^T (M M^T + lambda I)^-1 e_j
 *
 * Minimum-norm matters for more than tidiness: among all coefficient vectors
 * that widen the jaw, it picks the one that strays least from the mean face. A
 * larger-norm solution would widen the jaw just as well while wandering to an
 * improbable corner of the space — technically on the manifold, visibly odd.
 *
 * The result per axis is a single baked morph target, so the app drives 24
 * named morphs exactly as it does for any other rig. No runtime linear algebra,
 * no basis shipped, no change to `morphBinding.ts`.
 *
 * ## Verification
 *
 * Derivation like this fails quietly — a wrong sign or a bad landmark index
 * produces a morph that deforms *something*, plausibly, in the wrong place. So
 * the script re-measures each derived morph and reports:
 *
 *   - ON-AXIS  : how far the intended measurement moved, in units of its own
 *                spread across the basis. Bigger is a more effective slider.
 *                It is NOT expected to be 1.0 — each morph is renormalised to a
 *                fixed maximum vertex displacement afterwards, so that every
 *                slider has comparable visual travel.
 *   - CROSS    : the largest unintended measurement change, as a ratio of
 *                on-axis. 0 means the slider moves only its own feature; above
 *                1 means it moves something else more than its own.
 *
 * A high CROSS means the slider drags other features with it. That is visible
 * in the report instead of being discovered on a face later.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO, Document } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, sparse, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

/**
 * Materials worth shipping.
 *
 * Teeth, gums and tongue are ~7,400 vertices that a closed-mouth portrait never
 * shows — the single largest cheap saving in the file. Eyelashes are dropped
 * because at portrait size they read as noise rather than lashes, and the app
 * renders its own. Eyes ARE kept: real sclera and iris geometry is the biggest
 * perceptual win available in a face render.
 */
const KEEP_MATERIALS = new Set([
  'M_Face',
  'M_BackHead',
  'M_ScleraLeft',
  'M_IrisLeft',
  'M_ScleraRight',
  'M_IrisRight',
  'M_LacrimalFluid',
  'M_EyeBlend',
]);

/**
 * Each app morph as a measurement over the 68-point landmark set.
 *
 * Indices follow the standard iBUG 68 layout that ICT uses:
 *   0-16 jaw contour (8 = chin)   17-26 brows        27-35 nose
 *   36-47 eyes                    48-67 mouth
 *
 * `axis` picks the component compared: 'x' is left-right (widths), 'y' is
 * up-down (heights), 'z' is depth. Using a signed component rather than
 * distance matters — distance is always positive, so it cannot tell "wider"
 * from "narrower" and the derived morph would have an arbitrary sign.
 *
 * `ratio` compares two spans instead of one, for axes that are about SHAPE
 * rather than size. A jaw angle is "how much narrower is the jaw at the chin
 * than at the ear", which a single width cannot express: measured as a plain
 * width it is nearly collinear with `jawWidth`, and the solve then has to split
 * two near-identical measurements, leaving both weak and noisy.
 */
// The two overall size spans every other measurement is expressed relative to.
const FACE_H = { a: 27, b: 8, axis: 'y' };
const FACE_W = { a: 0, b: 16, axis: 'x' };

const MEASURES = {
  // Absolute size…
  faceWidth: FACE_W,
  faceLength: FACE_H,
  // …everything else is a PROPORTION of it.
  //
  // This is not cosmetic. `faceLength` spans bridge-to-chin, and nose length,
  // mouth height, lip fullness and chin length are its sub-segments — so
  // lengthening the face must lengthen the sum of its parts. Measured
  // absolutely they cross-talk with `faceLength` by arithmetic necessity (0.29
  // to 0.62 in the first run), and no amount of solving separates them. As
  // ratios they measure what the slider is actually named for: a longer nose
  // means a nose that takes up more of the face, not a bigger head.
  jawWidth: { a: 4, b: 12, axis: 'x', over: FACE_W },
  jawAngle: { a: 6, b: 10, axis: 'x', over: { a: 2, b: 14, axis: 'x' } },
  chinLength: { a: 57, b: 8, axis: 'y', over: FACE_H },
  chinProtrusion: { a: 8, b: 27, axis: 'z' },
  cheekboneHeight: { a: 1, b: 15, axis: 'y' },
  cheekFullness: { a: 2, b: 14, axis: 'x', over: FACE_W },
  browHeight: { a: 19, b: 37, axis: 'y' },
  browProtrusion: { a: 19, b: 27, axis: 'z' },
  eyeSize: { a: 37, b: 41, axis: 'y' },
  eyeSpacing: { a: 39, b: 42, axis: 'x', over: FACE_W },
  eyeDepth: { a: 39, b: 27, axis: 'z' },
  eyeTilt: { a: 36, b: 39, axis: 'y' },
  noseLength: { a: 27, b: 33, axis: 'y', over: FACE_H },
  noseWidth: { a: 31, b: 35, axis: 'x', over: FACE_W },
  noseBridge: { a: 28, b: 27, axis: 'z' },
  noseTip: { a: 30, b: 33, axis: 'z' },
  mouthWidth: { a: 48, b: 54, axis: 'x', over: FACE_W },
  // ACCEPTED COUPLING, measured rather than assumed.
  //
  // Nose length, mouth height, lip fullness and chin length are consecutive
  // segments of the same bridge-to-chin span, so as fractions of it they sum to
  // a constant — four quantities with three degrees of freedom. They cannot be
  // made independent however the solve is posed, and their ~0.2-0.7 cross-talk
  // is that constraint, not a defect.
  //
  // Referencing lip thickness to MOUTH WIDTH instead was tried to break the
  // chain. It made things much worse: lipFullness and mouthWidth then share
  // terms, which pushed the shared Gram matrix toward singular, and since every
  // axis is solved through that same inverse, six unrelated axes collapsed to
  // near-zero on-axis strength (faceWidth 0.120 -> 0.007). Reverted.
  lipFullness: { a: 51, b: 57, axis: 'y', over: FACE_H },
  mouthHeight: { a: 51, b: 33, axis: 'y', over: FACE_H },
};

/**
 * App morphs the 68-point landmark set CANNOT express.
 *
 * The iBUG 68 layout covers jaw contour, brows, nose, eyes and mouth. It has no
 * ear points, no neck points, and nothing above the brow line. Deriving these
 * three from the nearest available landmarks — jaw-contour points standing in
 * for ears and neck — produced axes that scored respectably in the report while
 * measuring the wrong feature entirely: a slider that moves *something*,
 * plausibly, in the wrong place. That is worse than no slider, because it looks
 * like a modelling bug rather than a missing feature.
 *
 * They are reported as underivable and left out of the GLB. `bindGenomeToRig`
 * returns them in `unbound` and `FaceStudio` already hides slider groups whose
 * morphs are all unbound, so the player sees a smaller, honest control set
 * rather than three controls that lie.
 *
 * Deriving them properly needs region-based measurement (identify the ear/neck
 * vertex sets on the mesh and measure their extent) rather than landmarks.
 * That is a real follow-up, not a blocker.
 */
const NOT_DERIVABLE = {
  earSize: 'no ear landmarks in the 68-point set',
  neckThickness: 'no neck landmarks in the 68-point set',
  foreheadSlope: 'no landmarks above the brow line',
};

const AXIS_INDEX = { x: 0, y: 1, z: 2 };

/** Parse only the `v` lines of an OBJ. Identity modes need nothing else. */
function readPositions(file) {
  const text = readFileSync(file, 'utf8');
  const out = [];
  let i = 0;
  while (i < text.length) {
    let end = text.indexOf('\n', i);
    if (end < 0) end = text.length;
    if (text[i] === 'v' && text[i + 1] === ' ') {
      const parts = text.slice(i + 2, end).trim().split(/\s+/);
      out.push(+parts[0], +parts[1], +parts[2]);
    }
    i = end + 1;
  }
  return new Float32Array(out);
}

/** Full parse of the neutral mesh: positions, UVs and faces grouped by material. */
function readMesh(file) {
  const positions = [];
  const uvs = [];
  const faces = []; // { material, v: [...], vt: [...] }
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
      const v = [];
      const vt = [];
      for (const t of toks) {
        const [vi, vti] = t.split('/');
        v.push(parseInt(vi, 10) - 1);
        vt.push(vti ? parseInt(vti, 10) - 1 : -1);
      }
      // Fan-triangulate. ICT is quad-dominant, and glTF is triangles only.
      for (let k = 1; k + 1 < v.length; k++) {
        faces.push({ material, v: [v[0], v[k], v[k + 1]], vt: [vt[0], vt[k], vt[k + 1]] });
      }
    }
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), faces };
}

/** Landmark measurement on a position array. */
function measure(positions, landmarks, spec) {
  const span = (s) => {
    const k = AXIS_INDEX[s.axis];
    return positions[landmarks[s.a] * 3 + k] - positions[landmarks[s.b] * 3 + k];
  };
  const value = span(spec);
  if (!spec.over) return value;
  const denom = span(spec.over);
  // Shape ratios only: guard the degenerate case rather than emitting Infinity,
  // which would poison the whole sensitivity matrix and every derived axis.
  return Math.abs(denom) < 1e-9 ? 0 : value / denom;
}

/**
 * Solve `(A + lambda I) x = b` by Gaussian elimination with partial pivoting.
 *
 * A is the small (numMeasures x numMeasures) Gram matrix, not the 100x100 one —
 * see the minimum-norm formulation in the header. Partial pivoting is not
 * optional here: the Gram matrix of correlated facial measurements is
 * ill-conditioned, and without pivoting the elimination divides by a near-zero
 * and silently returns garbage coefficients.
 */
function solve(A, b, lambda) {
  const n = b.length;
  const m = A.map((row, i) => [...row.map((v, j) => v + (i === j ? lambda : 0)), b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) continue; // singular direction: leave at 0
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

async function main() {
  const argv = process.argv.slice(2);
  const root = argv.find((a) => !a.startsWith('--'));
  const out = argv.filter((a) => !a.startsWith('--'))[1] ?? 'assets/models/head_ict.glb';
  const reportOnly = argv.includes('--report-only');

  if (!root) {
    console.error('usage: build-ict-head.mjs <ICT-FaceKit-dir> [out.glb] [--report-only]');
    process.exit(2);
  }
  const modelDir = join(root, 'FaceXModel');
  if (!existsSync(join(modelDir, 'generic_neutral_mesh.obj'))) {
    console.error(`No generic_neutral_mesh.obj under ${modelDir}`);
    process.exit(2);
  }

  console.log('\nReading neutral mesh…');
  const neutral = readMesh(join(modelDir, 'generic_neutral_mesh.obj'));
  const vertCount = neutral.positions.length / 3;
  const indices = JSON.parse(readFileSync(join(modelDir, 'vertex_indices.json'), 'utf8'));
  const landmarks = indices.idx_to_landmark_verts;
  console.log(`  ${vertCount} verts, ${neutral.faces.length} triangles, ${landmarks.length} landmarks`);

  // ---- identity modes -----------------------------------------------------
  const modeFiles = [];
  for (let i = 0; i < 200; i++) {
    const f = join(modelDir, `identity${String(i).padStart(3, '0')}.obj`);
    if (existsSync(f)) modeFiles.push(f);
  }
  console.log(`\nReading ${modeFiles.length} identity modes…`);
  const modes = modeFiles.map((f, i) => {
    if (i % 20 === 0 && i) process.stdout.write(`  ${i}…\n`);
    return readPositions(f);
  });

  // ---- measurement sensitivity matrix ------------------------------------
  const keys = Object.keys(MEASURES);
  const base = keys.map((k) => measure(neutral.positions, landmarks, MEASURES[k]));
  // M[j][i] = change in measurement j per unit of mode i.
  const M = keys.map(() => new Array(modes.length).fill(0));
  for (let i = 0; i < modes.length; i++) {
    for (let j = 0; j < keys.length; j++) {
      M[j][i] = measure(modes[i], landmarks, MEASURES[keys[j]]) - base[j];
    }
  }
  // Scale each measurement to unit std across modes, so the solve is not
  // dominated by whichever measurement happens to be in the largest units.
  const scale = M.map((row) => {
    const mean = row.reduce((s, v) => s + v, 0) / row.length;
    const varr = row.reduce((s, v) => s + (v - mean) ** 2, 0) / row.length;
    return Math.sqrt(varr) || 1;
  });
  for (let j = 0; j < keys.length; j++) for (let i = 0; i < modes.length; i++) M[j][i] /= scale[j];

  // Gram matrix M M^T — (numMeasures x numMeasures), tiny.
  const G = keys.map((_, j1) =>
    keys.map((_, j2) => {
      let s = 0;
      for (let i = 0; i < modes.length; i++) s += M[j1][i] * M[j2][i];
      return s;
    }),
  );

  console.log('\nDeriving semantic axes from the identity basis:\n');
  console.log('  morph              on-axis   max cross   worst offender');
  console.log('  ' + '-'.repeat(62));

  const derived = {};
  let worstCross = 0;
  for (let j = 0; j < keys.length; j++) {
    const e = keys.map((_, k) => (k === j ? 1 : 0));
    const y = solve(G, e, 1e-3); // ridge term keeps ill-conditioned axes stable
    // c = M^T y  — minimum-norm coefficients over the 100 modes.
    const c = new Array(modes.length).fill(0);
    for (let i = 0; i < modes.length; i++) {
      let s = 0;
      for (let k = 0; k < keys.length; k++) s += M[k][i] * y[k];
      c[i] = s;
    }

    // Bake: delta = sum_i c_i * (mode_i - neutral)
    const delta = new Float32Array(neutral.positions.length);
    for (let i = 0; i < modes.length; i++) {
      const ci = c[i];
      if (Math.abs(ci) < 1e-6) continue;
      const mi = modes[i];
      for (let v = 0; v < delta.length; v++) delta[v] += ci * (mi[v] - neutral.positions[v]);
    }

    // Normalise so a full slider moves the face a sensible amount rather than
    // whatever the raw solve happened to produce.
    let maxDisp = 0;
    for (let v = 0; v < delta.length; v += 3) {
      maxDisp = Math.max(maxDisp, Math.hypot(delta[v], delta[v + 1], delta[v + 2]));
    }
    const TARGET_DISP = 0.012; // metres at full influence
    const norm = maxDisp > 1e-9 ? TARGET_DISP / maxDisp : 0;
    for (let v = 0; v < delta.length; v++) delta[v] *= norm;

    // Verify by re-measuring the deformed mesh.
    const moved = new Float32Array(neutral.positions.length);
    for (let v = 0; v < moved.length; v++) moved[v] = neutral.positions[v] + delta[v];
    const onAxis = (measure(moved, landmarks, MEASURES[keys[j]]) - base[j]) / scale[j];
    let cross = 0;
    let offender = '-';
    for (let k = 0; k < keys.length; k++) {
      if (k === j) continue;
      const d = Math.abs((measure(moved, landmarks, MEASURES[keys[k]]) - base[k]) / scale[k]);
      if (d > cross) { cross = d; offender = keys[k]; }
    }
    const ratio = Math.abs(onAxis) > 1e-9 ? cross / Math.abs(onAxis) : Infinity;
    worstCross = Math.max(worstCross, ratio);
    console.log(
      `  ${keys[j].padEnd(18)} ${onAxis.toFixed(4).padStart(8)}   ${ratio.toFixed(3).padStart(8)}   ${offender}`,
    );
    derived[keys[j]] = delta;
  }

  console.log(
    `\n  Worst cross-talk ratio: ${worstCross.toFixed(3)}\n` +
      '  (0 = a slider moves only its own feature; >1 = it moves something else more.)\n',
  );

  console.log(`  Not derivable from landmarks (${Object.keys(NOT_DERIVABLE).length}) — omitted, so`);
  console.log('  bindGenomeToRig reports them unbound and the UI hides them:');
  for (const [k, why] of Object.entries(NOT_DERIVABLE)) console.log(`    ${k.padEnd(16)} ${why}`);
  console.log('');

  if (reportOnly) return;

  // ---- build the GLB ------------------------------------------------------
  console.log('Building GLB…');
  const kept = neutral.faces.filter((f) => KEEP_MATERIALS.has(f.material));
  const remap = new Map();
  const pos = [];
  const uv = [];
  const idx = [];
  for (const f of kept) {
    for (let k = 0; k < 3; k++) {
      const key = `${f.v[k]}/${f.vt[k]}`;
      let n = remap.get(key);
      if (n === undefined) {
        n = pos.length / 3;
        remap.set(key, n);
        pos.push(
          neutral.positions[f.v[k] * 3],
          neutral.positions[f.v[k] * 3 + 1],
          neutral.positions[f.v[k] * 3 + 2],
        );
        uv.push(f.vt[k] >= 0 ? neutral.uvs[f.vt[k] * 2] : 0, f.vt[k] >= 0 ? 1 - neutral.uvs[f.vt[k] * 2 + 1] : 0);
      }
      idx.push(n);
    }
  }
  // Source vertex per output vertex, so morph deltas follow the same remap.
  const sourceOf = new Array(pos.length / 3);
  for (const [key, n] of remap) sourceOf[n] = parseInt(key.split('/')[0], 10);
  console.log(`  kept ${kept.length} triangles, ${pos.length / 3} verts (from ${vertCount})`);

  const doc = new Document();
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const buf = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf))
    .setMaterial(doc.createMaterial('head').setRoughnessFactor(0.65).setMetallicFactor(0));

  for (const [name, delta] of Object.entries(derived)) {
    const arr = new Float32Array(pos.length);
    for (let n = 0; n < sourceOf.length; n++) {
      const s = sourceOf[n] * 3;
      arr[n * 3] = delta[s];
      arr[n * 3 + 1] = delta[s + 1];
      arr[n * 3 + 2] = delta[s + 2];
    }
    const target = doc.createPrimitiveTarget(name)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(arr).setBuffer(buf));
    prim.addTarget(target);
  }

  const mesh = doc.createMesh('head').addPrimitive(prim);
  mesh.setExtras({ targetNames: Object.keys(derived) });
  const node = doc.createNode('head').setMesh(mesh);
  doc.createScene('scene').addChild(node);

  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
  const rawBytes = await io.writeBinary(doc);
  console.log(`  raw: ${(rawBytes.byteLength / 1024 / 1024).toFixed(2)} MB`);

  await MeshoptSimplifier.ready;
  await doc.transform(
    dedup(),
    weld(),
    // Decimate. Morph targets are per-vertex, so every vertex removed is removed
    // from all 24 targets too — this is the highest-leverage step by far.
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.002, lockBorder: true }),
    prune({ keepAttributes: false }),
    quantize({ quantizePosition: 14, quantizeTexcoord: 12 }),
    // Sparse LAST: quantize rewrites accessors and would convert sparse back to
    // dense, silently losing the saving while the size report still looked fine.
    //
    // 0.66 despite gltf-transform warning that these accessors are >50%
    // non-zero. PCA-derived morphs are global — nearly every vertex moves — so
    // the warning is correct in principle, but measured both ways: 0.66 gives
    // 0.98 MB and 0.15 gives 1.20 MB. Kept the measured winner.
    sparse({ ratio: 0.66 }),
  );

  const bytes = await io.writeBinary(doc);
  writeFileSync(out, bytes);

  let finalVerts = 0;
  let finalTargets = 0;
  for (const m of doc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) {
      finalVerts += p.getAttribute('POSITION')?.getCount() ?? 0;
      finalTargets += p.listTargets().length;
    }
  }
  console.log(`\nOUT  ${out}`);
  console.log(`     ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB, ${finalVerts} verts, ${finalTargets} morph targets\n`);

  if (finalTargets === 0) {
    console.error('ABORT: no morph targets survived — the head would be rigid.');
    process.exit(3);
  }
  const BUDGET = 3 * 1024 * 1024;
  if (bytes.byteLength > BUDGET) {
    console.error(`WARNING: exceeds the ${BUDGET / 1024 / 1024} MB head budget. Lower --ratio.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
