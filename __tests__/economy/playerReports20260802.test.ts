/**
 * Player bug reports, 2026-08-02 (Discord #bug-reports).
 *
 * Seven reports. Three shared one root cause, one was not reproducible as
 * written, and the rest were each real. What connects most of them is not
 * broken logic — it is logic whose effect the UI never showed, which from the
 * player's chair is indistinguishable from a dead feature.
 *
 *   "Shares and brand do not effect anything"
 *   "Key hires ... do not effect anything"
 *   "Doing acquisitions changes nothing"
 *   "Ask for a raise doesn't apply to the income. It stays flat rate"
 *
 * All four of those features worked. None of them were visible.
 */
import { companyIncomeFactors, effectiveWeeklyIncome, COMPANY_FACTOR_MAX, COMPANY_FACTOR_MIN } from '@/lib/business/hustleLogic';
import type { HustleCompanyOverlay } from '@/contexts/game/types';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const overlay = (over: Partial<HustleCompanyOverlay> = {}) => ({
  brand: { score: 50, trend: 'flat', lastUpdatedWeek: 0 },
  marketSharePercent: 0,
  hiringPipeline: { namedHires: [] },
  ...over,
}) as HustleCompanyOverlay;

describe('the company income multiplier is one shared definition', () => {
  it('a neutral company is exactly 1.0 - no free lift', () => {
    expect(companyIncomeFactors(overlay()).multiplier).toBe(1);
  });

  it('brand above 50 lifts, below 50 drags', () => {
    expect(companyIncomeFactors(overlay({ brand: { score: 100, trend: 'flat', lastUpdatedWeek: 0 } })).multiplier)
      .toBeGreaterThan(1);
    expect(companyIncomeFactors(overlay({ brand: { score: 0, trend: 'flat', lastUpdatedWeek: 0 } })).multiplier)
      .toBeLessThan(1);
  });

  it('market share lifts income - the reported "shares do not effect anything"', () => {
    // The player's evidence was two restaurants at 10.8% and 32.9% share
    // showing identical revenue. With the shared helper they cannot.
    const low = effectiveWeeklyIncome(100_000, overlay({ marketSharePercent: 10.8 }));
    const high = effectiveWeeklyIncome(100_000, overlay({ marketSharePercent: 32.9 }));

    expect(high).toBeGreaterThan(low);
  });

  it('an acquisition raises share, so it raises income', () => {
    // `acceptAcquisition` adds `synergyBonusPercent / 4` to marketSharePercent.
    const before = effectiveWeeklyIncome(100_000, overlay({ marketSharePercent: 20 }));
    const after = effectiveWeeklyIncome(100_000, overlay({ marketSharePercent: 25 }));

    expect(after).toBeGreaterThan(before);
  });

  it('named hires move it too - the reported "key hires do not effect anything"', () => {
    const none = companyIncomeFactors(overlay()).multiplier;
    const strong = companyIncomeFactors(overlay({
      hiringPipeline: {
        namedHires: [{ candidateId: 'a', hiredWeek: 0, role: 'engineer', salary: 2000, morale: 90, performance: 100 }],
      },
    } as never)).multiplier;

    expect(strong).toBeGreaterThan(none);
  });

  it('stays inside the documented clamp, and says when it clamped', () => {
    const maxed = companyIncomeFactors(overlay({
      brand: { score: 100, trend: 'flat', lastUpdatedWeek: 0 },
      marketSharePercent: 85,
    }));

    expect(maxed.multiplier).toBeLessThanOrEqual(COMPANY_FACTOR_MAX);
    expect(maxed.multiplier).toBeGreaterThanOrEqual(COMPANY_FACTOR_MIN);
    expect(maxed.clamped).toBe(true);
  });

  it('an absent overlay is neutral, never zero (the control)', () => {
    // Older saves have no overlay. Returning 0 here would zero every company's
    // income — a far worse bug than the one being fixed.
    expect(companyIncomeFactors(undefined).multiplier).toBe(1);
    expect(effectiveWeeklyIncome(50_000, undefined)).toBe(50_000);
  });
});

describe('the payout and the UI read the SAME multiplier', () => {
  it('passiveIncome calls the shared helper rather than inlining the maths', () => {
    // The whole point. A UI that recomputed this independently would drift,
    // which is one layer up from the bug being fixed.
    const src = code('lib/economy/passiveIncome.ts');
    expect(src).toMatch(/companyIncomeFactors\(overlay\)/);
    expect(src).not.toMatch(/rawFactor = 1 \+ \(brandScore - 50\)/);
  });

  it('the company tile shows effective income, not the stored base', () => {
    // 2026-08-21: the tile now takes the tick's OWN per-company figure
    // (`companyWeeklyIncomeFor`, passed down by the dashboard, which holds the
    // GameState the full chain needs) and keeps the overlay-only expression as
    // the fallback for a caller that has no state to hand. Either way it must
    // never print the raw stored base.
    const src = code('components/mobile/Hustle/components/CompanyTile.tsx');
    expect(src).toMatch(/companyIncomeFactors\(overlay\)/);
    expect(src).toMatch(/Math\.round\(stored \* factors\.multiplier\)/);
    expect(src).toMatch(/weekly: weeklyProp/);
    const dash = code('components/mobile/Hustle/screens/DashboardScreen.tsx');
    expect(dash).toMatch(/weekly=\{companyWeeklyIncomeFor\(gameState, c, 1\)\}/);
  });

  it('and so does the detail screen, with the lift attributed', () => {
    const src = code('components/mobile/Hustle/screens/CompanyDetailScreen.tsx');
    expect(src).toMatch(/companyIncomeFactors\(overlay\)/);
    expect(src).toMatch(/companyWeeklyIncomeFor\(gameState, company, 1\)/);
    // The breakdown is what turns "revenue went up" into "the acquisition did it".
    expect(src).toMatch(/factors\.brand/);
    expect(src).toMatch(/factors\.share/);
    expect(src).toMatch(/factors\.hires/);
  });
});

