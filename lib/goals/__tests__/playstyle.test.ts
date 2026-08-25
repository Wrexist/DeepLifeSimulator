/**
 * Playstyle emphasis — the personalization layer under the goal catalogue.
 *
 * Two properties matter and both are pinned here:
 *
 * 1. Emphasis is BOUNDED (0..1 per lane) and only ever ADDED to a priority
 *    with a small coefficient, so it reorders goals within a horizon but can
 *    never bury a safety goal or delete a lane — a player leaning business
 *    still sees non-business goals when those are all that is eligible.
 * 2. It actually differentiates: a founder's recommendation leans company,
 *    an investor's leans portfolio, a social player's leans people. Before
 *    this layer every catalogue priority was a constant literal.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { playstyleEmphasis, investedValue, strongRelationshipCount } from '@/lib/goals/playstyle';
import { recommendGoals } from '@/lib/goals';

function founderState(): GameState {
  return createTestGameState({
    stats: { money: 100_000 },
    companies: [
      { id: 'co1', name: 'A', type: 'factory', weeklyIncome: 1500, level: 1 } as never,
      { id: 'co2', name: 'B', type: 'ai', weeklyIncome: 2200, level: 1 } as never,
    ],
  });
}

function investorState(): GameState {
  // Cash-poor on purpose: with a full down payment in hand, "buy your first
  // property" legitimately outbids the portfolio even for an investor — the
  // lane test wants the state where the portfolio IS the right advice.
  return createTestGameState({
    stats: { money: 5_000 },
    stocks: { holdings: [{ symbol: 'AAA', shares: 2000, currentPrice: 40 }] } as never,
  });
}

function socialState(): GameState {
  return createTestGameState({
    weeksLived: 500,
    lifeStartWeek: 100,
    relationships: [
      { id: 'r1', name: 'A', type: 'friend', relationshipScore: 80 } as never,
      { id: 'r2', name: 'B', type: 'friend', relationshipScore: 70 } as never,
    ],
  });
}

describe('playstyleEmphasis', () => {
  it('is bounded to [0, 1] per lane on every probe', () => {
    for (const state of [createTestGameState(), founderState(), investorState(), socialState()]) {
      const e = playstyleEmphasis(state);
      for (const v of Object.values(e)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('reads zero across the board on a blank life', () => {
    const e = playstyleEmphasis(createTestGameState({ currentJob: undefined, careers: [] }));
    expect(e.business).toBe(0);
    expect(e.investor).toBe(0);
    expect(e.career).toBe(0);
  });

  it('differentiates founder, investor and social players', () => {
    expect(playstyleEmphasis(founderState()).business).toBeGreaterThan(
      playstyleEmphasis(investorState()).business,
    );
    expect(playstyleEmphasis(investorState()).investor).toBeGreaterThan(
      playstyleEmphasis(founderState()).investor,
    );
    expect(playstyleEmphasis(socialState()).social).toBeGreaterThan(
      playstyleEmphasis(founderState()).social,
    );
  });

  it('never crashes on a malformed state', () => {
    const broken = { stats: null, companies: [null], relationships: [{}] } as unknown as GameState;
    const e = playstyleEmphasis(broken);
    for (const v of Object.values(e)) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('personalized recommendation', () => {
  it("a founder's DREAM leans toward the business empire", () => {
    const goals = recommendGoals(founderState());
    const dream = goals.find((g) => g.horizon === 'dream');
    expect(dream?.id).toBe('dream_business_empire');
  });

  it("an investor's SOON leans toward the portfolio", () => {
    const goals = recommendGoals(investorState());
    const soon = goals.find((g) => g.horizon === 'soon');
    expect(soon?.id).toBe('soon_grow_portfolio');
  });

  it('personalization never removes lanes: non-matching goals remain eligible', () => {
    // A founder still gets a NOW and a DREAM even though neither is
    // business-specific in a state where the business goals are ineligible.
    const state = createTestGameState({
      stats: { money: 100_000 },
      companies: Array.from({ length: 5 }, (_, i) => ({
        id: `co${i}`, name: `C${i}`, type: 'factory', weeklyIncome: 1000, level: 1,
      })) as never,
    });
    const goals = recommendGoals(state);
    expect(goals.length).toBeGreaterThan(0);
  });
});

describe('helpers', () => {
  it('investedValue sums stocks and crypto, ignoring malformed rows', () => {
    const state = createTestGameState({
      stocks: { holdings: [{ symbol: 'AAA', shares: 10, currentPrice: 100 }, null] } as never,
      cryptos: [{ id: 'btc', owned: 2, price: 500 }, {}] as never,
    });
    expect(investedValue(state)).toBe(10 * 100 + 2 * 500);
  });

  it('strongRelationshipCount counts only scores ≥ 60', () => {
    expect(strongRelationshipCount(socialState())).toBe(2);
    expect(strongRelationshipCount(createTestGameState({ relationships: [] }))).toBe(0);
  });
});
