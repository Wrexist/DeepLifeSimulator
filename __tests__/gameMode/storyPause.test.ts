/**
 * The story-run stop decision, and the line it produces.
 *
 * `shouldStopBatch` is pure precisely BECAUSE it cannot be tested through the
 * run loop: React defers every updater queued inside one `act()` block until
 * the block exits, so a test driving the loop observes post-tick state as null
 * for the whole run and could never see a stop fire. Verified that way round —
 * the first attempt at the danger stop checked state inside the loop, the
 * integration test still reported a week-15 death, and the reason was the
 * harness rather than the logic.
 *
 * `describePause` is tested alongside it because the pair is the whole feature
 * now: the run stops, and one sentence says why. There is no digest, no
 * summary and no recap modal to test — deleting them is what this file's
 * shrinkage records.
 */
import {
  shouldStopBatch,
  describePause,
  wasAGoodRun,
  STORY_WEEK_MS,
  type StoryPause,
} from '@/lib/gameMode/mode';

const pause = (over: Partial<StoryPause> = {}): StoryPause => ({
  weeksAdvanced: 52,
  reason: null,
  netWorthBefore: 1000,
  netWorthAfter: 1000,
  ...over,
});

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

describe('describePause — the one line the player gets', () => {
  it('names the illness and says what to do about it', () => {
    const line = describePause(pause({ reason: 'illness', illnessName: 'Allergies', weeksAdvanced: 11 }));
    expect(line).toContain('allergies');
    expect(line).toContain('Health');
  });

  it('falls back to a sentence that still works when the name is missing', () => {
    const line = describePause(pause({ reason: 'illness', weeksAdvanced: 11 }));
    expect(line).toMatch(/fallen ill/i);
    expect(line).toContain('Health');
  });

  it('tells a player in danger what to DO, not what they can already see', () => {
    // A player handed the wheel back at 14 happiness needs an action. The HUD
    // already shows them the number.
    const line = describePause(pause({ reason: 'danger', weeksAdvanced: 9 }));
    expect(line).toMatch(/rest|earn|friends/i);
  });

  it('reports a quiet full year with the weeks it ran', () => {
    expect(describePause(pause({ weeksAdvanced: 52 }))).toContain('52');
  });

  it('never says a year passed when none did', () => {
    expect(describePause(pause({ weeksAdvanced: 0 }))).toMatch(/no time/i);
  });
});

describe('wasAGoodRun — who gets asked for money', () => {
  it('accepts a long uninterrupted run that grew net worth', () => {
    expect(wasAGoodRun(pause({ netWorthBefore: 1000, netWorthAfter: 5000 }))).toBe(true);
  });

  it('refuses a run cut short by illness, however profitable', () => {
    // Asking for money immediately after handing back a life in trouble is the
    // worst possible moment, and profit does not redeem it.
    expect(
      wasAGoodRun(pause({ reason: 'illness', netWorthBefore: 1000, netWorthAfter: 900000 }))
    ).toBe(false);
  });

  it('refuses a run cut short by danger', () => {
    expect(wasAGoodRun(pause({ reason: 'danger', netWorthAfter: 900000 }))).toBe(false);
  });

  it('refuses a short run even when uninterrupted', () => {
    expect(wasAGoodRun(pause({ weeksAdvanced: 10, netWorthAfter: 900000 }))).toBe(false);
  });

  it('refuses a flat or shrinking net worth', () => {
    expect(wasAGoodRun(pause({ netWorthAfter: 1000 }))).toBe(false);
    expect(wasAGoodRun(pause({ netWorthAfter: 400 }))).toBe(false);
  });
});

describe('pacing', () => {
  it('keeps a full year watchable rather than instant', () => {
    // Fast enough that 52 weeks is a few seconds, slow enough to read the
    // numbers moving. Instant would be the old blocked batch with extra steps.
    expect(STORY_WEEK_MS).toBeGreaterThan(30);
    expect(STORY_WEEK_MS * 52).toBeLessThan(15000);
  });
});
