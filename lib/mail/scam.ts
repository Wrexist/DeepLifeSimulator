/**
 * Fraudulent mail.
 *
 * ## Why this is the point of the feature
 *
 * Every other channel in the game is read-only: a notification tells you what
 * happened, the journal records it, a statement confirms it. Mail is the first
 * channel where the player has to JUDGE something before acting, and where
 * being wrong costs money. That is a different verb from anything else in the
 * app.
 *
 * ## The rules it plays by
 *
 * **Risk is earned, not sprinkled.** The odds are driven by what the player has
 * actually done: bought from a low-reputation or scam-flagged dark-web vendor,
 * run up investigation heat, or simply become rich enough to be worth
 * targeting. A careful player still sees the occasional generic phish, because
 * everyone does — but at a fraction of the rate.
 *
 * **Nothing is ever taken passively.** Receiving a scam costs nothing. Opening
 * it costs nothing. Only tapping its call to action costs anything, and that
 * charge is applied inside the same updater that marks the message resolved
 * (§4.4), re-checked against `prev`, so a double-tap in one React batch pays
 * once.
 *
 * **It teaches.** Every scam carries real tells — a lookalike domain, a
 * deadline measured in hours, a greeting that does not know the player's name.
 * They are revealed after resolution either way, so a player who fell for one
 * learns what to look for and a player who spotted it gets told they were
 * right.
 *
 * **No scam is ever `verified`.** `compose()` here never sets the flag and a
 * test asserts it, so the badge stays a reliable signal rather than decoration.
 */

import type { GameState, MailMessage } from '@/contexts/game/types';
import { fnv1a32 } from '@/utils/seededRoll';
import { docMoney } from './format';
import { riskMultiplier } from './security';
import type { MailContext } from './types';

/** Ceiling on how much of the player's cash any single scam can take. */
export const SCAM_LOSS_CAP_FRACTION = 0.25;

/**
 * How often a scam may even be ATTEMPTED, in game weeks.
 *
 * ## Why a window rather than a lower probability
 *
 * The risk used to be rolled every single week. That made the ceiling the real
 * problem: a player who had traded on the dark web, been burned once and picked
 * up some heat sat near 0.42 PER WEEK — a scam roughly every other week,
 * indefinitely. Mail stopped being a paper trail with a hazard in it and became
 * a phishing simulator, which is the report this addresses.
 *
 * Lowering the probability alone would not have fixed it: a low per-week roll
 * still clusters, so "two scams in three weeks" stays possible and that is
 * exactly what reads as constant. A window makes the spacing a GUARANTEE — at
 * most one attempt per six weeks, no matter how badly the player has behaved —
 * and leaves the probability free to express how exposed they are.
 *
 * ## Why it needs no save field
 *
 * The eligible week is derived from the week number itself (see
 * `scamWindowOpen`), so there is nothing to store, nothing to migrate, and
 * nothing `emptyMailBin` can reset. It also keeps the generator's contract
 * intact: still a pure function of `(week, salt)`, so a replayed or
 * double-invoked tick lands in the same place.
 */
export const SCAM_WINDOW_WEEKS = 6;

/**
 * Chance for a player who has done nothing to earn it.
 *
 * Read as "per attempt window", not per week — so with the window above this is
 * roughly one generic phish a game-year. Everyone gets those; nobody should get
 * them monthly.
 */
const BASE_RISK = 0.12;

/**
 * Hard ceiling. With the window, the worst-behaved save in the game tops out at
 * an attempt roughly every fifteen weeks.
 */
const MAX_RISK = 0.4;

/**
 * Which week inside each window a scam may land on.
 *
 * Hashing the window INDEX (not the week) is what makes the answer stable for
 * every week in the same window, which is what stops the offset moving under
 * its own gate. Without it the eligible week would be re-drawn every tick and
 * the cadence would be back to a per-week roll wearing a hat.
 *
 * `ctx.rand` cannot be used here for the same reason — it is seeded on the
 * current week by construction.
 */
function scamWindowOffset(week: number): number {
  const windowIndex = Math.floor(week / SCAM_WINDOW_WEEKS);
  return fnv1a32(`mail-scam-window:${windowIndex}`) % SCAM_WINDOW_WEEKS;
}

/** True on the one week per window when a scam may be rolled at all. */
export function scamWindowOpen(week: number): boolean {
  const w = Math.max(0, Math.floor(week));
  return w % SCAM_WINDOW_WEEKS === scamWindowOffset(w);
}

