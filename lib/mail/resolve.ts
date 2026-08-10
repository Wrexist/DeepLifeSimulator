/**
 * Applying a mail decision. Pure, so the same code runs whether the player
 * chose or the deadline chose for them.
 *
 * Two callers: `MailActions` (a tap) and `applyMailLapse` (the tick). Keeping
 * one implementation is the point — "ignored it" and "picked the default" must
 * be indistinguishable in their effects, and two code paths would eventually
 * disagree about that.
 */

import type { GameState, MailMessage } from '@/contexts/game/types';
import {
  isRaisePremiumMaxed,
  nextRaisePremium,
  raisePremiumPct,
  resolveRaisePremium,
} from '@/lib/careers/raisePremium';
import { RAISE_MIN_PERFORMANCE } from '@/contexts/game/actions/JobActions';
import { getMailState, appendMessages } from './state';
import { SENDERS } from './senders';
import { SHIELD_WEEKS } from './security';
import { docMoney } from './format';

/** The negotiated premium a first offer can win. One step of the raise ladder. */
export const OFFER_NEGOTIATION_PREMIUM = 1.08;

export interface Applied {
  state: GameState;
  outcome: string;
}

/**
 * Append a reply to the thread an action belongs to.
 *
 * This is what makes threads real rather than cosmetic: a follow-up is only
 * written where the game genuinely has something more to say — a recruiter
 * answering, a security team confirming — so a thread means a conversation
 * happened, not that a field was populated.
 */
