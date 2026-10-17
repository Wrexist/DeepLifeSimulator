import type { GameState , PulseBrandOffer, PulseBrandCategory } from '@/contexts/game/types';
import { getSocialMediaData, type SocialMediaData } from './socialMedia';

export interface BrandPartnershipOffer {
  id: string;
  brandName: string;
  type: 'sponsored_post' | 'brand_deal';
  payment: number;
  requirements: {
    minFollowers: number;
    minEngagementRate: number;
  };
  description: string;
  expiresIn: number; // Weeks until offer expires
}

/**
 * Generate brand partnership offers based on follower count and engagement
 */
export function generateBrandOffers(state: GameState): BrandPartnershipOffer[] {
  const socialData = getSocialMediaData(state);
  const offers: BrandPartnershipOffer[] = [];

  // Only generate offers if player has 10,000+ followers
  if (socialData.followers < 10_000) {
    return offers;
  }

  // Sponsored post offers (weekly, smaller payments)
  if (socialData.followers >= 10_000 && socialData.engagementRate >= 10) {
    const sponsoredPayment = Math.floor(socialData.followers * 0.1); // $0.10 per follower
    offers.push({
      id: `sponsored_${Date.now()}`,
      brandName: 'Local Business',
      type: 'sponsored_post',
      payment: sponsoredPayment,
      requirements: {
        minFollowers: 10_000,
        minEngagementRate: 10,
      },
      description: `Post about our product for $${sponsoredPayment.toLocaleString('en-US')}`,
      expiresIn: 1, // Expires in 1 week
    });
  }

  // Brand deal offers (monthly, larger payments, requires higher followers)
  if (socialData.followers >= 50_000 && socialData.engagementRate >= 15) {
    const brandDealPayment = Math.floor(socialData.followers * 2); // $2 per follower
    offers.push({
      id: `brand_deal_${Date.now()}`,
      brandName: 'Major Brand',
      type: 'brand_deal',
      payment: brandDealPayment,
      requirements: {
        minFollowers: 50_000,
        minEngagementRate: 15,
      },
      description: `Multi-post campaign for $${brandDealPayment.toLocaleString('en-US')}`,
      expiresIn: 4, // Expires in 4 weeks
    });
  }

  // Premium brand deals (requires influencer status)
  if (socialData.followers >= 100_000 && socialData.engagementRate >= 20) {
    const premiumPayment = Math.floor(socialData.followers * 5); // $5 per follower
    offers.push({
      id: `premium_deal_${Date.now()}`,
      brandName: 'Luxury Brand',
      type: 'brand_deal',
      payment: premiumPayment,
      requirements: {
        minFollowers: 100_000,
        minEngagementRate: 20,
      },
      description: `Exclusive partnership for $${premiumPayment.toLocaleString('en-US')}`,
      expiresIn: 8, // Expires in 8 weeks
    });
  }

  // Luxury-house offers. A brand does not approach an influencer purely on
  // reach - it approaches the one whose life already looks like the campaign.
  // Owning the hypercar, the watch collection or the jet is what makes the
  // player that person, so the collection RAISES both eligibility and rate.
  //
  // Deliberately reachable at a LOWER follower count than the premium tier
  // above: an audience of 40,000 who watch you get out of a hypercar is worth
  // more to a watch house than 100,000 who do not.
  const luxuryPull = getLuxuryBrandPull(state);
  if (luxuryPull.qualifies && socialData.followers >= 40_000) {
    const payment = Math.floor(socialData.followers * luxuryPull.ratePerFollower);
    offers.push({
      id: `luxury_house_${Date.now()}`,
      brandName: luxuryPull.brandName,
      type: 'brand_deal',
      payment,
      requirements: {
        minFollowers: 40_000,
        minEngagementRate: 12,
      },
      description: `${luxuryPull.hook} - $${payment.toLocaleString('en-US')}`,
      expiresIn: 6,
    });
  }

  return offers;
}

/**
 * What the player's collection is worth to a luxury house.
 *
 * Reads ownership only - no follower maths - so it stays a pure statement about
 * the collection and the caller decides how to combine it with reach.
 */
