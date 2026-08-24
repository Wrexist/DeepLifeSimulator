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
      description: `Post about our product for $${sponsoredPayment.toLocaleString()}`,
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
      description: `Multi-post campaign for $${brandDealPayment.toLocaleString()}`,
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
      description: `Exclusive partnership for $${premiumPayment.toLocaleString()}`,
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
      description: `${luxuryPull.hook} - $${payment.toLocaleString()}`,
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

  // Tier 1 - Sponsored post (10K+ followers, modest engagement)
  if (followers >= 10_000 && engagement >= 10) {
    const brand = pickBrand(seedFrom(handle, weeksLived, 1));
    const payment = Math.floor(followers * 0.10);
    offers.push({
      id: `pulse_offer_sp_${weeksLived}_${brand.name}`,
      brandName: brand.name,
      type: 'sponsored_post',
      payment,
      // P0-1: 25% is paid as a signing bonus on accept; the remaining 75% is
      // streamed. Total payout = 100% of `payment` (was 125% - bonus on top of
      // a full 100% stream).
      weeklyPayment: Math.floor(payment * 0.75),
      postsRequired: 1,
      duration: 1,
      category: brand.category,
      requirements: { minFollowers: 10_000, minEngagementRate: 10 },
      description: `One sponsored post about ${brand.name}.`,
      expiresInWeeks: 1,
      offeredWeek: weeksLived,
      logoColor1: brand.color1,
      logoColor2: brand.color2,
    });
  }

  // Tier 2 - Brand deal (50K+ followers, healthy engagement)
  if (followers >= 50_000 && engagement >= 15) {
    const brand = pickBrand(seedFrom(handle, weeksLived, 2));
    const payment = Math.floor(followers * 2.0);
    const duration = 4;
    offers.push({
      id: `pulse_offer_bd_${weeksLived}_${brand.name}`,
      brandName: brand.name,
      type: 'brand_deal',
      payment,
      weeklyPayment: Math.floor((payment * 0.75) / duration),
      postsRequired: 3,
      duration,
      category: brand.category,
      requirements: { minFollowers: 50_000, minEngagementRate: 15 },
      description: `Three-post campaign over ${duration} weeks.`,
      expiresInWeeks: 2,
      offeredWeek: weeksLived,
      logoColor1: brand.color1,
      logoColor2: brand.color2,
    });
  }

  // Tier 3 - Premium long campaign (100K+ followers, strong engagement)
  if (followers >= 100_000 && engagement >= 20) {
    const brand = pickBrand(seedFrom(handle, weeksLived, 3));
    const payment = Math.floor(followers * 5.0);
    const duration = 8;
    offers.push({
      id: `pulse_offer_lc_${weeksLived}_${brand.name}`,
      brandName: brand.name,
      type: 'long_campaign',
      payment,
      weeklyPayment: Math.floor((payment * 0.75) / duration),
      postsRequired: 6,
      duration,
      category: brand.category,
      requirements: { minFollowers: 100_000, minEngagementRate: 20 },
      description: `Long-form campaign: 6 posts over ${duration} weeks.`,
      expiresInWeeks: 3,
      offeredWeek: weeksLived,
      prestigeImpact: 2,
      logoColor1: brand.color1,
      logoColor2: brand.color2,
    });
  }

  // Tier 4 - Ambassador exclusive (1M+ followers, reputable)
  if (followers >= 1_000_000 && engagement >= 18 && reputation >= 30) {
    const brand = pickBrand(seedFrom(handle, weeksLived, 4));
    const payment = Math.floor(followers * 10.0);
    const duration = 12;
    offers.push({
      id: `pulse_offer_amb_${weeksLived}_${brand.name}`,
      brandName: brand.name,
      type: 'ambassador',
      payment,
      weeklyPayment: Math.floor((payment * 0.75) / duration),
      postsRequired: 12,
      duration,
      category: brand.category,
      requirements: { minFollowers: 1_000_000, minEngagementRate: 18, minReputation: 30 },
      description: `Exclusive ${duration}-week ambassadorship - one brand only.`,
      expiresInWeeks: 4,
      offeredWeek: weeksLived,
      prestigeImpact: 8,
      logoColor1: brand.color1,
      logoColor2: brand.color2,
    });
  }

  return offers;
}

