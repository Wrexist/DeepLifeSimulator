import {
  buildLaunderingTx,
  computeNetLaunder,
  effectiveFeePct,
  effectiveMixerParams,
  frontDiscount,
  MIXER_TIERS,
  mixerFails,
} from '../laundering';

describe('computeNetLaunder', () => {
  it('applies the tier fee', () => {
    const net = computeNetLaunder(1, 'cheap');
    expect(net).toBeCloseTo(1 - MIXER_TIERS.cheap.feePct, 5);
  });

  it('returns 0 for non-positive input', () => {
    expect(computeNetLaunder(0, 'standard')).toBe(0);
    expect(computeNetLaunder(-1, 'standard')).toBe(0);
  });

  it('handles NaN defensively', () => {
    expect(computeNetLaunder(NaN, 'standard')).toBe(0);
  });
});

describe('effectiveFeePct', () => {
  it('reduces fee by 0.5% per laundering level', () => {
    expect(effectiveFeePct('cheap', 0)).toBe(MIXER_TIERS.cheap.feePct);
    // Mid-tier: standard is 6%, level 5 → reduction 2.5%, expect ~3.5%
    expect(effectiveFeePct('standard', 5)).toBeCloseTo(MIXER_TIERS.standard.feePct - 0.025, 5);
  });

  it('floors at 0 when reduction exceeds base fee', () => {
    expect(effectiveFeePct('cheap', 10)).toBe(0);
    expect(effectiveFeePct('cheap', 100)).toBe(0);
  });
});

describe('mixerFails', () => {
  it('cheap mixer fails much more often than premium', () => {
    expect(MIXER_TIERS.cheap.failProbability).toBeGreaterThan(MIXER_TIERS.premium.failProbability);
  });

  it('fails when roll < tier failProbability', () => {
    expect(mixerFails('premium', 0.0001)).toBe(true);
    expect(mixerFails('premium', 0.99)).toBe(false);
  });
});

describe('buildLaunderingTx', () => {
  it('produces a pending tx with the right ready week', () => {
    const tx = buildLaunderingTx(1, 'standard', 5, 0);
    expect(tx.status).toBe('pending');
    expect(tx.readyWeek).toBe(5 + MIXER_TIERS.standard.delayWeeks);
    expect(tx.dirtyAmountBtc).toBe(1);
    expect(tx.netAmountBtc).toBeLessThan(1);
  });

  it('laundering skill reduces net loss', () => {
    const lvl0 = buildLaunderingTx(1, 'standard', 0, 0);
    const lvl10 = buildLaunderingTx(1, 'standard', 0, 10);
    expect(lvl10.netAmountBtc).toBeGreaterThan(lvl0.netAmountBtc);
  });
});

describe('frontDiscount', () => {
  it('returns no discount with zero fronts', () => {
    expect(frontDiscount(0)).toEqual({ feeReduction: 0, delayReductionWeeks: 0 });
  });

  it('grows linearly per front', () => {
    expect(frontDiscount(2)).toEqual({ feeReduction: 0.01, delayReductionWeeks: 2 });
  });

  it('caps at 4 fronts', () => {
    expect(frontDiscount(10)).toEqual({ feeReduction: 0.02, delayReductionWeeks: 4 });
  });

  it('handles NaN/negative defensively', () => {
    expect(frontDiscount(NaN)).toEqual({ feeReduction: 0, delayReductionWeeks: 0 });
    expect(frontDiscount(-5)).toEqual({ feeReduction: 0, delayReductionWeeks: 0 });
  });
});

describe('effectiveMixerParams', () => {
  it('combines skill and front discounts', () => {
    const r = effectiveMixerParams('standard', 5, 2);
    // standard base 6% fee minus 5*0.5% = 2.5% (skill) minus 2*0.5% = 1% (fronts) = 2.5%
    expect(r.feePct).toBeCloseTo(0.025, 5);
  });

  it('shortens delay by 1 week per front', () => {
    const r = effectiveMixerParams('premium', 0, 3);
    expect(r.delayWeeks).toBe(MIXER_TIERS.premium.delayWeeks - 3);
  });

  it('floors delay at 1 week', () => {
    const r = effectiveMixerParams('cheap', 0, 4);
    expect(r.delayWeeks).toBeGreaterThanOrEqual(1);
  });

  it('floors fee at 0%', () => {
    const r = effectiveMixerParams('cheap', 10, 4);
    expect(r.feePct).toBe(0);
  });

  it('preserves the failure probability (fronts don\'t change risk)', () => {
    const r = effectiveMixerParams('cheap', 5, 4);
    expect(r.failProbability).toBe(MIXER_TIERS.cheap.failProbability);
  });
});

describe('buildLaunderingTx with fronts', () => {
  it('produces a faster, cheaper tx with fronts', () => {
    const noFronts = buildLaunderingTx(1, 'standard', 0, 0, 0);
    const withFronts = buildLaunderingTx(1, 'standard', 0, 0, 3);
    expect(withFronts.netAmountBtc).toBeGreaterThan(noFronts.netAmountBtc);
    expect(withFronts.readyWeek).toBeLessThan(noFronts.readyWeek);
  });
});

describe('MIXER_TIERS sanity', () => {
  it('higher tiers cost more but are safer', () => {
    expect(MIXER_TIERS.premium.feePct).toBeGreaterThan(MIXER_TIERS.cheap.feePct);
    expect(MIXER_TIERS.premium.failProbability).toBeLessThan(MIXER_TIERS.cheap.failProbability);
  });

  it('higher tiers take longer', () => {
    expect(MIXER_TIERS.premium.delayWeeks).toBeGreaterThan(MIXER_TIERS.cheap.delayWeeks);
  });
});
