import { GameStats } from '@/contexts/game/types';

export type TraitType = 'physical' | 'mental' | 'social' | 'economic' | 'special';
export type TraitPolarity = 'positive' | 'negative' | 'neutral';

export interface GeneticTrait {
  id: string;
  name: string;
  description: string;
  type: TraitType;
  polarity: TraitPolarity;
  probability: number; // 0-1, chance to manifest if inherited
  dominance: number; // 0-1, higher dominance wins in conflict (0.5 = standard)
  effects: {
    statModifiers?: Partial<Record<keyof GameStats, number>>; // Multipliers: 1.1 = +10%
    skillLearningRates?: Record<string, number>; // Multipliers
    relationshipBonus?: number; // Multiplier
    careerIncome?: number; // Multiplier
    specialEffect?: string;
  };
  exclusivityGroup?: string; // Traits in same group replace each other
}

export const GENETIC_TRAITS: GeneticTrait[] = [
  // PHYSICAL TRAITS
  {
    id: 'strong_constitution',
    name: 'Strong Constitution',
    description: 'Naturally robust health and resistance to illness.',
    type: 'physical',
    polarity: 'positive',
    probability: 0.3,
    dominance: 0.6,
    effects: {
      statModifiers: { health: 1.2, energy: 1.1 },
    },
    exclusivityGroup: 'constitution',
  },
  {
    id: 'weak_immune_system',
    name: 'Weak Immune System',
    description: 'Prone to sickness and fatigue.',
    type: 'physical',
    polarity: 'negative',
    probability: 0.2,
    dominance: 0.4,
    effects: {
      statModifiers: { health: 0.8, energy: 0.9 },
    },
    exclusivityGroup: 'constitution',
  },
  {
    id: 'athletic_genes',
    name: 'Athletic Genes',
    description: 'Natural aptitude for physical activities.',
    type: 'physical',
    polarity: 'positive',
    probability: 0.25,
    dominance: 0.5,
    effects: {
      statModifiers: { fitness: 1.3 },
      skillLearningRates: { sports: 1.5 },
    },
  },
  
  // MENTAL TRAITS
  {
    id: 'quick_learner',
    name: 'Quick Learner',
    description: 'Absorbs new information rapidly.',
    type: 'mental',
    polarity: 'positive',
    probability: 0.2,
    dominance: 0.5,
    effects: {
      skillLearningRates: { all: 1.2 },
    },
    exclusivityGroup: 'learning',
  },
  {
    id: 'slow_learner',
    name: 'Slow Learner',
    description: 'Struggles to pick up new skills.',
    type: 'mental',
    polarity: 'negative',
    probability: 0.15,
    dominance: 0.4,
    effects: {
      skillLearningRates: { all: 0.8 },
    },
    exclusivityGroup: 'learning',
  },
  {
    id: 'creative_spark',
    name: 'Creative Spark',
    description: 'Natural talent for artistic endeavors.',
    type: 'mental',
    polarity: 'positive',
    probability: 0.2,
    dominance: 0.5,
    effects: {
      skillLearningRates: { music: 1.3, writing: 1.3, painting: 1.3 },
      statModifiers: { happiness: 1.1 },
    },
  },
  
  // SOCIAL TRAITS
  {
    id: 'natural_charisma',
    name: 'Natural Charisma',
    description: 'People are naturally drawn to you.',
    type: 'social',
    polarity: 'positive',
    probability: 0.2,
    dominance: 0.6,
    effects: {
      relationshipBonus: 1.2,
      statModifiers: { reputation: 1.2 },
    },
    exclusivityGroup: 'social',
  },
  {
    id: 'introverted',
    name: 'Introverted',
    description: 'Social interaction drains energy faster, but solitary activities are rewarding.',
    type: 'social',
    polarity: 'neutral',
    probability: 0.3,
    dominance: 0.5,
    effects: {
      relationshipBonus: 0.9,
      statModifiers: { energy: 0.9 }, // Socializing costs more energy (simulated)
    },
    exclusivityGroup: 'social',
  },
  
  // ECONOMIC TRAITS
  {
    id: 'business_acumen',
    name: 'Business Acumen',
    description: 'Natural instinct for profit and management.',
    type: 'economic',
    polarity: 'positive',
    probability: 0.15,
    dominance: 0.5,
    effects: {
      careerIncome: 1.15,
      skillLearningRates: { business: 1.4 },
    },
  },
  {
    id: 'frugal',
    name: 'Frugal',
    description: 'Naturally good at saving money.',
    type: 'economic',
    polarity: 'positive',
    probability: 0.25,
    dominance: 0.5,
    effects: {
      specialEffect: 'reduced_expenses',
    },
    exclusivityGroup: 'spending',
  },
  {
    id: 'spendthrift',
    name: 'Spendthrift',
    description: 'Money burns a hole in your pocket.',
    type: 'economic',
    polarity: 'negative',
    probability: 0.2,
    dominance: 0.4,
    effects: {
      specialEffect: 'increased_expenses',
    },
    exclusivityGroup: 'spending',
  },
  
  // SPECIAL TRAITS
  {
    id: 'genius',
    name: 'Genius',
    description: 'Exceptional capability across all fields.',
    type: 'special',
    polarity: 'positive',
    probability: 0.01, // Very rare
    dominance: 0.1, // Recessive
    effects: {
      statModifiers: { happiness: 0.9 }, // Burdens of genius
      skillLearningRates: { all: 2.0 },
      careerIncome: 1.5,
    },
  },
  {
    id: 'lucky',
    name: 'Born Lucky',
    description: 'Things just tend to work out for you.',
    type: 'special',
    polarity: 'positive',
    probability: 0.05,
    dominance: 0.3,
    effects: {
      specialEffect: 'event_luck_bonus',
    },
  },
];

export function getTraitById(id: string): GeneticTrait | undefined {
  return GENETIC_TRAITS.find(t => t.id === id);
}

