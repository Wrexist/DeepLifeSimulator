import {
  WARDROBE_TIERS,
  computePresence,
  createBody,
  createStyle,
  neutralMorphs,
  presenceLabel,
  presenceMultiplier,
  randomizeFace,
  type PresenceInputs,
  type StyleProfile,
} from '@/lib/identity';

const neutralFace = { ...randomizeFace('n'), morphs: neutralMorphs() };

function inputs(overrides: Partial<PresenceInputs> = {}): PresenceInputs {
  return {
    face: neutralFace,
    body: createBody('p', 'female', 25),
    style: createStyle(),
    age: 25,
    confidence: 50,
    reputation: 20,
    health: 85,
    ...overrides,
  };
}

describe('presence', () => {
  it('breakdown components sum to the total', () => {
    for (let i = 0; i < 100; i++) {
      const b = computePresence(inputs({ face: randomizeFace(`f${i}`), age: 18 + i % 70 }));
      const sum = b.looks + b.physique + b.presentation + b.bearing + b.status;
      // Each field is rounded to 1dp independently, so allow the rounding slack.
      expect(Math.abs(sum - b.total)).toBeLessThan(0.3);
    }
  });

  it('stays inside [0, 100] at both extremes and at every age', () => {
    const worstStyle: StyleProfile = { grooming: 0, skincare: 0, wardrobeTier: 0, teeth: 0, lastHaircutWeek: -1 };
    const bestStyle: StyleProfile = {
      grooming: 100, skincare: 100, wardrobeTier: WARDROBE_TIERS.length - 1, teeth: 100, lastHaircutWeek: 0,
    };
    for (let age = 0; age <= 110; age += 2) {
      const low = computePresence(inputs({
        age, style: worstStyle, confidence: 0, reputation: 0, health: 0,
        body: { heightCm: 160, weightKg: 130, bodyFatPct: 55, muscle: 0, fitness: 0, posture: 0 },
      }));
      const high = computePresence(inputs({
        age, style: bestStyle, confidence: 100, reputation: 100, health: 100,
        body: { heightCm: 180, weightKg: 78, bodyFatPct: 15, muscle: 85, fitness: 90, posture: 95 },
      }));
      expect(low.total).toBeGreaterThanOrEqual(0);
      expect(high.total).toBeLessThanOrEqual(100);
      expect(high.total).toBeGreaterThan(low.total);
    }
  });

  it('never lets the face alone dominate the score', () => {
    // Design constraint 1: a perfect face with nothing else must not reach the
    // top band, or rerolling becomes the only meaningful decision.
    const beautifulWreck = computePresence(inputs({
      face: neutralFace, // maximum harmony
      age: 22,
      style: { grooming: 0, skincare: 0, wardrobeTier: 0, teeth: 0, lastHaircutWeek: -1 },
      body: { heightCm: 170, weightKg: 115, bodyFatPct: 48, muscle: 5, fitness: 5, posture: 20 },
      confidence: 5,
      reputation: 0,
      health: 40,
    }));
    expect(beautifulWreck.total).toBeLessThan(50);
  });

  it('lets a plain, well-maintained character beat a beautiful neglected one', () => {
    // Design constraint 2: everything must be reachable. This is the test that
    // keeps the chapter playable for someone who did not reroll for a face.
    const plainButSharp = computePresence(inputs({
      face: randomizeFace('plain-face', { spread: 1 }),
      age: 30,
      style: { grooming: 96, skincare: 92, wardrobeTier: 4, teeth: 95, lastHaircutWeek: 0 },
      body: { heightCm: 175, weightKg: 74, bodyFatPct: 16, muscle: 72, fitness: 80, posture: 85 },
      confidence: 85,
      reputation: 60,
      health: 92,
    }));
    const beautifulNeglected = computePresence(inputs({
      face: neutralFace,
      age: 30,
      style: { grooming: 8, skincare: 12, wardrobeTier: 0, teeth: 25, lastHaircutWeek: -1 },
      body: { heightCm: 175, weightKg: 105, bodyFatPct: 44, muscle: 10, fitness: 8, posture: 30 },
      confidence: 20,
      reputation: 5,
      health: 50,
    }));
    expect(plainButSharp.total).toBeGreaterThan(beautifulNeglected.total);
  });

  it('shifts weight from looks to status with age rather than just subtracting', () => {
    // Design constraint 3. The same person, aged: looks must contribute less and
    // status more — and an old character with standing must remain competitive.
    const young = computePresence(inputs({ age: 20, reputation: 90, confidence: 90 }));
    const old = computePresence(inputs({ age: 75, reputation: 90, confidence: 90 }));
    expect(old.looks).toBeLessThan(young.looks);
    expect(old.status).toBeGreaterThan(young.status);
    expect(old.bearing).toBeGreaterThan(young.bearing);
    // Not a collapse — an accomplished 75-year-old still lands well.
    expect(old.total).toBeGreaterThan(55);
  });

  it('does not let age alone erase a maintained character', () => {
    const maintained = (age: number) => computePresence(inputs({
      age,
      style: { grooming: 90, skincare: 85, wardrobeTier: 4, teeth: 90, lastHaircutWeek: 0 },
      body: { heightCm: 175, weightKg: 74, bodyFatPct: 17, muscle: 65, fitness: 70, posture: 80 },
      confidence: 80, reputation: 70, health: 85,
    })).total;
    expect(maintained(70)).toBeGreaterThan(maintained(25) * 0.8);
  });

  it('penalises visible ill health through the looks term', () => {
    expect(computePresence(inputs({ health: 20 })).looks)
      .toBeLessThan(computePresence(inputs({ health: 95 })).looks);
  });

  it('labels bands monotonically', () => {
    const seen: string[] = [];
    for (let t = 0; t <= 100; t += 1) {
      const label = presenceLabel(t);
      if (seen[seen.length - 1] !== label) seen.push(label);
    }
    expect(seen).toEqual([
      'Off-putting', 'Unkempt', 'Forgettable', 'Presentable', 'Attractive', 'Striking', 'Magnetic',
    ]);
  });

  describe('presenceMultiplier', () => {
    it('stays in a narrow band so looks never replace competence', () => {
      expect(presenceMultiplier(0)).toBeCloseTo(0.75, 2);
      expect(presenceMultiplier(100)).toBeCloseTo(1.3, 2);
      expect(presenceMultiplier(50)).toBeCloseTo(1.025, 2);
    });

    it('scales with the caller strength', () => {
      // An engineering interview should barely care; dating should care a lot.
      expect(presenceMultiplier(100, 0)).toBe(1);
      expect(presenceMultiplier(100, 0.35)).toBeLessThan(presenceMultiplier(100, 1));
      expect(presenceMultiplier(0, 0.35)).toBeGreaterThan(presenceMultiplier(0, 1));
    });

    it('is monotonic in the score', () => {
      let prev = -Infinity;
      for (let t = 0; t <= 100; t++) {
        const m = presenceMultiplier(t);
        expect(m).toBeGreaterThan(prev);
        prev = m;
      }
    });

    it('clamps hostile inputs', () => {
      expect(presenceMultiplier(NaN)).toBeCloseTo(0.75, 2);
      expect(presenceMultiplier(999)).toBeCloseTo(1.3, 2);
      expect(presenceMultiplier(50, 99)).toBe(presenceMultiplier(50, 1));
    });
  });
});