export function getLuxuryBrandPull(state: GameState): {
  qualifies: boolean;
  brandName: string;
  hook: string;
  /** Dollars per follower this partnership pays. */
  ratePerFollower: number;
} {
  const owned = new Set(state.luxuryItems ?? []);

  // Ordered best-fit first: the most photogenic asset defines the campaign.
  if (owned.has('supercar')) {
    return {
      qualifies: true,
      brandName: 'Marque Automotive',
      hook: 'Shoot the campaign with your own car',
      ratePerFollower: 7,
    };
  }
  if (owned.has('rare_watch_collection')) {
    return {
      qualifies: true,
      brandName: 'Maison Horologie',
      hook: 'A collector campaign, wearing your own pieces',
      ratePerFollower: 6,
    };
  }
  if (owned.has('luxury_yacht') || owned.has('mega_yacht') || owned.has('private_island')) {
    return {
      qualifies: true,
      brandName: 'Riviera Resorts',
      hook: 'A destination campaign shot where you already are',
      ratePerFollower: 5.5,
    };
  }
  if (owned.has('fine_art_collection') || owned.has('museum_diamond')) {
    return {
      qualifies: true,
      brandName: 'Atelier Privé',
      hook: 'A quiet-luxury feature built around your collection',
      ratePerFollower: 5,
    };
  }

  return { qualifies: false, brandName: '', hook: '', ratePerFollower: 0 };
}

/**
 * Check if player qualifies for brand partnership
 */
export function qualifiesForPartnership(
  socialData: SocialMediaData,
  offer: BrandPartnershipOffer
): boolean {
  return (
    socialData.followers >= offer.requirements.minFollowers &&
    socialData.engagementRate >= offer.requirements.minEngagementRate
  );
}

/**
 * Calculate influencer career income based on followers and engagement
 */
export function calculateInfluencerIncome(
  followers: number,
  engagementRate: number
): number {
  // Base income: $0.50 per 1,000 followers per week
  let baseIncome = Math.floor((followers / 1000) * 0.5);

  // Engagement multiplier (higher engagement = more income)
  const engagementMultiplier = 1 + (engagementRate / 100);
  baseIncome = Math.floor(baseIncome * engagementMultiplier);

  // Minimum income for influencer career
  return Math.max(1000, baseIncome);
}

// ─────────────────────────────────────────────────────────────────────
// Pulse brand-deal generation (v13+)
// ─────────────────────────────────────────────────────────────────────

// Curated brand catalog. Each entry seeds a deterministic offer based on
// player handle + week, so re-rolling the same tick yields the same offers.
const PULSE_BRAND_CATALOG: {
  name: string;
  category: PulseBrandCategory;
  color1: string;
  color2: string;
}[] = [
  { name: 'NebulaCola',     category: 'food',      color1: '#F472B6', color2: '#7C3AED' },
  { name: 'MoonAudio',      category: 'tech',      color1: '#38BDF8', color2: '#1E40AF' },
  { name: 'AuraFit',        category: 'fitness',   color1: '#34D399', color2: '#065F46' },
  { name: 'LumeRide',       category: 'auto',      color1: '#FBBF24', color2: '#92400E' },
  { name: 'ZephyrWear',     category: 'fashion',   color1: '#FB7185', color2: '#9F1239' },
  { name: 'PalaceCoffee',   category: 'food',      color1: '#A78BFA', color2: '#5B21B6' },
  { name: 'OrbitBank',      category: 'finance',   color1: '#60A5FA', color2: '#1E3A8A' },
  { name: 'TerraStays',     category: 'lifestyle', color1: '#F59E0B', color2: '#7C2D12' },
  { name: 'PulseProtein',   category: 'fitness',   color1: '#EF4444', color2: '#7F1D1D' },
  { name: 'NovaStudio',     category: 'tech',      color1: '#8B5CF6', color2: '#4C1D95' },
];

function pickBrand(seed: number) {
  return PULSE_BRAND_CATALOG[Math.abs(seed) % PULSE_BRAND_CATALOG.length];
}

// ─────────────────────────────────────────────────────────────────────
// What a brand pays, and for what (2026-10-17 economy pass)
// ─────────────────────────────────────────────────────────────────────
//
// A Pulse contract pays PER DELIVERED POST, at a per-follower rate, and nothing
// for posts that were never made.
//
// Measured on the real tick + actions before this change (accept every offer,
// followers held fixed, weeks 13-60 of a 60-week run):
//
//                 post nothing      4 posts/wk     concurrent deals
//     50K         $82,524/wk        $105,024/wk          5
//     100K       $618,226/wk        $663,226/wk         13
//     1M      $15,556,744/wk     $16,006,744/wk         25
//
// against a best-ladder career top of $6,000/wk. Three defects compounded:
//   1. The rates were $2 / $5 / $10 per follower per CONTRACT - $0.67-$0.83
//      per follower per post, ~80x a real sponsorship and ~15x the game's own
//      `brand_deal_offer` event ($0.05/follower for one promotion).
//   2. 25% was paid on accept and the other 75% STREAMED weekly by the tick
//      whether or not a single post was delivered. An undelivered contract
//      kept 81-94% of its value for a -5 reputation hit, so "post nothing"
//      earned 79-97% of "do the work".
//   3. Every tier re-offered weekly with no limit on concurrent contracts, and
//      the weekly stream entered income beside salary - outside the $50K/wk
//      social per-source cap in `calcWeeklyPassiveIncome` and multiplied by
//      every income multiplier.
//
// Paying per post fixes 2 and 3 at the root: money only moves when a post is
// delivered, posting is limited to one post per content type per week (five a
// week at most), and each post can sponsor exactly one deal - so stacking
// contracts no longer stacks income, and accepting/declining/double-tapping an
// offer moves no money at all. The rates below fix 1.
//
// Rate: $0.01 per follower per post (the industry rule of thumb of ~$100 per
// 10K followers per post), with a small premium for the longer commitments,
// and never more than BRAND_PAY_PER_POST_CAP. Five posts a week at the cap is
// $50,000/wk - the same ceiling the passive path puts on social income - and
// the cap is reached around 0.5-1M followers, i.e. at the celebrity tier.

