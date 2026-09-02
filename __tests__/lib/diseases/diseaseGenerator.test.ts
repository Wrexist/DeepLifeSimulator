import { calculateDiseaseRisk, calculateDiseaseSpecificRisk, generateRandomDisease, shouldGenerateDisease, generateEventDisease } from '@/lib/diseases/diseaseGenerator';
import { DISEASE_DEFINITIONS } from '@/lib/diseases/diseaseDefinitions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

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

    it('counts fitness once - per disease, not in the overall multiplier as well', () => {
      // Program 7: fitness was in this multiplier AND in every template's own
      // fitnessRiskModifier, so the same stat was charged twice. The overall
      // multiplier is fitness-blind now; the per-disease chance still moves.
      const lowFitnessState = createTestGameState({ 
        stats: { health: 70, fitness: 10, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
        date: { age: 30, year: 2025, month: 'January', week: 1 },
      });
      const highFitnessState = createTestGameState({ 
        stats: { health: 70, fitness: 80, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 },
        date: { age: 30, year: 2025, month: 'January', week: 1 },
      });

      const base = calculateDiseaseRisk(highFitnessState);
      expect(calculateDiseaseRisk(lowFitnessState)).toBe(base);

      const flu = DISEASE_DEFINITIONS.find((t) => t.id === 'flu')!;
      expect(calculateDiseaseSpecificRisk(flu, lowFitnessState, base))
        .toBeGreaterThan(calculateDiseaseSpecificRisk(flu, highFitnessState, base));
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

  // Regression suite for the 2026-07-03 balance report: terminal heart
  // disease at 21, three simultaneous conditions, ~13 diseases/year.
  describe('generateRandomDisease balance guards', () => {
    const baseStats = { health: 55, fitness: 30, happiness: 50, energy: 50, money: 1000, reputation: 0, gems: 0 };

    it('never gives an age-gated disease to a young player', () => {
      const gated = new Set(['heart_disease', 'stroke', 'organ_failure', 'kidney_disease', 'dementia', 'arthritis', 'diabetes', 'high_blood_pressure', 'cancer']);
      for (let week = 0; week < 400; week += 4) {
        const state = createTestGameState({
          weeksLived: week,
          lastDiseaseWeek: week - 4,
          stats: { ...baseStats, health: 25, fitness: 5 },
          date: { age: 21, year: 2025, month: 'January', week: 1 },
        });
        const disease = generateRandomDisease(state);
        if (disease) {
          expect(gated.has(disease.id)).toBe(false);
        }
      }
    });

    it('does not produce a disease on every cooldown window (occurrence gate)', () => {
      let generated = 0;
      let rolls = 0;
      for (let week = 0; week < 800; week += 4) {
        const state = createTestGameState({
          weeksLived: week,
          lastDiseaseWeek: week - 4,
          stats: baseStats,
          date: { age: 30, year: 2025, month: 'January', week: 1 },
        });
        rolls++;
        if (generateRandomDisease(state)) generated++;
      }
      // Pre-fix this was ~100% of rolls (a disease every 4 weeks).
      expect(generated / rolls).toBeLessThan(0.5);
      expect(generated).toBeGreaterThan(0); // still possible, just not constant
    });

    it('never stacks a second terminal illness', () => {
      for (let week = 0; week < 400; week += 4) {
        const state = createTestGameState({
          weeksLived: week,
          lastDiseaseWeek: week - 4,
          stats: { ...baseStats, health: 15, fitness: 5 },
          date: { age: 70, year: 2025, month: 'January', week: 1 },
          diseases: [
            { id: 'cancer', name: 'Cancer', severity: 'critical', effects: {}, curable: true, weeksUntilDeath: 10, contractedWeek: 0, description: '' },
          ],
        } as any);
        const disease = generateRandomDisease(state);
        if (disease) {
          expect(disease.weeksUntilDeath).toBeUndefined();
        }
      }
    });

    it('only allows mild diseases once two serious conditions are active', () => {
      for (let week = 0; week < 400; week += 4) {
        const state = createTestGameState({
          weeksLived: week,
          lastDiseaseWeek: week - 4,
          stats: { ...baseStats, health: 15, fitness: 5 },
          date: { age: 70, year: 2025, month: 'January', week: 1 },
          diseases: [
            { id: 'asthma', name: 'Asthma', severity: 'serious', effects: {}, curable: false, contractedWeek: 0, description: '' },
            { id: 'arthritis', name: 'Arthritis', severity: 'serious', effects: {}, curable: false, contractedWeek: 0, description: '' },
          ],
        } as any);
        const disease = generateRandomDisease(state);
        if (disease) {
          expect(disease.severity).toBe('mild');
        }
      }
    });

    it('generateEventDisease respects the age gate too', () => {
      for (let week = 0; week < 200; week += 1) {
        const state = createTestGameState({
          weeksLived: week,
          date: { age: 21, year: 2025, month: 'January', week: 1 },
        });
        const disease = generateEventDisease('medical_emergency', state);
        if (disease) {
          expect(['pneumonia'].includes(disease.id)).toBe(true);
        }
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

