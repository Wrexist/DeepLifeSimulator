/**
 * Career salary + per-week penalty — R7 Phase 2 step 2.5b-i.
 *
 * Scope: when the player has an accepted career, compute the weekly salary
 * (with Work Pay Boost stacking) and apply the career's weekly toll.
 * Previously inline in `GameActionsContext.tsx:476-534` (~58 lines).
 *
 * The toll comes from the career's authored profile
 * (`lib/careers/jobMarket.ts` `weeklyToll`) when one exists — energy, health
 * and happiness, the same numbers the work-tab job card shows — scaled down
 * with seniority for its negative components. Careers without a profile keep
 * the historical uniform toll (-3 happiness / -2 health, no energy).
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats.happiness` — `+ careerHappinessPenalty` (clamped 0-100)
 *   - `ctx.newStats.health`    — `+ careerHealthPenalty`    (clamped 0-100)
 *   - `ctx.newStats.energy`    — `+ careerEnergyPenalty`    (clamped 0-100)
 *
 * Returns the scalars the downstream blocks consume:
 *   - `careerSalary`            — weekly $ flowing into income aggregation
 *   - `careerHappinessPenalty` / `careerHealthPenalty` / `careerEnergyPenalty`
 *     — the applied toll (0 when unemployed; energy 0 for unprofiled careers)
 *
 * Logger calls (info + warn paths) are preserved verbatim and run inside
 * the helper. Same pattern as `preTick.calculateNetWorth` — keeping the
 * legacy log lines makes operational debugging unchanged.
 *
 * The salary arithmetic itself (raise premium, Work Pay Boost stacking, life
 * skills, DeepLife+) lives in `paidWeeklySalaryForLevel`
 * (`lib/careers/weeklySalary.ts`) so the screens that display a salary compute
 * it from the same source as the paycheck.
 */

import type { GameState } from '@/contexts/game/types';
import { paidWeeklySalaryForLevel } from '@/lib/careers/weeklySalary';
import { getEntryJobProfile } from '@/lib/careers/jobMarket';
import { logger } from '@/utils/logger';
import type { WeekContext } from './weekContext';

export interface CareerSalaryAndPenaltyResult {
  careerSalary: number;
  careerHappinessPenalty: number;
  careerHealthPenalty: number;
  /** Weekly energy cost of the job — 0 for careers without an authored profile. */
  careerEnergyPenalty: number;
}

