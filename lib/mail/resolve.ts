/**
 * Applying a mail decision. Pure, so the same code runs whether the player
 * chose or the deadline chose for them.
 *
 * Two callers: `MailActions` (a tap) and `applyMailLapse` (the tick). Keeping
 * one implementation is the point — "ignored it" and "picked the default" must
 * be indistinguishable in their effects, and two code paths would eventually
 * disagree about that.
 */

import type { GameState } from '@/contexts/game/types';
import { resolveRaisePremium } from '@/lib/careers/raisePremium';
import { docMoney } from './format';

/** The negotiated premium a first offer can win. One step of the raise ladder. */
export const OFFER_NEGOTIATION_PREMIUM = 1.08;

export interface Applied {
  state: GameState;
  outcome: string;
}

/**
 * Accept / negotiate / decline a job offer.
 *
 * Note the already-started guard. `applyCareerApplications` runs its own 1–2
 * week auto-accept and knows nothing about this letter, so by the time a player
 * opens their mail they may already be doing the job. Declining a job you have
 * started is not a thing; saying so is better than silently firing them.
 */
export function applyCareerOffer(
  prev: GameState,
  careerId: string,
  choiceId: string
): Applied {
  const careers = Array.isArray(prev.careers) ? prev.careers : [];
  const index = careers.findIndex((c) => c && c.id === careerId);
  if (index === -1) return { state: prev, outcome: 'That role is no longer open.' };

  const career = careers[index];

  if (career.accepted || prev.currentJob === careerId) {
    return {
      state: prev,
      outcome:
        choiceId === 'decline'
          ? 'Too late — you already started. Resign from the Work tab if you want out.'
          : 'You had already started. Nothing to sign.',
    };
  }

  const next = [...careers];

  if (choiceId === 'decline') {
    next[index] = { ...career, applied: false, accepted: false, applicationWeeksPending: 0 };
    return {
      state: { ...prev, careers: next },
      outcome: 'Offer declined. Your application has been withdrawn.',
    };
  }

  const negotiated = choiceId === 'negotiate';
  next[index] = {
    ...career,
    accepted: true,
    applicationWeeksPending: 0,
    // Writes the SAME field the raise system writes, through the SAME clamp —
    // an existing lever moved to where it belongs, not a second pay multiplier
    // that could stack past the cap.
    ...(negotiated ? { raiseMultiplier: resolveRaisePremium(OFFER_NEGOTIATION_PREMIUM) } : {}),
  };

  return {
    state: { ...prev, careers: next, currentJob: careerId },
    outcome: negotiated
      ? 'They agreed. You start on the improved package.'
      : 'Signed. You start immediately.',
  };
}

/**
 * Pay down the arrears balance — the first and only player-facing action on
 * `overdueBalance`, which until now was written by the tick, collected
 * automatically and otherwise a spectator sport.
 *
 * Pays the smaller of cash and balance, so a partial payment is possible and an
 * empty account is a no-op rather than a negative balance.
 */
export function applyArrearsPayment(prev: GameState, choiceId: string): Applied {
  if (choiceId !== 'pay') {
    return { state: prev, outcome: 'Left to the weekly collection.' };
  }

  const overdue = Math.max(0, Math.round(prev.overdueBalance ?? 0));
  const cash = Math.max(0, Math.round(prev.stats?.money ?? 0));
  const payment = Math.min(cash, overdue);

  if (payment <= 0) {
    return {
      state: prev,
      outcome:
        overdue <= 0
          ? 'The balance is already clear.'
          : 'There is nothing in the account to pay it with.',
    };
  }

  const remaining = overdue - payment;

  return {
    state: {
      ...prev,
      stats: { ...prev.stats, money: cash - payment },
      overdueBalance: remaining,
    },
    outcome:
      remaining > 0
        ? `Paid. ${docMoney(remaining)} still outstanding.`
        : 'Paid in full. The balance is clear.',
  };
}
