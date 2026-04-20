import { TutorialStep } from '@/types/tutorial';

export const GAME_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '🎮 Welcome!',
    description: 'Welcome to DeepLife Simulator! This quick tutorial will show you the basics. Let\'s get started!',
    position: 'center',
  },
  {
    id: 'character-stats',
    title: '📊 Your Stats',
    description: 'Keep an eye on the bars at the top: Health ❤️, Happiness 😊, and Energy ⚡. Try to keep them high!',
    position: 'top',
  },
  {
    id: 'time',
    title: '⏰ Time & Age',
    description: 'Press "Next Week" to advance time. Each week, your stats will change based on your activities.',
    position: 'center',
  },
  {
    id: 'getting-started',
    title: '💼 First Steps',
    description: 'Start by getting a job in the Work tab. Then buy items in the Market tab to boost your stats!',
    position: 'bottom',
  },
  {
    id: 'mobile-phone',
    title: '📱 Your Phone',
    description: 'Buy a phone from the Market to unlock apps: Banking, Social Media, Dating, and more!',
    position: 'left',
  },
  {
    id: 'computer',
    title: '💻 Your Computer',
    description: 'Buy a computer to access stocks, real estate, crypto, and other money-making opportunities.',
    position: 'right',
  },
  {
    id: 'ready-to-play',
    title: '🎉 You\'re Ready!',
    description: 'That\'s it! Start small, work your way up, and have fun building your virtual life. Good luck!',
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
export function getTutorialSteps(context: 'game' | 'onboarding' | 'advanced' = 'game'): TutorialStep[] {
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
