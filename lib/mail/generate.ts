/**
 * The weekly mail generator.
 *
 * Deterministic in `(week, salt)` — no `Math.random`, no device clock. The same
 * week always produces the same inbox, which is what lets the whole thing run
 * inside a `setGameState` updater that React 19 may invoke twice, and what lets
 * a tick replayed after a failed save land in the same place.
 *
 * Bounded by construction: a hard cap on messages per week, on top of the
 * `MAX_MAIL_MESSAGES` ceiling `appendMessages` enforces.
 */

import type { GameState, MailMessage } from '@/contexts/game/types';
import { MAIL_TEMPLATES } from './templates';
import { generateScam } from './scam';
import type { MailContext, MailFacts } from './types';

/**
 * Ceiling per week.
 *
 * Several documents are on 4-week cycles at different offsets precisely so they
 * do not collide, but a leap in `weeksLived` (a debug jump, a migration) could
 * still line them up. Three is enough that nothing important is silently
 * dropped and few enough that one week never buries the last.
 */
export const MAX_MESSAGES_PER_WEEK = 3;

/** Deterministic 0..1 from a week and a salt string. */
function makeRand(week: number): (salt: string) => number {
  return (salt: string) => {
    let h = Math.floor(week) * 2654435761;
    for (let i = 0; i < salt.length; i += 1) {
      h = (h * 31 + salt.charCodeAt(i)) | 0;
    }
    // sin-based hash, the same shape used by the seasonal-event and
    // wealth-event generators — cheap, stable across platforms, no state.
    const x = Math.sin(h) * 10000;
    return x - Math.floor(x);
  };
}

export interface GenerateMailInput {
  state: GameState;
  week: number;
  facts?: MailFacts;
}

/**
 * Build this week's messages. Pure — the caller decides what to do with them.
 *
 * A template that throws is skipped rather than allowed to take the week with
 * it: mail is the least important thing happening in a tick and must never be
 * the reason a week is lost (§4.3).
 */
export function generateWeeklyMail(input: GenerateMailInput): MailMessage[] {
  const week = Math.max(0, Math.floor(input.week ?? 0));
  const ctx: MailContext = {
    state: input.state,
    week,
    facts: input.facts ?? {},
    rand: makeRand(week),
  };

  const out: MailMessage[] = [];

  for (const template of MAIL_TEMPLATES) {
    if (out.length >= MAX_MESSAGES_PER_WEEK) break;
    try {
      const message = template(ctx);
      if (message) out.push(message);
    } catch {
      // A broken template drops its own message and nothing else.
    }
  }

  // The scam is rolled LAST and outside the per-week cap on purpose. It is the
  // one message the feature exists for, and letting three routine invoices
  // crowd it out would make the risk the player has earned invisible in exactly
  // the weeks they have earned the most of it.
  try {
    const scam = generateScam(ctx);
    if (scam) out.push(scam);
  } catch {
    // Same contract as above.
  }

  return out;
}
