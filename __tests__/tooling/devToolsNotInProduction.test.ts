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

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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
    // preview IS the internal QA build — that one is deliberate.
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
    // `=== true` gate would flip on for "false", "0" or "off" — the three values
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
    const uses = src.match(/DevToolsModal/g) ?? [];
    const guarded = src.match(/DEV_TOOLS_ENABLED && DevToolsModal/g) ?? [];
    // One use is the conditional require, one is the type annotation on the
    // const, the rest must be guarded renders.
    expect(uses.length).toBeGreaterThan(0);
    expect(guarded.length).toBeGreaterThan(0);
    expect(src).not.toMatch(/<DevToolsModal(?![^>]*)/);
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
    // A committed `.env` would be inlined into the bundle at build time and
    // would override the profile's intent.
    const tracked = fs
      .readdirSync(ROOT)
      .filter((f) => /^\.env/.test(f))
      .filter((f) => f !== '.env.example');

    expect(tracked).toEqual([]);
  });

  it('.gitignore keeps .env out', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^\.env$/m);
  });
});
