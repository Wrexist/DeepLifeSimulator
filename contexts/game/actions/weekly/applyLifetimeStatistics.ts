/**
 * Weekly lifetimeStatistics accumulator — R7 Phase 2 step 2.9.
 *
 * Scope: previously inline in `GameActionsContext.tsx:1412-1465` (~53 lines)
 * as a giant nested ternary inside the final state-merge object. Eight
 * accumulator fields that had been "frozen" for releases before R7
 * because no callsite wired them — preserved verbatim now.
 *
 * Accumulators:
 *   1. totalJailTime — `+1` per week the player was already in jail at
 *      tick start (`prevState.jailWeeks > 0`).
 *   2. totalChildren — `+newBornChildren.length` for the births this tick.
 *   3. totalWeeksWorked — `+1` when the week was paid work (career salary, or
 *      political office pay, which is carried separately — see the input doc).
 *   4. highestSalary — `max(existing, effectiveSalary)`.
 *   5. careerHistory — finds the FIRST open entry (no endWeek) for
 *      `prevState.currentJob` and accumulates this week's earnings + 1
 *      week. Only updates one entry even if multiple match.
 *   6. peakNetWorth — `max(existing, safeNetWorth)`.
 *   7. peakNetWorthWeek — set to `nextWeeksLived` ONLY when a strictly-greater
 *      net worth was set this tick. Otherwise unchanged.
 *   8. netWorthHistory + weeklyEarningsHistory — appends a sample EVERY
 *      10 weeks (when `nextWeeksLived % 10 === 0`), capped at 100 entries
 *      by `slice(-99)` THEN appending one new sample.
 *
 * The "no lifetimeStatistics slice" path passes through `undefined`
 * verbatim — caller writes whatever they had (preserves opt-in
 * semantics; some old saves may never have had it).
 *
 * Pure. No deps beyond the type.
 *
 * Returns:
 *   - `updatedLifetimeStatistics` — written to gameState.lifetimeStatistics later.
 */

import type { GameState, LifetimeStatistics } from '@/contexts/game/types';

export interface LifetimeStatisticsInput {
  prevState: GameState;
  /** `prevState.jailWeeks > 0 ? 1 : 0` — caller already knows the gate but
   * we read from prevState directly to keep the helper testable in isolation. */
  newBornChildrenCount: number;
  /**
   * Relationship count AFTER this week's changes. Optional — when absent the
   * growth term is 0, so a caller that has not been updated cannot corrupt the
   * counter. R3-F4.
   */
  nextRelationshipCount?: number;
  careerSalary: number;
  /**
   * Weekly pay from holding political office, 0 when not in office.
   *
   * Political pay is deliberately NOT part of `careerSalary`:
   * `applyCareerSalaryAndPenalty` returns 0 while `currentJob === 'political'`
   * because the money is owned by `lib/economy/passiveIncome.ts` (one owner per
   * income stream). But every work accumulator below gated on `careerSalary`,
   * so a career politician accrued ZERO totalWeeksWorked, never moved
   * highestSalary, and got no careerHistory entry — which `computePension`
   * reads, so they retired on a $0 pension. Passing the political figure
   * separately keeps the money ownership rule intact while letting the
   * bookkeeping see the work. MUST be the WEEKLY figure
   * (`salary / WEEKS_PER_YEAR`), never the raw annual one — the pension is
   * computed off `highestSalary`, so an annual number there is a 52x pension.
   * 2026-07-28 audit GL-3.
   */
  politicalWeeklySalary?: number;
  /** From preTick.computeDecayInputs — clamped net worth used as a
   * tradeoff between "real" peaks and avoiding overflow on huge stocks. */
  safeNetWorth: number;
  totalIncome: number;
  nextWeeksLived: number;
}

export interface LifetimeStatisticsResult {
  updatedLifetimeStatistics: LifetimeStatistics | undefined;
}

const HISTORY_SAMPLE_INTERVAL_WEEKS = 10;
const HISTORY_MAX_LENGTH = 100; // slice(-99) then push one → 100 max.

