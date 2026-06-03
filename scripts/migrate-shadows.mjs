#!/usr/bin/env node
/**
 * Codemod: wrap legacy react-native shadow* / textShadow* style props in
 * Platform.select so web emits the modern boxShadow / textShadow CSS and
 * native keeps the old props (which still work on iOS/Android).
 *
 * Usage:
 *   node scripts/migrate-shadows.mjs --dry          # preview, don't write
 *   node scripts/migrate-shadows.mjs                # apply changes
 *   node scripts/migrate-shadows.mjs --only=path    # restrict to one path
 *
 * Safety rules:
 *   - Skips clusters already inside a Platform.select() branch
 *     (detected by walking up to find an `ios:` / `web:` / `default:` /
 *     `android:` / `native:` parent key without first crossing a
 *     `StyleSheet.create(` or top-level object opening).
 *   - Adds `Platform` to the existing `react-native` import if absent.
 *   - Leaves `elevation:` untouched (Android-only, no deprecation).
 *   - Idempotent: re-running on already-migrated files is a no-op.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const FIXUP = args.includes('--fixup');
const onlyArg = args.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length) : null;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', 'android', 'ios',
  'coverage', '.next', '.turbo', 'web-build', 'scripts',
]);

const SKIP_FILES = new Set([
  // The helper itself + already-migrated files we just edited by hand.
  path.normalize('utils/shadow.ts'),
  path.normalize('utils/glassmorphismStyles.ts'),
]);

/** Recursively collect .ts/.tsx files under root, honoring SKIP_DIRS. */
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

