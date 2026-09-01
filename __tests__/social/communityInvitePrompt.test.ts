/**
 * The community invite may be asked more than once.
 *
 * The behaviour under test is a deliberate reversal. The invite used to be a
 * one-shot: dismissing it wrote `discord_popup_seen = 'true'`, a tombstone with
 * no expiry, so one "maybe later" closed the biggest community funnel the game
 * has - permanently, and at the moment the offer was worth least (the reward is
 * 1% of net worth floored at $5k, and a week-4 player is worth nothing).
 *
 * What must NOT regress in the other direction is the exactly-once REWARD. The
 * claim marker outranks every rule here, so a player who joined is never asked
 * again no matter what the offer record says.
 */
import {
  MAX_OFFERS,
  MIN_WEEKS_IN_LIFE,
  OFFER_COOLDOWN_WEEKS,
  shouldOfferInvite,
  type InviteOfferRecord,
} from '@/utils/communityInvitePrompt';

/** A settled-in player who has never been asked. */
const base = {
  claim: 'unclaimed' as const,
  record: { count: 0 } as InviteOfferRecord,
  weeksInThisLife: MIN_WEEKS_IN_LIFE,
  weeksLived: 500,
};

describe('shouldOfferInvite', () => {
  it('offers once the player is settled in', () => {
    expect(shouldOfferInvite(base)).toBe(true);
  });

  it('waits out the settling-in delay', () => {
    expect(shouldOfferInvite({ ...base, weeksInThisLife: MIN_WEEKS_IN_LIFE - 1 })).toBe(false);
  });


  describe('a joined player is never asked again', () => {
    // Both non-'unclaimed' states must suppress. A PENDING claim is the subtle
    // one: the reward has been begun but not finalized, and re-offering there
    // is how a one-time grant gets shown twice.
    it.each([
      ['finalized', 'finalized' as const],
      ['pending', { pendingAmount: 5000 }],
    ])('%s', (_label, claim) => {
      expect(shouldOfferInvite({ ...base, claim: claim as never })).toBe(false);
    });
  });

  describe('cooldown', () => {
    const asked: InviteOfferRecord = { count: 1, lastWeek: 500 };

    it('does not re-ask before the cooldown has elapsed in game weeks', () => {
      const state = { ...base, record: asked, weeksLived: 500 + OFFER_COOLDOWN_WEEKS - 1 };
      expect(shouldOfferInvite(state)).toBe(false);
    });

    it('re-asks once it has', () => {
      const state = { ...base, record: asked, weeksLived: 500 + OFFER_COOLDOWN_WEEKS };
      expect(shouldOfferInvite(state)).toBe(true);
    });

    it('re-asks when the counter went BACKWARDS', () => {
      // A prestige reseeds weeksLived from the heir's starting age, so a stored
      // marker can legitimately sit in the future. Subtracting gives a negative
      // and a naive `>=` would lock the player out for the rest of the install.
      const state = { ...base, record: { count: 1, lastWeek: 9000 }, weeksLived: 104 };
      expect(shouldOfferInvite(state)).toBe(true);
    });
  });

  it('stops asking at the cap, however long the player plays', () => {
    const spent: InviteOfferRecord = { count: MAX_OFFERS, lastWeek: 500 };
    expect(shouldOfferInvite({ ...base, record: spent, weeksLived: 99_999 })).toBe(false);
  });

  it('treats a record with no lastWeek as never asked', () => {
    // The legacy migration produces exactly this shape ({ count: 1 } from the
    // old tombstone): one ask already spent, but no week to count a cooldown
    // from. It must be askable, or the migration would preserve the very
    // permanence it exists to undo.
    expect(shouldOfferInvite({ ...base, record: { count: 1 } })).toBe(true);
  });
});