export function applyLifetimeStatistics(input: LifetimeStatisticsInput): LifetimeStatisticsResult {
  const ls = input.prevState.lifetimeStatistics;
  if (!ls) {
    return { updatedLifetimeStatistics: ls };
  }

  const jailedThisWeek = (input.prevState.jailWeeks || 0) > 0;
  // Either kind of paid work counts as work.
  const politicalWeeklySalary =
    typeof input.politicalWeeklySalary === 'number' && isFinite(input.politicalWeeklySalary)
      ? Math.max(0, input.politicalWeeklySalary)
      : 0;
  const effectiveSalary = input.careerSalary > 0 ? input.careerSalary : politicalWeeklySalary;
  const workedThisWeek = effectiveSalary > 0;
  const prevPeakNetWorth = ls.peakNetWorth ?? 0;
  const newPeakSet = input.safeNetWorth > prevPeakNetWorth;

  const careerHistory = updateCareerHistory(
    ls.careerHistory || [],
    input.prevState.currentJob,
    effectiveSalary,
    currentJobTitle(input.prevState),
  );

  const shouldSampleHistory = input.nextWeeksLived % HISTORY_SAMPLE_INTERVAL_WEEKS === 0;
  const netWorthHistory = shouldSampleHistory
    ? [
        ...(ls.netWorthHistory ?? []).slice(-(HISTORY_MAX_LENGTH - 1)),
        { week: input.nextWeeksLived, value: input.safeNetWorth },
      ]
    : (ls.netWorthHistory ?? []);
  const weeklyEarningsHistory = shouldSampleHistory
    ? [
        ...(ls.weeklyEarningsHistory ?? []).slice(-(HISTORY_MAX_LENGTH - 1)),
        { week: input.nextWeeksLived, value: input.totalIncome },
      ]
    : (ls.weeklyEarningsHistory ?? []);

  /**
   * Growth in the relationship list this tick (R3-F4). `prevState` holds the
   * count before the week's changes; `input.nextRelationshipCount` is what the
   * caller has just produced.
   */
  const relationshipGrowth =
    (input.nextRelationshipCount ?? (input.prevState.relationships ?? []).length) -
    (input.prevState.relationships ?? []).length;

  return {
    updatedLifetimeStatistics: {
      ...ls,
      totalJailTime: (ls.totalJailTime ?? 0) + (jailedThisWeek ? 1 : 0),
      totalChildren: (ls.totalChildren ?? 0) + input.newBornChildrenCount,
      /**
       * R3-F4: `totalRelationships` had NO writer in shipping code.
       * `trackNewRelationship` exists but its only caller is a stress test, and
       * this accumulator incremented `totalChildren` and `totalWeeksWorked`
       * while leaving this at its seeded 0. The "Social Network — form 25 total
       * relationships in your lifetime" achievement reads
       * `gs.lifetimeStatistics?.totalRelationships ?? gs.relationships?.length`,
       * and because the field is PRESENT as 0 the `??` chain never fell
       * through — so it sat at 0/25 forever and its 50 gold was unobtainable.
       * `StatisticsApp` also hid the Relationships row entirely on
       * `totalRelationships > 0`.
       *
       * Counted as the weekly GROWTH in the relationship list, so it is
       * monotonic and never decreases when someone leaves — which is what
       * "total ... in your lifetime" means. No new state: the previous count is
       * right here on `prevState`.
       */
      totalRelationships:
        (ls.totalRelationships ?? 0) + Math.max(0, relationshipGrowth),
      totalWeeksWorked: (ls.totalWeeksWorked ?? 0) + (workedThisWeek ? 1 : 0),
      highestSalary: Math.max(ls.highestSalary ?? 0, effectiveSalary),
      careerHistory,
      peakNetWorth: Math.max(prevPeakNetWorth, input.safeNetWorth),
      peakNetWorthWeek: newPeakSet
        ? input.nextWeeksLived
        : (ls.peakNetWorthWeek ?? 0),
      netWorthHistory,
      weeklyEarningsHistory,
    },
  };
}

/**
 * The title of the job being worked this week, or '' if it cannot be resolved.
 *
 * Same derivation as `getCareerName` in `lib/events/careerEvents` — the title
 * lives in `levels[level].name`, not on the career itself.
 */
function currentJobTitle(state: GameState): string {
  const careers = Array.isArray(state.careers) ? state.careers : [];
  const career = careers.find((c) => c && c.id === state.currentJob);
  const levels = Array.isArray(career?.levels) ? career.levels : [];
  if (levels.length === 0) return '';
  const safeLevel = Math.max(0, Math.min(career?.level ?? 0, levels.length - 1));
  return levels[safeLevel]?.name ?? '';
}

function updateCareerHistory(
  history: NonNullable<LifetimeStatistics['careerHistory']>,
  currentJob: GameState['currentJob'],
  careerSalary: number,
  title: string,
): NonNullable<LifetimeStatistics['careerHistory']> {
  if (!(careerSalary > 0 && currentJob)) {
    return history;
  }
  let foundOpen = false;
  return history.map((entry) => {
    if (!foundOpen && entry.job === currentJob && entry.endWeek === undefined) {
      foundOpen = true;
      return {
        ...entry,
        earnings: entry.earnings + careerSalary,
        weeks: entry.weeks + 1,
        // Stamped every paid week, so the entry always carries the LATEST title
        // held — a promotion updates it, and whatever an exit path later does to
        // `careers` cannot reach it. See `CareerHistoryEntry.title`.
        ...(title ? { title } : {}),
      };
    }
    return entry;
  });
}
