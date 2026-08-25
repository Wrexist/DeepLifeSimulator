/**
 * Live progress for the CHOSEN challenge scenario.
 *
 * The 23 challenge scenarios ship win conditions and gem rewards, but until
 * this module they were evaluated in exactly one place — `executePrestige`,
 * first prestige only — and surfaced NOWHERE between onboarding and that
 * moment. A player who picked "Rags to Riches" played their whole life with
 * no view of the conditions they signed up for (2026-08-25 retention audit).
 *
 * This is a PURE read over `GameState`, the `lib/goals` invariant: it stores
 * nothing and grants nothing, so it needs no claim flag and no migration.
 * Completion is judged by the SAME `checkScenarioWin` the prestige payout
 * uses, over the SAME projection (`projectScenarioState`, extracted from
 * `prestigeExecution` so the two surfaces cannot drift) — what the card shows
 * as met is exactly what prestige will pay for.
 *
 * (`Scenario.timeLimit` was flagged here as dead schema — zero consumers,
 * advertised nowhere — and has since been deleted from the Scenario type
 * rather than surfaced as a rule the evaluator ignores.)
 */
import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { nonMirrorDeposits } from '@/lib/banking/operations';
import { getSatisfiedAchievementIds } from '@/lib/progress/earnedAchievements';
import {
  checkScenarioWin,
  getScenario,
  type Scenario,
  type ScenarioCondition,
} from './scenarioDefinitions';

/** The projection shape `checkScenarioWin` evaluates against. */
export type ScenarioEvalState = Parameters<typeof checkScenarioWin>[1];

/**
 * Project a full `GameState` into the evaluator's shape.
 *
 * Extracted verbatim from `executePrestige` so the live card and the payout
 * read the same numbers. The projection carries three hard-won fixes that
 * MUST survive here (each shipped as a bug when this mapping was written
 * ad hoc — see the audit notes at their original site):
 *  - `careers[].level` survives (GL-4: `'level' in c` guarded the President
 *    condition, and a projection that dropped the field made Political
 *    Dynasty unwinnable);
 *  - achievements come from the LIVE earned-achievement system, not the
 *    deprecated all-false `gameState.achievements` catalogue;
 *  - `bankSavings` is legacy pools plus `nonMirrorDeposits` (R4: a raw sum
 *    over `banking.accounts` double-counted the two mirror accounts).
 */
export function projectScenarioState(gameState: GameState): ScenarioEvalState {
  return {
    stats: {
      money: gameState.stats?.money ?? 0,
      reputation: gameState.stats?.reputation ?? 0,
    },
    age: gameState.date?.age || 18,
    education: (gameState.educations || []).map((e) => ({ id: e.id, completed: e.completed })),
    careers: (gameState.careers || []).map((c) => ({
      id: c.id,
      accepted: c.accepted,
      level: c.level,
    })),
    relationships: (gameState.relationships || []).map((r) => ({ type: r.type })),
    achievements: getSatisfiedAchievementIds(gameState).map((id) => ({ id, completed: true })),
    companies: (gameState.companies || []).map((c) => ({ weeklyIncome: c.weeklyIncome || 0 })),
    realEstate: (gameState.realEstate || []).map((r) => ({ owned: r.owned, value: r.price || 0 })),
    weeksLived: gameState.weeksLived || 0,
    bankSavings:
      (gameState.bankSavings || 0) + nonMirrorDeposits(gameState.banking?.accounts ?? []),
  };
}

export interface ScenarioConditionRow {
  /** The authored condition copy, e.g. "Reach $1,000,000 net worth". */
  description: string;
  met: boolean;
  /**
   * 0..1. Filled from current/target for numeric `>=`/`>` conditions so the
   * bar moves as the player closes in; boolean-shaped conditions (education,
   * career, achievement) and `<=`/`==` conditions read 0 until met.
   */
  progress: number;
}

export interface ActiveScenarioProgress {
  scenarioId: string;
  name: string;
  icon?: string;
  difficulty: Scenario['difficulty'];
  gems: number;
  rows: ScenarioConditionRow[];
  metCount: number;
  total: number;
  complete: boolean;
}

/** The current value behind a numeric condition, for the progress bar only —
 *  met/unmet always comes from `checkScenarioWin`, never re-derived here. */
function numericCurrent(condition: ScenarioCondition, evalState: ScenarioEvalState): number | null {
  switch (condition.type) {
    case 'money':
      return evalState.stats.money;
    case 'reputation':
      return evalState.stats.reputation;
    case 'age':
      return evalState.age;
    case 'relationship':
      return evalState.relationships.filter((rel) =>
        condition.relationshipType ? rel.type === condition.relationshipType : true,
      ).length;
    case 'netWorth': {
      // The evaluator's own simplified composition (money + bank + company
      // annual income + owned property), kept in step by the shared-projection
      // test rather than re-imported — checkScenarioWin computes it inline.
      const companyValue = evalState.companies.reduce(
        (sum, c) => sum + (c.weeklyIncome || 0) * WEEKS_PER_YEAR,
        0,
      );
      const realEstateValue = evalState.realEstate
        .filter((p) => p.owned)
        .reduce((sum, p) => sum + p.value, 0);
      return evalState.stats.money + (evalState.bankSavings || 0) + companyValue + realEstateValue;
    }
    default:
      return null;
  }
}

const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

/**
 * Progress for the scenario this life was started with, or null when there is
 * nothing to show: no scenario chosen, an unknown id, a scenario with no win
 * conditions (the pure life-path starts), or a dynasty that has already
 * prestiged — the payout is first-prestige-only, so after that the board is
 * settled and a live card would advertise gems that can no longer be won.
 */
export function getActiveScenarioProgress(
  state: GameState | undefined | null,
): ActiveScenarioProgress | null {
  try {
    if (!state?.scenarioId) return null;
    if ((state.prestige?.totalPrestiges ?? 0) > 0) return null;
    const scenario = getScenario(state.scenarioId);
    if (!scenario || scenario.winConditions.length === 0) return null;

    const evalState = projectScenarioState(state);
    const { won, unmetConditions } = checkScenarioWin(scenario, evalState);
    const unmet = new Set(unmetConditions);

    const rows: ScenarioConditionRow[] = scenario.winConditions.map((condition) => {
      const met = !unmet.has(condition);
      let progress = met ? 1 : 0;
      if (!met && (condition.operator === '>=' || condition.operator === '>')) {
        const current = numericCurrent(condition, evalState);
        const target = typeof condition.value === 'number' ? condition.value : null;
        if (current !== null && target !== null && target > 0) {
          progress = clamp01(current / target);
        }
      }
      return { description: condition.description, met, progress };
    });

    return {
      scenarioId: scenario.id,
      name: scenario.name,
      icon: scenario.icon,
      difficulty: scenario.difficulty,
      gems: scenario.rewards?.gems ?? 0,
      rows,
      metCount: rows.filter((r) => r.met).length,
      total: rows.length,
      complete: won,
    };
  } catch {
    // A malformed state must not take the home feed down with it.
    return null;
  }
}
