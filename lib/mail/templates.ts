/**
 * The legitimate mail — the paper trail the game never had.
 *
 * Every template is pure and returns null when it has nothing to say this week,
 * so the "does this apply?" test sits next to the copy that depends on it.
 *
 * ## Two rules the content follows
 *
 * **Never invent a number.** Every figure is either handed over by the tick
 * (`ctx.facts`, what actually moved) or read from the save. A payslip whose net
 * pay disagrees with the player's balance is worse than no payslip — it teaches
 * them the app is decoration.
 *
 * **Never flood.** Most documents are periodic rather than weekly, and the
 * cadences are staggered so they do not all land together. This is a save-size
 * constraint as much as a taste one — see `LONG_PERIOD` for the measurement.
 * The period figures show their own arithmetic ("4 weeks @ $1,250") so a reader
 * can check them against the week they are living.
 */

import type { GameState, MailAttachment, MailMessage } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { SENDERS } from './senders';
import { docDate, docMoney, docPercent, docReference, docWhole } from './format';
import { characterName, getMailState } from './state';
import type { MailContext, MailTemplate } from './types';

/** Weeks in a pay period. Four is the game's own month. */
const PERIOD = 4;

/**
 * Cadence for the non-payroll documents.
 *
 * Eight, not four, and the reason is measured rather than aesthetic. At a
 * four-week cycle for the payslip, the statement, the rent invoice AND the
 * arrears notice — each at a different offset so they would not collide — the
 * player received something almost every single week. At ~846 bytes a message
 * (35% attachment, 29% body, measured) that is ~17.8 KB of save growth per 20
 * ticks, which broke the state-size sanity budget in
 * `__tests__/stress/realProviderLoop.stress.test.ts` on its own.
 *
 * Halving the cadence halves the cost and reads better anyway: a payslip every
 * month is a document, a bank statement every month on top of it is a pile.
 */
const LONG_PERIOD = 8;

/** Build a message with the fields every template repeats. */
function compose(
  ctx: MailContext,
  sender: { name: string; email: string; verified?: boolean },
  fields: Omit<MailMessage, 'id' | 'senderName' | 'senderEmail' | 'atWeek' | 'read' | 'starred' | 'folder'> & {
    idSuffix: string;
  }
): MailMessage {
  const { idSuffix, ...rest } = fields;
  return {
    // Ids encode the week, which is what makes the whole generator idempotent —
    // a replayed tick produces the same id and `appendMessages` skips it.
    id: `mail-${idSuffix}-${ctx.week}`,
    senderName: sender.name,
    senderEmail: sender.email,
    verified: sender.verified,
    atWeek: ctx.week,
    read: false,
    starred: false,
    folder: 'inbox',
    ...rest,
  };
}

function currentCareer(state: GameState) {
  if (!state.currentJob) return null;
  const careers = Array.isArray(state.careers) ? state.careers : [];
  const career = careers.find((c) => c && c.id === state.currentJob && c.accepted);
  if (!career || !Array.isArray(career.levels) || career.levels.length === 0) return null;
  const level = Math.max(0, Math.min(career.level ?? 0, career.levels.length - 1));
  return { career, title: career.levels[level]?.name ?? 'Staff' };
}

// ---------------------------------------------------------------------------
// Welcome — the one message that explains the app
// ---------------------------------------------------------------------------

