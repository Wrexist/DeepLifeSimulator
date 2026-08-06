/**
 * Weekly mail delivery.
 *
 * Runs LAST, on the fully assembled `nextState`, for the same reason
 * `applyAmbitionPayout` does: the documents quote arbitrary corners of the save
 * — cash after the writeback, the arrears balance, tuition weeks remaining,
 * vendor reputation — and a hand-enumerated projection would quietly quote a
 * stale figure the moment a template starts reading a field it did not know
 * about. Running last means every subsystem's result is already folded in.
 *
 * Idempotent twice over: `lastGeneratedWeek` short-circuits a repeat of the same
 * week, and every id encodes its week so `appendMessages` would drop the
 * duplicates anyway. Either guard alone would do; both cost nothing and this
 * runs inside an updater React may invoke twice.
 */

import type { GameState } from '@/contexts/game/types';
import { generateWeeklyMail } from '@/lib/mail/generate';
import type { MailFacts } from '@/lib/mail/types';
import { appendMessages, deriveAddress, getMailState } from '@/lib/mail/state';

export interface ApplyMailInput {
  state: GameState;
  /** Absolute `weeksLived` for the tick being processed. */
  week: number;
  /** What the tick actually moved — see `MailFacts` for why this is passed. */
  facts?: MailFacts;
}

export interface ApplyMailResult {
  /** New state, or null when nothing changed (so the caller can skip the churn). */
  state: GameState | null;
  /** How many messages were delivered. For logging only. */
  delivered: number;
}

export function applyMail(input: ApplyMailInput): ApplyMailResult {
  const week = Math.max(0, Math.floor(input.week ?? 0));
  const mail = getMailState(input.state);

  // Already ran for this week — a double-invoked updater, or a tick replayed
  // after a failed save.
  if (mail.lastGeneratedWeek === week) return { state: null, delivered: 0 };

  const messages = generateWeeklyMail({ state: input.state, week, facts: input.facts });
  const nextMessages = appendMessages(mail.messages, messages);

  // Nothing new AND the marker is already current — leave the state alone.
  if (nextMessages === mail.messages && mail.lastGeneratedWeek === week) {
    return { state: null, delivered: 0 };
  }

  return {
    state: {
      ...input.state,
      mail: {
        messages: nextMessages,
        lastGeneratedWeek: week,
        address: mail.address ?? deriveAddress(input.state),
      },
    },
    delivered: nextMessages === mail.messages ? 0 : nextMessages.length - mail.messages.length,
  };
}
