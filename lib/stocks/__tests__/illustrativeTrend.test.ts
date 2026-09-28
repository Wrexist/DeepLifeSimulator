import { illustrativeStockTrend } from '../illustrativeTrend';
import { DEFAULT_PRICES } from '@/lib/economy/stockMarket';

describe('illustrative stock curves', () => {
  it('is repeatable and gives each symbol its own opening curve', () => {
    const curves = Object.keys(DEFAULT_PRICES).map((symbol) => {
      const values = illustrativeStockTrend(symbol);
      expect(values).toEqual(illustrativeStockTrend(symbol.toLowerCase()));
      expect(values.every(Number.isFinite)).toBe(true);
      const steps = values.slice(1).map((v, i) => v - values[i]);
      expect(steps.some((v) => v > 0)).toBe(true);
      expect(steps.some((v) => v < 0)).toBe(true);
      return JSON.stringify(values);
    });
    expect(new Set(curves).size).toBe(Object.keys(DEFAULT_PRICES).length);
  });

  it.each([-0.2, -0.01, 0, 0.01, 0.2])('preserves the real endpoint direction for %s', (change) => {
    const values = illustrativeStockTrend('AAPL', change);
    expect(Math.sign(values[values.length - 1] - values[0])).toBe(Math.sign(change));
  });

  it.each([NaN, Infinity, -Infinity])('uses a finite opening curve for invalid change %s', (change) => {
    expect(illustrativeStockTrend('AAPL', change)).toEqual(illustrativeStockTrend('AAPL'));
  });
});
