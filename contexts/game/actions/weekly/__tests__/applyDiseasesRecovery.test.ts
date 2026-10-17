/**
 * Natural-recovery speed bonuses must actually shorten an illness.
 *
 * The tick stored `Math.ceil(remaining)` after each week's decrement, so every
 * fractional decrement was rounded back up to a whole week. From a whole-week
 * value, health-only or fitness-only (1.5/week) and Resilience alone
 * (1.25/week) recovered exactly as fast as no bonus at all, and Resilience on
 * top of both stat bonuses (2.5) as fast as 2 - its advertised "+25% recovery
 * speed" never took a week off anything.
 *
 * Measured here as TICKS TO RECOVERY on the real reducer, deterministically:
 * the rolls are pinned high so no complication or progression interferes.
 */
import { applyDiseasesForWeek } from '../applyDiseases';
import type { DiseaseHistory } from '../applyDiseases';
import type { WeekContext } from '../weekContext';
import type { Disease, GameStats } from '@/contexts/game/types';
import { NEUTRAL_LIFE_SKILL_MODIFIERS } from '@/lib/skillTrees/lifeSkillEffects';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';

const history = (): DiseaseHistory => ({ diseases: [], totalDiseases: 0, totalCured: 0, deathsFromDisease: 0 });

function stats(health: number, fitness: number): GameStats {
  return { health, happiness: 60, energy: 60, fitness, money: 0, reputation: 0, gems: 0 };
}

/** Ticks until a `weeks`-long illness clears, under fixed health/fitness/Resilience. */
function ticksToRecover(weeks: number, health: number, fitness: number, recoveryMult = 1): number {
  let diseases: Disease[] = [
    { id: 'flu', name: 'Flu', severity: 'mild', effects: {}, curable: true, naturalRecoveryWeeks: weeks },
  ];
  let diseaseHistory = history();
  for (let tick = 1; tick <= 100; tick++) {
    const ctx: WeekContext = {
      // Fresh stats every tick: the effects bag is empty, so nothing drifts.
      newStats: stats(health, fitness),
      notifications: [],
      preRolls: zeroPreRolls({
        diseaseComplication: Array.from({ length: 20 }, () => 0.99),
        diseaseProgression: Array.from({ length: 20 }, () => 0.99),
      }),
      nextWeeksLived: 200 + tick,
      lifeSkillMods: { ...NEUTRAL_LIFE_SKILL_MODIFIERS, recoveryMult },
    };
    const result = applyDiseasesForWeek(
      { prevDiseases: diseases, prevDiseaseHistory: diseaseHistory, prevShowSicknessModal: false, prevLastDiseaseWeek: undefined, newDisease: null },
      ctx,
    );
    diseases = result.diseases;
    diseaseHistory = result.diseaseHistory;
    if (diseases.length === 0) return tick;
  }
  throw new Error('never recovered');
}

describe('natural recovery honours fractional speed bonuses', () => {
  it('no bonus: one week of recovery per tick (control)', () => {
    expect(ticksToRecover(12, 50, 30)).toBe(12);
  });

  it('good health alone (1.5/week) shortens a 12-week illness to 8 ticks', () => {
    expect(ticksToRecover(12, 90, 30)).toBe(8);
  });

  it('fitness alone (1.5/week) does the same', () => {
    expect(ticksToRecover(12, 50, 80)).toBe(8);
  });

  it('Resilience alone (+25%) shortens it to 10 ticks', () => {
    expect(ticksToRecover(12, 50, 30, 1.25)).toBe(10);
  });

  it('Resilience still counts on top of both stat bonuses (2.5/week -> 5 ticks, not 6)', () => {
    expect(ticksToRecover(12, 90, 80)).toBe(6);
    expect(ticksToRecover(12, 90, 80, 1.25)).toBe(5);
  });

  it('keeps the fractional remainder in the existing field, never a negative', () => {
    const ctx: WeekContext = {
      newStats: stats(90, 30),
      notifications: [],
      preRolls: zeroPreRolls({
        diseaseComplication: Array.from({ length: 20 }, () => 0.99),
        diseaseProgression: Array.from({ length: 20 }, () => 0.99),
      }),
      nextWeeksLived: 300,
    };
    const result = applyDiseasesForWeek(
      {
        prevDiseases: [{ id: 'cold', name: 'Cold', severity: 'mild', effects: {}, curable: true, naturalRecoveryWeeks: 4 }],
        prevDiseaseHistory: history(),
        prevShowSicknessModal: false,
        prevLastDiseaseWeek: undefined,
        newDisease: null,
      },
      ctx,
    );
    expect(result.diseases[0].naturalRecoveryWeeks).toBe(2.5);
  });

  it('is deterministic: the same inputs give the same recovery every time', () => {
    const runs = Array.from({ length: 3 }, () => ticksToRecover(16, 90, 30, 1.25));
    expect(new Set(runs).size).toBe(1);
  });
});
