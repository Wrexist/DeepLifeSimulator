import { ImageSourcePropType } from 'react-native';

export type MindsetId = 
  // Personality traits
  | 'frugal' | 'workaholic' | 'socialite' | 'optimist' | 'perfectionist' | 'adventurous'
  // Financial traits
  | 'gambler' | 'riskAverse' | 'investor' | 'spender' | 'hustler';

export type MindsetCategory = 'personality' | 'financial';

export interface MindsetTrait {
  id: MindsetId;
  name: string;
  description: string;
  category: MindsetCategory;
  icon: ImageSourcePropType;
}

// Every `description` below states exactly what the Mindset does, number for
// number, as applied by `MINDSET_STREET_EFFECTS` (./streetWork.ts) - street
// jobs are the one system that reads a Mindset. Change a number there and the
// copy here together; mindsetEffects.test.ts checks they agree.

// Personality-focused mindsets
export const PERSONALITY_TRAITS: MindsetTrait[] = [
  {
    id: 'frugal',
    name: 'Frugal',
    description: 'Street jobs pay 10% more - you make every job count.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Frugal_final.webp'),
  },
  {
    id: 'workaholic',
    name: 'Workaholic',
    description: 'Street jobs pay 20% more, but each one costs 1 extra health and 1 extra happiness.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Workaholic_final.webp'),
  },
  {
    id: 'socialite',
    name: 'Socialite',
    description: "People tip you: legal street jobs pay 10% more. But you're memorable: illegal ones carry +5% arrest risk.",
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Socialite_final.webp'),
  },
  {
    id: 'optimist',
    name: 'Optimist',
    description: 'Street jobs cost half the happiness (rounded in your favour), but you overlook risks: they succeed 5% less often.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Optimist_final.webp'),
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Careful work: street jobs succeed 10% more often, but each one costs 1 extra health from stress.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Perfectionist_final.webp'),
  },
  {
    id: 'adventurous',
    name: 'Adventurous',
    description: 'You live for the thrill: illegal street jobs pay 15% more, but legal ones bore you and cost 1 extra happiness.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Adventurous_final.webp'),
  },
];

// Financial-focused mindsets
export const FINANCIAL_TRAITS: MindsetTrait[] = [
  {
    id: 'gambler',
    name: 'Gambler',
    description: 'Higher risk, higher reward: illegal street jobs pay 25% more, but carry +5% arrest risk.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Gambler_final.webp'),
  },
  {
    id: 'riskAverse',
    name: 'Risk Averse',
    description: 'Illegal street jobs carry 25% less arrest risk, but every street job pays 5% less.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Risk Averse_final.webp'),
  },
  {
    id: 'investor',
    name: 'Investor',
    description: 'Street jobs rank up after 2 successful runs instead of 3, but pay 5% less while you build up.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Investor_final.webp'),
  },
  {
    id: 'spender',
    name: 'Big Spender',
    description: 'Payday feels great: street jobs cost 2 less happiness. But you spend as you go: they pay 10% less.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Big Spender_final.webp'),
  },
  {
    id: 'hustler',
    name: 'Hustler',
    description: 'Side income is your thing: street jobs pay 15% more, but each one costs 1 extra happiness.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Hustler_final.webp'),
  },
];

// All traits combined (for backwards compatibility)
export const MINDSET_TRAITS: MindsetTrait[] = [...PERSONALITY_TRAITS, ...FINANCIAL_TRAITS];

// The deprecated `applyMindsetEffects` engine (the OLD rules, five dead
// branches and an unseeded Gambler roll) is deleted. The rules the game
// applies - and that each `description` above quotes - are
// `MINDSET_STREET_EFFECTS` in `./streetWork.ts`, applied inside
// `performStreetJob`'s updater.


