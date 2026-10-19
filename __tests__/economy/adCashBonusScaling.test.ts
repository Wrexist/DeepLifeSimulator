/**
 * The bank's sponsored bonus scales off what the player is WORTH, with a floor.
 *
 * It used to read `stats.money` alone, floored at $50 and capped at $5,000.
 * Cash is the worst available proxy for progress: a player with $40M in
 * property, companies and stock but $300 in the wallet — an entirely normal
 * late-game shape, since idle cash earns nothing — was offered **$50** to watch
 * an ad. `AdRewardOrb` had already been fixed to scale off
 * `max(netWorth, cash) × 1.5%`, so the game shipped two cash ad rewards on
 * scales three orders of magnitude apart.
 *
 * Now: `max(netWorth, cash) × 2%`, floored at $2,000, capped at the same
 * $500,000 the orb uses.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { GameState } from '@/contexts/game/types';
import {
  getAdCashBonusAmount,
  AD_CASH_BONUS_MIN,
  AD_CASH_BONUS_MAX,
  AD_CASH_BONUS_RATE,
} from '@/contexts/game/actions/BankingActions';
import { netWorth } from '@/lib/progress/achievements';

const withState = (over: Partial<GameState>): GameState => {
  const base = createTestGameState();
  return { ...base, ...over };
};

const withCash = (money: number): GameState => {
  const base = createTestGameState();
  return { ...base, stats: { ...base.stats, money } };
};

describe('the floor', () => {
  it('never pays less than the minimum, however poor the player is', () => {
    for (const money of [0, 1, 500, 1_500]) {
      expect(getAdCashBonusAmount(withCash(money))).toBe(AD_CASH_BONUS_MIN);
    }
  });

  it('is $2,000', () => {
    expect(AD_CASH_BONUS_MIN).toBe(2_000);
  });

  it('survives a corrupt save rather than throwing into a button label', () => {
    const broken = withState({
      stats: { ...createTestGameState().stats, money: NaN },
      realEstate: null as never,
      companies: undefined as never,
    });
    expect(getAdCashBonusAmount(broken)).toBe(AD_CASH_BONUS_MIN);
  });
});

describe('it scales with everything that has worth, not just cash', () => {
  it('a property-rich, cash-poor player is paid on the property', () => {
    // The exact case the old formula got wrong: $50 offered to a millionaire.
    const base = createTestGameState();
    const rich: GameState = {
      ...base,
      stats: { ...base.stats, money: 300 },
      realEstate: [
        { id: 'p1', name: 'Tower', price: 20_000_000, type: 'apartment' } as never,
      ],
    };

    const worth = netWorth(rich);
    expect(worth).toBeGreaterThan(19_000_000);
    // Scales off worth, not the $300 in the wallet.
    expect(getAdCashBonusAmount(rich)).toBeGreaterThan(AD_CASH_BONUS_MIN);
    expect(getAdCashBonusAmount(rich)).toBe(
      Math.min(AD_CASH_BONUS_MAX, Math.round((worth * AD_CASH_BONUS_RATE) / 10) * 10),
    );
  });

  it('pays the stated rate in the band between floor and cap', () => {
    // $1M cash → 2% = $20,000, comfortably inside both bounds.
    expect(getAdCashBonusAmount(withCash(1_000_000))).toBe(20_000);
  });

  it('rises monotonically with worth', () => {
    const amounts = [0, 100_000, 1_000_000, 5_000_000].map((m) =>
      getAdCashBonusAmount(withCash(m)),
    );
    for (let i = 1; i < amounts.length; i += 1) {
      expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]);
    }
  });

  it('a mortgage backed by a property does not bury a cash-rich wallet', () => {
    // A cash-rich, mortgage-heavy player: $1M cash, a $5M home, a $5M loan on
    // it. Net worth nets the loan against the home and keeps the cash, so the
    // bonus is still 2% of the $1M. Same base AdRewardOrb uses.
    const base = createTestGameState();
    const mortgaged: GameState = {
      ...base,
      stats: { ...base.stats, money: 1_000_000 },
      realEstate: [{ id: 'home', name: 'Home', price: 5_000_000, currentValue: 5_000_000, owned: true } as never],
      loans: [{ id: 'L', remaining: 5_000_000 } as never],
    };
    expect(getAdCashBonusAmount(mortgaged)).toBe(20_000); // 2% of the $1M cash
  });

  it('borrowed cash with nothing behind it does not count (exploit sweep 2026-10-19)', () => {
    // $1M cash that is all borrowed: net worth ~0, cash net of debt 0, so the
    // bonus is the floor. Counting it paid 2% of any loan, then the loan was
    // prepaid the same week.
    const base = createTestGameState();
    const borrowed: GameState = {
      ...base,
      stats: { ...base.stats, money: 1_000_000 },
      loans: [{ id: 'L', remaining: 1_000_000 } as never],
    };
    expect(netWorth(borrowed)).toBeLessThan(1_000_000);
    expect(getAdCashBonusAmount(borrowed)).toBe(AD_CASH_BONUS_MIN);
  });
});

describe('the ceiling', () => {
  it('caps the payout', () => {
    expect(getAdCashBonusAmount(withCash(10_000_000_000))).toBe(AD_CASH_BONUS_MAX);
  });

  it('matches the orb so the two cash ad rewards top out together', () => {
    const orb = require('fs').readFileSync(
      require('path').join(__dirname, '../../components/AdRewardOrb.tsx'),
      'utf8',
    ) as string;
    const m = /const REWARD_MAX = ([\d_]+);/.exec(orb);
    expect(m).not.toBeNull();
    expect(Number(m![1].replace(/_/g, ''))).toBe(AD_CASH_BONUS_MAX);
  });
});

describe('the quoted number is the paid number', () => {
  it('the Bank screen reads the amount from this same helper', () => {
    // A reward that advertises one figure and grants another is the shape of
    // every silent-rejection finding in this repo.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../components/mobile/BankApp.tsx'),
      'utf8',
    ) as string;
    expect(src).toMatch(/const adCashBonus = getAdCashBonusAmount\(gameState\)/);
    expect(src).toMatch(/\+\$\{?formatMoney\(adCashBonus\)/);
  });
});
