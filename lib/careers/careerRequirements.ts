/**
 * The one place a career's `requirements` block is evaluated.
 *
 * It existed in two, and they disagreed. `app/(tabs)/work.tsx` decided whether
 * the Apply button was enabled; `contexts/game/actions/JobActions.ts` decided
 * whether the application was accepted. Both checked education, both consulted
 * the `early_career_access` prestige bonus — but only work.tsx checked
 * `fitness` and `items`, and NEITHER checked `reputation`.
 *
 * The bonus is the reason this matters. "Career Connections" (5,000 points,
 * rare) is sold as **"Unlock all careers from start"**, and it lifted the
 * `education` requirement and nothing else. Of the 15 careers gated on
 * education, 8 also carry an `items` or `fitness` requirement, so a player who
 * paid for "all careers" still could not apply to over half of them — the
 * tester report of 2026-08-23. The bonus now lifts the whole requirements
 * block, which is what the shop has always promised.
 *
 * `reputation` is ENFORCED as of 2026-08-23 (owner's call — it had never been
 * gated by any build, so the two careers carrying it were reachable with zero
 * standing). The two are exactly the ones the bar is thematic for: Politician
 * (20) and Celebrity (30) — careers about being known, joinable by nobodies.
 * Both bars are easily reachable in normal play, and `early_career_access`
 * waives this like every other requirement, so nobody who paid for "all
 * careers from start" is newly locked out.
 *
 * Requirement access uses the `'x' in obj && obj.x` guard form (Hard Rule #2);
 * `CareerRequirements` has every field optional and `careerData` omits rather
 * than nulls them.
 */
import type { GameState } from '@/contexts/game/types';
import type { CareerRequirements } from '@/lib/types/requirements';

import { hasEarlyCareerAccess } from '@/lib/prestige/applyUnlocks';

export interface CareerRequirementCheck {
  /** True when every ENFORCED requirement is satisfied. */
  met: boolean;
  /** Education ids the player has not completed. Empty when early access is held. */
  missingEducation: string[];
  /** Item ids the player does not own. Empty when early access is held. */
  missingItems: string[];
  /** The fitness bar, when it is not met. Undefined when it is (or is lifted). */
  fitnessShortfall?: { required: number; actual: number };
  /** The reputation bar, when it is not met (blocking, waived by prestige). */
  reputationShortfall?: { required: number; actual: number };
  /** True when `early_career_access` waived the block. */
  waivedByPrestige: boolean;
}

/**
 * Evaluate a career's requirements against a game state.
 *
 * `requirements` is taken as a parameter rather than a whole `Career` so the
 * advanced-career and political paths can reuse it if they ever need to; the
 * common case passes `career.requirements`.
 */
export function checkCareerRequirements(
  requirements: CareerRequirements | undefined | null,
  gameState: GameState,
): CareerRequirementCheck {
  const req = requirements ?? {};
  const waivedByPrestige = hasEarlyCareerAccess(gameState?.prestige?.unlockedBonuses || []);

  const missingEducation: string[] = [];
  const missingItems: string[] = [];
  let fitnessShortfall: { required: number; actual: number } | undefined;
  let reputationShortfall: { required: number; actual: number } | undefined;

  if (!waivedByPrestige) {
    if ('education' in req && req.education && req.education.length > 0) {
      for (const educationId of req.education) {
        const education = (gameState?.educations || []).find(e => e.id === educationId);
        if (!education?.completed) missingEducation.push(educationId);
      }
    }

    // Alternative routes: ANY completed programme in `educationAnyOf` satisfies
    // the whole education block (software: computer_science OR the masters
    // route; lawyer: law_school OR legal_studies+masters). Cleared as a unit —
    // the card's single "Education met" chip stays truthful either way.
    if (
      missingEducation.length > 0 &&
      'educationAnyOf' in req && req.educationAnyOf && req.educationAnyOf.length > 0
    ) {
      const anyAltCompleted = req.educationAnyOf.some(
        (id) => (gameState?.educations || []).find(e => e.id === id)?.completed,
      );
      if (anyAltCompleted) missingEducation.length = 0;
    }

    if ('items' in req && req.items && req.items.length > 0) {
      for (const itemId of req.items) {
        const item = (gameState?.items || []).find(i => i.id === itemId);
        if (!item?.owned) missingItems.push(itemId);
      }
    }

    if ('fitness' in req && typeof req.fitness === 'number' && req.fitness > 0) {
      const actual = gameState?.stats?.fitness ?? 0;
      if (actual < req.fitness) fitnessShortfall = { required: req.fitness, actual };
    }

    if ('reputation' in req && typeof req.reputation === 'number' && req.reputation > 0) {
      const actual = gameState?.stats?.reputation ?? 0;
      if (actual < req.reputation) reputationShortfall = { required: req.reputation, actual };
    }
  }

  return {
    met:
      missingEducation.length === 0 &&
      missingItems.length === 0 &&
      fitnessShortfall === undefined &&
      reputationShortfall === undefined,
    missingEducation,
    missingItems,
    fitnessShortfall,
    reputationShortfall,
    waivedByPrestige,
  };
}

/** Convenience predicate for call sites that only need the verdict. */
export function meetsCareerRequirements(
  requirements: CareerRequirements | undefined | null,
  gameState: GameState,
): boolean {
  return checkCareerRequirements(requirements, gameState).met;
}
