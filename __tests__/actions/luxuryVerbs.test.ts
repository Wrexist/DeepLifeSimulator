/**
 * Performing a luxury verb, end to end.
 *
 * The unit tests cover the outcome tables; this drives the real action to prove
 * the money, the cooldown and — most importantly — the anti-reroll guarantee.
 * Without a committed roll, every bad outcome would be undoable by force-quitting.
 */

import { performLuxuryVerb, sellLuxuryItem } from '@/contexts/game/actions/LuxuryActions';
import { createTestGameState } from '../helpers/createTestGameState';
import { getLuxuryVerb, MUSEUM_LOAN_WEEKS } from '@/lib/luxury';
import type { GameState } from '@/contexts/game/types';

const RACE = getLuxuryVerb('race_horse')!;
const TRACK = getLuxuryVerb('track_day')!;

function ownerState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({
    weeksLived: 500,
    stats: { ...createTestGameState().stats, money: 10_000_000, energy: 100 },
    luxuryItems: ['racehorse', 'supercar', 'museum_diamond'],
    luxuryHoldings: {},
    ...overrides,
  });
}

function run(state: GameState, verbId: string) {
  let current = state;
  const set = (u: (prev: GameState) => GameState) => {
    current = u(current);
  };
  const result = performLuxuryVerb(current, set as never, verbId);
  return { result, state: current };
}

describe('performLuxuryVerb', () => {
  it('refuses a verb the player has no item for', () => {
    const { result } = run(ownerState({ luxuryItems: [] }), 'race_horse');
    expect(result.success).toBe(false);
  });

  it('refuses an unknown verb', () => {
    expect(run(ownerState(), 'ride_the_diamond').result.success).toBe(false);
  });

  it('charges the entry fee and stamps the cooldown', () => {
    const before = ownerState();
    const { result, state } = run(before, 'race_horse');

    expect(result.success).toBe(true);
    expect(state.luxuryHoldings!.racehorse.lastActionWeek).toBe(500);
    // Net = outcome money minus the entry fee, in one movement.
    const net = (result.outcome!.money ?? 0) - RACE.cost;
    expect(state.stats.money).toBe(before.stats.money + net);
  });

  it('spends energy', () => {
    const before = ownerState();
    const { state } = run(before, 'track_day');
    expect(state.stats.energy).toBe(before.stats.energy - TRACK.energyCost);
  });

  it('commits the roll so the week cannot be rerolled by reloading', () => {
    // The whole point: force-quitting after a bad race must not produce a
    // different result on reload.
    const { result: first, state } = run(ownerState(), 'race_horse');
    expect(state.rngCommitLog).toBeTruthy();

    // Replay the same week from the committed state (cooldown cleared so the
    // action is allowed to run again) — the roll must resolve identically.
    const replayed = {
      ...state,
      luxuryHoldings: { ...state.luxuryHoldings, racehorse: { acquiredWeek: 0 } },
    } as GameState;
    const { result: second } = run(replayed, 'race_horse');

    expect(second.outcome!.message).toBe(first.outcome!.message);
    expect(second.outcome!.money).toBe(first.outcome!.money);
  });

  it('is atomic against a double-tap', () => {
    const start = ownerState();
    let current = start;
    const set = (u: (prev: GameState) => GameState) => {
      current = u(current);
    };
    performLuxuryVerb(start, set as never, 'race_horse');
    performLuxuryVerb(start, set as never, 'race_horse'); // stale snapshot

    // Only one entry fee charged, one run recorded.
    expect(current.luxuryHoldings!.racehorse.runs).toBe(1);
  });

  it('respects the cooldown on a second attempt', () => {
    const { state } = run(ownerState(), 'race_horse');
    const { result } = run(state, 'race_horse');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Ready in');
  });

  it('builds a career record across races', () => {
    let state = ownerState();
    for (let i = 0; i < 4; i += 1) {
      state = { ...state, weeksLived: 500 + i * RACE.cooldownWeeks };
      state = run(state, 'race_horse').state;
    }
    expect(state.luxuryHoldings!.racehorse.runs).toBe(4);
    expect(state.luxuryHoldings!.racehorse.wins).toBeLessThanOrEqual(4);
  });
});

describe('museum loan blocks the sale', () => {
  it('puts the diamond out of reach until it returns', () => {
    const { state: loaned } = run(ownerState(), 'museum_loan');
    expect(loaned.luxuryHoldings!.museum_diamond.loanedUntilWeek).toBe(500 + MUSEUM_LOAN_WEEKS);

    let current = loaned;
    const set = (u: (prev: GameState) => GameState) => {
      current = u(current);
    };
    const sale = sellLuxuryItem(current, set as never, 'museum_diamond');

    expect(sale.success).toBe(false);
    expect(sale.message).toContain('on loan');
    expect(current.luxuryItems).toContain('museum_diamond');
  });

  it('releases it once the loan expires', () => {
    const { state: loaned } = run(ownerState(), 'museum_loan');
    const later = { ...loaned, weeksLived: 500 + MUSEUM_LOAN_WEEKS };

    let current = later;
    const set = (u: (prev: GameState) => GameState) => {
      current = u(current);
    };
    const sale = sellLuxuryItem(current, set as never, 'museum_diamond');

    expect(sale.success).toBe(true);
    expect(current.luxuryItems).not.toContain('museum_diamond');
  });
});
