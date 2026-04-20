import type { GameState } from '@/contexts/GameContext';
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
  
  return offers;
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

