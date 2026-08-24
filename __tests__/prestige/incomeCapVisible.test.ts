/**
 * The prestige income curve — soft cap, not a cliff (2026-08-23 rebalance).
 *
 * History, because the shape of this suite matters: the original design was a
 * hard clamp — `min(1.5, sum)` — and this suite existed to make the WALL
 * visible in the shop, because every income card advertised its headline
 * number while a purchase at the wall granted zero. A tester then stacked
 * income bonuses, hit the wall, and correctly called the purchases "moot and
 * wasteful"; the owner's call was to fix the wall itself, not just the label.
 *
 * The curve now:
 *   full effect to INCOME_SOFT_CAP (+50%)
 *   excess at INCOME_SOFT_CAP_RATE (25 cents on the dollar)
 *   absolute ceiling INCOME_MULTIPLIER_CAP (2.0x)
 *
 * Fully stacked, the catalogue's 3.35x raw lands at ~1.96x — every purchase
 * grants SOMETHING, in strictly diminishing amounts, and the snowball the old
 * clamp guarded against (3.35x compounding per cycle) stays dead.
 */
import {
  INCOME_MULTIPLIER_CAP,
  INCOME_SOFT_CAP,
  INCOME_SOFT_CAP_RATE,
  getIncomeMultiplier,
  getRawIncomeMultiplier,
} from '@/lib/prestige/applyBonuses';
import {
  incomeGainFromPurchase,
  incomeMultiplierHeadroom,
} from '@/lib/prestige/incomeHeadroom';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Three levels of a bonus are three copies of its id. */
const lv = (id: string, n: number) => Array(n).fill(id);

/** Every income bonus at max level, plus the synergy — the full catalogue stack. */
const FULL_STACK = [
  ...lv('income_multiplier_1', 3),
  ...lv('income_multiplier_2', 3),
  ...lv('income_multiplier_3', 3),
  'wealth_magnet',
  'synergy_wealth_master',
];

describe('the curve itself', () => {
  it('passes raw sums through untouched below the soft cap', () => {
    const owned = [...lv('income_multiplier_1', 3), ...lv('income_multiplier_2', 3)];
    expect(getRawIncomeMultiplier(owned)).toBeCloseTo(1.45, 10);
    expect(getIncomeMultiplier(owned)).toBeCloseTo(1.45, 10);
  });

  it('pays excess above the soft cap at the reduced rate', () => {
    const owned = lv('income_multiplier_3', 3); // raw 1.75
    expect(getRawIncomeMultiplier(owned)).toBeCloseTo(1.75, 10);
    expect(getIncomeMultiplier(owned)).toBeCloseTo(
      INCOME_SOFT_CAP + 0.25 * INCOME_SOFT_CAP_RATE, 10,
    );
  });

  it('lands the FULL catalogue stack under the hard cap - nothing is ever a zero', () => {
    // raw 3.35 → 1.5 + 1.85×0.25 = 1.9625
    expect(getRawIncomeMultiplier(FULL_STACK)).toBeCloseTo(3.35, 10);
    expect(getIncomeMultiplier(FULL_STACK)).toBeCloseTo(1.9625, 10);
    expect(getIncomeMultiplier(FULL_STACK)).toBeLessThan(INCOME_MULTIPLIER_CAP);
  });

  it('every single purchase in the catalogue stack grants a POSITIVE amount', () => {
    // The tester complaint this rebalance answers: no purchase order exists in
    // which an income bonus is consumed for zero.
    let owned: string[] = [];
    for (const id of FULL_STACK) {
      expect(incomeGainFromPurchase(owned, id)).toBeGreaterThan(0);
      owned = [...owned, id];
    }
  });

  it('still clamps at the hard ceiling for absurd future stacks', () => {
    expect(getIncomeMultiplier(lv('income_multiplier_3', 40))).toBe(INCOME_MULTIPLIER_CAP);
  });

  it('is monotonic: more bonuses never pay less', () => {
    let prev = getIncomeMultiplier([]);
    let owned: string[] = [];
    for (const id of FULL_STACK) {
      owned = [...owned, id];
      const next = getIncomeMultiplier(owned);
      expect(next).toBeGreaterThanOrEqual(prev);
      prev = next;
    }
  });
});

