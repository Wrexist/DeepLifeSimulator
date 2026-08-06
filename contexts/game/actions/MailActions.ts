/**
 * Mail writes.
 *
 * Module-form actions (`fn(setGameState, …)`), matching `MoneyActions` — see
 * CLAUDE.md Hard Rule #5 for why the hook form and the module form must not be
 * confused.
 *
 * ## The money rule
 *
 * Two of these move money, and both follow §4.4 exactly: the amount is computed
 * from `prev` INSIDE the updater that applies it, and the updater returns `prev`
 * unchanged to reject. A double-tap in one React batch therefore pays once —
 * which matters more here than almost anywhere else in the app, because the
 * thing being double-tapped is a button designed to be tapped in a panic.
 */

import type { GameState, MailFolder, MailMessage } from '@/contexts/game/types';
import { getMailState } from '@/lib/mail/state';
import { scamLossFor } from '@/lib/mail/scam';
import { logger } from '@/utils/logger';

type SetGameState = (updater: (prev: GameState) => GameState) => void;

/** Fraction of a scam loss the bank will refund on a successful dispute. */
export const DISPUTE_RECOVERY_FRACTION = 0.5;

/**
 * Rewrite one message in place, leaving everything else identical.
 *
 * Returns `prev` unchanged when the id is absent or the patch is a no-op, so a
 * repeated call causes no state churn and no save write.
 */
function patchMessage(
  prev: GameState,
  id: string,
  patch: (m: MailMessage) => MailMessage | null
): GameState {
  const mail = getMailState(prev);
  const index = mail.messages.findIndex((m) => m.id === id);
  if (index === -1) return prev;

  const updated = patch(mail.messages[index]);
  if (!updated || updated === mail.messages[index]) return prev;

  const messages = [...mail.messages];
  messages[index] = updated;
  return { ...prev, mail: { ...mail, messages } };
}

/** Mark one message read. Idempotent. */
export function markMailRead(setGameState: SetGameState, id: string): void {
  setGameState((prev) => patchMessage(prev, id, (m) => (m.read ? m : { ...m, read: true })));
}

/** Mark every message in a folder read — the "select all" affordance. */
export function markFolderRead(setGameState: SetGameState, folder: MailFolder): void {
  setGameState((prev) => {
    const mail = getMailState(prev);
    let changed = false;
    const messages = mail.messages.map((m) => {
      if ((m.folder ?? 'inbox') !== folder || m.read) return m;
      changed = true;
      return { ...m, read: true };
    });
    return changed ? { ...prev, mail: { ...mail, messages } } : prev;
  });
}

/** Toggle the star. */
export function toggleMailStar(setGameState: SetGameState, id: string): void {
  setGameState((prev) => patchMessage(prev, id, (m) => ({ ...m, starred: !m.starred })));
}

/** Move a message between folders. */
export function moveMail(setGameState: SetGameState, id: string, folder: MailFolder): void {
  setGameState((prev) =>
    patchMessage(prev, id, (m) => ((m.folder ?? 'inbox') === folder ? m : { ...m, folder }))
  );
}

/**
 * Report a message as phishing.
 *
 * Always safe, always available, and deliberately available on legitimate mail
 * too — a mechanic that only lets you report the thing that is actually a scam
 * has already told you the answer.
 */
export function reportMailPhishing(setGameState: SetGameState, id: string): void {
  setGameState((prev) =>
    patchMessage(prev, id, (m) => ({
      ...m,
      folder: 'spam',
      read: true,
      actionTaken: m.scam ? 'reported' : m.actionTaken,
    }))
  );
}

export interface ScamActionResult {
  /** What the tap cost. 0 when nothing was taken or the action was rejected. */
  lost: number;
}

/**
 * Act on a scam's call to action — the one place in mail that can lose money.
 *
 * Everything happens in ONE updater: the loss is computed from `prev.stats`,
 * charged, and the message stamped resolved together. Splitting them would be
 * the gate→grant bug this repo keeps re-learning, and here the reject path
 * genuinely matters: `actionTaken` already set means a second tap on the same
 * button — a fast double-tap lands both handlers in the same React batch, and
 * only the first may charge.
 *
 * The caller receives the amount through a ref rather than a return value,
 * because a `setGameState` updater's result is not visible outside it (§4.1).
 */
export function actOnScamMail(
  setGameState: SetGameState,
  id: string,
  onResolved: (result: ScamActionResult) => void
): void {
  let lost = 0;

  setGameState((prev) => {
    const mail = getMailState(prev);
    const index = mail.messages.findIndex((m) => m.id === id);
    if (index === -1) return prev;

    const message = mail.messages[index];
    // Not a scam, or already resolved — reject without touching money.
    if (!message.scam || message.actionTaken) return prev;

    const amount = scamLossFor(prev, message);
    lost = amount;

    const messages = [...mail.messages];
    messages[index] = {
      ...message,
      read: true,
      actionTaken: 'accepted',
      lostAmount: amount,
    };

    logger.info(`[MAIL] Scam acted on (${message.id}) — ${amount} taken`);

    return {
      ...prev,
      stats: { ...prev.stats, money: Math.max(0, (prev.stats?.money ?? 0) - amount) },
      mail: { ...mail, messages },
    };
  });

  // Flushed after the updater so the caller sees the charged figure, not a
  // value read from a state it cannot observe yet.
  onResolved({ lost });
}

export interface DisputeResult {
  recovered: number;
  /** Set when the dispute was refused, with the reason to show the player. */
  refused?: string;
}

/**
 * Dispute a scam charge with the bank.
 *
 * Being scammed should be a setback with an answer, not a dead loss — but a
 * full refund would make the whole mechanic free, so half comes back and only
 * once per incident. `disputed` is set in the same updater that pays, for the
 * same double-tap reason as above.
 */
export function disputeMailCharge(
  setGameState: SetGameState,
  id: string,
  onResolved: (result: DisputeResult) => void
): void {
  let recovered = 0;
  let refused: string | undefined;

  setGameState((prev) => {
    const mail = getMailState(prev);
    const index = mail.messages.findIndex((m) => m.id === id);
    if (index === -1) {
      refused = 'That message is no longer in your mailbox.';
      return prev;
    }

    const message = mail.messages[index];
    if (!message.lostAmount || message.lostAmount <= 0) {
      refused = 'There is no charge on this message to dispute.';
      return prev;
    }
    if (message.disputed) {
      refused = 'This charge has already been disputed.';
      return prev;
    }

    recovered = Math.floor(message.lostAmount * DISPUTE_RECOVERY_FRACTION);

    const messages = [...mail.messages];
    messages[index] = { ...message, disputed: true };

    logger.info(`[MAIL] Dispute settled (${message.id}) — ${recovered} recovered`);

    return {
      ...prev,
      stats: { ...prev.stats, money: (prev.stats?.money ?? 0) + recovered },
      mail: { ...mail, messages },
    };
  });

  onResolved({ recovered, refused });
}

/** Permanently drop everything in Trash and Spam. */
export function emptyMailBin(setGameState: SetGameState): void {
  setGameState((prev) => {
    const mail = getMailState(prev);
    const messages = mail.messages.filter(
      (m) => m.folder !== 'trash' && m.folder !== 'spam'
    );
    if (messages.length === mail.messages.length) return prev;
    return { ...prev, mail: { ...mail, messages } };
  });
}