const welcome: MailTemplate = (ctx) => {
  // Fires on the first message the mailbox ever receives, NOT at a low absolute
  // week — that version was a dead gate and shipped as one.
  //
  // `weeksLived` is not 0 at the start of a game. `computeWeeksLived(age)` is
  // `(startingAge - 18) * 52`, so a scenario beginning at 20 starts at week 104
  // and one beginning at 30 starts at 624. A `week <= 2` gate therefore fired
  // only for the three scenarios that start at exactly 18, and silently never
  // fired for the other twelve. Found by opening the app and seeing an empty
  // inbox where the welcome should have been — no test would have caught it,
  // because every test picks its own week.
  //
  // "The inbox has never run" rather than "the inbox is empty", which was the
  // first fix and was still wrong: `emptyMailBin` and the 50-message prune can
  // both take the count back to zero, and the welcome would then arrive again —
  // with a fresh week-keyed id, so `appendMessages` would not dedupe it. The
  // generation marker is the only thing that says "this mailbox is new".
  if (getMailState(ctx.state).lastGeneratedWeek !== undefined) return null;
  const name = characterName(ctx.state).split(' ')[0] || 'there';
  return compose(ctx, SENDERS.security, {
    idSuffix: 'welcome',
    subject: 'Welcome to DeepMail',
    preview: 'Your statements, payslips and receipts all arrive here.',
    body:
      `Hi ${name},\n\n` +
      'Your mailbox is set up. From now on this is where your paperwork lands — ' +
      'payslips from work, statements from the bank, invoices for rent and ' +
      'tuition, confirmations from your broker.\n\n' +
      'One thing worth knowing before it happens to you: not everything that ' +
      'arrives here is genuine. Real senders show a verified badge next to ' +
      'their name. Anything asking you to "confirm", "release" or "unlock" ' +
      'money in a hurry is worth a second look at the address it came from.\n\n' +
      'You can report anything suspicious and we will take it from there.',
    category: 'primary',
  });
};

// ---------------------------------------------------------------------------
// Payslip
// ---------------------------------------------------------------------------

const payslip: MailTemplate = (ctx) => {
  const weekly = Math.round(ctx.facts.careerSalary ?? 0);
  if (weekly <= 0) return null;
  if (ctx.week % PERIOD !== 0) return null;

  const job = currentCareer(ctx.state);
  const gross = weekly * PERIOD;
  // Withholding is the tick's own figure, scaled to the period the same way the
  // gross is — so the two halves of the document agree with each other.
  const tax = Math.round((ctx.facts.incomeTax ?? 0) * PERIOD);
  const net = Math.max(0, gross - tax);
  const periodsThisYear = Math.floor((ctx.week % WEEKS_PER_YEAR) / PERIOD) + 1;

  return compose(ctx, SENDERS.payroll, {
    idSuffix: 'payslip',
    subject: `Payslip — period ending ${docDate(ctx.week)}`,
    preview: `Net pay ${docMoney(net)} has been deposited.`,
    body:
      `Your pay for the period ending ${docDate(ctx.week)} has been processed ` +
      `and deposited.\n\n` +
      `Role: ${job?.title ?? 'Staff'}\n` +
      `Payment method: direct deposit\n\n` +
      'A full breakdown is attached. Keep it for your records — you will want ' +
      'it if you ever apply for credit.',
    category: 'finance',
    attachment: {
      kind: 'payslip',
      title: `Payslip — period ending ${docDate(ctx.week)}`,
      issuer: `${job?.title ?? 'Employment'} · Payroll Services`,
      reference: docReference('PAY', ctx.week),
      rows: [
        { label: `Basic pay · ${PERIOD} weeks @ ${docMoney(weekly)}`, value: docMoney(gross) },
        { label: 'Income tax withheld', value: `-${docMoney(tax)}`, negative: true },
        {
          label: 'Effective rate',
          value: docPercent(gross > 0 ? tax / gross : 0),
          muted: true,
        },
        {
          label: `Year to date · ${periodsThisYear} period${periodsThisYear === 1 ? '' : 's'}`,
          value: docMoney(gross * periodsThisYear),
          muted: true,
        },
      ],
      total: { label: 'Net pay', value: docMoney(net) },
      note: 'Tax is withheld at source. There is no return to file.',
    },
  });
};

// ---------------------------------------------------------------------------
// Bank statement
// ---------------------------------------------------------------------------

