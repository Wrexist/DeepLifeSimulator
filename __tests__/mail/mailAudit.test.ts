/**
 * The audit pass over the mail app, in tests.
 *
 * Every case here is a bug that was found by reading the finished feature
 * rather than by a failing test — which is exactly why they are worth pinning.
 * Each one shares a shape: the code type-checked, the happy path worked, and
 * something in the SECOND pass over the same data quietly did nothing.
 *
 *   - a defensive accessor that enumerated fields dropped the ones added later
 *   - a helper whose skip condition is reference equality had a caller that
 *     always built a fresh object, so "no change" never registered
 *   - a lapse pass driven by the letter stranded the decision when the letter
 *     was deleted
 *   - a "once ever" gate keyed on the inbox being empty re-fired once the
 *     inbox was emptied
 *   - an id keyed on the thing rather than on the attempt delivered the second
 *     one never
 *
 * None of these throw. All of them are silent. That is the class this file
 * exists to catch.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import { applyMail } from '@/contexts/game/actions/weekly/applyMail';
import { applyMailLapse } from '@/contexts/game/actions/weekly/applyMailLapse';
import {
  emptyMailBin,
  moveMail,
  reportMailPhishing,
} from '@/contexts/game/actions/MailActions';
import { letterFromEvent } from '@/lib/mail/letters';
import { arrearsInvoice, jobOfferLetter } from '@/lib/mail/offers';
import { getMailState } from '@/lib/mail/state';
import { mailEvents, modalEventCount, routeEvents } from '@/lib/events/routing';
import { MAIL_TEMPLATES } from '@/lib/mail/templates';
import { protections, shieldActive } from '@/lib/mail/security';
import type { GameState, MailAttachment } from '@/contexts/game/types';
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

const summons = (): WeeklyEvent =>
  routeEvents(
    [
      {
        id: 'jury_duty',
        description: 'You receive a jury duty summons in the mail.',
        choices: [
          { id: 'serve', text: 'Serve', effects: {} },
          { id: 'excuse', text: 'Seek an excusal', effects: {} },
        ],
      },
    ],
    100
  )[0];

// ---------------------------------------------------------------------------

describe('a deleted letter cannot strand the decision it carried', () => {
  it('hands the event back to the modal even with no message left to stamp', () => {
    // Trash the summons, empty the bin, then let the deadline pass. The first
    // implementation scanned `mail.messages` for expired decisions, so with the
    // letter gone nothing lapsed it: `channel` stayed 'mail', `modalEvents`
    // never returned it, and the decision was unreachable in BOTH surfaces
    // forever.
    const event = summons();
    const letter = letterFromEvent(event, 100)!;
    const state = createTestGameState({ pendingEvents: [event] });
    state.mail = { messages: [letter] };
    const h = harness(state);

    moveMail(h.setGameState, letter.id, 'trash');
    emptyMailBin(h.setGameState, 'trash');
    expect(getMailState(h.get()).messages).toHaveLength(0);

    const result = applyMailLapse({ state: h.get(), week: 105 });

    expect(result.state).not.toBeNull();
    expect(result.lapsed).toBe(1);
    expect(modalEventCount(result.state!)).toBe(1);
    expect(mailEvents(result.state!)).toHaveLength(0);
  });

  it('clears the deadline when it hands back, so it cannot lapse twice', () => {
    const event = summons();
    const state = createTestGameState({ pendingEvents: [event] });
    state.mail = { messages: [letterFromEvent(event, 100)!] };

    const first = applyMailLapse({ state, week: 105 }).state!;
    expect(first.pendingEvents![0].expiresAtWeek).toBeUndefined();
    expect(applyMailLapse({ state: first, week: 200 }).state).toBeNull();
  });

  it('still stamps the letter when it is only trashed, not deleted', () => {
    const event = summons();
    const letter = letterFromEvent(event, 100)!;
    const state = createTestGameState({ pendingEvents: [event] });
    state.mail = { messages: [letter] };
    const h = harness(state);

    moveMail(h.setGameState, letter.id, 'trash');
    const result = applyMailLapse({ state: h.get(), week: 105 })!;

    const stamped = getMailState(result.state!).messages[0];
    expect(stamped.decision!.resolvedAs).toBe('lapsed');
    expect(stamped.folder).toBe('trash');
  });
});

// ---------------------------------------------------------------------------

describe('the welcome is once per life, not once per empty inbox', () => {
  const fresh = () => createTestGameState({ weeksLived: 208 });

  it('does not come back after the player empties the bin', () => {
    // The gate was "the inbox is empty", which is true again the moment
    // everything is deleted — so a tidy player got welcomed to DeepMail a
    // second time, at week 300, addressed as a new account holder.
    const first = applyMail({ state: fresh(), week: 208, facts: {} });
    expect(first.state).not.toBeNull();
    const h = harness(first.state!);
    expect(
      getMailState(h.get()).messages.some((m) => m.id.startsWith('mail-welcome'))
    ).toBe(true);

    for (const m of getMailState(h.get()).messages) {
      moveMail(h.setGameState, m.id, 'trash');
    }
    emptyMailBin(h.setGameState, 'trash');
    expect(getMailState(h.get()).messages).toHaveLength(0);

    for (let w = 209; w <= 320; w += 1) {
      const step = applyMail({ state: h.get(), week: w, facts: {} });
      if (step.state) h.setGameState(() => step.state!);
    }

    const welcomes = getMailState(h.get()).messages.filter((m) =>
      m.id.startsWith('mail-welcome')
    );
    expect(welcomes).toHaveLength(0);
  });

  it('is gated on the generation marker, which survives an empty inbox', () => {
    const after = applyMail({ state: fresh(), week: 208, facts: {} }).state!;
    expect(getMailState(after).lastGeneratedWeek).toBe(208);
  });
});

// ---------------------------------------------------------------------------

describe('a second application gets a second offer letter', () => {
  const applicant = (attempts: number): GameState =>
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
          applicationAttempts: attempts,
        },
      ],
    });

  it('keys the id on the attempt, not just the employer', () => {
    // Keyed on the career id alone, a player who declined and re-applied got
    // an id that already existed in their inbox — so the dedupe dropped the
    // new offer and they waited for a letter that could never arrive.
    const first = jobOfferLetter(applicant(1), 100)!;
    const second = jobOfferLetter(applicant(2), 140)!;
    expect(first.id).not.toBe(second.id);
  });

  it('keeps the id stable across weeks within one attempt', () => {
    // The other half of the same property: it must not be keyed on the week
    // either, or the offer would be redelivered every tick it is pending.
    expect(jobOfferLetter(applicant(1), 100)!.id).toBe(
      jobOfferLetter(applicant(1), 101)!.id
    );
  });

  it('treats a save with no attempt counter as attempt one', () => {
    const legacy = applicant(1);
    delete (legacy.careers[0] as { applicationAttempts?: number }).applicationAttempts;
    expect(jobOfferLetter(legacy, 100)!.id).toBe(jobOfferLetter(applicant(1), 100)!.id);
  });
});

// ---------------------------------------------------------------------------

describe('the safe reader passes through fields it does not know about', () => {
  it('preserves the security fields, so a paid shield is not thrown away', () => {
    // `getMailState` rebuilt the object field by field. Two fields added later
    // were not in the list, so every read erased them: rotating credentials
    // charged the player and the protection vanished on the next read.
    const state = createTestGameState({});
    state.mail = {
      messages: [],
      lastGeneratedWeek: 100,
      shieldUntilWeek: 140,
      reportsMade: 3,
    };

    const read = getMailState(state);
    expect(read.shieldUntilWeek).toBe(140);
    expect(read.reportsMade).toBe(3);
    expect(shieldActive(state, 120)).toBe(true);
    expect(protections(state, 120).some((p) => /rotat|credential/i.test(p))).toBe(true);
  });

  it('preserves a field it has never heard of - the property, not the two symptoms', () => {
    // The version above only pins the two fields that were dropped, and both
    // are now named in the reader. Deleting the spread would still pass it,
    // which makes it a test of the fix rather than of the bug: the NEXT field
    // added to `MailState` would vanish exactly as those two did.
    //
    // This asserts the actual invariant — an unrecognised key survives the
    // read — so the accessor cannot go back to enumerating whatever the field
    // list happens to look like at the time.
    const state = createTestGameState({});
    state.mail = { messages: [], futureField: 'kept' } as never;

    expect((getMailState(state) as unknown as Record<string, unknown>).futureField).toBe(
      'kept'
    );
  });

  it('still normalises a malformed shape rather than trusting it', () => {
    const state = createTestGameState({});
    state.mail = {
      messages: [null, 'nope', { id: 'x' }],
      shieldUntilWeek: 'soon',
      reportsMade: -4,
    } as never;

    const read = getMailState(state);
    expect(read.messages).toEqual([]);
    expect(read.shieldUntilWeek).toBeUndefined();
    expect(read.reportsMade).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('reporting the same message twice is not two reports', () => {
  it('does not let one message farm the vigilance discount', () => {
    const state = createTestGameState({});
    state.mail = {
      messages: [
        {
          id: 'mail-scam-1',
          senderName: 'Bank Security',
          senderEmail: 'security@deeplifebank-verify.com',
          subject: 'Confirm your account',
          preview: '',
          body: '',
          atWeek: 100,
          read: false,
          starred: false,
          folder: 'inbox',
          category: 'finance',
          scam: { lossFraction: 0.2, tells: ['lookalike domain'] },
        },
      ],
    };
    const h = harness(state);

    for (let i = 0; i < 10; i += 1) reportMailPhishing(h.setGameState, 'mail-scam-1');

    expect(getMailState(h.get()).reportsMade).toBe(1);
    expect(getMailState(h.get()).messages[0].folder).toBe('spam');
  });
});

// ---------------------------------------------------------------------------

describe('every attachment layout the renderer supports is actually produced', () => {
  it('emits every one of the six document kinds', () => {
    // The RECEIPT branch of `MailDocument` sat unreachable: a layout with no
    // producer that could ever select it. This asserts the union is total in
    // both directions, so any layout added from here on has to earn its place
    // — and any producer that stops firing is caught rather than assumed.
    const rich = createTestGameState({
      currentJob: 'tech',
      careers: [
        {
          id: 'tech',
          levels: [{ name: 'Engineer', salary: 1500 }],
          level: 0,
          description: '',
          requirements: {} as never,
          progress: 0,
          applied: true,
          accepted: true,
        },
      ],
      loans: [
        {
          id: 'loan-1',
          name: 'Personal loan',
          principal: 20000,
          remaining: 14200,
          rateAPR: 0.11,
          termWeeks: 156,
          weeklyPayment: 160,
          startWeek: 10,
          autoPay: true,
          type: 'personal',
          weeksRemaining: 100,
          interestRate: 0.11,
        },
      ],
      dietPlans: [
        {
          id: 'diet-1',
          name: 'Lean Bulk',
          description: '',
          dailyCost: 12,
          healthGain: 1,
          energyGain: 1,
          active: true,
        },
      ],
      vehicles: [
        {
          id: 'car-1',
          name: 'Grey Hatchback',
          type: 'car',
          brand: 'Meridian',
          model: 'C1',
          year: 2019,
          price: 14000,
          condition: 62,
          fuelLevel: 70,
          fuelCapacity: 50,
          fuelEfficiency: 34,
          mileage: 41000,
          weeklyMaintenanceCost: 25,
          weeklyFuelCost: 30,
          maxSpeed: 190,
          owned: true,
          reputationBonus: 0,
          speedBonus: 0,
          insurance: {
            type: 'comprehensive',
            active: true,
            coveragePercent: 80,
            expiresWeek: 500,
            monthlyCost: 120,
          },
        },
      ],
    });
    rich.stats.money = 60000;

    const kinds = new Set<MailAttachment['kind']>();
    const collect = (m: { attachment?: MailAttachment } | null) => {
      if (m?.attachment) kinds.add(m.attachment.kind);
    };

    for (let w = 0; w < 120; w += 1) {
      for (const template of MAIL_TEMPLATES) {
        collect(
          template({
            state: rich,
            week: w,
            facts: {
              careerSalary: 1500,
              totalIncome: 1700,
              passiveIncome: 200,
              incomeTax: 240,
              weeklyRent: 420,
              loanPaid: 160,
              loanPenalty: 0,
              savingsInterest: 14,
            },
            rand: () => 0.5,
          })
        );
      }
    }

    // The two mail-native documents are not templates — they read career and
    // banking state directly — so they are exercised by their own producers.
    const applicant = createTestGameState({
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
    collect(jobOfferLetter(applicant, 100));
    collect(arrearsInvoice(createTestGameState({ overdueBalance: 900 }), 100));

    expect([...kinds].sort()).toEqual([
      'contract',
      'invoice',
      'notice',
      'payslip',
      'receipt',
      'statement',
    ]);
  });

  it('adds up the recurring-charges receipt to the sum of its rows', () => {
    // The total is parsed back out of the formatted strings, so a thousands
    // separator in a row would silently truncate it.
    const rich = createTestGameState({
      dietPlans: [
        {
          id: 'diet-1',
          name: 'Lean Bulk',
          description: '',
          dailyCost: 40,
          healthGain: 1,
          energyGain: 1,
          active: true,
        },
      ],
    });

    let receipt: MailAttachment | undefined;
    for (let w = 0; w < 24 && !receipt; w += 1) {
      for (const template of MAIL_TEMPLATES) {
        const message = template({ state: rich, week: w, facts: {}, rand: () => 0.5 });
        if (message?.attachment?.kind === 'receipt') receipt = message.attachment;
      }
    }

    expect(receipt).toBeDefined();
    const rowSum = receipt!.rows.reduce(
      (n, r) => n + Number(r.value.replace(/[$,]/g, '')),
      0
    );
    expect(receipt!.total!.value).toBe(
      `$${rowSum.toLocaleString('en-US')}.00`
    );
    expect(rowSum).toBeGreaterThan(1000);
  });
});
