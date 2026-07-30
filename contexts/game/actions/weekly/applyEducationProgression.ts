/**
 * Per-education weekly progression — R7 Phase 2 step 2.5c-ii.
 *
 * Scope: the `.map()` over each enrolled, non-paused, non-completed
 * education. Previously inline in `GameActionsContext.tsx:577-667`
 * (~90 lines). Six sub-concerns per education:
 *
 *   1. Decrement `weeksRemaining` (with Fast Learner perk × 1.5 stack).
 *   2. Study group: +2 happiness, -3 energy (per education with active group).
 *   3. Student loan: deduct `weeklyPayment` (capped at `remaining`) from money.
 *   4. Exam (`isExamWeek`): roll `runExam` → bump pass/fail counters, update
 *      GPA via `updateGPA`, apply stat deltas, push notification.
 *   5. Campus event (`shouldTriggerCampusEvent`): set `lastCampusEventWeek`,
 *      flag `pendingCampusEvent = edu.id` for the UI.
 *   6. Completion bonuses (when `weeksRemaining` hits 0): apply each
 *      enrolled class's `statBonuses`, push completion notification.
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats.{happiness, energy, money, health, fitness, reputation}`
 *     across the six sub-paths.
 *   - `ctx.notifications.push(...)` for exam result and completion.
 *
 * External dependencies (used 1:1 from the legacy inline code):
 *   - `isExamWeek`, `runExam`, `updateGPA`, `shouldTriggerCampusEvent`
 *     from `@/lib/education/educationSystem`. `runExam` and
 *     `shouldTriggerCampusEvent` accept an optional seeded roll; this tick
 *     threads a per-week `makeWeeklyRoll(weeksLived)` stream keyed by
 *     education id, so exam/campus outcomes are deterministic (resume-safe,
 *     StrictMode-consistent) rather than raw `Math.random()`.
 *
 * Returns:
 *   - `updatedEducations` — new array with all per-education mutations.
 *   - `pendingCampusEvent` — education ID when an event fired this tick,
 *     `undefined` otherwise. Last fire wins (matches legacy `.map()` behavior).
 *
 * If `pendingCampusEvent` would be set by multiple educations in the
 * same tick, the LAST one in array order wins (legacy `let` reassignment).
 */

import type { Education } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import {
  isExamWeek,
  runExam,
  updateGPA,
  shouldTriggerCampusEvent,
  computeSemesterNumber,
} from '@/lib/education/educationSystem';
import { makeWeeklyRoll } from '@/utils/seededRoll';
import type { WeekContext } from './weekContext';

export interface EducationProgressionInput {
  prevEducations: Education[];
  nextWeeksLived: number;
  /** `prevState.goldUpgrades?.fast_learner` truthy. */
  goldFastLearner: boolean;
  /** `prevState.perks?.fastLearner` truthy. */
  perkFastLearner: boolean;
  /**
   * `getExperienceMultiplier(prevState.prestige?.unlockedBonuses)` — 1.0 when
   * nothing is unlocked.
   *
   * Five prestige-shop entries feed this: Quick Learner (1,500 pts x3), Fast
   * Learner (5,000 x3), Genius Learner (20,000 x3), the legendary `genius`
   * (35,000, "+100% learning speed") and the `synergy_learning_master` synergy.
   * `getExperienceMultiplier` had NO call sites anywhere in the repo — it was
   * imported once, in MoneyActionsContext, and the identifier never appears
   * again in that file. So every one of those was bought with prestige points
   * and did nothing, while `PrestigeInfoModal` printed the advertised
   * percentage. 2026-07-30 audit GL-1.
   */
  experienceMultiplier?: number;
}

export interface EducationProgressionResult {
  updatedEducations: Education[];
  /** ID of the education that triggered a campus event this tick (undefined when none). */
  pendingCampusEvent: string | undefined;
}