/** Dollars per follower a brand pays for ONE delivered post, by contract tier. */
export const BRAND_RATE_PER_FOLLOWER_PER_POST: Readonly<Record<PulseBrandOffer['type'], number>> = {
  sponsored_post: 0.010,
  brand_deal: 0.012,
  long_campaign: 0.015,
  ambassador: 0.020,
};

/**
 * The most any single delivered post pays. Five content types can each post
 * once a week, so this bounds brand pay at 5 x $10,000 = $50,000/wk - the
 * `socialMedia` per-source cap in `calcWeeklyPassiveIncome`.
 */
export const BRAND_PAY_PER_POST_CAP = 10_000;

/** What one delivered post on a `type` contract pays an audience of `followers`. */
export function brandPayPerPost(type: PulseBrandOffer['type'], followers: number): number {
  const safeFollowers = Number.isFinite(followers) && followers > 0 ? followers : 0;
  return Math.min(
    BRAND_PAY_PER_POST_CAP,
    Math.floor(safeFollowers * BRAND_RATE_PER_FOLLOWER_PER_POST[type]),
  );
}

/**
 * A contract signed under the PRE-2026-10-17 terms: 25% on accept plus a
 * weekly stream. Those terms are honoured to the end for deals already
 * ACCEPTED (they run out within 12 weeks); pending OFFERS minted on the old
 * rate card are withdrawn rather than paid per post at the old price.
 *
 * `weeklyPayment` is the discriminator: the old generator set it on every
 * tier, and nothing writes it any more. No new field was needed.
 */
export function isStreamedBrandDeal(deal: { weeklyPayment?: number } | null | undefined): boolean {
  return typeof deal?.weeklyPayment === 'number' && deal.weeklyPayment > 0;
}

/**
 * Cash paid for delivering post number `deliveredAfter` of `postsRequired`.
 *
 * Telescoping floors, so the shares of a whole contract sum to exactly
 * `payment` whatever the rounding (and a deal priced by `brandPayPerPost`
 * pays exactly that per post).
 */
export function brandPostShare(payment: number, postsRequired: number, deliveredAfter: number): number {
  const total = Number.isFinite(payment) && payment > 0 ? payment : 0;
  const required = Math.max(1, Math.floor(postsRequired || 1));
  const after = Math.min(required, Math.max(0, Math.floor(deliveredAfter)));
  if (after === 0) return 0;
  return Math.floor((total * after) / required) - Math.floor((total * (after - 1)) / required);
}

/** What a per-post contract has paid out once `delivered` posts are in. */
export function brandPaidForDelivered(payment: number, postsRequired: number, delivered: number): number {
  const total = Number.isFinite(payment) && payment > 0 ? payment : 0;
  const required = Math.max(1, Math.floor(postsRequired || 1));
  const done = Math.min(required, Math.max(0, Math.floor(delivered || 0)));
  return Math.floor((total * done) / required);
}

