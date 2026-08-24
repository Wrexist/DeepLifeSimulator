/**
 * The developer menu must never ship in a production build.
 *
 * `DevToolsModal` grants unbounded money and gems, sets any stat, skips weeks,
 * unlocks every feature and can trigger death. `SettingsModal` is reachable from
 * every screen via `TopStatsBar`, so the only thing standing between a release
 * build and a cheat menu is one boolean:
 *
 *     const DEV_TOOLS_ENABLED =
 *       __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEVTOOLS === 'true';
 *
 * That is correct today, and nothing enforced it. A single `"…DEVTOOLS": "true"`
 * added to the production EAS profile — or a stray `.env` committed by accident
 * — would ship the menu with no test failing and no preflight section covering
 * it. `scripts/preflight-check.js` has ten sections and none of them look here.
 *
 * The flag is ALSO what lets Metro dead-code-eliminate the modal's ~10k-LOC
 * dependency graph (TestRunner → AIDebugMenu → SimulationRunner →
 * lib/simulation/*). So a regression here is both a cheat-menu leak and a
 * bundle-size regression.
 *
 * `preview` sets it to `true` on purpose — that is the internal/QA build.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const FLAG = 'EXPO_PUBLIC_ENABLE_DEVTOOLS';

describe('the production EAS profile does not enable dev tools', () => {
  const eas = JSON.parse(read('eas.json')) as {
    build: Record<string, { env?: Record<string, string> }>;
  };

  it('eas.json still declares a production profile (guards the assertion below)', () => {
    expect(Object.keys(eas.build)).toContain('production');
  });

  it('production does not set the dev-tools flag at all', () => {
    const env = eas.build.production.env ?? {};
    expect(`${FLAG}=${env[FLAG] ?? '<unset>'}`).toBe(`${FLAG}=<unset>`);
  });

  it('no profile other than preview turns it on', () => {
    // preview IS the internal QA build - that one is deliberate.
    const offenders = Object.entries(eas.build)
      .filter(([name]) => name !== 'preview')
      .filter(([, p]) => (p.env ?? {})[FLAG] === 'true')
      .map(([name]) => name);

    expect(offenders).toEqual([]);
  });
});

describe('the gate itself cannot be loosened by accident', () => {
  const src = read('components/SettingsModal.tsx');

  it('requires an EXACT "true" string, not a truthy value', () => {
    // `process.env.X` is a STRING in an Expo build. A `!!process.env.X` or
    // `=== true` gate would flip on for "false", "0" or "off" - the three values
    // someone disabling it is most likely to write.
    expect(src).toMatch(
      /const DEV_TOOLS_ENABLED\s*=\s*\n?\s*__DEV__ \|\| process\.env\.EXPO_PUBLIC_ENABLE_DEVTOOLS === 'true';/,
    );
  });

  it('loads the modal through a CONDITIONAL require, not a static import', () => {
    // A static `import DevToolsModal from './DevToolsModal'` would pull the whole
    // simulator graph into the release bundle even with the flag off, because
    // Metro cannot tree-shake an unconditional import for its side effects.
    expect(src).toMatch(/DEV_TOOLS_ENABLED \? require\('\.\/DevToolsModal'\)\.default : null/);
    expect(src).not.toMatch(/^import DevToolsModal from/m);
  });

  it('every render of the modal is behind the flag', () => {
    /**
     * STRUCTURAL, not proximity-based. Two earlier versions of this assertion
     * were both satisfiable without the property holding:
     *
     *   1. `not.toMatch(/<DevToolsModal(?![^>]*)/)` - `[^>]*` matches the empty
     *      string, so the negative lookahead always succeeded and the pattern
     *      could never match a real tag.
     *   2. "the guard appears in the preceding 200 characters" - a nearby
     *      guarded render, a comment mentioning the flag, or a string could
     *      satisfy the window for a DIFFERENT, unguarded render site.
     *
     * Both would have passed while a release build shipped an ungated cheat
     * menu, which is the single thing this file exists to prevent. So the check
     * now ties each render to the conditional that immediately encloses it: the
     * exact `{DEV_TOOLS_ENABLED && DevToolsModal ? (\n  <DevToolsModal` wrapper,
     * matched as one unit. No window, no proximity.
     */
    const renders = [...src.matchAll(/<DevToolsModal[\s/>]/g)];
    expect(renders.length).toBeGreaterThan(0); // the modal IS rendered somewhere

    // Every render site must be the one immediately inside the guard.
    const guarded = [
      ...src.matchAll(/\{DEV_TOOLS_ENABLED && DevToolsModal \?\s*\(\s*<DevToolsModal[\s/>]/g),
    ];
    expect(`guarded renders: ${guarded.length} of ${renders.length}`).toBe(
      `guarded renders: ${renders.length} of ${renders.length}`,
    );
  });
});

describe('no committed env file turns it on', () => {
  it('.env.example ships it OFF, so a copied file is safe by default', () => {
    // `.env` itself is gitignored; `.env.example` is what people copy.
    const example = read('.env.example');
    expect(example).toMatch(new RegExp(`${FLAG}=false`));
    expect(example).not.toMatch(new RegExp(`^\\s*${FLAG}=true`, 'm'));
  });

  it('no .env file is tracked in the repo', () => {
    /**
     * Ask GIT, not the working tree.
     *
     * The first version read `fs.readdirSync(ROOT)`, which fails the moment a
     * developer copies `.env.example` to `.env` locally - the correct, expected
     * thing to do, and `.gitignore` already covers it. It also missed tracked
     * env files in subdirectories entirely. What matters is what is COMMITTED,
     * because that is what reaches a build.
     */
    const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.env', '.env*', '**/.env*'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean)
      .filter((f) => !f.endsWith('.env.example'));

    expect(tracked).toEqual([]);
  });

  it('.gitignore keeps .env out', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^\.env$/m);
  });
});
