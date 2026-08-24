/**
 * Turning a routed event into a letter.
 *
 * The event supplies the substance — its description and its choices, which
 * still resolve through `resolveEvent`, the one resolver. This supplies the
 * envelope: who it is from, what the subject line says, and which category it
 * files under. Without that every routed event would arrive from "Unknown" with
 * its description as the subject, which is how a good idea ends up looking
 * unfinished.
 *
 * A letter with no entry here still delivers, from a plausible generic sender.
 * That matters: the routing set and this table are edited by different hands at
 * different times, and a missing row must degrade to a slightly plain message,
 * never to a message that cannot be sent.
 */

import type { MailCategory, MailChoice, MailMessage } from '@/contexts/game/types';
import type { WeeklyEvent } from '@/lib/events/engine';
import { LETTER_EXPIRY_WEEKS } from '@/lib/events/routing';

interface LetterFrame {
  senderName: string;
  senderEmail: string;
  subject: string;
  /** Optional lead-in printed above the event's own description. */
  lede?: string;
  category: MailCategory;
  /** Real institutions get the badge. A summons is genuinely from the court. */
  verified?: boolean;
}

const FRAMES: Record<string, LetterFrame> = {
  jury_duty: {
    senderName: 'County Clerk of Court',
    senderEmail: 'summons@county-court.gov',
    subject: 'Summons for jury service',
    lede: 'You are summoned to appear for jury service. This notice requires a response.',
    category: 'primary',
    verified: true,
  },
  lawsuit_threat: {
    senderName: 'Ackerman & Doyle LLP',
    senderEmail: 'litigation@ackermandoyle.com',
    subject: 'Notice of intended claim',
    lede: 'We act for the claimant in the matter below. This letter is sent before action.',
    category: 'primary',
  },
  wealth_tax_audit: {
    senderName: 'Revenue Service',
    senderEmail: 'notices@revenue.gov',
    subject: 'Notice of examination - six-year review',
    category: 'finance',
    verified: true,
  },
  wealth_hit_piece: {
    senderName: 'The Ledger - Investigations',
    senderEmail: 'factcheck@theledger.com',
    subject: 'Right of reply - nineteen questions',
    category: 'social',
  },
  wealth_land_bank_play: {
    senderName: 'Holt & Marsh Conveyancers',
    senderEmail: 'acquisitions@holtmarsh.com',
    subject: 'The fifth parcel - the owner has worked it out',
    category: 'finance',
  },
  wealth_trust_fund_dispute: {
    senderName: 'Trust Counsel',
    senderEmail: 'trusts@ackermandoyle.com',
    subject: 'Your children are suing each other',
    category: 'primary',
  },
  legal_parking_fine: {
    senderName: 'City Parking Authority',
    senderEmail: 'notices@city-parking.gov',
    subject: 'Penalty charge notice',
    category: 'finance',
    verified: true,
  },
  legal_speeding_notice: {
    senderName: 'Roads Policing Unit',
    senderEmail: 'notices@roadspolicing.gov',
    subject: 'Notice of intended prosecution',
    category: 'finance',
    verified: true,
  },
  legal_small_claim: {
    senderName: 'Small Claims Registry',
    senderEmail: 'registry@smallclaims.gov',
    subject: 'A claim has been filed against you',
    category: 'primary',
    verified: true,
  },
  legal_settlement_offer: {
    senderName: 'Ackerman & Doyle LLP',
    senderEmail: 'settlements@ackermandoyle.com',
    subject: 'Offer to settle - open for four weeks',
    category: 'primary',
  },

  // ------------------------------------------------------------------
  // The inbox pack — post worth opening.
  //
  // None of these carry the verified badge, and that is not an oversight: the
  // badge means "the game vouches for this sender" and is reserved for the
  // player's own bank, employer and government. A reunion committee and a
  // courier depot are exactly the kind of ordinary correspondence that should
  // NOT have it, or the badge stops meaning anything and the fraud tell it
  // exists to support goes with it.
  // ------------------------------------------------------------------
  inbox_reunion_invite: {
    senderName: 'Reunion Committee',
    senderEmail: 'committee@classof-reunion.org',
    subject: 'You are invited - the reunion',
    category: 'social',
  },
  inbox_mystery_parcel: {
    senderName: 'Parcel Depot',
    senderEmail: 'deliveries@parceldepot.com',
    subject: 'A parcel was left for you',
    lede: 'Delivery attempted and completed. No sender details were provided.',
    category: 'primary',
  },
  inbox_time_capsule: {
    senderName: 'Time Capsule Scheme',
    senderEmail: 'archive@timecapsule-scheme.org',
    subject: 'A letter you wrote, returned to you',
    category: 'primary',
  },
  inbox_charity_appeal: {
    senderName: 'The Northside Appeal',
    senderEmail: 'appeals@northside-trust.org',
    subject: 'A small thing, asked properly',
    category: 'social',
  },
  inbox_wallet_returned: {
    senderName: 'A stranger',
    senderEmail: 'no-reply@post.deepmail.com',
    subject: 'I think this is yours',
    category: 'primary',
  },
  inbox_game_show_casting: {
    senderName: 'Casting - Quiz Format',
    senderEmail: 'casting@brightlineproductions.tv',
    subject: 'We would like to put you on television',
    category: 'social',
  },
  inbox_neighbour_petition: {
    senderName: 'Residents’ Association',
    senderEmail: 'residents@millroad-association.org',
    subject: 'Petition: the extension at number 14',
    category: 'social',
  },
};

