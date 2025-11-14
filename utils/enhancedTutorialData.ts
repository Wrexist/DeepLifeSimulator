import { TutorialStep } from '@/types/tutorial';

export interface EnhancedTutorialStep extends TutorialStep {
  id: string;
  title: string;
  description: string;
  detailedDescription?: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  image?: string;
  category: 'welcome' | 'basics' | 'navigation' | 'features' | 'advanced' | 'completion';
  importance: 'low' | 'medium' | 'high' | 'critical';
  interactive?: boolean;
  requiresAction?: string;
  tips?: string[];
  warnings?: string[];
  nextSteps?: string[];
}

// Main tutorial steps (for new players) - Comprehensive tutorial covering all key features
export const MAIN_TUTORIAL_STEPS: EnhancedTutorialStep[] = [
  {
    id: 'welcome',
    title: '🎮 Welcome to DeepLife Simulator!',
    description: 'Welcome to your virtual life! Make choices, build relationships, pursue careers, and shape your destiny.',
    detailedDescription: 'DeepLife Simulator is a comprehensive life simulation where every decision matters. You\'ll start as a young adult and navigate through life, making choices about career, relationships, health, and personal growth. Your decisions will shape your character\'s personality, opportunities, and ultimate destiny.',
    target: 'welcome-overlay',
    position: 'center',
    category: 'basics',
    importance: 'critical',
    interactive: false,
    nextSteps: ['character-stats']
  },
  {
    id: 'character-stats',
    title: '📊 Your Character Statistics',
    description: 'These are your character\'s vital statistics! Each one affects your life in different ways.',
    detailedDescription: 'Your character has six core stats: Health (affects longevity), Happiness (affects opportunities), Energy (needed for activities), Fitness (affects health and appearance), Money (enables purchases and investments), and Reputation (affects social interactions and career opportunities). Monitor these carefully as they change based on your choices!',
    target: 'top-stats-bar',
    position: 'bottom',
    category: 'basics',
    importance: 'critical',
    interactive: true,
    requiresAction: 'view_stats',
    tips: [
      'Keep Health above 20 to avoid illness',
      'High Happiness unlocks better opportunities',
      'Energy is consumed by most activities',
      'High Reputation improves career prospects'
    ],
    warnings: [
      'Letting any stat reach 0 can have serious consequences',
      'Low stats can trigger negative events'
    ],
    nextSteps: ['age-progression']
  },
  {
    id: 'age-progression',
    title: '⏰ Time & Age Progression',
    description: 'Time passes in weeks, and your age increases over time. Each week brings new opportunities and challenges!',
    detailedDescription: 'Time flows continuously in DeepLife. Each week you\'ll make decisions that shape your life path. Different life stages unlock new opportunities - young adulthood offers education and career building, middle age brings advanced opportunities, and senior years focus on legacy and retirement planning.',
    target: 'age-display',
    position: 'center',
    category: 'basics',
    importance: 'high',
    interactive: false,
    tips: [
      'Plan long-term goals based on your age',
      'Some opportunities are only available at certain ages',
      'Your appearance changes as you age (40+ years)'
    ],
    nextSteps: ['main-activities']
  },
  {
    id: 'main-activities',
    title: '🎯 Core Life Activities',
    description: 'These are your primary activities that drive your life forward. Balance is the key to success!',
    detailedDescription: 'Your main activities include Work (earn money and advance career), Exercise (improve fitness and health), Socialize (build relationships and happiness), and Rest (recover energy). Each activity costs energy and provides different benefits. Smart balancing of these activities is crucial for a successful life.',
    target: 'main-activities',
    position: 'bottom',
    category: 'basics',
    importance: 'critical',
    interactive: true,
    requiresAction: 'perform_activity',
    tips: [
      'Work regularly to build career and earn money',
      'Exercise to maintain health and fitness',
      'Socialize to build relationships and happiness',
      'Rest when energy is low to avoid burnout'
    ],
    warnings: [
      'Running out of energy prevents most activities',
      'Neglecting any activity can lead to problems'
    ],
    nextSteps: ['first-job-application']
  },
  {
    id: 'first-job-application',
    title: '💼 Get Your First Job!',
    description: 'Ready to start earning money? Let\'s get you your first job! Tap the Work tab to see available careers.',
    detailedDescription: 'Getting a job is essential for earning money and advancing your career. Visit the Work tab to see available jobs, check their requirements, and apply. Your education level and stats will determine which jobs you qualify for. Start with entry-level positions and work your way up!',
    target: 'work-tab',
    position: 'bottom',
    category: 'features',
    importance: 'critical',
    interactive: true,
    requiresAction: 'navigate_to_work',
    tips: [
      'Check job requirements before applying',
      'Higher education unlocks better jobs',
      'Some jobs require specific stats',
      'You can quit and find new jobs anytime'
    ],
    warnings: [
      'Jobs require energy to perform',
      'Some jobs have age or education requirements'
    ],
    nextSteps: ['market-place']
  },
  {
    id: 'market-place',
    title: '🛒 The Market Place',
    description: 'Visit the Market to buy items, food, and gym memberships that will enhance your life!',
    detailedDescription: 'The Market is where you can purchase items that provide daily bonuses, food to boost your stats, and gym memberships for fitness improvements. Items like smartphones and computers unlock new features and opportunities. Smart purchases can significantly improve your life quality and unlock new possibilities.',
    target: 'market-tab',
    position: 'left',
    category: 'features',
    importance: 'high',
    interactive: true,
    requiresAction: 'navigate_to_market',
    tips: [
      'Items provide daily bonuses to your stats',
      'Food can boost specific stats temporarily',
      'Gym memberships improve fitness over time',
      'Smartphones and computers unlock new features'
    ],
    nextSteps: ['mobile-phone']
  },
  {
    id: 'mobile-phone',
    title: '📱 Mobile Phone Features',
    description: 'Your smartphone opens up a world of digital opportunities! Banking, social media, dating, and more.',
    detailedDescription: 'Once you own a smartphone, you\'ll unlock powerful mobile apps including Banking (manage money and loans), Social Media (build followers and influence), Dating (find romantic partners), Education (learn new skills), and Contacts (manage relationships). These apps can dramatically change your life path.',
    target: 'mobile-phone',
    position: 'left',
    category: 'features',
    importance: 'high',
    interactive: true,
    requiresAction: 'open_mobile',
    tips: [
      'Banking helps manage money and get loans',
      'Social media builds reputation and followers',
      'Dating app helps find romantic partners',
      'Education apps unlock career opportunities'
    ],
    nextSteps: ['computer-activities']
  },
  {
    id: 'computer-activities',
    title: '💻 Computer & Advanced Features',
    description: 'Your computer unlocks advanced opportunities for wealth building and high-risk activities.',
    detailedDescription: 'Your computer provides access to Stock Trading (build wealth through investments), Real Estate (generate passive income), Cryptocurrency Trading (high-risk, high-reward), and even Dark Web activities (illegal but profitable). These can be high-risk, high-reward paths to wealth, but choose your path carefully as consequences can be severe!',
    target: 'computer-tab',
    position: 'right',
    category: 'features',
    importance: 'high',
    interactive: true,
    requiresAction: 'open_computer',
    tips: [
      'Stock trading can build significant wealth',
      'Real estate provides passive income',
      'Cryptocurrency is high-risk, high-reward',
      'Dark web activities are illegal but profitable'
    ],
    warnings: [
      'High-risk investments can lead to losses',
      'Illegal activities can result in jail time'
    ],
    nextSteps: ['health-wellness']
  },
  {
    id: 'health-wellness',
    title: '🏥 Health & Wellness Management',
    description: 'Take care of your health! Visit doctors, exercise, and manage your well-being to live a long, successful life.',
    detailedDescription: 'Health is crucial for longevity and success. Visit doctors for medical treatment, exercise regularly to improve fitness, and avoid risky activities that harm your health. Poor health can lead to illness, reduced life expectancy, and even death. Invest in your health for a better life.',
    target: 'health-tab',
    position: 'center',
    category: 'features',
    importance: 'critical',
    interactive: true,
    requiresAction: 'improve_health',
    tips: [
      'Visit doctors for medical treatment',
      'Exercise regularly to improve fitness',
      'Avoid risky activities that harm health',
      'Buy health items from the market'
    ],
    warnings: [
      'Health below 20 can trigger serious illness',
      'Health at 0 results in death',
      'Medical treatment costs money but is essential'
    ],
    nextSteps: ['social-relationships']
  },
  {
    id: 'social-relationships',
    title: '👥 Social Relationships & Networking',
    description: 'Build meaningful relationships! Friends, romantic partners, and social connections enrich your life.',
    detailedDescription: 'Relationships are essential for happiness and success. Build friendships, find romantic partners, and maintain social connections. Strong relationships provide emotional support, unlock opportunities, and contribute to your overall happiness. Use the dating app, social media, and social activities to build your network.',
    target: 'social-tab',
    position: 'bottom',
    category: 'features',
    importance: 'high',
    interactive: true,
    requiresAction: 'open_mobile',
    tips: [
      'Use dating app to find romantic partners',
      'Social media helps build connections',
      'Strong relationships provide happiness',
      'Social connections unlock opportunities'
    ],
    nextSteps: ['achievements-goals']
  },
  {
    id: 'achievements-goals',
    title: '🏆 Achievements & Life Goals',
    description: 'Track your progress with achievements and life goals! Complete challenges to unlock rewards.',
    detailedDescription: 'Achievements track your major life milestones and accomplishments. Life goals provide guidance and rewards for reaching important milestones. Completing goals gives you money, gems, and unlocks new opportunities. Check your progress regularly and strive to achieve great things!',
    target: 'achievements-display',
    position: 'bottom',
    category: 'features',
    importance: 'medium',
    interactive: true,
    requiresAction: 'view_achievements',
    tips: [
      'Achievements track major milestones',
      'Goals provide guidance and rewards',
      'Complete goals to earn money and gems',
      'Regular progress tracking helps motivation'
    ],
    nextSteps: ['settings-customization']
  },
  {
    id: 'settings-customization',
    title: '⚙️ Settings & Game Customization',
    description: 'Customize your experience! Adjust settings, enable dark mode, and personalize your game.',
    detailedDescription: 'The Settings tab allows you to customize your gaming experience. Enable dark mode for better visibility, adjust sound and haptic feedback, manage your save slots, and access game information. You can also restart your game or access advanced features from here.',
    target: 'settings-tab',
    position: 'center',
    category: 'features',
    importance: 'low',
    interactive: true,
    requiresAction: 'open_settings',
    tips: [
      'Enable dark mode for better visibility',
      'Adjust sound and haptic feedback',
      'Manage multiple save slots',
      'Access game information and credits'
    ],
    nextSteps: ['ready-to-play']
  },
  {
    id: 'ready-to-play',
    title: '▶️ Ready to Start Your Life!',
    description: 'You\'re all set! Start making choices, building your life, and creating your unique story.',
    detailedDescription: 'You now understand the core mechanics of DeepLife Simulator! Remember to balance your activities, manage your resources wisely, build meaningful relationships, and pursue your goals. Every choice matters, so think carefully about your decisions. Good luck on your life journey!',
    target: 'ready-overlay',
    position: 'center',
    category: 'basics',
    importance: 'critical',
    interactive: false,
    tips: [
      'Balance work, rest, exercise, and socializing',
      'Manage your money and resources wisely',
      'Build relationships for happiness and support',
      'Pursue goals and achievements for rewards'
    ],
    warnings: [
      'Make thoughtful decisions - they have consequences',
      'Monitor your stats to avoid problems',
      'Save your game regularly'
    ]
  }
];

