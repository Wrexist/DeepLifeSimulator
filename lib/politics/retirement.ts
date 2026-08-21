/**
 * Standing down.
 *
 * There were two ways out of political office and both were failures: lose the
 * election, or be forced to resign by a scandal. A player who had served five
 * terms as President had no way to LEAVE — only to keep running until the
 * voters or a scandal ended it for them, at which point
 * `careers.political.level` was reset to 0 and the career read as though it had
 * never happened (the bug v42's `title` field exists to paper over).
 *
 * Retiring is the third exit, and the only one the player chooses. It pays a
 * pension for the rest of the life, keeps the title, and — because it is
 * voluntary — is the exit that does NOT cost approval.
 *
 * Pure functions. No game state, no React.
 */

import { POLITICAL_CAREER } from '@/lib/careers/political';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

const safe = (n: number | undefined | null, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export interface PoliticalRetirement {
  /** `weeksLived` at which the player stood down. */
  retiredWeek: number;
  /** Office rank held at retirement, 1-based (1 = Council … 6 = President). */
  officeLevel: number;
  /** The title kept for the record — obituary, statistics, appointments. */
  title: string;
  /** Elections won over the whole career. */
  termsServed: number;
  /** Dollars per week, for life. */
  weeklyPension: number;
}

/** Terms in office before the pension is worth anything at all. */
export const MIN_TERMS_FOR_PENSION = 1;

/** Ceiling on the pension, whatever the career looked like. */
export const MAX_WEEKLY_PENSION = 6_000;

/**
 * Why retirement is refused, or `null` when the player may stand down.
 *
 * Requires actually holding office: "retiring" from a seat you do not have is
 * how a player would otherwise mint a pension out of a single won election
 * followed by an immediate exit.
 */
export function retirementBlocker(input: {
  careerLevel?: number | null;
  termsServed?: number | null;
  weeksInOffice?: number | null;
}): string | null {
  const level = Math.floor(safe(input.careerLevel, 0));
  if (level <= 0) return 'You are not currently holding office.';
  const terms = Math.floor(safe(input.termsServed, 0));
  if (terms < MIN_TERMS_FOR_PENSION) {
    return 'You need to win at least one election before you can retire on a pension.';
  }
  const weeks = safe(input.weeksInOffice, 0);
  if (weeks < WEEKS_PER_YEAR) {
    const remaining = Math.ceil(WEEKS_PER_YEAR - weeks);
    return `Serve a full year in this office first — ${remaining} week${remaining === 1 ? '' : 's'} to go.`;
  }
  return null;
}

/**
 * The pension a career earns.
 *
 * Three inputs, each of which the player controls: how high they climbed, how
 * many times the voters returned them, and what the public thought of them on
 * the way out. Approval matters least (a 0-approval President still out-earns a
 * beloved council member) but it is never nothing, which is what stops the
 * optimal play from being "ignore approval entirely once you hold a safe seat".
 */
export function calculatePension(input: {
  officeLevel?: number | null;
  termsServed?: number | null;
  approvalRating?: number | null;
}): number {
  const level = clamp(Math.floor(safe(input.officeLevel, 0)), 0, POLITICAL_CAREER.levels.length);
  if (level <= 0) return 0;

  const terms = clamp(Math.floor(safe(input.termsServed, 0)), 0, 12);
  if (terms < MIN_TERMS_FOR_PENSION) return 0;

  const approval = clamp(safe(input.approvalRating, 50), 0, 100);

  // Base scales with the office held. Council ($120/wk) → President ($2,600/wk),
  // read off the SAME ladder the salary comes from so a rebalance of one moves
  // the other rather than silently splitting them.
  const annualSalary = safe(POLITICAL_CAREER.levels[level - 1]?.salary, 0);
  const weeklySalary = annualSalary / WEEKS_PER_YEAR;
  const base = weeklySalary * 0.6;

  // Each term past the first adds 15%, capped by the clamp above.
  const termMultiplier = 1 + (terms - 1) * 0.15;

  // Approval swings the result by ±20%.
  const approvalMultiplier = 0.8 + (approval / 100) * 0.4;

  const pension = Math.round(base * termMultiplier * approvalMultiplier);
  if (!isFinite(pension) || pension <= 0) return 0;
  return Math.min(MAX_WEEKLY_PENSION, pension);
}

/**
 * The record written when a player stands down.
 *
 * `title` is captured HERE, while it is still true — the same reasoning as v42's
 * `title` on `CareerHistoryEntry`. Retiring resets `careers.political.level` to
 * 0 so lifestyle costs and the "in office?" UI stop treating a private citizen
 * as a sitting official, which means a title derived later would name whatever
 * level 0 is called.
 */
export function buildRetirement(input: {
  careerLevel: number;
  termsServed?: number | null;
  approvalRating?: number | null;
  weeksLived: number;
}): PoliticalRetirement {
  const level = clamp(Math.floor(safe(input.careerLevel, 0)), 1, POLITICAL_CAREER.levels.length);
  return {
    retiredWeek: safe(input.weeksLived, 0),
    officeLevel: level,
    title: POLITICAL_CAREER.levels[level - 1]?.name ?? 'Public Servant',
    termsServed: Math.max(0, Math.floor(safe(input.termsServed, 0))),
    weeklyPension: calculatePension({
      officeLevel: level,
      termsServed: input.termsServed,
      approvalRating: input.approvalRating,
    }),
  };
}

/**
 * The pension currently payable, read off a save.
 *
 * Degrades a missing or malformed record to $0 rather than throwing — this is
 * read from inside the weekly income path.
 */
export function readPensionWeekly(stored: unknown): number {
  if (!stored || typeof stored !== 'object') return 0;
  const pension = safe((stored as Partial<PoliticalRetirement>).weeklyPension, 0);
  if (!isFinite(pension) || pension <= 0) return 0;
  return Math.min(MAX_WEEKLY_PENSION, Math.round(pension));
}

/** The honorific a retired official keeps, or `undefined` if they never held office. */
export function retiredTitle(stored: unknown): string | undefined {
  if (!stored || typeof stored !== 'object') return undefined;
  const title = (stored as Partial<PoliticalRetirement>).title;
  return typeof title === 'string' && title.length > 0 ? title : undefined;
}
