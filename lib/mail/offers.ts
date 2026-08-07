/**
 * The two decisions mail owns outright: a job offer and a payable bill.
 *
 * Unlike the routed letters, these are not events — they are read from career
 * and banking state that no event template can see. They still use the same
 * `MailDecision` shape and the same one-shot resolution, so the inbox has ONE
 * way to ask a question regardless of who is asking it.
 */

import type { GameState, MailChoice, MailMessage } from '@/contexts/game/types';
import { SENDERS } from './senders';
import { docDate, docMoney, docReference } from './format';
import { applyRaisePremium } from '@/lib/careers/raisePremium';
import { OFFER_NEGOTIATION_PREMIUM } from './resolve';

/**
 * How long an offer stands.
 *
 * Two weeks, not four, and specifically because `applyCareerApplications`
 * auto-accepts after 1–2 weeks. The letter must not outlive the thing it is
 * about, or the player would be reading an offer for a job they already
 * started.
 */
export const OFFER_EXPIRY_WEEKS = 2;

/** The career the player has applied for and not yet started, if any. */
export function pendingApplication(state: GameState | null | undefined) {
  if (state?.currentJob) return null;
  const careers = Array.isArray(state?.careers) ? state!.careers : [];
  const career = careers.find((c) => c && c.applied && !c.accepted);
  if (!career || !Array.isArray(career.levels) || career.levels.length === 0) return null;
  const level = Math.max(0, Math.min(career.level ?? 0, career.levels.length - 1));
  const entry = career.levels[level];
  if (!entry || typeof entry.salary !== 'number' || entry.salary <= 0) return null;
  return { career, title: entry.name ?? 'Staff', salary: Math.round(entry.salary) };
}

/**
 * The offer letter.
 *
 * ## Why lapsing ACCEPTS
 *
 * Today `applyCareerApplications` silently flips `accepted: true` after 1–2
 * weeks. There is no offer, no salary quoted, no start date and no way to
 * decline — the most consequential document in a working life is invisible.
 *
 * This adds the document without moving the floor. A player who never opens
 * their mail lands exactly where they land now, because the existing
 * auto-accept still runs and the letter simply records that they started
 * without replying. Reading your mail EARNS the extra options — start early,
 * negotiate, or walk away. A feature that could leave a new player quietly
 * unemployed because they did not find an inbox would not be worth shipping,
 * however good the decision was.
 */
export function jobOfferLetter(
  state: GameState,
  atWeek: number
): MailMessage | null {
  const pending = pendingApplication(state);
  if (!pending) return null;

  const week = Math.max(0, Math.floor(atWeek));
  const negotiated = applyRaisePremium(pending.salary, OFFER_NEGOTIATION_PREMIUM);

  const choices: MailChoice[] = [
    {
      id: 'accept',
      label: 'Accept and start now',
      detail: `${docMoney(pending.salary)} a week, starting immediately`,
      kind: 'primary',
    },
    {
      id: 'negotiate',
      label: 'Ask for more before signing',
      detail: `${docMoney(negotiated)} a week if they agree`,
      kind: 'neutral',
    },
    {
      id: 'decline',
      label: 'Decline the offer',
      detail: 'Withdraws your application. You stay unemployed.',
      kind: 'neutral',
    },
  ];

  return {
    // Keyed on the career, not the week — one offer per application, however
    // many weeks it sits unanswered.
    id: `mail-offer-${pending.career.id}`,
    senderName: SENDERS.payroll.name,
    senderEmail: SENDERS.payroll.email,
    verified: true,
    subject: `Offer of employment — ${pending.title}`,
    preview: `${docMoney(pending.salary)} a week. Reply within ${OFFER_EXPIRY_WEEKS} weeks.`,
    body:
      `We are pleased to offer you the position of ${pending.title}.\n\n` +
      `The terms are set out in the attached letter. If we do not hear from ` +
      `you we will assume you are joining us on the terms as offered, and your ` +
      `start date will be confirmed by your line manager.\n\n` +
      `If you would like to discuss the package before signing, say so and we ` +
      `will put it to the hiring manager.`,
    atWeek: week,
    read: false,
    starred: false,
    folder: 'inbox',
    category: 'primary',
    attachment: {
      kind: 'contract',
      title: `Offer of employment — ${pending.title}`,
      issuer: 'Human Resources · Offer of Employment',
      reference: docReference('OFR', week, 29),
      rows: [
        { label: 'Position', value: pending.title },
        { label: 'Basic pay, weekly', value: docMoney(pending.salary) },
        { label: 'Annualised', value: docMoney(pending.salary * 52), muted: true },
        { label: 'Start date', value: docDate(week + 1), muted: true },
      ],
      total: { label: 'Weekly pay on signing', value: docMoney(pending.salary) },
      note: 'Tax is withheld at source. This offer stands for two weeks.',
    },
    decision: {
      choices,
      expiresAtWeek: week + OFFER_EXPIRY_WEEKS,
      // Lapse = accept, matching the behaviour that already exists. See above.
      lapseChoiceId: 'accept',
      resolver: { kind: 'careerOffer', careerId: pending.career.id },
    },
  };
}

