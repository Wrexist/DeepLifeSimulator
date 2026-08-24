/**
 * The prestige builders must hand out a fully independent copy of
 * `initialGameState` (2026-08-23).
 *
 * `createResetGameState` / `createChildGameState` used to spread the top level
 * and hand-clone only `stats`/`date`/`settings`, so every OTHER nested default
 * — `stocks`, `companies`, `vehicles`, `politics`, the arrays — was the
 * module-lifetime singleton shared BY REFERENCE. `applyStartingBonuses` then
 * wrote through those references (`stocks.holdings.push`, mutating
 * `existingHolding.shares`, `companies.push`, `vehicles.push`), which meant:
 *
 *   - `starting_investment_portfolio` COMPOUNDED: prestige N in one app
 *     session started life N with N × $50K of stock, freely sellable week 1;
 *   - `starting_company` / `starting_vehicle` leaked into the singleton, so a
 *     brand-new game in the same session began with a company, a car and a
 *     driver's license nobody bought.
 *
 * The builders now deep-clone (`freshInitialState`). These tests drive the
 * REAL `executePrestige` path — the test factory's own `structuredClone` is
 * exactly why the existing startingPortfolio tests could never see this.
 */
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const BONUSES = ['starting_investment_portfolio', 'starting_company', 'starting_vehicle'];

function richState(): GameState {
  const s = createTestGameState();
  s.stats.money = 100_000_000; // far above every prestige threshold
  const prestige = s.prestige;
  if (!prestige) throw new Error('factory state must carry prestige data');
  s.prestige = { ...prestige, unlockedBonuses: [...BONUSES] };
  return s;
}

describe('prestige grants do not leak into the initialGameState singleton', () => {
  it('two prestiges in one session grant the SAME portfolio, not a compounding one', () => {
    const life2 = executePrestige(richState(), 'reset');
    const life3 = executePrestige(richState(), 'reset');

    const holdingsOf = (s: GameState) =>
      (s.stocks?.holdings ?? []).map(h => ({ symbol: h.symbol, shares: h.shares }));

    expect(holdingsOf(life2).length).toBeGreaterThan(0); // the bonus really granted
    expect(holdingsOf(life3)).toEqual(holdingsOf(life2)); // …and did not compound
  });

  it('leaves the singleton untouched — a NEW game starts with nothing', () => {
    executePrestige(richState(), 'reset');

    expect(initialGameState.stocks?.holdings ?? []).toHaveLength(0);
    expect(initialGameState.companies ?? []).toHaveLength(0);
    expect(initialGameState.vehicles ?? []).toHaveLength(0);
    expect(initialGameState.hasDriversLicense).not.toBe(true);
  });

  it('the new life shares no nested references with the singleton', () => {
    const life = executePrestige(richState(), 'reset');
    expect(life.stocks).not.toBe(initialGameState.stocks);
    expect(life.companies).not.toBe(initialGameState.companies);
    expect(life.vehicles).not.toBe(initialGameState.vehicles);
    expect(life.politics).not.toBe(initialGameState.politics);
  });
});
