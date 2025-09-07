import { TutorialStep } from '@/types/tutorial';

export const GAME_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to DeepLife Simulator!',
    description: 'Welcome to your new life! This comprehensive tutorial will guide you through every aspect of the game. You\'ll learn how to manage your character, make life-changing decisions, and build your virtual destiny.',
    position: 'center',
  },
  {
    id: 'character-stats',
    title: 'Your Character Stats',
    description: 'These are your character\'s vital statistics. Health, Happiness, Energy, and Fitness affect your daily activities and life expectancy. Money and Reputation determine your success and social standing. Monitor these carefully as they change based on your choices!',
    position: 'top',
  },
  {
    id: 'age-progression',
    title: 'Age & Time Progression',
    description: 'Time passes in weeks, and your age increases over time. Each week you\'ll make decisions that shape your life path. Different life stages unlock new opportunities and challenges. Plan wisely for long-term success!',
    position: 'center',
  },
  {
    id: 'main-activities',
    title: 'Core Life Activities',
    description: 'These are your primary activities that drive your life forward. Work to earn money and advance your career, exercise to stay fit and healthy, socialize to build relationships, and rest to recover energy. Balance is the key to a successful life!',
    position: 'bottom',
  },
  {
    id: 'mobile-phone',
    title: 'Your Digital Life - Mobile Phone',
    description: 'Your phone is your digital lifeline! Access apps for banking, social media, dating, education, and more. Different apps unlock as you progress and can significantly impact your life path. Use it wisely to enhance your opportunities!',
    position: 'left',
  },
  {
    id: 'computer-activities',
    title: 'Advanced Opportunities - Computer',
    description: 'Your computer opens up advanced opportunities like stock trading, real estate investment, cryptocurrency trading, and even dark web activities. These can be high-risk, high-reward paths to wealth, but choose your path carefully!',
    position: 'right',
  },
  {
    id: 'market-investments',
    title: 'Market & Investment Hub',
    description: 'Visit the market to buy items, invest in stocks, purchase real estate, or start businesses. Smart investments can lead to passive income and financial freedom. Study market trends and make informed decisions!',
    position: 'center',
  },
  {
    id: 'health-wellness',
    title: 'Health & Wellness Management',
    description: 'Monitor and improve your health through medical care, fitness activities, and lifestyle choices. Good health is essential for a long and prosperous life. Neglect it at your own risk!',
    position: 'center',
  },
  {
    id: 'social-relationships',
    title: 'Social Relationships & Networking',
    description: 'Build meaningful relationships with family, friends, and romantic partners. Strong social connections provide happiness, support, and opportunities throughout your life journey. Invest time in your relationships!',
    position: 'center',
  },
  {
    id: 'achievements-goals',
    title: 'Achievements & Life Goals',
    description: 'Track your progress through achievements and life goals. Complete challenges to unlock rewards, perks, and see how your life choices shape your legacy. Set ambitious goals and work towards them!',
    position: 'center',
  },
  {
    id: 'settings-customization',
    title: 'Settings & Game Customization',
    description: 'Access game settings, save your progress, and get help when needed. Customize your experience, manage save slots, and access the tutorial anytime. Don\'t hesitate to explore all options!',
    position: 'center',
  },
  {
    id: 'ready-to-play',
    title: 'Ready to Begin Your Life Journey!',
    description: 'You\'re now ready to start your life simulation! Remember, every choice matters and shapes your destiny. Will you become a successful entrepreneur, a fitness guru, a social influencer, a tech mogul, or something entirely different? The choice is yours - make it count!',
    position: 'center',
  },
];

export const ONBOARDING_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'scenario-selection',
    title: 'Choose Your Starting Scenario',
    description: 'Select a scenario that matches your desired playstyle. Each scenario provides different starting conditions and challenges. You can customize your character further after choosing.',
    position: 'center',
  },
  {
    id: 'character-customization',
    title: 'Customize Your Character',
    description: 'Personalize your character\'s appearance and traits. These choices will affect how others perceive you and can influence your social interactions.',
    position: 'center',
  },
  {
    id: 'perks-selection',
    title: 'Select Your Perks',
    description: 'Choose perks that align with your goals. Perks provide advantages in specific areas like career, relationships, or health. Choose wisely as they\'ll shape your life path!',
    position: 'center',
  },
  {
    id: 'save-slot',
    title: 'Save Your Game',
    description: 'Select a save slot to store your progress. You can have multiple life simulations running simultaneously. Don\'t forget to save regularly!',
    position: 'center',
  },
];

export const ADVANCED_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'stock-trading',
    title: 'Stock Market Trading',
    description: 'Invest in stocks to build wealth. Research companies, monitor market trends, and make strategic investments. Remember: buy low, sell high!',
    position: 'center',
  },
  {
    id: 'real-estate',
    title: 'Real Estate Investment',
    description: 'Purchase properties to generate passive income. Location and timing are crucial. Real estate can be a stable source of income over time.',
    position: 'center',
  },
  {
    id: 'business-ownership',
    title: 'Business Management',
    description: 'Start and manage your own businesses. This requires significant investment but can lead to substantial profits if managed well.',
    position: 'center',
  },
  {
    id: 'cryptocurrency',
    title: 'Cryptocurrency Trading',
    description: 'Trade digital currencies for potentially high returns. This is highly volatile and risky, but can be very profitable for skilled traders.',
    position: 'center',
  },
  {
    id: 'dark-web',
    title: 'Dark Web Activities',
    description: 'Access the dark web for illegal activities. This is extremely risky and can lead to jail time, but offers unique opportunities for those willing to take the risk.',
    position: 'center',
  },
];

// Helper function to get tutorial steps based on context
export function getTutorialSteps(context: 'game' | 'onboarding' | 'advanced'): TutorialStep[] {
  switch (context) {
    case 'onboarding':
      return ONBOARDING_TUTORIAL_STEPS;
    case 'advanced':
      return ADVANCED_TUTORIAL_STEPS;
    default:
      return GAME_TUTORIAL_STEPS;
  }
}

// Helper function to get specific tutorial step by ID
export function getTutorialStepById(id: string, context: 'game' | 'onboarding' | 'advanced' = 'game'): TutorialStep | undefined {
  const steps = getTutorialSteps(context);
  return steps.find(step => step.id === id);
}