const bankStatement: MailTemplate = (ctx) => {
  // Offset from the payslip so the two do not always arrive together.
  if (ctx.week % LONG_PERIOD !== 3) return null;
  const cash = Math.round(ctx.state.stats?.money ?? 0);
  const savings = Math.round(ctx.state.bankSavings ?? 0);
  if (cash <= 0 && savings <= 0) return null;

  const interest = Math.round((ctx.facts.savingsInterest ?? 0) * LONG_PERIOD);
  const overdue = Math.round(ctx.state.overdueBalance ?? 0);

  const rows: MailAttachment['rows'] = [
    { label: 'Cash account', value: docMoney(cash) },
    { label: 'Savings account', value: docMoney(savings) },
  ];

  // Where the money came from. The HUD shows one "Cash Flow" number and the
  // player has no way to see its composition anywhere else — a statement that
  // splits earned from passive is the whole reason banks send them.
  const total = Math.round((ctx.facts.totalIncome ?? 0) * LONG_PERIOD);
  const passive = Math.round((ctx.facts.passiveIncome ?? 0) * LONG_PERIOD);
  if (total > 0) {
    rows.push({ label: 'Credits received this period', value: `+${docMoney(total)}` });
    if (passive > 0) {
      rows.push({ label: '  of which passive', value: docMoney(passive), muted: true });
    }
  }
  if (interest > 0) rows.push({ label: 'Interest credited this period', value: `+${docMoney(interest)}` });
  if (overdue > 0) {
    rows.push({ label: 'Overdue balance', value: `-${docMoney(overdue)}` });
  }

  return compose(ctx, SENDERS.bank, {
    idSuffix: 'statement',
    subject: `Your statement is ready — ${docDate(ctx.week)}`,
    preview: `Closing balance ${docMoney(cash + savings)}.`,
    body:
      'Your statement for this period is attached.\n\n' +
      (overdue > 0
        ? 'You are carrying an overdue balance. It is collected from the top of ' +
          'next week\'s income and it is holding your credit score down while it ' +
          'stands.\n\n'
        : '') +
      'We will never ask you to confirm your details by email. If you receive a ' +
      'message that appears to be from us and asks you to do that, report it.',
    category: 'finance',
    attachment: {
      kind: 'statement',
      title: `Account statement — ${docDate(ctx.week)}`,
      issuer: 'DeepLife Bank · Personal Banking',
      reference: docReference('STM', ctx.week, 3),
      rows,
      total: { label: 'Total balance', value: docMoney(cash + savings - overdue) },
    },
  });
};

// ---------------------------------------------------------------------------
// Rent invoice
// ---------------------------------------------------------------------------

const rentInvoice: MailTemplate = (ctx) => {
  const rent = Math.round(ctx.facts.weeklyRent ?? 0);
  if (rent <= 0) return null;
  if (ctx.week % LONG_PERIOD !== 6) return null;

  const period = rent * LONG_PERIOD;
  const arrears = Math.round(ctx.state.rental?.missedWeeks ?? 0);

  return compose(ctx, SENDERS.landlord, {
    idSuffix: 'rent',
    subject: `Rent due — ${docDate(ctx.week)}`,
    preview: `${docMoney(period)} for the coming period.`,
    body:
      'Your rent invoice for the coming period is attached.\n\n' +
      (arrears > 0
        ? `Our records show ${arrears} week${arrears === 1 ? '' : 's'} in arrears. ` +
          'Please bring the account up to date — four consecutive weeks begins ' +
          'the eviction process.\n\n'
        : 'Payment is collected automatically each week.\n\n') +
      'Thank you for being a tenant with Meridian.',
    category: 'finance',
    attachment: {
      kind: 'invoice',
      title: `Rent invoice — ${docDate(ctx.week)}`,
      issuer: 'Meridian Property Management',
      reference: docReference('INV', ctx.week, 5),
      rows: [
        { label: `Rent · ${LONG_PERIOD} weeks @ ${docMoney(rent)}`, value: docMoney(period) },
        ...(arrears > 0
          ? [{ label: `Arrears carried · ${arrears} week(s)`, value: docMoney(rent * arrears), negative: true }]
          : []),
      ],
      total: { label: 'Amount due', value: docMoney(period + rent * arrears) },
      note: 'Collected weekly by standing instruction. No action needed.',
    },
  });
};

// ---------------------------------------------------------------------------
// Annual tax notice
// ---------------------------------------------------------------------------

