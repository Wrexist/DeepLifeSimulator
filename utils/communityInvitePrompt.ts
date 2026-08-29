/**
 * When to offer the Discord community invite.
 *
 * ## The problem this replaces
 *
 * The invite used to be a ONE-SHOT. `app/(tabs)/home.tsx` offered it at
 * `weeksThisLife >= 4`, and either answer closed it forever: joining set the
 * claim marker (correct - the reward is once per install), but DISMISSING set
 * `discord_popup_seen = 'true'`, a tombstone with no expiry.
 *
 * So a single tap on "Maybe later" permanently shut the largest community
 * funnel the game has - and it was asked at the worst possible moment. The
 * reward scales with net worth (`discordJoinRewardMoney`: 1% of net worth,
 * floored at $5k), and a week-4 player is worth almost nothing, so the one and
 * only ask presented the offer in its least attractive form. "Not now" is the
 * rational answer there, and the game took it as "never".
 *
 * ## The rule
 *
 * An offer is spent, not consumed: dismissing records it and starts a cooldown
 * measured in GAME WEEKS. Up to `MAX_OFFERS` asks, at least `OFFER_COOLDOWN_WEEKS`
 * apart. After that the player is left alone - Settings keeps the permanent
 * entry point either way.
 *
 * ## Why game weeks, not the device clock
 *
 * The whole repo gates on `weeksLived` rather than wall time (STATE_VERSION
 * 28/31/35/40/44 are all this same fix applied to a farmable reward). Here the
 * concern is inverted - nobody farms a popup - but a wall-clock cooldown would
 * still be wrong: it would re-ask a player who put the game down for a month
 * the instant they return, having lived no new weeks, which reads as nagging.
 * A cooldown in weeks only elapses by PLAYING, which is exactly the population
 * worth asking twice.
 *
 * `weeksLived` is the absolute counter and is seeded from the starting age, so
 * it is NEVER compared against a raw threshold here - only differenced against
 * a previously stored value of itself, which is age-independent (CLAUDE.md 4.2).
 *
 * ## Ordering
 *
 * The claim marker always wins. A player who joined is never asked again by any
 * path, whatever this module says.
 */
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import type { DiscordClaimState } from '@/utils/discordRewardClaim';

/** Offer record key. The legacy tombstone key is read once, below. */
export const INVITE_OFFER_KEY = 'discord_invite_offers';

/**
 * The pre-cooldown key. Its only value was 'true', written on dismiss AND on
 * join. Read as "one offer already spent", never as "never ask again" - that
 * reading is the bug. Join is still covered, because the claim marker outranks
 * this whole module.
 */
export const LEGACY_SEEN_KEY = 'discord_popup_seen';

/** Total asks per install, including the one an existing save already spent. */
export const MAX_OFFERS = 3;

/**
 * Game weeks between asks. ~3 in-game months: long enough that a second ask
 * reads as a fresh offer rather than the same popup returning, and long enough
 * that the net-worth-scaled reward has visibly moved.
 */
export const OFFER_COOLDOWN_WEEKS = 12;

/** Weeks into THIS life before the first ask - the settled-in delay, unchanged. */
export const MIN_WEEKS_IN_LIFE = 4;

/** How many asks have been spent, and the `weeksLived` of the most recent. */
export interface InviteOfferRecord {
  count: number;
  /** `weeksLived` at the last offer; `undefined` when none has been made. */
  lastWeek?: number;
}

const EMPTY: InviteOfferRecord = { count: 0 };

const finiteNonNegative = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

/**
 * Read the offer record, falling back to the legacy tombstone.
 *
 * Parsed DEFENSIVELY: any malformed value degrades to "nothing spent" rather
 * than throwing. The downside of a mis-parse is one extra popup; throwing here
 * would run inside home's mount effect.
 */
export async function readInviteOffers(): Promise<InviteOfferRecord> {
  try {
    const raw = await safeGetItem(INVITE_OFFER_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const count = finiteNonNegative((parsed as { count?: unknown }).count);
        const lastWeek = finiteNonNegative((parsed as { lastWeek?: unknown }).lastWeek);
        if (count !== undefined) return { count, lastWeek };
      }
      return EMPTY;
    }
    // No record yet. An install that dismissed under the old code has the
    // tombstone: honour it as ONE spent offer so the player is not asked three
    // more times in a row, but do not treat it as permanent.
    const legacy = await safeGetItem(LEGACY_SEEN_KEY);
    if (legacy === 'true') return { count: 1 };
    return EMPTY;
  } catch {
    return EMPTY;
  }
}

/**
 * Record that an offer was just made. Returns false if it could not be stored -
 * the caller has already shown the popup, so a failed write costs one repeated
 * ask next session, never a lost reward.
 */
export async function recordInviteOffer(
  weeksLived: number,
  previous: InviteOfferRecord
): Promise<boolean> {
  const next: InviteOfferRecord = {
    count: previous.count + 1,
    ...(finiteNonNegative(weeksLived) === undefined ? {} : { lastWeek: weeksLived }),
  };
  try {
    return await safeSetItem(INVITE_OFFER_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
}

export interface InviteOfferInput {
  /** Claim state. Anything other than 'unclaimed' means joined - never ask. */
  claim: DiscordClaimState;
  record: InviteOfferRecord;
  /** Weeks lived in THIS life (`weeksInThisLife`), not the raw counter. */
  weeksInThisLife: number;
  /** The absolute counter, for cooldown arithmetic only. */
  weeksLived: number;
  hasCompletedTutorial: boolean;
}

/**
 * Pure: should the invite be offered right now?
 *
 * Pure so both the popup's spawner and its tests can ask the same question -
 * the `AdRewardOrb` rule that a reward is never OFFERED when it cannot be taken.
 */
export function shouldOfferInvite(input: InviteOfferInput): boolean {
  const { claim, record, weeksInThisLife, weeksLived, hasCompletedTutorial } = input;

  // Joined, or a claim is mid-flight: never again, by any path.
  if (claim !== 'unclaimed') return false;
  if (!hasCompletedTutorial) return false;
  if (!(weeksInThisLife >= MIN_WEEKS_IN_LIFE)) return false;
  if (record.count >= MAX_OFFERS) return false;

  // First ask: the settled-in delay above is the only gate.
  if (record.lastWeek === undefined) return true;

  // A cooldown that has not elapsed in GAME weeks. Guard the clock going
  // backwards (a prestige reseeds `weeksLived` from the heir's starting age, so
  // the stored marker can sit in the future): treat that as elapsed rather than
  // locking the player out for the rest of the install.
  const elapsed = weeksLived - record.lastWeek;
  if (elapsed < 0) return true;
  return elapsed >= OFFER_COOLDOWN_WEEKS;
}
