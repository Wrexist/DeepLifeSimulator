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

  // ── Group-anchor guard (R10) ───────────────────────────────────────────────
  // The SECOND launch-crash cause: a route group with neither an `index` route
  // NOR `unstable_settings.initialRouteName` resolves its navigator's initial
  // screen to `undefined`, crashing production-only with "Element type is
  // invalid: …got: undefined" (getRoutesCore.js group-anchor resolution). The
  // (onboarding) group shipped exactly this for ~20 builds. Assert every group
  // directory that has a `_layout` either contains an index route or its layout
  // exports an `initialRouteName` anchor.
  const missingAnchors = [];
  function checkGroups(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(dir, entry.name);
      if (/^\(.*\)$/.test(entry.name)) {
        const names = fs.readdirSync(child);
        const layout = names.find((n) => /^_layout\.(tsx|jsx|ts|js)$/.test(n));
        if (layout) {
          const hasIndex = names.some((n) => /^index\.(tsx|jsx|ts|js)$/.test(n));
          const src = fs.readFileSync(path.join(child, layout), 'utf8');
          const hasAnchor = /unstable_settings\s*=\s*{[^}]*initialRouteName/s.test(src);
          if (!hasIndex && !hasAnchor) {
            missingAnchors.push(path.relative(APP, child).split(path.sep).join('/'));
          }
        }
      }
      checkGroups(child);
    }
  }
  checkGroups(APP);

  let failed = false;
  if (conflicts.length > 0) {
    failed = true;
    console.error('[route-conflicts] FAIL — multiple files resolve to the same route.');
    console.error('In a production bundle expo-router silently keeps only one and DROPS the rest.\n');
    for (const [route, fs_] of conflicts) {
      console.error(`  route "${route}":`);
      fs_.forEach((f) => console.error(`      - app/${f}`));
    }
    console.error('\nRename or remove files so each route maps to exactly one file.\n');
  }
  if (missingAnchors.length > 0) {
    failed = true;
    console.error('[route-conflicts] FAIL — route group(s) have no initial-screen anchor.');
    console.error('A group with no index route AND no `unstable_settings.initialRouteName`');
    console.error('resolves its initial screen to undefined and crashes production-only.\n');
    missingAnchors.forEach((g) => console.error(`      - app/${g}`));
    console.error("\nAdd an index route OR `export const unstable_settings = { initialRouteName: '<screen>' };` to its _layout.\n");
  }

  if (failed) process.exit(1);
  console.log(
    `[route-conflicts] OK — ${Object.keys(claims).length} routes, no conflicts, all groups anchored`
  );
  process.exit(0);
}

main();