const FALLBACK: LetterFrame = {
  senderName: 'Correspondence',
  senderEmail: 'post@deepmail.com',
  subject: 'A letter has arrived',
  category: 'primary',
};

/** First sentence of the description, for the list-row snippet. */
function snippet(description: string): string {
  const text = (description || '').trim();
  const stop = text.search(/[.!?]\s/);
  const first = stop === -1 ? text : text.slice(0, stop + 1);
  return first.length > 110 ? `${first.slice(0, 107)}…` : first;
}

/**
 * Build the mail message for a routed event.
 *
 * The choice LABELS are the event's own `text` - deliberately, so the two
 * channels never disagree about what the player is being offered. Only the
 * envelope is new.
 */
export function letterFromEvent(event: WeeklyEvent, atWeek: number): MailMessage | null {
  if (!event?.id || !Array.isArray(event.choices) || event.choices.length === 0) return null;

  const frame = FRAMES[event.id] ?? FALLBACK;
  const choices: MailChoice[] = event.choices.map((c, i) => ({
    id: c.id,
    label: c.text,
    // The first choice reads as the expected one; nothing here is destructive
    // enough to warrant the danger styling, which is reserved for fraud.
    kind: i === 0 ? 'primary' : 'neutral',
  }));

  return {
    // Keyed on the EVENT id, not the week: an event lives across several weeks,
    // and keying by week would deliver the same letter again every tick.
    id: `mail-letter-${event.id}`,
    senderName: frame.senderName,
    senderEmail: frame.senderEmail,
    verified: frame.verified,
    subject: frame.subject,
    preview: snippet(event.description),
    body: frame.lede ? `${frame.lede}\n\n${event.description}` : event.description,
    atWeek: Math.max(0, Math.floor(atWeek)),
    read: false,
    starred: false,
    folder: 'inbox',
    category: frame.category,
    decision: {
      choices,
      expiresAtWeek:
        typeof event.expiresAtWeek === 'number'
          ? event.expiresAtWeek
          : Math.max(0, Math.floor(atWeek)) + LETTER_EXPIRY_WEEKS,
      // Lapsing takes the LAST choice. Templates put the do-nothing / decline
      // option last by convention, so an ignored letter resolves to the passive
      // option rather than to whatever happened to be written first.
      lapseChoiceId: choices[choices.length - 1].id,
      resolver: { kind: 'event', eventId: event.id },
    },
  };
}
