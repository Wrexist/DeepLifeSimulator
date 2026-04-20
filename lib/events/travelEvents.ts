/**
 * Travel event templates — triggered when player is on a trip or just returned.
 * These add narrative depth to travel beyond flat stat bonuses.
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/GameContext';

function isOnTrip(state: GameState): boolean {
  return Boolean(state.travel?.currentTrip);
}

function getCurrentDestinationName(state: GameState): string {
  return state.travel?.currentTrip?.destinationId || 'your destination';
}

function hasVisitedCount(state: GameState): number {
  return (state.travel?.visitedDestinations || []).length;
}

// ─── Positive travel events ─────────────────────────────────────────

const localCuisineDiscovery: EventTemplate = {
  id: 'travel_local_cuisine',
  category: 'general',
  weight: 0.3,
  condition: isOnTrip,
  generate: (state) => {
    const dest = getCurrentDestinationName(state);
    return {
      id: 'travel_local_cuisine',
      description: `While exploring ${dest}, you discover an amazing local restaurant hidden down a side street. The aromas are incredible.`,
      choices: [
        {
          id: 'indulge',
          text: 'Try the tasting menu ($50)',
          effects: { money: -50, stats: { happiness: 15, health: 3 } },
        },
        {
          id: 'quick_bite',
          text: 'Grab something quick',
          effects: { stats: { happiness: 5 } },
        },
      ],
    };
  },
};

const travelFriendship: EventTemplate = {
  id: 'travel_friendship',
  category: 'relationship',
  weight: 0.2,
  condition: isOnTrip,
  generate: (state) => {
    const dest = getCurrentDestinationName(state);
    return {
      id: 'travel_friendship',
      description: `You meet a fellow traveler at ${dest}. You bond over shared experiences and exchange contacts.`,
      choices: [
        {
          id: 'stay_in_touch',
          text: 'Exchange numbers and stay connected',
          effects: { stats: { happiness: 10, reputation: 3 } },
          karma: { dimension: 'loyalty', amount: 1, reason: 'Made a genuine connection while traveling' },
        },
        {
          id: 'enjoy_moment',
          text: 'Enjoy the conversation and move on',
          effects: { stats: { happiness: 5 } },
        },
      ],
    };
  },
};

const breathtakingView: EventTemplate = {
  id: 'travel_breathtaking_view',
  category: 'general',
  weight: 0.25,
  condition: isOnTrip,
  generate: (state) => {
    const dest = getCurrentDestinationName(state);
    return {
      id: 'travel_breathtaking_view',
      description: `You stumble upon an incredible viewpoint at ${dest}. The panorama stretches for miles and you feel a profound sense of peace.`,
      choices: [
        {
          id: 'meditate',
          text: 'Sit and take it all in',
          effects: { stats: { happiness: 15, energy: 10, health: 5 } },
        },
        {
          id: 'photo',
          text: 'Take photos and share online',
          effects: { stats: { happiness: 10, reputation: 5 } },
        },
      ],
    };
  },
};

// ─── Negative travel events ─────────────────────────────────────────

const travelScam: EventTemplate = {
  id: 'travel_scam',
  category: 'economy',
  weight: 0.15,
  condition: isOnTrip,
  generate: (state) => {
    const dest = getCurrentDestinationName(state);
    return {
      id: 'travel_scam',
      description: `A street vendor at ${dest} tricks you into buying a "rare antique" that turns out to be worthless.`,
      choices: [
        {
          id: 'accept_loss',
          text: 'Chalk it up to a learning experience (-$100)',
          effects: { money: -100, stats: { happiness: -5 } },
        },
        {
          id: 'confront',
          text: 'Confront the vendor',
          effects: { money: Math.random() > 0.5 ? 0 : -100, stats: { happiness: -3, reputation: -2 } },
        },
      ],
    };
  },
};

const luggageLost: EventTemplate = {
  id: 'travel_luggage_lost',
  category: 'general',
  weight: 0.1,
  condition: isOnTrip,
  generate: () => ({
    id: 'travel_luggage_lost',
    description: 'The airline has lost your luggage! You\'re stuck with just what you\'re wearing.',
    choices: [
      {
        id: 'buy_essentials',
        text: 'Buy replacement essentials ($200)',
        effects: { money: -200, stats: { happiness: -5 } },
      },
      {
        id: 'wait',
        text: 'Wait and hope they find it',
        effects: { stats: { happiness: -10, energy: -5 } },
      },
    ],
  }),
};

const travelSick: EventTemplate = {
  id: 'travel_sickness',
  category: 'health',
  weight: 0.12,
  condition: isOnTrip,
  generate: (state) => {
    const dest = getCurrentDestinationName(state);
    return {
      id: 'travel_sickness',
      description: `You've fallen ill while in ${dest}. Probably something you ate. Your stomach is not happy.`,
      choices: [
        {
          id: 'rest',
          text: 'Stay in the hotel and rest',
          effects: { stats: { health: -5, energy: -10, happiness: -10 } },
        },
        {
          id: 'pharmacy',
          text: 'Find a local pharmacy ($75)',
          effects: { money: -75, stats: { health: -2, happiness: -3 } },
        },
      ],
    };
  },
};

const missedFlight: EventTemplate = {
  id: 'travel_missed_flight',
  category: 'economy',
  weight: 0.08,
  condition: isOnTrip,
  generate: () => ({
    id: 'travel_missed_flight',
    description: 'You overslept and missed your connecting flight! Now you need to figure out what to do.',
    choices: [
      {
        id: 'rebook',
        text: 'Book a new flight ($300)',
        effects: { money: -300, stats: { happiness: -10, energy: -5 } },
      },
      {
        id: 'wait_standby',
        text: 'Wait for standby (lose a day)',
        effects: { stats: { happiness: -5, energy: -15 } },
      },
    ],
  }),
};

// ─── Cultural experience events ─────────────────────────────────────

const culturalImmersion: EventTemplate = {
  id: 'travel_cultural_immersion',
  category: 'general',
  weight: 0.2,
  condition: isOnTrip,
  generate: (state) => {
    const dest = getCurrentDestinationName(state);
    return {
      id: 'travel_cultural_immersion',
      description: `A local at ${dest} invites you to join a traditional ceremony. It's a rare opportunity most tourists never get.`,
      choices: [
        {
          id: 'join',
          text: 'Accept the invitation',
          effects: { stats: { happiness: 20, reputation: 5 } },
          karma: { dimension: 'generosity', amount: 1, reason: 'Embraced local culture with respect' },
        },
        {
          id: 'politely_decline',
          text: 'Politely decline',
          effects: { stats: { happiness: -3 } },
        },
      ],
    };
  },
};

const souvenir: EventTemplate = {
  id: 'travel_souvenir',
  category: 'economy',
  weight: 0.2,
  condition: isOnTrip,
  generate: (state) => {
    const dest = getCurrentDestinationName(state);
    return {
      id: 'travel_souvenir',
      description: `You find a beautiful handcrafted souvenir at ${dest}. The artisan explains it took weeks to make.`,
      choices: [
        {
          id: 'buy',
          text: 'Buy it as a keepsake ($150)',
          effects: { money: -150, stats: { happiness: 10 } },
          karma: { dimension: 'generosity', amount: 1, reason: 'Supported local artisan' },
        },
        {
          id: 'haggle',
          text: 'Try to haggle the price down',
          effects: { money: -75, stats: { happiness: 5 } },
        },
        {
          id: 'pass',
          text: 'Admire but don\'t buy',
          effects: {},
        },
      ],
    };
  },
};

// ─── Seasoned traveler event ────────────────────────────────────────

const worldTravelerReflection: EventTemplate = {
  id: 'travel_world_reflection',
  category: 'general',
  weight: 0.15,
  condition: (state) => hasVisitedCount(state) >= 5,
  generate: (state) => {
    const count = hasVisitedCount(state);
    return {
      id: 'travel_world_reflection',
      description: `Having visited ${count} destinations, you reflect on how travel has changed you. You feel more worldly and open-minded than before.`,
      choices: [
        {
          id: 'write',
          text: 'Write about your experiences',
          effects: { stats: { happiness: 15, reputation: 5 } },
        },
        {
          id: 'plan_next',
          text: 'Start planning your next adventure',
          effects: { stats: { happiness: 10, energy: 5 } },
        },
      ],
    };
  },
};

export const travelEventTemplates: EventTemplate[] = [
  localCuisineDiscovery,
  travelFriendship,
  breathtakingView,
  travelScam,
  luggageLost,
  travelSick,
  missedFlight,
  culturalImmersion,
  souvenir,
  worldTravelerReflection,
];