const taxNotice: MailTemplate = (ctx) => {
  if (ctx.week < WEEKS_PER_YEAR || ctx.week % WEEKS_PER_YEAR !== 0) return null;
  const paid = Math.round(ctx.state.banking?.taxDueThisYear ?? 0);
  const taxYear = Math.floor(ctx.week / WEEKS_PER_YEAR);

  return compose(ctx, SENDERS.revenue, {
    idSuffix: 'tax-year',
    subject: `Tax year ${taxYear} summary`,
    preview: paid > 0 ? `${docMoney(paid)} withheld and settled.` : 'Nothing to settle this year.',
    body:
      `Tax year ${taxYear} has closed.\n\n` +
      (paid > 0
        ? `${docMoney(paid)} was withheld at source over the year and your ` +
          'account is settled. There is nothing further to pay and no return to ' +
          'file.\n\n'
        : 'No taxable income was recorded for you this year.\n\n') +
      'Rent collected and luxury-asset yields count as income. Keep your ' +
      'statements — they are the only record of what was withheld.',
    category: 'finance',
    attachment: {
      kind: 'notice',
      title: `Tax year ${taxYear} — closing notice`,
      issuer: 'Revenue Service',
      reference: docReference('TAX', ctx.week, 7),
      rows: [
        { label: 'Withheld at source', value: docMoney(paid) },
        { label: 'Additional assessment', value: docMoney(0), muted: true },
      ],
      total: { label: 'Balance outstanding', value: docMoney(0) },
      note: 'Assessed automatically. Retain for seven years.',
    },
  });
};

// ---------------------------------------------------------------------------
// Overdue notice
// ---------------------------------------------------------------------------

const overdueNotice: MailTemplate = (ctx) => {
  const overdue = Math.round(ctx.state.overdueBalance ?? 0);
  if (overdue <= 0) return null;
  if (ctx.week % LONG_PERIOD !== 1) return null;

  return compose(ctx, SENDERS.bank, {
    idSuffix: 'overdue',
    subject: 'Overdue balance on your account',
    preview: `${docMoney(overdue)} outstanding.`,
    body:
      `Your account is carrying ${docMoney(overdue)} in unpaid charges.\n\n` +
      'This is collected from the top of your income each week before anything ' +
      'else reaches you, and your credit score stays depressed while a balance ' +
      'stands. Clearing it early costs nothing extra; leaving it there costs you ' +
      'the rate on everything you borrow.\n\n' +
      'No action is required — the collection is automatic.',
    category: 'finance',
    attachment: {
      kind: 'notice',
      title: 'Arrears notice',
      issuer: 'DeepLife Bank · Collections',
      reference: docReference('ARR', ctx.week, 11),
      rows: [{ label: 'Outstanding balance', value: docMoney(overdue), negative: true }],
      total: { label: 'Collected weekly from income', value: docMoney(overdue) },
    },
  });
};

// ---------------------------------------------------------------------------
// Tuition invoice
// ---------------------------------------------------------------------------

const tuitionInvoice: MailTemplate = (ctx) => {
  if (ctx.week % 12 !== 6) return null;
  const educations = Array.isArray(ctx.state.educations) ? ctx.state.educations : [];
  const active = educations.find((e) => e && !e.completed && (e.weeksRemaining ?? 0) > 0);
  if (!active) return null;

  const termCost = Math.max(0, Math.round((active.cost ?? 0) / 4));
  return compose(ctx, SENDERS.registrar, {
    idSuffix: 'tuition',
    subject: `Tuition statement — ${active.name}`,
    preview: `${docMoney(termCost)} for the current term.`,
    body:
      `Your tuition statement for ${active.name} is attached.\n\n` +
      `Weeks remaining on your programme: ${Math.max(0, Math.round(active.weeksRemaining ?? 0))}.\n` +
      (typeof active.gpa === 'number' ? `Current GPA: ${active.gpa.toFixed(2)}\n` : '') +
      '\nCharges are collected weekly alongside your other commitments.',
    category: 'finance',
    attachment: {
      kind: 'invoice',
      title: `Tuition — ${active.name}`,
      issuer: 'Registrar Office · Student Accounts',
      reference: docReference('TUI', ctx.week, 13),
      rows: [
        { label: 'Term tuition', value: docMoney(termCost) },
        { label: 'Programme total', value: docMoney(active.cost ?? 0), muted: true },
      ],
      total: { label: 'Due this term', value: docMoney(termCost) },
      note: 'Withdrawing forfeits the term. Speak to the registrar first.',
    },
  });
};

