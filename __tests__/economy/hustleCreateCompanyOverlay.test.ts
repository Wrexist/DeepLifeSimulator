/**
 * createCompany seeds a Hustle overlay + increments the "Founded" milestone.
 *
 * Previously createCompany added only the canonical Company record; the Hustle
 * overlay was created lazily (first modal open via ensureOverlay), so a fresh
 * company was SKIPPED by the weekly tick (`if (!prevOverlay) continue`) — no
 * brand drift, market-share evolution, scandals, or acquisition offers — and
 * the Dashboard "Founded" tile stayed pinned at 0 (totalCompaniesFounded was
 * only ever assigned 0). This test drives the setGameState updater and proves
 * the overlay is seeded and the counter increments exactly once.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { createCompany } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import type { GameState } from '@/contexts/game/types';

function captureUpdater() {
  let updater: ((prev: GameState) => GameState) | undefined;
  const setGameState: Dispatch<SetStateAction<GameState>> = (u) => {
    if (typeof u === 'function') updater = u as (prev: GameState) => GameState;
  };
  return {
    setGameState,
    run(prev: GameState): GameState {
      if (!updater) throw new Error('setGameState was never called with a function updater');
      return updater(prev);
    },
    called() {
      return updater !== undefined;
    },
  };
}

function foundableState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({
    stats: { money: 500_000 } as GameState['stats'],
    companies: [],
    educations: [
      { id: 'entrepreneurship', name: 'Entrepreneurship', description: '', cost: 0, duration: 0, completed: true },
    ],
    economy: { priceIndex: 1 } as GameState['economy'],
    ...overrides,
  });
}

describe('createCompany — Hustle overlay seeding', () => {
  it('seeds a per-company overlay and increments totalCompaniesFounded', () => {
    const snapshot = foundableState();
    const cap = captureUpdater();

    const res = createCompany(snapshot, cap.setGameState, 'factory', { updateMoney });
    expect(res.success).toBe(true);

    const committed = cap.run(snapshot);

    // canonical company added
    expect(committed.companies.some((c) => c.id === 'factory')).toBe(true);
    // overlay seeded with the neutral defaults
    const overlay = committed.hustleApp?.companies?.factory;
    expect(overlay).toBeDefined();
    expect(overlay!.companyId).toBe('factory');
    expect(overlay!.brand.score).toBe(50);
    expect(overlay!.marketSharePercent).toBe(5);
    expect(overlay!.activeScandal).toBeNull();
    // Founded milestone advances (was permanently 0)
    expect(committed.hustleApp?.lifetimeStats.totalCompaniesFounded).toBe(1);
  });

  it('does not double-found (or double-charge) when the updater runs twice', () => {
    const snapshot = foundableState();
    const cap = captureUpdater();
    createCompany(snapshot, cap.setGameState, 'factory', { updateMoney });

    const once = cap.run(snapshot);
    // Re-running the SAME updater against the already-committed state must be a
    // no-op (StrictMode double-invoke / double-tap guard).
    const twice = cap.run(once);
    expect(twice.companies.filter((c) => c.id === 'factory')).toHaveLength(1);
    expect(twice.hustleApp?.lifetimeStats.totalCompaniesFounded).toBe(1);
    expect(twice.stats.money).toBe(once.stats.money);
  });

  it('preserves existing hustle lifetime stats when founding a second company', () => {
    const snapshot = foundableState({
      hustleApp: {
        companies: {},
        lifetimeStats: {
          totalCompaniesFounded: 2,
          totalCompaniesSold: 0,
          totalIPOsLaunched: 1,
          totalAcquisitionsCompleted: 0,
          totalScandalsSurvived: 0,
          totalCampaignsRun: 0,
          totalNamedHires: 0,
          totalFires: 0,
          peakBrandScore: 70,
          peakMarketShare: 12,
          peakSharePrice: 5,
        },
      },
    });
    const cap = captureUpdater();
    createCompany(snapshot, cap.setGameState, 'ai', { updateMoney });
    const committed = cap.run(snapshot);
    expect(committed.hustleApp?.lifetimeStats.totalCompaniesFounded).toBe(3);
    expect(committed.hustleApp?.lifetimeStats.totalIPOsLaunched).toBe(1);
    expect(committed.hustleApp?.lifetimeStats.peakBrandScore).toBe(70);
    expect(committed.hustleApp?.companies?.ai).toBeDefined();
  });
});
