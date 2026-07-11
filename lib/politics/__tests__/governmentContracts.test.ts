/**
 * Government-contract bonus gating.
 *
 * Regression guard for the off-by-one where `contractMultipliers` (a 0-based
 * office table) was indexed with `politics.careerLevel` (1-based, 1=Council …
 * 6=President): every office earned the tier above it, and the President read
 * off the end of the table and earned $0.
 */
import { GameState } from '@/contexts/game/types';
import {
  calculateGovernmentContractBonus,
  areGovernmentContractsAvailable,
  getContractType,
} from '../governmentContracts';

// Minimal state slice the calculator actually reads. approvalRating 100 makes
// the approval multiplier exactly 1.0 (0.5 + 100/100 * 0.5), so bonus == income*rate.
function stateWith(careerLevel: number, approvalRating: number, weeklyIncome = 1000): GameState {
  return {
    politics: { careerLevel, approvalRating },
    companies: [{ id: 'c1', weeklyIncome }],
  } as unknown as GameState;
}

describe('calculateGovernmentContractBonus — office tier (1-based careerLevel)', () => {
  it('a Citizen (careerLevel 0) earns nothing', () => {
    expect(calculateGovernmentContractBonus(stateWith(0, 100), 'c1')).toBe(0);
  });

  it('a Council Member (rank 1) earns no contracts', () => {
    expect(calculateGovernmentContractBonus(stateWith(1, 100), 'c1')).toBe(0);
  });

  it('a Mayor (rank 2) earns the 10% tier', () => {
    expect(calculateGovernmentContractBonus(stateWith(2, 100, 1000), 'c1')).toBe(100);
  });

  it('the President (rank 6) earns the top 75% tier — NOT $0 (the bug)', () => {
    expect(calculateGovernmentContractBonus(stateWith(6, 100, 1000), 'c1')).toBe(750);
  });

  it('each office from Mayor up earns strictly more than the one below', () => {
    const bonuses = [2, 3, 4, 5, 6].map(rank =>
      calculateGovernmentContractBonus(stateWith(rank, 100, 1000), 'c1'),
    );
    for (let i = 1; i < bonuses.length; i++) {
      expect(bonuses[i]).toBeGreaterThan(bonuses[i - 1]);
    }
  });

  it('approval below 60 disables contracts entirely', () => {
    expect(calculateGovernmentContractBonus(stateWith(6, 59, 1000), 'c1')).toBe(0);
  });
});

describe('areGovernmentContractsAvailable', () => {
  it('is false for a Council Member (contracts start at Mayor)', () => {
    expect(areGovernmentContractsAvailable(stateWith(1, 100))).toBe(false);
  });
  it('is true for a Mayor with sufficient approval', () => {
    expect(areGovernmentContractsAvailable(stateWith(2, 100))).toBe(true);
  });
  it('is false when approval is too low', () => {
    expect(areGovernmentContractsAvailable(stateWith(4, 59))).toBe(false);
  });
});

describe('getContractType — 1-based office rank', () => {
  it('maps Council/Mayor to local', () => {
    expect(getContractType(1)).toBe('local');
    expect(getContractType(2)).toBe('local');
  });
  it('maps State Representative/Governor to state', () => {
    expect(getContractType(3)).toBe('state');
    expect(getContractType(4)).toBe('state');
  });
  it('maps Senator/President to federal', () => {
    expect(getContractType(5)).toBe('federal');
    expect(getContractType(6)).toBe('federal');
  });
});