function seedFrom(handle: string, week: number, slot: number): number {
  const s = `${handle}|${week}|${slot}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Extended brand-offer generator for the Pulse inbox.
 *
 * Replaces the legacy `generateBrandOffers` for v13+ saves. Returns up to four
 * tiered offers (sponsored, deal, premium, ambassador) gated on follower count
 * and engagement. Each offer carries deliverable count, duration, category,
 * and brand-specific colors so the UI can render a real-looking inbox.
 *
 * `payment` is the whole contract: `postsRequired` x `brandPayPerPost`, paid
 * one post at a time as posts are delivered (see the rate notes above). No
 * offer carries `weeklyPayment` any more - that field now marks a contract
 * signed under the old streamed terms (`isStreamedBrandDeal`).
 *
 * Deterministic seed per (handle, weeksLived, tierSlot) - re-running the same
 * tick yields the same offers, which keeps things stable across StrictMode
 * double-renders.
 */
export function generateBrandOffersExtended(
  state: GameState,
  weeksLived: number,
): PulseBrandOffer[] {
  // Read from state directly - the Pulse tick keeps `engagementRate` current,
  // and `getSocialMediaData` would silently re-derive it from posting cadence
  // which would diverge from what the tick just wrote.
  const followers = getSocialMediaData(state).followers; // keeps politics-perk bonus
  const engagement = state.socialMedia?.engagementRate ?? 0;
  const reputation = state.stats?.reputation ?? 0;
  const handle = state.userProfile?.handle || 'player';
  const offers: PulseBrandOffer[] = [];
  const money = (n: number) => `$${n.toLocaleString('en-US')}`;

  // Tier 1 - Sponsored post (10K+ followers, modest engagement)
  if (followers >= 10_000 && engagement >= 10) {
    const brand = pickBrand(seedFrom(handle, weeksLived, 1));
    const perPost = brandPayPerPost('sponsored_post', followers);
    const postsRequired = 1;
    offers.push({
      id: `pulse_offer_sp_${weeksLived}_${brand.name}`,
      brandName: brand.name,
      type: 'sponsored_post',
      payment: perPost * postsRequired,
      postsRequired,
      duration: 1,
      category: brand.category,
      requirements: { minFollowers: 10_000, minEngagementRate: 10 },
      description: `One sponsored post about ${brand.name}, paid ${money(perPost)} on delivery.`,
      expiresInWeeks: 1,
      offeredWeek: weeksLived,
      logoColor1: brand.color1,
      logoColor2: brand.color2,
    });
  }

  // Tier 2 - Brand deal (50K+ followers, healthy engagement)
  if (followers >= 50_000 && engagement >= 15) {
    const brand = pickBrand(seedFrom(handle, weeksLived, 2));
    const perPost = brandPayPerPost('brand_deal', followers);
    const postsRequired = 3;
    const duration = 4;
    offers.push({
      id: `pulse_offer_bd_${weeksLived}_${brand.name}`,
      brandName: brand.name,
      type: 'brand_deal',
      payment: perPost * postsRequired,
      postsRequired,
      duration,
      category: brand.category,
      requirements: { minFollowers: 50_000, minEngagementRate: 15 },
      description: `Three posts within ${duration} weeks, ${money(perPost)} per post delivered.`,
      expiresInWeeks: 2,
      offeredWeek: weeksLived,
      logoColor1: brand.color1,
      logoColor2: brand.color2,
    });
  }

  // Tier 3 - Premium long campaign (100K+ followers, strong engagement)
  if (followers >= 100_000 && engagement >= 20) {
    const brand = pickBrand(seedFrom(handle, weeksLived, 3));
    const perPost = brandPayPerPost('long_campaign', followers);
    const postsRequired = 6;
    const duration = 8;
    offers.push({
      id: `pulse_offer_lc_${weeksLived}_${brand.name}`,
      brandName: brand.name,
      type: 'long_campaign',
      payment: perPost * postsRequired,
      postsRequired,
      duration,
      category: brand.category,
      requirements: { minFollowers: 100_000, minEngagementRate: 20 },
      description: `Long-form campaign: 6 posts within ${duration} weeks, ${money(perPost)} per post delivered.`,
      expiresInWeeks: 3,
      offeredWeek: weeksLived,
      prestigeImpact: 2,
      logoColor1: brand.color1,
      logoColor2: brand.color2,
    });
  }

  // Tier 4 - Ambassadorship (1M+ followers, reputable). Not exclusive: the
  // old copy said "one brand only" and nothing ever enforced it.
  if (followers >= 1_000_000 && engagement >= 18 && reputation >= 30) {
    const brand = pickBrand(seedFrom(handle, weeksLived, 4));
    const perPost = brandPayPerPost('ambassador', followers);
    const postsRequired = 12;
    const duration = 12;
    offers.push({
      id: `pulse_offer_amb_${weeksLived}_${brand.name}`,
      brandName: brand.name,
      type: 'ambassador',
      payment: perPost * postsRequired,
      postsRequired,
      duration,
      category: brand.category,
      requirements: { minFollowers: 1_000_000, minEngagementRate: 18, minReputation: 30 },
      description: `${duration}-week ambassadorship: 12 posts, ${money(perPost)} per post delivered.`,
      expiresInWeeks: 4,
      offeredWeek: weeksLived,
      prestigeImpact: 8,
      logoColor1: brand.color1,
      logoColor2: brand.color2,
    });
  }

  return offers;
}

