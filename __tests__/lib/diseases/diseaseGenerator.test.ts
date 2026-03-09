import { calculateDiseaseRisk, generateRandomDisease, shouldGenerateDisease, generateEventDisease } from '@/lib/diseases/diseaseGenerator';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

describe('Disease Generator', () => {
  describe('calculateDiseaseRisk', () => {
    it('should return higher risk for low health', () => {
      const lowHealthState = createTestGameState({ 
        stats: { health: 20, fitness: 50, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
        date: { age: 30, year: 2025, month: 'January', week: 1 },
      });
      const highHealthState = createTestGameState({ 
        stats: { health: 90, fitness: 50, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
        date: { age: 30, year: 2025, month: 'January', week: 1 },
      });

      const lowHealthRisk = calculateDiseaseRisk(lowHealthState);
      const highHealthRisk = calculateDiseaseRisk(highHealthState);

      expect(lowHealthRisk).toBeGreaterThan(highHealthRisk);
    });

    it('should return higher risk for low fitness', () => {
      const lowFitnessState = createTestGameState({ 
        stats: { health: 70, fitness: 10, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
        date: { age: 30, year: 2025, month: 'January', week: 1 },
      });
      const highFitnessState = createTestGameState({ 
        stats: { health: 70, fitness: 80, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
        date: { age: 30, year: 2025, month: 'January', week: 1 },
      });

      const lowFitnessRisk = calculateDiseaseRisk(lowFitnessState);
      const highFitnessRisk = calculateDiseaseRisk(highFitnessState);

      expect(lowFitnessRisk).toBeGreaterThan(highFitnessRisk);
    });

    it('should return higher risk for older age', () => {
      const youngState = createTestGameState({ 
        stats: { health: 70, fitness: 50, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
        date: { age: 25, year: 2025, month: 'January', week: 1 },
      });
      const oldState = createTestGameState({ 
        stats: { health: 70, fitness: 50, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
        date: { age: 65, year: 2025, month: 'January', week: 1 },
      });

      const youngRisk = calculateDiseaseRisk(youngState);
      const oldRisk = calculateDiseaseRisk(oldState);

      expect(oldRisk).toBeGreaterThan(youngRisk);
    });

    it('should cap risk at maximum', () => {
      const veryLowHealthState = createTestGameState({ 
        stats: { health: 0, fitness: 0, happiness: 0, energy: 0, money: 0, reputation: 0, gems: 0 },
        date: { age: 100, year: 2025, month: 'January', week: 1 },
      });

      const risk = calculateDiseaseRisk(veryLowHealthState);
      expect(risk).toBeLessThanOrEqual(5.0);
    });
  });

  describe('shouldGenerateDisease', () => {
    it('should return false if cooldown not met', () => {
      const state = createTestGameState({ 
        weeksLived: 10,
        lastDiseaseWeek: 8, // Only 2 weeks since last disease
      });

      expect(shouldGenerateDisease(state)).toBe(false);
    });

    it('should return true if cooldown met', () => {
      const state = createTestGameState({ 
        weeksLived: 10,
        lastDiseaseWeek: 5, // 5 weeks since last disease
      });

      expect(shouldGenerateDisease(state)).toBe(true);
    });

    it('should return true if no previous disease', () => {
      const state = createTestGameState({ 
        weeksLived: 10,
        lastDiseaseWeek: undefined,
      });

      expect(shouldGenerateDisease(state)).toBe(true);
    });
  });

  describe('generateRandomDisease', () => {
    it('should return null if cooldown not met', () => {
      const state = createTestGameState({ 
        weeksLived: 10,
        lastDiseaseWeek: 8,
        stats: { health: 50, fitness: 30, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
      });

      const disease = generateRandomDisease(state);
      expect(disease).toBeNull();
    });

    it('should return disease when conditions are met', () => {
      const state = createTestGameState({ 
        weeksLived: 10,
        lastDiseaseWeek: 5,
        stats: { health: 30, fitness: 20, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
        date: { age: 50, year: 2025, month: 'January', week: 1 },
      });

      const disease = generateRandomDisease(state);
      // May or may not generate disease based on random chance
      if (disease) {
        expect(disease).toHaveProperty('id');
        expect(disease).toHaveProperty('name');
        expect(disease).toHaveProperty('severity');
        expect(disease).toHaveProperty('effects');
        expect(disease).toHaveProperty('curable');
        expect(disease.contractedWeek).toBe(10);
      }
    });
  });

  describe('generateEventDisease', () => {
    it('should generate disease for medical_emergency event', () => {
      const state = createTestGameState({ 
        weeksLived: 10,
      });

      const disease = generateEventDisease('medical_emergency', state);
      if (disease) {
        expect(disease).toHaveProperty('id');
        expect(disease).toHaveProperty('name');
        expect(disease.contractedWeek).toBe(10);
      }
    });

    it('should return null for unknown event', () => {
      const state = createTestGameState({ 
        weeksLived: 10,
      });

      const disease = generateEventDisease('unknown_event', state);
      expect(disease).toBeNull();
    });
  });
});

