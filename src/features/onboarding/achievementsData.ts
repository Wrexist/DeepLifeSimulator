import { ImageSourcePropType } from 'react-native';
import { Company, GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';

const socialIcon = require('@/assets/images/Achivements/Career Titan.png');
const familyIcon = require('@/assets/images/Achivements/Generational Wealth.png');

export interface Achievement {
  id: string;
  title: string;
  description: string;
  progressSpec:
    | { kind: 'boolean'; met: (gs: any) => boolean }
    | { kind: 'counter'; current: (gs: any) => number; goal: number };
  goldReward: number;
  icon?: ImageSourcePropType;
  group?: string;
}

export const achievements: Achievement[] = [
  {
    id: 'wealth_1m',
    title: 'Seven Figures',
    description: 'Accumulate $1,000,000 in cash.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.money ?? 0, goal: 1_000_000 },
    goldReward: 50,
    group: 'wealth',
  },
  {
    id: 'wealth_10m',
    title: 'Eight Figures',
    description: 'Accumulate $10,000,000 in cash.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.money ?? 0, goal: 10_000_000 },
    goldReward: 100,
    group: 'wealth',
  },
  {
    id: 'wealth_100m',
    title: 'Nine Figures',
    description: 'Accumulate $100,000,000 in cash.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.money ?? 0, goal: 100_000_000 },
    goldReward: 200,
    group: 'wealth',
  },
  {
    id: 'wealth_1b',
    title: 'Billionaire',
    description: 'Accumulate $1,000,000,000 in cash.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.money ?? 0, goal: 1_000_000_000 },
    goldReward: 300,
    group: 'wealth',
  },
  {
    id: 'wealth_10b',
    title: 'Deca-Billionaire',
    description: 'Accumulate $10,000,000,000 in cash.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.money ?? 0, goal: 10_000_000_000 },
    goldReward: 500,
    group: 'wealth',
  },
  {
    id: 'wealth_100b',
    title: 'Centibillionaire',
    description: 'Accumulate $100,000,000,000 in cash.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.money ?? 0, goal: 100_000_000_000 },
    goldReward: 1000,
    group: 'wealth',
  },
  {
    id: 'gold_hoarder',
    title: 'Gold Hoarder',
          description: 'Collect 100 gems.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.gems ?? 0, goal: 100 },
    goldReward: 100,
    group: 'gold',
  },
  {
    id: 'gold_collector',
    title: 'Gold Collector',
          description: 'Collect 500 gems.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.gems ?? 0, goal: 500 },
    goldReward: 250,
    group: 'gold',
  },
  {
    id: 'gold_magnate',
    title: 'Gold Magnate',
          description: 'Collect 1,000 gems.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.gems ?? 0, goal: 1_000 },
    goldReward: 500,
    group: 'gold',
  },
  {
    id: 'gold_tycoon',
    title: 'Gold Tycoon',
          description: 'Collect 5,000 gems.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.gems ?? 0, goal: 5_000 },
    goldReward: 1000,
    group: 'gold',
  },
  {
    id: 'gold_empire',
    title: 'Gold Empire',
          description: 'Collect 10,000 gems.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.gems ?? 0, goal: 10_000 },
    goldReward: 2000,
    group: 'gold',
  },
  {
    id: 'longevity_50',
    title: 'Midlife Milestone',
    description: 'Reach age 50.',
    progressSpec: { kind: 'counter', current: gs => gs.date?.age ?? 0, goal: 50 },
    goldReward: 20,
    group: 'longevity',
  },
  {
    id: 'longevity_75',
    title: 'Three Quarters',
    description: 'Reach age 75.',
    progressSpec: { kind: 'counter', current: gs => gs.date?.age ?? 0, goal: 75 },
    goldReward: 40,
    group: 'longevity',
  },
  {
    id: 'longevity_100',
    title: 'Centenarian',
    description: 'Reach age 100.',
    progressSpec: { kind: 'counter', current: gs => gs.date?.age ?? 0, goal: 100 },
    goldReward: 80,
    group: 'longevity',
  },
  {
    id: 'longevity_120',
    title: 'Legendary Life',
    description: 'Reach age 120.',
    progressSpec: { kind: 'counter', current: gs => gs.date?.age ?? 0, goal: 120 },
    goldReward: 120,
    group: 'longevity',
  },
  {
    id: 'longevity_150',
    title: 'Immortal',
    description: 'Reach age 150.',
    progressSpec: { kind: 'counter', current: gs => gs.date?.age ?? 0, goal: 150 },
    goldReward: 200,
    group: 'longevity',
  },
  {
    id: 'company_owner',
    title: 'Entrepreneur',
    description: 'Own 1 company.',
    progressSpec: { kind: 'counter', current: gs => gs.companies?.length ?? 0, goal: 1 },
    goldReward: 25,
    group: 'company',
  },
  {
    id: 'company_mogul',
    title: 'Business Mogul',
    description: 'Own 5 companies.',
    progressSpec: { kind: 'counter', current: gs => gs.companies?.length ?? 0, goal: 5 },
    goldReward: 75,
    group: 'company',
  },
  {
    id: 'company_magnate',
    title: 'Corporate Magnate',
    description: 'Own 10 companies.',
    progressSpec: { kind: 'counter', current: gs => gs.companies?.length ?? 0, goal: 10 },
    goldReward: 150,
    group: 'company',
  },
  {
    id: 'company_emperor',
    title: 'Company Emperor',
    description: 'Own 20 companies.',
    progressSpec: { kind: 'counter', current: gs => gs.companies?.length ?? 0, goal: 20 },
    goldReward: 300,
    group: 'company',
  },
  {
    id: 'workforce_builder',
    title: 'Workforce Builder',
    description: 'Hire 10 workers.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.companies?.reduce((sum: number, c: any) => sum + (c.employees || 0), 0) ?? 0,
      goal: 10,
    },
    goldReward: 25,
    group: 'workforce',
  },
  {
    id: 'workforce_leader',
    title: 'Workforce Leader',
    description: 'Hire 50 workers.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.companies?.reduce((sum: number, c: any) => sum + (c.employees || 0), 0) ?? 0,
      goal: 50,
    },
    goldReward: 100,
    group: 'workforce',
  },
  {
    id: 'workforce_tycoon',
    title: 'Workforce Tycoon',
    description: 'Hire 100 workers.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.companies?.reduce((sum: number, c: any) => sum + (c.employees || 0), 0) ?? 0,
      goal: 100,
    },
    goldReward: 250,
    group: 'workforce',
  },
  {
    id: 'reputation_star',
    title: 'Reputation Star',
    description: 'Reach 100 reputation.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.reputation ?? 0, goal: 100 },
    goldReward: 25,
    group: 'reputation',
  },
  {
    id: 'reputation_icon',
    title: 'Reputation Icon',
    description: 'Reach 500 reputation.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.reputation ?? 0, goal: 500 },
    goldReward: 75,
    group: 'reputation',
  },
  {
    id: 'reputation_legend',
    title: 'Reputation Legend',
    description: 'Reach 1,000 reputation.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.reputation ?? 0, goal: 1_000 },
    goldReward: 150,
    group: 'reputation',
  },
  {
    id: 'reputation_mythic',
    title: 'Reputation Mythic',
    description: 'Reach 5,000 reputation.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.reputation ?? 0, goal: 5_000 },
    goldReward: 300,
    group: 'reputation',
  },
  {
    id: 'fitness_champ',
    title: 'Fitness Champion',
    description: 'Reach 50 fitness.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.fitness ?? 0, goal: 50 },
    goldReward: 25,
    group: 'fitness',
  },
  {
    id: 'fitness_guru',
    title: 'Fitness Guru',
    description: 'Reach 75 fitness.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.fitness ?? 0, goal: 75 },
    goldReward: 50,
    group: 'fitness',
  },
  {
    id: 'fitness_deity',
    title: 'Fitness Deity',
    description: 'Reach 100 fitness.',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.fitness ?? 0, goal: 100 },
    goldReward: 100,
    group: 'fitness',
  },
  {
    id: 'street_grinder',
    title: 'Street Grinder',
    description: 'Complete 100 street jobs.',
    progressSpec: { kind: 'counter', current: gs => gs.streetJobsCompleted ?? 0, goal: 100 },
    goldReward: 25,
    group: 'street',
  },
  {
    id: 'street_legend',
    title: 'Street Legend',
    description: 'Complete 1,000 street jobs.',
    progressSpec: { kind: 'counter', current: gs => gs.streetJobsCompleted ?? 0, goal: 1_000 },
    goldReward: 100,
    group: 'street',
  },
  {
    id: 'street_myth',
    title: 'Street Myth',
    description: 'Complete 5,000 street jobs.',
    progressSpec: { kind: 'counter', current: gs => gs.streetJobsCompleted ?? 0, goal: 5_000 },
    goldReward: 250,
    group: 'street',
  },
  {
    id: 'crypto_trader',
    title: 'Crypto Trader',
    description: 'Own $1,000,000 worth of cryptocurrency.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.cryptos?.reduce((t: number, c: any) => t + c.owned * c.price, 0) ?? 0,
      goal: 1_000_000,
    },
    goldReward: 50,
    group: 'crypto_value',
  },
  {
    id: 'crypto_millionaire',
    title: 'Crypto Millionaire',
    description: 'Own $10,000,000 worth of cryptocurrency.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.cryptos?.reduce((t: number, c: any) => t + c.owned * c.price, 0) ?? 0,
      goal: 10_000_000,
    },
    goldReward: 150,
    group: 'crypto_value',
  },
  {
    id: 'crypto_tycoon',
    title: 'Crypto Tycoon',
    description: 'Own $100,000,000 worth of cryptocurrency.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.cryptos?.reduce((t: number, c: any) => t + c.owned * c.price, 0) ?? 0,
      goal: 100_000_000,
    },
    goldReward: 300,
    group: 'crypto_value',
  },
  {
    id: 'crypto_portfolio',
    title: 'Crypto Portfolio',
    description: 'Own at least 5 different cryptocurrencies.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.cryptos?.filter((c: any) => c.owned > 0).length ?? 0,
      goal: 5,
    },
    goldReward: 100,
    group: 'crypto_portfolio',
  },
  {
    id: 'social_butterfly',
    title: 'Social Butterfly',
    description: 'Have 10 friends.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.relationships?.filter((r: any) => r.type === 'friend').length ?? 0,
      goal: 10,
    },
    goldReward: 25,
    group: 'social',
  },
  {
    id: 'social_celebrity',
    title: 'Social Celebrity',
    description: 'Have 25 friends.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.relationships?.filter((r: any) => r.type === 'friend').length ?? 0,
      goal: 25,
    },
    goldReward: 75,
    icon: socialIcon,
    group: 'social',
  },
  {
    id: 'get_married',
    title: 'Tied the Knot',
    description: 'Get married.',
    progressSpec: { kind: 'boolean', met: gs => !!gs.family?.spouse },
    goldReward: 20,
    group: 'family',
  },
  {
    id: 'first_child',
    title: 'Proud Parent',
    description: 'Have your first child.',
    progressSpec: {
      kind: 'boolean',
      met: gs => (gs.family?.children?.length ?? 0) > 0,
    },
    goldReward: 20,
    icon: familyIcon,
    group: 'family',
  },
  {
    id: 'family_builder',
    title: 'Family Builder',
    description: 'Have 3 children.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.relationships?.filter((r: any) => r.type === 'child').length ?? 0,
      goal: 3,
    },
    goldReward: 50,
    group: 'family',
  },
  {
    id: 'family_empire',
    title: 'Family Empire',
    description: 'Have 10 children.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.relationships?.filter((r: any) => r.type === 'child').length ?? 0,
      goal: 10,
    },
    goldReward: 200,
    icon: familyIcon,
    group: 'family',
  },
  {
    id: 'scholar',
    title: 'Scholar',
    description: 'Complete 5 educations.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.educations?.filter((e: any) => e.completed).length ?? 0,
      goal: 5,
    },
    goldReward: 50,
    group: 'education',
  },
  {
    id: 'academic',
    title: 'Academic',
    description: 'Complete 10 educations.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.educations?.filter((e: any) => e.completed).length ?? 0,
      goal: 10,
    },
    goldReward: 100,
    group: 'education',
  },
  {
    id: 'professor',
    title: 'Professor',
    description: 'Complete 20 educations.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.educations?.filter((e: any) => e.completed).length ?? 0,
      goal: 20,
    },
    goldReward: 200,
    group: 'education',
  },
  {
    id: 'collector_supreme',
    title: 'Collector Supreme',
    description: 'Own 50 items.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.items?.filter((i: any) => i.owned).length ?? 0,
      goal: 50,
    },
    goldReward: 100,
    group: 'collector',
  },
  {
    id: 'collector_legend',
    title: 'Collector Legend',
    description: 'Own 100 items.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.items?.filter((i: any) => i.owned).length ?? 0,
      goal: 100,
    },
    goldReward: 250,
    group: 'collector',
  },
  {
    id: 'real_estate_mogul',
    title: 'Real Estate Mogul',
    description: 'Own 5 properties.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.realEstate?.filter((r: any) => r.owned).length ?? 0,
      goal: 5,
    },
    goldReward: 100,
    group: 'real_estate',
  },
  {
    id: 'real_estate_tycoon',
    title: 'Real Estate Tycoon',
    description: 'Own 10 properties.',
    progressSpec: {
      kind: 'counter',
      current: gs => gs.realEstate?.filter((r: any) => r.owned).length ?? 0,
      goal: 10,
    },
    goldReward: 250,
    group: 'real_estate',
  },
  {
    id: 'savings_million',
    title: 'Savings Millionaire',
    description: 'Have $1,000,000 in bank savings.',
    progressSpec: { kind: 'counter', current: gs => gs.bankSavings ?? 0, goal: 1_000_000 },
    goldReward: 50,
    group: 'savings',
  },
  {
    id: 'savings_billion',
    title: 'Savings Billionaire',
    description: 'Have $1,000,000,000 in bank savings.',
    progressSpec: { kind: 'counter', current: gs => gs.bankSavings ?? 0, goal: 1_000_000_000 },
    goldReward: 500,
    group: 'savings',
  },
  {
    id: 'joyful_life',
    title: 'Joyful Life',
    description: 'Maintain an average happiness of 80 throughout your life.',
    progressSpec: {
      kind: 'counter',
      current: gs => {
        const weeks = gs.weeksLived ?? 0;
        return weeks > 0 ? (gs.totalHappiness ?? 0) / weeks : 0;
      },
      goal: 80,
    },
    goldReward: 50,
    group: 'happiness',
  },
  {
    id: 'fun_crypto',
    title: 'Crypto Curious',
    description: 'Buy any amount of cryptocurrency.',
    progressSpec: { kind: 'boolean', met: gs => gs.cryptos?.some((c: any) => c.owned > 0) },
    goldReward: 5,
    group: 'fun_crypto',
  },
  {
    id: 'fun_all_nighter',
    title: 'All Nighter',
    description: 'Run out of energy completely.',
    progressSpec: { kind: 'boolean', met: gs => (gs.stats?.energy ?? 0) <= 0 },
    goldReward: 5,
    group: 'fun_all_nighter',
  },
  {
    id: 'crime_raid',
    title: 'Raid Survivor',
    description: 'Experience a police raid.',
    progressSpec: {
      kind: 'boolean',
      met: gs => gs.eventLog?.some((e: any) => e.id === 'police_raid'),
    },
    goldReward: 10,
    group: 'crime',
  },
  {
    id: 'crime_trial',
    title: 'Courtroom Drama',
    description: 'Participate in a court trial.',
    progressSpec: {
      kind: 'boolean',
      met: gs => gs.eventLog?.some((e: any) => e.id === 'court_trial'),
    },
    goldReward: 10,
    group: 'crime',
  },
  {
    id: 'escape_artist',
    title: 'Escape Artist',
    description: 'Successfully escape from jail.',
    progressSpec: { kind: 'boolean', met: gs => gs.escapedFromJail },
    goldReward: 50,
    group: 'crime',
  },

  // Prestige Achievements
  {
    id: 'prestige_first',
    title: 'First Prestige',
    description: 'Complete your first prestige reset',
    progressSpec: { kind: 'boolean', met: gs => (gs.prestige?.totalPrestiges ?? 0) >= 1 },
    goldReward: 200,
    group: 'prestige',
  },
  {
    id: 'prestige_veteran',
    title: 'Prestige Veteran',
    description: 'Complete 5 prestige resets',
    progressSpec: { kind: 'counter', current: gs => gs.prestige?.totalPrestiges ?? 0, goal: 5 },
    goldReward: 500,
    group: 'prestige',
  },
  {
    id: 'prestige_legend',
    title: 'Prestige Legend',
    description: 'Reach prestige level 10',
    progressSpec: { kind: 'counter', current: gs => gs.prestige?.prestigeLevel ?? 0, goal: 10 },
    goldReward: 1000,
    group: 'prestige',
  },
  {
    id: 'prestige_generations',
    title: 'Generational Wealth',
    description: 'Complete prestige through 3 generations',
    progressSpec: { kind: 'counter', current: gs => gs.prestige?.lifetimeStats?.generationsCompleted ?? 0, goal: 3 },
    goldReward: 750,
    group: 'prestige',
  },
  {
    id: 'prestige_points_master',
    title: 'Prestige Points Master',
    description: 'Accumulate 10,000 prestige points',
    progressSpec: { kind: 'counter', current: gs => gs.prestige?.prestigePoints ?? 0, goal: 10000 },
    goldReward: 1500,
    group: 'prestige',
  },

  // Social Platform Achievements
  {
    id: 'social_dating_first_match',
    title: 'First Match',
    description: 'Get your first match on the dating app',
    progressSpec: { kind: 'counter', current: gs => gs.datingMatches?.length ?? 0, goal: 1 },
    goldReward: 10,
    group: 'social',
  },
  {
    id: 'social_dating_casanova',
    title: 'Casanova',
    description: 'Get 25 matches on the dating app',
    progressSpec: { kind: 'counter', current: gs => gs.datingMatches?.length ?? 0, goal: 25 },
    goldReward: 75,
    group: 'social',
  },
  {
    id: 'social_media_first_post',
    title: 'First Post',
    description: 'Create your first social media post',
    progressSpec: { kind: 'counter', current: gs => gs.socialMedia?.totalPosts ?? 0, goal: 1 },
    goldReward: 5,
    group: 'social',
  },
  {
    id: 'social_media_influencer',
    title: 'Social Media Influencer',
    description: 'Reach 10,000 followers',
    progressSpec: { kind: 'counter', current: gs => gs.socialMedia?.followers ?? 0, goal: 10000 },
    goldReward: 150,
    group: 'social',
  },
  {
    id: 'social_media_celebrity',
    title: 'Social Media Celebrity',
    description: 'Reach 100,000 followers',
    progressSpec: { kind: 'counter', current: gs => gs.socialMedia?.followers ?? 0, goal: 100000 },
    goldReward: 300,
    group: 'social',
  },
  {
    id: 'social_media_viral',
    title: 'Viral Sensation',
    description: 'Create 5 viral posts',
    progressSpec: { kind: 'counter', current: gs => gs.socialMedia?.viralPosts ?? 0, goal: 5 },
    goldReward: 200,
    group: 'social',
  },
  {
    id: 'social_media_brand_deals',
    title: 'Brand Ambassador',
    description: 'Secure 10 brand partnerships',
    progressSpec: { kind: 'counter', current: gs => gs.socialMedia?.brandPartnerships ?? 0, goal: 10 },
    goldReward: 400,
    group: 'social',
  },
  {
    id: 'social_media_posts_milestone',
    title: 'Content Creator',
    description: 'Create 100 social media posts',
    progressSpec: { kind: 'counter', current: gs => gs.socialMedia?.totalPosts ?? 0, goal: 100 },
    goldReward: 100,
    group: 'social',
  },

  // Crime & Prison Achievements
  {
    id: 'crime_skill_master',
    title: 'Crime Master',
    description: 'Max out a crime skill to level 10',
    progressSpec: { kind: 'boolean', met: gs => Object.values(gs.crimeSkills || {}).some((skill: { level: number }) => skill.level >= 10) },
    goldReward: 150,
    group: 'crime',
  },
  {
    id: 'prison_survivor',
    title: 'Prison Survivor',
    description: 'Spend 10 weeks in prison',
    progressSpec: { kind: 'counter', current: gs => gs.totalPrisonWeeks ?? 0, goal: 10 },
    goldReward: 50,
    group: 'crime',
  },
  {
    id: 'prison_reformed',
    title: 'Reformed',
    description: 'Complete all prison activities in a single sentence',
    progressSpec: { kind: 'boolean', met: gs => {
      const weeklyActivities = gs.weeklyJailActivities || {};
      const uniqueActivities = new Set(Object.keys(weeklyActivities));
      return uniqueActivities.size >= 5;
    }},
    goldReward: 100,
    group: 'crime',
  },

  // Company Achievements
  {
    id: 'company_first',
    title: 'Entrepreneur',
    description: 'Start your first company',
    progressSpec: { kind: 'counter', current: gs => gs.companies?.length ?? 0, goal: 1 },
    goldReward: 75,
    group: 'career',
  },
  {
    id: 'company_tycoon',
    title: 'Business Tycoon',
    description: 'Own 5 companies',
    progressSpec: { kind: 'counter', current: gs => gs.companies?.length ?? 0, goal: 5 },
    goldReward: 500,
    group: 'career',
  },
  {
    id: 'company_empire',
    title: 'Business Empire',
    description: 'Have 10 employees across all companies',
    progressSpec: { kind: 'counter', current: gs => gs.companies?.reduce((total: number, c: Company) => total + (c.employees || 0), 0) ?? 0, goal: 10 },
    goldReward: 200,
    group: 'career',
  },

  // Milestone Achievements
  {
    id: 'milestone_100_weeks',
    title: 'Century',
    description: 'Live for 100 weeks',
    progressSpec: { kind: 'counter', current: gs => gs.weeksLived ?? 0, goal: 100 },
    goldReward: 100,
    group: 'milestone',
  },
  {
    id: 'milestone_500_weeks',
    title: 'Half Millennium',
    description: 'Live for 500 weeks',
    progressSpec: { kind: 'counter', current: gs => gs.weeksLived ?? 0, goal: 500 },
    goldReward: 500,
    group: 'milestone',
  },
  // Legacy achievements from lib/progress/achievements.ts - consolidated
  {
    id: 'first_million',
    title: 'First Million',
    description: 'Reach a net worth of $1,000,000.',
    progressSpec: { 
      kind: 'counter', 
      current: (gs: GameState) => {
        // Use netWorth function for accurate calculation
        try {
          return netWorth(gs);
        } catch {
          // Fallback calculation
          const money = gs.stats?.money ?? 0;
          const bank = gs.bankSavings ?? 0;
          return money + bank;
        }
      }, 
      goal: 1_000_000 
    },
    goldReward: 50,
    group: 'networth',
  },
  {
    id: 'debt_free',
    title: 'Debt Free',
    description: 'Have no outstanding debts after being in debt.',
    progressSpec: { 
      kind: 'boolean', 
      met: (gs: GameState) => {
        const hasBeenInDebt = gs.progress?.hasBeenInDebt ?? false;
        const hasLoans = (gs.loans?.length || 0) > 0;
        return hasBeenInDebt && !hasLoans && (gs.stats?.money ?? 0) >= 0;
      }
    },
    goldReward: 25,
    group: 'financial',
  },
  {
    id: 'healthy_lifestyle',
    title: 'Healthy Lifestyle',
    description: 'Maintain 90+ health for 10 consecutive weeks.',
    progressSpec: { 
      kind: 'counter', 
      current: (gs: GameState) => gs.healthWeeks ?? 0, 
      goal: 10 
    },
    goldReward: 30,
    group: 'health',
  },
  {
    id: 'social_star',
    title: 'Social Star',
    description: 'Maintain 10 relationships with affection over 70.',
    progressSpec: { 
      kind: 'counter', 
      current: (gs: GameState) => {
        return (gs.relationships || []).filter((r: any) => r.relationshipScore > 70).length;
      }, 
      goal: 10 
    },
    goldReward: 25,
    group: 'social',
  },
  {
    id: 'first_election',
    title: 'First Victory',
    description: 'Win your first election.',
    progressSpec: { 
      kind: 'boolean', 
      met: (gs: GameState) => {
        return (gs.politics?.electionsWon || 0) >= 1;
      }
    },
    goldReward: 50,
    group: 'politics',
  },
  {
    id: 'mayor',
    title: 'Mayor',
    description: 'Become Mayor.',
    progressSpec: { 
      kind: 'boolean', 
      met: (gs: GameState) => {
        return (gs.politics?.careerLevel || 0) >= 1;
      }
    },
    goldReward: 75,
    group: 'politics',
  },
  {
    id: 'governor',
    title: 'Governor',
    description: 'Become Governor.',
    progressSpec: { 
      kind: 'boolean', 
      met: (gs: GameState) => {
        return (gs.politics?.careerLevel || 0) >= 3;
      }
    },
    goldReward: 150,
    group: 'politics',
  },
  {
    id: 'president',
    title: 'President',
    description: 'Become President.',
    progressSpec: { 
      kind: 'boolean', 
      met: (gs: GameState) => {
        return (gs.politics?.careerLevel || 0) >= 5;
      }
    },
    goldReward: 500,
    group: 'politics',
  },
  {
    id: 'policy_maker',
    title: 'Policy Maker',
    description: 'Enact 10 policies.',
    progressSpec: { 
      kind: 'counter', 
      current: (gs: GameState) => (gs.politics?.policiesEnacted || []).length,
      goal: 10
    },
    goldReward: 100,
    group: 'politics',
  },
  {
    id: 'popular_politician',
    title: 'Popular Politician',
    description: 'Maintain 80%+ approval rating for 52 weeks.',
    progressSpec: { 
      kind: 'counter', 
      current: (gs: GameState) => {
        // This would need to be tracked in game state
        // For now, check if current approval is 80+
        return (gs.politics?.approvalRating || 0) >= 80 ? 1 : 0;
      },
      goal: 1
    },
    goldReward: 150,
    group: 'politics',
  },
  {
    id: 'election_champion',
    title: 'Election Champion',
    description: 'Win 5 elections.',
    progressSpec: { 
      kind: 'counter', 
      current: (gs: GameState) => (gs.politics?.electionsWon || 0),
      goal: 5
    },
    goldReward: 200,
    group: 'politics',
  },
  {
    id: 'political_influencer',
    title: 'Political Influencer',
    description: 'Reach 50% policy influence.',
    progressSpec: { 
      kind: 'boolean', 
      met: (gs: GameState) => {
        return (gs.politics?.policyInfluence || 0) >= 50;
      }
    },
    goldReward: 100,
    group: 'politics',
  },
  {
    id: 'politician_legend',
    title: 'Political Legend',
    description: 'Reach the highest level in the politician career.',
    progressSpec: { 
      kind: 'boolean', 
      met: (gs: GameState) => {
        const career = (gs.careers || []).find((c: any) => c.id === 'political');
        return career && career.level >= 5; // President level
      }
    },
    goldReward: 100,
    group: 'politics',
  },
  {
    id: 'celebrity_icon',
    title: 'Celebrity Icon',
    description: 'Reach the highest level in the celebrity career.',
    progressSpec: { 
      kind: 'boolean', 
      met: (gs: GameState) => {
        const career = (gs.careers || []).find((c: any) => c.id === 'celebrity');
        return career && career.level >= (career.levels?.length || 0);
      }
    },
    goldReward: 100,
    group: 'career',
  },
  {
    id: 'athletic_champion',
    title: 'Athletic Champion',
    description: 'Reach the highest level in the athlete career.',
    progressSpec: { 
      kind: 'boolean', 
      met: (gs: GameState) => {
        const career = (gs.careers || []).find((c: any) => c.id === 'athlete');
        return career && career.level >= (career.levels?.length || 0);
      }
    },
    goldReward: 100,
    group: 'career',
  },
];