// Full tutorial steps (for advanced features)
export const ENHANCED_TUTORIAL_STEPS: EnhancedTutorialStep[] = [
  {
    id: 'welcome',
    title: '🌟 Welcome to DeepLife Simulator!',
    description: 'Welcome to your new life! I\'m your personal guide, and I\'ll help you master every aspect of this incredible life simulation game.',
    detailedDescription: 'DeepLife Simulator is a comprehensive life simulation where every choice matters. You\'ll build careers, relationships, wealth, and create your own unique story. I\'ll guide you through all the essential features and help you become a master of your virtual destiny.',
    position: 'center',
    category: 'welcome',
    importance: 'critical',
    interactive: false,
    tips: [
      'Take your time to explore each feature',
      'Don\'t be afraid to experiment with different choices',
      'Save your progress regularly'
    ],
    nextSteps: ['character-stats', 'age-progression', 'main-activities']
  },
  {
    id: 'character-stats',
    title: '📊 Your Character Statistics',
    description: 'These are your character\'s vital statistics! Each one affects your life in different ways.',
    detailedDescription: 'Your character has six core stats: Health (affects longevity), Happiness (affects opportunities), Energy (needed for activities), Fitness (affects health and appearance), Money (enables purchases and investments), and Reputation (affects social interactions and career opportunities). Monitor these carefully as they change based on your choices!',
    target: 'top-stats-bar',
    position: 'bottom',
    category: 'basics',
    importance: 'critical',
    interactive: true,
    requiresAction: 'view_stats',
    tips: [
      'Keep Health above 20 to avoid illness',
      'High Happiness unlocks better opportunities',
      'Energy is consumed by most activities',
      'High Reputation improves career prospects'
    ],
    warnings: [
      'Letting any stat reach 0 can have serious consequences',
      'Low stats can trigger negative events'
    ]
  },
  {
    id: 'age-progression',
    title: '⏰ Time & Age Progression',
    description: 'Time passes in weeks, and your age increases over time. Each week brings new opportunities and challenges!',
    detailedDescription: 'Time flows continuously in DeepLife. Each week you\'ll make decisions that shape your life path. Different life stages unlock new opportunities - young adulthood offers education and career building, middle age brings advanced opportunities, and senior years focus on legacy and retirement planning.',
    target: 'age-display',
    position: 'center',
    category: 'basics',
    importance: 'high',
    interactive: false,
    tips: [
      'Plan long-term goals based on your age',
      'Some opportunities are only available at certain ages',
      'Your appearance changes as you age (40+ years)'
    ]
  },
  {
    id: 'main-activities',
    title: '🎯 Core Life Activities',
    description: 'These are your primary activities that drive your life forward. Balance is the key to success!',
    detailedDescription: 'Your main activities include Work (earn money and advance career), Exercise (improve fitness and health), Socialize (build relationships and happiness), and Rest (recover energy). Each activity costs energy and provides different benefits. Smart balancing of these activities is crucial for a successful life.',
    target: 'main-activities',
    position: 'bottom',
    category: 'basics',
    importance: 'critical',
    interactive: true,
    requiresAction: 'perform_activity',
    tips: [
      'Work regularly to build career and earn money',
      'Exercise to maintain health and fitness',
      'Socialize to build relationships and happiness',
      'Rest when energy is low to avoid burnout'
    ],
    warnings: [
      'Running out of energy prevents most activities',
      'Neglecting any activity can lead to problems'
    ],
    nextSteps: ['first-job-application']
  },
  {
    id: 'first-job-application',
    title: '💼 Get Your First Job!',
    description: 'Ready to start earning money? Let\'s get you your first job! Tap the Work tab to see available careers.',
    detailedDescription: 'Getting a job is essential for earning money and advancing your career. Visit the Work tab to see available jobs, check their requirements, and apply. Your education level and stats will determine which jobs you qualify for. Start with entry-level positions and work your way up!',
    target: 'work-tab',
    position: 'bottom',
    category: 'features',
    importance: 'critical',
    interactive: true,
    requiresAction: 'navigate_to_work',
    tips: [
      'Check job requirements before applying',
      'Higher education unlocks better jobs',
      'Some jobs require specific stats',
      'You can quit and find new jobs anytime'
    ],
    warnings: [
      'Jobs require energy to perform',
      'Some jobs have age or education requirements'
    ]
  },
  {
    id: 'mobile-phone',
    title: '📱 Your Digital Life - Mobile Phone',
    description: 'Your phone is your digital lifeline! Access powerful apps that can transform your life.',
    detailedDescription: 'Your mobile phone contains apps for Banking (manage money and loans), Social Media (build followers and influence), Dating (find romantic partners), Education (learn new skills), and more. Different apps unlock as you progress and can significantly impact your life path. Use them strategically to enhance your opportunities!',
    target: 'mobile-phone',
    position: 'left',
    category: 'features',
    importance: 'high',
    interactive: true,
    requiresAction: 'open_mobile',
    tips: [
      'Check banking regularly to manage finances',
      'Use social media to build reputation and followers',
      'Dating app helps find romantic partners',
      'Education apps unlock new career opportunities'
    ],
    nextSteps: ['banking-app', 'social-media-app', 'dating-app']
  },
  {
    id: 'computer-activities',
    title: '💻 Advanced Opportunities - Computer',
    description: 'Your computer opens up advanced opportunities for wealth building and high-risk activities.',
    detailedDescription: 'Your computer provides access to Stock Trading (build wealth through investments), Real Estate (generate passive income), Cryptocurrency Trading (high-risk, high-reward), and even Dark Web activities (illegal but profitable). These can be high-risk, high-reward paths to wealth, but choose your path carefully as consequences can be severe!',
    target: 'computer-tab',
    position: 'right',
    category: 'features',
    importance: 'medium',
    interactive: true,
    requiresAction: 'open_computer',
    tips: [
      'Start with safer investments like stocks',
      'Real estate provides stable passive income',
      'Cryptocurrency is highly volatile',
      'Dark web activities carry serious risks'
    ],
    warnings: [
      'Illegal activities can result in jail time',
      'High-risk investments can lead to significant losses',
      'Always consider the legal and financial consequences'
    ]
  },
  {
    id: 'market-investments',
    title: '🏪 Market & Investment Hub',
    description: 'Visit the market to buy items, invest in stocks, purchase real estate, or start businesses.',
    detailedDescription: 'The market is your gateway to wealth building. You can buy items to boost your stats, invest in stocks for long-term growth, purchase real estate for passive income, or start businesses for active income generation. Smart investments can lead to financial freedom, but study market trends and make informed decisions!',
    target: 'market-tab',
    position: 'center',
    category: 'features',
    importance: 'high',
    interactive: true,
    requiresAction: 'explore_market',
    tips: [
      'Start with small investments to learn',
      'Diversify your portfolio to reduce risk',
      'Real estate provides stable passive income',
      'Monitor market trends before investing'
    ],
    warnings: [
      'All investments carry risk of loss',
      'Don\'t invest more than you can afford to lose'
    ]
  },
  {
    id: 'health-wellness',
    title: '🏥 Health & Wellness Management',
    description: 'Monitor and improve your health through medical care, fitness activities, and lifestyle choices.',
    detailedDescription: 'Your health is essential for a long and prosperous life. Visit doctors for medical care, exercise regularly to maintain fitness, eat well, and avoid risky behaviors. Good health improves your quality of life and longevity. Neglect it at your own risk - poor health can lead to serious consequences and even death.',
    target: 'health-tab',
    position: 'center',
    category: 'features',
    importance: 'critical',
    interactive: true,
    requiresAction: 'check_health',
    tips: [
      'Visit doctors when health is low',
      'Exercise regularly to maintain fitness',
      'Avoid risky activities that harm health',
      'Good health improves all aspects of life'
    ],
    warnings: [
      'Poor health can lead to death',
      'Medical care costs money but is essential',
      'Some activities permanently damage health'
    ]
  },
  {
    id: 'social-relationships',
    title: '👥 Social Relationships & Networking',
    description: 'Build meaningful relationships with family, friends, and romantic partners.',
    detailedDescription: 'Strong social connections provide happiness, support, and opportunities throughout your life journey. Build relationships through social media, dating apps, and personal interactions. Family relationships are automatic, but friendships and romantic partnerships require effort and investment. Invest time in your relationships - they\'re the foundation of a fulfilling life!',
    target: 'relationships-tab',
    position: 'center',
    category: 'features',
    importance: 'high',
    interactive: true,
    requiresAction: 'manage_relationships',
    tips: [
      'Spend time with family for happiness and support',
      'Build friendships through social activities',
      'Use dating apps to find romantic partners',
      'Strong relationships provide life opportunities'
    ],
    warnings: [
      'Neglecting relationships leads to loneliness',
      'Poor relationship management can cause breakups'
    ]
  },
  {
    id: 'achievements-goals',
    title: '🏆 Achievements & Life Goals',
    description: 'Track your progress through achievements and life goals. Complete challenges to unlock rewards!',
    detailedDescription: 'Achievements track your accomplishments across different life areas. Complete challenges to unlock rewards, perks, and see how your life choices shape your legacy. Life goals provide direction and motivation. Set ambitious goals and work towards them - they provide long-term satisfaction and unlock special rewards!',
    target: 'achievements-tab',
    position: 'center',
    category: 'features',
    importance: 'medium',
    interactive: true,
    requiresAction: 'view_achievements',
    tips: [
      'Check achievements regularly for progress',
      'Set realistic but challenging life goals',
      'Achievements unlock special rewards and perks',
      'Some achievements require specific strategies'
    ]
  },
  {
    id: 'settings-customization',
    title: '⚙️ Settings & Game Customization',
    description: 'Access game settings, save your progress, and get help when needed.',
    detailedDescription: 'The settings menu allows you to customize your experience, manage save slots, access the tutorial anytime, and get help. You can also adjust visual settings, enable/disable features, and manage your game data. Don\'t hesitate to explore all options and customize your experience to your liking!',
    target: 'settings-tab',
    position: 'center',
    category: 'features',
    importance: 'medium',
    interactive: true,
    requiresAction: 'open_settings',
    tips: [
      'Save your progress regularly',
      'Use multiple save slots for different playthroughs',
      'Access help when you need it',
      'Customize settings to your preference'
    ]
  },
  {
    id: 'advanced-features',
    title: '🚀 Advanced Features & Strategies',
    description: 'Master advanced features like skill development, business management, and complex strategies.',
    detailedDescription: 'Once you\'ve mastered the basics, explore advanced features like skill development, business ownership, complex investment strategies, and specialized career paths. These advanced features offer unique challenges and rewards for experienced players looking to optimize their virtual life.',
    category: 'advanced',
    importance: 'medium',
    interactive: false,
    tips: [
      'Develop specialized skills for career advancement',
      'Start businesses for passive income generation',
      'Use advanced investment strategies for wealth building',
      'Explore specialized career paths for unique rewards'
    ]
  },
  {
    id: 'ready-to-play',
    title: '🎉 Ready to Begin Your Life Journey!',
    description: 'You\'re now ready to start your life simulation! Every choice matters and shapes your destiny.',
    detailedDescription: 'Congratulations! You now have all the knowledge needed to succeed in DeepLife Simulator. Remember, every choice matters and shapes your destiny. Will you become a successful entrepreneur, a fitness guru, a social influencer, a tech mogul, or something entirely different? The choice is yours - make it count! Your virtual life awaits!',
    position: 'center',
    category: 'completion',
    importance: 'critical',
    interactive: false,
    tips: [
      'Start with small goals and build up',
      'Don\'t be afraid to restart if things go wrong',
      'Experiment with different life paths',
      'Have fun and create your own unique story'
    ],
    nextSteps: ['start_playing', 'explore_features', 'set_goals']
  }
];