export interface ScamRisk {
  /** Probability a scam arrives this week, 0..1. */
  chance: number;
  /** Why the risk is what it is - surfaced in the app so it is never opaque. */
  reasons: string[];
}

/**
 * How exposed the player currently is.
 *
 * ## Every signal here is one only the PLAYER can produce
 *
 * The obvious model - "count the low-reputation vendors in the directory" - is
 * wrong, and the test that says so caught it. `initialGameState` ships the
 * marketplace already populated, including `b4n3_drop` at reputation 15 with 3
 * reviews. Those reviews are the community's, not the player's, so that model
 * opened every brand-new save at four times the base risk for something the
 * player had not done, could not see, and could not undo. It would have read as
 * the game being arbitrary - which is exactly what the "why am I exposed?"
 * panel exists to prevent.
 *
 * So exposure is measured only from things the player caused:
 *
 *  - `flaggedScam` - set by `updateVendorAfterPurchase(v, 'scam')` and nowhere
 *    else, so it means "this vendor burned ME". The strongest signal there is,
 *    and the most thematically honest: the address that got sold on is yours.
 *  - `jobHistory` - dark-web jobs actually run.
 *  - `dirtyBtc` / `cleanBtc` - proceeds actually earned.
 *  - `playerReputation` above its starting zero - purchases actually made.
 *  - `heat` - the composite the dark-web systems already maintain.
 *  - visible wealth, which attracts targeting regardless of conduct.
 */
export function scamRisk(
  state: GameState | null | undefined,
  atWeek?: number
): ScamRisk {
  const reasons: string[] = [];
  let chance = BASE_RISK;

  const darkWeb = state?.darkWeb;
  const vendors = Array.isArray(darkWeb?.vendors) ? darkWeb!.vendors : [];

  const burnedBy = vendors.filter((v) => v && v.flaggedScam).length;
  if (burnedBy > 0) {
    chance += Math.min(0.12, 0.06 * burnedBy);
    reasons.push(
      `${burnedBy} vendor${burnedBy === 1 ? ' has' : 's have'} already scammed you - ` +
        'that address gets sold on.'
    );
  }

  const jobsRun = Array.isArray(darkWeb?.jobHistory) ? darkWeb!.jobHistory.length : 0;
  const proceeds = Math.max(0, darkWeb?.dirtyBtc ?? 0) + Math.max(0, darkWeb?.cleanBtc ?? 0);
  const bought = Math.max(0, darkWeb?.playerReputation ?? 0) > 0;
  if (jobsRun > 0 || proceeds > 0 || bought) {
    chance += 0.06;
    reasons.push('You have traded on the dark web. Buyers get listed and resold.');
  }

  const heat = Math.max(0, Math.min(100, darkWeb?.heat ?? 0));
  if (heat >= 30) {
    chance += Math.min(0.08, (heat - 30) / 600);
    reasons.push('Your investigation heat makes you a visible target.');
  }

  const netWorth = Math.max(0, state?.stats?.money ?? 0) + Math.max(0, state?.bankSavings ?? 0);
  if (netWorth >= 250_000) {
    chance += 0.04;
    reasons.push('Visible wealth attracts targeted fraud.');
  }

  if (reasons.length === 0) {
    reasons.push('Everyone gets the occasional generic phishing attempt.');
  }

  // Defences come off the total, and they are the only inputs that push DOWN.
  // Applied last so the reasons above still explain the exposure that was
  // earned - the player should see both halves, not a single netted number.
  const defended = Math.min(MAX_RISK, chance) * riskMultiplier(state, atWeek ?? state?.weeksLived ?? 0);

  return { chance: Math.max(0, defended), reasons };
}

interface ScamBlueprint {
  key: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  preview: string;
  body: string;
  actionLabel: string;
  lossFraction: number;
  tells: string[];
  category: MailMessage['category'];
  /** Only offered when the player has actually used the dark web. */
  darkWebOnly?: boolean;
}

/**
 * The catalogue.
 *
 * Each one impersonates a sender the player has genuinely been receiving mail
 * from, because that is what makes the lookalike domain a tell rather than a
 * trivia question - the real address is two messages up the list.
 */
