/**
 * AsyncStorage must never be imported at module top level.
 *
 * CLAUDE.md §4.6: "Load native modules lazily via `require()` in a try/catch,
 * never at module top level." Native init runs before JS, so a static import
 * evaluated during a screen's module load can fail where no try/catch can save
 * it — the blank-launch / "Element type is invalid" class this repo has already
 * shipped twice.
 *
 * `utils/phantomSaveCleanup.ts` was the ONLY static top-level import left in the
 * app source. That mattered because `MainMenu` — the first screen the router
 * navigates to — imports `saveSlotMetaLooksPhantom` from it statically. That is
 * a two-line pure function needing no storage at all, but the import dragged an
 * eager AsyncStorage module init into MainMenu's graph. MainMenu even imports
 * the LAZY wrapper one line earlier for its own use.
 *
 * Every other module in the repo (`safeStorage`, `saveValidation`,
 * `ErrorBoundary`, `bootBreadcrumbs`, `crashRecovery`, `startupCircuitBreaker`,
 * `RemoteLoggingService`, `AnalyticsService`, `storageWrapper`) already used the
 * require-in-a-getter pattern — this pins that they all keep doing so.
 * 2026-07-30 audit SAVE-2.
 */
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Directories that ship in the app bundle. */
const APP_DIRS = ['app', 'components', 'contexts', 'hooks', 'lib', 'services', 'src', 'utils'];

const PACKAGE = '@react-native-async-storage/async-storage';

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec|stress)\.tsx?$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Static ES import of the package — the banned form. */
const STATIC_IMPORT = new RegExp(
  `^\\s*import\\s+[^;]*from\\s+['"\`]${PACKAGE.replace(/[/\\-]/g, '\\$&')}['"\`]`,
  'm',
);

describe('no app-source module statically imports AsyncStorage', () => {
  const files = APP_DIRS.flatMap((dir) => walk(path.join(REPO_ROOT, dir)));

  it('scans a meaningful number of files (guards against a broken walk)', () => {
    // Without this, a walk that returned [] would make the check below pass
    // while verifying nothing.
    expect(files.length).toBeGreaterThan(200);
  });

  it('finds at least one file that DOES reference the package (guards the regex)', () => {
    // If the package path ever changes, the offender scan would silently find
    // nothing. Something must still mention it — lazily.
    const mentions = files.filter((f) => fs.readFileSync(f, 'utf8').includes(PACKAGE));
    expect(mentions.length).toBeGreaterThan(0);
  });

  it('has no static top-level import of the package', () => {
    const offenders = files
      .filter((f) => STATIC_IMPORT.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(REPO_ROOT, f));

    expect(offenders).toEqual([]);
  });
});

describe('phantomSaveCleanup specifically', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'utils/phantomSaveCleanup.ts'), 'utf8');

  it('loads AsyncStorage through a require, not an import', () => {
    expect(STATIC_IMPORT.test(source)).toBe(false);
    expect(source).toMatch(new RegExp(`require\\(\\s*['"\`]${PACKAGE.replace(/[/\\-]/g, '\\$&')}`));
  });

  it('wraps that require in a try/catch', () => {
    // A throw during MainMenu's module init is exactly what this guards.
    const requireIndex = source.indexOf(`require('${PACKAGE}`);
    expect(requireIndex).toBeGreaterThan(0);
    const before = source.slice(0, requireIndex);
    expect(before.lastIndexOf('try {')).toBeGreaterThan(before.lastIndexOf('} catch'));
  });

  it('still exports the pure pre-filter MainMenu actually imports', () => {
    expect(source).toMatch(/export function saveSlotMetaLooksPhantom/);
  });
});
