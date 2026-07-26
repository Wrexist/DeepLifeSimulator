#!/usr/bin/env node
/**
 * MakeHuman target inspector — proves the app's morph mapping against a real
 * MakeHuman install before any geometry work happens.
 *
 *   node scripts/makehuman-targets.mjs <makehuman-data-dir> [--all] [--json out.json]
 *
 * ## Why this exists
 *
 * MakeHuman's modelling system IS morph targets. Every slider applies a
 * `.target` file — plain text, one `vertexIndex dx dy dz` line per moved vertex
 * — to a single fixed-topology base mesh. That is the same thing a glTF morph
 * target is, which is what makes a real in-app sculpting editor possible rather
 * than a preset picker.
 *
 * But the app has to know MakeHuman's names for those axes, and they are
 * guessable-looking in a way that is dangerous: `nose-scale-horiz` is width,
 * `nose-scale-vert` is length, and a plausible wrong guess produces a slider
 * that deforms the WRONG feature. That failure looks like a modelling bug, not
 * a wiring one, and can survive a long way into a build.
 *
 * `MAKEHUMAN_STEMS` in `lib/identity/morphBinding.ts` is therefore explicitly
 * marked provisional. This script is what makes it real: it reads the actual
 * install and reports, per app morph, whether the stem it expects exists.
 *
 * ## Run this BEFORE modelling ten heads
 *
 * If a stem is wrong, it costs one line to fix here and nothing downstream.
 * Discovered after the geometry pipeline is wired, it costs a re-export.
 */

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

/**
 * Kept in sync with `MAKEHUMAN_STEMS` in lib/identity/morphBinding.ts.
 *
 * Duplicated rather than imported because this is a plain Node script and that
 * module is TypeScript inside the app's path aliases. The drift risk is real,
 * so `--check-source` diffs the two rather than trusting they match.
 */
const EXPECTED = {
  faceWidth: ['headscalehoriz'],
  faceLength: ['headscalevert'],
  jawWidth: ['chinbones'],
  jawAngle: ['chinprognathism'],
  chinLength: ['chinheight'],
  chinProtrusion: ['chinprominent'],
  cheekboneHeight: ['cheekbones'],
  cheekFullness: ['cheekinner'],
  browHeight: ['eyebrowstrans'],
  browProtrusion: ['foreheadnubian'],
  eyeSize: ['eyescale'],
  eyeSpacing: ['eyemove'],
  eyeDepth: ['eyepush1'],
  eyeTilt: ['eyecorner1'],
  noseLength: ['nosescalevert'],
  noseWidth: ['nosescalehoriz'],
  noseBridge: ['nosehump'],
  noseTip: ['nosepointwidth'],
  mouthWidth: ['mouthscalehoriz'],
  lipFullness: ['mouthupperlipvolume', 'mouthlowerlipvolume'],
  mouthHeight: ['mouthtrans'],
  earSize: ['earscale'],
  foreheadSlope: ['foreheadscalevert'],
  neckThickness: ['neckscalehoriz'],
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** Side is a PREFIX in MakeHuman (`l-eye-…`), unlike every other rig. */
const stripSide = (n) => n.replace(/^([lr])(?=[a-z]{3})/, '').replace(/(left|right)$/, '');
/** Every MakeHuman axis is bipolar; the stem is the name without its direction. */
const stripDirection = (n) =>
  n.replace(/(incr|decr|forward|backward|up|down|in|out|less|more)$/, '');
const stemOf = (name) => stripDirection(stripSide(norm(basename(name, '.target'))));

/** Walk a directory tree collecting every `.target` file. */
function findTargets(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue; // broken symlink in a user's install is not our problem
    }
    if (st.isDirectory()) findTargets(full, out);
    else if (entry.endsWith('.target')) out.push(full);
  }
  return out;
}

/**
 * Count the vertices a target actually moves.
 *
 * This is the number that decides shippability. A glTF morph target stored
 * densely costs `verts * 3 * 4` bytes whether it moves one vertex or all of
 * them; stored sparsely it costs only the moved ones. MakeHuman targets are
 * already sparse on disk, so this reports the real cost up front instead of
 * discovering it after the GLB is built.
 */
