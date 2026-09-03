/**
 * Disease occurrence curves — Master Program 8.
 *
 * Occurrence per eligible week is `DISEASE_BASE_WEEKLY_CHANCE × calculateDiseaseRisk`
 * (immunity scales it down); the template curves only pick WHICH illness.
 * These pin the player-visible shape: a young, fit, healthy life is rare to
 * fall ill; an unfit 40-year-old is clearly more exposed but nowhere near the
 * old 35%/week cap; age is monotonic (no restart at 50); fitness and health
 * both move it; the same life on the same week rolls the same result and a
 * different life rolls its own.
 */
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';
import {
  DISEASE_BASE_WEEKLY_CHANCE,
  DISEASE_OCCURRENCE_CAP,
  calculateDiseaseRisk,
  calculateDiseaseSpecificRisk,
  generateRandomDisease,
} from '../diseaseGenerator';
import { DISEASE_DEFINITIONS } from '../diseaseDefinitions';
import type { GameState } from '@/contexts/game/types';

const life = (age: number, health: number, fitness: number, extra: Partial<GameState> = {}): GameState => {
  const s = createTestGameState({ weeksLived: (age - 18) * 52, lastDiseaseWeek: 0, ...extra });
  s.date = { ...s.date, age };
  s.stats.health = health;
  s.stats.fitness = fitness;
  return s;
};

const occurrence = (s: GameState): number =>
  Math.min(DISEASE_OCCURRENCE_CAP, DISEASE_BASE_WEEKLY_CHANCE * calculateDiseaseRisk(s));

describe('occurrence per eligible week', () => {
  it('a young, fit, healthy life is around 1-2%', () => {
    expect(occurrence(life(20, 100, 50))).toBeLessThan(0.02);
    expect(occurrence(life(20, 100, 50))).toBeGreaterThan(0.005);
  });

  it('an unfit 40-year-old is exposed, but far from the old 35% treadmill', () => {
    const o = occurrence(life(40, 100, 0));
    expect(o).toBeGreaterThan(0.05);
    expect(o).toBeLessThan(0.10);
  });

  it('age is monotonic - no restart at 50', () => {
    let prev = -1;
    for (const age of [18, 25, 30, 35, 40, 45, 49, 50, 51, 60, 75]) {
      const o = occurrence(life(age, 90, 40));
      expect(o).toBeGreaterThanOrEqual(prev);
      prev = o;
    }
    // Continuity, not a cliff: 49 → 51 is a small step.
    expect(occurrence(life(51, 90, 40)) - occurrence(life(49, 90, 40))).toBeLessThan(0.01);
  });

  it('fitness and health both move it, in the advertised directions', () => {
    expect(occurrence(life(35, 90, 0))).toBeGreaterThan(occurrence(life(35, 90, 50)));
    expect(occurrence(life(35, 90, 50))).toBeGreaterThan(occurrence(life(35, 90, 100)));
    expect(occurrence(life(35, 20, 50))).toBeGreaterThan(occurrence(life(35, 90, 50)));
  });

  it('never exceeds the cap, even for the frailest state', () => {
    expect(occurrence(life(95, 0, 0))).toBeLessThanOrEqual(DISEASE_OCCURRENCE_CAP);
  });
});

describe('the pick', () => {
  it('template weights favour heavier conditions for an unfit life without changing occurrence', () => {
    const fit = life(40, 90, 100);
    const unfit = life(40, 90, 0);
    const heart = DISEASE_DEFINITIONS.find((t) => t.id === 'heart_disease')!;
    const cold = DISEASE_DEFINITIONS.find((t) => t.id === 'common_cold')!;
    const share = (s: GameState) => calculateDiseaseSpecificRisk(heart, s) / calculateDiseaseSpecificRisk(cold, s);
    expect(share(unfit)).toBeGreaterThan(share(fit));
  });
});

describe('determinism and variation on the real generator', () => {
  const history = (lineageId: string, weeks = 260): string[] => {
    const out: string[] = [];
    for (let w = 0; w < weeks; w++) {
      const s = life(40, 90, 10, { lineageId, generationNumber: 1 });
      s.weeksLived = (40 - 18) * 52 + w;
      const d = generateRandomDisease(s);
      if (d) out.push(`${w}:${d.id}`);
    }
    return out;
  };

  it('the same life on the same week always rolls the same result', () => {
    expect(history('life_a')).toEqual(history('life_a'));
  });

  it('two lives with the same stats roll different illnesses on different weeks', () => {
    const a = history('life_a');
    const b = history('life_b');
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toEqual(b);
  });

  it('immunity lowers the chance of falling ill at all, not just of that illness', () => {
    // Coverage: with every immunity-granting illness covered, the pool the
    // occurrence roll draws from is smaller.
    let plain = 0;
    let immune = 0;
    for (let w = 0; w < 400; w++) {
      const base = life(40, 90, 10, { lineageId: 'life_imm', generationNumber: 1 });
      base.weeksLived = (40 - 18) * 52 + w;
      if (generateRandomDisease(base)) plain++;
      const covered = { ...base, diseaseImmunities: ['common_cold', 'flu', 'minor_infection'] };
      if (generateRandomDisease(covered)) immune++;
    }
    expect(immune).toBeLessThanOrEqual(plain);
  });
});
