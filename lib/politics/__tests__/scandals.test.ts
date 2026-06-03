import {
  createScandal,
  generateHeadline,
  pickCategory,
  pickSeverity,
  PoliticalScandal,
  scandalProbability,
  SEVERITY_PARAMS,
  suppressScandal,
  tickScandal,
} from '../scandals';

describe('scandalProbability', () => {
  it('returns 0 with no drivers', () => {
    expect(scandalProbability({})).toBe(0);
  });

  it('grows with dark-web heat', () => {
    const low = scandalProbability({ darkWebHeat: 10 });
    const hi = scandalProbability({ darkWebHeat: 90 });
    expect(hi).toBeGreaterThan(low);
  });

  it('grows with dirty PAC money', () => {
    const small = scandalProbability({ pacDirtyUSD: 100_000 });
    const huge = scandalProbability({ pacDirtyUSD: 5_000_000 });
    expect(huge).toBeGreaterThan(small);
  });

  it('grows with negative karma', () => {
    const good = scandalProbability({ karma: 50 });
    const bad = scandalProbability({ karma: -80 });
    expect(bad).toBeGreaterThan(good);
  });

  it('positive karma does not boost probability', () => {
    expect(scandalProbability({ karma: 100 })).toBe(scandalProbability({ karma: 0 }));
  });

  it('caps at 35%', () => {
    const all = scandalProbability({
      darkWebHeat: 100,
      pacDirtyUSD: 100_000_000,
      karma: -100,
      contentiousPolicies: 100,
      careerLevel: 5,
    });
    expect(all).toBeLessThanOrEqual(0.35);
  });
});

describe('pickSeverity', () => {
  it('returns minor for clean drivers + low roll', () => {
    expect(pickSeverity({ darkWebHeat: 0, pacDirtyUSD: 0, karma: 50, roll: 0.1 })).toBe('minor');
  });

  it('escalates with high intensity', () => {
    const sev = pickSeverity({ darkWebHeat: 100, pacDirtyUSD: 5_000_000, karma: -100, roll: 0.99 });
    expect(['major', 'career-ending']).toContain(sev);
  });
});

describe('pickCategory', () => {
  it('picks criminal-ties when heat dominates', () => {
    // Construct a roll that picks the first non-zero category.
    const cat = pickCategory({ darkWebHeat: 100, pacDirtyUSD: 0, karma: 0, contentiousPolicies: 0, roll: 0.001 });
    expect(['criminal-ties', 'extramarital']).toContain(cat); // small constant extramarital weight
  });

  it('picks one of the donor-fraud / corruption categories with big dirty money', () => {
    const cat = pickCategory({ darkWebHeat: 0, pacDirtyUSD: 5_000_000, karma: 0, contentiousPolicies: 0, roll: 0.05 });
    expect(['corruption', 'donor-fraud', 'extramarital']).toContain(cat);
  });
});

describe('generateHeadline', () => {
  it('returns a non-empty string for each category', () => {
    const cats = ['corruption', 'extramarital', 'tax-evasion', 'criminal-ties', 'policy-flip', 'donor-fraud'] as const;
    for (const c of cats) {
      const h = generateHeadline(c, 0.5);
      expect(typeof h).toBe('string');
      expect(h.length).toBeGreaterThan(5);
    }
  });
});

describe('tickScandal', () => {
  const minor: PoliticalScandal = {
    id: 's1',
    category: 'extramarital',
    severity: 'minor',
    headline: 'Test',
    startedWeek: 0,
    weeksRemaining: SEVERITY_PARAMS.minor.baseLifetimeWeeks,
    approvalLost: 0,
    suppressedUSD: 0,
    active: true,
  };

  it('drains approval each week', () => {
    const r = tickScandal(minor);
    expect(r.approvalDamage).toBeGreaterThan(0);
    expect(r.scandal.weeksRemaining).toBe(minor.weeksRemaining - 1);
  });

  it('full suppression nullifies drain', () => {
    const fullySuppressed = { ...minor, suppressedUSD: SEVERITY_PARAMS.minor.suppressionCost };
    const r = tickScandal(fullySuppressed);
    expect(r.approvalDamage).toBe(0);
  });

  it('partial suppression scales drain', () => {
    const halfSuppressed = { ...minor, suppressedUSD: SEVERITY_PARAMS.minor.suppressionCost / 2 };
    const r = tickScandal(halfSuppressed);
    expect(r.approvalDamage).toBeCloseTo(SEVERITY_PARAMS.minor.weeklyApprovalDrain / 2, 5);
  });

  it('resolves to image-restored on full suppression at end', () => {
    const almostDone = { ...minor, weeksRemaining: 1, suppressedUSD: SEVERITY_PARAMS.minor.suppressionCost };
    const r = tickScandal(almostDone);
    expect(r.scandal.active).toBe(false);
    expect(r.scandal.resolution).toBe('image-restored');
  });

  it('forces resignation on major scandal with low suppression', () => {
    const fatal: PoliticalScandal = {
      ...minor,
      severity: 'major',
      weeksRemaining: 1,
      suppressedUSD: 0,
    };
    const r = tickScandal(fatal);
    expect(r.scandal.resolution).toBe('forced-resignation');
  });

  it('inactive scandal is a no-op', () => {
    const inactive: PoliticalScandal = { ...minor, active: false };
    const r = tickScandal(inactive);
    expect(r.approvalDamage).toBe(0);
    expect(r.scandal).toEqual(inactive);
  });
});

describe('suppressScandal', () => {
  it('accumulates suppression spending', () => {
    const s: PoliticalScandal = {
      id: 's1',
      category: 'corruption',
      severity: 'major',
      headline: '',
      startedWeek: 0,
      weeksRemaining: 5,
      approvalLost: 0,
      suppressedUSD: 0,
      active: true,
    };
    const r1 = suppressScandal(s, 1000);
    const r2 = suppressScandal(r1, 2000);
    expect(r2.suppressedUSD).toBe(3000);
  });
});

describe('createScandal', () => {
  it('produces an active scandal with sane defaults', () => {
    const s = createScandal({
      darkWebHeat: 50,
      currentWeek: 10,
      rolls: { severity: 0.5, category: 0.5, headline: 0.5 },
    });
    expect(s.active).toBe(true);
    expect(s.startedWeek).toBe(10);
    expect(s.weeksRemaining).toBeGreaterThan(0);
    expect(s.headline.length).toBeGreaterThan(5);
  });
});
