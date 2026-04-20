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
    id: 'trust_fund_baby',
    title: 'Trust Fund Baby',
    difficulty: 'Easy',
    lifeGoal: 'Keep the Fortune',
    description: 'Born into wealth with $50,000 in the bank. But easy come, easy go...',
    bonus: 'Start rich with $50,000 and a college education. Can you grow it or will you blow it?',
    start: { age: 21, cash: 50000, education: 'College', items: ['smartphone', 'computer'] },
    icon: require('@/assets/images/Scenarios/Trust Fund Baby_final.png'),
  },
  {
    id: 'immigrant_story',
    title: 'Immigrant Story',
    difficulty: 'Hard',
    lifeGoal: 'The American Dream',
    description: 'New country, no connections, barely any money. Build a life from scratch.',
    bonus: 'Start at age 25 with $200 and no education recognized. Pure determination.',
    start: { age: 25, cash: 200, traits: ['determined'] },
    icon: require('@/assets/images/Scenarios/Immigrant Story_final.png'),
  },
  {
    id: 'second_chance',
    title: 'Second Chance',
    difficulty: 'Hard',
    lifeGoal: 'Redemption',
    description: 'Fresh out of prison with a criminal record. Can you turn your life around?',
    bonus: 'Start at 30 with $150, a criminal record, and something to prove.',
    start: { age: 30, cash: 150, traits: ['tough', 'criminal_record'] },
    icon: require('@/assets/images/Scenarios/Second Chance_final.png'),
  },
  {
    id: 'single_parent_life',
    title: 'Single Parent',
    difficulty: 'Hard',
    lifeGoal: 'Provide & Protect',
    description: 'Raising a child on your own. Every dollar counts, every choice matters.',
    bonus: 'Start at 28 with $1,200 and a child to raise. Balance work and family.',
    start: { age: 28, cash: 1200, items: ['smartphone'], traits: ['caring'] },
    icon: require('@/assets/images/Scenarios/Single Parent_final.png'),
  },
  {
    id: 'tech_prodigy',
    title: 'Tech Prodigy',
    difficulty: 'Moderate',
    lifeGoal: 'Tech Empire',
    description: 'Coding since age 12. You have the skills, now build something big.',
    bonus: 'Start at 19 with $3,000, a computer, and natural tech talent.',
    start: { age: 19, cash: 3000, items: ['computer', 'smartphone'], traits: ['smart'] },
    icon: require('@/assets/images/Scenarios/Aspiring Entrepreneur.png'),
  },
  {
    id: 'medical_student',
    title: 'Medical Student',
    difficulty: 'Hard',
    lifeGoal: 'Save Lives',
    description: 'Years of study ahead, mountains of debt, but the reward is saving lives.',
    bonus: 'Start at 22 with $800, college education, and a long road to MD.',
    start: { age: 22, cash: 800, education: 'College', items: ['smartphone'] },
    icon: require('@/assets/images/Scenarios/Corporate Intern.png'),
  },
  {
    id: 'military_recruit',
    title: 'Military Recruit',
    difficulty: 'Moderate',
    lifeGoal: 'Serve & Lead',
    description: 'Enlisting in the armed forces. Discipline, duty, and a steady paycheck.',
    bonus: 'Start at 18 with $400 and the disciplined trait. Uncle Sam provides the rest.',
    start: { age: 18, cash: 400, traits: ['disciplined', 'fit'] },
    icon: require('@/assets/images/Scenarios/Fitness Enthusiast.png'),
  },
  {
    id: 'real_estate_hustler',
    title: 'Real Estate Hustler',
    difficulty: 'Moderate',
    lifeGoal: 'Property Mogul',
    description: 'Buy low, sell high. Flip houses and build a real estate empire.',
    bonus: 'Start at 25 with $5,000, a smartphone, and a driver license.',
    start: { age: 25, cash: 5000, items: ['smartphone', 'driver_license'] },
    icon: require('@/assets/images/Scenarios/Aspiring Entrepreneur.png'),
  },
];
