import type { GameState, GameStats } from '@/contexts/GameContext';
import { marketCrash, sideGig, earningsReport } from './economy';

export interface EventChoiceEffects {
  money?: number;
  stats?: Partial<GameStats>;
  relationship?: number; // change to specific relation if relationId provided
  pet?: { hunger?: number; happiness?: number; health?: number };
}

export interface EventChoice {
  id: string;
  text: string;
  effects: EventChoiceEffects;
}

export interface WeeklyEvent {
  id: string;
  description: string;
  choices: EventChoice[];
  relationId?: string;
}

export interface EventTemplate {
  id: string;
  category: 'economy' | 'health' | 'relationship' | 'general';
  weight: number | ((state: GameState) => number);
  condition?: (state: GameState) => boolean;
  generate: (state: GameState) => WeeklyEvent;
}

const jobBonus: EventTemplate = {
  id: 'job_bonus',
  category: 'economy',
  weight: 0.3,
  generate: () => ({
    id: 'job_bonus',
    description: 'Your boss offers a bonus for extra work hours.',
    choices: [
      {
        id: 'accept',
        text: 'Accept the extra work',
        effects: { money: 100, stats: { energy: -10, happiness: -5, reputation: 5 } },
      },
      {
        id: 'decline',
        text: 'Decline the offer',
        effects: { stats: { reputation: -2 } },
      },
    ],
  }),
};

const sickDay: EventTemplate = {
  id: 'sick_day',
  category: 'health',
  weight: 0.5,
  generate: () => ({
    id: 'sick_day',
    description: 'You wake up feeling ill. What do you do?',
    choices: [
      { id: 'rest', text: 'Take a sick day', effects: { money: -50, stats: { health: 20, happiness: 5 } } },
      { id: 'work', text: 'Push through and work', effects: { money: 50, stats: { health: -15, happiness: -5 } } },
    ],
  }),
};

const unexpectedBill: EventTemplate = {
  id: 'unexpected_bill',
  category: 'economy',
  weight: 0.5,
  generate: () => ({
    id: 'unexpected_bill',
    description: 'An unexpected bill for $75 arrives.',
    choices: [
      { id: 'pay', text: 'Pay it immediately', effects: { money: -75 } },
      { id: 'delay', text: 'Delay payment', effects: { stats: { reputation: -5, happiness: -5 } } },
    ],
  }),
};

const lotteryWin: EventTemplate = {
  id: 'lottery_win',
  category: 'economy',
  weight: 0.2,
  generate: () => ({
    id: 'lottery_win',
    description: 'You win $200 in a local lottery!',
    choices: [
      { id: 'save', text: 'Save the money', effects: { money: 200 } },
      { id: 'spend', text: 'Throw a party', effects: { money: 100, stats: { happiness: 15 } } },
    ],
  }),
};

const burglary: EventTemplate = {
  id: 'burglary',
  category: 'economy',
  weight: (state: GameState) => (state.realEstate.some(r => r.owned) ? 0.1 : 0.4),
  generate: () => ({
    id: 'burglary',
    description: 'A burglary occurs at your place.',
    choices: [
      { id: 'police', text: 'Call the police', effects: { money: -20, stats: { reputation: 5 } } },
      { id: 'ignore', text: 'Do nothing', effects: { money: -100, stats: { happiness: -10 } } },
    ],
  }),
};

const policeRaid: EventTemplate = {
  id: 'police_raid',
  category: 'general',
  weight: 0.3,
  condition: state => state.wantedLevel > 0,
  generate: () => ({
    id: 'police_raid',
    description: 'Police raid your hideout.',
    choices: [
      { id: 'run', text: 'Attempt to run', effects: { stats: { energy: -10 } } },
      { id: 'surrender', text: 'Surrender', effects: { stats: { reputation: -5 } } },
    ],
  }),
};

const courtTrial: EventTemplate = {
  id: 'court_trial',
  category: 'general',
  weight: 0.2,
  condition: state => state.wantedLevel > 0 || state.jailWeeks > 0,
  generate: () => ({
    id: 'court_trial',
    description: 'You are summoned for a court trial.',
    choices: [
      { id: 'plead', text: 'Plead guilty', effects: { money: -100 } },
      { id: 'fight', text: 'Fight the case', effects: { money: -200 } },
    ],
  }),
};

const friendNeedsHelp: EventTemplate = {
  id: 'friend_help',
  category: 'relationship',
  weight: 0.5,
  condition: state => state.relationships.length > 0,
  generate: state => {
    const friend = state.relationships[Math.floor(Math.random() * state.relationships.length)];
    return {
      id: 'friend_help',
      description: `${friend.name} asks to borrow $50.`,
      relationId: friend.id,
      choices: [
        { id: 'lend', text: 'Lend the money', effects: { money: -50, relationship: 10, stats: { happiness: 5 } } },
        { id: 'refuse', text: 'Refuse', effects: { relationship: -10, stats: { happiness: -5 } } },
      ],
    };
  },
};

