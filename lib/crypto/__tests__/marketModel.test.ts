import { nextRegime, regimeFromEconomyState, sampleRegimeDuration, stepPrice, REGIME_PARAMS } from '../marketModel';

describe('nextRegime', () => {
  it('always returns a valid regime', () => {
    const regimes = ['stable', 'volatile', 'bull', 'bear'] as const;
    for (const r of regimes) {
      for (let i = 0; i < 100; i++) {
        const out = nextRegime(r, i / 100);
        expect(regimes).toContain(out);
      }
    }
  });

  it('falls back to stable for out-of-range rolls', () => {
    expect(nextRegime('stable', NaN)).toBeDefined();
    expect(nextRegime('stable', 1.5)).toBeDefined();
    expect(nextRegime('stable', -1)).toBeDefined();
  });
});

describe('stepPrice', () => {
  it('produces a positive price', () => {
    const next = stepPrice(100, 'stable', { u1: 0.5, u2: 0.5 });
    expect(next).toBeGreaterThan(0);
  });

  it('bull regime has positive drift when noise is zeroed (u2=0.25 → cos=0)', () => {
    // Box-Muller with cos(2π × 0.25) = 0 isolates the drift component.
    expect(stepPrice(100, 'bull', { u1: 0.5, u2: 0.25 })).toBeGreaterThan(100);
  });

  it('bear regime has negative drift when noise is zeroed', () => {
    expect(stepPrice(100, 'bear', { u1: 0.5, u2: 0.25 })).toBeLessThan(100);
  });

  it('over many random samples, bull averages above stable', () => {
    let bullSum = 0;
    let stableSum = 0;
    const samples = 500;
    for (let i = 0; i < samples; i++) {
      const u1 = (i * 31 + 7) % 997 / 997;
      const u2 = (i * 17 + 3) % 991 / 991;
      bullSum += stepPrice(100, 'bull', { u1, u2 });
      stableSum += stepPrice(100, 'stable', { u1, u2 });
    }
    expect(bullSum).toBeGreaterThan(stableSum);
  });

  it('clamps extreme moves to ±60%', () => {
    // Force a huge positive gaussian via small u1 (→ large log magnitude).
    const next = stepPrice(100, 'volatile', { u1: 0.00001, u2: 0 });
    expect(next).toBeLessThanOrEqual(160 + 1e-6);
  });

  it('handles NaN inputs defensively', () => {
    expect(stepPrice(NaN, 'stable', { u1: 0.5, u2: 0.5 })).toBeGreaterThan(0);
    expect(stepPrice(100, 'stable', { u1: NaN, u2: NaN })).toBeGreaterThan(0);
  });

  it('uses the configured regime parameters', () => {
    expect(REGIME_PARAMS.stable.volatility).toBeLessThan(REGIME_PARAMS.volatile.volatility);
    expect(REGIME_PARAMS.bull.meanReturn).toBeGreaterThan(0);
    expect(REGIME_PARAMS.bear.meanReturn).toBeLessThan(0);
    expect(REGIME_PARAMS.volatile.bidAskSpread).toBeGreaterThan(REGIME_PARAMS.stable.bidAskSpread);
  });
});

describe('sampleRegimeDuration', () => {
  it('returns at least 2 weeks', () => {
    expect(sampleRegimeDuration('stable', 0.001)).toBeGreaterThanOrEqual(2);
  });

  it('caps at 3× the regime mean', () => {
    expect(sampleRegimeDuration('stable', 0.999)).toBeLessThanOrEqual(
      REGIME_PARAMS.stable.meanDurationWeeks * 3
    );
  });

  it('handles bad rolls defensively', () => {
    expect(sampleRegimeDuration('bull', NaN)).toBeGreaterThanOrEqual(2);
  });
});

describe('regimeFromEconomyState', () => {
  it('maps crash to bear', () => {
    expect(regimeFromEconomyState('crash')).toBe('bear');
  });

  it('maps boom to bull', () => {
    expect(regimeFromEconomyState('boom')).toBe('bull');
  });

  it('maps recession to volatile', () => {
    expect(regimeFromEconomyState('recession')).toBe('volatile');
  });

  it('returns null for normal / undefined (do-not-force)', () => {
    expect(regimeFromEconomyState('normal')).toBeNull();
    expect(regimeFromEconomyState(undefined)).toBeNull();
  });
});
