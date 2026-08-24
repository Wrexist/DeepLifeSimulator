/**
 * Energy costs on the Hustle management verbs (2026-08-24 balance pass).
 *
 * Business management was the only active money path with zero energy cost, so
 * it never competed with anything else in the week. Campaigns (-8) and
 * interviews (-5) now draw on the same weekly energy pool as street jobs and
 * study. These tests pin the gate (refusal below the cost, at the outer check
 * AND the in-updater recheck) and the charge (energy actually drains, exactly
 * once, on both accept and decline outcomes).
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import {
  hireCandidate,
  launchCampaign,
  CAMPAIGN_ENERGY_COST,
  HIRE_ENERGY_COST,
} from '@/contexts/game/actions/HustleActions';
import { createDefaultCompanyOverlay } from '@/lib/business/hustleLogic';
import type { GameState, Company, HustleCompanyOverlay, HustleCandidate } from '@/contexts/game/types';

const COMPANY_ID = 'co-1';

const company = (): Company =>
  ({
    id: COMPANY_ID,
    name: 'My Co',
    type: 'factory',
    weeklyIncome: 5_000,
    baseWeeklyIncome: 5_000,
    upgrades: [],
    employees: 0,
    workerSalary: 500,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0,
  }) as Company;

const candidate = (accepting: boolean): HustleCandidate => ({
  id: 'cand-1',
  name: 'Jane Doe',
  role: 'engineer',
  skill: 80,
  experience: 40,
  // Low ask + generous offer → guaranteed accept; absurd ask → guaranteed decline.
  salaryAsk: accepting ? 1_000 : 1_000_000,
  postedWeek: 0,
  expiresWeek: 2,
  interestLevel: 80,
});

function stateWith(energy: number, accepting = true): GameState {
  const overlay: HustleCompanyOverlay = {
    ...createDefaultCompanyOverlay(COMPANY_ID, 0),
    hiringPipeline: {
      candidates: [candidate(accepting)],
      namedHires: [],
      weeksSinceLastHire: 0,
      totalSeverance: 0,
    },
  };
  return createTestGameState({
    stats: { money: 1_000_000, reputation: 50, energy, health: 80, happiness: 80, fitness: 50, gems: 0 },
    companies: [company()],
    hustleApp: {
      companies: { [COMPANY_ID]: overlay },
      lifetimeStats: {
        totalCompaniesFounded: 1, totalCompaniesSold: 0, totalIPOsLaunched: 0,
        totalAcquisitionsCompleted: 0, totalScandalsSurvived: 0, totalCampaignsRun: 0,
        totalNamedHires: 0, totalFires: 0, peakBrandScore: 50, peakMarketShare: 5, peakSharePrice: 0,
      },
    },
  });
}

function captureUpdater() {
  let updater: ((prev: GameState) => GameState) | undefined;
  const setGameState: Dispatch<SetStateAction<GameState>> = (u) => {
    if (typeof u === 'function') updater = u;
  };
  return {
    setGameState,
    called: () => updater !== undefined,
    run(prev: GameState): GameState {
      if (!updater) throw new Error('updater never captured');
      return updater(prev);
    },
  };
}

describe('launchCampaign energy', () => {
  it('refuses below the cost, naming it', () => {
    const cap = captureUpdater();
    const res = launchCampaign(cap.setGameState, stateWith(CAMPAIGN_ENERGY_COST - 1), COMPANY_ID, 'social', 5_000, 4);
    expect(res.success).toBe(false);
    expect(res.message).toContain('energy');
  });

  it('charges exactly the cost on launch', () => {
    const state = stateWith(50);
    const cap = captureUpdater();
    const res = launchCampaign(cap.setGameState, state, COMPANY_ID, 'social', 5_000, 4);
    expect(res.success).toBe(true);
    const committed = cap.run(state);
    expect(committed.stats.energy).toBe(50 - CAMPAIGN_ENERGY_COST);
    expect(committed.hustleApp!.companies[COMPANY_ID].activeCampaigns).toHaveLength(1);
  });

  it('write-side recheck: an exhausted prev commits nothing', () => {
    const okState = stateWith(50);
    const cap = captureUpdater();
    launchCampaign(cap.setGameState, okState, COMPANY_ID, 'social', 5_000, 4);
    const exhaustedPrev = stateWith(CAMPAIGN_ENERGY_COST - 1);
    expect(cap.run(exhaustedPrev)).toBe(exhaustedPrev);
  });
});

describe('hireCandidate energy', () => {
  it('refuses an interview below the cost', () => {
    const cap = captureUpdater();
    const res = hireCandidate(cap.setGameState, stateWith(HIRE_ENERGY_COST - 1), COMPANY_ID, 'cand-1', 5_000, 0);
    expect(res.success).toBe(false);
    expect(res.message).toContain('energy');
  });

  it('charges on an ACCEPTED offer', () => {
    const state = stateWith(60, true);
    const cap = captureUpdater();
    const res = hireCandidate(cap.setGameState, state, COMPANY_ID, 'cand-1', 5_000, 0);
    expect(res.accepted).toBe(true);
    expect(cap.run(state).stats.energy).toBe(60 - HIRE_ENERGY_COST);
  });

  it('charges on a DECLINED offer too - the interview happened', () => {
    const state = stateWith(60, false);
    const cap = captureUpdater();
    const res = hireCandidate(cap.setGameState, state, COMPANY_ID, 'cand-1', 1_100, 0);
    expect(res.accepted).toBe(false);
    expect(res.success).toBe(true);
    expect(cap.run(state).stats.energy).toBe(60 - HIRE_ENERGY_COST);
  });
});
