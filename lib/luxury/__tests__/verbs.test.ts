/**
 * Luxury verbs — things you DO with a trophy.
 *
 * The verbs on a luxury item were "buy" and "sell", and sell is mistake-undo.
 * These tests pin the three new ones and, more importantly, the boundaries that
 * stop them being free stat top-ups: cooldowns, real costs, and a track day that
 * can genuinely go wrong.
 */

import {
  LUXURY_VERBS,
  MUSEUM_LOAN_WEEKS,
  MUSEUM_LOAN_WEEKLY_FEE,
  getLuxuryVerb,
  getVerbAvailability,
  verbsForItem,
  resolveRace,
  resolveTrackDay,
  resolveMuseumLoan,
  isOnLoan,
  getLoanIncome,
} from '../verbs';
import { getLuxuryItem } from '../operations';
import type { GameState, LuxuryHolding } from '@/contexts/game/types';
import { createTestGameState, type TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';

const RACE = getLuxuryVerb('race_horse')!;
const TRACK = getLuxuryVerb('track_day')!;
const LOAN = getLuxuryVerb('museum_loan')!;

function makeState(overrides: TestGameStateOverrides = {}): GameState {
  const { stats, ...rest } = overrides;
  return createTestGameState({
    weeksLived: 500,
    luxuryItems: ['racehorse', 'supercar', 'museum_diamond'],
    luxuryHoldings: {},
    ...rest,
    stats: { money: 10_000_000, energy: 100, happiness: 50, reputation: 20, ...(stats ?? {}) },
  });
}

describe('verb catalog', () => {
  it('attaches every verb to a real catalog item', () => {
    for (const verb of LUXURY_VERBS) {
      expect(getLuxuryItem(verb.itemId)).toBeTruthy();
      expect(verb.label.length).toBeGreaterThan(3);
      expect(verb.cooldownWeeks).toBeGreaterThan(0);
    }
  });

  it('finds verbs by item', () => {
    expect(verbsForItem('racehorse').map((v) => v.id)).toEqual(['race_horse']);
    expect(verbsForItem('private_jet')).toEqual([]);
  });
});

describe('availability', () => {
  it('needs the item', () => {
    const result = getVerbAvailability(RACE, makeState({ luxuryItems: [] }));
    expect(result.available).toBe(false);
    expect(result.reason).toContain('do not own');
  });

  it('is available on a brand-new item that has never been used', () => {
    // The cooldown must treat "never done" as infinitely long ago. Reading an
    // absent lastActionWeek as week 0 would put every verb on cooldown for an
    // item bought late in a life.
    expect(getVerbAvailability(RACE, makeState()).available).toBe(true);
  });

  it('enforces the cooldown after use', () => {
    const state = makeState({
      weeksLived: 501,
      luxuryHoldings: { racehorse: { acquiredWeek: 1, lastActionWeek: 500 } },
    });
    const result = getVerbAvailability(RACE, state);

    expect(result.available).toBe(false);
    expect(result.weeksRemaining).toBe(RACE.cooldownWeeks - 1);
    expect(result.reason).toContain('Ready in');
  });

  it('frees up once the cooldown elapses', () => {
    const state = makeState({
      weeksLived: 500 + RACE.cooldownWeeks,
      luxuryHoldings: { racehorse: { acquiredWeek: 1, lastActionWeek: 500 } },
    });
    expect(getVerbAvailability(RACE, state).available).toBe(true);
  });

  it('needs the entry fee', () => {
    const broke = makeState({ stats: { money: 100, energy: 100 } as never });
    expect(getVerbAvailability(RACE, broke).reason).toContain('Costs');
  });

  it('needs the energy', () => {
    const tired = makeState({ stats: { money: 10_000_000, energy: 1 } as never });
    expect(getVerbAvailability(TRACK, tired).reason).toContain('energy');
  });

  it('survives a malformed state', () => {
    expect(() => getVerbAvailability(RACE, null)).not.toThrow();
    expect(getVerbAvailability(RACE, null).available).toBe(false);
  });
});

describe('racing', () => {
  it('wins on a low roll and records the run', () => {
    const outcome = resolveRace(0.01, undefined);
    expect(outcome.good).toBe(true);
    expect(outcome.money).toBeGreaterThan(RACE.cost);
    expect(outcome.holdingPatch).toEqual({ runs: 1, wins: 1 });
  });

  it('loses on a high roll and still records the run', () => {
    const outcome = resolveRace(0.99, undefined);
    expect(outcome.good).toBe(false);
    expect(outcome.money).toBe(0);
    expect(outcome.holdingPatch).toEqual({ runs: 1, wins: 0 });
  });

  it('places in the middle - the prize softens the entry but does not cover it', () => {
    // A place must return LESS than the entry. If it returns more (the old $30k
    // place vs $25k entry), then win AND place both profit — 2 of 3 outcomes —
    // and racing is a money printer (weekly audit 2026-07-28).
    const outcome = resolveRace(0.4, undefined);
    expect(outcome.good).toBe(true);
    expect(outcome.money).toBeGreaterThan(0);
    expect(outcome.money).toBeLessThan(RACE.cost);
  });

  it('is negative-EV at base form - racing is a cost, not an income stream', () => {
    // The whole verb must not be a printer. Over the base outcome distribution
    // (25% win, 25% place, 50% unplaced), the expected NET return after the
    // entry must be <= 0, so an unproven horse loses money on average. resolveRace
    // returns the purse EXCLUDING the entry, so subtract it in each band.
    const entry = RACE.cost;
    const win = resolveRace(0.0, undefined).money; // pct 0  -> win
    const place = resolveRace(0.4, undefined).money; // pct 40 -> place
    const unplaced = resolveRace(0.99, undefined).money; // pct 99 -> unplaced
    // Base EV is negative, but a WIN must still turn a profit — otherwise the
    // "only a win pays" invariant could be satisfied by a win that also loses.
    expect(win).toBeGreaterThan(entry);
    const ev = 0.25 * (win - entry) + 0.25 * (place - entry) + 0.5 * (unplaced - entry);
    expect(ev).toBeLessThanOrEqual(0);
  });

  it('stays a net loss over the cooldown even fully campaigned', () => {
    // The comment on resolveRace claims a maxed horse's positive per-race EV is
    // outweighed by upkeep (net of yield) over the cooldown. Make that claim
    // executable rather than trusting the prose. Max form is formBonus 15
    // (a perfect record) -> winChance 40%, placeChance 65%, so the outcome bands
    // are win 40% / place 25% / unplaced 35%. Payouts come from resolveRace
    // itself; the carrying cost comes from the real catalog constants.
    const maxed: LuxuryHolding = { acquiredWeek: 0, runs: 50, wins: 50 };
    const entry = RACE.cost;
    const win = resolveRace(0.0, maxed).money; // pct 0  -> win band
    const place = resolveRace(0.5, maxed).money; // pct 50 in [40,65) -> place band
    const unplaced = resolveRace(0.99, maxed).money; // pct 99 -> unplaced band
    const perRaceEV = 0.4 * (win - entry) + 0.25 * (place - entry) + 0.35 * (0 - entry);

    const horse = getLuxuryItem('racehorse');
    if (!horse) throw new Error('racehorse missing from the luxury catalog');
    // One race per cooldown, so the net over a full cycle is the race EV minus
    // the cost of holding the horse (upkeep net of its own yield) for those
    // weeks. That must be <= 0, or a campaigned horse net-prints.
    const carryPerWeek = horse.weeklyUpkeep - (horse.yield?.weekly ?? 0);
    const netOverCooldown = perRaceEV - carryPerWeek * RACE.cooldownWeeks;
    expect(netOverCooldown).toBeLessThanOrEqual(0);
  });

  it('a campaigned horse wins more often than an unraced one', () => {
    // Form is the reason to keep racing rather than doing it once.
    const green: LuxuryHolding = { acquiredWeek: 0 };
    const proven: LuxuryHolding = { acquiredWeek: 0, runs: 10, wins: 8 };

    const rollJustAboveBase = 0.3; // above the 25% base, below a formed horse's
    expect(resolveRace(rollJustAboveBase, green).good).toBe(true); // places
    expect(resolveRace(rollJustAboveBase, proven).holdingPatch!.wins).toBe(9); // wins
  });

  it('caps form so a perfect record is not a guaranteed win', () => {
    const perfect: LuxuryHolding = { acquiredWeek: 0, runs: 50, wins: 50 };
    // A 99th-percentile roll must still lose, however good the horse.
    expect(resolveRace(0.99, perfect).good).toBe(false);
  });

  it('never pays enough to farm', () => {
    // Best case must stay a windfall, not an income stream: one win every three
    // weeks against a $4,500/wk upkeep and a $25,000 entry.
    const best = resolveRace(0, { acquiredWeek: 0, runs: 100, wins: 100 });
    expect(best.money).toBeLessThan(200_000);
  });
});

describe('track day', () => {
  it('mostly goes well', () => {
    const good = resolveTrackDay(0.9);
    expect(good.good).toBe(true);
    expect(good.happiness).toBeGreaterThan(0);
    expect(good.reputation).toBeGreaterThan(0);
  });

  it('can go expensively wrong', () => {
    // The crash risk is what stops this being a free weekly stat top-up.
    const crash = resolveTrackDay(0.01);
    expect(crash.good).toBe(false);
    expect(crash.money).toBeLessThan(0);
    expect(Math.abs(crash.money)).toBeGreaterThan(TRACK.cost * 5);
  });

  it('clamps a nonsense roll instead of throwing', () => {
    expect(() => resolveTrackDay(5)).not.toThrow();
    expect(() => resolveTrackDay(-5)).not.toThrow();
  });
});

describe('museum loan', () => {
  it('puts the piece out for a fixed term', () => {
    const outcome = resolveMuseumLoan(100);
    expect(outcome.reputation).toBeGreaterThan(0);
    expect(outcome.holdingPatch!.loanedUntilWeek).toBe(100 + MUSEUM_LOAN_WEEKS);
  });

  it('is on loan until the term ends, then is not', () => {
    const holding: LuxuryHolding = { acquiredWeek: 0, loanedUntilWeek: 112 };
    expect(isOnLoan(holding, 100)).toBe(true);
    expect(isOnLoan(holding, 111)).toBe(true);
    expect(isOnLoan(holding, 112)).toBe(false);
    expect(isOnLoan(holding, 200)).toBe(false);
  });

  it('treats an item that was never loaned as available', () => {
    expect(isOnLoan(undefined, 10)).toBe(false);
    expect(isOnLoan({ acquiredWeek: 0 }, 10)).toBe(false);
  });

  it('pays a weekly fee only while on display', () => {
    const ids = ['museum_diamond'];
    const onLoan = { museum_diamond: { acquiredWeek: 0, loanedUntilWeek: 112 } };

    expect(getLoanIncome(ids, onLoan, 100)).toBe(MUSEUM_LOAN_WEEKLY_FEE);
    expect(getLoanIncome(ids, onLoan, 120)).toBe(0);
    expect(getLoanIncome(ids, {}, 100)).toBe(0);
    expect(getLoanIncome(null, null, 100)).toBe(0);
  });

  it('costs nothing to arrange, unlike the other verbs', () => {
    expect(LOAN.cost).toBe(0);
    expect(LOAN.energyCost).toBe(0);
  });

  it('never out-earns the diamond it belongs to (no printer)', () => {
    // The loan is free to arrange and its cooldown equals its term, so it is
    // continuously re-armable. Exercise the ACTUAL income path — getLoanIncome
    // for a diamond currently on loan — not just the constant, so a future
    // multiplier or hardcoded payout in that function can't reintroduce the
    // exploit while this test stays green. The effective weekly income must stay
    // below the item's own upkeep, or it is an uncapped weekly money printer
    // (weekly audit 2026-07-28: the old $4,000 fee netted +$3,800/wk over the
    // $200 upkeep).
    const diamond = getLuxuryItem('museum_diamond');
    if (!diamond) throw new Error('museum_diamond missing from the luxury catalog');
    const onLoan = { museum_diamond: { acquiredWeek: 0, loanedUntilWeek: 999 } };
    const weeklyIncome = getLoanIncome(['museum_diamond'], onLoan, 100);
    expect(weeklyIncome).toBe(MUSEUM_LOAN_WEEKLY_FEE); // sanity: the loan is paying
    expect(weeklyIncome).toBeLessThan(diamond.weeklyUpkeep);
  });
});