export function applyCareerSalaryAndPenalty(
  prevState: GameState,
  ctx: WeekContext,
): CareerSalaryAndPenaltyResult {
  let careerSalary = 0;
  let careerHappinessPenalty = 0;
  let careerHealthPenalty = 0;
  let careerEnergyPenalty = 0;

  // A jailed player draws no paycheck this week. The role is still held (so the
  // stat toll below still applies), but there is no earned income while
  // incarcerated. Passive income (rent, dividends, bank interest, spouse income)
  // is unaffected and continues in the weekly tick.
  const isJailed = (prevState.jailWeeks ?? 0) > 0;

  if (prevState.currentJob) {
    // CRITICAL: Validate careers array exists before using find.
    const careers = Array.isArray(prevState.careers) ? prevState.careers : [];
    const currentCareer = careers.find((c) => c && c.id === prevState.currentJob);
    if (currentCareer && currentCareer.accepted && currentCareer.levels && currentCareer.levels.length > 0) {
      // Ensure level is within bounds.
      const safeLevel = Math.max(0, Math.min(currentCareer.level, currentCareer.levels.length - 1));
      const levelData = currentCareer.levels[safeLevel];
      // Political office income is OWNED by passiveIncome (lib/economy/passiveIncome.ts),
      // which reads POLITICAL_CAREER salaries as ANNUAL (÷ WEEKS_PER_YEAR) and gates on
      // `politics.careerLevel > 0` — so it correctly stops when office is lost. This generic
      // path treats salary as WEEKLY, so paying `political` here would (a) double-credit the
      // salary every week and (b) do so at ~52× the intended amount (annual figure paid
      // weekly → a President printing ~$100k/week that never stopped after losing office).
      // Skip the salary for political; the stat penalty below still applies.
      const isPoliticalOffice = prevState.currentJob === 'political';
      if (isPoliticalOffice) {
        logger.info('[WEEK PROGRESSION] Political salary owned by passiveIncome (annual÷52); skipping generic weekly pay to avoid double-count');
      } else if (levelData && typeof levelData.salary === 'number' && levelData.salary > 0) {
        // Salary is stored as weekly amount (e.g., 55 = $55/week). The whole
        // multiplier stack — negotiated raise premium, Work Pay Boost (gold
        // upgrade AND the $1.99 IAP perk, 1.5x each, multiplicative), the
        // Negotiation/Executive life skills, and the DeepLife+ income boost —
        // lives in `paidWeeklySalaryForLevel`.
        //
        // It is shared rather than inlined here because the screens that SHOW a
        // salary each applied a different subset of it and disagreed with the
        // paycheck and with each other: the promotion modal and the career
        // ladder applied the raise premium only, while the work-tab job card and
        // the Cash Flow panel showed the raw base. Reported as "unsure of what
        // the income is, usually the case with every job, conflicting numbers".
        // Payroll calls the same function they do, so the answer is one number.
        //
        // Wages are NOT indexed to the price index. This is deliberate, and it
        // is a correction of something I got wrong.
        //
        // When the inflation system was first wired up (it had zero callers, so
        // `priceIndex` had been frozen at 1 forever), pay was multiplied by that
        // index here, on the reasoning that rising prices with fixed wages would
        // be a pure downgrade and that indexing both made inflation "neutral in
        // real terms".
        //
        // It is not neutral, because the price half is not real. In shipping
        // code `getInflatedPrice` reaches exactly two surfaces — company founding
        // and mining upgrades. Property, vehicles, luxury, food, items and
        // education all read fixed catalogue prices. So indexing wages was a
        // compounding REAL pay rise against prices that never move: x1.35 after
        // ten years, x6.05 after sixty. Measured against the pre-change baseline
        // it turned a 7x income increase into 13x over a life.
        //
        // The honest fix is to stop paying the raise, not to fake the prices.
        // Inflation still runs and still feeds the two costs it genuinely
        // reaches; if it should move the whole catalogue one day, that is a
        // deliberate pass over every price surface, not a multiplier here.
        careerSalary = paidWeeklySalaryForLevel(prevState, currentCareer, safeLevel);

        // No earned income while incarcerated — withhold the paycheck this week.
        // The career stat toll below still applies (the role is held, not worked).
        if (isJailed) {
          careerSalary = 0;
          logger.info('[WEEK PROGRESSION] Career salary withheld this week — incarcerated');
        } else {
          logger.info(`[WEEK PROGRESSION] Career salary: $${careerSalary}/week from ${levelData.name} (level ${safeLevel + 1})`);
        }
      } else {
        logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} level ${safeLevel} has invalid salary: ${levelData?.salary}`);
      }

      // Apply career job stat penalties. BALANCE: scale the weekly toll DOWN by
      // seniority — an entry role grinds but a top-of-ladder role is far
      // lighter. This rewards career progression and makes holding a career
      // more attractive than perpetually grinding street jobs (which pay an
      // unemployed bonus).
      const levelCount = currentCareer.levels.length;
      const levelProgress = levelCount > 1 ? Math.min(1, Math.max(0, safeLevel / (levelCount - 1))) : 0;
      const penaltyFactor = 1 - 0.7 * levelProgress; // 1.0 at entry → 0.3 at the top

      // ADVERTISED VS ACTUAL (2026-08-24 audit): `lib/careers/jobMarket.ts`
      // authors a per-career `weeklyToll` (energy, health, happiness) and the
      // work-tab job card RENDERS it — "-8 energy/wk" on the musician — but the
      // tick applied the same uniform -3 happiness / -2 health to every career
      // and no energy cost at all. So the one mechanism that could make a
      // low-paying job a real choice (musician: light, happy, fast ladder vs
      // farmer: heavy grind) was dead data, and the highest-salary job strictly
      // dominated. The authored toll is now charged for the entry-tier careers
      // that declare one:
      //   - NEGATIVE components scale down with seniority exactly like the old
      //     uniform toll (the grind lightens as you climb; floor -1),
      //   - POSITIVE components (the musician's +4 happiness) apply as
      //     authored at every rung — the joy of the craft is not a grind,
      //   - components a profile leaves unstated fall back to the uniform
      //     figures (-3 happiness / -2 health), so a partial profile is not a
      //     stealth buff.
      // Careers WITHOUT a profile (advanced tier, political, legacy saves'
      // customs) keep exactly the old numbers — pinned by the equivalence
      // snapshots. The card shows the entry-level toll, which is exactly what
      // a new hire is charged (penaltyFactor = 1 at level 0).
      const profile = getEntryJobProfile(currentCareer.id);
      const scaledToll = (authored: number): number =>
        authored >= 0
          ? Math.round(authored)
          : -Math.max(1, Math.round(-authored * penaltyFactor));
      if (profile) {
        careerHappinessPenalty = scaledToll(profile.weeklyToll.happiness ?? -3);
        careerHealthPenalty = scaledToll(profile.weeklyToll.health ?? -2);
        careerEnergyPenalty = scaledToll(profile.weeklyToll.energy);
      } else {
        careerHappinessPenalty = -Math.max(1, Math.round(3 * penaltyFactor));
        careerHealthPenalty = -Math.max(1, Math.round(2 * penaltyFactor));
        careerEnergyPenalty = 0;
      }
      logger.info(`[WEEK PROGRESSION] Career toll (level ${safeLevel + 1}/${levelCount}): ${careerHappinessPenalty} happiness, ${careerHealthPenalty} health, ${careerEnergyPenalty} energy`);
    } else {
      if (!currentCareer) {
        logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} not found in careers list`);
      } else if (!currentCareer.accepted) {
        logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} is not accepted (applied: ${currentCareer.applied})`);
      } else if (!currentCareer.levels || currentCareer.levels.length === 0) {
        logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} has no levels`);
      }
    }
  } else {
    logger.info(`[WEEK PROGRESSION] No current job (currentJob: ${prevState.currentJob})`);
  }

  // Apply the career toll to stats (in addition to natural decay). Positive
  // components (a profiled career whose work is itself a lift, e.g. the
  // musician's +4 happiness) apply through the same clamp.
  if (careerHappinessPenalty !== 0) {
    ctx.newStats.happiness = Math.max(0, Math.min(100, ctx.newStats.happiness + careerHappinessPenalty));
  }
  if (careerHealthPenalty !== 0) {
    ctx.newStats.health = Math.max(0, Math.min(100, ctx.newStats.health + careerHealthPenalty));
  }
  if (careerEnergyPenalty !== 0) {
    ctx.newStats.energy = Math.max(0, Math.min(100, ctx.newStats.energy + careerEnergyPenalty));
  }

  return { careerSalary, careerHappinessPenalty, careerHealthPenalty, careerEnergyPenalty };
}
