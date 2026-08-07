/**
 * Finding a message.
 *
 * Kept out of the screen for the reason every rule in this app ends up out of
 * the screen: the inbox is not the only thing that asks these questions. The
 * launcher badge wants a count, the row wants a deadline, the chip strip wants
 * both, and a rule implemented three times is a rule that will disagree with
 * itself the first time one copy changes. `messagesInFolder` had already been
 * re-implemented inline once.
 *
 * ## Why these four filters and not a search-operator language
 *
 * Gmail's chip strip is `Attachments · Unread · Starred`, and the reason it
 * works is that a chip is a question you can answer by LOOKING — you do not
 * have to know it exists to discover it, the way you have to know `has:` exists
 * before you can type it. So the set is small, visible, and each chip answers a
 * question this game actually poses:
 *
 * - **Unread** — the universal one.
 * - **Needs reply** — the only filter that can cost the player something by
 *   being absent. A summons that auto-resolves in two weeks renders exactly
 *   like a promotional email, and there is no other surface it appears on.
 * - **Documents** — the paper trail, which is the feature's whole premise.
 *   "What did I actually earn in the spring?" is a question about attachments.
 * - **Unverified** — every sender the game does not vouch for. This is the
 *   teaching half of the scam mechanic promoted into a filter: the answer is
 *   never "these are the scams", it is "these are the ones nobody vouched for",
 *   which is the judgement the player has to learn to make.
 *
 * Deliberately NOT here: a "scams" filter. It would answer the question the
 * mechanic exists to ask, and any player who found it would stop reading
 * addresses forever.
 */

import type { GameState, MailMessage } from '@/contexts/game/types';
import { allMessages, getMailState } from './state';

export type MailFilter = 'unread' | 'decisions' | 'documents' | 'unverified';

export const MAIL_FILTERS: readonly MailFilter[] = [
  'unread',
  'decisions',
  'documents',
  'unverified',
];

export const FILTER_LABELS: Record<MailFilter, string> = {
  unread: 'Unread',
  decisions: 'Needs reply',
  documents: 'Documents',
  unverified: 'Unverified',
};

/** Empty-state copy per filter. A dead end should say which one it is. */
export const FILTER_EMPTY_TEXT: Record<MailFilter, string> = {
  unread: 'Everything here has been read.',
  decisions: 'Nothing is waiting on an answer.',
  documents: 'No payslips, statements or invoices here yet.',
  unverified: 'Every sender here is one the game vouches for.',
};

/** True when a message still has an unanswered decision on it. */
export function needsReply(message: MailMessage | null | undefined): boolean {
  return Boolean(message?.decision && !message.decision.chosenId);
}

export function matchesFilter(message: MailMessage, filter: MailFilter): boolean {
  switch (filter) {
    case 'unread':
      return !message.read;
    case 'decisions':
      return needsReply(message);
    case 'documents':
      return Boolean(message.attachment);
    case 'unverified':
      return message.verified !== true;
    default:
      return true;
  }
}

/**
 * How many messages each chip would show, for its badge.
 *
 * Counted over the folder the player is LOOKING at, not the whole mailbox: a
 * chip that promises 4 and then shows 1 because three of them are in Archive is
 * worse than no number at all.
 */
export function filterCounts(messages: readonly MailMessage[]): Record<MailFilter, number> {
  const counts: Record<MailFilter, number> = {
    unread: 0,
    decisions: 0,
    documents: 0,
    unverified: 0,
  };
  for (const m of messages) {
    for (const f of MAIL_FILTERS) if (matchesFilter(m, f)) counts[f] += 1;
  }
  return counts;
}

/**
 * Everything waiting on an answer, anywhere, soonest deadline first.
 *
 * Across ALL folders on purpose. A routed summons that the player archived is
 * still going to lapse and hand itself back to the blocking modal — archiving a
 * letter does not make its deadline go away, so a count that only looked in the
 * Inbox would under-report the one thing in this app with a consequence
 * attached.
 */
export function pendingDecisions(
  state: GameState | null | undefined
): MailMessage[] {
  return allMessages(state)
    .filter((m) => needsReply(m) && m.folder !== 'trash')
    .sort(
      (a, b) => (a.decision!.expiresAtWeek ?? 0) - (b.decision!.expiresAtWeek ?? 0)
    );
}

export interface Deadline {
  /** Weeks remaining. Zero means it settles at the end of this week. */
  weeksLeft: number;
  /** The row/detail label. One source, so the two cannot word it differently. */
  label: string;
  /** Last week to answer — drives the urgent tint. */
  urgent: boolean;
}

/**
 * How long is left on a decision, in words.
 *
 * Shared by the list row and the open message. The detail view computed this
 * inline first; putting the row's copy next to it would have been two
 * expressions rounding the same subtraction, which is exactly how "1 weeks"
 * ships.
 */
export function decisionDeadline(
  message: MailMessage | null | undefined,
  currentWeek: number
): Deadline | null {
  if (!needsReply(message)) return null;
  const expires = message!.decision!.expiresAtWeek;
  if (typeof expires !== 'number' || !Number.isFinite(expires)) return null;

  const week = Math.max(0, Math.floor(currentWeek ?? 0));
  const weeksLeft = Math.max(0, Math.floor(expires) - week);
  if (weeksLeft <= 0) return { weeksLeft: 0, label: 'Due this week', urgent: true };
  if (weeksLeft === 1) return { weeksLeft: 1, label: '1 week left', urgent: true };
  return { weeksLeft, label: `${weeksLeft} weeks left`, urgent: false };
}

/**
 * Search the whole mailbox.
 *
 * Across folders, which is the fix for a genuine wrong answer rather than a
 * convenience: this app's stated reason for having search at all is that "did
 * my bank really write from that address?" should be answerable inside it. A
 * folder-scoped search told a player who had archived the message "No matches",
 * which does not fail to answer that question — it answers it incorrectly, and
 * being trusted about sender addresses is the one thing the fraud mechanic
 * needs from this screen.
 *
 * Trash is excluded, as it is in Gmail: a deleted message turning up in results
 * makes deleting meaningless.
 */
export function searchMessages(
  state: GameState | null | undefined,
  query: string
): MailMessage[] {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return [];
  return allMessages(state).filter((m) => {
    if (m.folder === 'trash') return false;
    return (
      m.senderName.toLowerCase().includes(q) ||
      m.senderEmail.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q) ||
      (m.preview ?? '').toLowerCase().includes(q) ||
      (m.body ?? '').toLowerCase().includes(q)
    );
  });
}

/**
 * What each folder has in it, for the drawer.
 *
 * Unread where unread is the useful number (Inbox), total where it is not:
 * nobody cares how many messages in the bin are unread, they care whether the
 * bin has anything in it. The drawer showed a count for the Inbox alone, so
 * Spam and Archive read as permanently empty.
 */
export function folderCounts(state: GameState | null | undefined): {
  inbox: number;
  starred: number;
  archive: number;
  spam: number;
  trash: number;
} {
  const counts = { inbox: 0, starred: 0, archive: 0, spam: 0, trash: 0 };
  for (const m of getMailState(state).messages) {
    const folder = m.folder ?? 'inbox';
    if (folder === 'inbox' && !m.read) counts.inbox += 1;
    if (folder === 'archive') counts.archive += 1;
    if (folder === 'spam') counts.spam += 1;
    if (folder === 'trash') counts.trash += 1;
    if (m.starred && folder !== 'trash') counts.starred += 1;
  }
  return counts;
}
