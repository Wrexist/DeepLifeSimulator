/**
 * Dark-web marketplace listing engine.
 *
 * - Listings are posted by Vendors and refresh weekly.
 * - Vendors carry a reputation score (0–100). Low rep is cheaper but carries
 *   real scam risk; high rep is more expensive but reliable.
 * - The player accumulates `playerReputation` as a buyer, which gates access
 *   to invite-only listings.
 *
 * Pure functions. Listing rotation uses a seeded roll source (or Math.random
 * if the caller doesn't care about determinism).
 */

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type MarketCategory =
  | 'stolenAccounts'
  | 'cardedItems'
  | 'fakeIds'
  | 'hackingTools'
  | 'services'
  | 'data'
  | 'gear';

export type ListingTier = 'common' | 'pro' | 'elite';

export interface Vendor {
  id: string;
  handle: string;
  /** Reputation 0..100. Drives scam probability and listing price markup. */
  reputation: number;
  /** Total reviews left for this vendor. */
  reviewCount: number;
  /** Whether the vendor has been confirmed as scam this lifecycle. */
  flaggedScam?: boolean;
}

export interface MarketListing {
  id: string;
  vendorId: string;
  category: MarketCategory;
  title: string;
  description: string;
  /** Cost in BTC. */
  costBtc: number;
  tier: ListingTier;
  /** Heat added on successful purchase. */
  heatCost: number;
  /** Minimum buyer rep required to even see this listing. */
  minBuyerRep: number;
  /** weeksLived when posted; expires after `lifetimeWeeks`. */
  postedWeek: number;
  lifetimeWeeks: number;
  /** Skill XP awarded to the relevant skill on successful purchase + use. */
  xpReward?: { skill: string; amount: number };
}

/**
 * Probability that a vendor with the given reputation will scam this buyer.
 *
 * - 0 rep: 80%
 * - 30 rep: 35%
 * - 60 rep: 8%
 * - 90 rep: 1%
 *
 * Capped at 0.95 to leave room for one-in-twenty miracles even with brand-new vendors.
 */
export function vendorScamProbability(reputation: number): number {
  const r = Math.max(0, Math.min(100, safe(reputation, 50)));
  // Sigmoid-ish curve centered around 50.
  const p = 1 / (1 + Math.exp((r - 50) / 10));
  return Math.max(0, Math.min(0.95, p));
}

/**
 * Price markup as a function of vendor reputation. High-rep vendors charge more.
 */
export function priceMultiplierForReputation(reputation: number): number {
  const r = Math.max(0, Math.min(100, safe(reputation, 50)));
  // Linear: 0 rep = 0.6×, 50 rep = 1.0×, 100 rep = 1.6×
  return 0.6 + (r / 100) * 1.0;
}

/**
 * Apply the outcome of a purchase to the vendor's reputation and review count.
 * - Successful delivery: +1 reputation, +1 review.
 * - Scam: -8 reputation, +1 review, flagged.
 */
export function updateVendorAfterPurchase(
  vendor: Vendor,
  outcome: 'success' | 'scam'
): Vendor {
  if (outcome === 'success') {
    return {
      ...vendor,
      reputation: Math.max(0, Math.min(100, safe(vendor.reputation) + 1)),
      reviewCount: safe(vendor.reviewCount) + 1,
    };
  }
  return {
    ...vendor,
    reputation: Math.max(0, safe(vendor.reputation) - 8),
    reviewCount: safe(vendor.reviewCount) + 1,
    flaggedScam: true,
  };
}

/**
 * Update the player's buyer reputation after a purchase. Successful purchases
 * grow rep slowly; getting scammed costs nothing (you weren't the perpetrator)
 * but losing money is its own penalty.
 */
export function updatePlayerReputation(
  current: number,
  outcome: 'success' | 'scam' | 'cancelled',
  tier: ListingTier
): number {
  const base = safe(current, 0);
  if (outcome !== 'success') return base;
  const gain = tier === 'elite' ? 3 : tier === 'pro' ? 2 : 1;
  return Math.max(0, Math.min(100, base + gain));
}

// ---------------------------------------------------------------------------
// Listing generation (rotation each week)
// ---------------------------------------------------------------------------