/**
 * How much of an arrears balance an early payment clears.
 *
 * All of it. The point is not a discount — it is that the balance can be
 * ATTACKED at all. `overdueBalance` has no player-facing action anywhere in the
 * game: written by the tick, collected automatically from next week's income,
 * displayed in the bank, and otherwise a spectator sport. Paying it early costs
 * exactly what it would have cost anyway; what you buy is the credit score
 * recovering sooner and the collection stopping.
 */
export function arrearsInvoice(state: GameState, atWeek: number): MailMessage | null {
  const overdue = Math.round(state?.overdueBalance ?? 0);
  if (overdue <= 0) return null;

  const week = Math.max(0, Math.floor(atWeek));
  const cash = Math.max(0, Math.round(state?.stats?.money ?? 0));
  const affordable = cash >= overdue;

  const choices: MailChoice[] = [
    {
      id: 'pay',
      label: affordable ? 'Pay the balance now' : 'Pay what you can',
      detail: affordable
        ? `${docMoney(overdue)} from your cash account`
        : `${docMoney(cash)} of ${docMoney(overdue)} — the rest keeps accruing`,
      kind: 'primary',
    },
    {
      id: 'later',
      label: 'Leave it to the weekly collection',
      detail: 'Taken from income before anything reaches you.',
      kind: 'neutral',
    },
  ];

  return {
    // Keyed on the week the notice was raised, so a balance that persists gets
    // one notice per billing cycle rather than one per tick.
    id: `mail-arrears-${week}`,
    senderName: SENDERS.bank.name,
    senderEmail: SENDERS.bank.email,
    verified: true,
    subject: 'Settle your overdue balance',
    preview: `${docMoney(overdue)} outstanding. You can clear it today.`,
    body:
      `Your account is carrying ${docMoney(overdue)} in unpaid charges.\n\n` +
      'While a balance stands it is collected from the top of your income each ' +
      'week, before anything reaches you, and your credit score stays depressed. ' +
      'Settling it here costs the same money and stops both.\n\n' +
      'There is no penalty for leaving it — only the interest rate on everything ' +
      'you borrow while it is outstanding.',
    atWeek: week,
    read: false,
    starred: false,
    folder: 'inbox',
    category: 'finance',
    attachment: {
      kind: 'notice',
      title: 'Overdue balance',
      issuer: 'DeepLife Bank · Collections',
      reference: docReference('ARR', week, 31),
      rows: [
        { label: 'Outstanding', value: docMoney(overdue), negative: true },
        { label: 'Available cash', value: docMoney(cash), muted: true },
      ],
      total: { label: 'Payable today', value: docMoney(Math.min(cash, overdue)) },
    },
    decision: {
      choices,
      expiresAtWeek: week + 4,
      lapseChoiceId: 'later',
      resolver: { kind: 'payArrears' },
    },
  };
}
