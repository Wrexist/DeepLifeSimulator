/**
 * Weekly income aggregation — R7 Phase 2 step 2.4a.
 *
 * Scope: composes the player's total income for the tick. Previously inline
 * in `GameActionsContext.tsx:822-879`. Six concerns rolled into one helper:
 *
 *   1. Partner/spouse income — 25% of partner.income when relationshipScore >= 50.
 *   2. Prestige income multiplier — from `getIncomeMultiplier(unlockedBonuses)`.
 *   3. Base total — careerSalary + passiveIncome + partnerIncome + pulseEarnings.
 *   4. Beginner-luck bonus — deterministic sin-seeded bonus for weeks < 20.
 *   5. Money-Multiplier gold upgrade — flat 1.5× when `goldUpgrades.multiplier`.
 *   6. Onboarding perk income multipliers — stacked product of `perk.effects.incomeMultiplier`.
 *
 * Pure function. No React, no setGameState, no side effects. Returns the
 * three intermediate values the caller's downstream blocks still need:
 *   - `partnerIncome` (used in the day-summary log line)
 *   - `baseTotalIncome` (pre-multipliers, post-luck — used in some debug paths)
 *   - `totalIncome` (post-everything — the money writeback uses this)
 *
 * Byte-identical output to the previous inline code (verified by snapshot
 * tests in `__tests__/refactor/subsystemEquivalence.test.ts`).
 */

import type { GameState } from '@/contexts/game/types';
import {
  BEGINNER_LUCK_WEEKS,
  BEGINNER_LUCK_BASE_BONUS,
  BEGINNER_LUCK_RANDOM_MAX,
  WEEKS_PER_YEAR,
} from '@/lib/config/gameConstants';
import { getIncomeMultiplier } from '@/lib/prestige/applyBonuses';
import { perks as perksCatalog } from '@/src/features/onboarding/perksData';
import { makeWeeklyRoll } from '@/utils/seededRoll';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

/**
 * Upper bound on the combined onboarding-perk income multiplier. Individual
 * perks grant ~1.02–1.10; without a cap the stacked product is unbounded and
 * can be farmed by selecting every income perk. Perks can at most double income.
 */
const MAX_PERK_INCOME_BONUS = 2.0;

/**
 * Share of the household partner's income that reaches the player each week.
 *
 * A spouse does not hand over their whole salary; a quarter of it is the
 * household contribution the economy is balanced around.
 */
export const PARTNER_INCOME_SHARE = 0.25;

/**
 * What the household partner actually contributes per week.
 *
 * THE SINGLE SOURCE for that number. `FamilyTab`'s "Family Income/wk" headline
 * used to compute its own — `spouse.income * 7`, applied to a value the spouse
 * card one line below renders as "$65000/week". A player with a $65,000/wk
 * spouse was shown $455,000/wk, and actually received $16,250. The headline
 * also added 1% of each adult child's savings, which nothing in the tick pays.
 *
 * Only ONE partner contributes (the top earner) — summing every partner over
 * the score threshold was an unbounded-income exploit.
 *
 * ── `income` IS ANNUAL. This line is where that is decided. ────────────────
 *
 * The bug this closes was a UNIT mismatch, not a formula error, which is why
 * three rounds of fixing the formula never found it. `Relationship.income` is
 * populated from exactly one place — `DATING_PROFILES` (`profile.income`,
 * copied at promotion) — and every one of those 52 numbers is an annual salary
 * written as such: Student 15,000 · Elementary Teacher 45,000 · Software
 * Engineer 75,000 · Investment Banker 150,000 · CEO & Founder 250,000. Nobody
 * intended a chef to earn $62,000 a week.
 *
 * It was nonetheless added straight into the week's income beside
 * `careerSalary`, which is genuinely weekly and runs from $110 at the bottom
 * rung to $6,000 at the top of the best ladder in the game. So promoting one
 * Spark match paid $3,750–$62,500 EVERY WEEK, forever, at a bond of 55 that a
 * promotion grants for free — ten times the best career in the game, from
 * about week 13, for a tap.
 *
 * Measured, not reasoned: the Program 11 romance persona's weekly tick delta
 * went from $110 to $15,580 on the week it promoted a match, and it finished
 * 250 weeks on $3.36M against the loner's $53k, having taken no economic
 * action at all. `tasks/social-systems-2026-09-03.md` §5.
 *
 * Dividing here rather than at the 52 data rows or at promotion is deliberate:
 * it is the one place the number becomes money, so it fixes saves that already
 * carry a partner without a migration that would have to guess whether a
 * stored `income` was annual or weekly. After it, a partner contributes
 * $72–$1,202 a week — a second earner at a quarter share, which is what the
 * constant above has always claimed to be.
 *
 * The player-facing labels were corrected with it (`ContactsApp`, `FamilyTab`
 * said "/wk"), so what the card says and what the tick pays are the same unit.
 */
