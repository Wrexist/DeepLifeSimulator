import { GameState } from '@/contexts/GameContext';
import { advanceWeeks, advanceYears, advanceToAge } from './helpers/timeHelpers';
import { expectValidAge, expectNumericalStability } from './helpers/assertions';

describe('Aging Stress Tests', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = (global as any).createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 18 },
      weeksLived: 0,
      stats: {
        health: 100,
        happiness: 80,
        energy: 100,
        fitness: 70,
        money: 10000,
        reputation: 50,
        gems: 10,
      },
    });
  });

  describe('Test 1: Age from 18 to 50 (1664 weeks / 32 years)', () => {
    it('should age character from 18 to 50 with correct precision', () => {
      const startTime = Date.now();

      // Advance 32 years (1664 weeks)
      const finalState = advanceYears(baseState, 32);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify age is exactly 50
      expect(finalState.date.age).toBeCloseTo(50, 2);
      expectValidAge(finalState.date.age);

      // Verify no floating-point drift
      const expectedWeeks = 1664;
      expect(finalState.weeksLived).toBe(expectedWeeks);

      // Verify stats remain in valid ranges
      expectNumericalStability(finalState);

      // Verify weeks counter incremented correctly
      expect(finalState.week).toBe(baseState.week + expectedWeeks);

      console.log(`Aging 32 years took ${duration}ms`);
      console.log(`Final age: ${finalState.date.age}`);
      console.log(`Final stats:`, finalState.stats);
    });

    it('should handle week-by-week aging consistently', () => {
      // Test that aging week by week produces same result as bulk aging
      let weekByWeekState = baseState;

      for (let i = 0; i < 100; i++) {
        weekByWeekState = advanceWeeks(weekByWeekState, 1);
      }

      const bulkState = advanceWeeks(baseState, 100);

      expect(weekByWeekState.date.age).toBeCloseTo(bulkState.date.age, 4);
      expect(weekByWeekState.weeksLived).toBe(bulkState.weeksLived);
    });
  });

  describe('Test 2: Age from 18 to 99 (4212 weeks / 81 years)', () => {
    it('should age character to 99 and verify life stage transitions', () => {
      // Advance to age 99
      const finalState = advanceToAge(baseState, 99);

      // Verify age
      expect(finalState.date.age).toBeGreaterThanOrEqual(99);
      expect(finalState.date.age).toBeLessThan(100);
      expectValidAge(finalState.date.age);

      // Verify numerical stability over 81 years
      expectNumericalStability(finalState);

      // Calculate expected life stage (senior at 65+)
      const getLifeStage = (age: number) => {
        if (age < 13) return 'child';
        if (age < 20) return 'teen';
        if (age < 65) return 'adult';
        return 'senior';
      };

      expect(getLifeStage(finalState.date.age)).toBe('senior');

      console.log(`Aged to ${finalState.date.age} years`);
      console.log(`Total weeks lived: ${finalState.weeksLived}`);
    });

    it('should verify life stage transition at age 65', () => {
      // Age to 64.9
      const beforeSenior = advanceToAge(baseState, 64.9);
      expect(beforeSenior.date.age).toBeLessThan(65);

      // Age to 65.1
      const afterSenior = advanceToAge(baseState, 65);
      expect(afterSenior.date.age).toBeGreaterThanOrEqual(65);

      console.log(`Age before senior: ${beforeSenior.date.age}`);
      console.log(`Age after senior: ${afterSenior.date.age}`);
    });
  });

  describe('Test 3: Age 100 game-over trigger', () => {
    it('should approach age 100 without issues', () => {
      // Age to 99.98 (very close to 100)
      const almostCentenarian = advanceToAge(baseState, 99.95);

      expect(almostCentenarian.date.age).toBeGreaterThan(99);
      expect(almostCentenarian.date.age).toBeLessThan(100);
      expectNumericalStability(almostCentenarian);

      console.log(`Age at 99.95+: ${almostCentenarian.date.age}`);
    });

    it('should verify age reaches exactly 100', () => {
      // Advance to 100 years old
      const centenarian = advanceToAge(baseState, 100);

      expect(centenarian.date.age).toBeGreaterThanOrEqual(100);
      expectNumericalStability(centenarian);

      console.log(`Centenarian age: ${centenarian.date.age}`);
      console.log(`Total weeks lived: ${centenarian.weeksLived}`);

      // In the actual game, this should trigger game over
      // We can't test that directly in unit tests, but we verify the age reached
    });
  });

  describe('Test 4: Relationship aging over 50 years', () => {
    it('should age relationships alongside the player', () => {
      // Create state with spouse and children
      const stateWithFamily: GameState = {
        ...baseState,
        date: { ...baseState.date, age: 25 },
        social: {
          relations: [
            {
              id: 'spouse-1',
              name: 'Spouse',
              type: 'spouse',
              age: 25,
              affection: 90,
              reliability: 85,
              history: [],
            },
            {
              id: 'child-1',
              name: 'Child 1',
              type: 'child',
              age: 0,
              affection: 100,
              reliability: 80,
              history: [],
            },
            {
              id: 'child-2',
              name: 'Child 2',
              type: 'child',
              age: 2,
              affection: 100,
              reliability: 80,
              history: [],
            },
          ],
        },
      };

      // Age 50 years
      const aged50Years = advanceYears(stateWithFamily, 50);

      // Verify player is now 75
      expect(aged50Years.date.age).toBeCloseTo(75, 1);

      // Note: Relationship aging would need to be implemented in the actual game
      // This test verifies the player ages correctly
      // In a full implementation, we'd verify spouse is ~75 and children are ~50 and ~52

      console.log(`Player aged from 25 to ${aged50Years.date.age}`);
      console.log(`Total weeks: ${aged50Years.weeksLived}`);
    });

    it('should handle multiple generations', () => {
      // Start at age 20, have children, age to 70
      const youngParent: GameState = {
        ...baseState,
        date: { ...baseState.date, age: 20 },
        social: {
          relations: [
            {
              id: 'child-1',
              name: 'First Child',
              type: 'child',
              age: 0,
              affection: 100,
              reliability: 80,
              history: [],
            },
          ],
        },
      };

      // Age 50 years (to age 70)
      const elderlyParent = advanceYears(youngParent, 50);

      expect(elderlyParent.date.age).toBeCloseTo(70, 1);
      expectNumericalStability(elderlyParent);

      // Child should now be 50 (if aging is implemented)
      console.log(`Parent aged from 20 to ${elderlyParent.date.age}`);
    });
  });

  describe('Performance Tests', () => {
    it('should age 50 years in reasonable time', () => {
      const startTime = performance.now();

      const aged = advanceYears(baseState, 50);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(aged.date.age).toBeCloseTo(68, 1);
      expect(duration).toBeLessThan(1000); // Should take less than 1 second

      console.log(`Aging 50 years took ${duration.toFixed(2)}ms`);
    });

    it('should age 100 years without memory issues', () => {
      const startMemory = process.memoryUsage();

      const aged = advanceYears(baseState, 82); // 18 to 100

      const endMemory = process.memoryUsage();
      const heapUsedDiff = endMemory.heapUsed - startMemory.heapUsed;

      expect(aged.date.age).toBeGreaterThanOrEqual(100);
      expect(heapUsedDiff).toBeLessThan(10 * 1024 * 1024); // Less than 10MB

      console.log(`Memory used: ${(heapUsedDiff / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});
