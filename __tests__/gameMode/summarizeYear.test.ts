/**
 * `summarizeYear` — the join between what a batch knows and what the store has.
 *
 * The split exists because a batch cannot honestly report the state it produced
 * from inside its own React callback (see `lib/gameMode/mode.ts`). These tests
 * pin the half that is pure: given a "before" digest and an "after" snapshot,
 * the summary must describe the year correctly — and, crucially, must derive
 * `weeksAdvanced` from the clock rather than trusting anything the loop counted.
 */

import { wasAGoodYear } from '@/components/YearInReviewModal';
import {
  summarizeYear,
  resolveGameMode,
  isStoryMode,
  isInDanger,
  shouldStopBatch,
  DANGER_THRESHOLD,
  type YearDigest,
} from '@/lib/gameMode/mode';

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

/**
 * The danger stop. This is the fix for the defect that made story mode's FIRST
 * TAP end in a funeral: a fresh character running 52 unattended weeks decays to
 * happiness 0 and the death rule fires. Measured twice independently — the jest
 * seed dies at week 15, a real browser session at ~week 11.
 */
describe('isInDanger', () => {
  it('flags a life at or below the threshold on either vital', () => {
    expect(isInDanger({ health: DANGER_THRESHOLD, happiness: 90 })).toBe(true);
    expect(isInDanger({ health: 90, happiness: DANGER_THRESHOLD })).toBe(true);
    expect(isInDanger({ health: 1, happiness: 100 })).toBe(true);
  });

  it('leaves a healthy life alone', () => {
    expect(isInDanger({ health: DANGER_THRESHOLD + 1, happiness: DANGER_THRESHOLD + 1 })).toBe(false);
    expect(isInDanger({ health: 100, happiness: 100 })).toBe(false);
  });

  it('reads a missing stat as SAFE, not as danger', () => {
    // A partial save with no `happiness` must not stop every batch after one
    // week. Absence of a number is not evidence of a problem.
    expect(isInDanger({})).toBe(false);
    expect(isInDanger(null)).toBe(false);
    expect(isInDanger(undefined)).toBe(false);
    expect(isInDanger({ health: 100 })).toBe(false);
  });

  it('sits clear of the 4-week grace the death rule gives', () => {
    // Death fires after happiness has been 0 for 4 consecutive weeks. Stopping
    // at 20 leaves room to actually do something about it; stopping at 1 would
    // be a jump-scare one week from the end.
    expect(DANGER_THRESHOLD).toBeGreaterThanOrEqual(10);
  });
});

describe('summarizeYear — the danger outcome', () => {
  const healthy = { weeksLived: 130, age: 20.6, money: 900, netWorth: 1400, died: false, pendingDecisions: 0 };

  it('reports danger when the batch says it stopped for danger', () => {
    const digest = { ...digestAt(100, 20, 500, 900), stoppedEarly: 'danger' as const };
    expect(summarizeYear(digest, healthy).outcome).toBe('danger');
  });

  it('ranks danger ABOVE a queued decision', () => {
    // A batch stopped for danger almost always has events queued too — six
    // queue in fifteen weeks on the test seed. Checking decisions first would
    // hide the reason the year actually ended.
    const digest = { ...digestAt(100, 20, 500, 900), stoppedEarly: 'danger' as const };
    const summary = summarizeYear(digest, { ...healthy, pendingDecisions: 4 });
    expect(summary.outcome).toBe('danger');
  });

  it('still ranks DEATH above danger', () => {
    const digest = { ...digestAt(100, 20, 500, 900), stoppedEarly: 'danger' as const };
    expect(summarizeYear(digest, { ...healthy, died: true }).outcome).toBe('death');
  });

  it('does not invent danger for a batch that halted on a broken tick', () => {
    // 'halted' is the failure case, not the deliberate one — telling the player
    // their life is in trouble when the real problem was a failed state update
    // would send them to fix a life that is fine.
    const digest = { ...digestAt(100, 20, 500, 900), stoppedEarly: 'halted' as const };
    expect(summarizeYear(digest, healthy).outcome).toBe('year-complete');
  });

  it('leaves an ordinary full year alone', () => {
    expect(summarizeYear(digestAt(100, 20, 500, 900), healthy).outcome).toBe('year-complete');
  });
});

/**
 * `shouldStopBatch` — the batch's stop decision, tested directly.
 *
 * It is a pure function precisely BECAUSE it cannot be tested through
 * `liveYear`: React defers every updater queued inside one `act()` block until
 * the block exits, so a test driving the loop observes the post-tick state as
 * null for the whole batch and could never see a danger stop fire. Verified
 * that way round: the first attempt at this fix checked the state inside the
 * loop, the integration test still reported a week-15 death, and the reason was
 * the harness rather than the logic.
 */
