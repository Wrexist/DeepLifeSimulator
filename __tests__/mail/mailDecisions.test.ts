/**
 * Decisions with a deadline — the thing mail can do that no other surface can.
 *
 * The routing tests are the load-bearing ones. A letter that appears in BOTH
 * the blocking modal and the inbox is annoying; one that appears in NEITHER is
 * a decision the player can never make and never sees, and that failure is
 * completely silent. Both channels read the same selectors precisely so neither
 * can drift, and these assert that they agree.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import {
  LETTER_EVENT_IDS,
  expiredMailEvents,
  isLetterEvent,
  mailEvents,
  modalEventCount,
  modalEvents,
  routeEvents,
} from '@/lib/events/routing';
import { letterFromEvent } from '@/lib/mail/letters';
import { arrearsInvoice, jobOfferLetter, OFFER_EXPIRY_WEEKS } from '@/lib/mail/offers';
import { applyArrearsPayment, applyCareerOffer } from '@/lib/mail/resolve';
import { applyMailLapse } from '@/contexts/game/actions/weekly/applyMailLapse';
import { chooseMailDecision } from '@/contexts/game/actions/MailActions';
import { getMailState } from '@/lib/mail/state';
import { eventTemplates } from '@/lib/events/engine';
import type { GameState } from '@/contexts/game/types';
import type { WeeklyEvent } from '@/lib/events/engine';

function harness(initial: GameState) {
  let state = initial;
  return {
    setGameState: (u: (prev: GameState) => GameState) => {
      state = u(state);
    },
    get: () => state,
  };
}

const letterEvent = (id = 'jury_duty'): WeeklyEvent => ({
  id,
  description: 'You receive a jury duty summons in the mail.',
  choices: [
    { id: 'serve', text: 'Serve', effects: {} },
    { id: 'excuse', text: 'Seek an excusal', effects: {} },
  ],
});

const plainEvent = (): WeeklyEvent => ({
  id: 'office_gossip',
  description: 'A coworker tells you some gossip.',
  choices: [{ id: 'share', text: 'Share it', effects: {} }],
});

describe('routing - exactly one channel owns an event', () => {
  it('routes letter-shaped events to mail and leaves everything else alone', () => {
    const routed = routeEvents([letterEvent(), plainEvent()], 100);
    expect(routed[0].channel).toBe('mail');
    expect(routed[0].expiresAtWeek).toBe(104);
    expect(routed[1].channel).toBeUndefined();
  });

  it('returns the same array when nothing needed routing', () => {
    const input = [plainEvent()];
    expect(routeEvents(input, 100)).toBe(input);
  });

  it('never puts one event in both channels, or in neither', () => {
    const state = createTestGameState({
      pendingEvents: routeEvents([letterEvent(), plainEvent()], 100),
    });

    const inModal = modalEvents(state).map((e) => e.id);
    const inMail = mailEvents(state).map((e) => e.id);

    expect(inModal).toEqual(['office_gossip']);
    expect(inMail).toEqual(['jury_duty']);
    // The partition is total and disjoint — the property that matters.
    expect([...inModal, ...inMail].sort()).toEqual(['jury_duty', 'office_gossip']);
    expect(inModal.filter((id) => inMail.includes(id))).toHaveLength(0);
  });

  it('keeps mail-routed letters out of the inbox pill count', () => {
    const state = createTestGameState({
      pendingEvents: routeEvents([letterEvent(), plainEvent()], 100),
    });
    expect(modalEventCount(state)).toBe(1);
  });

  it('treats an unrouted event as a modal event, so old saves are unchanged', () => {
    const state = createTestGameState({ pendingEvents: [letterEvent(), plainEvent()] });
    expect(modalEvents(state)).toHaveLength(2);
    expect(mailEvents(state)).toHaveLength(0);
  });

  it('every routed id is a real, registered event template', () => {
    // A typo here would silently route nothing — the set would just never match.
    const registered = new Set(eventTemplates.map((t) => t.id));
    const missing = [...LETTER_EVENT_IDS].filter((id) => !registered.has(id));
    expect(missing).toEqual([]);
  });
});

describe('letters carry the event, not a copy of it', () => {
  it('uses the event choices verbatim so the two channels cannot disagree', () => {
    const event = routeEvents([letterEvent()], 100)[0];
    const letter = letterFromEvent(event, 100)!;

    expect(letter.decision!.choices.map((c) => c.id)).toEqual(['serve', 'excuse']);
    expect(letter.decision!.choices.map((c) => c.label)).toEqual(['Serve', 'Seek an excusal']);
    expect(letter.decision!.resolver).toEqual({ kind: 'event', eventId: 'jury_duty' });
  });

  it('keys the message on the event, not the week, so it is delivered once', () => {
    const event = routeEvents([letterEvent()], 100)[0];
    expect(letterFromEvent(event, 100)!.id).toBe(letterFromEvent(event, 103)!.id);
  });

  it('lapses to the LAST choice - the passive one by template convention', () => {
    const event = routeEvents([letterEvent()], 100)[0];
    expect(letterFromEvent(event, 100)!.decision!.lapseChoiceId).toBe('excuse');
  });

  it('still delivers an unframed letter rather than dropping it', () => {
    const unknown: WeeklyEvent = {
      ...letterEvent('legal_small_claim'),
      channel: 'mail',
      expiresAtWeek: 104,
    };
    expect(letterFromEvent(unknown, 100)).not.toBeNull();
  });
});

describe('the job offer', () => {
  const applied = (): GameState =>
    createTestGameState({
      currentJob: undefined,
      careers: [
        {
          id: 'tech',
          levels: [{ name: 'Engineer', salary: 1200 }],
          level: 0,
          description: '',
          requirements: {} as never,
          progress: 0,
          applied: true,
          accepted: false,
        },
      ],
    });

  it('quotes the real salary and expires before the auto-accept could', () => {
    const letter = jobOfferLetter(applied(), 100)!;
    expect(letter.attachment!.rows[1].value).toBe('$1,200.00');
    expect(letter.decision!.expiresAtWeek).toBe(100 + OFFER_EXPIRY_WEEKS);
  });

  it('is not sent to someone who already has a job', () => {
    const employed = applied();
    employed.currentJob = 'tech';
    expect(jobOfferLetter(employed, 100)).toBeNull();
  });

  it('accepting starts the job', () => {
    const { state, outcome } = applyCareerOffer(applied(), 'tech', 'accept');
    expect(state.currentJob).toBe('tech');
    expect(state.careers.find((c) => c.id === 'tech')!.accepted).toBe(true);
    expect(outcome).toMatch(/signed/i);
  });

  it('negotiating writes the SAME field the raise system uses, within its cap', () => {
    const { state } = applyCareerOffer(applied(), 'tech', 'negotiate');
    const career = state.careers.find((c) => c.id === 'tech')!;
    expect(career.raiseMultiplier).toBeGreaterThan(1);
    // The raise ladder caps at 2.0 and this must live under the same ceiling.
    expect(career.raiseMultiplier).toBeLessThanOrEqual(2);
  });

  it('declining withdraws the application and leaves them unemployed', () => {
    const { state } = applyCareerOffer(applied(), 'tech', 'decline');
    expect(state.currentJob).toBeUndefined();
    expect(state.careers.find((c) => c.id === 'tech')!.applied).toBe(false);
  });

  it('refuses to un-hire someone the auto-accept already started', () => {
    const started = applied();
    started.currentJob = 'tech';
    started.careers[0].accepted = true;
    const { state, outcome } = applyCareerOffer(started, 'tech', 'decline');
    expect(state.currentJob).toBe('tech');
    expect(outcome).toMatch(/already started/i);
  });

  it('LAPSING ACCEPTS - a player who never opens mail lands where they do today', () => {
    // The floor must not move. Auto-accept is the existing behaviour; reading
    // your mail earns the extra options, ignoring it costs nothing.
    const state = applied();
    const letter = jobOfferLetter(state, 100)!;
    state.mail = { messages: [letter] };

    const result = applyMailLapse({ state, week: 100 + OFFER_EXPIRY_WEEKS + 1 });
    expect(result.state).not.toBeNull();
    expect(result.state!.currentJob).toBe('tech');
    expect(getMailState(result.state!).messages[0].decision!.resolvedAs).toBe('lapsed');
  });
});

describe('payable arrears - the first action on overdueBalance', () => {
  const owing = (overdue: number, cash: number): GameState => {
    const s = createTestGameState({ overdueBalance: overdue });
    s.stats.money = cash;
    return s;
  };

  it('clears the balance and charges exactly it', () => {
    const { state } = applyArrearsPayment(owing(500, 2000), 'pay');
    expect(state.overdueBalance).toBe(0);
    expect(state.stats.money).toBe(1500);
  });

  it('pays what it can and leaves the rest, never going negative', () => {
    const { state } = applyArrearsPayment(owing(2000, 500), 'pay');
    expect(state.stats.money).toBe(0);
    expect(state.overdueBalance).toBe(1500);
  });

  it('is a no-op on an empty account', () => {
    const before = owing(2000, 0);
    const { state, outcome } = applyArrearsPayment(before, 'pay');
    expect(state).toBe(before);
    expect(outcome).toMatch(/nothing in the account/i);
  });

  it('charges once when the button is double-tapped in one batch', () => {
    const state = owing(500, 2000);
    const invoice = arrearsInvoice(state, 103)!;
    state.mail = { messages: [invoice] };
    const h = harness(state);

    chooseMailDecision(h.get(), h.setGameState, invoice.id, 'pay', () => undefined);
    chooseMailDecision(h.get(), h.setGameState, invoice.id, 'pay', () => undefined);

    expect(h.get().stats.money).toBe(1500);
    expect(h.get().overdueBalance).toBe(0);
  });
});

describe('an ignored letter stops being deferrable', () => {
  it('hands an expired event back to the blocking modal', () => {
    const event = routeEvents([letterEvent()], 100)[0];
    const letter = letterFromEvent(event, 100)!;
    const state = createTestGameState({ pendingEvents: [event] });
    state.mail = { messages: [letter] };

    // Before: mail owns it, the pill does not count it.
    expect(modalEventCount(state)).toBe(0);
    expect(expiredMailEvents(state, 105)).toHaveLength(1);

    const result = applyMailLapse({ state, week: 105 });
    expect(result.state).not.toBeNull();

    // After: the summons is not waiting any more — it interrupts.
    expect(modalEventCount(result.state!)).toBe(1);
    expect(mailEvents(result.state!)).toHaveLength(0);
    expect(getMailState(result.state!).messages[0].decision!.resolvedAs).toBe('lapsed');
  });

  it('does nothing before the deadline', () => {
    const event = routeEvents([letterEvent()], 100)[0];
    const state = createTestGameState({ pendingEvents: [event] });
    state.mail = { messages: [letterFromEvent(event, 100)!] };

    expect(applyMailLapse({ state, week: 103 }).state).toBeNull();
  });

  it('is idempotent - a resolved decision cannot lapse a second time', () => {
    const event = routeEvents([letterEvent()], 100)[0];
    const state = createTestGameState({ pendingEvents: [event] });
    state.mail = { messages: [letterFromEvent(event, 100)!] };

    const first = applyMailLapse({ state, week: 105 }).state!;
    expect(applyMailLapse({ state: first, week: 106 }).state).toBeNull();
  });
});

describe('choosing is one-shot', () => {
  it('a second tap on the same decision changes nothing', () => {
    const event = routeEvents([letterEvent()], 100)[0];
    const letter = letterFromEvent(event, 100)!;
    const state = createTestGameState({ pendingEvents: [event] });
    state.mail = { messages: [letter] };
    const h = harness(state);

    const delegations: unknown[] = [];
    chooseMailDecision(h.get(), h.setGameState, letter.id, 'serve', (r) =>
      delegations.push(r.delegateToEvent)
    );
    chooseMailDecision(h.get(), h.setGameState, letter.id, 'excuse', (r) =>
      delegations.push(r.delegateToEvent)
    );

    // Only the first tap delegates to the resolver; the second is rejected.
    expect(delegations[0]).toEqual({ eventId: 'jury_duty', choiceId: 'serve' });
    expect(delegations[1]).toBeUndefined();
    expect(getMailState(h.get()).messages[0].decision!.chosenId).toBe('serve');
  });
});
