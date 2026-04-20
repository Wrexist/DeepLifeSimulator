/**
 * Engagement Ring Definitions
 * 
 * Rings affect proposal success rate and partner happiness
 */

import { EngagementRing } from '@/contexts/game/types';

export const ENGAGEMENT_RINGS: EngagementRing[] = [
  {
    id: 'simple_band',
    name: 'Simple Band',
    price: 500,
    qualityTier: 'simple',
    acceptanceBonus: 0, // No bonus
    description: 'A modest but meaningful silver band. Sometimes simplicity speaks volumes.',
  },
  {
    id: 'classic_solitaire',
    name: 'Classic Solitaire',
    price: 2500,
    qualityTier: 'simple',
    acceptanceBonus: 5,
    description: 'A timeless single diamond on a gold band. A classic choice.',
  },
  {
    id: 'elegant_halo',
    name: 'Elegant Halo',
    price: 8000,
    qualityTier: 'elegant',
    acceptanceBonus: 10,
    description: 'Central diamond surrounded by smaller stones. Sophisticated and beautiful.',
  },
  {
    id: 'vintage_art_deco',
    name: 'Vintage Art Deco',
    price: 15000,
    qualityTier: 'elegant',
    acceptanceBonus: 12,
    description: 'Intricate geometric designs inspired by the 1920s. For the romantic at heart.',
  },
  {
    id: 'luxury_princess',
    name: 'Luxury Princess Cut',
    price: 35000,
    qualityTier: 'luxury',
    acceptanceBonus: 18,
    description: 'A stunning princess-cut diamond in platinum. Truly magnificent.',
  },
  {
    id: 'celebrity_collection',
    name: 'Celebrity Collection',
    price: 75000,
    qualityTier: 'luxury',
    acceptanceBonus: 22,
    description: 'Designed by a famous jeweler. Makes headlines when you propose.',
  },
  {
    id: 'royal_diamond',
    name: 'Royal Diamond',
    price: 150000,
    qualityTier: 'extravagant',
    acceptanceBonus: 28,
    description: 'A 3-carat flawless diamond fit for royalty. Absolutely breathtaking.',
  },
  {
    id: 'legendary_heart',
    name: 'Legendary Heart',
    price: 250000,
    qualityTier: 'extravagant',
    acceptanceBonus: 35,
    description: 'A legendary heart-shaped 5-carat diamond. The ultimate expression of love.',
  },
];

/**
 * Get a ring by ID
 */
export function getEngagementRing(id: string): EngagementRing | undefined {
  return ENGAGEMENT_RINGS.find(r => r.id === id);
}

/**
 * Get rings by quality tier
 */
export function getRingsByTier(tier: EngagementRing['qualityTier']): EngagementRing[] {
  return ENGAGEMENT_RINGS.filter(r => r.qualityTier === tier);
}

/**
 * Get affordable rings based on budget
 */
export function getAffordableRings(budget: number): EngagementRing[] {
  return ENGAGEMENT_RINGS.filter(r => r.price <= budget);
}

/**
 * Calculate base proposal success rate
 * Based on relationship score and ring quality
 */
export function calculateProposalSuccessRate(
  relationshipScore: number,
  ring: EngagementRing,
  datesCount: number = 0,
  livingTogether: boolean = false
): number {
  // Base rate from relationship score (50-90 score maps to 30-80% base rate)
  const baseRate = Math.max(0, Math.min(80, (relationshipScore - 50) * 1.25 + 30));
  
  // Ring bonus
  const ringBonus = ring.acceptanceBonus;
  
  // Dating bonus (each date adds 1%, max 10%)
  const datingBonus = Math.min(10, datesCount * 1);
  
  // Living together bonus
  const cohabBonus = livingTogether ? 10 : 0;
  
  // Total (capped at 95%)
  return Math.min(95, baseRate + ringBonus + datingBonus + cohabBonus);
}

/**
 * Get tier color for UI display
 */
export function getTierColor(tier: EngagementRing['qualityTier']): string {
  switch (tier) {
    case 'simple':
      return '#9CA3AF'; // Gray
    case 'elegant':
      return '#3B82F6'; // Blue
    case 'luxury':
      return '#8B5CF6'; // Purple
    case 'extravagant':
      return '#F59E0B'; // Gold
  }
}

/**
 * Get tier gradient for UI display
 */
export function getTierGradient(tier: EngagementRing['qualityTier']): [string, string] {
  switch (tier) {
    case 'simple':
      return ['#9CA3AF', '#6B7280'];
    case 'elegant':
      return ['#3B82F6', '#2563EB'];
    case 'luxury':
      return ['#8B5CF6', '#7C3AED'];
    case 'extravagant':
      return ['#F59E0B', '#D97706'];
  }
}

