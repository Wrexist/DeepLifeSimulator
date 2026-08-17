/**
 * Which surface an event is delivered to.
 *
 * ## Why this exists
 *
 * Nine events in the catalogue describe themselves, in their own copy, as
 * arriving in the post — a jury duty summons "in the mail", a letter
 * threatening a lawsuit, a revenue-service examination whose "letter is four
 * pages long and entirely polite", a reporter's fact-checking email. All of
 * them presented as a full-screen modal that covers the game and demands an
 * answer before you can do anything else.
 *
 * That is wrong twice. The fiction says letter and the UI says pop-up; and,
 * more importantly, a letter is the one kind of decision that should be
 * allowed to WAIT. Mail is the only surface in this game where it can — every
 * other decision channel blocks. Routing these to the inbox with a deadline
 * turns "answer now" into "answer by week N", which is a different verb and the
 * whole reason the mail app is worth having.
 *
 * ## Why one module
 *
 * Two consumers have to agree about who owns an event: the event inbox pill
 * plus `WeeklyEventModal` on one side, mail on the other. If either grew its
 * own filter, a routed event would either appear in both channels or vanish
 * from both — and the second failure is silent. So both read the selectors
 * here, and nothing filters `pendingEvents` by hand.
 *
 * Routing is decided at DELIVERY time rather than declared on the template.
 * A template is content; where a message is delivered is presentation, and
 * keeping it here means the whole list is readable in one place instead of
 * being a field to hunt for across ~400 templates.
 */

import type { GameState } from '@/contexts/game/types';
import type { WeeklyEvent } from './engine';

/**
 * How long a letter waits before it answers itself.
 *
 * Four weeks — a month in the game's own clock. Long enough that "deal with it
 * later" is genuinely available, short enough that the inbox does not become a
 * pile of undecided things the player has stopped seeing.
 */
export const LETTER_EXPIRY_WEEKS = 4;

/**
 * Events delivered as mail.
 *
 * Every id here is an event whose OWN description already says it arrived as a
 * letter or an email — this list adds no fiction, it just stops contradicting
 * the fiction that was there.
 */
export const LETTER_EVENT_IDS: ReadonlySet<string> = new Set([
  // lib/events/lifeMilestoneEvents.ts
  'jury_duty',
  'lawsuit_threat',
  // lib/events/wealthEvents.ts
  'wealth_tax_audit',
  'wealth_hit_piece',
  'wealth_land_bank_play',
  'wealth_trust_fund_dispute',
  // Legal pack — authored as events precisely so they inherit this routing and
  // the one resolver, instead of becoming a fifth bespoke decision system.
  'legal_parking_fine',
  'legal_speeding_notice',
  'legal_small_claim',
  'legal_settlement_offer',
  // Inbox pack — authored FOR this channel rather than rescued into it. Every
  // one is a letter, an invitation or a parcel in its own copy, and together
  // they are what stops the mail app's decision surface being nothing but
  // bills, summonses and fraud (see lib/events/inboxEvents.ts).
  'inbox_reunion_invite',
  'inbox_mystery_parcel',
  'inbox_time_capsule',
  'inbox_charity_appeal',
  'inbox_wallet_returned',
  'inbox_game_show_casting',
  'inbox_neighbour_petition',
]);

export function isLetterEvent(eventId: string | undefined | null): boolean {
  return typeof eventId === 'string' && LETTER_EVENT_IDS.has(eventId);
}

/**
 * Stamp routing onto freshly generated events.
 *
 * Returns the SAME array reference when nothing needed routing, so the common
 * case costs no allocation and no state churn.
 */
export function routeEvents(events: WeeklyEvent[], atWeek: number): WeeklyEvent[] {
  if (!Array.isArray(events) || events.length === 0) return events;

  let changed = false;
  const routed = events.map((e) => {
    if (!e || e.channel || !isLetterEvent(e.id)) return e;
    changed = true;
    return {
      ...e,
      channel: 'mail' as const,
      expiresAtWeek: Math.max(0, Math.floor(atWeek)) + LETTER_EXPIRY_WEEKS,
    };
  });
  return changed ? routed : events;
}

const EMPTY: WeeklyEvent[] = [];

function allPending(state: GameState | null | undefined): WeeklyEvent[] {
  const list = state?.pendingEvents;
  return Array.isArray(list) ? list : EMPTY;
}

/**
 * Events the blocking modal and the inbox pill own.
 *
 * An event with no `channel` is a modal event — that is every event ever
 * written before this module, so nothing changes for them.
 */
export function modalEvents(state: GameState | null | undefined): WeeklyEvent[] {
  return allPending(state).filter((e) => e && e.channel !== 'mail');
}

/** Events mail owns. */
export function mailEvents(state: GameState | null | undefined): WeeklyEvent[] {
  return allPending(state).filter((e) => e && e.channel === 'mail');
}

/** Count for the inbox pill — mail-routed letters must not inflate it. */
export function modalEventCount(state: GameState | null | undefined): number {
  return modalEvents(state).length;
}

/** Mail-routed events past their deadline, which the tick lapses. */
export function expiredMailEvents(
  state: GameState | null | undefined,
  atWeek: number
): WeeklyEvent[] {
  const week = Math.max(0, Math.floor(atWeek));
  return mailEvents(state).filter(
    (e) => typeof e.expiresAtWeek === 'number' && week > e.expiresAtWeek
  );
}
