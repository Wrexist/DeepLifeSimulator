/**
 * The game's messaging must not regress to the OS dialog.
 *
 * `Alert.alert` is unstyleable and un-brandable - an OS dialog in the OS font
 * dropped on top of a bespoke glass UI. The game carried 268 of them: every
 * lock explanation, onboarding validation and save failure. They are now
 * `gameAlert()` from `@/utils/gameAlert`, rendered by `components/ui/AlertHost`.
 *
 * Ratcheted at the three files that legitimately keep the native dialog. Do not
 * add to that set to get unstuck - call `gameAlert` instead.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const SCAN_DIRS = ['app', 'components', 'src'];

/**
 * ErrorBoundary runs when the React tree is already broken, so the host may be
 * unmounted - the platform dialog is the only reliable channel there. The other
 * two are developer tooling, never shown to a player.
 */
const ALLOWED = new Set([
  'components/ErrorBoundary.tsx',
  'components/debug/AIDebugMenu.tsx',
  'components/DevToolsModal.tsx',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('player-facing UI uses the in-game alert, not the OS dialog', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));

  it('scanned a real tree (the premise)', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('has no native Alert.alert call outside the allowed set', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      if (ALLOWED.has(rel)) continue;
      const src = fs.readFileSync(file, 'utf8');
      // Strip comments so the doc references in AlertHost/_layout don't trip it.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const hits = code.match(/\bAlert\.alert\(/g);
      if (hits) offenders.push(`${rel} (${hits.length})`);
    }
    expect(offenders).toEqual([]);
  });

  it('the allowed files really do still exist (so the set cannot go stale)', () => {
    for (const rel of ALLOWED) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
    }
  });

  it('the scanner can see the pattern it is written for (the control)', () => {
    const sample = 'Alert.alert("x", "y");';
    expect(sample.match(/\bAlert\.alert\(/g)).toHaveLength(1);
  });
});
