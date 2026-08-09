/**
 * `summarizeYear` — the join between what a batch knows and what the store has.
 *
 * The split exists because a batch cannot honestly report the state it produced
 * from inside its own React callback (see `lib/gameMode/mode.ts`). These tests
 * pin the half that is pure: given a "before" digest and an "after" snapshot,
 * the summary must describe the year correctly — and, crucially, must derive
 * `weeksAdvanced` from the clock rather than trusting anything the loop counted.
 */

import { summarizeYear, resolveGameMode, isStoryMode, type YearDigest } from '@/lib/gameMode/mode';

function digestAt(weeksLived: number, age: number, money: number, netWorth: number): YearDigest {
  return {
    weeksRequested: 52,
    before: { weeksLived, age, money, netWorth },
    notes: [],
  };
}

describe('resolveGameMode', () => {
  it('reads an absent mode as classic, because that is what every old save is', () => {
    expect(resolveGameMode(undefined)).toBe('classic');
    expect(resolveGameMode(null)).toBe('classic');
    expect(isStoryMode(undefined)).toBe(false);
  });

  it('only "story" means story — a corrupt value degrades to the original game', () => {
    expect(resolveGameMode('story')).toBe('story');
    expect(resolveGameMode('nonsense' as never)).toBe('classic');
    expect(isStoryMode('story')).toBe(true);
  });
});

describe('summarizeYear', () => {
  it('derives weeks from the clock, not from the requested span', () => {
    const digest = digestAt(100, 20, 500, 900);
    const summary = summarizeYear(digest, {
      weeksLived: 118, // stopped short of 52
      age: 20.35,
      money: 700,
      netWorth: 1200,
      died: false,
      pendingDecisions: 0,
    });
    expect(summary.weeksAdvanced).toBe(18);
    expect(summary.outcome).toBe('year-complete');
  });

  it('computes signed deltas across both money axes', () => {
    const digest = digestAt(0, 18, 200, 200);
    const summary = summarizeYear(digest, {
      weeksLived: 52,
      age: 19,
      money: 150,
      netWorth: 5000,
      died: false,
      pendingDecisions: 0,
    });
    expect(summary.moneyDelta).toBe(-50);
    expect(summary.netWorthDelta).toBe(4800);
    expect(summary.moneyBefore).toBe(200);
    expect(summary.moneyAfter).toBe(150);
  });

  it('reports death above everything else', () => {
    const digest = digestAt(700, 31, 1000, 1000);
    const summary = summarizeYear(digest, {
      weeksLived: 715,
      age: 31.3,
      money: 0,
      netWorth: 0,
      died: true,
      pendingDecisions: 3, // present, but death is the headline
    });
    expect(summary.outcome).toBe('death');
  });

  it('flags queued decisions when the year otherwise ran clean', () => {
    const digest = digestAt(0, 18, 200, 200);
    const summary = summarizeYear(digest, {
      weeksLived: 52,
      age: 19,
      money: 900,
      netWorth: 900,
      died: false,
      pendingDecisions: 2,
    });
    expect(summary.outcome).toBe('decision');
  });

  it('reports "blocked" when the clock never moved', () => {
    const digest = digestAt(52, 19, 400, 400);
    const summary = summarizeYear(digest, {
      weeksLived: 52,
      age: 19,
      money: 400,
      netWorth: 400,
      died: false,
      pendingDecisions: 0,
    });
    expect(summary.weeksAdvanced).toBe(0);
    expect(summary.outcome).toBe('blocked');
  });

  it('never reports negative weeks if the clock somehow goes backwards', () => {
    const digest = digestAt(100, 20, 500, 500);
    const summary = summarizeYear(digest, {
      weeksLived: 90,
      age: 19.8,
      money: 500,
      netWorth: 500,
      died: false,
      pendingDecisions: 0,
    });
    expect(summary.weeksAdvanced).toBe(0);
    expect(summary.outcome).toBe('blocked');
  });

  it('carries the batch notes through untouched', () => {
    const digest = digestAt(0, 18, 200, 200);
    digest.notes = ['Rent paid', 'Promotion at work'];
    const summary = summarizeYear(digest, {
      weeksLived: 52,
      age: 19,
      money: 400,
      netWorth: 400,
      died: false,
      pendingDecisions: 0,
    });
    expect(summary.notes).toEqual(['Rent paid', 'Promotion at work']);
  });
});
