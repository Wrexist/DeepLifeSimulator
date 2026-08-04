'use strict';
/**
 * How much image payload actually ships, and whether it fits the store.
 *
 * ── Why this check exists ─────────────────────────────────────────────────
 *
 * `assets/` held 307 MB across 291 images — 278 PNG, exactly one WebP. A
 * production `expo export` was measured on 2026-08-04 and carried 234 MB of that
 * into the bundle across 258 assets, averaging ~0.9 MB each.
 *
 * Google Play's base AAB limit is 200 MB. So a release build was already over a
 * hard distribution limit, and NOTHING in the ten-section preflight looked at it:
 * types, lint, bundling, ad SDK config, privacy manifest, purpose strings, IAP,
 * save signing and ad unit ids were all checked, but not the one number that
 * decides whether the app can be shipped at all.
 *
 * ── What it measures, and why not just `du assets/` ───────────────────────
 *
 * Metro bundles only assets reachable through a static `require()`. Unreferenced
 * files in `assets/` cost repo size and clone time but never reach the binary —
 * a fact worth stating plainly, because "we have 307 MB of art" and "we ship
 * 307 MB of art" are different problems with different fixes, and conflating
 * them sends you off deleting files that were never the issue.
 *
 * So this walks the SOURCE for `require('@/assets/…')` and sums those files.
 * That is fast (no export), deterministic, and tracks what Metro does, because
 * React Native cannot resolve a dynamic asset path — every shipped image has to
 * appear as a literal somewhere.
 */
const fs = require('fs');
const path = require('path');

/** Google Play's base AAB ceiling. The hard one. */
const PLAY_BASE_AAB_LIMIT_MB = 200;

/**
 * Ratchet ceiling, set just above the 234.0 MB measured on 2026-08-04.
 *
 * NOT a target — a brake. The app is ALREADY over the Play limit, and a gate set
 * to the number we wish were true would fail on day one and block every build,
 * which is precisely the corrosive shape `coverageRatchet.js` documents: a gate
 * that cannot pass trains you to skim the failure. So the enforceable rule is
 * "this must not grow", and the breach is reported separately and loudly.
 *
 * Lower it in the commit that earns it. Never raise it to get a build unstuck.
 */
const ASSET_BUDGET_MB = 240;

/**
 * Estimated saving from re-encoding the PNGs as WebP at q85, which is the actual
 * fix here — 230 of the 234 shipped MB are PNG, most of it photographic art that
 * has no business being lossless. Typical ratio on that material is 5-15x, so
 * ~234 MB becomes roughly 20-45 MB and the Play limit stops being close.
 *
 * Not done in code: it needs an encoder (`cwebp`/`sharp`) that is not a
 * dependency of this repo, and re-encoding 238 pieces of commissioned art is a
 * visual-quality decision for the owner, not a refactor.
 */
const WEBP_CONVERSION_NOTE =
  'Re-encode assets/images/**.png to WebP q85 (~5-15x smaller on photographic art).';

/** Extensions Metro treats as image assets. */
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

const SOURCE_EXT = /\.(tsx?|jsx?)$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'assets', 'coverage', 'android', 'ios']);

function walk(dir, match, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, match, acc);
    } else if (match.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Every asset path statically required from source.
 * @param {string} root repo root
 * @returns {Set<string>} repo-relative asset paths
 */
function referencedAssets(root) {
  const found = new Set();
  // Matches require('@/assets/...') and require('../../assets/...').
  const pattern = /require\(\s*['"]([^'"]*assets\/[^'"]+)['"]\s*\)/g;
  for (const file of walk(root, SOURCE_EXT)) {
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const match of source.matchAll(pattern)) {
      const raw = match[1];
      if (!IMAGE_EXT.test(raw)) continue;
      const rel = raw.startsWith('@/')
        ? raw.slice(2)
        : path.relative(root, path.resolve(path.dirname(file), raw));
      found.add(rel);
    }
  }
  return found;
}

/**
 * @param {string} root repo root
 * @returns {{shippedBytes: number, shippedCount: number, onDiskBytes: number,
 *            onDiskCount: number, unreferenced: string[], byFormat: Record<string, number>,
 *            largest: {file: string, bytes: number}[]}}
 */
function measureAssets(root) {
  const referenced = referencedAssets(root);
  const onDisk = walk(path.join(root, 'assets'), IMAGE_EXT).map((f) => path.relative(root, f));

  let shippedBytes = 0;
  let onDiskBytes = 0;
  const byFormat = {};
  const sizes = [];
  const unreferenced = [];

  for (const rel of onDisk) {
    let bytes = 0;
    try {
      bytes = fs.statSync(path.join(root, rel)).size;
    } catch {
      continue;
    }
    onDiskBytes += bytes;
    if (referenced.has(rel)) {
      shippedBytes += bytes;
      const ext = path.extname(rel).slice(1).toLowerCase();
      byFormat[ext] = (byFormat[ext] || 0) + bytes;
      sizes.push({ file: rel, bytes });
    } else {
      unreferenced.push(rel);
    }
  }

  sizes.sort((a, b) => b.bytes - a.bytes);

  return {
    shippedBytes,
    shippedCount: sizes.length,
    onDiskBytes,
    onDiskCount: onDisk.length,
    unreferenced,
    byFormat,
    largest: sizes.slice(0, 10),
  };
}

const toMB = (bytes) => bytes / (1024 * 1024);

/**
 * @param {ReturnType<typeof measureAssets>} measurement
 * @returns {{ok: boolean, overBudget: boolean, overPlayLimit: boolean, message: string}}
 */
function evaluateAssetBudget(measurement, platform) {
  const mb = toMB(measurement.shippedBytes);
  const overPlayLimit = mb > PLAY_BASE_AAB_LIMIT_MB;
  const overBudget = mb > ASSET_BUDGET_MB;
  // Over the Play limit is a genuine distribution blocker, so it FAILS an
  // Android build rather than warning. On iOS the same number is a conversion
  // problem, not a wall, so it is reported and ratcheted instead of blocking.
  const blocksThisPlatform = overPlayLimit && String(platform).toLowerCase() === 'android';
  return {
    ok: !overBudget && !blocksThisPlatform,
    overBudget,
    overPlayLimit,
    blocksThisPlatform,
    fix: WEBP_CONVERSION_NOTE,
    message: `${mb.toFixed(1)} MB of images ship (ratchet ${ASSET_BUDGET_MB} MB, Play base-AAB limit ${PLAY_BASE_AAB_LIMIT_MB} MB)`,
  };
}

module.exports = {
  ASSET_BUDGET_MB,
  WEBP_CONVERSION_NOTE,
  PLAY_BASE_AAB_LIMIT_MB,
  evaluateAssetBudget,
  measureAssets,
  referencedAssets,
  toMB,
};