// ---------------------------------------------------------------------------
// Loan statement
// ---------------------------------------------------------------------------

/**
 * The game has loans — principal, APR, term, autopay, penalties — and produced
 * no paperwork for any of it. The only place a balance appeared was inside the
 * bank app, and the only signal that a payment had been missed was a penalty
 * quietly leaving the weekly cash line.
 */
const loanStatement: MailTemplate = (ctx) => {
  if (ctx.week % LONG_PERIOD !== 5) return null;
  const loans = Array.isArray(ctx.state.loans) ? ctx.state.loans : [];
  const open = loans.filter((l) => l && (l.remaining ?? 0) > 0);
  if (open.length === 0) return null;

  const paid = Math.round((ctx.facts.loanPaid ?? 0) * LONG_PERIOD);
  const penalty = Math.round((ctx.facts.loanPenalty ?? 0) * LONG_PERIOD);
  const outstanding = open.reduce((n, l) => n + Math.max(0, Math.round(l.remaining ?? 0)), 0);

  const rows: MailAttachment['rows'] = open.slice(0, 4).map((l) => ({
    label: `${l.name ?? 'Loan'} · ${(Math.max(0, l.rateAPR ?? 0) * 100).toFixed(1)}% APR`,
    value: docMoney(Math.max(0, l.remaining ?? 0)),
  }));
  if (paid > 0) rows.push({ label: 'Collected this period', value: `-${docMoney(paid)}`, muted: true });
  if (penalty > 0) {
    rows.push({ label: 'Late-payment charges', value: `-${docMoney(penalty)}`, negative: true });
  }

  return compose(ctx, SENDERS.bank, {
    idSuffix: 'loans',
    subject: `Loan statement — ${open.length} facilit${open.length === 1 ? 'y' : 'ies'}`,
    preview: `${docMoney(outstanding)} outstanding.`,
    body:
      'Your loan statement for this period is attached.\n\n' +
      (penalty > 0
        ? 'A late-payment charge was applied. Charges are avoided entirely by ' +
          'keeping enough cash to cover the weekly instalment — autopay skips ' +
          'rather than overdrawing you, and a skipped payment is what draws the ' +
          'charge.\n\n'
        : 'Payments are collected automatically each week.\n\n') +
      'Settling early reduces the total interest paid. There is no penalty for ' +
      'doing so.',
    category: 'finance',
    attachment: {
      kind: 'statement',
      title: 'Loan statement',
      issuer: 'DeepLife Bank · Lending',
      reference: docReference('LON', ctx.week, 41),
      rows,
      total: { label: 'Total outstanding', value: docMoney(outstanding) },
    },
  });
};

// ---------------------------------------------------------------------------
// Recurring-charges receipt
// ---------------------------------------------------------------------------

/**
 * A real receipt, which the app could render and never produced.
 *
 * `MailDocument` has always had a RECEIPT layout and no template emitted one,
 * so that branch was unreachable — the same dead-branch pattern this codebase
 * keeps growing. It is also the one document type the original brief asked for
 * by name.
 *
 * Recurring charges are the honest subject: they are the money that leaves
 * automatically every week, which is exactly the spending a player never sees
 * itemised anywhere.
 */
