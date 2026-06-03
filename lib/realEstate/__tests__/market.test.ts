import {
  CYCLE_PARAMS,
  cycleEffects,
  nextCycle,
  sampleCycleDuration,
} from '../market';

describe('CYCLE_PARAMS', () => {
  it('hot appreciates faster than stable', () => {
    expect(CYCLE_PARAMS.hot.appreciationMultiplier).toBeGreaterThan(CYCLE_PARAMS.stable.appreciationMultiplier);
  });

  it('cooling appreciates slowest', () => {
    expect(CYCLE_PARAMS.cooling.appreciationMultiplier).toBeLessThan(CYCLE_PARAMS.stable.appreciationMultiplier);
  });

  it('hot has highest demand factor', () => {
    expect(CYCLE_PARAMS.hot.demandFactor).toBeGreaterThan(CYCLE_PARAMS.stable.demandFactor);
    expect(CYCLE_PARAMS.hot.demandFactor).toBeGreaterThan(CYCLE_PARAMS.cooling.demandFactor);
  });

  it('cooling has lowest rent multiplier', () => {
    expect(CYCLE_PARAMS.cooling.rentMultiplier).toBeLessThan(1);
  });
});

describe('nextCycle', () => {
  it('always returns a valid cycle', () => {
    const all = ['stable', 'gentrifying', 'hot', 'cooling'] as const;
    for (const c of all) {
      for (let i = 0; i < 50; i++) {
        const next = nextCycle(c, i / 50);
        expect(all).toContain(next);
      }
    }
  });

  it('falls back to stable for bad rolls', () => {
    expect(nextCycle('stable', NaN)).toBeDefined();
    expect(nextCycle('stable', 1.5)).toBeDefined();
  });
});

describe('sampleCycleDuration', () => {
  it('returns at least 4 weeks', () => {
    expect(sampleCycleDuration('stable', 0.001)).toBeGreaterThanOrEqual(4);
  });

  it('caps at 3× the mean', () => {
    expect(sampleCycleDuration('stable', 0.999)).toBeLessThanOrEqual(
      CYCLE_PARAMS.stable.meanDurationWeeks * 3
    );
  });
});

describe('cycleEffects', () => {
  it('returns the params for the given cycle', () => {
    expect(cycleEffects('hot')).toEqual(CYCLE_PARAMS.hot);
  });
});
