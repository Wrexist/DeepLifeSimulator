/**
 * The dark web writing back — and the first thing the player can do about it.
 *
 * ## The gap this closes
 *
 * Every input to `scamRisk` pushes it UP: trading on the dark web, a vendor who
 * burned you, investigation heat, visible wealth. The drawer reports a
 * percentage and the reasons for it, and until now the player could read that
 * number and do absolutely nothing about it. A risk you can see and cannot
 * touch is a status bar, not a mechanic.
 *
 * The breach notice is the answer. It arrives BEFORE the fraud does, tells you
 * your address is circulating, and offers a rotation that costs money and buys
 * a window of real protection. So the loop becomes: act on the dark web → get
 * warned → pay to harden, or gamble and save the money.
 *
 * ## Why the warning is genuine
 *
 * It would have been easy to make the breach notice itself a scam — the shape
 * is identical, and "your credentials have leaked, click here" is exactly what
 * a phish looks like. That is precisely why it must not be one. If the only
 * message offering protection were fraudulent, the lesson the player would
 * learn is "never act", which is the opposite of a mechanic. It comes from a
 * verified sender, and the fraudulent lookalike lives in `scam.ts` where it
 * belongs.
 */

import type { GameState, MailChoice, MailMessage } from '@/contexts/game/types';
import { SENDERS } from './senders';
import { docMoney, docReference } from './format';
import { getMailState } from './state';

/** How long a rotation holds. Long enough to matter, short enough to re-buy. */
export const SHIELD_WEEKS = 12;

/** Fraction of the base risk a live shield removes. */
export const SHIELD_RISK_REDUCTION = 0.6;

/** Reports that earn the standing discount, and how much it is worth. */
export const REPORTS_FOR_VIGILANCE = 3;
export const VIGILANCE_RISK_REDUCTION = 0.15;

/** Cost of rotating everything. Scales with what there is to protect. */
export function shieldCost(state: GameState | null | undefined): number {
  const liquid = Math.max(0, state?.stats?.money ?? 0) + Math.max(0, state?.bankSavings ?? 0);
  // A floor so it is never free, and a share so it stays meaningful when rich —
  // but capped, because this is a precaution, not a tax.
  return Math.min(4000, Math.max(250, Math.round(liquid * 0.01)));
}

/** True while rotated credentials are still holding. */
export function shieldActive(state: GameState | null | undefined, atWeek: number): boolean {
  const until = getMailState(state).shieldUntilWeek;
  return typeof until === 'number' && atWeek <= until;
}

/**
 * The multiplier `scamRisk` applies after computing exposure.
 *
 * Kept here rather than in `scam.ts` so the whole defensive side of the feature
 * — what reduces risk, by how much, and for how long — reads in one file.
 */
export function riskMultiplier(state: GameState | null | undefined, atWeek: number): number {
  let m = 1;
  if (shieldActive(state, atWeek)) m -= SHIELD_RISK_REDUCTION;
  if ((getMailState(state).reportsMade ?? 0) >= REPORTS_FOR_VIGILANCE) {
    m -= VIGILANCE_RISK_REDUCTION;
  }
  return Math.max(0.1, m);
}

/** Human-readable reasons the risk is LOWER, for the drawer. */
export function protections(
  state: GameState | null | undefined,
  atWeek: number
): string[] {
  const out: string[] = [];
  const until = getMailState(state).shieldUntilWeek;
  if (typeof until === 'number' && atWeek <= until) {
    out.push(`Credentials rotated — holding for ${Math.max(0, until - atWeek)} more weeks.`);
  }
  const reports = getMailState(state).reportsMade ?? 0;
  if (reports >= REPORTS_FOR_VIGILANCE) {
    out.push(`${reports} phishing reports filed — you are harder to fool.`);
  }
  return out;
}

/** Whether the player has actually used the dark web. Mirrors `scam.ts`. */
function usedDarkWeb(state: GameState): boolean {
  const dw = state.darkWeb;
  return (
    (Array.isArray(dw?.jobHistory) ? dw!.jobHistory.length : 0) > 0 ||
    Math.max(0, dw?.playerReputation ?? 0) > 0 ||
    Math.max(0, dw?.dirtyBtc ?? 0) + Math.max(0, dw?.cleanBtc ?? 0) > 0 ||
    (Array.isArray(dw?.vendors) ? dw!.vendors : []).some((v) => v?.flaggedScam)
  );
}

