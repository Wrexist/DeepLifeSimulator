/**
 * The weekly vital-drift projection — the recap line that names why the rings
 * fall (Program 6, consequence clarity).
 *
 * Two things are pinned here:
 *  1. PARITY with the tick. The natural-decay formula is restated in `lib/`
 *     (lib may not import from contexts), so this test drives both through the
 *     same states and fails if they ever disagree.
 *  2. The fresh quick-start truth: a new life with the first job and no home
 *     is told about all three drains, worst first.
 */
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';
import { computeDecayInputs } from '@/contexts/game/actions/weekly/preTick';
import { getStatDecayMultiplier } from '@/lib/prestige/applyBonuses';
import { HOMELESS_PENALTY } from '@/lib/realEstate/rentals';
import { driftDrainLabels, projectWeeklyVitalDrift, projectedDecayRate } from '../vitalDrift';
import type { GameState } from '@/contexts/game/types';

const freshQuickStart = (extra: Partial<GameState> = {}): GameState => {
  const base = createTestGameState();
  return createTestGameState({
    ...base,
    weeksLived: 104, // age-20 seed (CLAUDE.md §4.2)
    lifeStartWeek: 104,
    stats: { ...base.stats, money: 1_500, health: 100, happiness: 100, energy: 100 },
    bankSavings: 0,
    realEstate: [],
    rental: undefined,
    currentJob: 'fast_food',
    careers: (base.careers ?? []).map((c) =>
      c.id === 'fast_food' ? { ...c, applied: true, accepted: true, level: 0 } : c,
    ),
    ...extra,
  });
};

describe('projectedDecayRate matches the tick', () => {
  const cases: [string, GameState][] = [
    ['fresh quick start, week 0', freshQuickStart()],
    ['week 4 of the grace ramp', freshQuickStart({ weeksLived: 108 })],
    ['past the grace ramp', freshQuickStart({ weeksLived: 130 })],
    ['a comfortable life', freshQuickStart({ weeksLived: 200, stats: { ...createTestGameState().stats, money: 40_000 } })],
    [
      'with the prestige decay bonus',
      freshQuickStart({ prestige: { ...createTestGameState().prestige!, unlockedBonuses: ['stat_decay_reduction'] } }),
    ],
  ];

  it.each(cases)('%s', (_label, state) => {
    const tick = computeDecayInputs(state, {
      baseDecayRate: 4,
      prestigeMultiplier: getStatDecayMultiplier(state.prestige?.unlockedBonuses || []),
    });
    expect(projectedDecayRate(state)).toBeCloseTo(tick.effectiveDecayRate, 6);
  });
});

describe('the fresh quick start is told the whole truth', () => {
  it('names natural decay, no home and the job toll, worst first', () => {
    const drift = projectWeeklyVitalDrift(freshQuickStart({ weeksLived: 112 })); // full decay
    const ids = drift.causes.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['decay', 'home', 'job']));

    const home = drift.causes.find((c) => c.id === 'home')!;
    expect(home.label).toBe('No home');
    expect(home.happiness).toBe(HOMELESS_PENALTY.happiness);
    expect(home.health).toBe(HOMELESS_PENALTY.health);

    const job = drift.causes.find((c) => c.id === 'job')!;
    expect(job.label).toBe('Fast Food Worker shifts');
    expect(job.happiness).toBeLessThan(0);

    // Net: the slide at full decay for a $1.5k life. Program 6 measured ~-13
    // happiness / ~-9 health under the ×2 wealth ceiling; Program 7 capped that
    // multiplier at 1.0 (`lib/economy/statDecay.ts`), so the same life now
    // slides ~-10 / ~-6. Bounds, not exact values, so a tuning pass in the tick
    // does not fail a display test - the parity test above is the exact one.
    expect(drift.happiness).toBeLessThanOrEqual(-8);
    expect(drift.health).toBeLessThanOrEqual(-5);

    // Drains are listed worst first, and the labels are what the recap prints.
    // With the ×2 gone, the worst drain is the one the player can act on for
    // $45 a week - "No home" leads, and natural decay is named beside it.
    const labels = driftDrainLabels(drift);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels[0]).toBe('No home');
    expect(labels).toContain('Natural decay');
  });

  it('a housed, healthy, wealthy life drifts little and the home reads as a gain', () => {
    const rich = freshQuickStart({
      weeksLived: 400,
      stats: { ...createTestGameState().stats, money: 500_000 },
      rental: { tierId: 'shared-room', startedWeek: 300 },
    });
    const drift = projectWeeklyVitalDrift(rich);
    const home = drift.causes.find((c) => c.id === 'home');
    // A tenancy is a gain or nothing - never the homeless penalty.
    expect(home?.label ?? 'Your home').not.toBe('No home');
    expect(drift.happiness).toBeGreaterThan(-6);
  });

  it('never throws on a malformed state and reports rest for energy', () => {
    const broken = { ...createTestGameState(), careers: undefined, items: undefined, stats: undefined } as unknown as GameState;
    const drift = projectWeeklyVitalDrift(broken);
    expect(drift.causes.some((c) => c.id === 'decay')).toBe(true);
    expect(drift.causes.find((c) => c.id === 'rest')?.energy).toBeGreaterThan(0);
    expect(projectWeeklyVitalDrift(null).causes).toEqual([]);
  });
});