const TITLES_BY_CATEGORY: Record<MarketCategory, string[]> = {
  stolenAccounts: ['Netflix Premium x10', 'Spotify Family x5', 'Bank Login Bundle', 'Streaming Pack', 'Social Inbox'],
  cardedItems:    ['Electronics Bundle', 'Luxury Goods', 'Gift Card Stack', 'Designer Apparel', 'Mystery Box'],
  fakeIds:        ['Driver\'s License', 'Passport (EU)', 'Student ID', 'Work Permit', 'New Identity Kit'],
  hackingTools:   ['Zero-Day Exploit', 'Phishing Kit', 'Ransomware-as-a-Service', 'RAT Builder', 'SQL Injection Pack'],
  services:       ['DDoS-for-Hire', 'Doxx Service', 'Account Recovery', 'Social Engineering', 'Phone Spoof'],
  data:           ['Credit Card Dump', 'Email Database', 'Crypto Wallet List', 'SSN Pack', 'Medical Records'],
  gear:           ['Lockpicks', 'EMP Device', 'Wireless Scanner', 'Night Vision', 'Encrypted Phone'],
};

const TIER_PRICE_RANGE: Record<ListingTier, [number, number]> = {
  common: [0.002, 0.01],
  pro:    [0.01, 0.06],
  elite:  [0.06, 0.3],
};

const TIER_HEAT_COST: Record<ListingTier, number> = {
  common: 2,
  pro: 6,
  elite: 14,
};

const TIER_MIN_REP: Record<ListingTier, number> = {
  common: 0,
  pro: 10,
  elite: 35,
};

/**
 * Generate a fresh batch of listings for a vendor.
 *
 * @param vendor source vendor
 * @param postedWeek weeksLived when the listings go live
 * @param rolls deterministic roll source — call with a unique key per choice
 */
export function generateListingsForVendor(
  vendor: Vendor,
  postedWeek: number,
  rolls: (key: string) => number,
  countOverride?: number
): MarketListing[] {
  const count = countOverride ?? (1 + Math.floor(rolls(`${vendor.id}.count`) * 3)); // 1–3 listings
  const out: MarketListing[] = [];
  const categories: MarketCategory[] = Object.keys(TITLES_BY_CATEGORY) as MarketCategory[];

  for (let i = 0; i < count; i++) {
    const category = categories[Math.floor(rolls(`${vendor.id}.${i}.cat`) * categories.length)];
    const titles = TITLES_BY_CATEGORY[category];
    const title = titles[Math.floor(rolls(`${vendor.id}.${i}.title`) * titles.length)];

    const tier: ListingTier = (() => {
      const r = rolls(`${vendor.id}.${i}.tier`);
      if (vendor.reputation >= 70 && r > 0.7) return 'elite';
      if (vendor.reputation >= 30 && r > 0.4) return 'pro';
      return 'common';
    })();

    const [lo, hi] = TIER_PRICE_RANGE[tier];
    const priceRoll = rolls(`${vendor.id}.${i}.price`);
    const basePrice = lo + (hi - lo) * priceRoll;
    const costBtc = basePrice * priceMultiplierForReputation(vendor.reputation);

    out.push({
      id: `${vendor.id}-${postedWeek}-${i}`,
      vendorId: vendor.id,
      category,
      title,
      description: `${tier === 'elite' ? 'Top-shelf' : tier === 'pro' ? 'Verified' : 'Generic'} ${title.toLowerCase()}.`,
      costBtc: Math.round(costBtc * 1e6) / 1e6,
      tier,
      heatCost: TIER_HEAT_COST[tier],
      minBuyerRep: TIER_MIN_REP[tier],
      postedWeek,
      lifetimeWeeks: 4,
      xpReward: tier === 'common' ? undefined : { skill: 'opsec', amount: tier === 'elite' ? 30 : 10 },
    });
  }
  return out;
}

/**
 * Drop expired listings from a flat list.
 */
export function pruneExpiredListings(listings: MarketListing[], currentWeek: number): MarketListing[] {
  return listings.filter((l) => currentWeek - safe(l.postedWeek) < safe(l.lifetimeWeeks, 4));
}
