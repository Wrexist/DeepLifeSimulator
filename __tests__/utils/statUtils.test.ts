import { clampStat, validateStats, clampStatByKey, isValidStatValue } from '@/utils/statUtils';
import { GameStats } from '@/contexts/GameContext';

describe('statUtils', () => {
  describe('clampStat', () => {
    it('should clamp value to valid range', () => {
      expect(clampStat(50)).toBe(50);
      expect(clampStat(0)).toBe(0);
      expect(clampStat(100)).toBe(100);
      expect(clampStat(-10)).toBe(0);
      expect(clampStat(150)).toBe(100);
    });

    it('should handle custom min/max', () => {
      expect(clampStat(50, 0, 200)).toBe(50);
      expect(clampStat(-10, 0, 200)).toBe(0);
      expect(clampStat(250, 0, 200)).toBe(200);
    });

    it('should handle NaN and Infinity', () => {
      expect(clampStat(NaN)).toBe(0);
      expect(clampStat(Infinity)).toBe(0);
      expect(clampStat(-Infinity)).toBe(0);
    });
  });

  describe('validateStats', () => {
    it('should validate and clamp all stats', () => {
      const stats: GameStats = {
        health: 50,
        happiness: 75,
        energy: 100,
        fitness: 25,
        money: 1000,
        reputation: 80,
        gems: 50,
      };

      const validated = validateStats(stats);
      expect(validated).toEqual(stats);
    });

    it('should clamp out-of-range stats', () => {
      const stats: GameStats = {
        health: 150,
        happiness: -10,
        energy: 200,
        fitness: 50,
        money: -100,
        reputation: 300,
        gems: -50,
      };

      const validated = validateStats(stats);
      expect(validated.health).toBe(100);
      expect(validated.happiness).toBe(0);
      expect(validated.energy).toBe(100);
      expect(validated.money).toBe(0);
      expect(validated.reputation).toBe(100);
      expect(validated.gems).toBe(0);
    });
  });

  describe('clampStatByKey', () => {
    it('should clamp stats correctly by key', () => {
      expect(clampStatByKey('health', 50)).toBe(50);
      expect(clampStatByKey('health', 150)).toBe(100);
      expect(clampStatByKey('health', -10)).toBe(0);
      
      expect(clampStatByKey('money', 1000)).toBe(1000);
      expect(clampStatByKey('money', -100)).toBe(0);
      
      expect(clampStatByKey('gems', 500)).toBe(500);
      expect(clampStatByKey('gems', -50)).toBe(0);
    });
  });

  describe('isValidStatValue', () => {
    it('should validate stat values correctly', () => {
      expect(isValidStatValue('health', 50)).toBe(true);
      expect(isValidStatValue('health', 0)).toBe(true);
      expect(isValidStatValue('health', 100)).toBe(true);
      expect(isValidStatValue('health', -10)).toBe(false);
      expect(isValidStatValue('health', 150)).toBe(false);
      
      expect(isValidStatValue('money', 1000)).toBe(true);
      expect(isValidStatValue('money', 0)).toBe(true);
      expect(isValidStatValue('money', -100)).toBe(false);
      
      expect(isValidStatValue('gems', 500)).toBe(true);
      expect(isValidStatValue('gems', 0)).toBe(true);
      expect(isValidStatValue('gems', -50)).toBe(false);
    });

    it('should reject NaN and Infinity', () => {
      expect(isValidStatValue('health', NaN)).toBe(false);
      expect(isValidStatValue('health', Infinity)).toBe(false);
      expect(isValidStatValue('health', -Infinity)).toBe(false);
    });
  });
});