export const ONBOARDING_TUTORIAL_STEPS: EnhancedTutorialStep[] = [
  {
    id: 'scenario-selection',
    title: '🎭 Choose Your Starting Scenario',
    description: 'Select a scenario that matches your desired playstyle. Each scenario provides different starting conditions and challenges.',
    detailedDescription: 'Your starting scenario determines your initial stats, resources, and available opportunities. Choose carefully as this will significantly impact your early game experience. You can customize your character further after choosing your scenario.',
    position: 'center',
    category: 'welcome',
    importance: 'critical',
    interactive: true,
    requiresAction: 'select_scenario',
    tips: [
      'Read each scenario description carefully',
      'Consider your preferred playstyle',
      'Starting conditions affect early game difficulty',
      'You can always start over with a different scenario'
    ]
  },
  {
    id: 'character-customization',
    title: '👤 Customize Your Character',
    description: 'Personalize your character\'s appearance, name, and traits. These choices will affect how others perceive you.',
    detailedDescription: 'Character customization allows you to create your unique virtual self. Choose your name, gender, and appearance. These choices will influence your social interactions and how other characters perceive you throughout the game.',
    position: 'center',
    category: 'basics',
    importance: 'high',
    interactive: true,
    requiresAction: 'customize_character',
    tips: [
      'Choose a name you\'ll enjoy seeing throughout the game',
      'Gender choice affects some social interactions',
      'Your appearance will change as you age',
      'You can always restart to try different options'
    ]
  },
  {
    id: 'perks-selection',
    title: '⭐ Select Your Perks',
    description: 'Choose perks that align with your goals. Perks provide advantages in specific areas like career, relationships, or health.',
    detailedDescription: 'Perks are special advantages that will help you succeed in specific areas of life. Choose perks that align with your goals and playstyle. Some perks are locked behind achievements, while others are available from the start. Choose wisely as they\'ll shape your life path!',
    position: 'center',
    category: 'basics',
    importance: 'high',
    interactive: true,
    requiresAction: 'select_perks',
    tips: [
      'Read perk descriptions carefully',
      'Choose perks that match your goals',
      'Some perks require achievements to unlock',
      'You can select multiple perks if you have enough points'
    ],
    warnings: [
      'Some perks are permanent and cannot be changed',
      'Choose perks that complement your chosen scenario'
    ]
  },
  {
    id: 'save-slot',
    title: '💾 Save Your Game',
    description: 'Select a save slot to store your progress. You can have multiple life simulations running simultaneously.',
    detailedDescription: 'Choose a save slot to store your character and progress. You can have up to three different life simulations running simultaneously. Don\'t forget to save regularly to avoid losing progress!',
    position: 'center',
    category: 'basics',
    importance: 'critical',
    interactive: true,
    requiresAction: 'save_game',
    tips: [
      'Use different save slots for different playstyles',
      'Save regularly to avoid losing progress',
      'You can delete and restart save slots anytime',
      'Each save slot is completely independent'
    ]
  }
];