export function householdPartnerIncome(
  relationships: GameState['relationships'] | undefined | null,
): number {
  let top = 0;
  for (const rel of relationships || []) {
    if (!rel || !rel.income) continue;
    if (rel.type !== 'partner' && rel.type !== 'spouse') continue;
    if ((rel.relationshipScore ?? 0) < PARTNER_INCOME_THRESHOLD) continue;
    const safeIncome =
      typeof rel.income === 'number' && isFinite(rel.income) && rel.income >= 0 ? rel.income : 0;
    if (safeIncome > top) top = safeIncome;
  }
  return Math.round((top * PARTNER_INCOME_SHARE) / WEEKS_PER_YEAR);
}

/** Minimum relationship score before a partner contributes at all. */
export const PARTNER_INCOME_THRESHOLD = 50;

export interface IncomeTickInput {
  /** Full prev state — needed for relationships, perks, goldUpgrades. */
  prevState: GameState;
  /** Career salary AFTER per-job adjustments (computed upstream). */
  careerSalary: number;
  /** Result of `calcWeeklyPassiveIncome(prevState).total`. */
  passiveIncome: number;
  /** Pulse impression + brand-deal earnings (0 if pulseTickResult is null). */
  pulseEarnings: number;
  /** Current `prevState.weeksLived || 0`. Drives the beginner-luck window. */
  weeksLivedNow: number;
  /** `prevState.prestige?.unlockedBonuses || []`. */
  unlockedBonuses: string[];
  /**
   * Macro economy income modifier from the active economy event (recession
   * 0.85, boom 1.15, crash 0.9, inflation 0.95). Previously the economy event's
   * `incomeMultiplier` was a dead field — the recession/boom banner showed but
   * never touched the paycheck. Defaults to 1.0 (no active event / no effect).
   */
  economyIncomeMultiplier?: number;
  /**
   * Weekly retirement pension (dollars) for a retired life — 0 while working.
   * Added FLAT, AFTER all multipliers, so exactly the pre-computed, bounded
   * `pensionWeekly` reaches the paycheck (no perk/prestige/economy amplification
   * and no money minted beyond the pension). Defaults to 0 → byte-identical
   * output for every non-retired tick.
   */
  retirementIncome?: number;
}

export interface IncomeTickResult {
  /** Sum of 25%-nerfed partner/spouse incomes. */
  partnerIncome: number;
  /** Career + passive + partner + pulse + beginner-luck. PRE-multipliers. */
  baseTotalIncome: number;
  /** Final rounded total after applying all multipliers. */
  totalIncome: number;
}

/**
 * Perks whose cards promise a SPECIFIC income source. Until 2026-08-23 all
 * perk `incomeMultiplier`s landed in one unscoped product over TOTAL income —
 * a `landlord` picked for a property build and a `crime_boss` picked for a
 * crime build were the same perk with different numbers, and both quietly
 * boosted salary, dividends and everything else. Each is now applied AT its
 * promised source (crime_boss: street-job payouts in JobActions; landlord:
 * rental income in applyRentAndHousing; financial_guru: the career-salary
 * term below) and EXCLUDED from the global product here, so nothing applies
 * twice. `astute_planner` stays global — its card says "+5% income".
 */
export const SOURCE_SCOPED_PERK_IDS: ReadonlySet<string> = new Set([
  'crime_boss',
  'landlord',
  'financial_guru',
]);

/** financial_guru: +7% career salary (its card's actual promise). */
export const FINANCIAL_GURU_SALARY_MULT = 1.07;

