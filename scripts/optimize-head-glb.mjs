#!/usr/bin/env node
/**
 * Head GLB optimizer — turns a desktop-grade character export into something a
 * phone can actually ship.
 *
 *   node scripts/optimize-head-glb.mjs in.glb out.glb [--keep morphs.json] [--verts 5000]
 *
 * ## Why this exists
 *
 * A MetaHuman (or MakeHuman, or Character Creator) export is authored for
 * desktop: tens of thousands of vertices, 4K textures, and every blendshape the
 * rig supports. Dropped into the app unchanged it would add tens of megabytes.
 *
 * The mesh is NOT the main cost. **Morph targets are.** A glTF morph target
 * stores a position delta per vertex, so:
 *
 *     45 morphs x 10,000 verts x 3 floats x 4 bytes  =  5.4 MB
 *
 * before a single triangle or texel. That is the number that decides whether
 * this feature is shippable, and it is why this script's most important job is
 * trimming and sparsifying morphs rather than decimating geometry.
 *
 * ## What it does, in order
 *
 *  1. **Trim morphs** to a keep-list. Unused blendshapes are pure bundle cost —
 *     the app drives ~22, and a rig may ship 60+.
 *  2. **Prune + dedupe** orphaned accessors, materials and textures.
 *  3. **Weld** vertices. Exporters split verts aggressively at UV/normal seams;
 *     welding routinely removes 30-50% with no visual change, and every vertex
 *     removed is removed from EVERY morph target too — this is the single
 *     highest-leverage step.
 *  4. **Sparse-encode** morph targets. A jaw morph moves maybe 15% of the head;
 *     a sparse accessor stores only the vertices that actually move.
 *  5. **Quantize** positions/normals/UVs via KHR_mesh_quantization.
 *  6. **Report** before/after, per stage, so a regression is visible.
 *
 * Steps 3-5 are lossless-to-the-eye. Step 1 is a deliberate content decision
 * and is the one to review.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, sparse } from '@gltf-transform/functions';

/**
 * The morphs the app actually drives. Keep in sync with `FACE_MORPH_KEYS`.
 *
 * NOTE for MetaHuman exports: none of these names will match. A MetaHuman ships
 * ARKit-style EXPRESSION blendshapes (jawOpen, mouthSmile, eyeBlinkLeft…), not
 * sculpting morphs — its face SHAPE is baked in at export from the DNA file.
 * The abort guard will fire, which is the tool being correct rather than
 * broken. Run with `--list` to see the rig's real names, and see
 * `docs/character-creator-asset-decision.md` §"Finding 4" for the options.
 */
const DEFAULT_KEEP = [
  'faceWidth', 'faceLength', 'jawWidth', 'jawAngle', 'chinLength', 'chinProtrusion',
  'cheekboneHeight', 'cheekFullness', 'browHeight', 'browProtrusion',
  'eyeSize', 'eyeSpacing', 'eyeDepth', 'eyeTilt',
  'noseLength', 'noseWidth', 'noseBridge', 'noseTip',
  'mouthWidth', 'lipFullness', 'mouthHeight', 'earSize',
  'foreheadSlope', 'neckThickness',
];

function parseArgs(argv) {
  // Positional args are only the ones that are NOT flags. Destructuring
  // `[input, output, ...rest]` blindly made `--list` the output path, so the
  // flag silently never took effect and the tool ran a full optimize instead.
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = argv.filter((a, i) => a.startsWith('--') || (i > 0 && argv[i - 1].startsWith('--') && !a.startsWith('--') && !positional.includes(a)));
  const [input, output] = positional;
  const opts = { input, output, keep: DEFAULT_KEEP, maxVerts: 0, list: false };
  const rest = argv.slice(argv.indexOf(positional[positional.length - 1] ?? argv[0]) + 1);
  void flags;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--keep' && rest[i + 1]) {
      opts.keep = JSON.parse(readFileSync(rest[++i], 'utf8'));
    } else if (rest[i] === '--verts' && rest[i + 1]) {
      opts.maxVerts = Number(rest[++i]);
    } else if (rest[i] === '--list') {
      opts.list = true;
    }
  }
  return opts;
}

const fmt = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * Drop every morph target whose name is not in `keep`.
 *
 * Matching is case- and separator-insensitive because rigs name blendshapes
 * inconsistently (`jawWidth`, `jaw_width`, `Jaw Width`, `head_jawWidth`), and a
 * strict match would silently delete everything and produce a rigid head.
 */
