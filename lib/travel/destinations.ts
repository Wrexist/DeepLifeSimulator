import { TravelDestinationRequirements } from '@/lib/types/requirements';

export interface TravelDestination {
  id: string;
  name: string;
  country: string;
  description: string;
  cost: number;
  duration: number; // weeks
  requirements?: TravelDestinationRequirements;
  benefits: {
    happiness: number;
    health: number;
    energy: number;
    intelligence?: number;
    stress?: number; // reduction
    reputation?: number; // travel broadens the mind
    /**
     * Extra happiness when the player travels with a partner or spouse (v57,
     * ECO-13). Paris is the city of love; until this it was a strictly worse
     * Rome. Applied by `buildTripReturnSummary`.
     */
    partnerHappiness?: number;
  };
  events?: string[]; // IDs of events that can happen
  image?: string; // Asset path or identifier
}

export const DESTINATIONS: TravelDestination[] = [
  {
    id: 'local_resort',
    name: 'Local Resort',
    country: 'Local',
    description: 'A relaxing weekend getaway nearby.',
    cost: 500,
    duration: 1,
    benefits: {
      happiness: 10,
      health: 5,
      energy: 20,
      stress: -10,
    },
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    description: 'The city of lights and love. Perfect for culture and romance.',
    cost: 2500,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 20,
      health: 0,
      energy: 10,
      intelligence: 5,
      stress: -15,
      partnerHappiness: 8,
    },
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    description: 'A vibrant mix of traditional culture and modern technology.',
    cost: 3500,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 25,
      health: 5,
      energy: 5,
      intelligence: 10,
      stress: -15,
    },
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    description: 'Tropical paradise with beaches, temples, and nature.',
    cost: 2000,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 30,
      health: 10,
      energy: 30,
      stress: -30,
    },
  },
  {
    id: 'new_york',
    name: 'New York City',
    country: 'USA',
    description: 'The city that never sleeps. Endless entertainment and business opportunities.',
    cost: 3000,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    // ECO-13 (v57): NYC was beaten on every stat by Paris, London and Rome,
    // all cheaper. Its reason to go is the business one the description
    // promises - the only sub-$5k trip that pays reputation, and the most
    // enriching city on the list after London.
    benefits: {
      happiness: 15,
      health: -5,
      energy: -5,
      intelligence: 10,
      stress: 5, // It's stressful but fun?
      reputation: 8,
    },
  },
  {
    id: 'swiss_alps',
    name: 'Swiss Alps',
    country: 'Switzerland',
    description: 'Skiing, hiking, and fresh mountain air.',
    cost: 4000,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 20,
      health: 20,
      energy: 15,
      stress: -20,
    },
  },
  // === NEW DESTINATIONS ===
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    description: 'Historic landmarks, world-class theatre, and iconic fish & chips.',
    cost: 2800,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    // ECO-13 (v57): +12 intelligence (was 10, below cheaper Rome's reason to
    // go) - London is the trip for the mind.
    benefits: {
      happiness: 15,
      health: 0,
      energy: 5,
      intelligence: 12,
      stress: -10,
    },
    events: ['london_theatre', 'london_museum'],
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'UAE',
    description: 'Luxury shopping, towering skyscrapers, and desert adventures.',
    cost: 5000,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 25,
      health: 0,
      energy: 10,
      stress: -15,
      reputation: 5,
    },
    events: ['dubai_luxury', 'dubai_desert_safari'],
  },
  {
    id: 'rome',
    name: 'Rome',
    country: 'Italy',
    description: 'Ancient ruins, incredible pasta, and la dolce vita.',
    cost: 2200,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 20,
      health: 5,
      energy: 10,
      intelligence: 8,
      stress: -20,
    },
    events: ['rome_colosseum', 'rome_romance'],
  },
  {
    id: 'thailand',
    name: 'Bangkok & Islands',
    country: 'Thailand',
    description: 'Temples, street food, and stunning tropical islands.',
    cost: 1800,
    duration: 2,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 30,
      health: 10,
      energy: 25,
      stress: -25,
    },
    events: ['thailand_temple', 'thailand_full_moon'],
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    description: 'Beaches, wildlife, and the iconic Opera House.',
    cost: 4500,
    duration: 2,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 25,
      health: 15,
      energy: 20,
      stress: -20,
    },
    events: ['sydney_surf', 'sydney_wildlife'],
  },
  {
    id: 'cancun',
    name: 'Cancun',
    country: 'Mexico',
    description: 'All-inclusive resort with turquoise waters and ancient Mayan ruins.',
    cost: 1500,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 25,
      health: 10,
      energy: 30,
      stress: -30,
    },
  },
  {
    id: 'iceland',
    name: 'Iceland',
    country: 'Iceland',
    description: 'Northern lights, hot springs, and dramatic volcanic landscapes.',
    cost: 3500,
    duration: 1,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 20,
      health: 15,
      energy: 10,
      intelligence: 5,
      stress: -25,
    },
    events: ['iceland_northern_lights'],
  },
  {
    id: 'safari',
    name: 'African Safari',
    country: 'Kenya',
    description: 'Witness the Big Five in their natural habitat. A once-in-a-lifetime experience.',
    cost: 6000,
    duration: 2,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 35,
      health: 10,
      energy: 5,
      intelligence: 10,
      stress: -20,
      reputation: 8,
    },
    events: ['safari_lion', 'safari_sunset'],
  },
  {
    id: 'maldives',
    name: 'Maldives',
    country: 'Maldives',
    description: 'Overwater bungalows, crystal clear lagoons, and ultimate luxury.',
    cost: 8000,
    duration: 2,
    requirements: {
      items: ['passport'],
    },
    benefits: {
      happiness: 40,
      health: 15,
      energy: 35,
      stress: -40,
      reputation: 10,
    },
    events: ['maldives_diving', 'maldives_sunset'],
  },
  {
    id: 'camping_trip',
    name: 'Camping Trip',
    country: 'Local',
    description: 'Disconnect from the world. Campfires, hiking, and stargazing.',
    cost: 200,
    duration: 1,
    benefits: {
      happiness: 15,
      health: 10,
      energy: 15,
      stress: -20,
    },
  },
  {
    id: 'road_trip',
    name: 'Road Trip',
    country: 'Local',
    description: 'Hit the highway with snacks and good music. Freedom on wheels.',
    cost: 400,
    duration: 1,
    benefits: {
      happiness: 20,
      health: 5,
      energy: 10,
      stress: -15,
    },
  },
];


