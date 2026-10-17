/**
 * Every achievement can actually be earned (2026-10-17 content audit).
 *
 * Reputation goals of 500 / 1,000 / 5,000 on a 0-100 stat, "own 100 items"
 * from an 8-item shop, 20 degrees from 11 programmes, 25 of 17 destinations,
 * 100% job performance on a formula that tops out at 80 - each was a row on
 * the achievements screen that no life could ever complete.
 *
 * The sweep is generic so a new achievement inherits it: build a state with
 * every BOUNDED source maxed out (stats at their cap, every item owned, every
 * programme completed, every destination visited) and require each counter
 * achievement that reads one of them to be completable there. Achievements
 * reading unbounded sources (money, weeks, trips) do not move between the two
 * states and are skipped.
 */
import { achievements } from '@/src/features/onboarding/achievementsData';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import { DESTINATIONS } from '@/lib/travel/destinations';
import { calculatePerformance } from '@/lib/events/careerEvents';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const base = createTestGameState({});

function maxedBounded(): GameState {
  return createTestGameState({
    stats: { ...base.stats, health: 100, happiness: 100, energy: 100, fitness: 100, reputation: 100 },
    // Price 0 so owning everything does not also move net-worth achievements,
    // which read an unbounded source and are out of scope here.
    items: (base.items || []).map((i) => ({ ...i, owned: true, price: 0 })),
    educations: EDUCATION_PROGRAMS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      cost: 0,
      duration: p.duration,
      completed: true,
    })),
    travel: { ...(base.travel ?? {}), visitedDestinations: DESTINATIONS.map((d) => d.id) } as GameState['travel'],
  });
}

describe('bounded achievements are reachable', () => {
  const maxed = maxedBounded();

  it.each(
    achievements
      .filter((a) => a.progressSpec.kind === 'counter')
      .map((a) => [a.id, a] as const),
  )('%s', (_id, a) => {
    if (a.progressSpec.kind !== 'counter') return;
    const before = a.progressSpec.current(base);
    const ceiling = a.progressSpec.current(maxed);
    if (ceiling <= before) return; // reads an unbounded source: out of scope
    expect(a.progressSpec.goal).toBeLessThanOrEqual(ceiling);
  });

  it('the sweep is not vacuous: it covers the reputation, collector, education and travel ladders', () => {
    const covered = achievements.filter(
      (a) => a.progressSpec.kind === 'counter' && a.progressSpec.current(maxed) > a.progressSpec.current(base),
    ).map((a) => a.id);
    for (const id of ['reputation_mythic', 'collector_legend', 'professor', 'travel_globetrotter']) {
      expect(covered).toContain(id);
    }
  });
});

describe('Top Performer targets the performance ceiling', () => {
  const peak = calculatePerformance({ energy: 100, happiness: 100, health: 100 });
  const topPerformer = achievements.find((a) => a.id === 'career_top_performer')!;
  const met = (performance: number) =>
    topPerformer.progressSpec.kind === 'boolean' &&
    topPerformer.progressSpec.met(
      createTestGameState({ careers: [{ ...(base.careers?.[0] ?? {}), id: 'x', accepted: true, performance } as never] }),
    );

  it('is earnable at the formula maximum', () => {
    expect(met(peak)).toBe(true);
  });

  it('is not handed out below it', () => {
    expect(met(peak - 1)).toBe(false);
  });
});

describe('political ranks match the offices they are named after', () => {
  // politics.careerLevel is the 1-based office rank: 1 Council Member,
  // 2 Mayor, 3 State Representative, 4 Governor, 5 Senator, 6 President.
  const at = (careerLevel: number) =>
    createTestGameState({ politics: { ...base.politics!, careerLevel } });
  const earned = (id: string, careerLevel: number) => {
    const a = achievements.find((x) => x.id === id)!;
    return a.progressSpec.kind === 'boolean' && a.progressSpec.met(at(careerLevel));
  };

  it.each([
    ['mayor', 2],
    ['governor', 4],
    ['president', 6],
  ])('%s unlocks at rank %s and not one rung earlier', (id, rank) => {
    expect(earned(id as string, rank as number)).toBe(true);
    expect(earned(id as string, (rank as number) - 1)).toBe(false);
  });
});
