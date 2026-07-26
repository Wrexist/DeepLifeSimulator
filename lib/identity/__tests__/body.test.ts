import {
  BODY_LIMITS,
  bmi,
  createBody,
  normalizeBody,
  physicalCondition,
  silhouette,
  simulateBodyWeek,
  type BodyProfile,
  type BodyWeekInputs,
} from '@/lib/identity';

const sedentary: BodyWeekInputs = {
  age: 30,
  dietQuality: 0.5,
  energyBalance: 0,
  exercise: 0,
  stress: 30,
  health: 80,
};

const training: BodyWeekInputs = {
  age: 30,
  dietQuality: 0.8,
  energyBalance: 0.3,
  exercise: 0.85,
  stress: 30,
  health: 90,
};

/** Run n weeks of the same conditions. */
function runWeeks(body: BodyProfile, w: BodyWeekInputs, n: number): BodyProfile {
  let current = body;
  for (let i = 0; i < n; i++) {
    current = simulateBodyWeek(current, w).body;
  }
  return current;
}

describe('body', () => {
  describe('createBody', () => {
    it('is deterministic per seed', () => {
      expect(createBody('p1', 'male', 25)).toEqual(createBody('p1', 'male', 25));
    });

    it('produces plausible adults across many seeds', () => {
      for (let i = 0; i < 300; i++) {
        const b = createBody(`s${i}`, i % 2 ? 'male' : 'female', 30);
        expect(b.heightCm).toBeGreaterThanOrEqual(BODY_LIMITS.heightCm.min);
        expect(b.heightCm).toBeLessThanOrEqual(BODY_LIMITS.heightCm.max);
        expect(b.weightKg).toBeGreaterThan(35);
        expect(b.bodyFatPct).toBeGreaterThanOrEqual(8);
        expect(b.bodyFatPct).toBeLessThanOrEqual(38);
        // Derived mass must never be absurd for the height.
        expect(bmi(b)).toBeGreaterThan(14);
        expect(bmi(b)).toBeLessThan(42);
      }
    });

    it('scales children off their adult height so nobody shrinks growing up', () => {
      const child = createBody('kid', 'male', 6);
      const adult = createBody('kid', 'male', 30);
      expect(child.heightCm).toBeLessThan(adult.heightCm);
      expect(child.heightCm).toBeGreaterThan(60);
    });
  });

  describe('normalizeBody', () => {
    it('repairs garbage without throwing', () => {
      const b = normalizeBody({ heightCm: NaN, weightKg: -100, bodyFatPct: 900, muscle: Infinity } as never);
      expect(b.heightCm).toBe(BODY_LIMITS.heightCm.min);
      expect(b.weightKg).toBe(BODY_LIMITS.weightKg.min);
      expect(b.bodyFatPct).toBe(BODY_LIMITS.bodyFatPct.max);
      expect(b.muscle).toBe(BODY_LIMITS.muscle.min);
    });

    it('supplies a full default body from nothing', () => {
      const b = normalizeBody(undefined);
      expect(b.heightCm).toBe(172);
      expect(b.weightKg).toBe(70);
    });
  });

  describe('simulateBodyWeek', () => {
    const base = createBody('sim', 'male', 30);

    it('never mutates its input', () => {
      const snapshot = { ...base };
      simulateBodyWeek(base, training);
      expect(base).toEqual(snapshot);
    });

    it('keeps every value inside physiological limits over a whole life', () => {
      // 4000 weeks of the most extreme inputs available. Nothing may escape.
      const extremes: BodyWeekInputs[] = [
        { age: 20, dietQuality: 1, energyBalance: 1, exercise: 1, stress: 0, health: 100 },
        { age: 90, dietQuality: 0, energyBalance: -1, exercise: 0, stress: 100, health: 5 },
        { age: 50, dietQuality: 1, energyBalance: -1, exercise: 1, stress: 100, health: 50 },
      ];
      for (const w of extremes) {
        let body = base;
        for (let i = 0; i < 4000; i++) {
          body = simulateBodyWeek(body, w).body;
          expect(body.weightKg).toBeGreaterThanOrEqual(BODY_LIMITS.weightKg.min);
          expect(body.weightKg).toBeLessThanOrEqual(BODY_LIMITS.weightKg.max);
          expect(body.bodyFatPct).toBeGreaterThanOrEqual(BODY_LIMITS.bodyFatPct.min);
          expect(body.bodyFatPct).toBeLessThanOrEqual(BODY_LIMITS.bodyFatPct.max);
          expect(body.muscle).toBeGreaterThanOrEqual(0);
          expect(body.muscle).toBeLessThanOrEqual(100);
          expect(body.fitness).toBeGreaterThanOrEqual(0);
          expect(body.fitness).toBeLessThanOrEqual(100);
          expect(Number.isFinite(body.posture)).toBe(true);
        }
      }
    });

    it('moves weight at a realistic rate, not an arcade one', () => {
      // A full surplus must not exceed ~0.5 kg/week — the constant that keeps
      // the system honest about how long a body takes to change.
      const after = simulateBodyWeek(base, { ...sedentary, energyBalance: 1 }).body;
      const delta = after.weightKg - base.weightKg;
      expect(delta).toBeGreaterThan(0.15);
      expect(delta).toBeLessThan(0.5);
    });

    it('detrains faster than it trains', () => {
      const fit = runWeeks(base, training, 30);
      const gainPerWeek = (fit.fitness - base.fitness) / 30;
      const detrained = simulateBodyWeek(fit, sedentary).body;
      const lossInOneWeek = fit.fitness - detrained.fitness;
      expect(gainPerWeek).toBeGreaterThan(0);
      expect(lossInOneWeek).toBeGreaterThan(gainPerWeek);
    });

    it('builds muscle only when stimulus, protein and calories all line up', () => {
      const start = { ...base, muscle: 30 };
      const complete = runWeeks(start, training, 26).muscle;
      // Training hard while starving must not build muscle.
      const starved = runWeeks(start, { ...training, energyBalance: -1, dietQuality: 0.15 }, 26).muscle;
      // Eating well while sitting down must not either.
      const idle = runWeeks(start, { ...training, exercise: 0 }, 26).muscle;
      expect(complete).toBeGreaterThan(start.muscle);
      expect(starved).toBeLessThan(start.muscle);
      expect(idle).toBeLessThan(start.muscle);
    });

    it('takes months, not weeks, to visibly change muscle', () => {
      const start = { ...base, muscle: 30 };
      const oneMonth = runWeeks(start, training, 4).muscle - start.muscle;
      const sixMonths = runWeeks(start, training, 26).muscle - start.muscle;
      expect(oneMonth).toBeLessThan(4);
      expect(sixMonths).toBeGreaterThan(6);
    });

    it('applies diminishing returns near the top of the muscle scale', () => {
      const novice = simulateBodyWeek({ ...base, muscle: 20 }, training).body.muscle - 20;
      const advanced = simulateBodyWeek({ ...base, muscle: 90 }, training).body.muscle - 90;
      expect(novice).toBeGreaterThan(advanced);
    });

    it('protects lean mass while cutting when the player trains', () => {
      const start = { ...base, muscle: 60, bodyFatPct: 28 };
      const cutLifting = runWeeks(start, { ...training, energyBalance: -0.6 }, 20);
      const cutIdle = runWeeks(start, { ...sedentary, energyBalance: -0.6 }, 20);
      // Both lose weight, but the trainee keeps more muscle and ends leaner.
      expect(cutLifting.weightKg).toBeLessThan(start.weightKg);
      expect(cutIdle.weightKg).toBeLessThan(start.weightKg);
      expect(cutLifting.muscle).toBeGreaterThan(cutIdle.muscle);
    });

    it('bleeds muscle with age when untrained (sarcopenia)', () => {
      const young = runWeeks({ ...base, muscle: 60 }, { ...sedentary, age: 25 }, 52).muscle;
      const old = runWeeks({ ...base, muscle: 60 }, { ...sedentary, age: 75 }, 52).muscle;
      expect(old).toBeLessThan(young);
    });

    it('reports threshold crossings and stays silent on ordinary weeks', () => {
      const quiet = simulateBodyWeek(base, sedentary);
      expect(quiet.notes).toEqual([]);

      // Push right up to the obesity line, then cross it.
      const heavy: BodyProfile = { ...base, heightCm: 175, weightKg: 91.7, bodyFatPct: 34 };
      expect(bmi(heavy)).toBeLessThan(30);
      const crossed = simulateBodyWeek(heavy, { ...sedentary, energyBalance: 1 });
      expect(bmi(crossed.body)).toBeGreaterThanOrEqual(30);
      expect(crossed.notes.join(' ')).toMatch(/obese/i);
    });
  });

  describe('silhouette', () => {
    it('does not call a lean athlete heavy (the BMI trap)', () => {
      const athlete: BodyProfile = {
        heightCm: 180, weightKg: 95, bodyFatPct: 10, muscle: 88, fitness: 85, posture: 80,
      };
      expect(bmi(athlete)).toBeGreaterThan(29); // BMI alone says "almost obese"
      expect(silhouette(athlete)).toBe('Shredded');
    });

    it('separates fat from trained mass at the same weight', () => {
      const soft: BodyProfile = { heightCm: 175, weightKg: 85, bodyFatPct: 30, muscle: 20, fitness: 20, posture: 45 };
      const solid: BodyProfile = { heightCm: 175, weightKg: 85, bodyFatPct: 28, muscle: 70, fitness: 65, posture: 75 };
      expect(silhouette(soft)).toBe('Soft');
      expect(silhouette(solid)).toBe('Solid');
    });
  });

  describe('physicalCondition', () => {
    it('stays inside [0, 100] for any body', () => {
      for (let i = 0; i < 200; i++) {
        const b = createBody(`c${i}`, 'female', 40);
        const v = physicalCondition(b);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });

    it('peaks in a healthy fat range instead of rewarding starvation', () => {
      const mk = (bodyFatPct: number): BodyProfile => ({
        heightCm: 175, weightKg: 75, bodyFatPct, muscle: 60, fitness: 60, posture: 70,
      });
      const healthy = physicalCondition(mk(16));
      const emaciated = physicalCondition(mk(4));
      const obese = physicalCondition(mk(40));
      expect(healthy).toBeGreaterThan(emaciated);
      expect(healthy).toBeGreaterThan(obese);
    });
  });
});
