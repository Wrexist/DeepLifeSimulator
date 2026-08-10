/**
 * Every `?app=` id must resolve in BOTH launchers.
 *
 * The pet app is `paw` on the computer grid and `pet` on the phone grid. The
 * badge layer already papers over this by setting both counts, and
 * `featureUnlocks` registers both keys — but the deep-link contract did not.
 * `MOBILE_APP_IDS` (the split the deep link uses to decide which category to
 * leave showing) lists `paw`, while the phone launcher's lookup map only had
 * `pet`. So `/(tabs)/apps?app=paw` on a phone-only save resolved `undefined`
 * and silently bounced back to the grid — a dead tap with no error.
 *
 * Nothing shipped that link yet, which is exactly why this test exists now: it
 * is a live trap for the next notification tap, badge tap or CTA anyone adds.
 * Asserted against source text rather than by importing the screens, which drag
 * in the whole app graph.
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.join(__dirname, '../..');

const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/**
 * Pull the `apps` lookup-map keys out of a launcher screen.
 *
 * Anchored on `const apps = {` specifically — a looser `const apps` also
 * matches `const appsList = useMemo(...)`, the descriptor ARRAY, and would
 * scoop up its `id`/`name`/`icon` keys. That made an earlier version of this
 * test pass on noise rather than on the map under test.
 */
function lookupMapIds(source: string): string[] {
  const marker = /const apps\s*(?::[^=]+)?=\s*\{/.exec(source);
  expect(marker).not.toBeNull();
  const open = marker!.index + marker![0].length - 1;
  const close = source.indexOf('\n    };', open);
  expect(close).toBeGreaterThan(open);
  const body = source.slice(open, close);

  const ids: string[] = [];
  // `  key: Component,` — skip commented-out lines.
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(trimmed);
    if (m) ids.push(m[1]);
  }
  return ids;
}

describe('sub-app deep-link ids', () => {
  const computer = read('app/(tabs)/computer.tsx');
  const mobile = read('app/(tabs)/mobile.tsx');

  it('parses the real lookup map, not the descriptor array', () => {
    // Guards the parser itself. Without this, a regex that silently matched
    // nothing (or matched `appsList`) would make every assertion below vacuous.
    for (const [name, source] of [
      ['computer', computer],
      ['mobile', mobile],
    ] as const) {
      const ids = lookupMapIds(source);
      expect(`${name}:${ids.length > 4}`).toBe(`${name}:true`);
      // Descriptor-array keys must NOT appear — they are the tell-tale of an
      // over-broad match.
      for (const noise of ['id', 'name', 'description', 'icon', 'gradient']) {
        expect(`${name}:${noise}=${ids.includes(noise)}`).toBe(`${name}:${noise}=false`);
      }
      expect(ids).toContain('tinder');
    }
  });

  it('resolves every MOBILE_APP_IDS entry in the phone launcher', () => {
    // MOBILE_APP_IDS drives which category the deep link leaves showing, so
    // every id in it must be openable on a phone-only save.
    const declared = /const MOBILE_APP_IDS = \[([^\]]+)\]/.exec(computer);
    expect(declared).not.toBeNull();
    const ids = declared![1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);

    const mobileIds = lookupMapIds(mobile);
    const unresolvable = ids.filter((id) => !mobileIds.includes(id));
    expect(unresolvable).toEqual([]);
  });

  it('resolves the pet app under both of its ids in both launchers', () => {
    // The specific divergence this test was written for.
    for (const [name, source] of [
      ['computer', computer],
      ['mobile', mobile],
    ] as const) {
      const ids = lookupMapIds(source);
      expect(`${name}:paw=${ids.includes('paw')}`).toBe(`${name}:paw=true`);
      expect(`${name}:pet=${ids.includes('pet')}`).toBe(`${name}:pet=true`);
    }
  });

  it('keeps every phone-launcher id openable on the computer too', () => {
    // A player who buys a computer must not lose access to an app they had.
    const computerIds = lookupMapIds(computer);
    const missing = lookupMapIds(mobile).filter((id) => !computerIds.includes(id));
    expect(missing).toEqual([]);
  });
});
