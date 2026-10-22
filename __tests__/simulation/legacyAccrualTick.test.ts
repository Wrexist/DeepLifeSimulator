/**
 * LATE-1 on the production week loop: Legacy Points accrue +2 per 10 PLAYED
 * weeks (+1 per prestige level), keyed on `weeksInThisLife`, not on the
 * absolute `weeksLived` counter. The pure rule is pinned in
 * `__tests__/prestige/legacyAccrual.test.ts`; this proves the tick reads it.
 */
import { runPersona, withStartingAge } from '../helpers/earlyGameSim';

// Exercise the production week transition without background disk writes.
jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

describe('LATE-1 - legacy point accrual on the real weekly tick', () => {
  jest.setTimeout(120000);

  const run = (prestigeLevel: number) => runPersona({
    name: 'legacy-accrual',
    weeks: 15,
    seed: 7,
    policy: () => {},
    mutateSeed: (s) => ({
      ...withStartingAge(s, 25),
      legacyPoints: 0,
      prestige: { ...s.prestige!, prestigeLevel },
    }),
  });

  const played = (r: Awaited<ReturnType<typeof run>>) =>
    r.finalState.weeksLived - (r.finalState.lifeStartWeek ?? 0);

  it('an age-25 start earns 2 LP per 10 played weeks, not floor(weeksLived/10)', async () => {
    const r = await run(0);
    // One grant (played week 10), so the assertion is not vacuous. An idle
    // life is not kept longer: it dies of unhappiness near week 19.
    expect(r.died).toBe(false);
    expect(played(r)).toBeGreaterThanOrEqual(10);
    expect(played(r)).toBeLessThan(20);
    // The old rule from weeksLived 364 paid 37 at week 370 and 38 at 380.
    expect(r.finalState.legacyPoints).toBe(2);
  });

  it('adds +1 per prestige level to each grant', async () => {
    const r = await run(3);
    expect(played(r)).toBeGreaterThanOrEqual(10);
    expect(played(r)).toBeLessThan(20);
    expect(r.finalState.legacyPoints).toBe(5);
  });
});
