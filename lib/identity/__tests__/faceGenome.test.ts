import {
  FACE_MORPH_KEYS,
  HAIR_COLORS,
  EYE_COLORS,
  SKIN_TONES,
  applyAging,
  clampMorphs,
  facialHarmony,
  inheritFace,
  makeGenomeRng,
  neutralMorphs,
  normalizeGenome,
  randomizeFace,
} from '@/lib/identity';

describe('faceGenome', () => {
  describe('makeGenomeRng', () => {
    it('is deterministic for a seed and well distributed', () => {
      const a = makeGenomeRng('abc');
      const b = makeGenomeRng('abc');
      const draws = Array.from({ length: 50 }, () => a());
      expect(draws).toEqual(Array.from({ length: 50 }, () => b()));
      expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...draws)).toBeLessThan(1);
      // Not a constant sequence.
      expect(new Set(draws).size).toBeGreaterThan(40);
    });

    it('gives different sequences for different seeds', () => {
      expect(makeGenomeRng('abc')()).not.toBe(makeGenomeRng('abd')());
    });
  });

  describe('clampMorphs', () => {
    it('fills every key at neutral from nothing', () => {
      const m = clampMorphs(undefined);
      expect(Object.keys(m).sort()).toEqual([...FACE_MORPH_KEYS].sort());
      expect(Object.values(m).every((v) => v === 0.5)).toBe(true);
    });

    it('clamps out-of-range and non-finite values', () => {
      const m = clampMorphs({ eyeSize: 4, noseWidth: -2, jawWidth: NaN, chinLength: Infinity });
      expect(m.eyeSize).toBe(1);
      expect(m.noseWidth).toBe(0);
      expect(m.jawWidth).toBe(0.5);
      expect(m.chinLength).toBe(0.5);
    });

    it('neutralMorphs matches a fully-default clamp', () => {
      expect(neutralMorphs()).toEqual(clampMorphs({}));
    });
  });

  describe('randomizeFace', () => {
    it('is deterministic for a seed', () => {
      expect(randomizeFace('player-1', { sex: 'male' })).toEqual(
        randomizeFace('player-1', { sex: 'male' }),
      );
    });

    it('produces different faces for different seeds', () => {
      const a = randomizeFace('seed-a');
      const b = randomizeFace('seed-b');
      expect(a.morphs).not.toEqual(b.morphs);
    });

    it('keeps every morph inside [0, 1] across many seeds', () => {
      for (let i = 0; i < 400; i++) {
        const g = randomizeFace(`s${i}`, { sex: i % 2 ? 'male' : 'female', spread: 1 });
        for (const key of FACE_MORPH_KEYS) {
          expect(g.morphs[key]).toBeGreaterThanOrEqual(0);
          expect(g.morphs[key]).toBeLessThanOrEqual(1);
        }
        expect(g.skinTone).toBeGreaterThanOrEqual(0);
        expect(g.skinTone).toBeLessThan(SKIN_TONES.length);
        expect(g.hairColor).toBeGreaterThanOrEqual(0);
        expect(g.hairColor).toBeLessThan(HAIR_COLORS.length);
        expect(g.eyeColor).toBeGreaterThanOrEqual(0);
        expect(g.eyeColor).toBeLessThan(EYE_COLORS.length);
      }
    });

    it('centre-biases morphs so extreme faces stay rare', () => {
      // The bell sampler is the reason the population does not read as a freak
      // show. Assert the distribution, not just the bounds.
      const values: number[] = [];
      for (let i = 0; i < 500; i++) {
        values.push(randomizeFace(`d${i}`).morphs.jawWidth);
      }
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      expect(mean).toBeGreaterThan(0.42);
      expect(mean).toBeLessThan(0.58);
      const extremes = values.filter((v) => v < 0.15 || v > 0.85).length;
      expect(extremes / values.length).toBeLessThan(0.12);
    });

    it('never gives natural-born characters a dye colour', () => {
      for (let i = 0; i < 200; i++) {
        expect(randomizeFace(`h${i}`).hairColor).toBeLessThan(11);
      }
    });

    it('does not give facial hair to non-male characters', () => {
      for (let i = 0; i < 100; i++) {
        expect(randomizeFace(`f${i}`, { sex: 'female' }).facialHair).toBe('none');
      }
    });

    it('lets sex change the face and the hair, and nothing else', () => {
      // `sex` is documented as biasing the face morphs and the hair pools. It
      // was also reaching skin tone, hair colour and eye colour, because the
      // male branch drew a facial-hair value and the other branch did not — so
      // every later draw came off a different position in the stream.
      //
      // Invisible in isolation, since either roll is a valid random character.
      // What it broke is COMPARISON: two sexes of one seed differed in colouring
      // as well as in face, so a side-by-side of the sex bias could not show
      // what the bias actually does.
      for (let i = 0; i < 50; i++) {
        const m = randomizeFace(`s${i}`, { sex: 'male' });
        const f = randomizeFace(`s${i}`, { sex: 'female' });
        expect(f.skinTone).toBe(m.skinTone);
        expect(f.hairColor).toBe(m.hairColor);
        expect(f.eyeColor).toBe(m.eyeColor);
        expect(f.blemishes).toBe(m.blemishes);
      }
    });
  });

  describe('normalizeGenome', () => {
    it('repairs a garbage genome without throwing', () => {
      const g = normalizeGenome({
        morphs: { eyeSize: 9 } as never,
        skinTone: 999,
        hairColor: -5,
        eyeColor: NaN,
        hairStyle: 'mullet' as never,
        facialHair: 'beardo' as never,
        blemishes: 12,
      });
      expect(g.skinTone).toBe(SKIN_TONES.length - 1);
      expect(g.hairColor).toBe(0);
      expect(g.eyeColor).toBe(0);
      expect(g.hairStyle).toBe('short');
      expect(g.facialHair).toBe('none');
      expect(g.blemishes).toBe(1);
      expect(g.morphs.eyeSize).toBe(1);
    });

    it('falls back to a seeded random face for null input', () => {
      expect(normalizeGenome(null, 'x')).toEqual(randomizeFace('x'));
    });
  });

  describe('inheritFace', () => {
    const mum = randomizeFace('mum', { sex: 'female' });
    const dad = randomizeFace('dad', { sex: 'male' });

    it('is deterministic per child seed', () => {
      expect(inheritFace(mum, dad, 'child-1')).toEqual(inheritFace(mum, dad, 'child-1'));
    });

    it('makes siblings related but not identical', () => {
      const a = inheritFace(mum, dad, 'child-1');
      const b = inheritFace(mum, dad, 'child-2');
      expect(a.morphs).not.toEqual(b.morphs);
    });

    it('keeps children within the parents range plus mutation', () => {
      // Mutation is +/-0.06, so a child may exceed the parental span slightly —
      // that is the point. It must not wander further than that.
      for (let i = 0; i < 200; i++) {
        const child = inheritFace(mum, dad, `kid${i}`);
        for (const key of FACE_MORPH_KEYS) {
          const lo = Math.min(mum.morphs[key], dad.morphs[key]);
          const hi = Math.max(mum.morphs[key], dad.morphs[key]);
          expect(child.morphs[key]).toBeGreaterThanOrEqual(Math.max(0, lo - 0.061));
          expect(child.morphs[key]).toBeLessThanOrEqual(Math.min(1, hi + 0.061));
        }
      }
    });

    it('lands skin tone between the parents', () => {
      const pale = { ...mum, skinTone: 1 };
      const deep = { ...dad, skinTone: 8 };
      for (let i = 0; i < 100; i++) {
        const child = inheritFace(pale, deep, `k${i}`);
        expect(child.skinTone).toBeGreaterThanOrEqual(1);
        expect(child.skinTone).toBeLessThanOrEqual(8);
      }
    });

    it('does not pass a dye job on to the baby', () => {
      const dyed = { ...mum, hairColor: 11 };
      const alsoDyed = { ...dad, hairColor: 13 };
      for (let i = 0; i < 100; i++) {
        expect(inheritFace(dyed, alsoDyed, `k${i}`).hairColor).toBeLessThan(11);
      }
    });
  });

  describe('applyAging', () => {
    const base = randomizeFace('ager', { sex: 'male' });

    it('never mutates the stored genome', () => {
      const snapshot = JSON.parse(JSON.stringify(base));
      applyAging(base, 80);
      expect(base).toEqual(snapshot);
    });

    it('keeps every morph in range at every age', () => {
      for (let age = 0; age <= 110; age++) {
        const aged = applyAging(base, age);
        for (const key of FACE_MORPH_KEYS) {
          expect(aged.morphs[key]).toBeGreaterThanOrEqual(0);
          expect(aged.morphs[key]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('gives children bigger eyes and smaller noses than their adult self', () => {
      const child = applyAging(base, 5);
      const adult = applyAging(base, 25);
      expect(child.morphs.eyeSize).toBeGreaterThan(adult.morphs.eyeSize);
      expect(child.morphs.noseLength).toBeLessThan(adult.morphs.noseLength);
      expect(child.morphs.jawWidth).toBeLessThan(adult.morphs.jawWidth);
    });

    it('ages continuously rather than snapping between bands', () => {
      // The pre-rendered portrait pool snapped; this must not. Adjacent years
      // should differ by a small amount, never by a jump.
      for (let age = 1; age < 100; age++) {
        const a = applyAging(base, age);
        const b = applyAging(base, age + 1);
        for (const key of FACE_MORPH_KEYS) {
          expect(Math.abs(a.morphs[key] - b.morphs[key])).toBeLessThan(0.05);
        }
      }
    });

    it('deflates cheeks and deepens eyes with age', () => {
      const young = applyAging(base, 30);
      const old = applyAging(base, 80);
      expect(old.morphs.cheekFullness).toBeLessThan(young.morphs.cheekFullness);
      expect(old.morphs.eyeDepth).toBeGreaterThan(young.morphs.eyeDepth);
      expect(old.morphs.earSize).toBeGreaterThan(young.morphs.earSize);
    });

    it('greys hair progressively but never re-darkens it', () => {
      const brown = { ...base, hairColor: 3 };
      expect(applyAging(brown, 30).hairColor).toBe(3);
      expect(applyAging(brown, 60).hairColor).toBe(9);
      expect(applyAging(brown, 85).hairColor).toBe(10);
    });

    it('leaves dyed hair dyed — dye is what hides grey', () => {
      const dyed = { ...base, hairColor: 12 };
      expect(applyAging(dyed, 85).hairColor).toBe(12);
    });

    it('never takes long hair away from a player who chose it', () => {
      const longHaired = { ...base, hairStyle: 'long' as const, morphs: { ...base.morphs, foreheadSlope: 0.95 } };
      expect(applyAging(longHaired, 80).hairStyle).toBe('long');
    });

    it('accumulates blemishes monotonically', () => {
      let prev = -1;
      for (let age = 0; age <= 100; age += 5) {
        const v = applyAging(base, age).blemishes;
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    });
  });

  describe('facialHarmony', () => {
    it('scores a neutral face highly', () => {
      const neutral = { ...randomizeFace('n'), morphs: neutralMorphs() };
      expect(facialHarmony(neutral)).toBeGreaterThan(0.9);
    });

    it('stays inside [0, 1] for every random face', () => {
      for (let i = 0; i < 500; i++) {
        const h = facialHarmony(randomizeFace(`h${i}`, { spread: 1 }));
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(1);
      }
    });

    it('punishes an extremely imbalanced face', () => {
      const neutral = { ...randomizeFace('n'), morphs: neutralMorphs() };
      const lopsided = {
        ...neutral,
        morphs: { ...neutral.morphs, eyeSpacing: 1, faceWidth: 1, faceLength: 1, noseWidth: 1, mouthWidth: 0 },
      };
      expect(facialHarmony(lopsided)).toBeLessThan(facialHarmony(neutral));
    });
  });
});