export function computeWeeklyIncome(input: IncomeTickInput): IncomeTickResult {
  // 1. Partner/spouse income (25% of the HIGHEST-earning qualifying partner).
  // EXPLOIT FIX: previously this summed 25% of EVERY partner/spouse with score
  // >= 50, so juggling several concurrent partners stacked unbounded passive
  // income. Only one household partner contributes — take the top earner.
  //
  // The share and the selection rule now live in `householdPartnerIncome`
  // below, so `FamilyTab`'s "Family Income/wk" headline reads the same number
  // this credits. It used to compute its own: `spouse.income * 7`, on a value
  // the card beside it renders as "/week" — a 7x overstatement — plus an
  // invented 1%-of-child-savings term that nothing here pays.
  const partnerIncome = householdPartnerIncome(input.prevState.relationships);

  // 2. Prestige income multiplier.
  const incomeMultiplier = getIncomeMultiplier(input.unlockedBonuses);
  const safeIncomeMultiplier = typeof incomeMultiplier === 'number' && isFinite(incomeMultiplier) && incomeMultiplier > 0
    ? incomeMultiplier
    : 1.0;

  // 3. Base total income (pre-multipliers, pre-beginner-luck).
  // financial_guru is a SOURCE-SCOPED perk: +7% on the salary term only.
  const guruSalaryMult = input.prevState.perks?.financial_guru ? FINANCIAL_GURU_SALARY_MULT : 1;
  let baseTotalIncome = Math.round(input.careerSalary * guruSalaryMult)
    + input.passiveIncome + partnerIncome + input.pulseEarnings;

  // 4. Beginner luck bonus (weeks 0-19). DETERMINISM FIX: was seeded off
  // `Math.sin(weeksLivedNow*777+42)*10000` fractional parts. ECMAScript doesn't
  // require bit-exact Math.sin, so the early paycheck could diverge between the
  // device engine (Hermes) and CI (V8). Route through the audited integer-only
  // seeded RNG (makeWeeklyRoll), keyed by the same absolute week — reproducible
  // from the save seed and engine-independent.
  //
  // The GATE counts weeks into THIS LIFE; the SEED stays on the absolute week.
  // `weeksLived` is seeded from the starting age (CLAUDE.md §4.3), so an
  // age-20 character begins at 104 and `weeksLivedNow < 20` was already false
  // before the first tick: beginner luck paid out for age-18 starts and for
  // nothing else. Measured on the real tick — an age-18 passive life gains
  // $22-34/wk for its first 20 weeks, an age-20/25/40 one gains exactly $0.
  // Prestige heirs (who start at 20) never saw it either.
  //
  // Splitting gate from seed keeps every existing paycheck reproducible: the
  // roll for a given absolute week is unchanged, only whether it is consumed.
  // A pre-v43 save has no `lifeStartWeek`, and `weeksSinceLifeStart` falls back
  // to the absolute counter there — such a save is not a first session, so the
  // window stays closed for it exactly as it is today.
  const weeksThisLife = weeksSinceLifeStart(input.weeksLivedNow, input.prevState?.lifeStartWeek);
  if (weeksThisLife < BEGINNER_LUCK_WEEKS) {
    const luckRoll = makeWeeklyRoll(input.weeksLivedNow)('beginner-luck');
    const luckBonus = BEGINNER_LUCK_BASE_BONUS + Math.floor(luckRoll * BEGINNER_LUCK_RANDOM_MAX);
    baseTotalIncome += luckBonus;
  }

  // 5. Money Multiplier gold upgrade — 1.5× when active. The Tycoon Empire
  //    upgrade doubles earnings again on top (stacks with everything), the
  //    aspirational high-gem sink.
  const moneyMultiplierBonus =
    (input.prevState.goldUpgrades?.multiplier ? 1.5 : 1) *
    (input.prevState.goldUpgrades?.tycoon ? 2 : 1);

  // 6. Onboarding perk income multipliers (stacked product).
  // Perks catalog is a static ES import (no side effects on load) — keeps the
  // weekly tick from depending on a runtime require() that could throw mid-
  // updater and silently abort the whole week's income.
  let perkIncomeBonus = 1;
  if (input.prevState.perks) {
    for (const [perkId, isActive] of Object.entries(input.prevState.perks)) {
      if (!isActive) continue;
      // Source-scoped perks are paid at their source, never here (see
      // SOURCE_SCOPED_PERK_IDS above) — including one in both places would
      // double-apply it.
      if (SOURCE_SCOPED_PERK_IDS.has(perkId)) continue;
      const perk = perksCatalog.find((p) => p.id === perkId);
      const mult = perk?.effects?.incomeMultiplier;
      if (typeof mult === 'number' && mult > 0 && mult !== 1) {
        perkIncomeBonus *= mult;
      }
    }
    // Stacked perk multipliers are otherwise unbounded; cap the combined bonus
    // so income can at most double from perks (individual perks are ~1.02–1.10).
    perkIncomeBonus = Math.min(perkIncomeBonus, MAX_PERK_INCOME_BONUS);
  }

  // 7. Macro economy modifier — recession/crash shrink the paycheck, a boom
  // lifts it. Sanitized; a missing/garbage value falls back to 1.0 (no effect).
  const rawEconMult = input.economyIncomeMultiplier;
  const safeEconMult = typeof rawEconMult === 'number' && isFinite(rawEconMult) && rawEconMult > 0
    ? rawEconMult
    : 1.0;

  // 8. Retirement pension — added FLAT after all multipliers so exactly the
  // pre-computed, bounded weekly pension reaches the paycheck (no amplification,
  // no minting). Sanitized to a finite, non-negative number.
  const rawRetirement = input.retirementIncome;
  const safeRetirementIncome = typeof rawRetirement === 'number' && isFinite(rawRetirement) && rawRetirement > 0
    ? rawRetirement
    : 0;

  const totalIncome = Math.round(
    baseTotalIncome * safeIncomeMultiplier * moneyMultiplierBonus * perkIncomeBonus * safeEconMult,
  ) + safeRetirementIncome;

  return { partnerIncome, baseTotalIncome, totalIncome };
}
