import { ImageSourcePropType } from 'react-native';
import { describeMindsetEffects, mindsetEffectSentence } from './effects';

export type MindsetId =
  // Personality traits
  | 'frugal' | 'workaholic' | 'socialite' | 'optimist' | 'perfectionist' | 'adventurous'
  // Financial traits
  | 'gambler' | 'riskAverse' | 'investor' | 'spender' | 'hustler';

export type MindsetCategory = 'personality' | 'financial';

export interface MindsetTrait {
  id: MindsetId;
  name: string;
  /** One line of flavour. Promises nothing - the numbers are in `effects`. */
  tagline: string;
  /**
   * Every effect, one line each, upsides first - GENERATED from the table in
   * ./effects.ts, so it is exactly what the game applies.
   */
  effects: string[];
  /** `effects` as one sentence, for places that show a single string. */
  description: string;
  category: MindsetCategory;
  icon: ImageSourcePropType;
}

// A Mindset's numbers live in ONE table, `MINDSET_EFFECTS` (./effects.ts).
// `effects` and `description` are generated from it by `trait()`, so the copy
// cannot promise a number the game does not apply - the eleven hand-written
// descriptions this replaces promised savings, travel, stocks and friendships
// while the only code that read a Mindset was one street-job toast. Only the
// `tagline` is written by hand, and it states no numbers.

type TraitSeed = Omit<MindsetTrait, 'effects' | 'description'>;

function trait(seed: TraitSeed): MindsetTrait {
  return {
    ...seed,
    effects: describeMindsetEffects(seed.id),
    description: mindsetEffectSentence(seed.id),
  };
}

// Personality-focused mindsets
export const PERSONALITY_TRAITS: MindsetTrait[] = [
  trait({
    id: 'frugal',
    name: 'Frugal',
    tagline: 'You make every dollar count, and splurging leaves you cold.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Frugal_final.webp'),
  }),
  trait({
    id: 'workaholic',
    name: 'Workaholic',
    tagline: 'Work comes first, and your body keeps the score.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Workaholic_final.webp'),
  }),
  trait({
    id: 'socialite',
    name: 'Socialite',
    tagline: 'People are your thing, and people are expensive.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Socialite_final.webp'),
  }),
  trait({
    id: 'optimist',
    name: 'Optimist',
    tagline: 'Good weeks lift you higher. Bad odds barely register.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Optimist_final.webp'),
  }),
  trait({
    id: 'perfectionist',
    name: 'Perfectionist',
    tagline: 'You climb fast and carry the stress of it.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Perfectionist_final.webp'),
  }),
  trait({
    id: 'adventurous',
    name: 'Adventurous',
    tagline: 'The world is cheaper for you, and home gets old fast.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Adventurous_final.webp'),
  }),
];

// Financial-focused mindsets
export const FINANCIAL_TRAITS: MindsetTrait[] = [
  trait({
    id: 'gambler',
    name: 'Gambler',
    tagline: 'Higher risk, higher reward.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Gambler_final.webp'),
  }),
  trait({
    id: 'riskAverse',
    name: 'Risk Averse',
    tagline: 'You play it safe, and safe pays a little less.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Risk Averse_final.webp'),
  }),
  trait({
    id: 'investor',
    name: 'Investor',
    tagline: 'Assets pay you more, and they cost more to buy.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Investor_final.webp'),
  }),
  trait({
    id: 'spender',
    name: 'Big Spender',
    tagline: 'Nice things make you happy. They also cost you more.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Big Spender_final.webp'),
  }),
  trait({
    id: 'hustler',
    name: 'Hustler',
    tagline: 'Side income is your thing, and the people you neglect notice.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Hustler_final.webp'),
  }),
];

// All traits combined (for backwards compatibility)
export const MINDSET_TRAITS: MindsetTrait[] = [...PERSONALITY_TRAITS, ...FINANCIAL_TRAITS];
