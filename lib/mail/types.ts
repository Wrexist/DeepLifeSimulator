/**
 * The contract every mail template is written against.
 *
 * A template is a pure `(ctx) => MailMessage | null`. Returning null is the
 * normal case — most weeks, most templates have nothing to say — which keeps
 * the "should this fire?" test next to the copy that depends on it instead of
 * in a dispatch table that has to be kept in sync.
 */

import type { GameState, MailMessage } from '@/contexts/game/types';

/**
 * Figures that only exist DURING the tick.
 *
 * The alternative was recomputing salary and tax inside the template from
 * `careers[level].salary`, which is the drift this repo keeps getting bitten
 * by: the paid figure runs through a raise premium, two IAP multipliers, a life
 * skill, a DeepLife+ boost and a jail withholding, and a payslip that quoted a
 * number the player was not actually paid would be worse than no payslip.
 *
 * So the tick hands over what it really moved, and the templates only format.
 * All optional: a caller that has not computed one yet passes nothing and the
 * template that needs it declines to fire.
 */
export interface MailFacts {
  careerSalary?: number;
  passiveIncome?: number;
  totalIncome?: number;
  incomeTax?: number;
  weeklyRent?: number;
  loanPaid?: number;
  loanPenalty?: number;
  savingsInterest?: number;
}

/**
 * Every field above has a reader. `partnerIncome`, `moneyBefore` and
 * `moneyAfter` were threaded through the whole tick and read by nothing — the
 * same "built and never wired" pattern this codebase keeps producing, in the
 * plumbing rather than in a feature. They are gone; add one back when a
 * document actually needs it, not in anticipation.
 */

export interface MailContext {
  /** The assembled state for the week being mailed about. */
  state: GameState;
  /** Absolute `weeksLived` of this tick. Every id is keyed off it. */
  week: number;
  /** What the tick actually moved this week. */
  facts: MailFacts;
  /**
   * Deterministic 0..1 draw. Same (week, salt) always gives the same number, so
   * a replayed or double-invoked tick produces the same inbox.
   */
  rand: (salt: string) => number;
}

export type MailTemplate = (ctx: MailContext) => MailMessage | null;