const BLUEPRINTS: ScamBlueprint[] = [
  {
    key: 'bank-verify',
    senderName: 'DeepLife Bank Security',
    senderEmail: 'security@deeplifebank-verify.com',
    subject: 'Unusual activity - confirm your account within 24 hours',
    preview: 'Your account will be restricted unless it is confirmed.',
    body:
      'Dear Customer,\n\n' +
      'We have detected unusual activity on your account. For your protection ' +
      'a temporary restriction has been placed on outgoing payments.\n\n' +
      'To lift the restriction you must confirm your account within 24 hours. ' +
      'Failure to confirm will result in the balance being held pending review.\n\n' +
      'Confirm now to avoid interruption.',
    actionLabel: 'Confirm account',
    lossFraction: 0.18,
    tells: [
      'The address is deeplifebank-verify.com. Your bank writes from deeplifebank.com.',
      '"Dear Customer" - your bank has your name and uses it.',
      'A 24-hour deadline exists to stop you checking.',
      'No verified badge. Your real bank has one on every message.',
    ],
    category: 'finance',
  },
  {
    key: 'tax-refund',
    senderName: 'Revenue Service Refunds',
    senderEmail: 'refunds@revenue-gov-claims.net',
    subject: 'You are owed a refund of $2,480.00',
    preview: 'Claim your overpayment before the window closes.',
    body:
      'Following the annual reconciliation you have been assessed as having ' +
      'overpaid.\n\n' +
      'Refund amount: $2,480.00\n' +
      'Status: awaiting claimant confirmation\n\n' +
      'Refunds not claimed within 5 working days are returned to the treasury ' +
      'and cannot be reissued. A small processing fee is deducted at the point ' +
      'of release.',
    actionLabel: 'Claim refund',
    lossFraction: 0.12,
    tells: [
      'revenue-gov-claims.net is not a government domain. The real one is revenue.gov.',
      'Tax in this game is withheld at source - there is no refund to claim.',
      'A refund that charges a fee to release is not a refund.',
      'No verified badge.',
    ],
    category: 'finance',
  },
  {
    key: 'vendor-escrow',
    senderName: 'Escrow Release',
    senderEmail: 'escrow@market-release.onion.to',
    subject: 'Your order is held - release the escrow',
    preview: 'Vendor has shipped. Escrow requires manual release.',
    body:
      'Order status: SHIPPED\n' +
      'Escrow status: HELD\n\n' +
      'The vendor has marked your order as dispatched. Escrow will not release ' +
      'automatically on this listing tier. Release manually to complete the ' +
      'transaction and protect your buyer rating.\n\n' +
      'Unreleased escrow is forfeited after 72 hours.',
    actionLabel: 'Release escrow',
    lossFraction: 0.22,
    tells: [
      'Escrow in the marketplace releases on delivery. It never emails you.',
      'A clearnet address (.onion.to) for a hidden-service market is the giveaway.',
      'Threatening your buyer rating is pressure, not process.',
      'No verified badge.',
    ],
    category: 'primary',
    darkWebOnly: true,
  },
  {
    key: 'crypto-recovery',
    senderName: 'Chain Recovery Group',
    senderEmail: 'cases@chain-recovery-group.io',
    subject: 'We can recover the funds you lost',
    preview: 'Recovery specialists. Fee payable on instruction.',
    body:
      'Our analysts have traced wallet activity associated with your address.\n\n' +
      'We specialise in recovering funds lost to fraudulent counterparties. ' +
      'Our success rate on cases of this profile is 94%.\n\n' +
      'An instruction fee is payable up front and is refunded in full if ' +
      'recovery fails.',
    actionLabel: 'Instruct recovery',
    lossFraction: 0.2,
    tells: [
      'Recovery firms that find you are the second scam, not the cure for the first.',
      'A fee payable up front, "refunded if we fail", is the whole mechanism.',
      'A 94% success rate on tracing anonymous transfers is not a real number.',
      'No verified badge.',
    ],
    category: 'primary',
    darkWebOnly: true,
  },
  {
    key: 'payroll-update',
    senderName: 'Payroll Notifications',
    senderEmail: 'hr@deeplife-payroll-secure.com',
    subject: 'Action needed: re-confirm your deposit details',
    preview: 'This period\'s payment could not be deposited.',
    body:
      'Hello,\n\n' +
      'This period\'s salary payment was returned by the receiving institution. ' +
      'Deposit details must be re-confirmed before the payment can be reissued.\n\n' +
      'A verification charge applies to reissued payments and is deducted from ' +
      'the reissued amount.\n\n' +
      'Please re-confirm at your earliest convenience.',
    actionLabel: 'Re-confirm details',
    lossFraction: 0.15,
    tells: [
      'deeplife-payroll-secure.com is not the payroll domain you get payslips from.',
      'Your payslip for this period arrived and the money landed. Check it.',
      'Payroll does not charge you to pay you.',
      'No verified badge.',
    ],
    category: 'finance',
  },
  {
    key: 'inheritance',
    senderName: 'Halvorsen & Pike Notaries',
    senderEmail: 'estates@halvorsen-pike-notary.co',
    subject: 'Estate matter concerning a relative',
    preview: 'A beneficiary has been identified. Fees apply.',
    body:
      'We write regarding the estate of a deceased party sharing your family ' +
      'name, who died without a registered will.\n\n' +
      'Our searches identify you as a plausible beneficiary. The residual estate ' +
      'is substantial. To lodge the claim we require disbursement of the ' +
      'notarial and court fees, which are recovered from the estate on ' +
      'settlement.\n\n' +
      'This matter is time-limited by statute.',
    actionLabel: 'Lodge claim',
    lossFraction: 0.16,
    tells: [
      'An unnamed relative and an unnamed estate. Real notaries name both.',
      'You are asked to pay fees to receive money. That is the scam, every time.',
      'A .co domain imitating a professional firm.',
      'No verified badge.',
    ],
    category: 'primary',
  },
];

