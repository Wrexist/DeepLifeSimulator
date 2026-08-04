/**
 * R4-MON-3 — two gem-priced actions that survived the R8 flooring fix but not a
 * double tap with money in the bank.
 *
 * The R8 pass (`gemSpendExploits.test.ts`) folded the gem debit into the
 * granting updater and made it REJECT rather than floor at 0. That closed the
 * "second grant is free" half. It did not close the other half: with enough
 * gems for two, a second tap in the same React batch is charged again and buys
 * nothing, because the thing being bought is already in the state it produces.
 *
 * `recoverFromScandal` reads the scandal from the STALE outer `gameState` and
 * never re-checked `prev.socialMedia?.activeScandal`.
 * `ScandalRecoveryModal.handleChoice` has no in-flight guard and renders its
 * four options as plain `Pressable`s, so two taps in one batch cleared the same
 * scandal twice: 500 gems debited twice, a duplicate `scandalHistory` entry and
 * `totalScandalsSurvived` double-incremented. The `lawsuit` branch charges
 * $5,000 through `updateMoney` OUTSIDE the updater, so a double tap there was
 * $10,000 for one clear.
 *
 * `boostProfile` re-checked gems but not the boost: a second tap debited
 * another BOOST_GEM_COST and rewrote `expiresWeek` to the same value, so
 * 100 gems bought one week of boost.
 *
 * CLAUDE.md §4.4 — the charge and the effect must be decided against the same
 * `prev`. 2026-07-31 audit round 4.
 */
import { recoverFromScandal } from '@/contexts/game/actions/PulseActions';
import { boostProfile } from '@/contexts/game/actions/SparkActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, PulseActiveScandal } from '@/contexts/game/types';

/**
 * A setState that applies updaters against a SHARED mutable state but hands
 * both callers the SAME stale outer snapshot — which is exactly what React does
 * when two taps land in one batch.
 */
function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') {
      throw new Error('action wrote a raw value instead of a functional updater');
    }
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

const SCANDAL: PulseActiveScandal = {
  id: 'sc-1',
  type: 'bad_take',
  severity: 60,
  weeksRemaining: 4,
  startedWeek: 10,
  reputationLossThisWeek: 5,
  followerLossThisWeek: 1_000,
  headline: 'Influencer under fire',
};

function withScandal(gems: number, money = 1_000_000): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, gems, money },
    weeksLived: 12,
    socialMedia: {
      ...(base.socialMedia ?? {}),
      activeScandal: SCANDAL,
      scandalHistory: [],
    } as never,
  });
}

describe('recoverFromScandal rejects a same-batch second tap', () => {
  it('the fixture starts with an active scandal (guards everything below)', () => {
    expect(withScandal(5_000).socialMedia?.activeScandal?.id).toBe('sc-1');
  });

  it('charges gems exactly once for one scandal', () => {
    const snapshot = withScandal(5_000);
    const { setState, get } = batched(snapshot);

    recoverFromScandal(setState, snapshot, 'gems');
    // Same stale snapshot both times — the modal cannot see the first result.
    recoverFromScandal(setState, snapshot, 'gems');

    const spent = 5_000 - (get().stats.gems ?? 0);
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBe(500);
  });

  it('writes exactly one history entry and one survival', () => {
    const snapshot = withScandal(5_000);
    const { setState, get } = batched(snapshot);

    recoverFromScandal(setState, snapshot, 'gems');
    recoverFromScandal(setState, snapshot, 'gems');

    expect(get().socialMedia?.scandalHistory ?? []).toHaveLength(1);
    expect(get().socialMedia?.activeScandal ?? null).toBeNull();
  });

  it('a genuine second scandal can still be cleared (not over-blocked)', () => {
    // The control. Guarding on `activeScandal` must not make the action
    // one-shot per save.
    const snapshot = withScandal(5_000);
    const { setState, get } = batched(snapshot);

    recoverFromScandal(setState, snapshot, 'gems');
    const afterFirst = get();

    const reArmed = createTestGameState({
      ...afterFirst,
      socialMedia: { ...afterFirst.socialMedia, activeScandal: { ...SCANDAL, id: 'sc-2' } } as never,
    });
    const second = batched(reArmed);
    recoverFromScandal(second.setState, reArmed, 'gems');

    expect(second.get().socialMedia?.scandalHistory ?? []).toHaveLength(2);
    expect(5_000 - (second.get().stats.gems ?? 0)).toBe(1_000);
  });
});

describe('boostProfile rejects a same-batch second tap', () => {
  function sparkState(gems: number): GameState {
    const base = createTestGameState();
    return createTestGameState({ stats: { ...base.stats, gems }, weeksLived: 12 });
  }

  it('charges for one boost, not two', () => {
    const snapshot = sparkState(5_000);
    const { setState, get } = batched(snapshot);

    boostProfile(setState, snapshot);
    const afterOne = 5_000 - (get().stats.gems ?? 0);
    boostProfile(setState, snapshot);

    expect(afterOne).toBeGreaterThan(0);
    expect(5_000 - (get().stats.gems ?? 0)).toBe(afterOne);
  });

  it('leaves exactly one boost window running', () => {
    // Passes against the unfixed code too — the second tap overwrote
    // `expiresWeek` with the same value, which is precisely why the player got
    // nothing for the second 50 gems. Kept as the invariant the fix must not
    // break; the charge assertion above is the discriminator.
    const snapshot = sparkState(5_000);
    const { setState, get } = batched(snapshot);

    boostProfile(setState, snapshot);
    const firstExpiry = get().sparkApp?.boost?.expiresWeek;
    boostProfile(setState, snapshot);

    expect(firstExpiry).toBeGreaterThan(12);
    expect(get().sparkApp?.boost?.expiresWeek).toBe(firstExpiry);
  });

  it('a boost bought after the old one expires still charges', () => {
    // The control: the guard is "already running", not "ever bought".
    const snapshot = sparkState(5_000);
    const first = batched(snapshot);
    boostProfile(first.setState, snapshot);
    const cost = 5_000 - (first.get().stats.gems ?? 0);

    const expired = createTestGameState({ ...first.get(), weeksLived: 9_999 });
    const second = batched(expired);
    boostProfile(second.setState, expired);

    expect(5_000 - (second.get().stats.gems ?? 0)).toBe(2 * cost);
  });
});
