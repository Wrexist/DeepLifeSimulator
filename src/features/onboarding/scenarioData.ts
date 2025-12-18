import { ImageSourcePropType } from 'react-native';

export interface Scenario {
  id: string;
  title: string;
  difficulty: string;
  lifeGoal: string;
  description: string;
  bonus: string;
  start: {
    age: number;
    cash: number;
    education?: string;
    items?: string[];
    traits?: string[];
  };
  icon: ImageSourcePropType;
}

export const scenarios: Scenario[] = [
  {
    id: 'highschool_dropout',
    title: 'Highschool Dropout',
    difficulty: 'Easy',
    lifeGoal: 'Wealth Collector',
    description: 'Young and broke, with no education. Can you turn life around?',
    bonus: 'Start at age 18 with $500 and no diploma.',
    start: { age: 18, cash: 500, education: 'Dropout' },
    icon: require('@/assets/images/Scenarios/Highschool Dropout.png'),
  },
  {
    id: 'food_courier',
    title: 'Food Courier',
    difficulty: 'Easy',
    lifeGoal: 'Any',
    description: 'Deliver food on your bike with a phone. Honest grind to start out.',
    bonus: 'Start with $1,500, a smartphone, and a bike for deliveries.',
    start: { age: 20, cash: 1500, items: ['smartphone', 'bike'] },
    icon: require('@/assets/images/Scenarios/Uber Driver.png'),
  },
  {
    id: 'corporate_intern',
    title: 'Corporate Intern',
    difficulty: 'Moderate',
    lifeGoal: 'Career Climber',
    description: 'Starting at the bottom of the corporate ladder. Can you climb to CEO?',
    bonus: 'Start with a suit and college education.',
    start: { age: 21, cash: 500, education: 'College', items: ['suit'] },
    icon: require('@/assets/images/Scenarios/Corporate Intern.png'),
  },
  {
    id: 'fitness_enthusiast',
    title: 'Fitness Enthusiast',
    difficulty: 'Easy',
    lifeGoal: 'Peak Fitness',
    description: 'You live for the gym. Will it pay off as a career or lifestyle?',
    bonus: 'Start fit with a gym membership and $700.',
    start: { age: 19, cash: 700, items: ['gym_membership'], traits: ['fit'] },
    icon: require('@/assets/images/Scenarios/Fitness Enthusiast.png'),
  },
  {
    id: 'aspiring_entrepreneur',
    title: 'Aspiring Entrepreneur',
    difficulty: 'Moderate',
    lifeGoal: 'Business Magnet',
    description: 'Armed with savings and a dream, can you build a business empire?',
    bonus: 'Start with $2,000, a computer, and a smartphone.',
    start: { age: 22, cash: 2000, items: ['computer', 'smartphone'] },
    icon: require('@/assets/images/Scenarios/Aspiring Entrepreneur.png'),
  },
  {
    id: 'street_hustler',
    title: 'Street Hustler',
    difficulty: 'Moderate',
    lifeGoal: 'Life of Crime',
    description: 'Tough life on the streets. Will you build wealth or end up in jail?',
    bonus: 'Start with $300 and the tough trait.',
    start: { age: 18, cash: 300, traits: ['tough'] },
    icon: require('@/assets/images/Scenarios/Street Hustler.png'),
  },
  {
    id: 'influencer_wannabe',
    title: 'Aspiring Streamer',
    difficulty: 'Easy',
    lifeGoal: 'Fame & Followers',
    description: 'You want to go live. Can you build an audience streaming and uploading?',
    bonus: 'Start with $1,000, a smartphone, and a computer for editing/streaming.',
    start: { age: 20, cash: 1000, items: ['smartphone', 'computer'] },
    icon: require('@/assets/images/Scenarios/Aspiring Streamer.png'),
  },
  {
    id: 'single_parent',
    title: 'Single Parent',
    difficulty: 'Hard',
    lifeGoal: 'Family Focused',
    description: 'You\'re raising a child alone. Balance work, life, and parenting to provide the best future.',
    bonus: 'Start with no children, a smartphone to manage contacts, and $1,200. You\'ll need to build relationships and support.',
    start: { age: 28, cash: 1200, items: ['smartphone'], traits: ['resilient'] },
    icon: require('@/assets/images/Scenarios/Single Parent_final.png'),
  },
];
