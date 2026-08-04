#!/usr/bin/env node
'use strict';
/**
 * Re-encode bundled PNG/JPG art as WebP, and rewrite the requires that point at it.
 *
 * ── Why ───────────────────────────────────────────────────────────────────
 *
 * 234.0 MB of images reached the bundle against Google Play's 200 MB base-AAB
 * limit, so the app could not be released as a single Android artifact. The
 * resolution was never the problem — the art is 1024-1536px, which is right for
 * @3x — the FORMAT was: 1536x1024 photographic frames stored as lossless PNG run
 * ~2 MB each, and 190.9 of the 230 MB carried an alpha channel, so JPEG could not
 * take the bulk of it.
 *
 * ── Why WebP q92 specifically ─────────────────────────────────────────────
 *
 * Measured on a representative sample before committing to it, comparing against
 * PNG palette quantisation, and scoring error only on VISIBLE pixels (a naive
 * whole-buffer diff reads ~12/255 on these files purely from the undefined RGB
 * under fully transparent areas — the first measurement said exactly that and it
 * was an artefact):
 *
 *              size        visible RGB MAE   alpha MAE
 *   webp q85   6.8-16.7x   2.90 - 3.83       0.00
 *   webp q92   5.5-10.8x   2.56 - 3.15       0.00
 *   png pal80  3.1 - 7.9x  1.58 - 23.47      —
 *
 * q92 keeps visible error near 1% of range, reproduces alpha EXACTLY, and still
 * clears the limit with room to spare. PNG quantisation was both bigger and, on
 * the alpha-heavy IAP art, far worse.
 *
 * ── Why the format is safe here ───────────────────────────────────────────
 *
 * Not assumed — checked. This app ALREADY ships and renders a WebP
 * (`assets/images/deeplife-plus-banner.webp`, required by `DeepLifePlusUpsell`),
 * `webp` is in Metro's default `assetExts`, and the iOS deployment target is 15.1
 * while ImageIO has decoded WebP since iOS 14.
 *
 * ── What is deliberately NOT converted ────────────────────────────────────
 *
 * The launcher icon, Android adaptive icon and web favicon. Those are consumed by
 * native tooling (Xcode asset catalog, Android mipmap, expo-splash-screen) rather
 * than by `Image`, and that tooling wants PNG. The splash re-uses the icon, so it
 * is covered by the same exclusion.
 *
 * Usage:
 *   node scripts/convert-assets-to-webp.js --dry-run
 *   node scripts/convert-assets-to-webp.js
 *
 * Idempotent: an already-converted tree converts nothing and rewrites nothing.
 */
const fs = require('fs');
const path = require('path');

const QUALITY = 92;
/** Higher = slower, smaller. 6 is a good spot for a one-off batch. */
const EFFORT = 6;

/**
 * Consumed by native tooling, not by `Image`. Must stay PNG.
 * Paths are repo-relative.
 */
const NEVER_CONVERT = new Set([
  'assets/images/icon.png',
  'assets/images/adaptive-icon.png',
  'assets/images/favicon.png',
]);

const SOURCE_EXT = /\.(tsx?|jsx?)$/;
const CONVERTIBLE = /\.(png|jpe?g)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'android', 'ios', 'assets']);

function loadSharp() {
  // sharp is a heavy native dependency and this script runs once, by hand, so it
  // is NOT added to package.json. Resolve it from wherever it is installed and
  // say so plainly if it is missing, rather than failing with a bare MODULE_NOT_FOUND.
  const candidates = [
    'sharp',
    path.join(process.env.HOME || '', '.npm-global/lib/node_modules/sharp'),
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* try the next one */
    }
  }
  console.error('[webp] sharp is not installed.');
  console.error('  npm install --no-save sharp     (or install it globally)');
  process.exit(1);
}

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

/** Every asset path statically required from source, repo-relative. */
function referencedAssets(root) {
  const found = new Set();
  const pattern = /require\(\s*['"]([^'"]*assets\/[^'"]+)['"]\s*\)/g;
  for (const file of walk(root, SOURCE_EXT)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      const raw = match[1];
      if (!CONVERTIBLE.test(raw)) continue;
      const rel = raw.startsWith('@/')
        ? raw.slice(2)
        : path.relative(root, path.resolve(path.dirname(file), raw));
      found.add(rel);
    }
  }
  return found;
}

async function main() {
  const sharp = loadSharp();
  const dryRun = process.argv.includes('--dry-run');
  const root = process.cwd();

  const targets = [...referencedAssets(root)]
    .filter((rel) => !NEVER_CONVERT.has(rel))
    .filter((rel) => fs.existsSync(path.join(root, rel)))
    .sort();

  if (targets.length === 0) {
    console.log('[webp] Nothing to convert — every bundled image is already WebP.');
    return;
  }

  let before = 0;
  let after = 0;
  let grew = 0;
  /** rel -> replacement rel. Only files that actually got smaller. */
  const rewrites = new Map();

  for (const rel of targets) {
    const abs = path.join(root, rel);
    const originalBytes = fs.statSync(abs).size;
    const encoded = await sharp(abs).webp({ quality: QUALITY, effort: EFFORT }).toBuffer();

    before += originalBytes;

    // Keep the original when WebP is not actually smaller. It happens on tiny
    // flat-colour sprites, where the container overhead dominates, and shipping
    // a bigger file to satisfy a conversion script would be silly.
    if (encoded.length >= originalBytes) {
      after += originalBytes;
      grew += 1;
      continue;
    }

    after += encoded.length;
    const webpRel = rel.replace(CONVERTIBLE, '.webp');
    rewrites.set(rel, webpRel);

    if (!dryRun) {
      fs.writeFileSync(path.join(root, webpRel), encoded);
      fs.unlinkSync(abs);
    }
  }

  // Rewrite the requires. Done AFTER encoding so a mid-run failure leaves the
  // source pointing at files that still exist.
  let filesTouched = 0;
  if (!dryRun && rewrites.size > 0) {
    for (const file of walk(root, SOURCE_EXT)) {
      const source = fs.readFileSync(file, 'utf8');
      let next = source;
      for (const [from, to] of rewrites) {
        // Match by basename-anchored suffix so both '@/assets/…' and relative
        // forms are covered without reconstructing each caller's path.
        next = next.split(from).join(to);
        const fromRelative = from.replace(/^assets\//, '');
        const toRelative = to.replace(/^assets\//, '');
        next = next.split(fromRelative).join(toRelative);
      }
      if (next !== source) {
        fs.writeFileSync(file, next);
        filesTouched += 1;
      }
    }
  }

  const mb = (b) => (b / (1024 * 1024)).toFixed(1);
  console.log(`[webp] ${dryRun ? 'DRY RUN — ' : ''}${rewrites.size} converted, ${grew} left as-is (WebP was larger)`);
  console.log(`[webp] ${mb(before)} MB -> ${mb(after)} MB  (${(before / after).toFixed(1)}x smaller)`);
  if (!dryRun) console.log(`[webp] rewrote requires in ${filesTouched} source file(s)`);
}

main().catch((error) => {
  console.error('[webp] failed:', error);
  process.exit(1);
});