describe('the dead "Cash" metric is gone', () => {
  // `createCompany` never sets `money` and nothing writes it afterwards, so
  // every company rendered CASH $0 for its entire life. Payroll is real, and
  // it is the cost side of the hires that lift the multiplier.
  it('neither hustle surface reads company.money any more', () => {
    for (const rel of [
      'components/mobile/Hustle/components/CompanyTile.tsx',
      'components/mobile/Hustle/screens/CompanyDetailScreen.tsx',
    ]) {
      expect(code(rel)).not.toMatch(/company\.money/);
    }
  });

  it('company creation still does not invent a treasury (the control)', () => {
    // The alternative fix — making company cash real — would mean rerouting
    // every campaign, salary and upgrade through a second wallet. Not done, so
    // nothing should be quietly writing this field either.
    expect(code('contexts/game/company.ts')).not.toMatch(/^\s*money: \d/m);
  });
});

describe('a negotiated raise is visible on the career card', () => {
  const src = code('components/CareerPathCard.tsx');

  it('every salary shown is multiplied by raiseMultiplier', () => {
    // The raise was always applied at payout
    // (`applyCareerSalaryAndPenalty.ts`, `salary * raisePremium`) — but NO
    // component read `raiseMultiplier`, so the number never moved.
    expect(src).toMatch(/career\.raiseMultiplier/);
    // `paidSalary` now takes a level INDEX and resolves the whole paycheck
    // stack through `paidWeeklySalaryForLevel` — the premium was only part of
    // what this card was missing (2026-08-22 "conflicting numbers" report).
    expect(src).toMatch(/paidSalary\(career\.level\)/);
    expect(src).toMatch(/paidWeeklySalaryForLevel/);
    expect(src).not.toMatch(/\$\{currentLevel\?\.salary\}\/wk/);
  });

  it('clamps the premium the same way the payout does (the control)', () => {
    // The intent here was always right — a display that clamped differently
    // from the payout would promise a salary the tick refuses to pay. But this
    // originally pinned `Math.max(1, Math.min(3, …))`, agreeing with the weekly
    // payout against a ceiling of 3 that `requestRaise` never grants: the
    // writer caps at RAISE_PREMIUM_CAP = 2. Four sites held four opinions.
    //
    // Asserting a shared helper instead of a literal is what makes the control
    // hold: the number can now only be changed in one place, so display and
    // payout cannot drift apart again without this failing.
    // See __tests__/economy/raisePremiumConsistency.test.ts.
    expect(src).toMatch(/resolveRaisePremium\(career\.raiseMultiplier\)/);
    expect(src).toMatch(/from '@\/lib\/careers\/raisePremium'/);
    expect(src).not.toMatch(/Math\.min\(3,/);
  });
});

describe('the cure modal reports THIS treatment only', () => {
  const src = code('contexts/game/ItemActionsContext.tsx');

  it('curedDiseases holds the current visit, not the lifetime list', () => {
    // "When fixing a current ailment, all previous ailments are mentioned" —
    // one treatment rendered "CURED · 9".
    expect(src).toMatch(/curedDiseases: Array\.from\(new Set\(curedDiseases\)\)/);
    expect(src).not.toMatch(/updatedCuredDiseases/);
  });

  it('the lifetime tally still exists elsewhere (the control)', () => {
    // Narrowing the field is only safe because the running total lives in
    // diseaseHistory. If that went too, this would be data loss.
    expect(src).toMatch(/totalCured/);
  });
});

describe('auto-repair explains itself', () => {
  const src = code('components/computer/BitcoinMiningApp.tsx');

  it('states what will happen on the next tick', () => {
    // "Auto repair in the crypto page does not work." It does — but only for
    // rigs under 50%, and only as far as the funding coin stretches. With a
    // zero balance it repaired nothing and said nothing.
    expect(src).toMatch(/autoRepairStatus/);
    expect(src).toMatch(/no rig is under 50% health yet/);
    expect(src).toMatch(/you hold no \$\{autoRepairCryptoId\.toUpperCase\(\)\} to pay with/);
  });

  it('no longer promises an unconditional restore to 100%', () => {
    // The old caption said rigs "are restored to 100%", which is only true
    // when the balance covers the whole bill.
    expect(src).not.toMatch(/are restored to 100%/);
  });
});