describe('shouldStopBatch', () => {
  const healthy = { health: 90, happiness: 90 };

  it('continues through an ordinary healthy week', () => {
    expect(shouldStopBatch({ advanced: true, startedInDanger: false, vitals: healthy })).toBeNull();
  });

  it('halts when the tick did not advance', () => {
    expect(shouldStopBatch({ advanced: false, startedInDanger: false, vitals: healthy })).toBe('halted');
  });

  it('reports a non-advancing tick as halted even when the life IS in danger', () => {
    // Failure outranks danger: a batch that stopped because a state update
    // failed must not tell the player to go rest.
    expect(shouldStopBatch({ advanced: false, startedInDanger: false, vitals: { happiness: 2 } })).toBe('halted');
  });

  it('stops when the life crosses INTO danger', () => {
    expect(shouldStopBatch({ advanced: true, startedInDanger: false, vitals: { happiness: 12, health: 80 } })).toBe('danger');
    expect(shouldStopBatch({ advanced: true, startedInDanger: false, vitals: { happiness: 80, health: 5 } })).toBe('danger');
  });

  it('does NOT nag a player who was already in danger when they tapped', () => {
    // Otherwise a life at 12 happiness stops after one week, every single tap,
    // and the fix costs weeks the player is never allowed to run — an
    // inescapable loop.
    expect(shouldStopBatch({ advanced: true, startedInDanger: true, vitals: { happiness: 5 } })).toBeNull();
  });

  it('continues when vitals cannot be read at all', () => {
    // Unreadable vitals are not evidence of danger. Stopping here would end
    // every batch after one week on any save the ref could not resolve.
    expect(shouldStopBatch({ advanced: true, startedInDanger: false, vitals: null })).toBeNull();
    expect(shouldStopBatch({ advanced: true, startedInDanger: false, vitals: undefined })).toBeNull();
  });

  // ── Illness: the stop that turned the feature around ────────────────────
  // Measurement found the real reason story years ended early, and it was not
  // decay. Baseline decay for a housed character is -0.6 happiness a week,
  // which is sustainable forever. A single untreated disease costs -2.0
  // happiness and -2.0 health a week for its whole course, and a batch is
  // exactly the situation in which nobody treats it. Handing the wheel back at
  // the moment of infection is what makes that survivable — and it is the mode
  // working, not failing.
  it('stops when a NEW illness is contracted', () => {
    expect(
      shouldStopBatch({ advanced: true, startedInDanger: false, vitals: healthy, newIllness: 'Allergies' })
    ).toBe('illness');
  });

  it('does NOT stop for an illness the player already had when they tapped', () => {
    // Same reasoning as `startedInDanger`: the loop only ever passes a disease
    // it has not seen before, so an ongoing illness reads as `null` here and
    // the batch runs on. Otherwise a chronic condition would stop every tap
    // after one week, forever.
    expect(
      shouldStopBatch({ advanced: true, startedInDanger: false, vitals: healthy, newIllness: null })
    ).toBeNull();
    expect(
      shouldStopBatch({ advanced: true, startedInDanger: false, vitals: healthy })
    ).toBeNull();
  });

  it('reports DANGER, not illness, when a week does both', () => {
    // Danger is the condition that ends lives; illness is the one that costs
    // stats. A player handed back at 8 happiness needs to hear about the 8.
    expect(
      shouldStopBatch({
        advanced: true,
        startedInDanger: false,
        vitals: { happiness: 8, health: 60 },
        newIllness: 'Flu',
      })
    ).toBe('danger');
  });

  it('still reports HALTED above everything else', () => {
    expect(
      shouldStopBatch({
        advanced: false,
        startedInDanger: false,
        vitals: { happiness: 4 },
        newIllness: 'Flu',
      })
    ).toBe('halted');
  });
});

describe('an illness stop reaches the player as a moment, not an error', () => {
  it('names the illness in the summary so the recap can say what happened', () => {
    const digest = {
      weeksRequested: 52,
      before: { weeksLived: 40, age: 20, money: 1000, netWorth: 1000 },
      notes: [],
      stoppedEarly: 'illness' as const,
      illnessName: 'Allergies',
    };
    const after = {
      weeksLived: 51,
      age: 20.2,
      money: 900,
      netWorth: 900,
      pendingDecisions: 0,
      isDead: false,
    };
    const summary = summarizeYear(digest, after);
    expect(summary.outcome).toBe('illness');
    expect(summary.illnessName).toBe('Allergies');
    expect(summary.weeksAdvanced).toBe(11);
  });

  it('is NOT counted as a good year for the upsell', () => {
    // The DeepLife+ offer fires on a year that went well. A year cut short by
    // illness is the opposite of the moment to ask for money.
    const digest = {
      weeksRequested: 52,
      before: { weeksLived: 0, age: 20, money: 1000, netWorth: 1000 },
      notes: [],
      stoppedEarly: 'illness' as const,
      illnessName: 'Flu',
    };
    const summary = summarizeYear(digest, {
      weeksLived: 40, age: 20.8, money: 90000, netWorth: 90000, pendingDecisions: 0, isDead: false,
    });
    expect(wasAGoodYear(summary)).toBe(false);
  });
});
