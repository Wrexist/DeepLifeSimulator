import type { GameState } from '@/contexts/game/types';
import type { LifeMoment, LifeMomentChoice } from './types';
import { logger } from '@/utils/logger';

const log = logger.scope('LifeMomentGenerator');

/**
 * Life moment templates
 * Quick 30-60 second decisions that add constant engagement
 */
const LIFE_MOMENT_TEMPLATES: Omit<LifeMoment, 'id' | 'createdAt'>[] = [
  {
    situation: 'A coworker invites you for a coffee break. You\'re swamped with work.',
    choices: [
      {
        id: 'join',
        text: 'Take a 10-minute break',
        quickEffect: [
          { stat: 'happiness', amount: 5, label: '+5 Happiness' },
          { stat: 'energy', amount: 3, label: '+3 Energy' },
        ],
        hiddenEffect: 'Your coworker remembers your friendliness. Future networking opportunities may arise.',
        hiddenConsequences: [
          {
            type: 'unlock_event',
            targetEventId: 'networking_opportunity',
            weeksUntilActive: 3,
            description: 'Your coworker introduces you to someone important.',
          },
        ],
      },
      {
        id: 'decline',
        text: 'Politely decline, keep working',
        quickEffect: [
          { stat: 'happiness', amount: -2, label: '-2 Happiness' },
          { stat: 'reputation', amount: 2, label: '+2 Reputation' },
        ],
        hiddenEffect: 'Your dedication is noticed. Your boss takes note.',
        hiddenConsequences: [
          {
            type: 'modify_weight',
            targetEventId: 'job_bonus',
            weightModifier: 0.1,
            description: 'Your dedication increases chances of bonuses.',
          },
        ],
      },
    ],
    category: 'work',
  },
  {
    situation: 'A street musician is playing beautiful music. You have a few dollars.',
    choices: [
      {
        id: 'tip',
        text: 'Drop $5 in the hat',
        quickEffect: [
          { stat: 'money', amount: -5, label: '-$5' },
          { stat: 'happiness', amount: 8, label: '+8 Happiness' },
        ],
        hiddenEffect: 'The musician remembers your kindness. You might see them again.',
        hiddenConsequences: [
          {
            type: 'unlock_event',
            targetEventId: 'street_musician_friend',
            weeksUntilActive: 5,
            description: 'The street musician recognizes you and plays your favorite song.',
          },
        ],
      },
      {
        id: 'listen',
        text: 'Just listen for a moment',
        quickEffect: [
          { stat: 'happiness', amount: 3, label: '+3 Happiness' },
        ],
        hiddenEffect: 'A moment of peace in your day.',
      },
      {
        id: 'walk',
        text: 'Keep walking',
        quickEffect: [],
        hiddenEffect: 'Life goes on.',
      },
    ],
    category: 'random',
  },
  {
    situation: 'You see someone struggling with heavy groceries. You\'re in a hurry.',
    choices: [
      {
        id: 'help',
        text: 'Offer to help',
        quickEffect: [
          { stat: 'energy', amount: -5, label: '-5 Energy' },
          { stat: 'happiness', amount: 10, label: '+10 Happiness' },
          { stat: 'reputation', amount: 3, label: '+3 Reputation' },
        ],
        hiddenEffect: 'Your kindness creates a ripple effect.',
        hiddenConsequences: [
          {
            type: 'modify_weight',
            targetEventId: 'random_act_kindness',
            weightModifier: 0.2,
            description: 'Good deeds attract more opportunities.',
          },
        ],
      },
      {
        id: 'hurry',
        text: 'Keep walking',
        quickEffect: [
          { stat: 'happiness', amount: -3, label: '-3 Happiness' },
        ],
        hiddenEffect: 'You wonder if you should have helped.',
      },
    ],
    category: 'random',
  },
  {
    situation: 'Your phone battery is at 5%. You\'re expecting an important call.',
    choices: [
      {
        id: 'conserve',
        text: 'Turn off unnecessary apps and conserve battery',
        quickEffect: [
          { stat: 'happiness', amount: -2, label: '-2 Happiness' },
        ],
        hiddenEffect: 'Your phone lasts until the call.',
      },
      {
        id: 'charge',
        text: 'Find a charging station (costs $2)',
        quickEffect: [
          { stat: 'money', amount: -2, label: '-$2' },
          { stat: 'happiness', amount: 5, label: '+5 Happiness' },
        ],
        hiddenEffect: 'Peace of mind is worth it.',
      },
    ],
    category: 'random',
  },
];

/**
 * Generate a life moment based on current state
 * 10% chance per week, guaranteed after 8 weeks without one
 */
export function generateLifeMoment(state: GameState): LifeMoment | null {
  // Don't generate if already have one pending
  if (state.lifeMoments?.pendingMoment) {
    return null;
  }
  
  const lastMomentWeek = state.lifeMoments?.lastMomentWeek || 0;
  const weeksSinceLastMoment = (state.weeksLived || 0) - lastMomentWeek;
  
  // Guaranteed moment after 8 weeks without one (pity system)
  const shouldGenerate = weeksSinceLastMoment >= 8 || Math.random() < 0.10;
  
  if (!shouldGenerate) {
    return null;
  }
  
  // Filter templates based on state
  const availableTemplates = LIFE_MOMENT_TEMPLATES.filter(template => {
    if (template.category === 'work' && !state.currentJob) return false;
    // Add more filters as needed
    return true;
  });
  
  if (availableTemplates.length === 0) return null;
  
  // Select random template
  const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
  
  return {
    ...template,
    id: `life_moment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
}

