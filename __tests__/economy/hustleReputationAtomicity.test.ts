/**
 * P1-14 — hustle reputation grants must be ATOMIC with the money step they accompany.
 *
 * resolveScandal / fireNamedHire / acceptAcquisition pay their cost INSIDE the
 * setGameState updater (applyMoneyDelta → `return prev` on insufficient funds), but
 * previously granted reputation via a SEPARATE trailing updateStats(...) that fired
 * unconditionally. A same-batch funds race — the render-time snapshot passes the outer
 * affordability guard, but `prev` at updater time has less money — would bail the
 * money/deal yet STILL move reputation: free +rep on a deal that never closed (and an
 * unfair −1 for a fire that never happened).
 *
 * The fix folds the reputation delta into the same updater via withReputationDelta.
 * These tests capture the updater and drive it with a `prev` that has LESS money than
 * the snapshot, proving the bail leaves reputation (and money) untouched, while the
 * happy path applies BOTH money and reputation in one atomic update. fireNamedHire uses
 * the identical helper, so the two positive-rep exploits below cover the mechanism.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { acceptAcquisition, resolveScandal } from '@/contexts/game/actions/HustleActions';
import type {
  GameState,
  HustleCompanyOverlay,
  HustleAcquisitionOffer,
  HustleActiveScandal,
} from '@/contexts/game/types';

const COMPANY_ID = 'co-1';

function baseOverlay(): HustleCompanyOverlay {
  return {
    companyId: COMPANY_ID,
    hiringPipeline: { candidates: [], namedHires: [], weeksSinceLastHire: 0, totalSeverance: 0 },
    activeCampaigns: [],
    brand: { score: 50, trend: 'flat', lastUpdatedWeek: 0 },
    activeScandal: null,
    scandalHistory: [],
    boardSeats: [],
    ipo: {
      status: 'private',
      ownershipPercent: 100,
      sharePrice: 0,
      sharesOutstandingK: 0,
      recentEarnings: [],
    },
    pendingAcquisitions: [],
    suppliers: [],
    marketSharePercent: 5,
    notifications: [],
  };
}

function stateWith(money: number, reputation: number, overlay: HustleCompanyOverlay): GameState {
  return createTestGameState({
    stats: { money, reputation },
    hustleApp: {
      companies: { [COMPANY_ID]: overlay },
      lifetimeStats: {
        totalCompaniesFounded: 1,
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
  });
}

/** Capture the updater handed to setGameState so we can run it against a chosen `prev`. */
function captureUpdater() {
  let updater: ((prev: GameState) => GameState) | undefined;
  const setGameState: Dispatch<SetStateAction<GameState>> = (u) => {
    if (typeof u === 'function') updater = u;
  };
  return {
    setGameState,
    run(prev: GameState): GameState {
      if (!updater) throw new Error('setGameState was never called with a function updater');
      return updater(prev);
    },
  };
}

describe('P1-14: hustle reputation grants are atomic with their money step', () => {
  describe('acceptAcquisition (+3 reputation, costs askingPrice)', () => {
    const offer: HustleAcquisitionOffer = {
      id: 'acq-1',
      targetName: 'RivalCo',
      targetIndustry: 'ai',
      askingPrice: 50_000,
      estimatedAnnualRevenue: 500_000,
      synergyBonusPercent: 20,
      offeredWeek: 0,
      expiresWeek: 10,
      status: 'pending',
    };
    const overlay = (): HustleCompanyOverlay => ({ ...baseOverlay(), pendingAcquisitions: [offer] });

    it('commit path applies money AND reputation in one atomic update', () => {
      const snapshot = stateWith(100_000, 50, overlay());
      const cap = captureUpdater();

      const res = acceptAcquisition(cap.setGameState, snapshot, COMPANY_ID, 'acq-1');
      expect(res.success).toBe(true);

      const committed = cap.run(snapshot);
      expect(committed.stats.money).toBe(50_000); // 100k − 50k askingPrice
      expect(committed.stats.reputation).toBe(53); // 50 + 3, same update
    });

    it('grants NO reputation when the in-updater money step bails (same-batch funds race)', () => {
      const overlayInstance = overlay();
      const snapshot = stateWith(100_000, 50, overlayInstance); // passes the outer guard
      const cap = captureUpdater();
      const res = acceptAcquisition(cap.setGameState, snapshot, COMPANY_ID, 'acq-1');
      expect(res.success).toBe(true);

      const prevAtUpdate = stateWith(10_000, 50, overlayInstance); // funds dropped before commit
      const result = cap.run(prevAtUpdate);

      expect(result).toBe(prevAtUpdate); // `return prev` — deal not closed
      expect(result.stats.reputation).toBe(50); // no free +3
      expect(result.stats.money).toBe(10_000); // money untouched
    });
  });

  describe('resolveScandal (recall: +4 reputation, costs $50k)', () => {
    const scandal: HustleActiveScandal = {
      id: 'sc-1',
      kind: 'data_breach',
      severity: 60,
      startedWeek: 0,
      weeksRemaining: 5,
      headline: 'Data breach exposed',
      resolutionMethod: null,
      revenueDragPercent: 10,
    };
    const overlay = (): HustleCompanyOverlay => ({ ...baseOverlay(), activeScandal: { ...scandal } });

    it('commit path applies the $50k cost AND +4 reputation atomically', () => {
      const snapshot = stateWith(100_000, 50, overlay());
      const cap = captureUpdater();

      const res = resolveScandal(cap.setGameState, snapshot, COMPANY_ID, 'recall');
      expect(res.success).toBe(true);
      expect(res.reputationDelta).toBe(4);

      const committed = cap.run(snapshot);
      expect(committed.stats.money).toBe(50_000); // 100k − 50k recall cost
      expect(committed.stats.reputation).toBe(54); // 50 + 4, same update
    });

    it('grants NO reputation when the cost step bails (same-batch funds race)', () => {
      const overlayInstance = overlay();
      const snapshot = stateWith(100_000, 50, overlayInstance); // passes the outer guard
      const cap = captureUpdater();
      resolveScandal(cap.setGameState, snapshot, COMPANY_ID, 'recall');

      const prevAtUpdate = stateWith(10_000, 50, overlayInstance); // can't afford $50k now
      const result = cap.run(prevAtUpdate);

      expect(result).toBe(prevAtUpdate); // bailed — scandal not resolved
      expect(result.stats.reputation).toBe(50); // no free +4
      expect(result.stats.money).toBe(10_000);
    });
  });
});