function withReply(state: GameState, reply: MailMessage): GameState {
  const mail = getMailState(state);
  return { ...state, mail: { ...mail, messages: appendMessages(mail.messages, [reply]) } };
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

/**
 * Take an outside offer to your manager.
 *
 * An outside offer is how people actually get raises, and the game already has
 * the machinery: `raiseMultiplier`, its clamp, its cooldown and its performance
 * floor. So this is not a new pay lever — it is the existing one, reached a
 * different way, with a different risk profile.
 *
 * The trade: a normal raise request is a ROLL against your performance and can
 * be repeated every 8 weeks. Leverage is a CERTAINTY if you are worth keeping,
 * and it spends the same window — you cannot do both. Below the performance
 * floor your manager calls the bluff, which is a formal warning, because that
 * is what happens when you threaten to leave a job you are not doing well.
 */
export function applyRecruiterLeverage(
  prev: GameState,
  careerId: string,
  choiceId: string,
  atWeek: number
): Applied {
  if (choiceId !== 'leverage') {
    return { state: prev, outcome: 'You let it go. The offer will not stay open.' };
  }

  const careers = Array.isArray(prev.careers) ? prev.careers : [];
  const index = careers.findIndex((c) => c && c.id === careerId);
  const career = index === -1 ? null : careers[index];

  if (!career || !career.accepted || prev.currentJob !== careerId) {
    return { state: prev, outcome: 'You are not working there any more.' };
  }
  if (isRaisePremiumMaxed(career.raiseMultiplier)) {
    return { state: prev, outcome: 'You are already at the top of this role’s band.' };
  }

  const performance = typeof career.performance === 'number' ? career.performance : 50;
  const next = [...careers];

  // The bluff is called. Same floor the raise system uses — two copies of that
  // number would let one path reward what the other punishes.
  if (performance < RAISE_MIN_PERFORMANCE) {
    next[index] = {
      ...career,
      warningsReceived: (career.warningsReceived ?? 0) + 1,
      lastRaiseWeeksLived: atWeek,
    };
    return {
      state: {
        ...withReply(
          { ...prev, careers: next, stats: { ...prev.stats, happiness: Math.max(0, (prev.stats?.happiness ?? 0) - 6) } },
          {
            id: `mail-leverage-reply-${atWeek}`,
            threadId: `recruiter-${careerId}`,
            senderName: 'Your line manager',
            senderEmail: 'hr@deeplife-payroll.com',
            verified: true,
            subject: 'Re: your conversation this morning',
            preview: 'That did not land the way you hoped.',
            body:
              'I have noted our conversation.\n\n' +
              'To be direct: your recent performance does not support the case you ' +
              'made. I have recorded a formal note. If the outside offer is better, ' +
              'you should take it.',
            atWeek,
            read: false,
            starred: false,
            folder: 'inbox',
            category: 'primary',
          }
        ),
      },
      outcome: 'They called it. A formal warning, and no raise.',
    };
  }

  const premium = nextRaisePremium(career.raiseMultiplier);
  next[index] = { ...career, raiseMultiplier: premium, lastRaiseWeeksLived: atWeek };

  return {
    state: withReply(
      { ...prev, careers: next },
      {
        id: `mail-leverage-reply-${atWeek}`,
        threadId: `recruiter-${careerId}`,
        senderName: 'Your line manager',
        senderEmail: 'hr@deeplife-payroll.com',
        verified: true,
        subject: 'Re: your conversation this morning',
        preview: `Matched. Premium now +${raisePremiumPct(premium)}%.`,
        body:
          'We would rather not lose you.\n\n' +
          `Payroll has been instructed to match. Your premium is now ` +
          `+${raisePremiumPct(premium)}% on base. I would appreciate it if the ` +
          'next conversation started here rather than there.',
        atWeek,
        read: false,
        starred: false,
        folder: 'inbox',
        category: 'primary',
      }
    ),
    outcome: `Matched. Your premium is now +${raisePremiumPct(premium)}%.`,
  };
}

/**
 * Rotate credentials after a breach notice.
 *
 * The only lever the player has over their own fraud exposure — everything else
 * feeding `scamRisk` pushes it up. Charged from `prev` and refused when
 * unaffordable, so it cannot be bought on credit the game does not have.
 */
export function applySecurityShield(
  prev: GameState,
  choiceId: string,
  cost: number,
  weeks: number,
  atWeek: number
): Applied {
  if (choiceId !== 'rotate') {
    return { state: prev, outcome: 'Left as it is. The list is still out there.' };
  }

  const cash = Math.max(0, Math.round(prev.stats?.money ?? 0));
  if (cash < cost) {
    return {
      state: prev,
      outcome: `Rotation costs ${docMoney(cost)} and you have ${docMoney(cash)}.`,
    };
  }

  const mail = getMailState(prev);
  const until = atWeek + Math.max(1, Math.floor(weeks || SHIELD_WEEKS));

  return {
    state: {
      ...prev,
      stats: { ...prev.stats, money: cash - cost },
      mail: { ...mail, shieldUntilWeek: until },
    },
    outcome: `Rotated. Attempts against you are far less likely for ${weeks} weeks.`,
  };
}

/**
 * Pay off, or refuse, an extortion demand.
 *
 * Refusing is not a free "no" — that would make the decision a formality. It
 * costs reputation and adds heat, which is exactly the pressure that produced
 * the demand in the first place.
 */
export function applyExtortion(
  prev: GameState,
  choiceId: string,
  demand: number
): Applied {
  if (choiceId === 'pay') {
    const cash = Math.max(0, Math.round(prev.stats?.money ?? 0));
    const paid = Math.min(cash, Math.max(0, Math.round(demand)));
    if (paid <= 0) {
      return { state: prev, outcome: 'Nothing to pay them with. They will follow through.' };
    }
    return {
      state: { ...prev, stats: { ...prev.stats, money: cash - paid } },
      outcome: `${docMoney(paid)} paid. It goes quiet.`,
    };
  }

  const heat = Math.max(0, Math.min(100, prev.darkWeb?.heat ?? 0));
  return {
    state: {
      ...prev,
      stats: {
        ...prev.stats,
        reputation: Math.max(0, (prev.stats?.reputation ?? 0) - 8),
        happiness: Math.max(0, (prev.stats?.happiness ?? 0) - 6),
      },
      ...(prev.darkWeb
        ? { darkWeb: { ...prev.darkWeb, heat: Math.min(100, heat + 12) } }
        : {}),
    },
    outcome: 'They followed through. Reputation down, heat up.',
  };
}
