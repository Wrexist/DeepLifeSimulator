import { makeWeeklyRoll } from '@/utils/seededRoll';

describe('makeWeeklyRoll', () => {
  it('is deterministic: same week + same key => same value', () => {
    const a = makeWeeklyRoll(42);
    const b = makeWeeklyRoll(42);
    expect(a('crypto.btc.priceU1')).toBe(b('crypto.btc.priceU1'));
    expect(a('darkweb.policeEvent')).toBe(b('darkweb.policeEvent'));
  });

  it('produces independent values for distinct keys', () => {
    const roll = makeWeeklyRoll(7);
    const v1 = roll('a');
    const v2 = roll('b');
    const v3 = roll('c');
    expect(v1).not.toBe(v2);
    expect(v2).not.toBe(v3);
  });

  it('changes across weeks for the same key', () => {
    const k = 'politics.scandal.fire';
    expect(makeWeeklyRoll(1)(k)).not.toBe(makeWeeklyRoll(2)(k));
  });

  it('always returns a value in [0, 1)', () => {
    const roll = makeWeeklyRoll(123);
    for (let i = 0; i < 1000; i++) {
      const v = roll(`key.${i}`);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is roughly uniform across the unit interval', () => {
    const roll = makeWeeklyRoll(999);
    const buckets = new Array(10).fill(0);
    const N = 10000;
    for (let i = 0; i < N; i++) {
      buckets[Math.floor(roll(`sample.${i}`) * 10)]++;
    }
    // Each decile should hold ~1000; allow generous slack for a hash PRNG.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(N / 10 * 0.7);
      expect(count).toBeLessThan(N / 10 * 1.3);
    }
  });
});
