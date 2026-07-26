import {
  GROOMING_SERVICES,
  WARDROBE_TIERS,
  applyGroomingService,
  createStyle,
  decayStyleWeek,
  normalizeStyle,
  presentationScore,
  wardrobeWeeklyUpkeep,
  type StyleProfile,
  type StyleWeekInputs,
} from '@/lib/identity';

const calm: StyleWeekInputs = { age: 30, stress: 30, health: 80 };

describe('style', () => {
  describe('normalizeStyle', () => {
    it('repairs garbage without throwing', () => {
      const s = normalizeStyle({ grooming: 500, skincare: -20, wardrobeTier: 99, teeth: NaN } as never);
      expect(s.grooming).toBe(100);
      expect(s.skincare).toBe(0);
      expect(s.wardrobeTier).toBe(WARDROBE_TIERS.length - 1);
      expect(s.teeth).toBe(0);
      expect(s.lastHaircutWeek).toBe(-1);
    });

    it('supplies a full default profile from nothing', () => {
      expect(normalizeStyle(undefined)).toEqual({
        grooming: 70, skincare: 70, wardrobeTier: 1, teeth: 80, lastHaircutWeek: -1,
      });
    });
  });

  describe('applyGroomingService', () => {
    it('records the haircut week for every barber service', () => {
      for (const id of ['barber_basic', 'barber_premium', 'barber_celebrity']) {
        expect(applyGroomingService(createStyle(), id, 42).lastHaircutWeek).toBe(42);
      }
    });

    it('caps cheap services below the ceiling expensive ones reach', () => {
      // The anti-exploit is a CEILING, not a per-visit amount: no number of
      // budget cuts can ever reach where a stylist gets you. Compare the
      // saturated value of each service, since that is what a determined player
      // would grind toward.
      const saturate = (id: string) => {
        let s = { ...createStyle(), grooming: 0 };
        for (let i = 0; i < 50; i++) s = applyGroomingService(s, id, i);
        return s.grooming;
      };
      expect(saturate('barber_basic')).toBe(78);
      expect(saturate('barber_premium')).toBe(92);
      expect(saturate('barber_celebrity')).toBe(100);
      expect(saturate('barber_basic')).toBeLessThan(saturate('barber_premium'));
      expect(saturate('barber_premium')).toBeLessThan(saturate('barber_celebrity'));
    });

    it('needs more than one cheap visit to match one expensive visit', () => {
      // The flip side of the ceiling: a single premium cut is worth more than a
      // single budget cut, so paying up is never pointless.
      const from = { ...createStyle(), grooming: 30 };
      expect(applyGroomingService(from, 'barber_premium', 0).grooming)
        .toBeGreaterThan(applyGroomingService(from, 'barber_basic', 0).grooming);
    });

    it('never lowers a stat that is already above the cap', () => {
      const pristine: StyleProfile = { ...createStyle(), grooming: 100, skincare: 100, teeth: 100 };
      expect(applyGroomingService(pristine, 'barber_basic', 1).grooming).toBe(100);
      expect(applyGroomingService(pristine, 'skincare_basic', 1).skincare).toBe(100);
      expect(applyGroomingService(pristine, 'teeth_clean', 1).teeth).toBe(100);
    });

    it('is a no-op for an unknown service id', () => {
      const s = createStyle();
      expect(applyGroomingService(s, 'not_a_service', 5)).toEqual(normalizeStyle(s));
    });

    it('keeps every result inside [0, 100]', () => {
      for (const svc of GROOMING_SERVICES) {
        const s = applyGroomingService({ ...createStyle(), grooming: 99, skincare: 99, teeth: 99 }, svc.id, 3);
        for (const v of [s.grooming, s.skincare, s.teeth]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('decayStyleWeek', () => {
    it('makes a fresh haircut scruffy in about a month', () => {
      let s = applyGroomingService(createStyle(), 'barber_premium', 0);
      const fresh = s.grooming;
      for (let i = 0; i < 4; i++) s = decayStyleWeek(s, calm);
      expect(s.grooming).toBeLessThan(fresh);
      expect(fresh - s.grooming).toBeGreaterThan(15);
      expect(fresh - s.grooming).toBeLessThan(30);
    });

    it('decays skin far slower than grooming', () => {
      const start = createStyle();
      const after = decayStyleWeek(start, calm);
      expect(start.grooming - after.grooming).toBeGreaterThan(start.skincare - after.skincare);
    });

    it('decays teeth slower still — years, not seasons', () => {
      let s = createStyle();
      for (let i = 0; i < 52; i++) s = decayStyleWeek(s, calm);
      expect(createStyle().teeth - s.teeth).toBeLessThan(20);
      expect(s.teeth).toBeGreaterThan(60);
    });

    it('punishes stress, age and smoking on skin', () => {
      const base = decayStyleWeek(createStyle(), calm).skincare;
      const stressed = decayStyleWeek(createStyle(), { ...calm, stress: 95 }).skincare;
      const old = decayStyleWeek(createStyle(), { ...calm, age: 70 }).skincare;
      const smoker = decayStyleWeek(createStyle(), { ...calm, smoker: true }).skincare;
      expect(stressed).toBeLessThan(base);
      expect(old).toBeLessThan(base);
      expect(smoker).toBeLessThan(base);
    });

    it('never goes below zero over a full lifetime of neglect', () => {
      let s = createStyle();
      for (let i = 0; i < 4000; i++) {
        s = decayStyleWeek(s, { age: 20 + i / 52, stress: 100, health: 10, smoker: true });
        expect(s.grooming).toBeGreaterThanOrEqual(0);
        expect(s.skincare).toBeGreaterThanOrEqual(0);
        expect(s.teeth).toBeGreaterThanOrEqual(0);
      }
    });

    it('preserves lastHaircutWeek through decay', () => {
      const s = applyGroomingService(createStyle(), 'barber_basic', 77);
      expect(decayStyleWeek(s, calm).lastHaircutWeek).toBe(77);
    });
  });

  describe('wardrobeWeeklyUpkeep', () => {
    it('is free at the bottom tier and rises with quality', () => {
      const costs = WARDROBE_TIERS.map((_, i) => wardrobeWeeklyUpkeep({ ...createStyle(), wardrobeTier: i }));
      expect(costs[0]).toBe(0);
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1]);
      }
    });
  });

  describe('presentationScore', () => {
    it('stays inside [0, 100] at both extremes', () => {
      const worst: StyleProfile = { grooming: 0, skincare: 0, wardrobeTier: 0, teeth: 0, lastHaircutWeek: -1 };
      const best: StyleProfile = {
        grooming: 100, skincare: 100, wardrobeTier: WARDROBE_TIERS.length - 1, teeth: 100, lastHaircutWeek: 0,
      };
      expect(presentationScore(worst)).toBeGreaterThanOrEqual(0);
      expect(presentationScore(best)).toBeLessThanOrEqual(100);
      expect(presentationScore(best)).toBeGreaterThan(presentationScore(worst));
    });

    it('rewards a better wardrobe at identical grooming', () => {
      const cheap = { ...createStyle(), wardrobeTier: 0 };
      const rich = { ...createStyle(), wardrobeTier: WARDROBE_TIERS.length - 1 };
      expect(presentationScore(rich)).toBeGreaterThan(presentationScore(cheap));
    });

    it('lets grooming beat money — a maintained cheap look outscores a neglected rich one', () => {
      const groomedCheap: StyleProfile = {
        grooming: 100, skincare: 95, wardrobeTier: 1, teeth: 95, lastHaircutWeek: 0,
      };
      const neglectedRich: StyleProfile = {
        grooming: 5, skincare: 10, wardrobeTier: WARDROBE_TIERS.length - 1, teeth: 20, lastHaircutWeek: -1,
      };
      expect(presentationScore(groomedCheap)).toBeGreaterThan(presentationScore(neglectedRich));
    });
  });
});
