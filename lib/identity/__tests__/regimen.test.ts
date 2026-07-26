import {
  NUTRITION_OPTIONS,
  TRAINING_OPTIONS,
  createRegimen,
  getNutritionOption,
  getTrainingOption,
  normalizeRegimen,
  nutritionQuality,
  resolveRegimen,
  type Regimen,
} from '@/lib/identity';

const rich = { hasGym: true, money: 100_000, energy: 100 };

describe('regimen', () => {
  describe('catalog', () => {
    it('makes every option cost something — no dominant pick', () => {
      // The design rule. If any option were free upside, the "choice" would be
      // a single correct answer and the weekly decision would evaporate.
      for (const n of NUTRITION_OPTIONS) {
        expect(n.weeklyCost).toBeGreaterThan(0);
      }
      expect(getNutritionOption('cut').happiness).toBeLessThan(0);
      expect(getNutritionOption('bulk').weeklyCost).toBeGreaterThan(getNutritionOption('maintain').weeklyCost);
      for (const t of TRAINING_OPTIONS) {
        if (t.intensity > 0) expect(t.energy).toBeLessThan(0);
      }
      // Harder training must always cost more energy than lighter training.
      const ordered = [...TRAINING_OPTIONS].sort((a, b) => a.intensity - b.intensity);
      for (let i = 1; i < ordered.length; i++) {
        expect(ordered[i].energy).toBeLessThan(ordered[i - 1].energy);
      }
    });

    it('falls back to a safe default for unknown ids', () => {
      expect(getNutritionOption('nonsense').id).toBe('maintain');
      expect(getTrainingOption('nonsense').id).toBe('none');
    });
  });

  describe('normalizeRegimen', () => {
    it('repairs garbage to the safe default', () => {
      expect(normalizeRegimen({ nutrition: 'starve', training: 'olympics' } as never))
        .toEqual({ nutrition: 'maintain', training: 'none' });
      expect(normalizeRegimen(null)).toEqual(createRegimen());
    });

    it('preserves a valid regimen', () => {
      const r: Regimen = { nutrition: 'bulk', training: 'intense' };
      expect(normalizeRegimen(r)).toEqual(r);
    });
  });

  describe('resolveRegimen', () => {
    it('honours the plan when everything is available', () => {
      const res = resolveRegimen({ nutrition: 'bulk', training: 'intense' }, rich);
      expect(res.nutrition.id).toBe('bulk');
      expect(res.training.id).toBe('intense');
      expect(res.downgrades).toEqual([]);
    });

    it('gates serious training behind a gym membership', () => {
      for (const training of ['regular', 'intense'] as const) {
        const res = resolveRegimen({ nutrition: 'maintain', training }, { ...rich, hasGym: false });
        expect(res.training.id).toBe('light');
        expect(res.downgrades.join(' ')).toMatch(/gym membership/i);
      }
      // Light activity needs no gym and must never be downgraded for lacking one.
      const light = resolveRegimen({ nutrition: 'maintain', training: 'light' }, { ...rich, hasGym: false });
      expect(light.training.id).toBe('light');
      expect(light.downgrades).toEqual([]);
    });

    it('downgrades training the player is too drained for', () => {
      const drained = resolveRegimen({ nutrition: 'maintain', training: 'intense' }, { ...rich, energy: 10 });
      expect(drained.training.id).toBe('light');
      const tired = resolveRegimen({ nutrition: 'maintain', training: 'intense' }, { ...rich, energy: 25 });
      expect(tired.training.id).toBe('regular');
      expect(tired.downgrades.length).toBeGreaterThan(0);
    });

    it('refuses to fund a bulk the player cannot pay for', () => {
      // The anti-exploit: without this a broke player gets a free calorie
      // surplus, the same class of bug the diet-plan tick already guards.
      const res = resolveRegimen({ nutrition: 'bulk', training: 'none' }, { ...rich, money: 120 });
      expect(res.nutrition.id).toBe('maintain');
      expect(res.downgrades.join(' ')).toMatch(/afford/i);
    });

    it('puts a penniless character into an involuntary deficit', () => {
      const res = resolveRegimen({ nutrition: 'bulk', training: 'none' }, { ...rich, money: 0 });
      expect(res.nutrition.energyBalance).toBeLessThan(0);
      expect(res.nutrition.weeklyCost).toBe(0);
      expect(res.nutrition.happiness).toBeLessThan(getNutritionOption('cut').happiness);
      expect(nutritionQuality(res.nutrition, 0)).toBeLessThan(0.2);
    });

    it('never charges more than the player has', () => {
      for (let money = 0; money < 400; money += 7) {
        const res = resolveRegimen({ nutrition: 'bulk', training: 'none' }, { ...rich, money });
        expect(res.nutrition.weeklyCost).toBeLessThanOrEqual(Math.max(money, 185));
      }
    });

    it('is stable — resolving twice gives the same answer', () => {
      const r: Regimen = { nutrition: 'bulk', training: 'intense' };
      expect(resolveRegimen(r, rich)).toEqual(resolveRegimen(r, rich));
    });
  });

  describe('nutritionQuality', () => {
    it('stays inside [0, 1] across the whole wealth range', () => {
      for (const n of NUTRITION_OPTIONS) {
        for (const money of [0, 1, 100, 10_000, 1e9, 1e15]) {
          const q = nutritionQuality(n, money);
          expect(q).toBeGreaterThanOrEqual(0);
          expect(q).toBeLessThanOrEqual(1);
        }
      }
    });

    it('rewards money with diminishing returns', () => {
      const poor = nutritionQuality(getNutritionOption('maintain'), 500);
      const comfortable = nutritionQuality(getNutritionOption('maintain'), 50_000);
      const absurd = nutritionQuality(getNutritionOption('maintain'), 1e12);
      expect(comfortable).toBeGreaterThan(poor);
      expect(absurd - comfortable).toBeLessThan(comfortable - poor);
    });
  });
});
