/**
 * A component mounted for the whole session must not subscribe to everything.
 *
 * `AdRewardOrb` is rendered from `app/(tabs)/_layout.tsx`, so it is mounted for
 * as long as the player is in the game. It used `useGame()` — which composes
 * `useGameState()`, a plain `useContext` on the provider carrying `gameState` —
 * so EVERY mutation anywhere re-rendered it and rebuilt the merged 9-context
 * object inside `useGame`'s memo. It renders off two booleans.
 *
 * The reason it held that subscription was the `gsRef` mirror:
 *
 *     const gsRef = useRef(gameState);
 *     useEffect(() => { gsRef.current = gameState; });
 *
 * needed for timers that fire minutes later and must price the reward off
 * CURRENT wealth. That idiom only stays fresh BECAUSE the component re-renders
 * on every mutation — so the perf cost was load-bearing, and deleting the
 * subscription without replacing the read would have shipped stale rewards.
 * `useGameStateGetter` reads the provider's live snapshot with no subscription.
 * 2026-07-30 audit PERF-7.
 *
 * Static assertions rather than a render harness: mounting this needs the full
 * 9-provider tree plus the ads SDK, and what regressed is which hook the
 * component reaches for — which is exactly what a future edit would change.
 */
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ORB = path.join(REPO_ROOT, 'components/AdRewardOrb.tsx');
const source = fs.readFileSync(ORB, 'utf8');

/** Comments stripped — the docblocks NAME the banned hooks to explain them. */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('AdRewardOrb takes no full-state subscription', () => {
  it('does not call useGame()', () => {
    expect(code).not.toMatch(/\buseGame\s*\(/);
  });

  it('writes through useSetGameState', () => {
    expect(code).toMatch(/useSetGameState\s*\(/);
  });

  it('selects the two booleans it renders from', () => {
    // Selecting a BOOLEAN matters: returning an object or array from the
    // selector would re-render on every change regardless, since the default
    // comparison is Object.is.
    const selectors = code.match(/useGameSelector\s*\(/g) ?? [];
    expect(selectors.length).toBeGreaterThanOrEqual(2);
    expect(code).toMatch(/const adsRemoved = useGameSelector\(/);
    expect(code).toMatch(/const blocked = useGameSelector\(/);
  });
});

describe('it still reads FRESH state when a timer fires', () => {
  it('uses the non-subscribing getter', () => {
    expect(code).toMatch(/useGameStateGetter\s*\(/);
    expect(code).toMatch(/getGameState\(\)/);
  });

  it('no longer keeps a hand-rolled state mirror', () => {
    // `useRef(gameState)` + a bare effect is the idiom that forced the
    // subscription. Its return would silently reintroduce the whole problem.
    expect(code).not.toMatch(/useRef\(gameState\)/);
    expect(code).not.toMatch(/gsRef\.current\s*=/);
  });

  it('prices the reward and re-checks entitlement off the getter, not a capture', () => {
    // A timer scheduled minutes earlier must not pay out on stale wealth, and
    // the post-dismissal entitlement re-read is what stops a player who just
    // bought Remove Ads from being shown an ad.
    expect(code).toMatch(/computeReward\(getGameState\(\)\)/);
    expect(code).toMatch(/areAdsRemoved\(getGameState\(\)\)/);
  });
});

describe('the getter itself is a real non-subscribing read', () => {
  const selectorSource = fs.readFileSync(
    path.join(REPO_ROOT, 'contexts/game/useGameSelector.ts'),
    'utf8',
  );

  it('returns the store snapshot rather than selecting through the store', () => {
    // If it were implemented with useGameSelector/useSyncExternalStore it would
    // re-subscribe and defeat its own purpose.
    const body = selectorSource.slice(
      selectorSource.indexOf('export function useGameStateGetter'),
      selectorSource.indexOf('export function shallowEqual'),
    );

    expect(body).toMatch(/return store\.getSnapshot/);
    expect(body).not.toMatch(/useSyncExternalStore/);
  });

  it('throws outside a provider rather than returning undefined state', () => {
    const body = selectorSource.slice(
      selectorSource.indexOf('export function useGameStateGetter'),
    );
    expect(body.slice(0, 400)).toMatch(/throw new Error/);
  });
});
