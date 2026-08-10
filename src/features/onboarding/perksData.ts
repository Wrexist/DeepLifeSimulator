import { ImageSourcePropType } from 'react-native';

export interface Perk {
  id: string;
  title: string;
  description: string;
  requirement: string;
  effects: { incomeMultiplier?: number; statBoosts?: { [key: string]: number } };
  unlock?: { type: 'achievement'; achievementId: string };
  rarity: string;
  icon: ImageSourcePropType;
}

/**
 * Every `unlock.achievementId` below MUST be a live id from
 * `./achievementsData` — that is the catalogue `getSatisfiedAchievementIds`
 * evaluates, and the only one the perk gate can ever see.
 *
 * All 20 originally named ids from a catalogue that does not exist
 * (`career_goals`, `millionaire`, `ten_thousand`, `spiritual_guru`, …), so no
 * perk could unlock however the player played. `requirement` is the copy shown
 * on the card, so it is kept in step with the achievement's own description —
 * a requirement line that promises a different bar than the gate enforces is
 * the same bug wearing a different hat.
 *
 * `__tests__/onboarding/perksCatalogueIntegrity.test.ts` fails the build on an
 * id that does not resolve.
 */
const perkList: Perk[] = [
  {
    id: 'astute_planner',
    title: 'Astute Planner',
    description: '+5% salary, -10% energy cost for work actions.',
    requirement: 'Reach the top rung of a six-level career ladder.',
    effects: { incomeMultiplier: 1.05, statBoosts: { energy: 10 } },
    unlock: { type: 'achievement', achievementId: 'career_summit' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Astute Planner.webp'),
  },
  {
    id: 'legacy_builder',
    title: 'Legacy Builder',
    description: 'Start new lives with +$5,000 and +5 reputation.',
    requirement: 'Complete prestige through 3 generations.',
    effects: { statBoosts: { money: 5000, reputation: 5 }, incomeMultiplier: 1.0 },
    unlock: { type: 'achievement', achievementId: 'prestige_generations' },
    rarity: 'Legendary',
    icon: require('@/assets/images/Perks/Legacy Builder.webp'),
  },
  {
    id: 'iron_will',
    title: 'Iron Will',
    description:
      'Feel unstoppable from day one with +20 health and +5 energy.',
    requirement: 'Reach 100 fitness.',
    effects: { statBoosts: { health: 20, energy: 5 } },
    unlock: { type: 'achievement', achievementId: 'fitness_deity' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Iron Will.webp'),
  },
  {
    id: 'social_butterfly',
    title: 'Social Butterfly',
    description:
      'Gain +10 reputation and +5% salary.',
    requirement: 'Have 10 friends.',
    effects: { statBoosts: { reputation: 10 }, incomeMultiplier: 1.05 },
    unlock: { type: 'achievement', achievementId: 'social_butterfly' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Social Butterfly.webp'),
  },
  {
    id: 'fast_learner',
    title: 'Fast Learner',
    description:
      'Start with +10 energy and +10 fitness.',
    requirement: 'Complete 5 educations.',
    effects: { statBoosts: { energy: 10, fitness: 10 } },
    unlock: { type: 'achievement', achievementId: 'scholar' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Fast Learner.webp'),
  },
  {
    id: 'financial_guru',
    title: 'Financial Guru',
    description: '+7% salary from all jobs.',
    requirement: 'Accumulate $1,000,000 in cash.',
    effects: { incomeMultiplier: 1.07, statBoosts: {} },
    unlock: { type: 'achievement', achievementId: 'wealth_1m' },
    rarity: 'Legendary',
    icon: require('@/assets/images/Perks/Financial Guru.webp'),
  },
  {
    id: 'lucky_charm',
    title: 'Lucky Charm',
    description:
      'Carry a lucky charm for +5% salary and +5 happiness.',
    requirement: 'Have $5,000 in cash.',
    effects: { incomeMultiplier: 1.05, statBoosts: { happiness: 5 } },
    unlock: { type: 'achievement', achievementId: 'beginner_five_k' },
    rarity: 'Uncommon',
    icon: require('@/assets/images/Perks/Lucky Charm.webp'),
  },
  {
    id: 'longevity',
    title: 'Longevity',
    description:
      'Kick off life with +20 health to fuel wild adventures.',
    requirement: 'Live to age 100.',
    effects: { statBoosts: { health: 20 } },
    unlock: { type: 'achievement', achievementId: 'longevity_100' },
    rarity: 'Legendary',
    icon: require('@/assets/images/Perks/Longevity.webp'),
  },
  {
    id: 'optimist',
    title: 'Optimist',
    description: 'Begin each life with +15 happiness and an infectious grin.',
    requirement: 'Maintain an average happiness of 80 throughout your life.',
    effects: { statBoosts: { happiness: 15 } },
    unlock: { type: 'achievement', achievementId: 'joyful_life' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Optimist.webp'),
  },
  {
    id: 'trust_fund',
    title: 'Trust Fund',
    description: 'Start with +$15,000 and +3 reputation.',
    requirement: 'Have $1,000,000 in bank savings.',
    effects: { statBoosts: { money: 15000, reputation: 3 } },
    unlock: { type: 'achievement', achievementId: 'savings_million' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Trust Fund.webp'),
  },
  {
    id: 'family_first',
    title: 'Family First',
    description: 'Gain +10 reputation with family.',
    requirement: 'Get married.',
    effects: { statBoosts: { reputation: 10 } },
    unlock: { type: 'achievement', achievementId: 'get_married' },
    rarity: 'Uncommon',
    icon: require('@/assets/images/Perks/Family First.webp'),
  },
  {
    id: 'crime_boss',
    title: 'Crime Boss',
    description: '+10% earnings from street jobs.',
    requirement: 'Complete 100 street jobs.',
    effects: { incomeMultiplier: 1.1, statBoosts: {} },
    unlock: { type: 'achievement', achievementId: 'street_grinder' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Crime Boss.webp'),
  },
  {
    id: 'escape_master',
    title: 'Escape Master',
    description: '+5 reputation for your daring breakout.',
    requirement: 'Successfully escape from jail.',
    effects: { statBoosts: { reputation: 5 } },
    unlock: { type: 'achievement', achievementId: 'escape_artist' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Crime Boss.webp'),
  },
  {
    id: 'legacy_guardian',
    title: 'Legacy Guardian',
    description: '+10 reputation and +10 happiness.',
    requirement: 'Have 3 children.',
    effects: { statBoosts: { reputation: 10, happiness: 10 } },
    unlock: { type: 'achievement', achievementId: 'family_builder' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Legacy Guardian.webp'),
  },
  {
    id: 'innovator',
    title: 'Innovator',
    description: 'Start with +$2,000 and +5% salary.',
    requirement: 'Own a company.',
    effects: { incomeMultiplier: 1.05, statBoosts: { money: 2000 } },
    unlock: { type: 'achievement', achievementId: 'company_owner' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Innovator.webp'),
  },
  {
    id: 'landlord',
    title: 'Landlord',
    description: '+7% passive income from properties.',
    requirement: 'Own 10 properties.',
    effects: { incomeMultiplier: 1.07, statBoosts: {} },
    unlock: { type: 'achievement', achievementId: 'real_estate_tycoon' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Landlord.webp'),
  },
  {
    id: 'blockchain_believer',
    title: 'Blockchain Believer',
    description: 'Start with +$3,000 and +2% salary.',
    requirement: 'Own $1,000,000 worth of cryptocurrency.',
    effects: { incomeMultiplier: 1.02, statBoosts: { money: 3000 } },
    unlock: { type: 'achievement', achievementId: 'crypto_trader' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Blockchain Believer.webp'),
  },
  {
    id: 'collector_spirit',
    title: 'Collector Spirit',
    description: '+5 happiness and +5 reputation.',
    requirement: 'Own 50 unique items.',
    effects: { statBoosts: { happiness: 5, reputation: 5 } },
    unlock: { type: 'achievement', achievementId: 'collector_supreme' },
    rarity: 'Uncommon',
    icon: require('@/assets/images/Perks/Collector Spirit.webp'),
  },
  {
    id: 'star_quality',
    title: 'Star Quality',
    description: 'Begin with +12 reputation.',
    requirement: 'Reach the highest level in the celebrity career.',
    effects: { statBoosts: { reputation: 12 } },
    unlock: { type: 'achievement', achievementId: 'celebrity_icon' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Star Quality.webp'),
  },
  {
    id: 'inner_peace',
    title: 'Inner Peace',
    description: 'Stay zen from birth with +20 happiness and +5 health.',
    requirement: 'Have health, fitness, and happiness all above 90.',
    effects: { statBoosts: { happiness: 20, health: 5 } },
    unlock: { type: 'achievement', achievementId: 'health_peak_condition' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Inner Peace.webp'),
  },
];

export const perks = perkList.sort((a, b) => {
  const aUnlock = a.unlock ? 1 : 0;
  const bUnlock = b.unlock ? 1 : 0;
  if (aUnlock !== bUnlock) return bUnlock - aUnlock;
  return a.title.localeCompare(b.title);
});
