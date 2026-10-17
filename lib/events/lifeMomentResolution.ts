/**
 * Resolving a life-moment choice — ONE pure transition.
 *
 * ## The bug this replaces (2026-10-17 content audit)
 *
 * `LifeMomentModal` applied a choice as four separate dispatches: money through
 * `updateMoney`, each stat through `updateStats`, karma, then consequences, and
 * finally a fifth that cleared the moment. Only the money leg could refuse. The
 * windfall moment fires on TOTAL money (cash + savings) of $100k, so a player
 * holding most of it in the bank could tap "Go all in on the startup" (-$5,000)
 * with $1,000 in cash: the charge was refused, and the +6 happiness, the
 * `startup_payout` unlock and the cleared moment all landed anyway — the
 * gate→grant class CLAUDE.md §4.4 exists for.
 *
 * Here every leg is computed from the same `prev`, inside the caller's single
 * `setGameState` updater: an unaffordable choice returns `prev` untouched (the
 * moment stays up, nothing is granted), and a resolved one clears the moment in
 * the same transition, which is also what makes a double tap pay once — the
 * second updater finds no pending moment and returns `prev`.
 *
 * Lives beside `statEffects.ts` because it reuses that applier: a life moment's
 * stat deltas are event-shaped, and routing them through it puts happiness
 * gains on the same diminishing curve every event gain is on (Program 14) —
 * the old `updateStats` path skipped it.
 */
import type { GameState, GameStats } from '@/contexts/game/types';
import type { LifeMomentChoice } from '@/lib/lifeMoments/types';
import { applyMoneyDelta } from '@/lib/economy/moneyDelta';
import { applyKarmaChange, INITIAL_KARMA } from '@/lib/karma/karmaSystem';
import { applyChoiceConsequences, initializeConsequenceState } from '@/lib/lifeMoments/consequenceTracker';
import { applyEventStatDeltas } from './statEffects';

const finite = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** Net cash a choice moves (sum of its money effects; negative = a cost). */
function moneyDeltaOf(choice: Pick<LifeMomentChoice, 'quickEffect'>): number {
  const effects = Array.isArray(choice.quickEffect) ? choice.quickEffect : [];
  return effects.reduce((sum, e) => (e && e.stat === 'money' ? sum + finite(e.amount) : sum), 0);
}

/** Cash a choice needs on hand. 0 for free and paying choices. */
export function lifeMomentChoiceCost(choice: Pick<LifeMomentChoice, 'quickEffect'>): number {
  const delta = moneyDeltaOf(choice);
  return delta < 0 ? -delta : 0;
}

/** Can `cash` cover the choice? Mirrors `applyMoneyDelta`'s overdraft test. */
export function canAffordLifeMomentChoice(choice: Pick<LifeMomentChoice, 'quickEffect'>, cash: number): boolean {
  return finite(cash) - lifeMomentChoiceCost(choice) >= -0.01;
}

/** `lifeMoments` with the pending moment cleared. Counters are NOT re-incremented (they were counted at generation). */
function clearedMoments(prev: GameState): NonNullable<GameState['lifeMoments']> {
  return {
    ...(prev.lifeMoments || {}),
    lastMomentWeek: prev.lifeMoments?.lastMomentWeek ?? prev.weeksLived,
    momentsThisWeek: prev.lifeMoments?.momentsThisWeek ?? 0,
    totalMoments: prev.lifeMoments?.totalMoments ?? 0,
    pendingMoment: undefined,
  };
}

/**
 * PURE: apply choice `choiceId` of pending moment `momentId` to `prev`.
 *
 * Returns `prev` unchanged when the moment is no longer pending (already
 * answered — the double-tap case), the choice is unknown, or the choice costs
 * more cash than `prev` holds.
 */
export function resolveLifeMomentChoice(prev: GameState, momentId: string, choiceId: string): GameState {
  const pending = prev.lifeMoments?.pendingMoment;
  if (!pending || pending.id !== momentId) return prev;
  const choice = (pending.choices || []).find((c) => c.id === choiceId);
  if (!choice) return prev;

  let next: GameState = prev;

  const moneyDelta = moneyDeltaOf(choice);
  if (moneyDelta !== 0) {
    const spend = applyMoneyDelta(prev, moneyDelta, `Life moment: ${pending.situation.substring(0, 30)}...`);
    if (!spend) return prev; // unaffordable: nothing else may land either
    next = { ...next, ...spend };
  }

  const statDeltas: Partial<GameStats> = {};
  for (const effect of Array.isArray(choice.quickEffect) ? choice.quickEffect : []) {
    if (!effect || effect.stat === 'money') continue;
    const key = effect.stat as keyof GameStats;
    statDeltas[key] = finite(statDeltas[key]) + finite(effect.amount);
  }
  if (Object.keys(statDeltas).length > 0) {
    const stats = { ...next.stats };
    applyEventStatDeltas(stats, statDeltas);
    next = { ...next, stats };
  }

  // Moral choices move the karma fingerprint (honesty/generosity/loyalty…).
  if (choice.karma) {
    const k = choice.karma;
    next = {
      ...next,
      karma: applyKarmaChange(prev.karma ?? INITIAL_KARMA, k.dimension, k.amount, k.reason, prev.weeksLived ?? 0),
    };
  }

  if (choice.hiddenConsequences && choice.hiddenConsequences.length > 0) {
    const consequenceResult = applyChoiceConsequences(prev, pending.id, choiceId, choice.hiddenConsequences);
    next = {
      ...next,
      consequenceState: {
        ...initializeConsequenceState(prev),
        ...consequenceResult.updatedState,
        consequences: consequenceResult.newConsequences,
      },
    };
  }

  return { ...next, lifeMoments: clearedMoments(prev) };
}

/** PURE: clear moment `momentId` without applying a choice. `prev` if it is no longer pending. */
export function dismissLifeMoment(prev: GameState, momentId: string): GameState {
  if (prev.lifeMoments?.pendingMoment?.id !== momentId) return prev;
  return { ...prev, lifeMoments: clearedMoments(prev) };
}
