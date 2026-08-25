/**
 * Company miner electricity — 2026-08-25 economy audit.
 *
 * Company rigs paid income through `calcWeeklyPassiveIncome` while their power
 * bill existed only in the DISPLAY layer (`expenses.ts` + a literal copy in
 * IdentityCard) — pure profit, the exact defect the warehouse fix H-2 closed.
 * These tests pin the fix: one shared power table/rate, the passive row nets
 * it, and a fleet whose power exceeds its yield idles at $0 rather than
 * draining cash.
 */
import {
  MINER_POWER_UNITS,
  POWER_COST_PER_UNIT_WEEKLY,
  minerFleetWeeklyPowerCost,
} from '../minerPower';
import { calcWeeklyPassiveIncome } from '../passiveIncome';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { Company } from '@/contexts/game/types';

function companyWith(miners: Record<string, number>): Company {
  return {
    id: 'test-co',
    name: 'Test Co',
    type: 'factory',
    weeklyIncome: 0,
    baseWeeklyIncome: 0,
    upgrades: [],
    employees: 0,
    workerSalary: 0,
    workerMultiplier: 1,
    marketingLevel: 0,
    miners,
    warehouseLevel: 0,
  };
}

describe('minerFleetWeeklyPowerCost', () => {
  it('matches the rate the warehouse tick actually charges ($0.40/unit/wk)', () => {
    expect(POWER_COST_PER_UNIT_WEEKLY).toBe(0.4);
    // quantum = 500 units → $200/wk
    expect(minerFleetWeeklyPowerCost({ quantum: 1 })).toBe(200);
    // mixed fleet: 2×basic (20) + 1×pro (100) = 120 units → $48/wk
    expect(minerFleetWeeklyPowerCost({ basic: 2, pro: 1 })).toBe(48);
  });

  it('carries the same power units the warehouse catalog uses', () => {
    // These are the powerConsumption values in lib/crypto/miningEarnings.ts —
    // one table, hand-synced there; a drift here means the two diverged.
    expect(MINER_POWER_UNITS).toMatchObject({
      basic: 10, advanced: 35, pro: 100, industrial: 250, quantum: 500,
      mega: 2000, giga: 5000, tera: 15000,
    });
  });

  it('is defensive against garbage counts', () => {
    expect(minerFleetWeeklyPowerCost(undefined)).toBe(0);
    expect(minerFleetWeeklyPowerCost({ basic: NaN, pro: -3, quantum: 0 })).toBe(0);
  });
});

describe('company mining income nets electricity', () => {
  it('pays gross earnings minus the power bill', () => {
    const state = createTestGameState({});
    state.companies = [companyWith({ quantum: 1 })];
    const withPower = calcWeeklyPassiveIncome(state);
    // 1 quantum, sole miner (difficulty 1.0): gross $7,000, power $200.
    expect(withPower.breakdown.cryptoMining).toBe(6800);
  });

  it('floors a power-negative fleet at $0 instead of draining cash', () => {
    const state = createTestGameState({});
    // 40 basic miners: difficulty 0.95^39 ≈ 0.135 → gross ≈ 40×22×0.135 ≈ $119,
    // power = 400 units × $0.40 = $160 → net negative → row contributes 0.
    state.companies = [companyWith({ basic: 40 })];
    const r = calcWeeklyPassiveIncome(state);
    expect(r.breakdown.cryptoMining).toBe(0);
  });
});
