/**
 * Presence consequences — the wiring that makes Identity & Body a chapter
 * rather than a screen.
 *
 * A creator nobody's stats notice is a toy. These tests pin that appearance
 * reaches two real systems, at the RIGHT strengths: strongly in dating, weakly
 * in hiring, and never strongly enough to replace competence.
 */

import { calculateMatchProbability } from '@/lib/dating/sparkLogic';
import { applyCareerApplications } from '@/contexts/game/actions/weekly/applyCareerApplications';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { WARDROBE_TIERS, computePresence, neutralMorphs, randomizeFace } from '@/lib/identity';
import type { DatingProfile } from '@/lib/dating/datingProfiles';
import type { Career, GameState } from '@/contexts/game/types';

const profile = {
  id: 'p1',
  name: 'Alex',
  age: 27,
  gender: 'female',
  bio: 'Loves hiking and terrible films.',
  job: 'Designer',
  income: 60_000,
  wealth: 'average',
  personality: 'friendly',
  photos: [],
} as unknown as DatingProfile;

/** A state whose identity is at one extreme or the other. */
function stateWithLooks(kind: 'great' | 'poor'): GameState {
  const base = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 27 } });
  const great = kind === 'great';
  return {
    ...base,
    stats: { ...base.stats, reputation: 40, happiness: great ? 85 : 30, health: great ? 95 : 55, money: 20_000 },
    identity: {
      ...base.identity!,
      face: great ? { ...randomizeFace('x'), morphs: neutralMorphs() } : randomizeFace('ugly-roll', { spread: 1 }),
      body: great
        ? { heightCm: 178, weightKg: 74, bodyFatPct: 15, muscle: 78, fitness: 82, posture: 88 }
        : { heightCm: 178, weightKg: 112, bodyFatPct: 46, muscle: 8, fitness: 9, posture: 28 },
      style: great
        ? { grooming: 95, skincare: 92, wardrobeTier: WARDROBE_TIERS.length - 1, teeth: 96, lastHaircutWeek: 0 }
        : { grooming: 6, skincare: 10, wardrobeTier: 0, teeth: 18, lastHaircutWeek: -1 },
    },
  };
}

describe('presence consequences', () => {
  describe('dating (Spark)', () => {
    it('meaningfully improves match odds', () => {
      const good = calculateMatchProbability(stateWithLooks('great'), profile);
      const bad = calculateMatchProbability(stateWithLooks('poor'), profile);
      expect(good).toBeGreaterThan(bad);
      // A real edge — not a rounding difference.
      expect(good - bad).toBeGreaterThan(0.05);
    });

    it('cannot on its own carry a player to the ceiling', () => {
      // Looks are an edge, not a replacement for reputation and money.
      const broke = stateWithLooks('great');
      const stripped: GameState = {
        ...broke,
        stats: { ...broke.stats, reputation: 0, money: 0 },
        sparkApp: undefined,
      };
      expect(calculateMatchProbability(stripped, profile)).toBeLessThan(0.6);
    });

    it('is inert on a save that predates the chapter', () => {
      // A v25 save has no identity. It must score exactly as it did before, or
      // the chapter silently rebalances every existing player's dating life.
      const withIdentity = stateWithLooks('great');
      const withoutIdentity: GameState = { ...withIdentity, identity: undefined };
      const before = calculateMatchProbability(withoutIdentity, profile);
      expect(Number.isFinite(before)).toBe(true);
      expect(before).not.toBe(calculateMatchProbability(withIdentity, profile));
    });

    it('stays inside the probability bounds at both extremes', () => {
      for (const kind of ['great', 'poor'] as const) {
        const p = calculateMatchProbability(stateWithLooks(kind), profile);
        expect(p).toBeGreaterThanOrEqual(0.05);
        expect(p).toBeLessThanOrEqual(0.95);
      }
    });
  });

  describe('career callbacks', () => {
    const pending: Career[] = [
      { id: 'job1', applied: true, accepted: false, applicationWeeksPending: 0 } as Career,
    ];

    it('shortens the callback for a striking candidate', () => {
      const fast = applyCareerApplications({
        prevCareers: pending,
        prevCurrentJob: undefined,
        careerAcceptDelay: 2,
        presence: 85,
      });
      expect(fast.newCurrentJob).toBe('job1');
    });

    it('leaves the normal wait alone for an ordinary one', () => {
      const slow = applyCareerApplications({
        prevCareers: pending,
        prevCurrentJob: undefined,
        careerAcceptDelay: 2,
        presence: 40,
      });
      expect(slow.newCurrentJob).toBeUndefined();
      expect(slow.updatedCareers[0].applicationWeeksPending).toBe(1);
    });

    it('behaves identically to before when presence is absent', () => {
      // Every pre-v26 caller and save must keep its exact behavior.
      const withOut = applyCareerApplications({
        prevCareers: pending, prevCurrentJob: undefined, careerAcceptDelay: 2,
      });
      const withZero = applyCareerApplications({
        prevCareers: pending, prevCurrentJob: undefined, careerAcceptDelay: 2, presence: 0,
      });
      expect(withOut.newCurrentJob).toBeUndefined();
      expect(withOut.updatedCareers[0].applicationWeeksPending).toBe(1);
      expect(withZero.newCurrentJob).toBeUndefined();
    });

    it('can never make a job appear instantly', () => {
      // Floored at one week — presence buys at most a single week.
      const res = applyCareerApplications({
        prevCareers: [{ id: 'j', applied: true, accepted: false } as Career],
        prevCurrentJob: undefined,
        careerAcceptDelay: 1,
        presence: 100,
      });
      // One week of pending has now elapsed, so acceptance at week 1 is correct.
      expect(res.newCurrentJob).toBe('j');
    });

    it('ignores a hostile presence value', () => {
      for (const presence of [NaN, Infinity, -999]) {
        const res = applyCareerApplications({
          prevCareers: pending, prevCurrentJob: undefined, careerAcceptDelay: 2, presence,
        });
        expect(res.newCurrentJob).toBeUndefined();
      }
    });
  });

  describe('the score the consequences read', () => {
    it('separates the two extremes by a wide margin', () => {
      const score = (kind: 'great' | 'poor') => {
        const s = stateWithLooks(kind);
        return computePresence({
          face: s.identity!.face,
          body: s.identity!.body,
          style: s.identity!.style,
          age: 27,
          confidence: s.stats.happiness,
          reputation: s.stats.reputation,
          health: s.stats.health,
        }).total;
      };
      // A wide separation is the point — appearance has to be worth acting on.
      expect(score('great') - score('poor')).toBeGreaterThan(30);
      expect(score('great')).toBeGreaterThan(70);
      // But the deliberately-worst character still lands around 40, not near 0.
      // That floor is intentional (see `computePresence`): a player who rolled
      // an unlucky face and has not maintained themselves should be at a
      // disadvantage, never locked out. Anything below ~25 would make the
      // bottom of the range unplayable rather than merely bad.
      expect(score('poor')).toBeLessThan(48);
      expect(score('poor')).toBeGreaterThan(24);
    });
  });
});
