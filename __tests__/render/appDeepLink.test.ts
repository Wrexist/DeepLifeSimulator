import fs from 'fs';
import path from 'path';
import { canOpenAppId } from '@/lib/progress/deepLinkableApps';
import { FEATURE_UNLOCKS } from '@/lib/progress/featureUnlocks';
import { createTestGameState } from '../helpers/createTestGameState';

/**
 * The Apps tab accepts `?app=<id>` and hands it straight to whichever launcher
 * is mounted, which opens the app directly. That path never touches a grid
 * tile — and the grid tile is the only place the padlock lives.
 *
 * So the first version of the deep link (PR #104) let one query param walk past
 * the entire progressive-disclosure system: `?app=onion` opened a tier-5 app on
 * a week-1 save. An unknown id was worse — it reached the launcher's component
 * lookup, where `apps[activeApp]` is `undefined` and React throws "Element type
 * is invalid", the exact production crash class `screenImports.test.ts` exists
 * to prevent.
 *
 * `canOpenAppId` is the shared gate. These tests pin it, and pin that both
 * launchers actually call it.
 */
const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const APPS = [
  { id: 'tinder' },
  { id: 'onion' },
  { id: 'contacts' },
  { id: 'gone', available: false },
];

describe('a deep-linked app id passes the same gate as its tile', () => {
  // A fresh save has completed no chapters, so it sits at tier 0.
  const freshSave = createTestGameState();

  it('refuses an app the player has not unlocked yet', () => {
    // app:onion is tier 5 — "Finish Chapter 5: Legacy".
    expect(canOpenAppId(freshSave, 'onion', APPS)).toBe(false);
    // app:tinder is tier 2 — the very link the Family tab's CTA sends.
    expect(canOpenAppId(freshSave, 'tinder', APPS)).toBe(false);
  });

  it('refuses an id that is not an app in this launcher', () => {
    // Would otherwise reach `apps[activeApp]` → undefined → "Element type is
    // invalid".
    expect(canOpenAppId(freshSave, 'not-an-app', APPS)).toBe(false);
    expect(canOpenAppId(freshSave, '', APPS)).toBe(false);
    expect(canOpenAppId(freshSave, undefined, APPS)).toBe(false);
  });

  it('refuses an app marked unavailable for this save', () => {
    // `available: false` means "does not exist here", which is a different
    // thing from "not yet" — the grid removes it outright.
    expect(canOpenAppId(freshSave, 'gone', APPS)).toBe(false);
  });

  it('allows an ungated app', () => {
    // No `app:` row in FEATURE_UNLOCKS means no gate — isFeatureUnlocked
    // returns true for an unknown id, which is the documented default.
    expect(FEATURE_UNLOCKS.some((f) => f.id === 'app:nogate')).toBe(false);
    expect(canOpenAppId(freshSave, 'nogate', [{ id: 'nogate' }])).toBe(true);
  });
});

describe('both launchers use it', () => {
  it('computer.tsx validates before activating', () => {
    const code = strip(read('app/(tabs)/computer.tsx'));

    expect(code).toContain('canOpenAppId(gameState, initialApp, appsList)');
    // The param is consumed either way — a rejected link must clear itself
    // rather than retry on every focus.
    expect(code).toMatch(/canOpenAppId\([\s\S]{0,240}onInitialAppConsumed\?\.\(\)/);
  });

  it('mobile.tsx validates before activating', () => {
    const code = strip(read('app/(tabs)/mobile.tsx'));

    expect(code).toContain('canOpenAppId(gameState, initialApp, appsList)');
    expect(code).toMatch(/canOpenAppId\([\s\S]{0,240}onInitialAppConsumed\?\.\(\)/);
  });
});

describe('the two launchers agree on every app id', () => {
  /** `id: 'x',` entries inside a launcher's appsList. */
  const idsIn = (rel: string): string[] =>
    Array.from(strip(read(rel)).matchAll(/^\s+id: '([a-z]+)',$/gm)).map((m) => m[1]);

  it('Pets is one id, not two', () => {
    // It was 'paw' on the computer and 'pet' on the phone. Nothing was visibly
    // broken — each launcher was internally consistent — until the deep link
    // made the id a cross-launcher contract, at which point `?app=pet` worked
    // on a phone save and silently did nothing on a computer save.
    const computer = idsIn('app/(tabs)/computer.tsx');
    const mobile = idsIn('app/(tabs)/mobile.tsx');

    expect(computer).toContain('pet');
    expect(mobile).toContain('pet');
    expect(computer).not.toContain('paw');
    expect(strip(read('lib/notifications/appBadges.ts'))).not.toContain('paw');
    expect(strip(read('lib/progress/featureUnlocks.ts'))).not.toContain('app:paw');
  });

  it('every shared id means the same app in both launchers', () => {
    const computer = new Set(idsIn('app/(tabs)/computer.tsx'));
    const mobile = idsIn('app/(tabs)/mobile.tsx');
    const shared = mobile.filter((id) => computer.has(id));

    // Every app the phone offers is also on the computer's Mobile Apps toggle,
    // so a `?app=` link resolves the same way whichever launcher is mounted.
    expect(shared.sort()).toEqual(mobile.sort());
  });

  it('every id in either launcher that is gated has an unlock row', () => {
    const unlockIds = new Set(FEATURE_UNLOCKS.map((f) => f.id));
    const all = new Set([...idsIn('app/(tabs)/computer.tsx'), ...idsIn('app/(tabs)/mobile.tsx')]);

    // A gate row for an id no launcher uses is dead config — that is how
    // `app:paw` outlived the id it gated.
    for (const f of FEATURE_UNLOCKS) {
      if (!f.id.startsWith('app:')) continue;
      expect(`${f.id}: ${all.has(f.id.slice(4))}`).toBe(`${f.id}: true`);
    }
    expect(unlockIds.has('app:paw')).toBe(false);
  });
});
