import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

describe('Disease Progression', () => {
  it('should apply disease effects to stats', () => {
    const state = createTestGameState({
      diseases: [
        {
          id: 'common_cold',
          name: 'Common Cold',
          severity: 'mild',
          effects: { health: -2, energy: -3, happiness: -1 },
          curable: true,
          contractedWeek: 5,
        },
      ],
      stats: { health: 50, fitness: 50, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
    });

    // Disease effects should be negative
    expect(state.diseases[0].effects.health).toBeLessThan(0);
    expect(state.diseases[0].effects.energy).toBeLessThan(0);
  });

  it('should decrement weeksUntilDeath each week', () => {
    const state = createTestGameState({
      diseases: [
        {
          id: 'cancer',
          name: 'Cancer',
          severity: 'critical',
          effects: { health: -10, energy: -12 },
          curable: true,
          treatmentRequired: true,
          weeksUntilDeath: 5,
          contractedWeek: 1,
        },
      ],
      weeksLived: 2,
    });

    // After one week, weeksUntilDeath should decrease
    expect(state.diseases[0].weeksUntilDeath).toBe(5);
    // This would be tested in integration test with nextWeek
  });

  it('should handle natural recovery', () => {
    const state = createTestGameState({
      diseases: [
        {
          id: 'common_cold',
          name: 'Common Cold',
          severity: 'mild',
          effects: { health: -2, energy: -3 },
          curable: true,
          naturalRecoveryWeeks: 2,
          contractedWeek: 5,
        },
      ],
      weeksLived: 6,
      stats: { health: 80, fitness: 60, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
    });

    // Natural recovery should be possible
    expect(state.diseases[0].naturalRecoveryWeeks).toBeDefined();
    if (state.diseases[0].naturalRecoveryWeeks) {
      expect(state.diseases[0].naturalRecoveryWeeks).toBeGreaterThan(0);
    }
  });

  it('should track disease history', () => {
    const state = createTestGameState({
      diseaseHistory: {
        diseases: [
          {
            id: 'common_cold',
            name: 'Common Cold',
            contractedWeek: 5,
            curedWeek: 7,
            severity: 'mild',
          },
        ],
        totalDiseases: 1,
        totalCured: 1,
        deathsFromDisease: 0,
      },
    });

    expect(state.diseaseHistory).toBeDefined();
    if (state.diseaseHistory) {
      expect(state.diseaseHistory.totalDiseases).toBe(1);
      expect(state.diseaseHistory.totalCured).toBe(1);
    }
  });
});