describe('the headroom shown is the headroom that exists', () => {
  it('reads the caps from the payout, not a second copy', () => {
    expect(incomeMultiplierHeadroom([]).cap).toBe(INCOME_MULTIPLIER_CAP);
    expect(incomeMultiplierHeadroom([]).softCap).toBe(INCOME_SOFT_CAP);
  });

  it('a fresh player has the full range available and is not diminished', () => {
    const h = incomeMultiplierHeadroom([]);
    expect(h.current).toBe(1);
    expect(h.remaining).toBeCloseTo(INCOME_MULTIPLIER_CAP - 1, 10);
    expect(h.atCap).toBe(false);
    expect(h.diminished).toBe(false);
  });

  it('flips diminished once the RAW sum passes the soft cap', () => {
    const under = [...lv('income_multiplier_1', 3), ...lv('income_multiplier_2', 3)]; // raw 1.45
    const over = lv('income_multiplier_3', 3); // raw 1.75
    expect(incomeMultiplierHeadroom(under).diminished).toBe(false);
    expect(incomeMultiplierHeadroom(over).diminished).toBe(true);
    expect(incomeMultiplierHeadroom(over).atCap).toBe(false);
  });

  it('agrees with what the week loop will actually apply', () => {
    for (const owned of [[], lv('income_multiplier_2', 2), FULL_STACK]) {
      expect(incomeMultiplierHeadroom(owned).current).toBeCloseTo(getIncomeMultiplier(owned), 10);
    }
  });

  it('reports atCap only at the hard ceiling', () => {
    expect(incomeMultiplierHeadroom(FULL_STACK).atCap).toBe(false);
    expect(incomeMultiplierHeadroom(lv('income_multiplier_3', 40)).atCap).toBe(true);
  });
});

describe('what a purchase would ACTUALLY grant', () => {
  it('is the full amount while under the soft cap', () => {
    expect(incomeGainFromPurchase([], 'income_multiplier_1')).toBeCloseTo(0.05, 10);
    expect(incomeGainFromPurchase([], 'income_multiplier_3')).toBeCloseTo(0.25, 10);
  });

  it('is the reduced amount past the soft cap - a quarter of the headline', () => {
    const owned = lv('income_multiplier_3', 3); // raw 1.75, already diminished
    expect(incomeGainFromPurchase(owned, 'income_multiplier_2'))
      .toBeCloseTo(0.10 * INCOME_SOFT_CAP_RATE, 10);
  });

  it('splits a purchase that straddles the soft cap correctly', () => {
    // raw 1.45 + 0.25 → 0.05 at full rate, 0.20 at the reduced rate.
    const owned = [...lv('income_multiplier_1', 3), ...lv('income_multiplier_2', 3)];
    expect(incomeGainFromPurchase(owned, 'income_multiplier_3'))
      .toBeCloseTo(0.05 + 0.20 * INCOME_SOFT_CAP_RATE, 10);
  });

  it('is zero for a non-income bonus, which this must not misreport', () => {
    expect(incomeGainFromPurchase([], 'genius')).toBe(0);
    expect(incomeGainFromPurchase([], 'unknown_bonus_id')).toBe(0);
  });

  it('never reports a gain the payout would not deliver (the control)', () => {
    const sets = [
      [],
      lv('income_multiplier_1', 2),
      [...lv('income_multiplier_1', 3), ...lv('income_multiplier_2', 2)],
      [...lv('income_multiplier_3', 3), 'wealth_magnet'],
      FULL_STACK,
    ];
    for (const owned of sets) {
      for (const id of ['income_multiplier_1', 'income_multiplier_2', 'income_multiplier_3', 'wealth_magnet', 'synergy_wealth_master']) {
        const real = getIncomeMultiplier([...owned, id]) - getIncomeMultiplier(owned);
        expect(incomeGainFromPurchase(owned, id)).toBeCloseTo(real, 10);
      }
    }
  });

  it('Wealth Magnet bought first delivers +62.5%, not its advertised +100% - the shop must say so', () => {
    // 1 + 1.0 raw = 2.0 → 1.5 + 0.5×0.25 = 1.625. Better than the old clamp's
    // +50%, still short of the headline — which is why the per-card
    // "Actually grants" note exists and must keep rendering.
    expect(incomeGainFromPurchase([], 'wealth_magnet')).toBeCloseTo(0.625, 10);
  });

  it('handles a missing/garbage unlocked list without throwing', () => {
    expect(incomeGainFromPurchase(undefined as unknown as string[], 'wealth_magnet')).toBeCloseTo(0.625, 10);
    expect(incomeMultiplierHeadroom(undefined as unknown as string[]).current).toBe(1);
  });
});

describe('the shop says so', () => {
  const src = code('components/PrestigeShopModal.tsx');

  it('reads the shared helper rather than the raw description alone', () => {
    expect(src).toMatch(/incomeGainFromPurchase|incomeMultiplierHeadroom/);
  });

  it('warns when a purchase would grant nothing', () => {
    expect(src).toMatch(/No effect/i);
  });

  it('states the diminishing-returns threshold', () => {
    expect(src).toMatch(/diminished/);
  });

  it('does not hardcode either cap (the control)', () => {
    expect(src).not.toMatch(/Math\.min\(1\.5|Math\.min\(2(\.0)?[,)]/);
  });
});