/** Convert a color string + opacity into a CSS rgba() string. */
function toRgba(color, opacity) {
  // Strip surrounding JS string quotes if present (the source line literally
  // contains them — e.g. `shadowColor: '#000'` → captured as `'#000'`).
  color = color.trim().replace(/^['"`]|['"`]$/g, '');
  if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
    // Caller already specified alpha (or none); multiply alpha by opacity when
    // both are present, otherwise just return with given opacity.
    const m = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
    if (m) {
      const [, r, g, b, a] = m;
      const alpha = a !== undefined ? Number(a) * opacity : opacity;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(0, 0, 0, ${opacity})`;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  // Named color or unknown — fall back to opacity-only.
  return `rgba(0, 0, 0, ${opacity})`;
}

/**
 * Check whether the code position at `clusterStart` sits inside an existing
 * Platform.select branch (ios:/android:/web:/default:/native:). We look at
 * the preceding ~30 non-blank lines for a branch key and only treat it as
 * "inside" if no intervening sibling `},` has closed it.
 */
function isInsidePlatformSelect(lines, clusterStartIdx) {
  let depth = 0;
  for (let i = clusterStartIdx - 1; i >= Math.max(0, clusterStartIdx - 60); i--) {
    const line = lines[i];
    // Count braces to know when we've exited the current object.
    for (let j = line.length - 1; j >= 0; j--) {
      const ch = line[j];
      if (ch === '}') depth++;
      else if (ch === '{') {
        if (depth === 0) {
          // Just hit the parent's opening brace. Check the key on this line.
          if (/^\s*(ios|android|web|default|native|windows|macos)\s*:\s*\{/.test(line)) {
            return true;
          }
          return false;
        }
        depth--;
      }
    }
  }
  return false;
}

/** Split a captured indent into (leading newline-run, pure-space indent). */
function splitIndent(raw) {
  const m = raw.match(/^([\s\S]*?)( *)$/);
  return { leading: m[1], spaces: m[2] };
}

/** Build the indented Platform.select block to replace a shadow cluster. */
function buildShadowReplacement(indent, color, width, height, opacity, radius) {
  const { leading, spaces } = splitIndent(indent);
  const boxShadow = `${width}px ${height}px ${radius}px ${toRgba(color, Number(opacity))}`;
  return leading + [
    `${spaces}...Platform.select({`,
    `${spaces}  web: { boxShadow: '${boxShadow}' } as any,`,
    `${spaces}  default: {`,
    `${spaces}    shadowColor: ${color},`,
    `${spaces}    shadowOffset: { width: ${width}, height: ${height} },`,
    `${spaces}    shadowOpacity: ${opacity},`,
    `${spaces}    shadowRadius: ${radius},`,
    `${spaces}  },`,
    `${spaces}}),`,
  ].join('\n');
}

/** Build the indented Platform.select block to replace a textShadow cluster. */
function buildTextShadowReplacement(indent, color, width, height, radius) {
  const { leading, spaces } = splitIndent(indent);
  const textShadow = `${width}px ${height}px ${radius}px ${color.replace(/^['"]|['"]$/g, '')}`;
  return leading + [
    `${spaces}...Platform.select({`,
    `${spaces}  web: { textShadow: '${textShadow}' } as any,`,
    `${spaces}  default: {`,
    `${spaces}    textShadowColor: ${color},`,
    `${spaces}    textShadowOffset: { width: ${width}, height: ${height} },`,
    `${spaces}    textShadowRadius: ${radius},`,
    `${spaces}  },`,
    `${spaces}}),`,
  ].join('\n');
}

/**
 * Find and rewrite shadow*/

/* clusters in `source`. Returns { source, count }.

   Note: regex captures use plain JS character classes since the source
   formatting is highly consistent (Prettier-formatted, 2-space indent). */

function migrateFile(source) {
  let count = 0;
  const lines = source.split('\n');

  // shadow* cluster pattern (4 lines, blank lines between tolerated).
  const shadowRe = /^(\s*)shadowColor:\s*(.+?),\s*$/;
  const shadowOffsetRe = /^\s*shadowOffset:\s*\{\s*width:\s*(-?[\d.]+)\s*,\s*height:\s*(-?[\d.]+)\s*\}\s*,\s*$/;
  const shadowOpacityRe = /^\s*shadowOpacity:\s*([\d.]+)\s*,\s*$/;
  const shadowRadiusRe = /^\s*shadowRadius:\s*([\d.]+)\s*,\s*$/;

  // textShadow* cluster pattern (3 lines, blank lines between tolerated).
  const tsColorRe = /^(\s*)textShadowColor:\s*(.+?),\s*$/;
  const tsOffsetRe = /^\s*textShadowOffset:\s*\{\s*width:\s*(-?[\d.]+)\s*,\s*height:\s*(-?[\d.]+)\s*\}\s*,\s*$/;
  const tsRadiusRe = /^\s*textShadowRadius:\s*([\d.]+)\s*,\s*$/;

  // Find the next non-blank line index starting at `start`. Returns -1 if
  // none found within `lookahead` lines.
  const nextNonBlank = (start, lookahead = 5) => {
    for (let i = start; i < Math.min(lines.length, start + lookahead); i++) {
      if (lines[i].trim() !== '') return i;
    }
    return -1;
  };

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    // Try shadow* first.
    const mColor = shadowRe.exec(lines[i]);
    if (mColor) {
      const i1 = nextNonBlank(i + 1);
      const i2 = i1 >= 0 ? nextNonBlank(i1 + 1) : -1;
      const i3 = i2 >= 0 ? nextNonBlank(i2 + 1) : -1;
      const mOff = i1 >= 0 ? shadowOffsetRe.exec(lines[i1]) : null;
      const mOpa = i2 >= 0 ? shadowOpacityRe.exec(lines[i2]) : null;
      const mRad = i3 >= 0 ? shadowRadiusRe.exec(lines[i3]) : null;
      if (mOff && mOpa && mRad && !isInsidePlatformSelect(lines, i)) {
        const [, indent, color] = mColor;
        const [, w, h] = mOff;
        const [, opa] = mOpa;
        const [, rad] = mRad;
        out.push(buildShadowReplacement(indent, color, w, h, opa, rad));
        i = i3; // skip past the consumed cluster (blank lines between are dropped)
        count++;
        continue;
      }
    }
    // Try textShadow*.
    const mTs = tsColorRe.exec(lines[i]);
    if (mTs) {
      const i1 = nextNonBlank(i + 1);
      const i2 = i1 >= 0 ? nextNonBlank(i1 + 1) : -1;
      const mTsOff = i1 >= 0 ? tsOffsetRe.exec(lines[i1]) : null;
      const mTsRad = i2 >= 0 ? tsRadiusRe.exec(lines[i2]) : null;
      if (mTsOff && mTsRad && !isInsidePlatformSelect(lines, i)) {
        const [, indent, color] = mTs;
        const [, w, h] = mTsOff;
        const [, rad] = mTsRad;
        out.push(buildTextShadowReplacement(indent, color, w, h, rad));
        i = i2;
        count++;
        continue;
      }
    }
    out.push(lines[i]);
  }

  return { source: out.join('\n'), count };
}

/** Ensure `Platform` is imported from 'react-native'. Returns updated source. */
function ensurePlatformImport(source) {
  // Already importing Platform?
  if (/import\s+\{[^}]*\bPlatform\b[^}]*\}\s+from\s+['"]react-native['"]/.test(source)) {
    return source;
  }
  // Has an import from react-native — extend it.
  const m = source.match(/import\s+\{([^}]*)\}\s+from\s+['"]react-native['"]/);
  if (m) {
    const inner = m[1].trim().replace(/,\s*$/, '');
    const replaced = `import { Platform, ${inner} } from 'react-native'`;
    return source.replace(m[0], replaced);
  }
  // No react-native import — add one after the last import line.
  const lines = source.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\b/.test(lines[i])) lastImport = i;
  }
  const insertAt = lastImport + 1;
  lines.splice(insertAt, 0, `import { Platform } from 'react-native';`);
  return lines.join('\n');
}

/**
 * Fixup pass: for already-migrated Platform.select blocks, recompute the
 * `boxShadow` / `textShadow` string from the native-side values. This
 * corrects output from earlier codemod versions that mishandled string
 * quotes in colors.
 */
function fixupFile(source) {
  let count = 0;

  // Detect original line ending so we can preserve it after regex work.
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let body = eol === '\r\n' ? source.replace(/\r\n/g, '\n') : source;

  // shadow* fixup: match the 9-line block produced by buildShadowReplacement,
  // capture native values, rebuild boxShadow with corrected toRgba().
  // Color capture uses greedy `.+,` to handle rgba(...) which contains commas.
  const shadowBlockRe = /(\s*)\.\.\.Platform\.select\(\{\s*\n\s*web:\s*\{\s*boxShadow:\s*'[^']*'\s*\}\s*as\s*any,\s*\n\s*default:\s*\{\s*\n\s*shadowColor:\s*(.+),\s*\n\s*shadowOffset:\s*\{\s*width:\s*(-?[\d.]+)\s*,\s*height:\s*(-?[\d.]+)\s*\}\s*,\s*\n\s*shadowOpacity:\s*([\d.]+)\s*,\s*\n\s*shadowRadius:\s*([\d.]+)\s*,\s*\n\s*\}\s*,\s*\n\s*\}\),/g;

  body = body.replace(shadowBlockRe, (_match, indent, color, w, h, opa, rad) => {
    count++;
    return buildShadowReplacement(indent, color, w, h, opa, rad);
  });

  // textShadow* fixup: same shape, 3 native props.
  const textShadowBlockRe = /(\s*)\.\.\.Platform\.select\(\{\s*\n\s*web:\s*\{\s*textShadow:\s*'[^']*'\s*\}\s*as\s*any,\s*\n\s*default:\s*\{\s*\n\s*textShadowColor:\s*(.+),\s*\n\s*textShadowOffset:\s*\{\s*width:\s*(-?[\d.]+)\s*,\s*height:\s*(-?[\d.]+)\s*\}\s*,\s*\n\s*textShadowRadius:\s*([\d.]+)\s*,\s*\n\s*\}\s*,\s*\n\s*\}\),/g;

  body = body.replace(textShadowBlockRe, (_match, indent, color, w, h, rad) => {
    count++;
    return buildTextShadowReplacement(indent, color, w, h, rad);
  });

  return { source: eol === '\r\n' ? body.replace(/\n/g, '\r\n') : body, count };
}

// ----- main -----

const allFiles = walk(ROOT);
const targets = allFiles.filter(abs => {
  const rel = path.relative(ROOT, abs);
  if (SKIP_FILES.has(path.normalize(rel))) return false;
  if (ONLY && !rel.includes(ONLY)) return false;
  return true;
});

let touchedFiles = 0;
let totalClusters = 0;
const perFile = [];

for (const abs of targets) {
  const original = fs.readFileSync(abs, 'utf8');
  const { source: pass1, count: pass1Count } = FIXUP
    ? fixupFile(original)
    : migrateFile(original);
  if (pass1Count === 0) continue;
  const final = FIXUP ? pass1 : ensurePlatformImport(pass1);
  perFile.push({ file: path.relative(ROOT, abs), count: pass1Count });
  touchedFiles++;
  totalClusters += pass1Count;
  if (!DRY) fs.writeFileSync(abs, final, 'utf8');
}

const verb = FIXUP ? 'Fixed' : 'Migrated';
console.log(`${DRY ? '[DRY-RUN] ' : ''}${verb} ${totalClusters} clusters across ${touchedFiles} files.`);
perFile.sort((a, b) => b.count - a.count);
for (const { file, count } of perFile.slice(0, 30)) {
  console.log(`  ${count.toString().padStart(4)}  ${file}`);
}
if (perFile.length > 30) console.log(`  ... and ${perFile.length - 30} more files`);