const chargesReceipt: MailTemplate = (ctx) => {
  if (ctx.week % LONG_PERIOD !== 7) return null;

  const rows: MailAttachment['rows'] = [];

  const pro = ctx.state.socialMedia?.verifiedPro;
  if (pro?.active && (pro.weeklyPrice ?? 0) > 0) {
    rows.push({
      label: `Pulse Verified Pro · ${LONG_PERIOD} weeks @ ${docMoney(pro.weeklyPrice!)}`,
      value: docMoney(pro.weeklyPrice! * LONG_PERIOD),
    });
  }

  const spark = ctx.state.sparkApp?.premium;
  if (spark?.active && (spark.weeklyPrice ?? 0) > 0) {
    rows.push({
      label: `Spark Premium · ${LONG_PERIOD} weeks @ ${docMoney(spark.weeklyPrice!)}`,
      value: docMoney(spark.weeklyPrice! * LONG_PERIOD),
    });
  }

  // `DietPlan` stores a DAILY cost, not a weekly one. Reading `weeklyCost`
  // type-checked (optional chaining on a cast) and would have silently omitted
  // every diet from the receipt — a dead branch inside the fix for dead
  // branches. Checked against the interface rather than assumed.
  const diet = (Array.isArray(ctx.state.dietPlans) ? ctx.state.dietPlans : []).find(
    (d) => d?.active
  );
  const dietWeekly = Math.round((diet?.dailyCost ?? 0) * 7);
  if (diet && dietWeekly > 0) {
    rows.push({
      label: `${diet.name} · ${LONG_PERIOD} weeks @ ${docMoney(dietWeekly)}`,
      value: docMoney(dietWeekly * LONG_PERIOD),
    });
  }

  if (rows.length === 0) return null;

  const total = rows.reduce(
    (n, r) => n + Number(r.value.replace(/[$,]/g, '')),
    0
  );

  return compose(ctx, SENDERS.bank, {
    idSuffix: 'charges',
    subject: 'Receipt for your recurring charges',
    preview: `${rows.length} active subscription${rows.length === 1 ? '' : 's'}.`,
    body:
      'Here is what left your account automatically this period.\n\n' +
      'Recurring charges are easy to forget and they compound: anything here ' +
      'that you are not using is money leaving every week for nothing. Each can ' +
      'be cancelled from the app that sold it.',
    category: 'finance',
    attachment: {
      kind: 'receipt',
      title: 'Recurring charges',
      issuer: 'DeepLife Bank · Direct Debits',
      reference: docReference('RCT', ctx.week, 43),
      rows,
      total: { label: 'Charged this period', value: docMoney(total) },
      note: 'Paid automatically. Cancel any time — no notice period.',
    },
  });
};

// ---------------------------------------------------------------------------
// Brokerage confirmation
// ---------------------------------------------------------------------------

const brokerageStatement: MailTemplate = (ctx) => {
  if (ctx.week % 13 !== 4) return null;
  const holdings = Array.isArray(ctx.state.stocksOwned) ? ctx.state.stocksOwned : [];
  if (holdings.length === 0) return null;

  const positions = holdings.slice(0, 6);
  const rows = positions.map((h) => {
    const shares = Math.max(0, Math.round((h as { shares?: number }).shares ?? 0));
    const symbol = String((h as { symbol?: string }).symbol ?? '—');
    return { label: `${symbol} · ${shares} share${shares === 1 ? '' : 's'}`, value: `${shares}` };
  });

  return compose(ctx, SENDERS.broker, {
    idSuffix: 'brokerage',
    subject: 'Quarterly portfolio statement',
    preview: `${holdings.length} position${holdings.length === 1 ? '' : 's'} held.`,
    body:
      'Your quarterly statement is attached.\n\n' +
      'Capital gains are assessed at each sale, not at year end, so nothing ' +
      'here requires action from you. Dividends are credited automatically as ' +
      'they are declared.\n\n' +
      'We will never contact you about "releasing" or "unlocking" a position. ' +
      'If someone does, it is not us.',
    category: 'finance',
    attachment: {
      kind: 'statement',
      title: 'Portfolio statement',
      issuer: 'Vantage Brokerage · Retail Clients',
      reference: docReference('PRT', ctx.week, 17),
      rows,
      total: { label: 'Positions held', value: `${holdings.length}` },
    },
  });
};

// ---------------------------------------------------------------------------
// Vehicle service invoice
// ---------------------------------------------------------------------------

