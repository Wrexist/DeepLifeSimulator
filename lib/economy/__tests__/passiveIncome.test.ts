import { calcWeeklyPassiveIncome } from '../passiveIncome';
import { GameState, RealEstate } from '@/contexts/GameContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

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
      stocksOwned: { aapl: 10 },
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
    expect(result.breakdown.stocks).toBeCloseTo((178.2 * 0.006 * 10) / 52, 5);
    expect(result.breakdown.realEstate).toBe(480);
    expect(result.breakdown.songs).toBe(50);
    expect(result.breakdown.art).toBe(30);
    expect(result.breakdown.contracts).toBe(0);
    expect(result.breakdown.sponsors).toBe(20);
    expect(result.total).toBeCloseTo(result.breakdown.stocks + 480 + 50 + 30 + 0 + 20, 5);
  });
});
