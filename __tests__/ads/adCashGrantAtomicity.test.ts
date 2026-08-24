/**
 * WP-A — the ad orb's cash grant: gate, stamp and credit are ONE step.
 *
 * The shipped version was the exact capture-across-updater shape the 2026-08-15
 * sweep removed from `contexts/game/actions/`:
 *
 *     let allowed = false;
 *     setGameState(prev => { …; allowed = true; return stamped; });
 *     if (!allowed) { setGranted(true); haptic.success(); return; }
 *     updateMoney(setGameState, reward, 'Rewarded ad bonus');
 *
 * Two separate defects, in opposite directions:
 *
 *   (a) React runs only the FIRST functional update of a batch eagerly. On a
 *       DEFERRED updater `allowed` still read `false`, so the week marker
 *       committed and the money never did — a player watched an ad and was paid
 *       nothing, once per batch-contended tap.
 *
 *   (b) Deterministic, no timing required: orbs respawn every 6-10 minutes and
 *       the spawner never consulted `settings.lastAdCashGrantWeek`, so the
 *       SECOND cash orb of a game week took the `!allowed` branch — which
 *       played the success haptic and set `granted`, showing "Reward added!
 *       $X was added to your wallet" for a $0 grant.
 *
 * The fix is the C-9 outer guard (`cashGrantClaimed`, also consulted by the
 * spawner so an unredeemable cash orb is never OFFERED) plus one atomic updater
 * (`applyAdCashGrant`) that stamps the week and credits the money together,
 * re-checking the gate against `prev` (§4.4).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { cashGrantClaimed, applyAdCashGrant } from '@/components/AdRewardOrb';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/**
 * The dispatch simulation from `__tests__/economy/companyUpgradeResult.test.ts`:
 * updaters are applied in order against the accumulated state, which is what a
 * React batch does with them.
 */
function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

const WEEK = 364; // an age-25 start — weeksLived is absolute (§4.2)

function player(money: number, claimedWeek?: number): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: WEEK,
    stats: { ...base.stats, money },
    settings: claimedWeek === undefined
      ? { ...base.settings }
      : { ...base.settings, lastAdCashGrantWeek: claimedWeek },
  });
}

describe('cashGrantClaimed - the outer guard', () => {
  it('is false for a player who has never claimed', () => {
    expect(cashGrantClaimed(player(1000))).toBe(false);
  });

  it('is true only for the CURRENT game week', () => {
    expect(cashGrantClaimed(player(1000, WEEK))).toBe(true);
    expect(cashGrantClaimed(player(1000, WEEK - 1))).toBe(false);
  });

  it('survives a missing/corrupt state rather than throwing into the spawner', () => {
    expect(cashGrantClaimed(undefined)).toBe(false);
    expect(cashGrantClaimed(null)).toBe(false);
    expect(cashGrantClaimed({ weeksLived: NaN, settings: {} } as never)).toBe(false);
  });
});

describe('applyAdCashGrant - stamp and credit are one step', () => {
  it('credits the reward AND stamps the week in a single updater', () => {
    const { setState, get } = batched(player(1_000));

    setState((prev) => applyAdCashGrant(prev, 5_000));

    expect(get().stats.money).toBe(6_000);
    expect(get().settings?.lastAdCashGrantWeek).toBe(WEEK);
  });

  it('a stamped week is NEVER a $0 grant - the two cannot come apart', () => {
    // The (a) defect: the marker committed while the money did not. Whatever
    // the updater returns, either both moved or neither did.
    const before = player(1_000);
    const after = applyAdCashGrant(before, 5_000);

    const stamped = after.settings?.lastAdCashGrantWeek === WEEK;
    const credited = after.stats.money > before.stats.money;
    expect(stamped).toBe(credited);
  });

  it('a double tap in ONE batch pays exactly once', () => {
    const { setState, get } = batched(player(1_000));

    setState((prev) => applyAdCashGrant(prev, 5_000));
    setState((prev) => applyAdCashGrant(prev, 5_000));

    expect(get().stats.money).toBe(6_000);
  });

  it('refuses a week that is already claimed, returning `prev` untouched', () => {
    const snapshot = player(1_000, WEEK);
    const { setState, get } = batched(snapshot);

    setState((prev) => applyAdCashGrant(prev, 5_000));

    expect(get()).toBe(snapshot); // identity — nothing was rebuilt
    expect(get().stats.money).toBe(1_000);
  });

  it('a NEW game week re-arms the grant (the control)', () => {
    const { setState, get } = batched(player(1_000, WEEK - 1));

    setState((prev) => applyAdCashGrant(prev, 5_000));

    expect(get().stats.money).toBe(6_000);
    expect(get().settings?.lastAdCashGrantWeek).toBe(WEEK);
  });

  it('runs the money through the central clamp - a bogus reward is refused, not stamped', () => {
    const snapshot = player(1_000);
    const { setState, get } = batched(snapshot);

    setState((prev) => applyAdCashGrant(prev, Number.NaN));

    expect(get().stats.money).toBe(1_000);
    expect(get().settings?.lastAdCashGrantWeek).toBeUndefined();
  });
});

describe('the spawner never offers what the gate will refuse', () => {
  it('the component asks cashGrantClaimed BEFORE picking the orb kind', () => {
    // Behavioural coverage of the component itself needs a timer-driven render;
    // what is pinned here is the ordering the (b) defect turned on — the kind
    // must be decided from the marker, not by a coin flip alone.
    const src = fs.readFileSync(
      path.join(__dirname, '../../components/AdRewardOrb.tsx'),
      'utf8',
    );
    const spawner = src.slice(src.indexOf('const scheduleNext'), src.indexOf('// First appearance'));
    expect(spawner).toMatch(/cashGrantClaimed\(snapshot\)/);
    expect(spawner).toMatch(/claimed \? 'vitality' : pickKind\(\)/);
  });
});
