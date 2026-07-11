/**
 * Hustle weekly tick — Wave A additions.
 *
 * Covers the organic-scandal roll folded into the tick (deterministic spawn,
 * brand hit + alert, cooldown), the real scandal-ledger values written on
 * natural resolution, and the preserved existing behaviours (overlay-less
 * companies skipped, named-hire morale/perf drift).
 */
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';
import { processHustleWeeklyTick } from '../hustleTick';
import { createDefaultCompanyOverlay } from '../hustleLogic';
import type { Company, HustleCompanyOverlay, GameState } from '@/contexts/game/types';

function company(id: string, weeklyIncome: number, type: Company['type'] = 'factory'): Company {
  return {
    id,
    name: `My ${id}`,
    type,
    weeklyIncome,
    baseWeeklyIncome: weeklyIncome,
    upgrades: [],
    employees: 0,
    workerSalary: 500,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0,
  } as Company;
}

function stateWith(companies: Company[], overlays: Record<string, HustleCompanyOverlay>): GameState {
  return createTestGameState({
    stats: { money: 1_000_000 } as GameState['stats'],
    companies,
    hustleApp: {
      companies: overlays,
      lifetimeStats: {
        totalCompaniesFounded: companies.length,
        totalCompaniesSold: 0,
        totalIPOsLaunched: 0,
        totalAcquisitionsCompleted: 0,
        totalScandalsSurvived: 0,
        totalCampaignsRun: 0,
        totalNamedHires: 0,
        totalFires: 0,
        peakBrandScore: 50,
        peakMarketShare: 5,
        peakSharePrice: 0,
      },
    },
  } as Partial<GameState>);
}

describe('processHustleWeeklyTick — organic scandal roll', () => {
  it('spawns a scandal for a company whose seeded roll clears the chance', () => {
    // co-56 wk3 rolls ~0.005 — below the neutral-brand chance (~0.026).
    const overlay = createDefaultCompanyOverlay('co-56', 0);
    const state = stateWith([company('co-56', 10_000)], { 'co-56': overlay });

    const res = processHustleWeeklyTick(state, 3);
    const o = res.hustleApp.companies['co-56'];
    expect(o.activeScandal).not.toBeNull();
    expect(o.activeScandal!.startedWeek).toBe(3);
    // brand takes the -15 spawn hit (from ~51 after drift → ~36)
    expect(o.brand.score).toBeLessThan(50);
    // a scandal_alert notification is surfaced in the inbox
    expect(o.notifications.some((n) => n.type === 'scandal_alert')).toBe(true);
  });

  it('is deterministic per week (idempotent scandal spawn)', () => {
    const overlay = createDefaultCompanyOverlay('co-56', 0);
    const state = stateWith([company('co-56', 10_000)], { 'co-56': overlay });
    const a = processHustleWeeklyTick(state, 3).hustleApp.companies['co-56'].activeScandal;
    const b = processHustleWeeklyTick(state, 3).hustleApp.companies['co-56'].activeScandal;
    expect(a).toEqual(b);
  });

  it('does not spawn for a company whose roll is above the chance', () => {
    const overlay = createDefaultCompanyOverlay('factory', 0);
    const state = stateWith([company('factory', 10_000)], { factory: overlay });
    const o = processHustleWeeklyTick(state, 0).hustleApp.companies['factory'];
    expect(o.activeScandal).toBeNull();
  });

  it('does not spawn for a company below the size gate', () => {
    const overlay = createDefaultCompanyOverlay('co-56', 0);
    const state = stateWith([company('co-56', 1_000)], { 'co-56': overlay });
    const o = processHustleWeeklyTick(state, 3).hustleApp.companies['co-56'];
    expect(o.activeScandal).toBeNull();
  });
});

describe('processHustleWeeklyTick — scandal ledger real values', () => {
  it('writes non-zero totalRevenueLoss + finalReputationLoss on natural resolution', () => {
    const overlay: HustleCompanyOverlay = {
      ...createDefaultCompanyOverlay('bigco', 0),
      activeScandal: {
        id: 'scn-live',
        kind: 'fraud_allegation', // base severity 80
        severity: 5, // about to fully decay this tick
        startedWeek: 0,
        weeksRemaining: 1,
        headline: 'Auditors flag suspicious revenue recognition',
        resolutionMethod: null,
        revenueDragPercent: 0.05,
      },
    };
    const state = stateWith([company('bigco', 10_000)], { bigco: overlay });

    const res = processHustleWeeklyTick(state, 6);
    const o = res.hustleApp.companies['bigco'];
    expect(o.activeScandal).toBeNull();
    expect(o.scandalHistory).toHaveLength(1);
    const record = o.scandalHistory[0];
    expect(record.totalRevenueLoss).toBeGreaterThan(0);
    expect(record.finalReputationLoss).toBeGreaterThanOrEqual(1);
    expect(res.hustleApp.lifetimeStats.totalScandalsSurvived).toBe(1);
  });
});

describe('processHustleWeeklyTick — preserved behaviour', () => {
  it('skips companies with no overlay without throwing', () => {
    const state = stateWith([company('no-overlay', 10_000)], {});
    const res = processHustleWeeklyTick(state, 5);
    expect(res.hustleApp.companies['no-overlay']).toBeUndefined();
    expect(res.cashDelta).toBe(0);
  });

  it('drifts named-hire morale and performance each week', () => {
    const overlay: HustleCompanyOverlay = {
      ...createDefaultCompanyOverlay('factory', 0),
      hiringPipeline: {
        candidates: [],
        namedHires: [
          { candidateId: 'h1', hiredWeek: 0, role: 'engineer', salary: 3000, morale: 90, performance: 60 },
        ],
        weeksSinceLastHire: 0,
        totalSeverance: 0,
      },
    };
    const state = stateWith([company('factory', 10_000)], { factory: overlay });
    const o = processHustleWeeklyTick(state, 1).hustleApp.companies['factory'];
    const h = o.hiringPipeline.namedHires[0];
    // high morale → performance nudges up; morale stays clamped 0-100
    expect(h.performance).toBeGreaterThanOrEqual(60);
    expect(h.morale).toBeGreaterThanOrEqual(0);
    expect(h.morale).toBeLessThanOrEqual(100);
    expect(o.hiringPipeline.weeksSinceLastHire).toBe(1);
  });
});