const vehicleService: MailTemplate = (ctx) => {
  if (ctx.week % 26 !== 9) return null;
  const vehicles = Array.isArray(ctx.state.vehicles) ? ctx.state.vehicles : [];
  const owned = vehicles.filter((v) => v && (v as { sold?: boolean }).sold !== true);
  if (owned.length === 0) return null;

  const v = owned[0] as { name?: string; condition?: number };
  const condition = Math.max(0, Math.min(100, Math.round(v.condition ?? 100)));
  const labour = 180 + Math.round(ctx.rand('service') * 220);
  const parts = Math.round(labour * (1 + (100 - condition) / 100));

  return compose(ctx, SENDERS.service, {
    idSuffix: 'service',
    subject: `Service due — ${v.name ?? 'your vehicle'}`,
    preview: `Inspection and parts, ${docMoney(labour + parts)}.`,
    body:
      `${v.name ?? 'Your vehicle'} is due its scheduled service.\n\n` +
      `Recorded condition: ${condition}%.\n\n` +
      (condition < 50
        ? 'At this condition a breakdown is a question of when, not whether. ' +
          'Repair costs climb steeply the longer it is left.\n\n'
        : '') +
      'Book at your convenience. The estimate attached is valid for four weeks.',
    category: 'primary',
    attachment: {
      kind: 'invoice',
      title: 'Service estimate',
      issuer: 'AutoCare Service Centre',
      reference: docReference('SRV', ctx.week, 19),
      rows: [
        { label: 'Labour · inspection and adjustment', value: docMoney(labour) },
        { label: 'Parts and consumables', value: docMoney(parts) },
      ],
      total: { label: 'Estimate', value: docMoney(labour + parts) },
      note: 'Estimate only. No charge until work is authorised.',
    },
  });
};

// ---------------------------------------------------------------------------
// Insurance renewal
// ---------------------------------------------------------------------------

const insuranceRenewal: MailTemplate = (ctx) => {
  if (ctx.week % 26 !== 15) return null;
  const vehicles = Array.isArray(ctx.state.vehicles) ? ctx.state.vehicles : [];
  // Insurance lives per-vehicle, so the renewal is for the first ACTIVE policy —
  // a lapsed one has nothing to renew and a vehicle with none was never covered.
  const insured = vehicles.find((v) => v?.insurance?.active);
  const policy = insured?.insurance;
  const monthly = Math.round(policy?.monthlyCost ?? 0);
  if (!policy || monthly <= 0) return null;

  // The policy stores a monthly cost; the term is six months.
  const term = monthly * 6;

  return compose(ctx, SENDERS.insurer, {
    idSuffix: 'insurance',
    subject: 'Your policy renews shortly',
    preview: `${docMoney(term)} for the coming term.`,
    body:
      `Your motor policy on ${insured?.name ?? 'your vehicle'} is due to renew.\n\n` +
      `Cover: ${policy.type} · ${Math.round(policy.coveragePercent ?? 0)}% of repair costs.\n\n` +
      'Renewal is automatic. Cancel any time from the vehicle app — but an ' +
      'uninsured accident is paid from your own pocket, in full.',
    category: 'finance',
    attachment: {
      kind: 'invoice',
      title: 'Policy renewal',
      issuer: 'Kestrel Insurance · Motor',
      reference: docReference('POL', ctx.week, 23),
      rows: [
        { label: `Premium · 6 months @ ${docMoney(monthly)}`, value: docMoney(term) },
        { label: 'Cover level', value: String(policy.type), muted: true },
        { label: 'Repair contribution', value: `${Math.round(policy.coveragePercent ?? 0)}%`, muted: true },
      ],
      total: { label: 'Term premium', value: docMoney(term) },
    },
  });
};

// ---------------------------------------------------------------------------
// Recruiter approach
// ---------------------------------------------------------------------------

const recruiterApproach: MailTemplate = (ctx) => {
  if (ctx.week % 8 !== 5) return null;
  const job = currentCareer(ctx.state);
  const reputation = Math.round(ctx.state.stats?.reputation ?? 0);
  // Recruiters chase people who are visible and already working. Someone with
  // no job and no reputation does not get headhunted, and pretending otherwise
  // would make the message meaningless.
  if (!job || reputation < 25) return null;
  if (ctx.rand('recruiter') > 0.35) return null;

  const weekly = Math.round(ctx.facts.careerSalary ?? 0);
  const offer = Math.round(weekly * (1.15 + ctx.rand('recruiter-offer') * 0.25));

  return compose(ctx, SENDERS.recruiter, {
    idSuffix: 'recruiter',
    threadId: `recruiter-${ctx.state.currentJob}`,
    subject: `A ${job.title} role worth a look`,
    preview: `Around ${docWhole(offer)} a week, similar sector.`,
    body:
      `I came across your profile and thought of a ${job.title} opening I am ` +
      'working on.\n\n' +
      `The range lands around ${docWhole(offer)} a week — a step up on where ` +
      'most people at your level sit. No obligation.\n\n' +
      'Plenty of people never move on one of these. They take it to their ' +
      'manager instead, and find out what they are worth without changing ' +
      'desks. That works right up until it does not.',
    category: 'primary',
    decision: {
      choices: [
        {
          id: 'leverage',
          label: 'Take it to your manager',
          detail: 'A guaranteed step up if they want to keep you — and it spends your raise window.',
          kind: 'primary',
        },
        {
          id: 'ignore',
          label: 'Let it go',
          detail: 'Costs nothing. The role goes to someone else.',
          kind: 'neutral',
        },
      ],
      expiresAtWeek: ctx.week + 3,
      lapseChoiceId: 'ignore',
      resolver: { kind: 'recruiterLeverage', careerId: ctx.state.currentJob as string },
    },
  });
};