export const CONTEXTUAL_TUTORIAL_STEPS: { [key: string]: EnhancedTutorialStep[] } = {
  'first_job': [
    {
      id: 'job_application',
      title: '💼 Your First Job Application',
      description: 'Time to get your first job! This is how you\'ll start earning money and building your career.',
      detailedDescription: 'Getting a job is essential for earning money and advancing your career. Visit the Work tab to see available jobs, check their requirements, and apply. Your education level and stats will determine which jobs you qualify for.',
      target: 'work-tab',
      position: 'bottom',
      category: 'features',
      importance: 'critical',
      interactive: true,
      requiresAction: 'navigate_to_work',
      tips: [
        'Check job requirements before applying',
        'Higher education unlocks better jobs',
        'Some jobs require specific stats',
        'You can quit and find new jobs anytime'
      ]
    }
  ],
  'first_investment': [
    {
      id: 'stock_investment',
      title: '📈 Your First Investment',
      description: 'Ready to start building wealth? Learn how to invest in stocks for long-term growth.',
      detailedDescription: 'Investing in stocks is one of the best ways to build long-term wealth. Visit the Market tab to research companies, check stock prices, and make your first investment. Start small and learn as you go!',
      target: 'market-tab',
      position: 'bottom',
      category: 'features',
      importance: 'high',
      interactive: true,
      requiresAction: 'navigate_to_market',
      tips: [
        'Start with small investments to learn',
        'Research companies before investing',
        'Diversify your portfolio',
        'Stock prices fluctuate daily'
      ],
      warnings: [
        'All investments carry risk of loss',
        'Don\'t invest more than you can afford to lose'
      ]
    }
  ],
  'first_relationship': [
    {
      id: 'dating_guide',
      title: '💕 Building Your First Relationship',
      description: 'Ready to find love? Learn how to use the dating app to meet potential partners.',
      detailedDescription: 'Relationships are an important part of life. Use the dating app to browse profiles, match with potential partners, and build meaningful relationships. Strong relationships provide happiness and support throughout your life.',
      target: 'dating-app',
      position: 'center',
      category: 'features',
      importance: 'medium',
      interactive: true,
      requiresAction: 'open_mobile',
      tips: [
        'Create an attractive profile',
        'Be honest in your bio',
        'Take time to build relationships',
        'Strong relationships provide happiness and support'
      ]
    }
  ]
};

