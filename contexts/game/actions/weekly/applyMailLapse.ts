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
 * ## The event pass is driven by the EVENT, not by the letter
 *
 * The first version scanned `mail.messages` for expired decisions and handed
 * back the events it found there. That stranded any routed event whose letter
 * had been deleted — trashed and then emptied, or pruned by the 50-message cap.
 * The message was gone, so nothing lapsed it; `channel` stayed `'mail'`, so
 * `modalEvents` never returned it either. The decision vanished from BOTH
 * surfaces and could never be made again, which is the exact silent failure
 * `lib/events/routing.ts` was written to prevent — reintroduced one layer up.
 *
 * So the event pass reads `expiredMailEvents(state)` and stamps the letter only
 * if it still exists. The event is the source of truth; the letter is a view of
 * it.
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
import {
  applyArrearsPayment,
  applyCareerOffer,
  applyExtortion,
  applyRecruiterLeverage,
  applySecurityShield,
} from '@/lib/mail/resolve';
import { expiredMailEvents } from '@/lib/events/routing';
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

  // ── Pass 1: routed events past their deadline ────────────────────────────
  // Driven by `pendingEvents`, so a deleted letter cannot strand the decision.
  const staleEvents = expiredMailEvents(input.state, week);
  const staleEventIds = new Set(staleEvents.map((e) => e.id));

  // ── Pass 2: mail-native decisions past their deadline ────────────────────
  const mail = getMailState(input.state);
  const expiredNative = mail.messages.filter(
    (m) =>
      m.decision &&
      !m.decision.chosenId &&
      m.decision.resolver.kind !== 'event' &&
      week > m.decision.expiresAtWeek
  );

  if (staleEvents.length === 0 && expiredNative.length === 0) {
    return { state: null, lapsed: 0 };
  }

  let next = input.state;
  const settled = new Map<string, MailMessage>();

  for (const message of expiredNative) {
    const decision = message.decision!;
    const choiceId = decision.lapseChoiceId;
    const resolver = decision.resolver;
    let outcome: string;

    switch (resolver.kind) {
      case 'careerOffer': {
        const applied = applyCareerOffer(next, resolver.careerId, choiceId);
        next = applied.state;
        outcome = `You started without replying. ${applied.outcome}`;
        break;
      }
      case 'payArrears': {
        const applied = applyArrearsPayment(next, choiceId);
        next = applied.state;
        outcome = applied.outcome;
        break;
      }
      case 'recruiterLeverage': {
        const applied = applyRecruiterLeverage(next, resolver.careerId, choiceId, week);
        next = applied.state;
        outcome = applied.outcome;
        break;
      }
      case 'securityShield': {
        const applied = applySecurityShield(next, choiceId, resolver.cost, resolver.weeks, week);
        next = applied.state;
        outcome = applied.outcome;
        break;
      }
      case 'extortion': {
        const applied = applyExtortion(next, choiceId, resolver.demand);
        next = applied.state;
        outcome = applied.outcome;
        break;
      }
      // `event` is filtered out above — it is settled by pass 1.
      default:
        outcome = '';
    }

    settled.set(message.id, {
      ...message,
      decision: { ...decision, chosenId: choiceId, resolvedAs: 'lapsed', outcome },
    });
  }

  // Stamp the letters for the expired events, where they still exist.
  if (staleEventIds.size > 0) {
    for (const message of getMailState(next).messages) {
      const resolver = message.decision?.resolver;
      if (
        resolver?.kind === 'event' &&
        staleEventIds.has(resolver.eventId) &&
        !message.decision!.chosenId
      ) {
        settled.set(message.id, {
          ...message,
          decision: {
            ...message.decision!,
            chosenId: message.decision!.lapseChoiceId,
            resolvedAs: 'lapsed',
            outcome: 'You let this sit. It is not waiting any more.',
          },
        });
      }
    }
  }

  // Rebuild from `next`, not from the captured `mail`: the appliers above may
  // have rewritten state (and `applyRecruiterLeverage` appends a reply), so
  // reading the stale slice would drop their work.
  const currentMail = getMailState(next);
  const messages = currentMail.messages.map((m) => settled.get(m.id) ?? m);

  const pendingEvents: WeeklyEvent[] =
    staleEventIds.size > 0 && Array.isArray(next.pendingEvents)
      ? next.pendingEvents.map((e) =>
          e && staleEventIds.has(e.id)
            ? { ...e, channel: 'modal' as const, expiresAtWeek: undefined }
            : e
        )
      : (next.pendingEvents ?? []);

  return {
    state: { ...next, pendingEvents, mail: { ...currentMail, messages } },
    lapsed: staleEvents.length + expiredNative.length,
  };
}