/**
 * Pick and build this week's scam, or null.
 *
 * Deterministic in `ctx.rand`, so a replayed tick produces the same message
 * rather than rolling again for a second chance at the player's money.
 */
export function generateScam(ctx: MailContext): MailMessage | null {
  // The spacing guarantee comes first: outside the window there is nothing to
  // roll, so no combination of exposure can produce back-to-back scams.
  if (!scamWindowOpen(ctx.week)) return null;

  const risk = scamRisk(ctx.state, ctx.week);
  if (ctx.rand('scam-fire') > risk.chance) return null;

  // Same rule as `scamRisk`: the seeded vendor directory is not evidence the
  // player has been anywhere. Dark-web-flavoured scams only reach someone who
  // has actually used it, or the escrow copy would be nonsense to them.
  const darkWeb = ctx.state.darkWeb;
  const usedDarkWeb =
    (Array.isArray(darkWeb?.jobHistory) ? darkWeb!.jobHistory.length : 0) > 0 ||
    Math.max(0, darkWeb?.playerReputation ?? 0) > 0 ||
    Math.max(0, darkWeb?.dirtyBtc ?? 0) + Math.max(0, darkWeb?.cleanBtc ?? 0) > 0 ||
    (Array.isArray(darkWeb?.vendors) ? darkWeb!.vendors : []).some((v) => v?.flaggedScam);
  const pool = BLUEPRINTS.filter((b) => !b.darkWebOnly || usedDarkWeb);
  if (pool.length === 0) return null;

  const bp = pool[Math.floor(ctx.rand('scam-pick') * pool.length) % pool.length];

  return {
    id: `mail-scam-${bp.key}-${ctx.week}`,
    senderName: bp.senderName,
    senderEmail: bp.senderEmail,
    // Never verified. Enforced by test - the badge has to stay trustworthy.
    subject: bp.subject,
    preview: bp.preview,
    body: bp.body,
    atWeek: ctx.week,
    read: false,
    starred: false,
    folder: 'inbox',
    category: bp.category,
    action: { id: bp.key, label: bp.actionLabel, kind: 'danger' },
    scam: { lossFraction: bp.lossFraction, tells: bp.tells },
  };
}

/**
 * What acting on this scam would cost, given the state at the moment of the tap.
 *
 * Computed from `prev` inside the updater rather than stored on the message, so
 * a scam that arrived when the player was rich cannot be banked and acted on
 * later for the old, larger figure.
 */
export function scamLossFor(state: GameState, message: MailMessage): number {
  if (!message.scam) return 0;
  const cash = Math.max(0, state.stats?.money ?? 0);
  const byFraction = cash * Math.max(0, Math.min(1, message.scam.lossFraction));
  const capped = Math.min(byFraction, cash * SCAM_LOSS_CAP_FRACTION);
  return Math.max(0, Math.floor(capped));
}

/** Copy for the "here is what it took" confirmation. */
export function scamLossSummary(amount: number): string {
  return amount > 0
    ? `${docMoney(amount)} left your account.`
    : 'Nothing was taken - there was nothing to take.';
}
