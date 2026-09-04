/**
 * The journal finally gets a writer.
 *
 * `journal: JournalEntry[]` has shipped in `initialState` since the beginning,
 * has a full reader (`components/Journal.tsx`, with search, category filters and
 * a detail view), a pruner in `saveQueue`, and a consumer in the life-story
 * generator — and **no writer anywhere in the repo**. So `Journal.tsx` always
 * rendered its empty state, on the same Progress screen the Help FAQ tells
 * players to visit.
 *
 * Combined with the muted `info` channel, that left the player with no way at
 * all to review a week. Fixing both is one idea: the same weekly notifications
 * that now surface as transient messages also become a permanent, scrollable
 * record.
 *
 * ## Idempotence
 *
 * This runs INSIDE the week updater, and React 19 StrictMode / concurrent
 * rendering can invoke an updater twice — the `R10-2` dedupe on the notification
 * flush exists for exactly that reason. So entries are keyed by the
 * notification id (which already encodes the week, e.g. `arrears-312`) and
 * appended only when that key is absent. A double-invoked updater produces the
 * same journal as a single one.
 */

import type { JournalEntry } from '@/contexts/game/types';

export interface WeekNotificationLike {
  id: string;
  title: string;
  message: string;
}

/**
 * Keep the journal bounded. `saveQueue` already prunes to 50 on write; matching
 * it here means the in-memory array never grows past what will be persisted, so
 * the UI and the save agree.
 */
export const MAX_JOURNAL_ENTRIES = 50;

/**
 * Notifications that are noise in a permanent record.
 *
 * The transient channel and the journal want different things: a "This week"
 * roll-up or an ad-courtesy note is useful for two seconds and worthless a
 * hundred weeks later. Anything matching these is shown but not recorded.
 */
const EXCLUDED_ID_PREFIXES = ['weekly-summary', 'ad-', 'promo-', 'daily-'];

function isWorthRecording(n: WeekNotificationLike): boolean {
  if (!n?.id || typeof n.id !== 'string') return false;
  if (!n.title?.trim() && !n.message?.trim()) return false;
  return !EXCLUDED_ID_PREFIXES.some((prefix) => n.id.startsWith(prefix));
}

/**
 * Derive the tags the reader's category filter keys off.
 *
 * `Journal.tsx` derives its category from the title/details text, so tags are
 * additive metadata rather than the thing the UI depends on — a tag that misses
 * simply means the entry categorises from its words, exactly as it would have.
 */
function tagsFor(n: WeekNotificationLike): string[] {
  const text = `${n.title} ${n.message}`.toLowerCase();
  const tags: string[] = ['week'];
  if (/job|work|career|promot|hired|salary|fired/.test(text)) tags.push('career');
  if (/rent|overdue|bill|loan|debt|tax|paid/.test(text)) tags.push('money');
  // "friend", "drifted apart", "estranged" and "strained" were all missing, so
  // the three things that can actually END or damage a relationship — a
  // friendship fading, a growing-distant notice, a neglect warning — were filed
  // as plain 'week' entries and vanished from the Journal's relationship
  // filter. Measured in Program 11: over 1,750 simulated persona-weeks the only
  // entries the filter ever showed were NPC life-event flavour.
  if (/married|partner|date|broke up|divorce|relationship|friend|drifted|estranged|strained/.test(text))
    tags.push('relationship');
  if (/child|baby|heir|family|born|grandchild/.test(text)) tags.push('family');
  if (/health|sick|disease|injur|hospital/.test(text)) tags.push('health');
  return tags;
}

/**
 * Append this week's notable events to the journal.
 *
 * Returns the SAME array reference when nothing was recorded, so a quiet week
 * causes no state churn in the tick.
 */
export function appendWeekToJournal(
  existing: JournalEntry[] | undefined | null,
  notifications: readonly WeekNotificationLike[] | undefined | null,
  atWeek: number
): JournalEntry[] {
  const current = Array.isArray(existing) ? existing : [];
  if (!Array.isArray(notifications) || notifications.length === 0) return current;

  const seen = new Set(current.map((e) => e?.id).filter(Boolean) as string[]);
  const additions: JournalEntry[] = [];

  for (const n of notifications) {
    if (!isWorthRecording(n)) continue;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    additions.push({
      id: n.id,
      atWeek: Number.isFinite(atWeek) ? Math.floor(atWeek) : 0,
      title: (n.title || 'This week').trim(),
      details: (n.message || '').trim(),
      tags: tagsFor(n),
    });
  }

  if (additions.length === 0) return current;

  const next = [...current, ...additions];
  return next.length > MAX_JOURNAL_ENTRIES ? next.slice(-MAX_JOURNAL_ENTRIES) : next;
}