const weddingEvent: EventTemplate = {
  id: 'wedding',
  category: 'relationship',
  weight: 0.2,
  // Only allow wedding consideration after week 36 and if a partner exists
  condition: state => (state.week ?? state.date?.week ?? 0) >= 36 && state.relationships.some(r => r.type === 'partner'),
  generate: state => {
    const partner = state.relationships.find(r => r.type === 'partner')!;
    return {
      id: 'wedding',
      description: `You consider marrying ${partner.name}.` ,
      relationId: partner.id,
      choices: [
        { id: 'marry', text: 'Plan wedding ($2000)', effects: { money: -2000, relationship: 20, stats: { happiness: 15 } } },
        { id: 'wait', text: 'Wait for now', effects: { relationship: -10, stats: { happiness: -5 } } },
      ],
    };
  },
};

const schoolFees: EventTemplate = {
  id: 'school_fees',
  category: 'economy',
  weight: 0.3,
  condition: state => state.family?.children?.length > 0,
  generate: state => {
    const child = state.family.children[Math.floor(Math.random() * state.family.children.length)];
    return {
      id: 'school_fees',
      description: `${child.name}'s school fees of $100 are due.`,
      relationId: child.id,
      choices: [
        { id: 'pay', text: 'Pay fees', effects: { money: -100, relationship: 5, stats: { happiness: 5 } } },
        { id: 'skip', text: 'Skip payment', effects: { relationship: -15, stats: { happiness: -5 } } },
      ],
    };
  },
};

const carBreakdown: EventTemplate = {
  id: 'car_breakdown',
  category: 'economy',
  weight: 0.2,
  generate: () => ({
    id: 'car_breakdown',
    description: 'Your car breaks down on the way to work.',
    choices: [
      { id: 'repair', text: 'Pay $100 for repairs', effects: { money: -100, stats: { happiness: -5 } } },
      { id: 'fix', text: 'Try to fix it yourself', effects: { money: -20, stats: { health: -5, happiness: 5 } } },
    ],
  }),
};

const foundWallet: EventTemplate = {
  id: 'found_wallet',
  category: 'general',
  weight: 0.2,
  generate: () => ({
    id: 'found_wallet',
    description: 'You find a wallet on the street.',
    choices: [
      { id: 'keep', text: 'Keep the cash', effects: { money: 40, stats: { reputation: -10 } } },
      { id: 'return', text: 'Return it to the owner', effects: { stats: { reputation: 10, happiness: 5 } } },
    ],
  }),
};

const charityEvent: EventTemplate = {
  id: 'charity_event',
  category: 'relationship',
  weight: 0.3,
  generate: () => ({
    id: 'charity_event',
    description: 'A charity asks for a $30 donation.',
    choices: [
      { id: 'donate', text: 'Donate', effects: { money: -30, stats: { reputation: 10, happiness: 5 } } },
      { id: 'decline', text: 'Decline', effects: { stats: { reputation: -5 } } },
    ],
  }),
};

const gymInvitation: EventTemplate = {
  id: 'gym_invite',
  category: 'health',
  weight: 0.3,
  condition: state => state.relationships.length > 0,
  generate: state => {
    const friend = state.relationships[Math.floor(Math.random() * state.relationships.length)];
    return {
      id: 'gym_invite',
      description: `${friend.name} invites you to join a gym session for $20.`,
      relationId: friend.id,
      choices: [
        { id: 'join', text: 'Join the session', effects: { money: -20, stats: { health: 10, happiness: 5 }, relationship: 5 } },
        { id: 'skip', text: 'Skip it', effects: { relationship: -5 } },
      ],
    };
  },
};

const streetFestival: EventTemplate = {
  id: 'street_festival',
  category: 'general',
  weight: 0.4,
  generate: () => ({
    id: 'street_festival',
    description: 'A street festival is happening this weekend.',
    choices: [
      { id: 'attend', text: 'Attend the festival', effects: { money: -20, stats: { happiness: 10 } } },
      { id: 'skip', text: 'Skip it', effects: { stats: { happiness: -5 } } },
    ],
  }),
};

const fluShot: EventTemplate = {
  id: 'flu_shot',
  category: 'health',
  weight: 0.3,
  generate: () => ({
    id: 'flu_shot',
    description: 'A local clinic offers flu shots for $25.',
    choices: [
      { id: 'take', text: 'Get the shot', effects: { money: -25, stats: { health: 15 } } },
      { id: 'decline', text: 'Skip it', effects: { stats: { health: -10 } } },
    ],
  }),
};
const homeMaintenance: EventTemplate = {
  id: 'home_maintenance',
  category: 'economy',
  weight: 0.4,
  condition: state => state.realEstate.some(r => r.owned),
  generate: () => ({
    id: 'home_maintenance',
    description: 'A leaky pipe requires a $75 repair.',
    choices: [
      { id: 'fix', text: 'Pay for repairs', effects: { money: -75, stats: { happiness: 5 } } },
      { id: 'ignore', text: 'Ignore it', effects: { stats: { happiness: -5 } } },
    ],
  }),
};

