export interface TravelDestination {
  id: string;
  name: string;
  country: string;
  description: string;
  cost: number;
  duration: number; // weeks
  requirements?: {
    money?: number;
    happiness?: number;
    items?: string[]; // e.g. passport
  };
  benefits: {
    happiness: number;
    health: number;
    energy: number;
    intelligence?: number;
    stress?: number; // reduction
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
    benefits: {
      happiness: 15,
      health: -5,
      energy: -10,
      intelligence: 5,
      stress: 5, // It's stressful but fun?
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
];


