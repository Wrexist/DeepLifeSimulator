/**
 * Numbers are formatted in ONE locale.
 *
 * A bare `n.toLocaleString()` follows the DEVICE locale, so a Swedish phone
 * showed "$1 500" and "50 000 gems" beside hard-coded "50,000 Gems" and
 * "$12.35K" - two number systems on one screen (tester pass, 2026-10-10). Every
 * numeric call now passes 'en-US', matching the game's English copy and its
 * K/M/B abbreviations. Rewritten by type, so Date calls were left alone.
 *
 * This guard is textual: a bare `.toLocaleString()` must be on a Date, and the
 * only one allowed is the crash report's timestamp.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const DIRS = ['app', 'components', 'lib', 'utils', 'contexts', 'hooks', 'services', 'src'];
const ALLOWED = new Set(['components/ErrorBoundary.tsx']);

function walk(dir: string, out: string[]) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
}

it('no numeric toLocaleString() falls back to the device locale', () => {
  const files: string[] = [];
  for (const d of DIRS) walk(path.join(ROOT, d), files);
  const offenders: string[] = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    if (ALLOWED.has(rel)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/\.toLocaleString\(\s*\)/.test(line)) offenders.push(`${rel}:${i + 1}`);
    });
  }
  expect(offenders).toEqual([]);
});