/**
 * Does this education need a weekly progression tick?
 *
 * True for any ENROLLED-but-unfinished program: not `completed`, with a finite
 * numeric `weeksRemaining`, and either not `paused` OR already at
 * `weeksRemaining <= 0`. Crucially this INCLUDES `weeksRemaining <= 0` — a
 * program the Study button (`applyStudySession`) drove to 0 without finalizing,
 * or an exhausted/corrupt save — because such a program still needs THIS tick to
 * graduate it (flip `completed`, apply enrolled-class stat bonuses, push the
 * "🎓 Completed!" toast). A PAUSED 0-week program qualifies too: a 0-week program
 * has nothing left to pause, so pausing it must not strand it un-finalized — but a
 * paused program with weeks still remaining stays frozen. `NaN`/`undefined`
 * weeksRemaining are treated as not-tickable (skipped), matching the prior `>= 0`
 * guard.
 *
 * SINGLE SOURCE OF TRUTH shared by (a) the per-education `.map` guard below and
 * (b) the weekly-tick gate in `GameActionsContext`. That gate PREVIOUSLY reused
 * the education-STRESS active count (`weeksRemaining > 0`), which excludes a
 * 0-week program — so a Study-button-finished education was never handed to this
 * reducer and stranded at progress 100 / 0w / "IN PROGRESS" forever, permanently
 * locking company founding (`educations.find(e => e.id === 'entrepreneurship')
 * ?.completed` stayed false). Returning a type predicate also narrows
 * `weeksRemaining` to `number` inside the guarded block.
 */
export function needsEducationProgressionTick(
  edu: Education | undefined | null,
): edu is Education & { weeksRemaining: number } {
  return (
    !!edu &&
    !edu.completed &&
    typeof edu.weeksRemaining === 'number' &&
    Number.isFinite(edu.weeksRemaining) &&
    // Paused programs freeze — EXCEPT one already drained to 0 (or below): a
    // 0-week program has nothing left to pause, so it must still be finalized
    // (flip `completed`, apply enrolled-class bonuses, push the "🎓 Completed!"
    // toast). Without this, a program studied to 0 via the Study button and THEN
    // paused strands at 100% / 0w / "IN PROGRESS" forever — withholding completion
    // bonuses and locking company founding (which reads `entrepreneurship.completed`).
    // A paused program with weeks still remaining stays frozen, as before. The
    // typeof/finite checks above already narrowed `weeksRemaining` to a number.
    (!edu.paused || edu.weeksRemaining <= 0)
  );
}

