/**
 * Safe reads over `gameState.mail`.
 *
 * `mail` is a v37 carve-out: absent on every save written before it, and
 * possibly partial on a save that was hand-edited or truncated. Every read in
 * the app and in the week loop goes through here, so a missing or malformed
 * shape degrades to an empty inbox instead of throwing three subsystems away
 * from the cause — the same contract `lib/dynasty/state.ts` holds for `dynasty`.
 */

import type {
  GameState,
  MailCategory,
  MailFolder,
  MailMessage,
  MailState,
} from '@/contexts/game/types';

/**
 * Hard cap on stored messages.
 *
 * A 60-year life is ~3,100 weeks. At even one message a week an uncapped inbox
 * would outgrow every other field in the save combined, and the player will
 * never scroll past the last few dozen. Oldest-first pruning keeps the newest
 * window, which is the only part anyone reads.
 *
 * 50 rather than a rounder 80, for a measured reason: at 80 the stress suite's
 * save-growth report put mail third among all growers at 28.5 KB on a 165 KB
 * save — bounded, but a sixth of the file for a feature whose oldest entries
 * nobody opens. 50 matches `MAX_JOURNAL_ENTRIES` (the other append-only history
 * in the save) and still holds roughly a year of in-game correspondence.
 */
export const MAX_MAIL_MESSAGES = 50;

const EMPTY: MailMessage[] = [];

/** The mail slice, or a valid empty one. Never throws, never returns null. */
export function getMailState(state: GameState | null | undefined): MailState {
  const raw = (state as { mail?: unknown } | null | undefined)?.mail;
  if (!raw || typeof raw !== 'object') return { messages: EMPTY };
  const mail = raw as Partial<MailState>;
  return {
    messages: Array.isArray(mail.messages) ? mail.messages.filter(isMessage) : EMPTY,
    lastGeneratedWeek:
      typeof mail.lastGeneratedWeek === 'number' && Number.isFinite(mail.lastGeneratedWeek)
        ? mail.lastGeneratedWeek
        : undefined,
    address: typeof mail.address === 'string' ? mail.address : undefined,
  };
}

/**
 * A message is usable if it can be listed and opened. Anything missing an id,
 * a sender or a subject would render as a blank row the player cannot act on,
 * which is worse than not being there.
 */
function isMessage(m: unknown): m is MailMessage {
  if (!m || typeof m !== 'object') return false;
  const msg = m as Partial<MailMessage>;
  return (
    typeof msg.id === 'string' &&
    msg.id.length > 0 &&
    typeof msg.senderName === 'string' &&
    typeof msg.subject === 'string'
  );
}

/** Every message, newest first. */
export function allMessages(state: GameState | null | undefined): MailMessage[] {
  return [...getMailState(state).messages].sort((a, b) => (b.atWeek ?? 0) - (a.atWeek ?? 0));
}

/** Messages in one folder, newest first. `starred` is a view, not a folder. */
export function messagesInFolder(
  state: GameState | null | undefined,
  folder: MailFolder | 'starred'
): MailMessage[] {
  const list = allMessages(state);
  if (folder === 'starred') return list.filter((m) => m.starred && m.folder !== 'trash');
  return list.filter((m) => (m.folder ?? 'inbox') === folder);
}

/** Unread count for one folder — what the launcher badge and drawer show. */
export function unreadCount(
  state: GameState | null | undefined,
  folder: MailFolder = 'inbox'
): number {
  return getMailState(state).messages.reduce(
    (n, m) => n + ((m.folder ?? 'inbox') === folder && !m.read ? 1 : 0),
    0
  );
}

/** Unread count per category, for the tab strip's dots. */
export function unreadByCategory(
  state: GameState | null | undefined
): Record<MailCategory, number> {
  const counts: Record<MailCategory, number> = {
    primary: 0,
    finance: 0,
    promotions: 0,
    social: 0,
  };
  for (const m of getMailState(state).messages) {
    if ((m.folder ?? 'inbox') !== 'inbox' || m.read) continue;
    const cat = (m.category ?? 'primary') as MailCategory;
    if (cat in counts) counts[cat] += 1;
  }
  return counts;
}

/** One message by id, or null. */
export function findMessage(
  state: GameState | null | undefined,
  id: string
): MailMessage | null {
  return getMailState(state).messages.find((m) => m.id === id) ?? null;
}

/**
 * Append messages, dropping any whose id is already present.
 *
 * The id-keyed skip is what makes the weekly generator idempotent: ids encode
 * the week they belong to, so a React 19 double-invoked updater — or a tick
 * replayed after a failed save — produces the same inbox as a single run.
 *
 * Returns the SAME array reference when nothing was added, so a quiet week
 * causes no state churn.
 */
export function appendMessages(
  existing: MailMessage[] | undefined | null,
  additions: readonly MailMessage[]
): MailMessage[] {
  const current = Array.isArray(existing) ? existing : [];
  if (!additions || additions.length === 0) return current;

  const seen = new Set(current.map((m) => m.id));
  const fresh = additions.filter((m) => isMessage(m) && !seen.has(m.id));
  if (fresh.length === 0) return current;

  const next = [...current, ...fresh];
  return next.length > MAX_MAIL_MESSAGES ? next.slice(next.length - MAX_MAIL_MESSAGES) : next;
}

/**
 * The player's own address, derived from their name.
 *
 * Derived rather than stored-on-creation so an existing save gets a sensible
 * one the first time mail is opened, instead of a blank From line.
 */
export function deriveAddress(state: GameState | null | undefined): string {
  const stored = getMailState(state).address;
  if (stored) return stored;
  const name = (state?.userProfile?.name || '').trim();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join('.');
  return `${slug || 'me'}@deepmail.com`;
}
