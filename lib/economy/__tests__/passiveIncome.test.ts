import { calcWeeklyPassiveIncome } from '../passiveIncome';
import { GameState, RealEstate } from '@/contexts/GameContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { getStockInfo } from '../stockMarket';
import { getUpgradeTier } from '@/lib/realEstate/housing';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

function createState(overrides: Partial<GameState>): GameState {
  return createTestGameState(overrides);
}

describe('calcWeeklyPassiveIncome', () => {
  it('calculates income from stocks and real estate', () => {
    const properties: RealEstate[] = [
      {
        id: 'house',
        name: 'House',
        price: 100000,
        weeklyHappiness: 0,
        weeklyEnergy: 0,
        owned: true,
        interior: [],
        upgradeLevel: 1,
        rent: 500,
        upkeep: 100,
      },
    ];
    const state = createState({
      stocksOwned: { aapl: 1000 },
      realEstate: properties,
      hobbies: [
        {
          id: 'music',
          name: 'Music',
          description: '',
          energyCost: 0,
          skill: 0,
          skillLevel: 1,
          tournamentReward: 0,
          songs: [{ id: 's1', grade: 'Good', weeklyIncome: 50 }],
          upgrades: [],
        },
        {
          id: 'art',
          name: 'Art',
          description: '',
          energyCost: 0,
          skill: 0,
          skillLevel: 1,
          tournamentReward: 0,
          artworks: [{ id: 'a1', grade: 'Good', weeklyIncome: 30 }],
          upgrades: [],
        },
        {
          id: 'football',
          name: 'Football',
          description: '',
          energyCost: 0,
          skill: 0,
          skillLevel: 1,
          tournamentReward: 0,
          contracts: [
            {
              id: 'c1',
              team: 'Lions FC',
              matchPay: 40,
              weeksRemaining: 10,
              totalWeeks: 40,
              division: 0,
              goal: 1,
            },
          ],
          sponsors: [{ id: 's1', name: 'Nyke', weeklyPay: 20, weeksRemaining: 5 }],
          upgrades: [],
        },
      ],
    });
    const result = calcWeeklyPassiveIncome(state);

    const stock = getStockInfo('AAPL');
    const property = properties[0];
    if (!property) {
      throw new Error('Expected at least one property in test setup');
    }
    const propertyRent = property.rent ?? 0;
    const propertyUpkeep = property.upkeep ?? 0;
    // Stock dividends are NOT paid here. This used to expect
    // `price × yield × shares / 52` every week, which was a duplicate of the
    // quarterly payout in `lib/stocks/dividends.ts` — both credited money, so a
    // holder collected 200% of the advertised yield. The quarterly system is
    // the sole payer now. See __tests__/economy/dividendDoublePay.test.ts.
    // 2026-07-30 audit R1-01.
    const expectedStocks = 0;
    const tier = getUpgradeTier(property.upgradeLevel);
    const expectedRealEstate = Math.round(
      propertyRent + (tier?.rentBonus || 0) - (propertyUpkeep + (tier?.upkeepBonus || 0))
    );

    expect(result.breakdown.stocks).toBe(expectedStocks);
    expect(result.breakdown.realEstate).toBe(expectedRealEstate);

    const expectedTotal =
      result.breakdown.stocks +
      result.breakdown.realEstate +
      result.breakdown.socialMedia +
      result.breakdown.patents +
      result.breakdown.businessOpportunities +
      result.breakdown.political +
      result.breakdown.cryptoMining +
      result.breakdown.companies +
      result.breakdown.gamingStreaming;
    expect(result.total).toBe(expectedTotal);
  });

  describe('company brand / market-share multiplier (Hustle overlay)', () => {
    const baseCompany = {
      id: 'factory',
      name: 'My Factory',
      type: 'factory' as const,
      weeklyIncome: 10000,
      baseWeeklyIncome: 10000,
      upgrades: [],
      employees: 0,
      workerSalary: 500,
      workerMultiplier: 1.1,
      marketingLevel: 1,
      miners: {},
      warehouseLevel: 0,
    };

    function stateWithOverlay(brandScore: number | undefined, marketSharePercent: number | undefined): GameState {
      return createState({
        companies: [baseCompany],
        hustleApp: {
          companies: {
            factory: {
              companyId: 'factory',
              brand: brandScore === undefined ? undefined : { score: brandScore, trend: 'flat', lastUpdatedWeek: 0 },
              marketSharePercent,
            },
          },
          lifetimeStats: {},
        },
      } as unknown as Partial<GameState>);
    }

    it('applies the brand + market share factor to company income', () => {
      // factor = 1 + (90-50)/200 + 40/200 = 1.4
      const result = calcWeeklyPassiveIncome(stateWithOverlay(90, 40));
      expect(result.breakdown.companies).toBe(Math.round(10000 * 1.4));
    });

    it('clamps the factor at the 1.6 upper bound', () => {
      // raw = 1 + 50/200 + 100/200 = 1.75 → clamped to 1.6
      const result = calcWeeklyPassiveIncome(stateWithOverlay(100, 100));
      expect(result.breakdown.companies).toBe(Math.round(10000 * 1.6));
    });

    it('clamps the factor at the 0.75 lower bound', () => {
      // raw = 1 - 50/200 + 0 = 0.75 (exactly the floor; anything lower clamps)
      const result = calcWeeklyPassiveIncome(stateWithOverlay(0, 0));
      expect(result.breakdown.companies).toBe(Math.round(10000 * 0.75));
    });

    it('is neutral (1.0) when the hustle overlay is missing (older saves)', () => {
      const result = calcWeeklyPassiveIncome(createState({ companies: [baseCompany] }));
      expect(result.breakdown.companies).toBe(10000);
    });

    it('treats a malformed overlay (missing brand/share) as neutral-ish defaults', () => {
      // brand missing → 50 (neutral), share missing → 0 → factor = 1.0
      const result = calcWeeklyPassiveIncome(stateWithOverlay(undefined, undefined));
      expect(result.breakdown.companies).toBe(10000);
    });
  });
});
