/**
 * Prestige income bonuses could be bought for nothing, at full price.
 *
 * `getIncomeMultiplier` sums the income bonuses and then clamps:
 *
 *     // ANTI-EXPLOIT: Cap total income multiplier at 1.5x (50% bonus max)
 *     return Math.min(1.5, multiplier);
 *
 * The cap is deliberate and correct — the comment explains that uncapped
 * stacking makes each prestige cycle faster than the last. The defect is that
 * NOTHING said so. `PrestigeShopModal` renders `bonus.description` verbatim,
 * so every card promised its headline number regardless of headroom:
 *
 *   fully stacked, the bonuses advertise  3.35x (+235%)
 *   the player actually receives          1.50x  (+50%)
 *   cost of all income bonuses            121,000 points
 *
 * Headroom is +0.50. Three levels of Small (+0.15) plus three of Moderate
 * (+0.30) reach +0.45, so the very next purchase overflows. After that,
 * *Wealth Magnet* — 40,000 points, "+100% passive income" — grants exactly
 * zero, and the shop still shows "+100%".
 *
 * That is the same class as the MON findings already in this PR: a purchase
 * that is consumed and grants nothing. This does NOT change the cap; it makes
 * the cap visible, so the choice stays the player's.
 */
import {
  INCOME_MULTIPLIER_CAP,
  getIncomeMultiplier,
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

describe('the headroom shown is the headroom that exists', () => {
  it('reads the cap from the payout, not a second copy', () => {
    expect(INCOME_MULTIPLIER_CAP).toBe(1.5);
    expect(incomeMultiplierHeadroom([]).cap).toBe(INCOME_MULTIPLIER_CAP);
  });

  it('a fresh player has the full +0.50 available', () => {
    const h = incomeMultiplierHeadroom([]);

    expect(h.current).toBe(1);
    expect(h.remaining).toBeCloseTo(0.5, 10);
    expect(h.atCap).toBe(false);
  });

  it('tracks the real total as bonuses are bought', () => {
    const owned = [...lv('income_multiplier_1', 3), ...lv('income_multiplier_2', 3)];
    const h = incomeMultiplierHeadroom(owned);

    // +0.15 and +0.30 — still under the cap, so nothing is wasted yet.
    expect(h.current).toBeCloseTo(1.45, 10);
    expect(h.remaining).toBeCloseTo(0.05, 10);
    expect(h.atCap).toBe(false);
    // and it agrees with what the week loop will actually apply
    expect(h.current).toBeCloseTo(getIncomeMultiplier(owned), 10);
  });

  it('reports being AT the cap once the sum passes it', () => {
    const owned = [...lv('income_multiplier_3', 3)]; // +0.75, clamped to +0.50
    const h = incomeMultiplierHeadroom(owned);

    expect(h.current).toBe(INCOME_MULTIPLIER_CAP);
    expect(h.remaining).toBe(0);
    expect(h.atCap).toBe(true);
  });
});

describe('what a purchase would ACTUALLY grant', () => {
  it('is the full amount while there is room', () => {
    expect(incomeGainFromPurchase([], 'income_multiplier_1')).toBeCloseTo(0.05, 10);
    expect(incomeGainFromPurchase([], 'income_multiplier_3')).toBeCloseTo(0.25, 10);
  });

  it('is only the remaining headroom when the purchase overflows', () => {
    // +0.45 owned, +0.25 offered, +0.05 of room. The player pays 20,000 for
    // a twentieth of the advertised effect.
    const owned = [...lv('income_multiplier_1', 3), ...lv('income_multiplier_2', 3)];
    expect(incomeGainFromPurchase(owned, 'income_multiplier_3')).toBeCloseTo(0.05, 10);
  });

  it('is ZERO for a legendary bought at the cap — the headline case', () => {
    // Wealth Magnet: 40,000 points, description "+100% passive income".
    const capped = [...lv('income_multiplier_3', 3)];
    expect(incomeMultiplierHeadroom(capped).atCap).toBe(true);
    expect(incomeGainFromPurchase(capped, 'wealth_magnet')).toBe(0);
  });

  it('is zero for a non-income bonus, which this must not misreport', () => {
    // `genius` is a learning-speed bonus. It contributes nothing to income and
    // must not be flagged as capped-out — that would be a false warning, and a
    // false warning is how a real one stops being read.
    expect(incomeGainFromPurchase([], 'genius')).toBe(0);
    expect(incomeGainFromPurchase([], 'unknown_bonus_id')).toBe(0);
  });

  it('never reports a gain the payout would not deliver (the control)', () => {
    // Property: for any owned set and any income bonus, the reported gain must
    // equal the real delta in getIncomeMultiplier. Two functions computing this
    // independently is the exact defect being closed.
    const sets = [
      [],
      lv('income_multiplier_1', 2),
      [...lv('income_multiplier_1', 3), ...lv('income_multiplier_2', 2)],
      [...lv('income_multiplier_3', 3), 'wealth_magnet'],
    ];
    for (const owned of sets) {
      for (const id of ['income_multiplier_1', 'income_multiplier_2', 'income_multiplier_3', 'wealth_magnet']) {
        const real = getIncomeMultiplier([...owned, id]) - getIncomeMultiplier(owned);
        expect(incomeGainFromPurchase(owned, id)).toBeCloseTo(real, 10);
      }
    }
  });

  it('Wealth Magnet can NEVER deliver its advertised +100%', () => {
    // Sharper than the capped-out case, and found by this suite rather than by
    // reading the shop: 1 + 1.0 = 2.0 clamps to 1.5, so even bought first on a
    // clean slate the 40,000-point legendary delivers +50%, not the +100% its
    // description promises. There is no game state in which that card is
    // honest, so the shop must show the real number every time — not only once
    // the player is capped.
    expect(incomeGainFromPurchase([], 'wealth_magnet')).toBeCloseTo(0.5, 10);
    expect(getIncomeMultiplier(['wealth_magnet'])).toBe(INCOME_MULTIPLIER_CAP);
  });

  it('handles a missing/garbage unlocked list without throwing', () => {
    expect(incomeGainFromPurchase(undefined as unknown as string[], 'wealth_magnet')).toBeCloseTo(0.5, 10);
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

  it('does not hardcode the cap (the control)', () => {
    // A literal 1.5 here would silently disagree the day the cap is retuned.
    expect(src).not.toMatch(/Math\.min\(1\.5/);
  });
});
