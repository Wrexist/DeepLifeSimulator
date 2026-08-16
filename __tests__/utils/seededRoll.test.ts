import { makeWeeklyRoll, fnv1a32, mulberry32 } from '@/utils/seededRoll';

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

/**
 * The 2026-08-16 audit (H7c) collapsed five hand-copied FNV-1a loops and two
 * mulberry32 copies into the two primitives in `utils/seededRoll.ts`. Every one
 * of those copies feeds a roll that is baked into a save — stock prices, the job
 * board, Pulse scandals, the deterministic RNG commit log — so "the loops looked
 * the same" is not good enough. These tests re-implement each replaced copy
 * VERBATIM and assert bit-equality, which is the actual claim being made.
 */
describe('shared RNG primitives — bit-identical to the copies they replaced', () => {
  // Verbatim copy of the loop that lived in lib/social/pulseTick.ts,
  // lib/careers/jobMarket.ts and lib/randomness/deterministicRng.ts.
  const legacyFnv = (input: string): number => {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // Verbatim copy of lib/economy/stockMarket.ts's mulberry32.
  const legacyMulberry = (seed: number): (() => number) => {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Verbatim copy of the pre-consolidation makeWeeklyRoll body.
  const legacyWeeklyRoll = (weeksLived: number) => (key: string): number => {
    let h = ((weeksLived | 0) ^ 0x811c9dc5) >>> 0;
    for (let i = 0; i < key.length; i++) {
      h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
    }
    let a = h >>> 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const SAMPLES = ['', 'a', 'AAPL', '42:7', 'scandal|1040|125000|38', 'seed|career.chef', 'é中😀'];

  it('fnv1a32 matches the hand-rolled FNV-1a loop it replaced', () => {
    for (const s of SAMPLES) expect(fnv1a32(s)).toBe(legacyFnv(s));
    for (let w = 0; w < 400; w++) {
      for (let i = 0; i < 5; i++) expect(fnv1a32(`${w}:${i}`)).toBe(legacyFnv(`${w}:${i}`));
    }
  });

  it('mulberry32 matches the copy in stockMarket', () => {
    for (const seed of [0, 1, -1, 2166136261, 0x7fffffff, 0xffffffff]) {
      const mine = mulberry32(seed);
      const theirs = legacyMulberry(seed);
      for (let i = 0; i < 20; i++) expect(mine()).toBe(theirs());
    }
  });

  it('makeWeeklyRoll is unchanged by the refactor (no roll moved)', () => {
    for (let w = 0; w < 300; w++) {
      const now = makeWeeklyRoll(w);
      const before = legacyWeeklyRoll(w);
      for (const k of SAMPLES) expect(now(k)).toBe(before(k));
    }
  });

  it('fnv1a32 seedBasis reproduces the week-folded seed exactly', () => {
    // How makeWeeklyRoll folds the week in — pinned so a future signature
    // change cannot quietly re-seed every weekly subsystem.
    const w = 137;
    expect(fnv1a32('darkweb.policeEvent', (w | 0) ^ 0x811c9dc5)).toBe(
      (() => {
        let h = ((w | 0) ^ 0x811c9dc5) >>> 0;
        for (const ch of 'darkweb.policeEvent') h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
        return h >>> 0;
      })(),
    );
  });

  it('the grandchildren copy is DELIBERATELY not this function', () => {
    // lib/parenting/grandchildren.ts returns Math.abs(signed32), which differs
    // from `>>> 0` for every hash in the top half of the range. It is left in
    // place because switching it would re-roll grandchildren already saved
    // (v34). This asserts the two really do disagree, so nobody "tidies" it up
    // later on the assumption they are the same.
    const legacyAbs = (input: string): number => {
      let h = 2166136261;
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return Math.abs(h);
    };
    let differ = 0;
    for (let i = 0; i < 200; i++) {
      if (legacyAbs(`child-${i}`) !== fnv1a32(`child-${i}`)) differ++;
    }
    expect(differ).toBeGreaterThan(0);
  });
});
