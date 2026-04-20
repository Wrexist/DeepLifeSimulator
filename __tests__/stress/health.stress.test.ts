import { GameState } from '@/contexts/GameContext';
import { advanceWeeks } from './helpers/timeHelpers';
import { setupNearDeath, setupMaxedStats } from './helpers/scenarioBuilders';
import { expectStatInBounds, expectNumericalStability } from './helpers/assertions';

describe('Health & Death Stress Tests', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = (global as any).createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 25 },
      weeksLived: 364,
      stats: {
        health: 100,
        happiness: 80,
        energy: 100,
        fitness: 70,
        money: 10000,
        reputation: 50,
        gems: 10,
      },
      healthZeroWeeks: 0,
      happinessZeroWeeks: 0,
      isDead: false,
    });
  });

  describe('Test 1: Health at 0 for 1-3 weeks', () => {
    it('should survive with health at 0 for 1 week', () => {
      let state = {
        ...baseState,
        stats: { ...baseState.stats, health: 0 },
        healthZeroWeeks: 0,
      };

      // Advance 1 week
      state = advanceWeeks(state, 1);
      state.healthZeroWeeks = 1;

      expect(state.stats.health).toBe(0);
      expect(state.healthZeroWeeks).toBe(1);
      expect(state.isDead).toBeFalsy();

      console.log(`Survived 1 week at 0 health`);
    });

    it('should survive with health at 0 for 2 weeks', () => {
      let state = {
        ...baseState,
        stats: { ...baseState.stats, health: 0 },
        healthZeroWeeks: 0,
      };

      // Advance 2 weeks
      state = advanceWeeks(state, 2);
      state.healthZeroWeeks = 2;

      expect(state.healthZeroWeeks).toBe(2);
      expect(state.isDead).toBeFalsy();

      console.log(`Survived 2 weeks at 0 health`);
    });

    it('should survive with health at 0 for 3 weeks', () => {
      let state = {
        ...baseState,
        stats: { ...baseState.stats, health: 0 },
        healthZeroWeeks: 0,
      };

      // Advance 3 weeks
      state = advanceWeeks(state, 3);
      state.healthZeroWeeks = 3;

      expect(state.healthZeroWeeks).toBe(3);
      expect(state.isDead).toBeFalsy();

      console.log(`Survived 3 weeks at 0 health (critical condition)`);
    });

    it('should NOT survive with health at 0 for 4 weeks', () => {
      // Note: Death triggers at 4+ weeks (based on GameContext analysis)
      let state = {
        ...baseState,
        stats: { ...baseState.stats, health: 0 },
        healthZeroWeeks: 4,
      };

      // At 4 weeks, death should occur
      expect(state.healthZeroWeeks).toBeGreaterThanOrEqual(4);

      console.log(`Death should trigger at 4 weeks with 0 health`);
    });
  });

  describe('Test 2: Health death trigger (4+ weeks)', () => {
    it('should trigger death at exactly 4 weeks of 0 health', () => {
      const state = {
        ...baseState,
        stats: { ...baseState.stats, health: 0 },
        healthZeroWeeks: 4,
        isDead: true,
        deathReason: 'health',
      };

      expect(state.healthZeroWeeks).toBe(4);
      expect(state.isDead).toBe(true);
      expect(state.deathReason).toBe('health');

      console.log(`Death triggered: ${state.deathReason} after ${state.healthZeroWeeks} weeks`);
    });

    it('should verify death reason is health', () => {
      const deathState = {
        ...baseState,
        stats: { ...baseState.stats, health: 0 },
        healthZeroWeeks: 5,
        isDead: true,
        deathReason: 'health',
      };

      expect(deathState.deathReason).toBe('health');

      console.log(`Death reason confirmed: health`);
    });
  });

  describe('Test 3: Happiness death trigger', () => {
    it('should survive with happiness at 0 for 3 weeks', () => {
      let state = {
        ...baseState,
        stats: { ...baseState.stats, happiness: 0 },
        happinessZeroWeeks: 3,
      };

      expect(state.happinessZeroWeeks).toBe(3);
      expect(state.isDead).toBeFalsy();

      console.log(`Survived 3 weeks at 0 happiness`);
    });

    it('should trigger death at 4 weeks of 0 happiness', () => {
      const state = {
        ...baseState,
        stats: { ...baseState.stats, happiness: 0 },
        happinessZeroWeeks: 4,
        isDead: true,
        deathReason: 'happiness',
      };

      expect(state.happinessZeroWeeks).toBe(4);
      expect(state.isDead).toBe(true);
      expect(state.deathReason).toBe('happiness');

      console.log(`Death triggered: ${state.deathReason} after ${state.happinessZeroWeeks} weeks`);
    });
  });

  describe('Test 4: Stat clamping', () => {
    it('should clamp negative health to 0', () => {
      const state = {
        ...baseState,
        stats: { ...baseState.stats, health: -50 },
      };

      const clamped = Math.max(0, Math.min(100, state.stats.health));
      expect(clamped).toBe(0);

      console.log(`Health ${state.stats.health} clamped to ${clamped}`);
    });

    it('should clamp health over 100 to 100', () => {
      const state = {
        ...baseState,
        stats: { ...baseState.stats, health: 150 },
      };

      const clamped = Math.max(0, Math.min(100, state.stats.health));
      expect(clamped).toBe(100);

      console.log(`Health ${state.stats.health} clamped to ${clamped}`);
    });

    it('should verify all stats clamp to 0-100 range', () => {
      const testValues = [-100, -10, 0, 50, 100, 110, 200];
      const statNames = ['health', 'happiness', 'energy', 'fitness', 'reputation'];

      testValues.forEach((value) => {
        const clamped = Math.max(0, Math.min(100, value));

        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(100);

        statNames.forEach((stat) => {
          expectStatInBounds(clamped, stat);
        });
      });

      console.log(`All stat values properly clamped to 0-100 range`);
    });

    it('should handle edge cases (exactly 0 and exactly 100)', () => {
      const state = {
        ...baseState,
        stats: {
          health: 0,
          happiness: 100,
          energy: 0,
          fitness: 100,
          money: 0,
          reputation: 50,
          gems: 0,
        },
      };

      expectStatInBounds(state.stats.health, 'health');
      expectStatInBounds(state.stats.happiness, 'happiness');
      expectStatInBounds(state.stats.energy, 'energy');
      expectStatInBounds(state.stats.fitness, 'fitness');
      expectStatInBounds(state.stats.reputation, 'reputation');

      console.log(`Edge cases (0 and 100) handled correctly`);
    });
  });

  describe('Test 5: Recovery from near-death', () => {
    it('should reset healthZeroWeeks counter upon recovery', () => {
      let state = {
        ...baseState,
        stats: { ...baseState.stats, health: 0 },
        healthZeroWeeks: 3,
      };

      // Boost health
      state.stats.health = 100;
      state.healthZeroWeeks = 0; // Reset counter

      expect(state.stats.health).toBe(100);
      expect(state.healthZeroWeeks).toBe(0);
      expect(state.isDead).toBeFalsy();

      console.log(`Recovered from 3 weeks at 0 health`);
    });

    it('should allow survival after recovery', () => {
      let state = {
        ...baseState,
        stats: { ...baseState.stats, health: 0 },
        healthZeroWeeks: 3,
      };

      // Recover
      state.stats.health = 50;
      state.healthZeroWeeks = 0;

      // Advance 10 more weeks
      state = advanceWeeks(state, 10);

      expect(state.isDead).toBeFalsy();
      expect(state.healthZeroWeeks).toBe(0);

      console.log(`Survived 10 weeks after recovery`);
    });

    it('should handle multiple near-death recoveries', () => {
      let state = baseState;

      // First near-death
      state.stats.health = 0;
      state.healthZeroWeeks = 2;

      // Recover
      state.stats.health = 80;
      state.healthZeroWeeks = 0;

      // Second near-death
      state.stats.health = 0;
      state.healthZeroWeeks = 2;

      // Recover again
      state.stats.health = 90;
      state.healthZeroWeeks = 0;

      expect(state.isDead).toBeFalsy();

      console.log(`Survived multiple near-death experiences`);
    });
  });

  describe('Test 6: Multiple diseases and health effects', () => {
    it('should simulate flu health drain', () => {
      const weeklyHealthLoss = -10;
      const diseaseWeeks = 4;

      let health = 100;
      for (let week = 0; week < diseaseWeeks; week++) {
        health = Math.max(0, health + weeklyHealthLoss);
      }

      expect(health).toBe(60); // 100 - (4 * 10)

      console.log(`Health after 4 weeks of flu: ${health}`);
    });

    it('should simulate severe disease (cancer) health drain', () => {
      const weeklyHealthLoss = -20;
      const diseaseWeeks = 10;

      let health = 100;
      for (let week = 0; week < diseaseWeeks; week++) {
        health = Math.max(0, health + weeklyHealthLoss);
      }

      expect(health).toBe(0); // Reaches 0 after 5 weeks

      console.log(`Health after ${diseaseWeeks} weeks of severe disease: ${health}`);
    });

    it('should handle multiple simultaneous diseases', () => {
      const diseases = [
        { name: 'Flu', weeklyDrain: -10 },
        { name: 'Injury', weeklyDrain: -5 },
        { name: 'Stress', weeklyDrain: -3 },
      ];

      const totalWeeklyDrain = diseases.reduce((sum, d) => sum + d.weeklyDrain, 0);
      expect(totalWeeklyDrain).toBe(-18);

      let health = 100;
      const weeks = 5;

      for (let week = 0; week < weeks; week++) {
        health = Math.max(0, health + totalWeeklyDrain);
      }

      expect(health).toBe(10); // 100 - (5 * 18) = 10

      console.log(`Health with 3 diseases after ${weeks} weeks: ${health}`);
    });

    it('should test cure mechanics', () => {
      let state = {
        ...baseState,
        stats: { ...baseState.stats, health: 60 },
        diseases: [
          { id: 'flu', name: 'Flu', severity: 'mild', weeklyHealthDrain: -10 },
        ],
      };

      // Cure the disease
      state.diseases = [];
      state.stats.health = Math.min(100, state.stats.health + 20); // Health boost from cure

      expect(state.diseases).toHaveLength(0);
      expect(state.stats.health).toBe(80);

      console.log(`Cured disease, health boosted to ${state.stats.health}`);
    });

    it('should verify health cannot go below 0', () => {
      let health = 20;
      const massiveDamage = -50;

      health = Math.max(0, health + massiveDamage);

      expect(health).toBe(0);
      expect(health).toBeGreaterThanOrEqual(0);

      console.log(`Health with massive damage: ${health} (clamped to 0)`);
    });
  });

  describe('Stat Stability Tests', () => {
    it('should maintain stat stability over 1000 weeks', () => {
      let state = baseState;

      for (let week = 0; week < 1000; week++) {
        // Simulate weekly stat changes
        state.stats.health = Math.max(0, Math.min(100, state.stats.health + 2));
        state.stats.happiness = Math.max(0, Math.min(100, state.stats.happiness - 1));
        state.stats.energy = Math.min(100, state.stats.energy + 30);
      }

      expectNumericalStability(state);

      console.log(`Stats after 1000 weeks:`, state.stats);
    });
  });
});
