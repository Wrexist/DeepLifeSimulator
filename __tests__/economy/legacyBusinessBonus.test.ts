/**
 * `legacy_business` finally does something — and it is what the card promised.
 *
 * The bonus (legendary, 30,000 prestige points, "Future generations inherit
 * family businesses") was read by NO code at all. Family businesses already
 * pass to the heir unconditionally in `prestigeExecution`, so the purchase was
 * consumed and changed nothing. It was the only one of 50 catalogue ids with
 * no reader.
 *
 * ── Why this effect, and not the other two options ────────────────────────
 *
 * Gating inheritance on the bonus would have made the description literally
 * true, but it REMOVES behaviour every existing player has today and undoes a
 * deliberate "BUG FIX: Preserve family businesses on prestige". Deleting the
 * bonus strands the points of anyone who already bought it. Both make an
 * existing player worse off for a bug that was never theirs.
 *
 * So it gains an ADDITIVE effect instead, hung on `generationsHeld` — a field
 * that already increments on every prestige and, until now, was read only to
 * print "held N generations" on the company screen. Nothing consumed it.
 *
 * That pairing is the point: one dead bonus and one dead counter fix each
 * other. The description stops being a lie without anything being taken away,
 * and a business surviving generations finally compounds instead of merely
 * being labelled.
 */
import {
  LEGACY_GENERATION_INCOME_STEP,
  MAX_LEGACY_GENERATION_BONUS,
  legacyGenerationIncomeMultiplier,
} from '@/lib/business/familyBusinessEffects';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { createTestGameState } from '../helpers/createTestGameState';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const OWNED = ['legacy_business'];

describe('nothing changes for a player who does not own the bonus', () => {
  it('is exactly neutral without it, at every generation count', () => {
    // The single most important property. This ships to live saves; a business
    // held five generations by someone who never bought the bonus must earn
    // precisely what it earned yesterday.
    for (const gen of [0, 1, 3, 10, 999]) {
      expect(legacyGenerationIncomeMultiplier(gen, [])).toBe(1);
    }
  });

  it('is neutral for an unrelated bonus (the control)', () => {
    expect(legacyGenerationIncomeMultiplier(5, ['wealth_magnet', 'genius'])).toBe(1);
  });

  it('is neutral on a missing or garbage bonus list', () => {
    expect(legacyGenerationIncomeMultiplier(5, undefined)).toBe(1);
    expect(legacyGenerationIncomeMultiplier(5, null as unknown as string[])).toBe(1);
  });
});

describe('with the bonus, generations compound', () => {
  it('is still neutral in the generation the business is founded', () => {
    // `createFamilyBusiness` seeds generationsHeld: 0. Paying out on generation
    // zero would hand every owner an instant raise for having bought nothing
    // yet — the same "stealth buff dressed as a bug fix" the brand curve was
    // deliberately built to avoid.
    expect(legacyGenerationIncomeMultiplier(0, OWNED)).toBe(1);
  });

  it('pays one step per generation held', () => {
    expect(legacyGenerationIncomeMultiplier(1, OWNED)).toBeCloseTo(1 + LEGACY_GENERATION_INCOME_STEP, 10);
    expect(legacyGenerationIncomeMultiplier(3, OWNED)).toBeCloseTo(1 + 3 * LEGACY_GENERATION_INCOME_STEP, 10);
  });

  it('caps, so a very old dynasty cannot run away with the economy', () => {
    const cap = 1 + MAX_LEGACY_GENERATION_BONUS;

    expect(legacyGenerationIncomeMultiplier(50, OWNED)).toBe(cap);
    expect(legacyGenerationIncomeMultiplier(999, OWNED)).toBe(cap);
    // The cap must actually bind at a reachable generation count, or it is
    // decorative.
    expect(MAX_LEGACY_GENERATION_BONUS / LEGACY_GENERATION_INCOME_STEP).toBeLessThanOrEqual(10);
  });

  it('a corrupt generation count cannot mint income (the control)', () => {
    for (const bad of [NaN, Infinity, -Infinity, -5, '3' as unknown]) {
      const m = legacyGenerationIncomeMultiplier(bad as number, OWNED);
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(1 + MAX_LEGACY_GENERATION_BONUS);
    }
  });

  it('stays below the strongest existing per-business multiplier (the control)', () => {
    // Brand tops out at +25% and costs $350k-$1m of in-game spend. A prestige
    // bonus should be comparable, not eclipsing — otherwise it flattens the
    // business systems it is meant to reward.
    expect(MAX_LEGACY_GENERATION_BONUS).toBeLessThanOrEqual(0.5);
  });
});