// Helper function to get tutorial steps based on context
export function getEnhancedTutorialSteps(context: 'game' | 'onboarding' | 'advanced' | 'contextual', contextualKey?: string): EnhancedTutorialStep[] {
  switch (context) {
    case 'onboarding':
      return ONBOARDING_TUTORIAL_STEPS;
    case 'advanced':
      return ENHANCED_TUTORIAL_STEPS.filter(step => step.category === 'advanced');
    case 'contextual':
      return contextualKey ? CONTEXTUAL_TUTORIAL_STEPS[contextualKey] || [] : [];
    case 'game':
      return MAIN_TUTORIAL_STEPS; // Use main tutorial for new players
    default:
      return ENHANCED_TUTORIAL_STEPS;
  }
}

// Helper function to get specific tutorial step by ID
export function getEnhancedTutorialStepById(id: string, context: 'game' | 'onboarding' | 'advanced' = 'game'): EnhancedTutorialStep | undefined {
  const steps = getEnhancedTutorialSteps(context);
  return steps.find(step => step.id === id);
}

// Helper function to get tutorial steps by category
export function getTutorialStepsByCategory(category: EnhancedTutorialStep['category']): EnhancedTutorialStep[] {
  return ENHANCED_TUTORIAL_STEPS.filter(step => step.category === category);
}

// Helper function to get tutorial steps by importance
export function getTutorialStepsByImportance(importance: EnhancedTutorialStep['importance']): EnhancedTutorialStep[] {
  return ENHANCED_TUTORIAL_STEPS.filter(step => step.importance === importance);
}

// Helper function to check if tutorial step is interactive
export function getInteractiveTutorialSteps(): EnhancedTutorialStep[] {
  return ENHANCED_TUTORIAL_STEPS.filter(step => step.interactive === true);
}
