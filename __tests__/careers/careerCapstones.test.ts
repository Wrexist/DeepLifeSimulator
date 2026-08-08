/**
 * Career capstones — the tail a life sim's central system was missing.
 *
 * The advanced ladders topped out at 13–16 years of tenure and then never moved
 * again, so the thing the game is *about* stopped giving anything back well
 * before the flattening point at week ~900–1,100. Two rungs were added to each:
 * a Board Seat at 20 years in the same career and an Emeritus title at 30.
 *
 * This is pure data — `experienceRequired` is a shipped field that
 * `promotionGating` already enforces — so what needs pinning is that the data
 * is well formed and that the gate actually bites.
 */

import { ADVANCED_CAREERS } from '@/lib/careers/advancedCareers';
import { getPromotionEligibility } from '@/lib/careers/promotionGating';
import type { Career } from '@/contexts/game/types';

const BOARD_WEEKS = 1040;
const EMERITUS_WEEKS = 1560;

describe('every advanced ladder has a capstone', () => {
  it.each(ADVANCED_CAREERS.map((c) => [c.id, c] as const))(
    '%s ends in a Board Seat then an Emeritus rung',
    (_id, career) => {
      const names = career.levels.map((l) => l.name);
      expect(names[names.length - 2]).toBe('Board Seat');
      expect(names[names.length - 1]).toMatch(/Emeritus/);
    }
  );

  it.each(ADVANCED_CAREERS.map((c) => [c.id, c] as const))(
    '%s capstone tenure gates are 20 and 30 years',
    (_id, career) => {
      const levels = career.levels;
      expect(levels[levels.length - 2].experienceRequired).toBe(BOARD_WEEKS);
      expect(levels[levels.length - 1].experienceRequired).toBe(EMERITUS_WEEKS);
    }
  );
});

describe('the ladders stay monotonic', () => {
  it.each(ADVANCED_CAREERS.map((c) => [c.id, c] as const))(
    '%s salary never goes down as you climb',
    (_id, career) => {
      for (let i = 1; i < career.levels.length; i += 1) {
        const prev = career.levels[i - 1];
        const cur = career.levels[i];
        expect(`${cur.name}:${cur.salary > prev.salary}`).toBe(`${cur.name}:true`);
      }
    }
  );

  it.each(ADVANCED_CAREERS.map((c) => [c.id, c] as const))(
    '%s tenure requirement never goes down as you climb',
    (_id, career) => {
      for (let i = 1; i < career.levels.length; i += 1) {
        const prev = career.levels[i - 1].experienceRequired ?? 0;
        const cur = career.levels[i].experienceRequired ?? 0;
        expect(`${career.levels[i].name}:${cur > prev}`).toBe(`${career.levels[i].name}:true`);
      }
    }
  );

  it('the capstones sit above every pre-existing rung', () => {
    // Guards against a ladder whose old top rung already required more than 20
    // years, which would make the Board Seat a sideways step.
    for (const career of ADVANCED_CAREERS) {
      const preCapstone = career.levels.slice(0, -2);
      const highest = Math.max(...preCapstone.map((l) => l.experienceRequired ?? 0));
      expect(`${career.id}:${highest < BOARD_WEEKS}`).toBe(`${career.id}:true`);
    }
  });
});

describe('the tenure gate actually bites', () => {
  // The capstones are only content if they cannot be reached early. This drives
  // the REAL gating helper rather than re-reading the data.
  const ladder = ADVANCED_CAREERS[0];

  const atLevel = (level: number, startedWeeksLived: number): Career =>
    ({
      ...ladder,
      accepted: true,
      applied: true,
      level,
      progress: 100,
      performance: 100,
      startedWeeksLived,
    }) as unknown as Career;

  const boardIndex = ladder.levels.length - 2;

  it('refuses the Board Seat at 19 years of tenure', () => {
    const career = atLevel(boardIndex - 1, 0);
    const result = getPromotionEligibility(career, BOARD_WEEKS - 52);

    expect(result.eligible).toBe(false);
  });

  it('allows it at 20 years', () => {
    const career = atLevel(boardIndex - 1, 0);
    const result = getPromotionEligibility(career, BOARD_WEEKS);

    expect(result.eligible).toBe(true);
  });

  it('refuses Emeritus at 29 years even from the Board Seat', () => {
    const career = atLevel(boardIndex, 0);
    const result = getPromotionEligibility(career, EMERITUS_WEEKS - 52);

    expect(result.eligible).toBe(false);
  });

  it('allows Emeritus at 30 years', () => {
    const career = atLevel(boardIndex, 0);
    const result = getPromotionEligibility(career, EMERITUS_WEEKS);

    expect(result.eligible).toBe(true);
  });

  it('there is nothing above Emeritus', () => {
    const career = atLevel(ladder.levels.length - 1, 0);
    const result = getPromotionEligibility(career, 99_999);

    expect(result.eligible).toBe(false);
  });
});