describe('the payout actually applies it — measured, not grepped', () => {
  /*
   * This block originally asserted only that `passiveIncome.ts` CONTAINED the
   * call. That passed even when the call was dead-coded behind `if (false &&
   * …)`, which a sabotage run proved. A source-text match cannot tell a wired
   * multiplier from an unreachable one — precisely the class of defect this
   * whole bonus came from. So it runs the real income function instead.
   */
  const businessState = (generationsHeld: number, unlockedBonuses: string[]) =>
    createTestGameState({
      companies: [{
        ...(createTestGameState().companies?.[0] ?? {}),
        id: 'fam-co',
        name: 'Family Co',
        weeklyIncome: 10_000,
        baseWeeklyIncome: 10_000,
      }],
      familyBusinesses: [{
        companyId: 'fam-co', foundedGeneration: 1, generationsHeld,
        brandValue: 0, reputation: 50,
      }],
      prestige: { ...(createTestGameState().prestige ?? {}), unlockedBonuses },
    } as Parameters<typeof createTestGameState>[0]);

  const income = (gen: number, bonuses: string[]) =>
    calcWeeklyPassiveIncome(businessState(gen, bonuses), { excludeRealEstate: true }).total;

  it('pays MORE with the bonus than without, at the same generation', () => {
    const without = income(3, []);
    const withIt = income(3, ['legacy_business']);

    expect(without).toBeGreaterThan(0);
    expect(withIt).toBeGreaterThan(without);
  });

  it('pays the exact multiplier, not merely "more"', () => {
    // Pins the size. "Greater than" alone would pass on a 0.1% bump.
    const without = income(3, []);
    const withIt = income(3, ['legacy_business']);

    expect(withIt / without).toBeCloseTo(legacyGenerationIncomeMultiplier(3, ['legacy_business']), 2);
  });

  it('pays identically at generation 0 (the control)', () => {
    expect(income(0, ['legacy_business'])).toBe(income(0, []));
  });

  it('leaves a non-owner completely unchanged across generations (the control)', () => {
    // The upgrade-safety property, measured end to end rather than on the
    // helper alone.
    expect(income(7, [])).toBe(income(0, []));
  });

  it('still composes with the brand multiplier (the control)', () => {
    // Brand must keep working. If this had replaced that line rather than
    // stacking, every player who invested in marketing would lose the return.
    expect(code('lib/economy/passiveIncome.ts')).toMatch(/familyBrandIncomeMultiplier\(/);
  });
});

describe('the bonus is no longer advertised as dead', () => {
  it('is out of the inert registry', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { INERT_BONUS_IDS, inertBonusReason } = require('@/lib/prestige/inertBonuses');
    expect(INERT_BONUS_IDS).not.toContain('legacy_business');
    expect(inertBonusReason('legacy_business')).toBeNull();
  });

  it('its description states the real effect', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PRESTIGE_BONUSES } = require('@/lib/prestige/prestigeBonuses');
    const b = PRESTIGE_BONUSES.find((x: { id: string }) => x.id === 'legacy_business');

    expect(b).toBeDefined();
    // The old text promised inheritance, which happens for free. A card that
    // describes something the player already has is the same defect in words.
    expect(b.description).not.toMatch(/^Future generations inherit family businesses$/);
    expect(b.description).toMatch(/generation/i);
  });
});
