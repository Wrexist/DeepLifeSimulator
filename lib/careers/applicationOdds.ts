/**
 * A job application's odds, in one place, and the review that rolls them.
 *
 * THE BUG (owner call, 2026-10-17)
 * --------------------------------
 * `JobActions.applyForJob` rolled the acceptance chance at apply time, and a
 * failed roll did not reject anything: the application became PENDING, and
 * `applyCareerApplications` accepted every pending application 1-2 weeks later.
 * So the only thing the roll decided was whether you started now or in a week.
 * The criminal-record penalty, the GPA multiplier, the recession's "Jobs -20%"
 * and the Networking skill all fed a number that could delay a hire and never
 * prevent one - a player at the 30-point background-check cap was hired exactly
 * as surely as a straight-A graduate.
 *
 * THE FIX
 * -------
 * A pending application is now REVIEWED on the first week it is processed:
 * `reviewJobApplication` rolls `jobApplicationOdds` on the life-seeded stream,
 * and a failed review is a rejection the player is told about (with the reason
 * and the odds) and can follow with a new application straight away. Only an
 * application that passes review goes on to the 1-2 week start date, which is
 * also what makes the mail offer letter (`lib/mail/offers.ts`) true: it is
 * generated after the tick, so it is only ever written for an application that
 * has already been approved.
 *
 * `jobApplicationOdds` is the arithmetic `JobActions.applyForJob` uses for its
 * instant-hire roll, moved here so the review cannot drift from it -
 * `__tests__/careers/applicationReview.test.ts` pins the two together.
 */

import type { Career, GameState } from '@/contexts/game/types';
import { hiringPenalty } from '@/lib/crime/criminalRecord';
import { highestGpa, jobOfferMultiplier } from '@/lib/education/gpa';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { makeLifeRoll } from '@/utils/seededRoll';
import { getJobBoard, isEntryTierCareer } from './jobMarket';

/** Acceptance chance of a first application at a neutral GPA and economy, in percent. */
export const BASE_APPLICATION_CHANCE = 50;
/**
 * The same, for the curated entry tier (`isEntryTierCareer` - fast food,
 * janitor, retail, ...). Those jobs already gate on their own stat
 * requirements (`hiringVerdict`), and the review made a 50/50 coin flip at the
 * bottom rung strand a fresh life without income: measured on the persona
 * harness, a rejected janitor application rotated off the board and the
 * average worker reached the top of the entry ladder ~20 weeks later. With the
 * apply-time roll and the review both drawing at 80, a clean first
 * application lands 96% of the time; a capped record still meets real doubt.
 */
export const ENTRY_TIER_APPLICATION_CHANCE = 80;
/** Percentage points each repeat application to the same employer adds. */
export const ATTEMPT_BONUS_POINTS = 8;
/** From this application on, the attempt ladder is replaced by the pity floor. */
export const PITY_ATTEMPT = 5;
/** The chance is clamped into this band unless the pity guarantee applies. */
export const MIN_APPLICATION_CHANCE = 10;
export const MAX_APPLICATION_CHANCE = 90;

/** Namespace of the review draw on the life-seeded weekly stream. */
export const APPLICATION_REVIEW_ROLL_KEY = 'career-application-review';

export interface JobApplicationOdds {
  /** Which employer, when known - it decides the base chance. */
  careerId?: string;
  /** Which application to this employer this is (1 = first). */
  attempt: number;
  /** Base chance before GPA, economy, attempts, record and networking. */
  baseChancePct: number;
  /** Acceptance chance in percent, 10-90, or 100 when `guaranteed`. */
  chancePct: number;
  /** Pity attempt with no background-check penalty: hired without a roll. */
  guaranteed: boolean;
  /** GPA multiplier on the base chance (0.85 below a 2.0, up to 1.30 at 4.0). */
  gpaMultiplier: number;
  /** The economy's `jobAvailability` multiplier on the base chance (1 = normal). */
  jobAvailability: number;
  /** Points added by repeat applications (0 on the first, and on pity attempts). */
  attemptBonusPct: number;
  /** Points removed by the background check (`hiringPenalty`). */
  criminalPenaltyPct: number;
  /** Points added by the Networking life skill. */
  networkingBonusPct: number;
}

const positiveOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

const clampChance = (value: number): number =>
  Math.min(MAX_APPLICATION_CHANCE, Math.max(MIN_APPLICATION_CHANCE, value));