// ---------------------------------------------------------------------------
// Concierge — wealth flavour that also teaches a real mechanic
// ---------------------------------------------------------------------------

const conciergeInvite: MailTemplate = (ctx) => {
  if (ctx.week % 26 !== 20) return null;
  const owned = Array.isArray(ctx.state.luxuryItems) ? ctx.state.luxuryItems.length : 0;
  if (owned < 2) return null;

  return compose(ctx, SENDERS.concierge, {
    idSuffix: 'concierge',
    subject: 'Your collection — a note from Aurum',
    preview: `${owned} pieces on file. Completing a set is worth more than adding one.`,
    body:
      `We hold ${owned} pieces on your file.\n\n` +
      'A note our clients often find useful: a completed collection is worth ' +
      'considerably more than the same money spread across unrelated pieces. ' +
      'Sets carry a standing multiplier; a scattered portfolio does not.\n\n' +
      'The collection view in your luxury app shows which sets you are closest ' +
      'to finishing.',
    category: 'promotions',
  });
};

// ---------------------------------------------------------------------------
// Marketing — the promotions tab needs something in it
// ---------------------------------------------------------------------------

const PROMOS: { subject: string; preview: string; body: string }[] = [
  {
    subject: 'Rates cut on personal lending',
    preview: 'Borrowing is cheaper this quarter.',
    body:
      'Personal lending rates have come down this quarter.\n\n' +
      'Worth remembering what a loan actually is: money now, at a price, paid ' +
      'weekly whether or not the week went well. Borrow against income you are ' +
      'already earning, not income you are hoping for.',
  },
  {
    subject: 'Your savings could be working harder',
    preview: 'Idle cash earns nothing.',
    body:
      'Cash sitting in your current account earns nothing at all.\n\n' +
      'Moving it to savings earns interest every week, and a savings goal with ' +
      'an automatic weekly contribution does the moving for you — which is the ' +
      'only version of this that survives contact with a busy life.',
  },
  {
    subject: 'Upgrade week — hardware offers',
    preview: 'A better machine pays for itself.',
    body:
      'Hardware offers are running this week.\n\n' +
      'A computer is not a luxury purchase in the way it looks — it opens the ' +
      'specialist half of your app launcher, and several of those apps are ' +
      'where the money actually is.',
  },
];

const promotion: MailTemplate = (ctx) => {
  if (ctx.week % 12 !== 5) return null;
  if (ctx.rand('promo-fire') > 0.5) return null;
  const promo = PROMOS[Math.floor(ctx.rand('promo-pick') * PROMOS.length) % PROMOS.length];

  return compose(ctx, SENDERS.marketing, {
    idSuffix: 'promo',
    subject: promo.subject,
    preview: promo.preview,
    body: promo.body,
    category: 'promotions',
  });
};

/**
 * Registry order is display order for messages landing in the same week.
 * Documents first, marketing last — the same instinct the category tabs encode.
 */
export const MAIL_TEMPLATES: MailTemplate[] = [
  welcome,
  payslip,
  bankStatement,
  rentInvoice,
  taxNotice,
  overdueNotice,
  tuitionInvoice,
  loanStatement,
  chargesReceipt,
  brokerageStatement,
  vehicleService,
  insuranceRenewal,
  recruiterApproach,
  conciergeInvite,
  promotion,
];
