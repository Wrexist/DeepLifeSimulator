/**
 * CreateCompany inflated-price gate — UI parity.
 *
 * The Hustle "Found a company" screen (CreateCompanyScreen) now displays the
 * startup cost, gates affordability, and gates selection on
 * getInflatedPrice(baseCost, priceIndex) — EXACTLY what createCompany charges.
 * Previously the UI compared cash to the raw uninflated catalog cost, so under
 * inflation a card read "Affordable" and let you select it, then createCompany
 * rejected the confirm with "Need $X". It also never pre-checked the
 * Entrepreneurship-course / Early-Company-Access gate, so locked industries
 * looked selectable and failed only on confirm.
 *
 * These tests pin the action's real charge + gates so the UI's mirrored math
 * stays honest.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState, type TestGameStateOverrides } from '../helpers/createTestGameState';
import { createCompany } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { getInflatedPrice } from '@/lib/economy/inflation';
import type { GameState } from '@/contexts/game/types';

const FACTORY_BASE_COST = 50_000;

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
  };
}

function foundableState(overrides: TestGameStateOverrides = {}): GameState {
  return createTestGameState({
    stats: { money: 500_000 },
    companies: [],
    educations: [
      { id: 'entrepreneurship', name: 'Entrepreneurship', description: '', cost: 0, duration: 0, completed: true },
    ],
    economy: { priceIndex: 1 },
    ...overrides,
  });
}

describe('createCompany - inflated-price gate math (UI parity)', () => {
  it('charges getInflatedPrice(baseCost, priceIndex), not the raw catalog cost', () => {
    const priceIndex = 1.4;
    const inflated = getInflatedPrice(FACTORY_BASE_COST, priceIndex);
    expect(inflated).toBe(70_000); // 50k × 1.4 — the figure the UI must display + gate on

    const startMoney = 500_000;
    const snapshot = foundableState({
      stats: { money: startMoney },
      economy: { priceIndex },
    });
    const cap = captureUpdater();
    const res = createCompany(snapshot, cap.setGameState, 'factory', { updateMoney });
    expect(res.success).toBe(true);

    const committed = cap.run(snapshot);
    expect(committed.stats.money).toBe(startMoney - inflated);
  });

  it('rejects when cash covers the raw cost but NOT the inflated cost (the old UI lie)', () => {
    const priceIndex = 1.4;
    const inflated = getInflatedPrice(FACTORY_BASE_COST, priceIndex); // 70,000
    // Money sits between the raw catalog cost (50k) and the inflated charge (70k):
    // the OLD screen showed "Affordable" here and let you select, then the action
    // failed. The NEW screen gates on `money >= inflated`, matching this rejection.
    const money = 60_000;
    expect(money).toBeGreaterThanOrEqual(FACTORY_BASE_COST);
    expect(money).toBeLessThan(inflated);
    expect(money >= inflated).toBe(false); // the UI's new affordability predicate

    const snapshot = foundableState({
      stats: { money },
      economy: { priceIndex },
    });
    const cap = captureUpdater();
    const res = createCompany(snapshot, cap.setGameState, 'factory', { updateMoney });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/need/i);
  });

  it('gates founding behind the Entrepreneurship course (mirrored by the UI lock state)', () => {
    const snapshot = foundableState({
      educations: [], // no entrepreneurship course, no early-access prestige bonus
    });
    const cap = captureUpdater();
    const res = createCompany(snapshot, cap.setGameState, 'factory', { updateMoney });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Entrepreneurship/i);
  });
});