function trimMorphs(document, keep) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = new Set(keep.map(norm));
  let removed = 0;
  let kept = 0;

  for (const mesh of document.getRoot().listMeshes()) {
    const extraNames = mesh.getExtras()?.targetNames || [];
    for (const prim of mesh.listPrimitives()) {
      const targets = prim.listTargets();
      const keepIdx = [];
      targets.forEach((target, i) => {
        // The name lives on the TARGET, not in mesh extras — that is where
        // glTF actually carries it and where Blender/MetaHuman exports put it.
        // Reading only `mesh.extras.targetNames` (the first version of this)
        // found empty strings and deleted every morph on the test asset, which
        // on a real head would have silently produced a rigid face with a
        // convincing-looking 96% "saving" in the report.
        const name = target.getName() || extraNames[i];
        // A target with NO name is kept: an unnamed morph cannot be matched, and
        // deleting it would be guessing. Better a slightly larger file than a
        // silently broken rig.
        if (name === undefined || wanted.has(norm(name))) keepIdx.push(i);
      });
      targets.forEach((target, i) => {
        if (!keepIdx.includes(i)) { prim.removeTarget(target); removed++; }
        else kept++;
      });
      const weights = prim.getExtras()?.targetWeights;
      if (Array.isArray(weights)) {
        prim.setExtras({ ...prim.getExtras(), targetWeights: keepIdx.map((i) => weights[i]) });
      }
    }
    // Rewrite the mirror list in extras so it matches the surviving targets.
    const surviving = mesh.listPrimitives()[0]?.listTargets().map((t) => t.getName()) ?? [];
    if (surviving.length) {
      mesh.setExtras({ ...mesh.getExtras(), targetNames: surviving });
    }
  }
  return { removed, kept };
}

/** Count vertices and morph targets, for the report. */
function stats(document) {
  let verts = 0;
  let targets = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      verts += prim.getAttribute('POSITION')?.getCount() ?? 0;
      targets += prim.listTargets().length;
    }
  }
  return { verts, targets };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.input || (!opts.output && !process.argv.includes('--list'))) {
    console.error('usage: optimize-head-glb.mjs <in.glb> <out.glb> [--keep morphs.json] [--verts N] [--list]');
    process.exit(2);
  }
  if (!existsSync(opts.input)) {
    console.error(`Input not found: ${opts.input}`);
    process.exit(2);
  }

  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
  const document = await io.read(opts.input);

  const beforeBytes = readFileSync(opts.input).byteLength;
  const before = stats(document);
  console.log(`\nIN   ${fmt(beforeBytes)}  ${before.verts} verts  ${before.targets} morph targets`);

  if (opts.list) {
    // Every rig names its blendshapes differently. Discovering the real names is
    // the first thing anyone needs, and guessing them is how you get dead sliders.
    for (const mesh of document.getRoot().listMeshes()) {
      const extraNames = mesh.getExtras()?.targetNames || [];
      const prim = mesh.listPrimitives()[0];
      const names = (prim?.listTargets() ?? []).map((t, i) => t.getName() || extraNames[i] || `(unnamed ${i})`);
      console.log(`\n${mesh.getName() || 'mesh'} — ${names.length} morph targets:`);
      for (const n of names) console.log(`  ${n}`);
    }
    console.log('');
    return;
  }

  const trimmed = trimMorphs(document, opts.keep);
  console.log(`  trim morphs   kept ${trimmed.kept}, removed ${trimmed.removed}`);

  await document.transform(
    dedup(),
    // Weld BEFORE sparse/quantize: every vertex it removes is removed from every
    // morph target too, so doing it first compounds through the rest.
    weld(),
    prune({ keepAttributes: false }),
    quantize({
      pattern: /^(POSITION|NORMAL|TEXCOORD|TANGENT)(_\d+)?$/,
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
    // Sparse morph deltas — the single biggest win on a head, because each morph
    // touches only its own region.
    //
    // Runs LAST, and that ordering is load-bearing: `quantize` rewrites every
    // accessor it touches, so a sparse accessor created before it is silently
    // converted back to dense. The first two attempts had this before quantize
    // and produced zero sparse accessors while the size report still looked
    // healthy — the saving simply was not happening.
    //
    // `ratio` is the non-zero FRACTION below which an accessor converts, so it
    // must sit ABOVE a typical morph's occupancy. Real blendshapes touch 5-30%
    // of a head; 0.66 covers that with margin.
    sparse({ ratio: 0.66 }),
  );

  if (before.targets > 0 && trimmed.kept === 0) {
    console.error(
      '\nABORT: every morph target was removed.\n' +
      '  The keep-list matched nothing, so the output would be a rigid head — and it\n' +
      '  would look like a huge win in the size report, which is why this is a hard\n' +
      '  failure rather than a warning.\n' +
      `  Targets found: ${before.targets}. Run with --list to print their names, then\n` +
      '  pass a --keep file that matches the rig.',
    );
    process.exit(3);
  }

  const after = stats(document);
  const bytes = await io.writeBinary(document);
  writeFileSync(opts.output, bytes);

  console.log(`OUT  ${fmt(bytes.byteLength)}  ${after.verts} verts  ${after.targets} morph targets`);
  const saved = 1 - bytes.byteLength / beforeBytes;
  console.log(`     ${(saved * 100).toFixed(1)}% smaller\n`);

  // A head over ~3 MB will not ship. Fail loudly rather than let it drift in.
  const BUDGET = 3 * 1024 * 1024;
  if (bytes.byteLength > BUDGET) {
    console.error(
      `WARNING: ${fmt(bytes.byteLength)} exceeds the ${fmt(BUDGET)} head budget.\n` +
      `  Try: fewer morphs (--keep), or decimate the mesh in Blender before running this.\n` +
      `  This script does not decimate geometry — collapsing triangles well needs a\n` +
      `  proper decimator, and a bad one destroys the silhouette around the eyes and lips.`,
    );
    process.exitCode = 1;
  }
  if (opts.maxVerts && after.verts > opts.maxVerts) {
    console.error(`WARNING: ${after.verts} verts exceeds --verts ${opts.maxVerts}. Decimate in Blender first.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