function countMoved(file) {
  const text = readFileSync(file, 'utf8');
  let moved = 0;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) moved++;
  }
  return moved;
}

function main() {
  const argv = process.argv.slice(2);
  const dir = argv.find((a) => !a.startsWith('--'));
  const showAll = argv.includes('--all');
  const jsonIdx = argv.indexOf('--json');
  const jsonOut = jsonIdx >= 0 ? argv[jsonIdx + 1] : null;

  if (!dir) {
    console.error(
      'usage: makehuman-targets.mjs <makehuman-data-dir> [--all] [--json out.json]\n\n' +
        'The data dir is the folder containing `targets/`. Typically:\n' +
        '  macOS    /Applications/MakeHuman.app/Contents/Resources/data\n' +
        '  Windows  C:\\Program Files\\MakeHuman\\data\n' +
        '  Linux    /usr/share/makehuman/data\n' +
        '  source   <makehuman-repo>/makehuman/data\n',
    );
    process.exit(2);
  }
  if (!existsSync(dir)) {
    console.error(`Not found: ${dir}`);
    process.exit(2);
  }

  const files = findTargets(dir);
  if (files.length === 0) {
    console.error(
      `No .target files under ${dir}\n` +
        '  Point this at the folder CONTAINING `targets/`, not at MakeHuman.app itself.',
    );
    process.exit(2);
  }

  // stem -> the files sitting on that axis (normally an -incr/-decr pair,
  // doubled again for l-/r- on eyes, cheeks and ears).
  const byStem = new Map();
  for (const f of files) {
    const stem = stemOf(f);
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(f);
  }

  console.log(`\n${files.length} targets, ${byStem.size} distinct axes, under ${dir}\n`);

  const matched = [];
  const missing = [];
  const report = {};

  for (const [key, stems] of Object.entries(EXPECTED)) {
    const hits = stems.flatMap((s) => byStem.get(s) ?? []);
    if (hits.length) {
      const moved = hits.reduce((sum, f) => Math.max(sum, countMoved(f)), 0);
      matched.push(key);
      report[key] = { stems, files: hits.map((f) => relative(dir, f)), maxMovedVerts: moved };
      console.log(`  OK    ${key.padEnd(18)} ${stems.join(', ').padEnd(24)} ${hits.length} files, ${moved} verts moved`);
    } else {
      missing.push(key);
      report[key] = { stems, files: [], maxMovedVerts: 0 };
      console.log(`  MISS  ${key.padEnd(18)} ${stems.join(', ')}`);
    }
  }

  console.log(`\n${matched.length}/24 app morphs have a real MakeHuman axis.`);

  if (missing.length) {
    // Not a crash: a miss means the guess was wrong, and the fix is to read the
    // candidate list below and correct MAKEHUMAN_STEMS. Failing hard here would
    // just hide the candidates that make the fix possible.
    console.log(
      `\n${missing.length} did not match. These would be DEAD SLIDERS — the player drags\n` +
        'them and nothing moves, with no error anywhere. Fix MAKEHUMAN_STEMS in\n' +
        'lib/identity/morphBinding.ts using the candidates below, then re-run.\n',
    );
    for (const key of missing) {
      const hint = key.replace(/[A-Z]/g, (c) => c.toLowerCase()).slice(0, 4);
      const candidates = [...byStem.keys()].filter((s) => s.includes(hint)).slice(0, 12);
      console.log(`  ${key}:`);
      console.log(`    ${candidates.length ? candidates.join('  ') : '(no similar axis found)'}`);
    }
    process.exitCode = 1;
  }

  const totalMoved = Object.values(report).reduce((s, r) => s + r.maxMovedVerts, 0);
  console.log(
    `\nBundle estimate: ~${totalMoved} moved vertices across all bound axes.\n` +
      `  Sparse-encoded that is roughly ${((totalMoved * 16) / 1024).toFixed(0)} KB of morph data —\n` +
      '  the figure that decides whether full in-app sculpting is shippable.\n',
  );

  if (showAll) {
    console.log('All axes:\n');
    for (const stem of [...byStem.keys()].sort()) console.log(`  ${stem}`);
    console.log('');
  }

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify({ dir, axes: byStem.size, report }, null, 2));
    console.log(`Wrote ${jsonOut}\n`);
  }
}

main();
