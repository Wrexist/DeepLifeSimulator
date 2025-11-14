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

const perkList: Perk[] = [
  {
    id: 'astute_planner',
    title: 'Astute Planner',
    description: '+5% salary, -10% energy cost for work actions.',
    requirement: 'Reach the top level in any career.',
    effects: { incomeMultiplier: 1.05, statBoosts: { energy: 10 } },
    unlock: { type: 'achievement', achievementId: 'career_goals' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Astute Planner.png'),
  },
  {
    id: 'legacy_builder',
    title: 'Legacy Builder',
    description: 'Start new lives with +$3,000 and +3 reputation.',
    requirement: 'Accumulate $10,000,000 and have a child.',
    effects: { statBoosts: { money: 3000, reputation: 3 }, incomeMultiplier: 1.0 },
    unlock: { type: 'achievement', achievementId: 'generational_wealth' },
    rarity: 'Legendary',
    icon: require('@/assets/images/Perks/Legacy Builder.png'),
  },
  {
    id: 'iron_will',
    title: 'Iron Will',
    description:
      'Feel unstoppable from day one with +20 health and +5 energy.',
    requirement: 'Reach 100 fitness.',
    effects: { statBoosts: { health: 20, energy: 5 } },
    unlock: { type: 'achievement', achievementId: 'athlete' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Iron Will.png'),
  },
  {
    id: 'social_butterfly',
    title: 'Social Butterfly',
    description:
      'Gain +10 reputation and +5% salary.',
    requirement: 'Have 5 relationships.',
    effects: { statBoosts: { reputation: 10 }, incomeMultiplier: 1.05 },
    unlock: { type: 'achievement', achievementId: 'popular' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Social Butterfly.png'),
  },
  {
    id: 'fast_learner',
    title: 'Fast Learner',
    description:
      'Start with +10 energy and +10 fitness.',
    requirement: 'Finish university.',
    effects: { statBoosts: { energy: 10, fitness: 10 } },
    unlock: { type: 'achievement', achievementId: 'college_grad' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Fast Learner.png'),
  },
  {
    id: 'financial_guru',
    title: 'Financial Guru',
    description: '+7% salary from all jobs.',
    requirement: 'Earn $1,000,000.',
    effects: { incomeMultiplier: 1.07, statBoosts: {} },
    unlock: { type: 'achievement', achievementId: 'millionaire' },
    rarity: 'Legendary',
    icon: require('@/assets/images/Perks/Financial Guru.png'),
  },
  {
    id: 'lucky_charm',
    title: 'Lucky Charm',
    description:
      'Carry a lucky charm for +5% salary and +5 happiness.',
    requirement: 'Save $10,000.',
    effects: { incomeMultiplier: 1.05, statBoosts: { happiness: 5 } },
    unlock: { type: 'achievement', achievementId: 'ten_thousand' },
    rarity: 'Uncommon',
    icon: require('@/assets/images/Perks/Lucky Charm.png'),
  },
  {
    id: 'longevity',
    title: 'Longevity',
    description:
      'Kick off life with +20 health to fuel wild adventures.',
    requirement: 'Live to age 100.',
    effects: { statBoosts: { health: 20 } },
    unlock: { type: 'achievement', achievementId: 'centenarian' },
    rarity: 'Legendary',
    icon: require('@/assets/images/Perks/Longevity.png'),
  },
  {
    id: 'optimist',
    title: 'Optimist',
    description: 'Begin each life with +15 happiness and an infectious grin.',
    requirement: 'Maintain happiness at 80 or higher for four weeks.',
    effects: { statBoosts: { happiness: 15 } },
    unlock: { type: 'achievement', achievementId: 'happy_life' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Optimist.png'),
  },
  {
    id: 'trust_fund',
    title: 'Trust Fund',
    description: 'Start with +$15,000 and +3 reputation.',
    requirement: 'Accumulate $100,000 in net worth.',
    effects: { statBoosts: { money: 15000, reputation: 3 } },
    unlock: { type: 'achievement', achievementId: 'wealth_collector' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Trust Fund.png'),
  },
  {
    id: 'family_first',
    title: 'Family First',
    description: 'Gain +10 reputation with family.',
    requirement: 'Keep a relationship of 80 or higher with each parent.',
    effects: { statBoosts: { reputation: 10 } },
    unlock: { type: 'achievement', achievementId: 'filial_piety' },
    rarity: 'Uncommon',
    icon: require('@/assets/images/Perks/Family First.png'),
  },
  {
    id: 'crime_boss',
    title: 'Crime Boss',
    description: '+10% earnings from street jobs.',
    requirement: 'Complete 50 street jobs.',
    effects: { incomeMultiplier: 1.1, statBoosts: {} },
    unlock: { type: 'achievement', achievementId: 'life_of_crime' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Crime Boss.png'),
  },
  {
    id: 'escape_master',
    title: 'Escape Master',
    description: '+5 reputation for your daring breakout.',
    requirement: 'Successfully escape from jail.',
    effects: { statBoosts: { reputation: 5 } },
    unlock: { type: 'achievement', achievementId: 'escape_artist' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Crime Boss.png'),
  },
  {
    id: 'legacy_guardian',
    title: 'Legacy Guardian',
    description: '+10 reputation and +10 happiness.',
    requirement: 'Have at least three children.',
    effects: { statBoosts: { reputation: 10, happiness: 10 } },
    unlock: { type: 'achievement', achievementId: 'epic_lineage' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Legacy Guardian.png'),
  },
  {
    id: 'innovator',
    title: 'Innovator',
    description: 'Start with +$2,000 and +5% salary.',
    requirement: 'Launch a technology company.',
    effects: { incomeMultiplier: 1.05, statBoosts: { money: 2000 } },
    unlock: { type: 'achievement', achievementId: 'tech_innovator' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Innovator.png'),
  },
  {
    id: 'landlord',
    title: 'Landlord',
    description: '+7% passive income from properties.',
    requirement: 'Own 10 properties.',
    effects: { incomeMultiplier: 1.07, statBoosts: {} },
    unlock: { type: 'achievement', achievementId: 'real_estate_tycoon' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Landlord.png'),
  },
  {
    id: 'blockchain_believer',
    title: 'Blockchain Believer',
    description: 'Start with +$3,000 and +2% salary.',
    requirement: 'Hold $100,000 worth of cryptocurrency.',
    effects: { incomeMultiplier: 1.02, statBoosts: { money: 3000 } },
    unlock: { type: 'achievement', achievementId: 'crypto_magnate' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Blockchain Believer.png'),
  },
  {
    id: 'collector_spirit',
    title: 'Collector Spirit',
    description: '+5 happiness and +5 reputation.',
    requirement: 'Own 50 unique items.',
    effects: { statBoosts: { happiness: 5, reputation: 5 } },
    unlock: { type: 'achievement', achievementId: 'collector_supreme' },
    rarity: 'Uncommon',
    icon: require('@/assets/images/Perks/Collector Spirit.png'),
  },
  {
    id: 'star_quality',
    title: 'Star Quality',
    description: 'Begin with +12 reputation.',
    requirement: 'Reach the highest level in the celebrity career.',
    effects: { statBoosts: { reputation: 12 } },
    unlock: { type: 'achievement', achievementId: 'media_mogul' },
    rarity: 'Epic',
    icon: require('@/assets/images/Perks/Star Quality.png'),
  },
  {
    id: 'inner_peace',
    title: 'Inner Peace',
    description: 'Stay zen from birth with +20 happiness and +5 health.',
    requirement: 'Complete 20 meditation sessions.',
    effects: { statBoosts: { happiness: 20, health: 5 } },
    unlock: { type: 'achievement', achievementId: 'spiritual_guru' },
    rarity: 'Rare',
    icon: require('@/assets/images/Perks/Inner Peace.png'),
  },
];

export const perks = perkList.sort((a, b) => {
  const aUnlock = a.unlock ? 1 : 0;
  const bUnlock = b.unlock ? 1 : 0;
  if (aUnlock !== bUnlock) return bUnlock - aUnlock;
  return a.title.localeCompare(b.title);
});