export function applyEducationProgression(
  input: EducationProgressionInput,
  ctx: WeekContext,
): EducationProgressionResult {
  // Fast Learner perk + gold upgrade speed up the decrement, and so do the
  // prestige learning bonuses (see `experienceMultiplier`).
  let educationSpeedMultiplier = 1;
  if (input.goldFastLearner) educationSpeedMultiplier *= 1.5;
  if (input.perkFastLearner) educationSpeedMultiplier *= 1.5;
  const experienceMult = Number(input.experienceMultiplier);
  if (Number.isFinite(experienceMult) && experienceMult > 1) {
    educationSpeedMultiplier *= experienceMult;
  }
  const educationDecrement = Math.max(1, Math.ceil(educationSpeedMultiplier));

  let pendingCampusEvent: string | undefined;

  // Seeded per-week roll stream (keyed on weeksLived + educationId) so exam
  // outcomes and campus-event triggers are deterministic across engines/reloads
  // and consistent under StrictMode double-invoke — instead of raw Math.random()
  // inside runExam / shouldTriggerCampusEvent.
  const weeklyRoll = makeWeeklyRoll(input.nextWeeksLived);

  // Defensive `|| []` like every sibling weekly helper — a stale save could
  // omit `educations`, and an unguarded .map() throws inside the weekly tick.
  const updatedEducations = (input.prevEducations || []).map((edu) => {
    // Shared gate (see `needsEducationProgressionTick`): includes
    // `weeksRemaining <= 0`, so a program the Study button already drove to 0 —
    // or an exhausted/corrupt save — is finalized here (completion flag,
    // enrolled-class stat bonuses, and the "🎓 Completed!" toast) instead of
    // stranding at 100% / 0w / "IN PROGRESS". Study leaves `completed` false
    // precisely so the tick does this once, in one place.
    if (needsEducationProgressionTick(edu)) {
      const newWeeksRemaining = Math.max(0, edu.weeksRemaining - educationDecrement);
      const isCompleted = newWeeksRemaining === 0;

      if (isCompleted) {
        logger.info(`[WEEK PROGRESSION] Education completed: ${edu.name || edu.id}`);
      }

      const updatedEdu: Education = {
        ...edu,
        weeksRemaining: newWeeksRemaining,
        completed: isCompleted,
        // Advance the semester purely from progress (idempotent, pause-safe):
        // paused/completed programs are skipped by the outer guard so their
        // semesterNumber freezes at its last value.
        semesterNumber: computeSemesterNumber(edu.duration, newWeeksRemaining),
      };

      // Study group weekly bonuses.
      if (edu.studyGroupActive) {
        ctx.newStats.happiness = Math.min(100, ctx.newStats.happiness + 2);
        ctx.newStats.energy = Math.max(0, ctx.newStats.energy - 3);
      }

      // Student loan weekly payment.
      if (edu.studentLoan && edu.studentLoan.remaining > 0) {
        const payment = Math.min(edu.studentLoan.weeklyPayment, edu.studentLoan.remaining);
        ctx.newStats.money = Math.max(0, ctx.newStats.money - payment);
        updatedEdu.studentLoan = {
          ...edu.studentLoan,
          remaining: Math.max(0, edu.studentLoan.remaining - payment),
        };
      }

      // Exam check (every ~13 weeks).
      if (isExamWeek(edu, input.nextWeeksLived)) {
        // Life Skills: Critical Thinking / Memory Palace / Polymath raise the
        // exam pass chance (bounded). Neutral 0 when nothing unlocked / old save.
        const examBonus = ctx.lifeSkillMods?.examPassBonus ?? 0;
        const examResult = runExam(
          edu,
          ctx.newStats.energy,
          !!edu.studyGroupActive,
          examBonus,
          (label) => weeklyRoll(`exam:${edu.id}:${label}`),
        );
        updatedEdu.lastExamWeek = input.nextWeeksLived;
        updatedEdu.examsPassed = (edu.examsPassed || 0) + (examResult.passed ? 1 : 0);
        updatedEdu.examsFailed = (edu.examsFailed || 0) + (examResult.passed ? 0 : 1);
        const totalExams = (updatedEdu.examsPassed || 0) + (updatedEdu.examsFailed || 0);
        updatedEdu.gpa = updateGPA(edu.gpa || 2.5, totalExams, examResult.gpaChange);

        // Apply exam stat effects.
        if (examResult.statChanges.happiness) {
          ctx.newStats.happiness = Math.max(0, Math.min(100, ctx.newStats.happiness + examResult.statChanges.happiness));
        }
        if (examResult.statChanges.energy) {
          ctx.newStats.energy = Math.max(0, Math.min(100, ctx.newStats.energy + examResult.statChanges.energy));
        }
        if (examResult.statChanges.reputation) {
          ctx.newStats.reputation = Math.max(0, Math.min(100, ctx.newStats.reputation + examResult.statChanges.reputation));
        }

        ctx.notifications.push({
          id: 'education-exam',
          message: `${examResult.grade} — ${examResult.message}`,
          title: `📝 Exam in ${edu.name}`,
        });
      }

      // Campus event check (random, every 4-8 weeks).
      if (shouldTriggerCampusEvent(edu, input.nextWeeksLived, weeklyRoll(`campus:${edu.id}`))) {
        updatedEdu.lastCampusEventWeek = input.nextWeeksLived;
        // Campus events are handled via pending events in the UI.
        // Store a flag for the UI to pick up.
        pendingCampusEvent = edu.id;
      }

      // Apply class stat bonuses on completion.
      if (isCompleted && edu.enrolledClasses) {
        for (const cls of edu.enrolledClasses) {
          if (cls.statBonuses) {
            if (cls.statBonuses.health) ctx.newStats.health = Math.min(100, ctx.newStats.health + cls.statBonuses.health);
            if (cls.statBonuses.happiness) ctx.newStats.happiness = Math.min(100, ctx.newStats.happiness + cls.statBonuses.happiness);
            if (cls.statBonuses.energy) ctx.newStats.energy = Math.min(100, ctx.newStats.energy + cls.statBonuses.energy);
            if (cls.statBonuses.fitness) ctx.newStats.fitness = Math.min(100, ctx.newStats.fitness + cls.statBonuses.fitness);
            if (cls.statBonuses.reputation) ctx.newStats.reputation = Math.min(100, ctx.newStats.reputation + cls.statBonuses.reputation);
          }
        }
        ctx.notifications.push({
          id: 'education-complete',
          message: `GPA: ${(updatedEdu.gpa || 2.5).toFixed(1)} — Class bonuses applied!`,
          title: `🎓 ${edu.name} Completed!`,
        });
      }

      return updatedEdu;
    }
    return edu;
  });

  return { updatedEducations, pendingCampusEvent };
}
