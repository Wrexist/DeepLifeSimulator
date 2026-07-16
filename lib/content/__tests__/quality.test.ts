import { computeQuality, qualityMultiplier } from '../quality';
import { GamingEquipment, PCUpgradeLevels } from '@/contexts/game/types';

const emptyEquip: GamingEquipment = {
  microphone: false, webcam: false, gamingChair: false, greenScreen: false, lighting: false,
};
const emptyPC: PCUpgradeLevels = {
  cpu: 0, gpu: 0, ram: 0, ssd: 0, motherboard: 0, cooling: 0, psu: 0, case: 0, network: 0,
};

describe('computeQuality', () => {
  it('returns 0 / starter when nothing is owned', () => {
    const q = computeQuality(emptyEquip, emptyPC);
    expect(q.total).toBe(0);
    expect(q.tier).toBe('starter');
  });

  it('adds accessory weights', () => {
    const q = computeQuality({ ...emptyEquip, microphone: true, lighting: true }, emptyPC);
    // mic 5 + lighting 4 = 9
    expect(q.accessories).toBe(9);
    expect(q.pc).toBe(0);
  });

  it('adds PC tier weights', () => {
    const q = computeQuality(emptyEquip, { ...emptyPC, gpu: 3, cpu: 2 });
    // gpu 4*3=12 + cpu 4*2=8 = 20
    expect(q.pc).toBe(20);
  });

  it('caps total at 100', () => {
    const fullEquip: GamingEquipment = {
      microphone: true, webcam: true, gamingChair: true, greenScreen: true, lighting: true,
    };
    const maxPC: PCUpgradeLevels = {
      cpu: 10, gpu: 10, ram: 10, ssd: 10, motherboard: 10, cooling: 10, psu: 10, case: 10, network: 10,
    };
    const q = computeQuality(fullEquip, maxPC);
    expect(q.total).toBe(100);
    expect(q.tier).toBe('elite');
  });

  it('handles undefined inputs gracefully', () => {
    expect(computeQuality(undefined, undefined).total).toBe(0);
  });
});

describe('qualityMultiplier', () => {
  it('starter 0.5, budget 1.0, pro 1.6, elite 2.5', () => {
    expect(qualityMultiplier(10)).toBe(0.5);
    expect(qualityMultiplier(40)).toBe(1.0);
    expect(qualityMultiplier(60)).toBe(1.6);
    expect(qualityMultiplier(90)).toBe(2.5);
  });

  it('hits every anchor point exactly (backwards-compatible)', () => {
    // The historical per-tier values must be reproduced bit-for-bit at the
    // anchor scores so pinned earnings math is unchanged.
    expect(qualityMultiplier(10)).toBeCloseTo(0.5, 10);
    expect(qualityMultiplier(40)).toBeCloseTo(1.0, 10);
    expect(qualityMultiplier(60)).toBeCloseTo(1.6, 10);
    expect(qualityMultiplier(90)).toBeCloseTo(2.5, 10);
  });

  it('is monotonically non-decreasing across the whole 0..100 range', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 100; t++) {
      const m = qualityMultiplier(t);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it('has no dead zone: gear WITHIN a band strictly increases the multiplier', () => {
    // The whole point of the fix — buying gear inside a tier used to change
    // earnings by exactly 0. Now every point between anchors helps.
    expect(qualityMultiplier(25)).toBeGreaterThan(qualityMultiplier(15));
    expect(qualityMultiplier(50)).toBeGreaterThan(qualityMultiplier(45));
    expect(qualityMultiplier(80)).toBeGreaterThan(qualityMultiplier(70));
  });

  it('interpolates linearly between anchors (midpoint of 40..60 is 1.3)', () => {
    expect(qualityMultiplier(50)).toBeCloseTo(1.3, 10); // halfway between 1.0 and 1.6
  });

  it('is flat below the first anchor and above the last, and clamps out-of-range', () => {
    expect(qualityMultiplier(0)).toBe(0.5);
    expect(qualityMultiplier(5)).toBe(0.5);
    expect(qualityMultiplier(100)).toBe(2.5);
    expect(qualityMultiplier(999)).toBe(2.5); // clamped
    expect(qualityMultiplier(-10)).toBe(0.5); // clamped
  });

  it('reads .total from a QualityBreakdown object', () => {
    expect(qualityMultiplier({ total: 50, accessories: 0, pc: 50, tier: 'pro' })).toBeCloseTo(1.3, 10);
  });
});
