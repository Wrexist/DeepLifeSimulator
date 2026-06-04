#!/usr/bin/env node
/**
 * Route-conflict guard (R9 P1-10).
 *
 * expo-router silently DROPS conflicting routes in a production bundle (the
 * conflict error is dev-only) — it keeps whichever file sorts first by context
 * key and discards the rest. That is exactly how the v2.5.0 launch crash shipped:
 * `app/index.tsx` and `app/(tabs)/index.tsx` both resolved to "/", so production
 * dropped the loader and rendered the game home at launch.
 *
 * This replicates expo-router's route resolution (strip `(group)` segments,
 * map `index` -> parent path) and fails if any resolved route maps to >1 file.
 * Runs in milliseconds; wired into `preflight` and CI so this class of bug can
 * never silently ship again.
 */
const fs = require('fs');
const path = require('path');

const APP = path.join(process.cwd(), 'app');

function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(p));
    else if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function toRoute(relKey) {
  let r = relKey.replace(/\.(tsx|jsx|ts|js)$/, '');
  const isLayout = /(^|\/)_layout$/.test(r);
  // strip group segments like (tabs), (onboarding)
  r = r
    .split('/')
    .filter((seg) => !/^\(.*\)$/.test(seg))
    .join('/');
  // index -> directory route
  r = r.replace(/(^|\/)index$/, '$1').replace(/\/$/, '');
  return { route: '/' + r, isLayout };
}

function main() {
  if (!fs.existsSync(APP)) {
    console.error('[route-conflicts] no app/ directory found');
    process.exit(2);
  }
  const files = walk(APP)
    .map((f) => path.relative(APP, f).split(path.sep).join('/'))
    // entry.ts is `main`, not a route; +not-found / +html are special fallbacks
    .filter((f) => !/(^|\/)entry\.(t|j)sx?$/.test(f))
    .filter((f) => !/\+not-found/.test(f) && !/\+html/.test(f));

  const claims = {};
  for (const f of files.sort()) {
    const { route, isLayout } = toRoute(f);
    if (isLayout) continue; // layouts don't claim leaf routes
    (claims[route] = claims[route] || []).push(f);
  }

  const conflicts = Object.entries(claims).filter(([, fs_]) => fs_.length > 1);
  if (conflicts.length === 0) {
    console.log(`[route-conflicts] OK — ${Object.keys(claims).length} routes, no conflicts`);
    process.exit(0);
  }

  console.error('[route-conflicts] FAIL — multiple files resolve to the same route.');
  console.error('In a production bundle expo-router silently keeps only one and DROPS the rest.\n');
  for (const [route, fs_] of conflicts) {
    console.error(`  route "${route}":`);
    fs_.forEach((f) => console.error(`      - app/${f}`));
  }
  console.error('\nRename or remove files so each route maps to exactly one file.');
  process.exit(1);
}

main();
