/**
 * What happens to a letter nobody answered.
 *
 * A deadline the game does not enforce is decoration, so this runs every tick
 * and settles anything past its date. There are two settlements, and the
 * difference between them is the whole point of the feature.
 *
 * ## A routed EVENT stops being deferrable
 *
 * An ignored summons does not evaporate — it comes back demanding an answer.
 * Clearing `channel` hands the event back to `WeeklyEventModal`, which is where
 * it would have appeared all along if mail did not exist. So the consequence of
 * ignoring your post is precisely the thing you were trying to avoid: the
 * decision interrupts you.
 *
 * This is also why the tick does not apply the event's effects itself. It
 * cannot: `resolveEvent` is a React callback with its own updater, and copying
 * its ~200 lines of affordability, karma and follow-up handling into the weekly
 * pipeline would create a second set of rules for what a choice can do. Handing
 * the event back to its own channel keeps one resolver AND produces a better
 * consequence than a silent auto-resolution would have.
 *
 * ## A mail-NATIVE decision settles in place
 *
 * A job offer and an arrears notice have no other channel to fall back to, and
 * both have a defensible default — the offer accepts (matching the auto-accept
 * that already exists), the invoice waits for the weekly collection. Those run
 * through the SAME pure appliers a tap uses, so "ignored it" and "chose the
 * default" cannot drift apart.
 */

import type { GameState, MailMessage } from '@/contexts/game/types';
import { getMailState } from '@/lib/mail/state';
import { applyArrearsPayment, applyCareerOffer } from '@/lib/mail/resolve';
import type { WeeklyEvent } from '@/lib/events/engine';

export interface ApplyMailLapseInput {
  state: GameState;
  /** Absolute `weeksLived` for the tick being processed. */
  week: number;
}

export interface ApplyMailLapseResult {
  /** New state, or null when nothing expired. */
  state: GameState | null;
  /** How many letters settled. For logging only. */
  lapsed: number;
}

export function applyMailLapse(input: ApplyMailLapseInput): ApplyMailLapseResult {
  const week = Math.max(0, Math.floor(input.week ?? 0));
  const mail = getMailState(input.state);
  if (mail.messages.length === 0) return { state: null, lapsed: 0 };

  const expired = mail.messages.filter(
    (m) => m.decision && !m.decision.chosenId && week > m.decision.expiresAtWeek
  );
  if (expired.length === 0) return { state: null, lapsed: 0 };

  let next = input.state;
  const settled = new Map<string, MailMessage>();
  const handBackEventIds: string[] = [];

  for (const message of expired) {
    const decision = message.decision!;
    const choiceId = decision.lapseChoiceId;
    let outcome: string;

    if (decision.resolver.kind === 'event') {
      handBackEventIds.push(decision.resolver.eventId);
      outcome = 'You let this sit. It is not waiting any more.';
    } else if (decision.resolver.kind === 'careerOffer') {
      const applied = applyCareerOffer(next, decision.resolver.careerId, choiceId);
      next = applied.state;
      outcome = `You started without replying. ${applied.outcome}`;
    } else {
      const applied = applyArrearsPayment(next, choiceId);
      next = applied.state;
      outcome = applied.outcome;
    }

    settled.set(message.id, {
      ...message,
      decision: { ...decision, chosenId: choiceId, resolvedAs: 'lapsed', outcome },
    });
  }

  // Rebuild from `next`, not from the captured `mail`: the appliers above may
  // have rewritten state, and reading the stale slice would drop their work.
  const currentMail = getMailState(next);
  const messages = currentMail.messages.map((m) => settled.get(m.id) ?? m);

  const pendingEvents: WeeklyEvent[] =
    handBackEventIds.length > 0 && Array.isArray(next.pendingEvents)
      ? next.pendingEvents.map((e) =>
          e && handBackEventIds.includes(e.id)
            ? { ...e, channel: 'modal' as const, expiresAtWeek: undefined }
            : e
        )
      : (next.pendingEvents ?? []);

  return {
    state: {
      ...next,
      pendingEvents,
      mail: { ...currentMail, messages },
    },
    lapsed: expired.length,
  };
}
