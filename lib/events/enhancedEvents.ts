import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';

/**
 * Friend invitation before exam - classic tradeoff
 */
export const friendInvitationExam: EventTemplate = {
  id: 'friend_invitation_exam',
  category: 'relationship',
  weight: 0.4,
  condition: (state: GameState) => {
    // Only trigger if player has relationships and is in education
    return (state.relationships || []).length > 0 && 
           (state.educations || []).some(e => !e.completed);
  },
  generate: (state: GameState) => ({
    id: 'friend_invitation_exam',
    description: 'Your friend invites you out tonight, but you have an important exam tomorrow.',
    choices: [
      {
        id: 'go_out',
        text: 'Go out with your friend',
        effects: {
          stats: { happiness: 15, energy: -20 },
          relationship: 10,
        },
        tradeoffs: {
          gain: [
            { stat: 'happiness', amount: 15, label: '+15 Happiness' },
            { stat: 'relationship', amount: 10, label: '+10 Relationship' },
          ],
          lose: [
            { stat: 'energy', amount: 20, label: '-20 Energy' },
            { stat: 'exam', amount: 0, label: 'Worse exam performance' },
          ],
        },
        hiddenConsequences: [
          {
            type: 'unlock_event',
            targetEventId: 'friend_helps_study',
            weeksUntilActive: 2,
            description: 'Your friend remembers your sacrifice and offers to help you study.',
          },
          /**
           * R4-X6. A `modify_weight` of -0.3 on `exam_results` used to sit
           * here. It was inert twice over: no `exam_results` template has ever
           * existed, and `weightPayoffReady` only fires on a POSITIVE modifier,
           * so it could not have gated anything even if one did.
           *
           * Removed rather than given a template, because the effect it wanted
           * is already delivered — and delivered properly. The choice costs 20
           * energy, and `runExam` reads energy directly (`< 30` is -10% pass
           * chance). "Worse exam performance", which this choice's own tradeoff
           * card promises the player, is the energy cost doing its job. This
           * was a second, non-functional attempt at the same thing.
           */
        ],
        emotionalImpact: 'medium',
        createsMemory: true,
        memoryText: 'You chose friendship over studying. Your friend was grateful.',
      },
      {
        id: 'study',
        text: 'Stay home and study',
        effects: {
          stats: { happiness: -5, energy: -10 },
          relationship: -5,
        },
        tradeoffs: {
          gain: [
            { stat: 'exam', amount: 0, label: 'Better exam performance' },
            { stat: 'energy', amount: 0, label: 'More rest' },
          ],
          lose: [
            { stat: 'happiness', amount: 5, label: '-5 Happiness' },
            { stat: 'relationship', amount: 5, label: '-5 Relationship' },
          ],
        },
        hiddenConsequences: [
          {
            type: 'unlock_event',
            targetEventId: 'exam_success',
            weeksUntilActive: 1,
            description: 'Your dedication paid off with excellent exam results.',
          },
          {
            type: 'modify_weight',
            targetEventId: 'friend_distant',
            weightModifier: 0.2, // Slightly more likely friend feels distant
          },
        ],
        emotionalImpact: 'low',
        createsMemory: true,
        memoryText: 'You prioritized your studies. Your future self will thank you.',
      },
      {
        id: 'compromise',
        text: 'Quick coffee, then study',
        effects: {
          stats: { happiness: 5, energy: -15 },
          relationship: 3,
        },
        tradeoffs: {
          gain: [
            { stat: 'happiness', amount: 5, label: '+5 Happiness' },
            { stat: 'relationship', amount: 3, label: '+3 Relationship' },
          ],
          lose: [
            { stat: 'energy', amount: 15, label: '-15 Energy' },
          ],
        },
        hiddenConsequences: [
          {
            type: 'unlock_event',
            targetEventId: 'friend_respects_balance',
            weeksUntilActive: 3,
            description: 'Your friend admires your ability to balance life and studies.',
          },
        ],
        emotionalImpact: 'low',
        createsMemory: true,
        memoryText: 'You found a balance. Both your friend and your studies mattered.',
      },
    ],
  }),
};

// Export array of enhanced events to add to eventTemplates
export const enhancedEventTemplates: EventTemplate[] = [
  friendInvitationExam,
  // Add more enhanced events as needed
];