const decorContest: EventTemplate = {
  id: 'decor_contest',
  category: 'general',
  weight: 0.3,
  condition: state => state.realEstate.some(r => r.owned),
  generate: () => ({
    id: 'decor_contest',
    description: 'Your neighborhood hosts a decoration contest.',
    choices: [
      { id: 'enter', text: 'Buy decorations for $50', effects: { money: -50, stats: { reputation: 10, happiness: 5 } } },
      { id: 'skip', text: 'Skip the contest', effects: {} },
    ],
  }),
};

const petIllness: EventTemplate = {
  id: 'pet_illness',
  category: 'general',
  weight: 0.3,
  condition: state => state.pets.length > 0,
  generate: state => {
    const pet = state.pets[Math.floor(Math.random() * state.pets.length)];
    return {
      id: 'pet_illness',
      description: `${pet.name} seems ill. What do you do?`,
      relationId: pet.id,
      choices: [
        {
          id: 'vet',
          text: 'Visit the vet ($50)',
          effects: { money: -50, pet: { health: 20, happiness: 5 } },
        },
        {
          id: 'wait',
          text: 'Wait and see',
          effects: { pet: { health: -20, happiness: -10 } },
        },
      ],
    };
  },
};

const petContest: EventTemplate = {
  id: 'pet_contest',
  category: 'general',
  weight: 0.2,
  condition: state => state.pets.some(p => p.happiness > 60),
  generate: state => {
    const candidates = state.pets.filter(p => p.happiness > 60);
    const pet = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      id: 'pet_contest',
      description: `A local contest invites ${pet.name}.`,
      relationId: pet.id,
      choices: [
        { id: 'enter', text: 'Enter contest', effects: { money: 100, pet: { happiness: 15 } } },
        { id: 'skip', text: 'Skip', effects: {} },
      ],
    };
  },
};

const careerSpotlight: EventTemplate = {
  id: 'career_spotlight',
  category: 'economy',
  weight: 0.3,
  condition: state => ['politician', 'celebrity', 'athlete'].includes(state.currentJob || ''),
  generate: () => ({
    id: 'career_spotlight',
    description: 'A special opportunity arises in your career.',
    choices: [
      { id: 'embrace', text: 'Embrace it', effects: { stats: { reputation: 10, happiness: 5 } } },
      { id: 'avoid', text: 'Avoid attention', effects: { stats: { reputation: -5 } } },
    ],
  }),
};

export const eventTemplates: EventTemplate[] = [
  jobBonus,
  sickDay,
  unexpectedBill,
  lotteryWin,
  burglary,
  policeRaid,
  courtTrial,
  friendNeedsHelp,
  weddingEvent,
  schoolFees,
  carBreakdown,
  foundWallet,
  charityEvent,
  gymInvitation,
  streetFestival,
  fluShot,
  homeMaintenance,
  decorContest,
  petIllness,
  petContest,
  marketCrash,
  sideGig,
  earningsReport,
  careerSpotlight,
];

const MAX_EVENTS_PER_WEEK = 2;
const EVENT_FREQUENCY_MODIFIER = 0.25; // 25% base chance (1 in 4 weeks)

/**
 * Weekly Event System:
 * - Events now occur randomly with approximately 1 in 4 weeks frequency (20-30% chance)
 * - This makes events feel more natural and less predictable
 * - Players will experience periods of calm followed by eventful weeks
 * - The base chance varies slightly each week for more realistic randomness
 */

export function rollWeeklyEvents(state: GameState): WeeklyEvent[] {
  // Base random chance for any event to occur (approximately 1 in 4 weeks)
  // Add some variation: 20-30% chance to make it feel more natural
  const baseEventChance = 0.2 + (Math.random() * 0.1); // 20-30% chance
  if (Math.random() > baseEventChance) {
    return []; // No events this week
  }

  const economyRisk = state.stats.money < 200 ? 0.6 : 0.2;
  const healthRisk = state.stats.health < 60 ? 0.6 : 0.2;
  const avgRelation =
    state.relationships.length > 0
      ? state.relationships.reduce((sum, r) => sum + r.relationshipScore, 0) / state.relationships.length
      : 50;
  const relationRisk = avgRelation < 50 ? 0.5 : 0.2;

  const riskByCategory = {
    economy: economyRisk,
    health: healthRisk,
    relationship: relationRisk,
    general: 0.3,
  } as const;

  const events: WeeklyEvent[] = [];

  for (const template of eventTemplates) {
    if (events.length >= MAX_EVENTS_PER_WEEK) break;
    if (template.condition && !template.condition(state)) continue;
    const weight = typeof template.weight === 'function' ? template.weight(state) : template.weight;
    const chance = weight * riskByCategory[template.category] * EVENT_FREQUENCY_MODIFIER;
    if (Math.random() < chance) {
      events.push(template.generate(state));
    }
  }

  return events;
}

