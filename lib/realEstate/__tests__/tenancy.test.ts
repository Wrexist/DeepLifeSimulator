import {
  findTenantProbability,
  generateTenant,
  moveOutProbability,
  realizedWeeklyRent,
  RENT_MODE_PARAMS,
  satisfactionStep,
} from '../tenancy';

describe('satisfactionStep', () => {
  it('drops satisfaction when condition is poor', () => {
    const next = satisfactionStep(80, 30, 1000, 1000, 'longTerm');
    expect(next).toBeLessThan(80);
  });

  it('rises satisfaction when condition is excellent', () => {
    const next = satisfactionStep(60, 95, 1000, 1000, 'longTerm');
    expect(next).toBeGreaterThan(60);
  });

  it('drops satisfaction when rent is well above market', () => {
    const next = satisfactionStep(80, 70, 2000, 1000, 'longTerm');
    expect(next).toBeLessThan(80);
  });

  it('clamps to [0,100]', () => {
    expect(satisfactionStep(0, 0, 5000, 100, 'longTerm')).toBeGreaterThanOrEqual(0);
    expect(satisfactionStep(100, 100, 50, 5000, 'longTerm')).toBeLessThanOrEqual(100);
  });

  it('airbnb satisfaction decays slower than long-term', () => {
    const longTerm = satisfactionStep(60, 20, 1000, 1000, 'longTerm');
    const airbnb = satisfactionStep(60, 20, 1000, 1000, 'airbnb');
    expect(airbnb).toBeGreaterThan(longTerm);
  });
});

describe('moveOutProbability', () => {
  it('rises sharply as satisfaction drops', () => {
    const happy = moveOutProbability(90, 'longTerm');
    const upset = moveOutProbability(20, 'longTerm');
    expect(upset).toBeGreaterThan(happy);
  });

  it('clamps to [0,1]', () => {
    expect(moveOutProbability(-50, 'longTerm')).toBeGreaterThanOrEqual(0);
    expect(moveOutProbability(150, 'longTerm')).toBeLessThanOrEqual(1);
  });

  it('airbnb baseline is high regardless of satisfaction', () => {
    expect(moveOutProbability(100, 'airbnb')).toBeCloseTo(RENT_MODE_PARAMS.airbnb.vacancyHazard, 5);
  });
});

describe('findTenantProbability', () => {
  it('higher demand → higher probability', () => {
    const low = findTenantProbability(80, 0.5);
    const hi = findTenantProbability(80, 1.5);
    expect(hi).toBeGreaterThan(low);
  });

  it('lower condition → lower probability', () => {
    const poor = findTenantProbability(20, 1.0);
    const mint = findTenantProbability(95, 1.0);
    expect(mint).toBeGreaterThan(poor);
  });
});

describe('realizedWeeklyRent', () => {
  it('returns exact rent for longTerm', () => {
    expect(realizedWeeklyRent(1000, 'longTerm', { u1: 0.1, u2: 0.9 })).toBe(1000);
  });

  it('produces variance for airbnb', () => {
    const samples = [];
    for (let i = 0; i < 50; i++) {
      const u1 = ((i * 17) % 97) / 97;
      const u2 = ((i * 11) % 89) / 89;
      samples.push(realizedWeeklyRent(1000, 'airbnb', { u1, u2 }));
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    expect(max - min).toBeGreaterThan(50);
  });

  it('never goes below 30% of base rent', () => {
    for (let i = 0; i < 100; i++) {
      const u1 = ((i * 7) % 100) / 100;
      const u2 = ((i * 3) % 100) / 100;
      const r = realizedWeeklyRent(1000, 'airbnb', { u1, u2 });
      expect(r).toBeGreaterThanOrEqual(300);
    }
  });
});

describe('generateTenant', () => {
  it('creates a tenant with the given weekly rent', () => {
    const t = generateTenant(1500, 10, 0.5);
    expect(t.weeklyRent).toBe(1500);
    expect(t.movedInWeek).toBe(10);
    expect(t.satisfaction).toBeGreaterThan(50); // optimistic start
    expect(t.id).toMatch(/^tenant-/);
    expect(t.name).toMatch(/\w+ \w+/);
  });
});

describe('RENT_MODE_PARAMS sanity', () => {
  it('airbnb has higher mean yield than longTerm', () => {
    expect(RENT_MODE_PARAMS.airbnb.weeklyYieldMean).toBeGreaterThan(RENT_MODE_PARAMS.longTerm.weeklyYieldMean);
  });

  it('airbnb has higher variance', () => {
    expect(RENT_MODE_PARAMS.airbnb.weeklyYieldStdev).toBeGreaterThan(RENT_MODE_PARAMS.longTerm.weeklyYieldStdev);
  });

  it('airbnb has highest vacancy hazard', () => {
    expect(RENT_MODE_PARAMS.airbnb.vacancyHazard).toBeGreaterThan(RENT_MODE_PARAMS.longTerm.vacancyHazard);
    expect(RENT_MODE_PARAMS.airbnb.vacancyHazard).toBeGreaterThan(RENT_MODE_PARAMS.commercial.vacancyHazard);
  });
});
