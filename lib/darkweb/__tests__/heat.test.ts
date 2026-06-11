import {
  addHeat,
  clampHeat,
  decayHeat,
  heatBand,
  heatBandLabel,
  policeEventProbability,
  policeEventSeverity,
} from '../heat';

describe('clampHeat', () => {
  it('keeps values in [0, 100]', () => {
    expect(clampHeat(-1)).toBe(0);
    expect(clampHeat(50)).toBe(50);
    expect(clampHeat(150)).toBe(100);
  });

  it('treats NaN as 0', () => {
    expect(clampHeat(NaN)).toBe(0);
  });
});

describe('heatBand', () => {
  it.each([
    [10, 'cold'],
    [30, 'warm'],
    [60, 'hot'],
    [90, 'burning'],
  ] as const)('maps %i to %s', (heat, band) => {
    expect(heatBand(heat)).toBe(band);
  });
});

describe('heatBandLabel', () => {
  it('humanizes band names', () => {
    expect(heatBandLabel('burning')).toBe('Burning');
    expect(heatBandLabel('cold')).toBe('Cold');
  });
});

describe('decayHeat', () => {
  it('decays heat by base + OPSEC bonus', () => {
    // OPSEC 0 → base decay 3
    expect(decayHeat(50, 0)).toBe(47);
    // OPSEC 10 → base 3 + 5 = 8
    expect(decayHeat(50, 10)).toBe(42);
  });

  it('floors at 0', () => {
    expect(decayHeat(2, 0)).toBe(0);
    expect(decayHeat(0, 10)).toBe(0);
  });

  it('clamps OPSEC level above 10', () => {
    expect(decayHeat(50, 50)).toBe(decayHeat(50, 10));
  });
});

describe('addHeat', () => {
  it('adds heat clamped to 100', () => {
    expect(addHeat(90, 50, 0)).toBe(100);
  });

  it('OPSEC mitigates incremental heat by up to 50%', () => {
    const baseline = addHeat(0, 10, 0);
    const mitigated = addHeat(0, 10, 10);
    expect(mitigated).toBeLessThan(baseline);
    expect(mitigated).toBeCloseTo(5, 1);
  });
});

describe('policeEventProbability', () => {
  it('returns 0 when cold', () => {
    expect(policeEventProbability(10)).toBe(0);
  });

  it('increases with each band', () => {
    expect(policeEventProbability(30)).toBe(0.05);
    expect(policeEventProbability(60)).toBe(0.18);
    expect(policeEventProbability(90)).toBe(0.40);
  });
});

describe('policeEventSeverity', () => {
  it('scales linearly from cold (1.0) to burning (3.0)', () => {
    expect(policeEventSeverity(20)).toBeCloseTo(1.0, 2);
    expect(policeEventSeverity(60)).toBeCloseTo(2.0, 2);
    expect(policeEventSeverity(100)).toBeCloseTo(3.0, 2);
  });
});
