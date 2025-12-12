/**
 * Wedding Venue Definitions
 * 
 * Different venues for wedding ceremonies with varying costs and bonuses
 */

import { WeddingVenue, WeddingPlan } from '@/contexts/game/types';

export const WEDDING_VENUES: WeddingVenue[] = [
  {
    id: 'courthouse',
    name: 'Courthouse',
    type: 'courthouse',
    baseCost: 200,
    guestCapacity: 10,
    happinessBonus: 10,
    reputationBonus: 0,
    description: 'A simple civil ceremony. Quick, affordable, and legally binding.',
  },
  {
    id: 'local_church',
    name: 'Local Church',
    type: 'church',
    baseCost: 3000,
    guestCapacity: 100,
    happinessBonus: 20,
    reputationBonus: 5,
    description: 'Traditional church wedding with all the classic elements.',
  },
  {
    id: 'beach_sunset',
    name: 'Beach Sunset Ceremony',
    type: 'beach',
    baseCost: 8000,
    guestCapacity: 75,
    happinessBonus: 30,
    reputationBonus: 8,
    description: 'Say your vows with the ocean waves and sunset as your backdrop.',
  },
  {
    id: 'botanical_garden',
    name: 'Botanical Garden',
    type: 'garden',
    baseCost: 12000,
    guestCapacity: 150,
    happinessBonus: 35,
    reputationBonus: 12,
    description: 'Surrounded by beautiful flowers and nature. Perfect for spring weddings.',
  },
  {
    id: 'luxury_hotel',
    name: 'Luxury Hotel Ballroom',
    type: 'luxury_hotel',
    baseCost: 35000,
    guestCapacity: 300,
    happinessBonus: 45,
    reputationBonus: 20,
    description: 'An elegant ballroom with crystal chandeliers and five-star service.',
  },
  {
    id: 'destination_paris',
    name: 'Parisian Château',
    type: 'destination',
    baseCost: 75000,
    guestCapacity: 100,
    happinessBonus: 55,
    reputationBonus: 30,
    description: 'A fairy-tale wedding in a French château. Truly unforgettable.',
  },
  {
    id: 'destination_tropical',
    name: 'Tropical Island Resort',
    type: 'destination',
    baseCost: 100000,
    guestCapacity: 50,
    happinessBonus: 60,
    reputationBonus: 35,
    description: 'Private island wedding with crystal clear waters and white sand beaches.',
  },
];

// Wedding add-ons and their costs
export const WEDDING_ADDONS = {
  catering: {
    name: 'Premium Catering',
    baseCostPerGuest: 150,
    description: 'Gourmet food and open bar for all guests.',
  },
  photography: {
    name: 'Professional Photography',
    cost: 3000,
    description: 'Full day coverage with professional photos and album.',
  },
  music: {
    name: 'Live Band & DJ',
    cost: 5000,
    description: 'Professional entertainment for the ceremony and reception.',
  },
  decorations: {
    name: 'Premium Decorations',
    cost: 4000,
    description: 'Floral arrangements, lighting, and custom decorations.',
  },
};

/**
 * Get a venue by ID
 */
export function getWeddingVenue(id: string): WeddingVenue | undefined {
  return WEDDING_VENUES.find(v => v.id === id);
}

/**
 * Get venues by type
 */
export function getVenuesByType(type: WeddingVenue['type']): WeddingVenue[] {
  return WEDDING_VENUES.filter(v => v.type === type);
}

/**
 * Get affordable venues based on budget
 */
export function getAffordableVenues(budget: number): WeddingVenue[] {
  return WEDDING_VENUES.filter(v => v.baseCost <= budget);
}

/**
 * Calculate total wedding cost
 */
export function calculateWeddingCost(plan: Partial<WeddingPlan> & { venueId: string; guestCount: number }): number {
  const venue = getWeddingVenue(plan.venueId);
  if (!venue) return 0;

  let total = venue.baseCost;

  // Add catering cost
  if (plan.catering) {
    total += WEDDING_ADDONS.catering.baseCostPerGuest * Math.min(plan.guestCount, venue.guestCapacity);
  }

  // Add photography
  if (plan.photography) {
    total += WEDDING_ADDONS.photography.cost;
  }

  // Add music
  if (plan.music) {
    total += WEDDING_ADDONS.music.cost;
  }

  // Add decorations
  if (plan.decorations) {
    total += WEDDING_ADDONS.decorations.cost;
  }

  return total;
}

/**
 * Create a wedding plan from selections
 */
export function createWeddingPlan(
  venueId: string,
  partnerId: string,
  guestCount: number,
  scheduledWeek: number,
  options: {
    catering?: boolean;
    photography?: boolean;
    music?: boolean;
    decorations?: boolean;
  } = {}
): WeddingPlan | null {
  const venue = getWeddingVenue(venueId);
  if (!venue) return null;

  const actualGuestCount = Math.min(guestCount, venue.guestCapacity);
  
  return {
    venueId,
    venueName: venue.name,
    venueType: venue.type,
    budget: calculateWeddingCost({ venueId, guestCount: actualGuestCount, ...options }),
    guestCount: actualGuestCount,
    scheduledWeek,
    partnerId,
    catering: options.catering || false,
    photography: options.photography || false,
    music: options.music || false,
    decorations: options.decorations || false,
  };
}

/**
 * Get venue type color for UI
 */
export function getVenueTypeColor(type: WeddingVenue['type']): string {
  switch (type) {
    case 'courthouse':
      return '#6B7280'; // Gray
    case 'church':
      return '#8B5CF6'; // Purple
    case 'beach':
      return '#0EA5E9'; // Sky blue
    case 'garden':
      return '#22C55E'; // Green
    case 'luxury_hotel':
      return '#F59E0B'; // Gold
    case 'destination':
      return '#EC4899'; // Pink
  }
}

/**
 * Get total happiness bonus for a wedding
 */
export function calculateWeddingHappinessBonus(plan: WeddingPlan): number {
  const venue = getWeddingVenue(plan.venueId);
  if (!venue) return 0;

  let bonus = venue.happinessBonus;

  // Add-on bonuses
  if (plan.catering) bonus += 5;
  if (plan.photography) bonus += 3;
  if (plan.music) bonus += 5;
  if (plan.decorations) bonus += 2;

  return bonus;
}

/**
 * Get total reputation bonus for a wedding
 */
export function calculateWeddingReputationBonus(plan: WeddingPlan): number {
  const venue = getWeddingVenue(plan.venueId);
  if (!venue) return 0;

  let bonus = venue.reputationBonus;

  // Guest count affects reputation (more guests = more visibility)
  bonus += Math.floor(plan.guestCount / 20);

  return bonus;
}

