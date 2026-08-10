/**
 * `useTheme` must not take a full-state subscription.
 *
 * ## Why this guard exists
 *
 * `useTheme` read ONE boolean (`settings.darkMode`) via `useGameState()`, which
 * subscribes to the entire `GameStateContext`. 64 files call it, so 64
 * components re-rendered on every state commit regardless of how carefully they
 * were written.
 *
 * That silently cancelled optimisation work already shipped elsewhere:
 *   • `app/(tabs)/home.tsx` builds a 20-key facade selector with `shallowEqual`
 *     — then calls `useTheme()` on the next line.
 *   • `components/AdRewardOrb.tsx` was narrowed to two booleans under audit
 *     item PERF-7, has its own guard test — and called `useTheme()` too.
 * Both paid full price anyway. Eleven already-migrated files were in that state.
 *
 * The failure mode this guards against is subtle and cheap to reintroduce: the
 * first time someone needs a second settings field in `useTheme`, reaching for
 * `useGameState()` is the obvious move and undoes all 64 at once.
 *
 * Source assertions rather than a render test, matching
 * `__tests__/render/adRewardOrbSubscription.test.ts` — mounting these needs the
 * full nine-provider tree.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');

/** Assert on CODE, not prose — these files explain the trap in their comments. */
const readCode = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

describe('useTheme subscribes narrowly', () => {
  const code = readCode('hooks/useTheme.ts');

  it('does not use the whole-state hook', () => {
    expect(code).not.toMatch(/useGameState\s*\(/);
    expect(code).not.toMatch(/from '@\/contexts\/game\/GameStateContext'/);
  });

  it('selects the dark-mode boolean directly', () => {
    expect(code).toMatch(/useGameSelector\(\s*\(s\) => s\.settings\?\.darkMode !== false\s*\)/);
  });

  it('imports the LEAF selector module, not the barrel', () => {
    // The `@/contexts/GameContext` barrel does `export * from './game'`, which
    // drags GameProvider -> IAPHandler in and produced a production Hermes
    // "Element type is invalid" crash.
    expect(code).toMatch(/from '@\/contexts\/game\/useGameSelector'/);
    expect(code).not.toMatch(/from '@\/contexts\/GameContext'/);
  });

  it('still defaults to dark, exactly as before', () => {
    // `!== false` — an absent setting means dark. Flipping this to `=== true`
    // would silently light-mode every existing save.
    expect(code).toMatch(/darkMode !== false/);
  });
});

describe('useTranslation subscribes narrowly', () => {
  const code = readCode('hooks/useTranslation.ts');

  it('does not use the whole-state hook', () => {
    expect(code).not.toMatch(/useGameState\s*\(/);
  });

  it('selects the language string directly', () => {
    expect(code).toMatch(/useGameSelector\(/);
    expect(code).toMatch(/settings\?\.language/);
  });

  it('keeps the English fallback', () => {
    expect(code).toMatch(/\|\| 'English'/);
  });

  it('imports the leaf module', () => {
    expect(code).toMatch(/from '@\/contexts\/game\/useGameSelector'/);
    expect(code).not.toMatch(/from '@\/contexts\/GameContext'/);
  });
});

describe('always-mounted inline children are memoised', () => {
  // A selector cannot stop a re-render driven by the parent. These components
  // are rendered inline in a layout root that subscribes to state, so without
  // React.memo their own narrowing is worth nothing. They take no props, which
  // makes React.memo a total barrier.
  it.each([
    ['components/AdRewardOrb.tsx', 'AdRewardOrb'],
    ['components/OfflineIndicator.tsx', 'OfflineIndicator'],
  ])('%s is wrapped in React.memo', (rel, name) => {
    const code = readCode(rel);
    expect(code).toMatch(new RegExp(`export default React\\.memo\\(${name}\\)`));
    expect(code).not.toMatch(new RegExp(`export default function ${name}`));
  });
});
