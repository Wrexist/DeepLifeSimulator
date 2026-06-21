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
 *     `shouldTriggerCampusEvent` internally call `Math.random()` —
 *     non-deterministic by design. Tests mock the module.
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
} from '@/lib/education/educationSystem';
import type { WeekContext } from './weekContext';

export interface EducationProgressionInput {
  prevEducations: Education[];
  nextWeeksLived: number;
  /** `prevState.goldUpgrades?.fast_learner` truthy. */
  goldFastLearner: boolean;
  /** `prevState.perks?.fastLearner` truthy. */
  perkFastLearner: boolean;
}

export interface EducationProgressionResult {
  updatedEducations: Education[];
  /** ID of the education that triggered a campus event this tick (undefined when none). */
  pendingCampusEvent: string | undefined;
}

export function applyEducationProgression(
  input: EducationProgressionInput,
  ctx: WeekContext,
): EducationProgressionResult {
  // Fast Learner perk + gold upgrade speed up the decrement.
  let educationSpeedMultiplier = 1;
  if (input.goldFastLearner) educationSpeedMultiplier *= 1.5;
  if (input.perkFastLearner) educationSpeedMultiplier *= 1.5;
  const educationDecrement = Math.max(1, Math.ceil(educationSpeedMultiplier));

  let pendingCampusEvent: string | undefined;

  // Defensive `|| []` like every sibling weekly helper — a stale save could
  // omit `educations`, and an unguarded .map() throws inside the weekly tick.
  const updatedEducations = (input.prevEducations || []).map((edu) => {
    if (edu && !edu.completed && !edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0) {
      const newWeeksRemaining = Math.max(0, edu.weeksRemaining - educationDecrement);
      const isCompleted = newWeeksRemaining === 0;

      if (isCompleted) {
        logger.info(`[WEEK PROGRESSION] Education completed: ${edu.name || edu.id}`);
      }

      const updatedEdu: Education = {
        ...edu,
        weeksRemaining: newWeeksRemaining,
        completed: isCompleted,
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
        const examResult = runExam(edu, ctx.newStats.energy, !!edu.studyGroupActive);
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
      if (shouldTriggerCampusEvent(edu, input.nextWeeksLived)) {
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
