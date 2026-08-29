import {
  ECONOMY_SAMPLE_WEEKS,
  diffEconomySamples,
  isEconomySampleWeek,
  type EconomySample,
} from '../economySnapshot';

const sample = (o: Partial<EconomySample> = {}): EconomySample => ({
  totalEarned: 0,
  totalSpent: 0,
  money: 0,
  netWorth: 0,
  weeksThisLife: 0,
  ...o,
});

describe('isEconomySampleWeek', () => {
  it('fires one game month apart', () => {
    expect(isEconomySampleWeek(0)).toBe(true);
    expect(isEconomySampleWeek(ECONOMY_SAMPLE_WEEKS)).toBe(true);
    expect(isEconomySampleWeek(ECONOMY_SAMPLE_WEEKS * 3)).toBe(true);
    expect(isEconomySampleWeek(1)).toBe(false);
    expect(isEconomySampleWeek(ECONOMY_SAMPLE_WEEKS - 1)).toBe(false);
  });

  it('rejects invalid weeks rather than sampling on them', () => {
    expect(isEconomySampleWeek(NaN)).toBe(false);
    expect(isEconomySampleWeek(-4)).toBe(false);
  });
});

describe('diffEconomySamples', () => {
  it('reports the life-so-far totals for the FIRST sample', () => {
    // Dropping the first rollup would systematically exclude the shortest
    // lives — exactly the ones a retention question is about.
    const r = diffEconomySamples(null, sample({ totalEarned: 800, totalSpent: 300, weeksThisLife: 4, netWorth: 500 }));
    expect(r.earned).toBe(800);
    expect(r.spent).toBe(300);
    expect(r.netFlow).toBe(500);
    expect(r.spanWeeks).toBe(4);
  });

  it('differences two samples', () => {
    const prev = sample({ totalEarned: 1000, totalSpent: 400, netWorth: 600, weeksThisLife: 4 });
    const cur = sample({ totalEarned: 1600, totalSpent: 900, netWorth: 700, money: 250, weeksThisLife: 8 });
    const r = diffEconomySamples(prev, cur);
    expect(r.earned).toBe(600);
    expect(r.spent).toBe(500);
    expect(r.netFlow).toBe(100);
    expect(r.money).toBe(250);
    expect(r.spanWeeks).toBe(4);
    expect(r.earnedPerWeek).toBe(150);
    expect(r.netWorthPerWeek).toBe(25);
  });

  it('reports PER-WEEK rates so long and short spans are comparable', () => {
    // A rollup covering a long absence and one covering four active weeks must
    // not be averaged as raw totals — that is how a "spike" that is really a
    // long gap ends up in an anomaly report.
    const short = diffEconomySamples(
      sample({ totalEarned: 0, weeksThisLife: 0 }),
      sample({ totalEarned: 400, weeksThisLife: 4 }),
    );
    const long = diffEconomySamples(
      sample({ totalEarned: 0, weeksThisLife: 0 }),
      sample({ totalEarned: 4000, weeksThisLife: 40 }),
    );
    expect(short.earnedPerWeek).toBe(100);
    expect(long.earnedPerWeek).toBe(100);
    expect(long.earned).toBeGreaterThan(short.earned);
  });

  it('floors deltas at zero across a prestige/death reset', () => {
    // The cumulative counters reset with the life. An un-floored subtraction
    // would report a large NEGATIVE earning and drag the population mean
    // somewhere no player has ever been.
    const prev = sample({ totalEarned: 500_000, totalSpent: 400_000, weeksThisLife: 300 });
    const cur = sample({ totalEarned: 0, totalSpent: 0, weeksThisLife: 4 });
    const r = diffEconomySamples(prev, cur);
    expect(r.earned).toBe(0);
    expect(r.spent).toBe(0);
    expect(r.spanWeeks).toBe(4); // the new life's own weeks, never negative
  });

  it('never divides by zero on a zero-week span', () => {
    const s = sample({ totalEarned: 100, weeksThisLife: 0 });
    const r = diffEconomySamples(s, s);
    expect(Number.isFinite(r.earnedPerWeek)).toBe(true);
    expect(Number.isFinite(r.netWorthPerWeek)).toBe(true);
  });

  it('coerces non-finite inputs rather than emitting NaN', () => {
    // A NaN in a rate column poisons every aggregate computed over it.
    const r = diffEconomySamples(
      sample({ totalEarned: NaN, netWorth: Infinity }),
      sample({ totalEarned: NaN, totalSpent: NaN, money: NaN, netWorth: NaN, weeksThisLife: NaN }),
    );
    for (const value of Object.values(r)) expect(Number.isFinite(value)).toBe(true);
  });

  it('captures negative net worth growth (debt) without flooring it', () => {
    // Only the cumulative-counter deltas are floored; net worth legitimately
    // falls, and hiding that would erase the entire debt-spiral signal.
    const r = diffEconomySamples(
      sample({ netWorth: 10_000, weeksThisLife: 4 }),
      sample({ netWorth: 2_000, weeksThisLife: 8 }),
    );
    expect(r.netWorthPerWeek).toBe(-2000);
  });
});