/** The attempt number a career's stored counter stands for (at least 1). */
export function applicationAttemptOf(career: Pick<Career, 'applicationAttempts'> | null | undefined): number {
  const raw = career?.applicationAttempts;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

/**
 * The acceptance chance of the `attempt`-th application to one employer.
 *
 * The ONE formula both rolls use - `JobActions.applyForJob`'s instant hire
 * and the tick's review:
 *   chance = clamp(base x GPA x jobAvailability + 8 x (attempt - 1)
 *                  - backgroundCheck + networking, 10, 90)
 * where base is 80 for the entry tier and 50 otherwise, and from the 5th
 * attempt on the pity floor replaces the ladder:
 * 100 with no background-check penalty, else clamp(100 - penalty + networking).
 */
export function jobApplicationOdds(state: GameState, attempt: number, careerId?: string): JobApplicationOdds {
  const safeAttempt = typeof attempt === 'number' && Number.isFinite(attempt) && attempt >= 1
    ? Math.floor(attempt)
    : 1;
  const criminalPenaltyPct = hiringPenalty(state?.criminalLevel, state?.wantedLevel);
  const networkingBonusPct = getLifeSkillModifiers(state).jobApplicationBonus;
  const jobAvailability = positiveOr(Number(state?.economy?.economyEvents?.modifiers?.jobAvailability), 1);
  const gpaMultiplier = positiveOr(jobOfferMultiplier(highestGpa(state?.educations || [])), 1);

  const baseChancePct = careerId && isEntryTierCareer(careerId)
    ? ENTRY_TIER_APPLICATION_CHANCE
    : BASE_APPLICATION_CHANCE;

  const pity = safeAttempt >= PITY_ATTEMPT;
  const guaranteed = pity && criminalPenaltyPct <= 0;
  const attemptBonusPct = pity ? 0 : (safeAttempt - 1) * ATTEMPT_BONUS_POINTS;

  const chancePct = guaranteed
    ? 100
    : pity
      ? clampChance(100 - criminalPenaltyPct + networkingBonusPct)
      : clampChance(
          baseChancePct * gpaMultiplier * jobAvailability
            + attemptBonusPct
            - criminalPenaltyPct
            + networkingBonusPct,
        );

  return {
    careerId,
    attempt: safeAttempt,
    baseChancePct,
    chancePct,
    guaranteed,
    gpaMultiplier,
    jobAvailability,
    attemptBonusPct,
    criminalPenaltyPct,
    networkingBonusPct,
  };
}

export interface ApplicationReview {
  hired: boolean;
  odds: JobApplicationOdds;
  /** The draw in [0, 1), or null when the application was guaranteed. */
  roll: number | null;
}

/**
 * Decide a pending application. Pure and deterministic: the draw comes from
 * `makeLifeRoll(state, weeksLived)` keyed on the career and the attempt, so the
 * same life reviewing the same application in the same week always gets the
 * same answer (StrictMode double-invocation, reload, replay), and a different
 * life gets its own.
 */
export function reviewJobApplication(
  state: GameState,
  career: Pick<Career, 'id' | 'applicationAttempts'>,
  weeksLived: number,
): ApplicationReview {
  const odds = jobApplicationOdds(state, applicationAttemptOf(career), career.id);
  if (odds.guaranteed) return { hired: true, odds, roll: null };
  const roll = makeLifeRoll(state, weeksLived)(`${APPLICATION_REVIEW_ROLL_KEY}:${career.id}:${odds.attempt}`);
  return { hired: roll * 100 < odds.chancePct, odds, roll };
}

/**
 * Whether the player has a record they can see. Every life starts at criminal
 * level 1 (`CLEAN_CRIMINAL_LEVEL`), which neither the Work tab nor
 * `hiringPenalty` counts as a record.
 */
function hasVisibleRecord(state: GameState): boolean {
  return (state?.wantedLevel ?? 0) > 0 || (state?.criminalLevel ?? 0) > 1;
}

/**
 * Whether the player can apply to this employer again the week the answer
 * lands. Entry-tier jobs are only applicable while they are on the rotating job
 * board (the Work tab hides an entry job you have no live application with once
 * it rotates off), so a rejection that coincides with the board turning over
 * must not promise an immediate retry. Every other career stays listed.
 */
export function canReapplyAt(state: GameState, careerId: string, weeksLived: number): boolean {
  if (!isEntryTierCareer(careerId)) return true;
  return getJobBoard({ ...state, weeksLived }).some((opening) => opening.careerId === careerId);
}

/**
 * The rejection the player reads: the biggest drag they can do something about,
 * the odds that were rolled, and what a new application here would be at.
 * `canReapplyNow` (see `canReapplyAt`) decides the last sentence.
 */
export function applicationRejectionMessage(
  state: GameState,
  odds: JobApplicationOdds,
  canReapplyNow = true,
): string {
  let reason: string;
  if (odds.criminalPenaltyPct > 0 && hasVisibleRecord(state)) {
    reason = `A background check counted against you (-${odds.criminalPenaltyPct} points).`;
    if ((state?.wantedLevel ?? 0) > 0) {
      reason += ' Your wanted level drops by 1 each week you spend outside jail.';
    }
  } else if (odds.jobAvailability < 1) {
    reason = 'Employers are hiring less in this economy.';
  } else if (odds.gpaMultiplier < 1) {
    reason = 'Without a GPA of 2.0 or better on record, your odds start lower.';
  } else {
    reason = 'They went with another candidate.';
  }
  const next = jobApplicationOdds(state, odds.attempt + 1, odds.careerId).chancePct;
  const retry = canReapplyNow
    ? 'You can apply again now.'
    : 'The opening has rotated off the job board; you can apply again when it is listed.';
  return `${reason} Your odds were ${Math.round(odds.chancePct)}%; a new application here would be ${Math.round(next)}%. ${retry}`;
}

/**
 * Why the player cannot send ANY application right now, or `null` when they
 * can. These are the state gates `applyForJob` and the basic job board share;
 * `applyCareerApplications` only reviews a pending application while the
 * player holds no job and is not retired, so an application sent past one of
 * them sat "pending" forever. The advanced-career card skipped all three
 * (TAB-1): an employed CEO-hopeful was told "under review" and nothing ever
 * answered.
 */
export function applicationBlockReason(
  state: Pick<GameState, 'currentJob' | 'isRetired' | 'careers'>
): string | null {
  if (state.isRetired) return "You've retired - your pension is your income now.";
  if (state.currentJob) return 'Quit your current job to apply.';
  if ((state.careers ?? []).some((c) => c.applied && !c.accepted)) return 'Another application is pending.';
  return null;
}
