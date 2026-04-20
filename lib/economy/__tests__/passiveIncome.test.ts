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
    const expectedStocks = Math.round((stock.price * stock.dividendYield * 1000) / WEEKS_PER_YEAR);
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
});
