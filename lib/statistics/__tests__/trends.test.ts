import { slopeOf, trendOf } from '../trends';

describe('trendOf', () => {
  it('returns flat for empty or single-value series', () => {
    expect(trendOf([]).direction).toBe('flat');
    expect(trendOf([100]).direction).toBe('flat');
  });

  it('returns up when recent window beats baseline', () => {
    const series = [50, 60, 70, 80, 200, 210, 220, 230];
    const t = trendOf(series, 4);
    expect(t.direction).toBe('up');
    expect(t.pctChange).toBeGreaterThan(100);
  });

  it('returns down when recent window is worse', () => {
    const series = [200, 210, 220, 230, 50, 60, 70, 80];
    const t = trendOf(series, 4);
    expect(t.direction).toBe('down');
    expect(t.pctChange).toBeLessThan(-50);
  });

  it('returns flat for stable series', () => {
    const t = trendOf([100, 101, 102, 101, 100, 99, 100, 101]);
    expect(t.direction).toBe('flat');
  });

  it('handles all-zero series without dividing by zero', () => {
    const t = trendOf([0, 0, 0, 0]);
    expect(Number.isFinite(t.pctChange)).toBe(true);
  });
});

describe('slopeOf', () => {
  it('returns 0 for empty/single-value series', () => {
    expect(slopeOf([])).toBe(0);
    expect(slopeOf([5])).toBe(0);
  });

  it('returns positive slope for ascending series', () => {
    expect(slopeOf([1, 2, 3, 4])).toBeGreaterThan(0);
  });

  it('returns negative slope for descending series', () => {
    expect(slopeOf([10, 8, 6, 4])).toBeLessThan(0);
  });

  it('returns ~0 for flat series', () => {
    expect(Math.abs(slopeOf([5, 5, 5, 5]))).toBeLessThan(0.001);
  });
});