/**
 * A breach notice — the warning shot.
 *
 * Only sent to someone whose address plausibly leaked, and only while they are
 * not already protected. Sending it to a careful player would be noise; sending
 * it to a shielded one would be selling them something they already own.
 */
export function breachNotice(state: GameState, atWeek: number): MailMessage | null {
  if (!usedDarkWeb(state)) return null;
  if (shieldActive(state, atWeek)) return null;
  if (atWeek % 16 !== 5) return null;

  const cost = shieldCost(state);
  const choices: MailChoice[] = [
    {
      id: 'rotate',
      label: 'Rotate everything now',
      detail: `${docMoney(cost)} — new credentials, ${SHIELD_WEEKS} weeks of cover`,
      kind: 'primary',
    },
    {
      id: 'ignore',
      label: 'Leave it',
      detail: 'Costs nothing today.',
      kind: 'neutral',
    },
  ];

  return {
    id: `mail-breach-${atWeek}`,
    threadId: `breach-${atWeek}`,
    senderName: SENDERS.security.name,
    senderEmail: SENDERS.security.email,
    verified: true,
    subject: 'Your address has turned up in a dump',
    preview: 'Credentials linked to your account are circulating.',
    body:
      'We monitor the places where lists like this get traded, and your address ' +
      'is on one of them.\n\n' +
      'Nothing has been taken. What happens next is that the list gets sold on, ' +
      'and the people who buy it start writing to you — convincingly, using ' +
      'details they already have.\n\n' +
      'Rotating your credentials will not stop the mail arriving, but it makes ' +
      'the attempts far less likely to work. It costs money and it wears off. ' +
      'Leaving it costs nothing until it does.',
    atWeek,
    read: false,
    starred: false,
    folder: 'inbox',
    category: 'primary',
    attachment: {
      kind: 'notice',
      title: 'Exposure notice',
      issuer: 'DeepMail Security · Threat Monitoring',
      reference: docReference('SEC', atWeek, 37),
      rows: [
        { label: 'Address found in', value: 'a traded credential list' },
        { label: 'Rotation cost', value: docMoney(cost) },
        { label: 'Cover period', value: `${SHIELD_WEEKS} weeks`, muted: true },
      ],
      note: 'We will never ask for a password. Rotation happens on your device.',
    },
    decision: {
      choices,
      expiresAtWeek: atWeek + 3,
      lapseChoiceId: 'ignore',
      resolver: { kind: 'securityShield', cost, weeks: SHIELD_WEEKS },
    },
  };
}

/**
 * An extortion demand.
 *
 * Not a scam — the threat is real, and refusing genuinely costs. That is the
 * distinction the player has to make: the fraudulent mail wants you to act
 * quickly on something that does not exist, this one is a bad situation you
 * actually created. Both arrive in the same inbox, which is the point.
 */
export function extortionDemand(state: GameState, atWeek: number): MailMessage | null {
  const heat = Math.max(0, Math.min(100, state.darkWeb?.heat ?? 0));
  if (heat < 40) return null;
  if (atWeek % 20 !== 11) return null;

  const cash = Math.max(0, state.stats?.money ?? 0);
  const demand = Math.min(25_000, Math.max(500, Math.round(cash * 0.08)));

  return {
    id: `mail-extortion-${atWeek}`,
    senderName: 'no name given',
    senderEmail: 'contact@protonmail-relay.to',
    subject: 'We have your logs',
    preview: `${docMoney(demand)} and it stays between us.`,
    body:
      'We hold session logs tying your handle to work you would rather not be ' +
      'tied to. We are not interested in you. We are interested in being paid.\n\n' +
      `${docMoney(demand)} and the logs are deleted. Refuse and they go to ` +
      'someone who will be interested in you.\n\n' +
      'There is no negotiation and no second message.',
    atWeek,
    read: false,
    starred: false,
    folder: 'inbox',
    category: 'primary',
    decision: {
      choices: [
        {
          id: 'pay',
          label: 'Pay them',
          detail: `${docMoney(demand)} and it goes away`,
          kind: 'primary',
        },
        {
          id: 'refuse',
          label: 'Refuse',
          detail: 'They follow through. Heat and reputation both take it.',
          kind: 'danger',
        },
      ],
      expiresAtWeek: atWeek + 2,
      // Silence is a refusal. Stated on the message, so it is a choice to make
      // later rather than a trap.
      lapseChoiceId: 'refuse',
      resolver: { kind: 'extortion', demand },
    },
  };
}
