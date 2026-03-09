import type { GameState, GameStats } from '@/contexts/GameContext';
import { marketCrash, sideGig, earningsReport } from './economy';
import { getSeasonalEvents } from './seasonalEvents';
import { economyEventTemplates, shouldTriggerEconomicEvent, generateEconomicEvent, getCurrentEconomicState } from './economyEvents';
import { personalCrisisEventTemplates } from './personalCrises';
import { enhancedEventTemplates } from './enhancedEvents';
import { lifeMilestoneEventTemplates } from './lifeMilestoneEvents';
import { careerEventTemplates } from './careerEvents';
import { travelEventTemplates } from './travelEvents';
import { nearMissEventTemplates } from './nearMissEvents';
import { fameEventTemplates } from './fameEvents';
import { secretEventTemplates } from './secretEvents';
import { POLICIES } from '@/lib/politics/policies';
import { getEventFrequencyModifier } from '@/lib/prestige/applyQOLBonuses';
import { logger } from '@/utils/logger';
import type { KarmaDimension } from '@/lib/karma/karmaSystem';

export interface EventChoiceEffects {
  money?: number;
  stats?: Partial<GameStats>;
  relationship?: number; // change to specific relation if relationId provided
  pet?: { hunger?: number; happiness?: number; health?: number };
  policy?: string; // Policy ID that gets enacted
  approvalRating?: number; // Change to political approval rating
  policyInfluence?: number; // Change to policy influence
  /** Karma change applied when this choice is selected */
  karma?: { dimension: KarmaDimension; amount: number; reason: string };
}

export interface EventChoice {
  id: string;
  text: string;
  effects: EventChoiceEffects;
  special?: string; // STABILITY FIX: Special effects (e.g., 'grant_free_education', 'add_disease')
  followUpEventId?: string; // ID of follow-up event to trigger after this choice
  chainId?: string; // ID of event chain this choice continues
  diseaseId?: string; // Disease ID to add when special === 'add_disease'
}

/**
 * Enhanced event choice with tradeoffs and hidden consequences
 * Extends the base EventChoice interface
 */
export interface EnhancedEventChoice extends EventChoice {
  // Visual tradeoff indicators (shown in UI)
  tradeoffs?: {
    gain: Array<{ stat: string; amount: number; label: string }>;
    lose: Array<{ stat: string; amount: number; label: string }>;
  };
  // Hidden consequences (long-term effects)
  hiddenConsequences?: Array<Omit<import('@/lib/lifeMoments/types').HiddenConsequence, 'id' | 'eventId' | 'choiceId' | 'active' | 'weeksSinceCreated' | 'createdAt'>>;
  // Emotional weight indicator
  emotionalImpact?: 'low' | 'medium' | 'high';
  // Memory creation
  createsMemory?: boolean;
  memoryText?: string;
}

export interface WeeklyEvent {
  id: string;
  description: string;
  choices: EventChoice[];
  relationId?: string;
  chainId?: string; // ID of event chain this belongs to
  chainStage?: number; // Stage number in the chain (0-based)
  followUpEventId?: string; // ID of follow-up event to trigger after choice
  generatedAtWeeksLived?: number; // Absolute week generated; used for persistence hygiene
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
  weight: (state: GameState) => ((state.realEstate || []).some(r => r.owned) ? 0.1 : 0.4),
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
  condition: state => state.relationships?.length > 0,
  generate: state => {
    if (!state.relationships?.length) return { id: 'friend_help', description: 'A friend reaches out.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    const friend = state.relationships[Math.floor(Math.random() * state.relationships.length)];
    return {
      id: 'friend_help',
      description: `${friend.name} asks to borrow $50.`,
      relationId: friend.id,
      choices: [
        { id: 'lend', text: 'Lend the money', effects: { money: -50, relationship: 10, stats: { happiness: 5 }, karma: { dimension: 'generosity', amount: 4, reason: 'Helped a friend in need' } } },
        { id: 'refuse', text: 'Refuse', effects: { relationship: -10, stats: { happiness: -5 }, karma: { dimension: 'generosity', amount: -3, reason: 'Refused to help a friend' } } },
      ],
    };
  },
};

const weddingEvent: EventTemplate = {
  id: 'wedding',
  category: 'relationship',
  weight: 0.2,
  // Only allow wedding consideration after week 36 and if a partner exists
  // TESTFLIGHT FIX: Use weeksLived for deterministic behavior (week 1-4 resets monthly)
  condition: state => (state.weeksLived || 0) >= 36 && state.relationships?.some(r => r.type === 'partner'),
  generate: state => {
    const partner = state.relationships?.find(r => r.type === 'partner');
    if (!partner) return { id: 'wedding', description: 'You think about the future.', choices: [{ id: 'wait', text: 'Continue', effects: {} }] };
    return {
      id: 'wedding',
      description: `You consider marrying ${partner.name}.`,
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
    const children = state.family?.children;
    if (!children?.length) return { id: 'school_fees', description: 'School fees are due.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    const child = children[Math.floor(Math.random() * children.length)];
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
      { id: 'keep', text: 'Keep the cash', effects: { money: 40, stats: { reputation: -10 }, karma: { dimension: 'honesty', amount: -5, reason: 'Kept a found wallet' } } },
      { id: 'return', text: 'Return it to the owner', effects: { stats: { reputation: 10, happiness: 5 }, karma: { dimension: 'honesty', amount: 5, reason: 'Returned a found wallet' } } },
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
      { id: 'donate', text: 'Donate', effects: { money: -30, stats: { reputation: 10, happiness: 5 }, karma: { dimension: 'generosity', amount: 5, reason: 'Donated to charity' } } },
      { id: 'decline', text: 'Decline', effects: { stats: { reputation: -5 }, karma: { dimension: 'generosity', amount: -2, reason: 'Declined a charity appeal' } } },
    ],
  }),
};

const gymInvitation: EventTemplate = {
  id: 'gym_invite',
  category: 'health',
  weight: 0.3,
  condition: state => state.relationships?.length > 0,
  generate: state => {
    if (!state.relationships?.length) return { id: 'gym_invite', description: 'A friend invites you to the gym.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
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
  condition: state => state.pets?.length > 0,
  generate: state => {
    if (!state.pets?.length) return { id: 'pet_illness', description: 'You hear about a sick animal.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
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
  condition: state => state.pets?.some(p => p.happiness > 60),
  generate: state => {
    const candidates = (state.pets || []).filter(p => p.happiness > 60);
    if (!candidates.length) return { id: 'pet_contest', description: 'A local contest is happening.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
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

// Political Events
const politicalScandal: EventTemplate = {
  id: 'political_scandal',
  category: 'general',
  weight: 0.2,
  condition: state => Boolean(state.politics && state.politics.careerLevel > 0),
  generate: () => ({
    id: 'political_scandal',
    description: 'A political scandal threatens your reputation. How do you respond?',
    choices: [
      { id: 'deny', text: 'Deny allegations', effects: { stats: { reputation: -15 } } },
      { id: 'address', text: 'Address it publicly', effects: { money: -5000, stats: { reputation: 5 } } },
      { id: 'hire_lawyer', text: 'Hire legal team', effects: { money: -10000, stats: { reputation: 0 } } },
    ],
  }),
};

const electionCampaign: EventTemplate = {
  id: 'election_campaign',
  category: 'economy',
  weight: 0.4,
  // TESTFLIGHT FIX: Use weeksLived for deterministic behavior (nextElectionWeek is continuous, not 1-4)
  condition: state => Boolean(state.politics && state.politics.careerLevel > 0 && state.politics.nextElectionWeek && (state.weeksLived || 0) >= state.politics.nextElectionWeek - 4),
  generate: () => ({
    id: 'election_campaign',
    description: 'Election season is approaching! Time to ramp up your campaign efforts.',
    choices: [
      { id: 'big_rally', text: 'Hold a big rally', effects: { money: -15000, stats: { reputation: 8 } } },
      { id: 'tv_ads', text: 'Run TV advertisements', effects: { money: -10000, stats: { reputation: 5 } } },
      { id: 'door_knocking', text: 'Go door-to-door', effects: { stats: { reputation: 3, energy: -20 } } },
      { id: 'skip', text: 'Skip this week', effects: {} },
    ],
  }),
};

const policyProposal: EventTemplate = {
  id: 'policy_proposal',
  category: 'economy',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 1),
  generate: () => ({
    id: 'policy_proposal',
    description: 'A new policy proposal comes across your desk. Support it?',
    choices: [
      { id: 'support', text: 'Support the policy', effects: { stats: { reputation: 5 } } },
      { id: 'oppose', text: 'Oppose the policy', effects: { stats: { reputation: -3 } } },
      { id: 'abstain', text: 'Abstain from voting', effects: {} },
    ],
  }),
};

const partyMeeting: EventTemplate = {
  id: 'party_meeting',
  category: 'general',
  weight: 0.25,
  condition: state => Boolean(state.politics && state.politics.party),
  generate: state => ({
    id: 'party_meeting',
    description: `Your ${state.politics?.party === 'democratic' ? 'Democratic' : state.politics?.party === 'republican' ? 'Republican' : 'Independent'} party holds a meeting.`,
    choices: [
      { id: 'attend', text: 'Attend the meeting', effects: { stats: { reputation: 5 } } },
      { id: 'skip', text: 'Skip the meeting', effects: { stats: { reputation: -2 } } },
    ],
  }),
};

const mediaInterview: EventTemplate = {
  id: 'media_interview',
  category: 'general',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2),
  generate: () => ({
    id: 'media_interview',
    description: 'A major news outlet wants to interview you about your political views.',
    choices: [
      { id: 'accept', text: 'Accept the interview', effects: { stats: { reputation: 13 } } },
      { id: 'decline', text: 'Decline politely', effects: { stats: { reputation: -2 } } },
    ],
  }),
};

const constituentComplaint: EventTemplate = {
  id: 'constituent_complaint',
  category: 'general',
  weight: 0.35,
  condition: state => Boolean(state.politics && state.politics.careerLevel > 0),
  generate: () => ({
    id: 'constituent_complaint',
    description: 'A group of constituents files a complaint about a local issue.',
    choices: [
      { id: 'address', text: 'Address their concerns', effects: { money: -2000, stats: { reputation: 12 } } },
      { id: 'ignore', text: 'Ignore the complaint', effects: { stats: { reputation: -8 } } },
      { id: 'delegate', text: 'Delegate to staff', effects: { money: -500, stats: { reputation: 2 } } },
    ],
  }),
};

const lobbyistOffer: EventTemplate = {
  id: 'lobbyist_offer',
  category: 'economy',
  weight: 0.2,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 1),
  generate: () => ({
    id: 'lobbyist_offer',
    description: 'A powerful lobbyist offers to support your campaign in exchange for policy favors.',
    choices: [
      { id: 'accept', text: 'Accept the offer', effects: { money: 20000, stats: { reputation: -15 } } },
      { id: 'decline', text: 'Decline the offer', effects: { stats: { reputation: 13 } } },
    ],
  }),
};

const politicalDebate: EventTemplate = {
  id: 'political_debate',
  category: 'general',
  weight: 0.15,
  // TESTFLIGHT FIX: Use weeksLived for deterministic behavior (nextElectionWeek is continuous, not 1-4)
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.nextElectionWeek && (state.weeksLived || 0) >= state.politics.nextElectionWeek - 2),
  generate: () => ({
    id: 'political_debate',
    description: 'A televised political debate is scheduled. Your opponent is well-prepared.',
    choices: [
      { id: 'prepare', text: 'Prepare extensively', effects: { money: -5000, stats: { reputation: 18 } } },
      { id: 'wing_it', text: 'Wing it', effects: { stats: { reputation: -13 } } },
      { id: 'skip', text: 'Skip the debate', effects: { stats: { reputation: -25 } } },
    ],
  }),
};

const coalitionFormation: EventTemplate = {
  id: 'coalition_formation',
  category: 'general',
  weight: 0.2,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 3 && state.politics.alliances && state.politics.alliances.length > 0),
  generate: () => ({
    id: 'coalition_formation',
    description: 'Your political allies propose forming a coalition to push through major legislation.',
    choices: [
      { id: 'join', text: 'Join the coalition', effects: { stats: { reputation: 18 } } },
      { id: 'decline', text: 'Decline to join', effects: { stats: { reputation: -3 } } },
    ],
  }),
};

const publicProtest: EventTemplate = {
  id: 'public_protest',
  category: 'general',
  weight: 0.25,
  condition: state => Boolean(state.politics && state.politics.careerLevel > 0 && state.politics.approvalRating && state.politics.approvalRating < 40 && state.stats.reputation < 50),
  generate: () => ({
    id: 'public_protest',
    description: 'A public protest forms outside your office demanding policy changes.',
    choices: [
      { id: 'meet', text: 'Meet with protesters', effects: { stats: { reputation: 13 } } },
      { id: 'ignore', text: 'Ignore the protest', effects: { stats: { reputation: -18 } } },
      { id: 'police', text: 'Call security', effects: { money: -1000, stats: { reputation: -15 } } },
    ],
  }),
};

// Policy Voting Events - Random policies come up for party voting
const policyVotingEvent: EventTemplate = {
  id: 'policy_voting',
  category: 'general',
  weight: 0.4,
  condition: state => {
    if (!state.politics || state.politics.careerLevel < 1) return false;
    const careerLevel = state.politics.careerLevel;
    const availablePolicies = POLICIES.filter(p => p.requiredLevel <= careerLevel);
    return availablePolicies.length > 0;
  },
  generate: (state) => {
    const politics = state.politics!;
    const careerLevel = politics.careerLevel;

    // Get available policies for voting
    const availablePolicies = POLICIES.filter(p => p.requiredLevel <= careerLevel);
    if (availablePolicies.length === 0) {
      // Fallback event if somehow no policies available
      return {
        id: 'policy_voting',
        description: 'No policies are currently available for voting.',
        choices: [
          { id: 'ok', text: 'OK', effects: {} },
        ],
      };
    }

    // Pick a random policy
    const policy = availablePolicies[Math.floor(Math.random() * availablePolicies.length)];

    // Determine party preferences based on policy type
    const playerParty = politics.party || 'independent';
    let democraticSupport = 50;
    let republicanSupport = 50;

    // Party preferences by policy type
    if (policy.type === 'economic') {
      if (policy.approvalImpact > 0) {
        democraticSupport = 60;
        republicanSupport = 40;
      } else {
        democraticSupport = 40;
        republicanSupport = 60;
      }
    } else if (policy.type === 'social') {
      democraticSupport = 70;
      republicanSupport = 30;
    } else if (policy.type === 'environmental') {
      democraticSupport = 75;
      republicanSupport = 25;
    } else if (policy.type === 'criminal') {
      democraticSupport = 45;
      republicanSupport = 55;
    }

    // Add randomness
    democraticSupport += (Math.random() - 0.5) * 20;
    republicanSupport += (Math.random() - 0.5) * 20;
    democraticSupport = Math.max(0, Math.min(100, democraticSupport));
    republicanSupport = Math.max(0, Math.min(100, republicanSupport));

    // Calculate if policy passes (needs >50% support from majority party)
    const majoritySupport = playerParty === 'democratic' ? democraticSupport :
      playerParty === 'republican' ? republicanSupport :
        (democraticSupport + republicanSupport) / 2;
    const willPass = majoritySupport > 50;

    const policyEffects = policy.effects;
    const approvalChange = policy.approvalImpact;

    return {
      id: 'policy_voting',
      description: `A vote on "${policy.name}" is scheduled. ${policy.description} The ${playerParty === 'democratic' ? 'Democratic' : playerParty === 'republican' ? 'Republican' : 'Independent'} party ${willPass ? 'supports' : 'opposes'} this policy (${Math.round(majoritySupport)}% support).`,
      choices: [
        {
          id: 'vote_yes',
          text: `Vote Yes ${willPass ? '(Will Pass)' : '(Will Fail)'}`,
          effects: {
            policy: policy.id,
            approvalRating: willPass ? approvalChange : approvalChange - 10,
            stats: willPass ? {
              money: policyEffects.money || 0,
              happiness: policyEffects.happiness || 0,
              health: policyEffects.health || 0,
              reputation: (policyEffects.reputation || 0) + (willPass ? 5 : -5),
            } : { reputation: -5 },
          }
        },
        {
          id: 'vote_no',
          text: `Vote No ${willPass ? '(Will Pass Anyway)' : '(Will Fail)'}`,
          effects: {
            approvalRating: willPass ? -approvalChange : -approvalChange + 10,
            stats: {
              reputation: willPass ? -10 : 5,
            },
          }
        },
        {
          id: 'abstain',
          text: 'Abstain from Voting',
          effects: {
            approvalRating: -5,
            stats: { reputation: -2 },
          }
        },
      ],
    };
  },
};

// More Political Events
const budgetCrisis: EventTemplate = {
  id: 'budget_crisis',
  category: 'economy',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2),
  generate: () => ({
    id: 'budget_crisis',
    description: 'A budget crisis threatens to shut down government services. How do you respond?',
    choices: [
      { id: 'cut_spending', text: 'Cut spending', effects: { money: 50000, stats: { reputation: -15, happiness: -10 } } },
      { id: 'raise_taxes', text: 'Raise taxes', effects: { money: 100000, stats: { reputation: -20, happiness: -15 } } },
      { id: 'borrow', text: 'Borrow money', effects: { money: 75000, stats: { reputation: -5 } } },
    ],
  }),
};

const corruptionInvestigation: EventTemplate = {
  id: 'corruption_investigation',
  category: 'general',
  weight: 0.15,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2),
  generate: () => ({
    id: 'corruption_investigation',
    description: 'An investigation into political corruption begins. You may be implicated.',
    choices: [
      { id: 'cooperate', text: 'Fully cooperate', effects: { money: -10000, stats: { reputation: 10 } } },
      { id: 'lawyer', text: 'Hire expensive lawyer', effects: { money: -50000, stats: { reputation: 0 } } },
      { id: 'deny', text: 'Deny everything', effects: { stats: { reputation: -25 } } },
    ],
  }),
};

const internationalSummit: EventTemplate = {
  id: 'international_summit',
  category: 'general',
  weight: 0.2,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 4),
  generate: () => ({
    id: 'international_summit',
    description: 'You are invited to an international political summit.',
    choices: [
      { id: 'attend', text: 'Attend the summit', effects: { money: -20000, stats: { reputation: 25 } } },
      { id: 'decline', text: 'Decline invitation', effects: { stats: { reputation: -10 } } },
    ],
  }),
};

const whistleblower: EventTemplate = {
  id: 'whistleblower',
  category: 'general',
  weight: 0.2,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2),
  generate: () => ({
    id: 'whistleblower',
    description: 'A whistleblower approaches you with evidence of wrongdoing in your party.',
    choices: [
      { id: 'expose', text: 'Expose the wrongdoing', effects: { stats: { reputation: 20 } } },
      { id: 'cover', text: 'Cover it up', effects: { money: -15000, stats: { reputation: -30 } } },
      { id: 'ignore', text: 'Ignore it', effects: { stats: { reputation: -10 } } },
    ],
  }),
};

const townHall: EventTemplate = {
  id: 'town_hall',
  category: 'general',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 1),
  generate: () => ({
    id: 'town_hall',
    description: 'A town hall meeting is scheduled. Constituents want to voice their concerns.',
    choices: [
      { id: 'attend', text: 'Attend and listen', effects: { stats: { reputation: 15, energy: -15 } } },
      { id: 'send_rep', text: 'Send a representative', effects: { money: -2000, stats: { reputation: 5 } } },
      { id: 'cancel', text: 'Cancel the meeting', effects: { stats: { reputation: -15 } } },
    ],
  }),
};

const partySplit: EventTemplate = {
  id: 'party_split',
  category: 'general',
  weight: 0.15,
  condition: state => Boolean(state.politics && state.politics.party && state.politics.careerLevel >= 2),
  generate: () => ({
    id: 'party_split',
    description: 'Your party is divided on a major issue. Factions are forming.',
    choices: [
      { id: 'side_majority', text: 'Side with majority', effects: { stats: { reputation: 8 } } },
      { id: 'side_minority', text: 'Side with minority', effects: { stats: { reputation: -5, approvalRating: 10 } } },
      { id: 'neutral', text: 'Stay neutral', effects: { stats: { reputation: -2 } } },
    ],
  }),
};

const mediaLeak: EventTemplate = {
  id: 'media_leak',
  category: 'general',
  weight: 0.25,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 1),
  generate: () => ({
    id: 'media_leak',
    description: 'Confidential information about your office is leaked to the media.',
    choices: [
      { id: 'address', text: 'Address it immediately', effects: { money: -5000, stats: { reputation: 5 } } },
      { id: 'deny', text: 'Deny the leak', effects: { stats: { reputation: -15 } } },
      { id: 'investigate', text: 'Investigate the source', effects: { money: -10000, stats: { reputation: 10 } } },
    ],
  }),
};

const emergencySession: EventTemplate = {
  id: 'emergency_session',
  category: 'general',
  weight: 0.2,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2),
  generate: () => ({
    id: 'emergency_session',
    description: 'An emergency legislative session is called to address a crisis.',
    choices: [
      { id: 'attend', text: 'Attend the session', effects: { stats: { reputation: 12, energy: -20 } } },
      { id: 'skip', text: 'Skip the session', effects: { stats: { reputation: -20 } } },
    ],
  }),
};

const endorsement: EventTemplate = {
  id: 'endorsement',
  category: 'general',
  weight: 0.2,
  // TESTFLIGHT FIX: Use weeksLived for deterministic behavior (nextElectionWeek is continuous, not 1-4)
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.nextElectionWeek && (state.weeksLived || 0) >= state.politics.nextElectionWeek - 8),
  generate: () => ({
    id: 'endorsement',
    description: 'A major political figure offers to endorse your campaign.',
    choices: [
      { id: 'accept', text: 'Accept the endorsement', effects: { money: -10000, stats: { reputation: 20 } } },
      { id: 'decline', text: 'Decline politely', effects: { stats: { reputation: -5 } } },
    ],
  }),
};

const constituentPetition: EventTemplate = {
  id: 'constituent_petition',
  category: 'general',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 1),
  generate: () => ({
    id: 'constituent_petition',
    description: 'A group of constituents presents a petition with thousands of signatures.',
    choices: [
      { id: 'support', text: 'Support their cause', effects: { stats: { reputation: 18 } } },
      { id: 'review', text: 'Review the petition', effects: { stats: { reputation: 5 } } },
      { id: 'dismiss', text: 'Dismiss the petition', effects: { stats: { reputation: -20 } } },
    ],
  }),
};

const politicalFundraiser: EventTemplate = {
  id: 'political_fundraiser',
  category: 'economy',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 1),
  generate: () => ({
    id: 'political_fundraiser',
    description: 'A political fundraiser is organized to support your campaign.',
    choices: [
      { id: 'attend', text: 'Attend the fundraiser', effects: { money: 25000, stats: { reputation: 8 } } },
      { id: 'skip', text: 'Skip the event', effects: { stats: { reputation: -5 } } },
    ],
  }),
};

const policyBacklash: EventTemplate = {
  id: 'policy_backlash',
  category: 'general',
  weight: 0.25,
  condition: state => Boolean(state.politics && state.politics.policiesEnacted && state.politics.policiesEnacted.length > 0),
  generate: state => {
    const enactedPolicies = state.politics!.policiesEnacted || [];
    const randomPolicyId = enactedPolicies[Math.floor(Math.random() * enactedPolicies.length)];
    const policy = POLICIES.find(p => p.id === randomPolicyId);

    return {
      id: 'policy_backlash',
      description: `Your "${policy?.name || 'recent policy'}" faces strong public backlash.`,
      choices: [
        { id: 'defend', text: 'Defend the policy', effects: { stats: { reputation: -10, approvalRating: -5 } } },
        { id: 'revise', text: 'Revise the policy', effects: { money: -10000, stats: { reputation: 5 } } },
        { id: 'repeal', text: 'Repeal the policy', effects: { stats: { reputation: 10, approvalRating: 5 } } },
      ],
    };
  },
};

// Stock Market Policy Events
const stockMarketRegulation: EventTemplate = {
  id: 'stock_market_regulation',
  category: 'economy',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'stock')),
  generate: state => {
    const stockPolicies = (state.politics!.policiesEnacted || []).filter(p => POLICIES.find(pol => pol.id === p)?.type === 'stock');
    const policy = stockPolicies.length > 0 ? POLICIES.find(p => p.id === stockPolicies[Math.floor(Math.random() * stockPolicies.length)]) : null;

    return {
      id: 'stock_market_regulation',
      description: `Your "${policy?.name || 'stock market policy'}" is affecting market volatility. Investors are ${policy?.effects.stocks?.volatilityModifier && policy.effects.stocks.volatilityModifier < 1 ? 'grateful for the stability' : 'concerned about the changes'}.`,
      choices: [
        { id: 'maintain', text: 'Maintain current regulations', effects: { stats: { reputation: 5 } } },
        { id: 'adjust', text: 'Adjust regulations', effects: { money: -5000, stats: { reputation: 8 } } },
      ],
    };
  },
};

const companyTaxIncentive: EventTemplate = {
  id: 'company_tax_incentive',
  category: 'economy',
  weight: 0.25,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'stock')),
  generate: () => ({
    id: 'company_tax_incentive',
    description: 'Tech companies are responding positively to your tax incentives. Stock prices are rising.',
    choices: [
      { id: 'continue', text: 'Continue the program', effects: { money: 100, stats: { reputation: 5 } } },
      { id: 'expand', text: 'Expand to more companies', effects: { money: -20000, stats: { reputation: 10 } } },
    ],
  }),
};

// Real Estate Policy Events
const housingMarketStimulus: EventTemplate = {
  id: 'housing_market_stimulus',
  category: 'economy',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'realestate')),
  generate: () => ({
    id: 'housing_market_stimulus',
    description: 'Your housing market policies are showing results. Property values are changing, and citizens are reacting.',
    choices: [
      { id: 'monitor', text: 'Monitor the situation', effects: { stats: { reputation: 3 } } },
      { id: 'adjust', text: 'Adjust policy parameters', effects: { money: -15000, stats: { reputation: 6 } } },
    ],
  }),
};

// Education Policy Events
const educationReformImpact: EventTemplate = {
  id: 'education_reform_impact',
  category: 'general',
  weight: 0.35,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'education')),
  generate: () => ({
    id: 'education_reform_impact',
    description: 'Students and educators are responding to your education reforms. Graduation rates are improving.',
    choices: [
      { id: 'celebrate', text: 'Celebrate the success', effects: { stats: { reputation: 10, happiness: 5 } } },
      { id: 'expand', text: 'Expand the reforms', effects: { money: -50000, stats: { reputation: 15 } } },
    ],
  }),
};

// Crypto Policy Events
const cryptoRegulationChange: EventTemplate = {
  id: 'crypto_regulation_change',
  category: 'economy',
  weight: 0.25,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 3 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'crypto')),
  generate: () => ({
    id: 'crypto_regulation_change',
    description: 'The cryptocurrency market is responding to your regulatory framework. Miners and investors have mixed reactions.',
    choices: [
      { id: 'maintain', text: 'Maintain current regulations', effects: { stats: { reputation: 5 } } },
      { id: 'loosen', text: 'Loosen regulations', effects: { money: 50, stats: { reputation: -3 } } },
    ],
  }),
};

// Technology Policy Events
const rdInnovationBoost: EventTemplate = {
  id: 'rd_innovation_boost',
  category: 'general',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'technology')),
  generate: () => ({
    id: 'rd_innovation_boost',
    description: 'Your technology policies are boosting innovation. R&D labs are reporting increased efficiency and breakthrough discoveries.',
    choices: [
      { id: 'fund', text: 'Increase funding', effects: { money: -30000, stats: { reputation: 12 } } },
      { id: 'celebrate', text: 'Celebrate the achievements', effects: { stats: { reputation: 8 } } },
    ],
  }),
};

// Healthcare Policy Events
const healthcareInitiative: EventTemplate = {
  id: 'healthcare_initiative',
  category: 'health',
  weight: 0.35,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'healthcare')),
  generate: () => ({
    id: 'healthcare_initiative',
    description: 'Your healthcare policies are improving public health. Citizens are reporting better access to medical services.',
    choices: [
      { id: 'expand', text: 'Expand healthcare access', effects: { money: -40000, stats: { health: 5, reputation: 15 } } },
      { id: 'maintain', text: 'Maintain current programs', effects: { stats: { reputation: 8 } } },
    ],
  }),
};

// Transportation Policy Events
const transportationSubsidy: EventTemplate = {
  id: 'transportation_subsidy',
  category: 'general',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'transportation')),
  generate: () => ({
    id: 'transportation_subsidy',
    description: 'Your transportation policies are reducing travel costs. Commuters are expressing gratitude for the savings.',
    choices: [
      { id: 'expand', text: 'Expand the subsidy program', effects: { money: -25000, stats: { happiness: 8, reputation: 12 } } },
      { id: 'maintain', text: 'Keep current subsidies', effects: { stats: { reputation: 6 } } },
    ],
  }),
};

// Additional Policy Events
const marketCrashPrevention: EventTemplate = {
  id: 'market_crash_prevention',
  category: 'economy',
  weight: 0.2,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 3 && state.politics.policiesEnacted?.includes('market_crash_prevention_fund')),
  generate: () => ({
    id: 'market_crash_prevention',
    description: 'Your Market Crash Prevention Fund successfully stabilized the markets during a downturn. Investors are grateful.',
    choices: [
      { id: 'replenish', text: 'Replenish the fund', effects: { money: -100000, stats: { reputation: 20 } } },
      { id: 'celebrate', text: 'Celebrate the success', effects: { stats: { reputation: 15 } } },
    ],
  }),
};

const educationScholarshipSuccess: EventTemplate = {
  id: 'education_scholarship_success',
  category: 'general',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 3 && state.politics.policiesEnacted?.includes('universal_scholarship_program')),
  generate: () => ({
    id: 'education_scholarship_success',
    description: 'Your scholarship program is helping thousands of students. Graduation rates are at an all-time high.',
    choices: [
      { id: 'expand', text: 'Expand scholarship funding', effects: { money: -80000, stats: { reputation: 18, happiness: 10 } } },
      { id: 'maintain', text: 'Maintain current funding', effects: { stats: { reputation: 12 } } },
    ],
  }),
};

const cryptoMiningBoom: EventTemplate = {
  id: 'crypto_mining_boom',
  category: 'economy',
  weight: 0.25,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 3 && state.politics.policiesEnacted?.some(p => {
    const policy = POLICIES.find(pol => pol.id === p);
    return policy?.type === 'crypto' && policy.effects.crypto?.miningBonus;
  })),
  generate: () => ({
    id: 'crypto_mining_boom',
    description: 'Your crypto mining incentives are attracting miners to the region. The local economy is benefiting.',
    choices: [
      { id: 'support', text: 'Support the mining industry', effects: { money: 80, stats: { reputation: 10 } } },
      { id: 'regulate', text: 'Add environmental regulations', effects: { money: -20000, stats: { reputation: 15, health: 3 } } },
    ],
  }),
};

const techStartupSuccess: EventTemplate = {
  id: 'tech_startup_success',
  category: 'general',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'technology')),
  generate: () => ({
    id: 'tech_startup_success',
    description: 'Tech startups are flourishing thanks to your support policies. Several companies are going public.',
    choices: [
      { id: 'invest', text: 'Invest in the ecosystem', effects: { money: -50000, stats: { reputation: 15, money: 200 } } },
      { id: 'celebrate', text: 'Celebrate the success', effects: { stats: { reputation: 10 } } },
    ],
  }),
};

const affordableHousingSuccess: EventTemplate = {
  id: 'affordable_housing_success',
  category: 'general',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.includes('affordable_housing_initiative')),
  generate: () => ({
    id: 'affordable_housing_success',
    description: 'Your affordable housing initiative is providing homes for hundreds of families. The community is thriving.',
    choices: [
      { id: 'expand', text: 'Build more housing', effects: { money: -150000, stats: { reputation: 20, happiness: 12 } } },
      { id: 'maintain', text: 'Maintain current program', effects: { stats: { reputation: 12 } } },
    ],
  }),
};

const publicHealthImprovement: EventTemplate = {
  id: 'public_health_improvement',
  category: 'health',
  weight: 0.35,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'healthcare')),
  generate: () => ({
    id: 'public_health_improvement',
    description: 'Public health metrics are improving across the board. Life expectancy is rising, and medical costs are decreasing.',
    choices: [
      { id: 'expand', text: 'Expand health programs', effects: { money: -60000, stats: { health: 8, reputation: 18 } } },
      { id: 'maintain', text: 'Maintain current programs', effects: { stats: { reputation: 10 } } },
    ],
  }),
};

const transitExpansionSuccess: EventTemplate = {
  id: 'transit_expansion_success',
  category: 'general',
  weight: 0.3,
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.policiesEnacted?.some(p => POLICIES.find(pol => pol.id === p)?.type === 'transportation')),
  generate: () => ({
    id: 'transit_expansion_success',
    description: 'Your public transit expansion is reducing traffic congestion and improving air quality. Commuters are happy.',
    choices: [
      { id: 'expand', text: 'Expand transit network', effects: { money: -100000, stats: { happiness: 10, health: 5, reputation: 15 } } },
      { id: 'maintain', text: 'Maintain current network', effects: { stats: { reputation: 10 } } },
    ],
  }),
};

// ============================================
// NEW LIFE MILESTONE EVENTS
// ============================================

const milestoneBirthday30: EventTemplate = {
  id: 'milestone_birthday_30',
  category: 'general',
  weight: 0.9,
  condition: state => state.date?.age === 30,
  generate: () => ({
    id: 'milestone_birthday_30',
    description: "You're turning 30! This is a major milestone. How do you want to celebrate?",
    choices: [
      { id: 'party', text: 'Throw a big party', effects: { money: -500, stats: { happiness: 20, reputation: 10 } } },
      { id: 'reflect', text: 'Reflect on your achievements', effects: { stats: { happiness: 10 } } },
      { id: 'invest', text: 'Invest in your future', effects: { money: -1000, stats: { reputation: 5 } } },
    ],
  }),
};

const milestoneBirthday50: EventTemplate = {
  id: 'milestone_birthday_50',
  category: 'general',
  weight: 0.9,
  condition: state => state.date?.age === 50,
  generate: () => ({
    id: 'milestone_birthday_50',
    description: "Half a century! You're turning 50. Time to evaluate your life journey.",
    choices: [
      { id: 'celebrate', text: 'Celebrate with family', effects: { money: -1000, stats: { happiness: 25 } } },
      { id: 'charity', text: 'Donate to charity', effects: { money: -2000, stats: { happiness: 15, reputation: 20 } } },
      { id: 'quiet', text: 'Have a quiet day', effects: { stats: { happiness: 5, health: 5 } } },
    ],
  }),
};

const lifeInsuranceOffer: EventTemplate = {
  id: 'life_insurance_offer',
  category: 'economy',
  weight: 0.35,
  condition: state => (state.date?.age || 18) >= 25 && (state.date?.age || 18) <= 50,
  generate: () => ({
    id: 'life_insurance_offer',
    description: 'An insurance agent approaches you with a life insurance offer. The premiums are reasonable.',
    choices: [
      { id: 'accept', text: 'Buy the insurance ($200/month)', effects: { money: -200, stats: { happiness: 5 } } },
      { id: 'decline', text: 'Decline politely', effects: {} },
    ],
  }),
};

// ============================================
// SOCIAL CONNECTION EVENTS
// ============================================

const oldFriendReturns: EventTemplate = {
  id: 'old_friend_returns',
  category: 'relationship',
  weight: 0.4,
  generate: () => {
    const names = ['Alex', 'Jamie', 'Morgan', 'Taylor', 'Jordan', 'Casey', 'Riley', 'Quinn'];
    const name = names[Math.floor(Math.random() * names.length)];
    return {
      id: 'old_friend_returns',
      description: `Your old friend ${name} from school just moved back to town and wants to reconnect!`,
      choices: [
        { id: 'reconnect', text: 'Catch up over coffee', effects: { money: -30, stats: { happiness: 15 } } },
        { id: 'dinner', text: 'Have dinner together', effects: { money: -100, stats: { happiness: 20 } } },
        { id: 'busy', text: "Say you're too busy", effects: { stats: { happiness: -5 } } },
      ],
    };
  },
};

const familyReunion: EventTemplate = {
  id: 'family_reunion',
  category: 'relationship',
  weight: 0.3,
  generate: () => ({
    id: 'family_reunion',
    description: "Your extended family is organizing a reunion. It's been years since everyone was together.",
    choices: [
      { id: 'attend', text: 'Attend the reunion', effects: { money: -200, stats: { happiness: 20, reputation: 5 } } },
      { id: 'host', text: 'Offer to host it', effects: { money: -800, stats: { happiness: 25, reputation: 15 } } },
      { id: 'skip', text: 'Make an excuse', effects: { stats: { happiness: -10, reputation: -5 } } },
    ],
  }),
};

const networkingEvent: EventTemplate = {
  id: 'networking_event',
  category: 'general',
  weight: 0.4,
  condition: state => !!state.currentJob || (state.companies && state.companies.length > 0),
  generate: () => ({
    id: 'networking_event',
    description: "There's a professional networking event in town. Good opportunity to make connections.",
    choices: [
      { id: 'attend', text: 'Attend and network', effects: { money: -50, stats: { reputation: 15, energy: -10 } } },
      { id: 'skip', text: 'Skip it', effects: {} },
    ],
  }),
};

// ============================================
// OPPORTUNITY EVENTS
// ============================================

const investmentTip: EventTemplate = {
  id: 'investment_tip',
  category: 'economy',
  weight: 0.35,
  condition: state => state.stats.money >= 5000,
  generate: (state) => {
    // ECONOMY FIX: Scale investment amounts with net worth
    // At low net worth: Use fixed amounts ($1K/$5K)
    // At high net worth: Scale to 0.1-0.5% of net worth
    // Cap at $25K/$50K to prevent excessive risk/reward
    const { netWorth } = require('@/lib/progress/achievements');
    const currentNetWorth = netWorth(state);

    // Small investment: 0.1-0.2% of net worth, floor $1K, cap $25K
    const smallPercentage = 0.001 + (Math.random() * 0.001); // 0.1-0.2%
    const baseSmall = Math.floor(currentNetWorth * smallPercentage);
    const smallAmount = Math.max(1000, Math.min(25000, baseSmall));

    // Big investment: 0.3-0.5% of net worth, floor $5K, cap $50K
    const bigPercentage = 0.003 + (Math.random() * 0.002); // 0.3-0.5%
    const baseBig = Math.floor(currentNetWorth * bigPercentage);
    const bigAmount = Math.max(5000, Math.min(50000, baseBig));

    return {
      id: 'investment_tip',
      description: 'A successful investor shares a tip about an undervalued stock. It could double or lose 50%.',
      choices: [
        { id: 'invest_big', text: `Invest $${bigAmount.toLocaleString()}`, effects: { money: Math.random() > 0.5 ? bigAmount : -Math.floor(bigAmount * 0.5) } },
        { id: 'invest_small', text: `Invest $${smallAmount.toLocaleString()}`, effects: { money: Math.random() > 0.5 ? smallAmount : -Math.floor(smallAmount * 0.5) } },
        { id: 'pass', text: 'Pass on the opportunity', effects: {} },
      ],
    };
  },
};

const businessPartnership: EventTemplate = {
  id: 'business_partnership',
  category: 'economy',
  weight: 0.25,
  condition: state => state.companies && state.companies.length > 0,
  generate: (state) => {
    // ECONOMY FIX: Scale partnership offer with net worth to prevent exploit
    // At low net worth: Floor ensures minimum $10K (same as before)
    // At high net worth: Cap ensures maximum $100K (prevents excessive rewards)
    // Scales proportionally: 2-5% of net worth (maintains usefulness at all levels)
    const { netWorth } = require('@/lib/progress/achievements');
    const currentNetWorth = netWorth(state);
    const percentage = 0.02 + (Math.random() * 0.03); // 2-5% of net worth
    const baseOffer = Math.floor(currentNetWorth * percentage);
    const scaledOffer = Math.max(10000, Math.min(100000, baseOffer)); // Floor $10K, cap $100K

    // Negotiate option gives 50% more (same ratio as before)
    const negotiateOffer = Math.floor(scaledOffer * 1.5);

    return {
      id: 'business_partnership',
      description: `A successful entrepreneur wants to partner with your business. They offer $${scaledOffer.toLocaleString()} capital for equity.`,
      choices: [
        { id: 'accept', text: 'Accept the partnership', effects: { money: scaledOffer, stats: { reputation: 10 } } },
        { id: 'negotiate', text: 'Negotiate better terms', effects: { money: negotiateOffer, stats: { reputation: 5 } } },
        { id: 'decline', text: 'Keep full ownership', effects: { stats: { reputation: -5 } } },
      ],
    };
  },
};

const distantRelativeInheritance: EventTemplate = {
  id: 'distant_relative_inheritance',
  category: 'economy',
  weight: 0.15,
  generate: (state) => {
    // ECONOMY FIX: Scale inheritance with net worth to prevent exploit
    // At low net worth: Floor ensures minimum $5K (same as before)
    // At high net worth: Cap ensures maximum $50K (prevents excessive rewards)
    // Scales proportionally: 0.1-0.3% of net worth (maintains usefulness at all levels)
    const { netWorth } = require('@/lib/progress/achievements');
    const currentNetWorth = netWorth(state);
    const percentage = 0.001 + (Math.random() * 0.002); // 0.1-0.3% of net worth
    const baseInheritance = Math.floor(currentNetWorth * percentage);
    const inheritance = Math.max(5000, Math.min(50000, baseInheritance)); // Floor $5K, cap $50K

    return {
      id: 'distant_relative_inheritance',
      description: `You receive news that a distant relative passed away and left you $${inheritance.toLocaleString()} in their will.`,
      choices: [
        { id: 'accept', text: 'Accept the inheritance', effects: { money: inheritance, stats: { happiness: -5 } } },
        { id: 'donate', text: 'Donate to charity in their name', effects: { stats: { happiness: 10, reputation: 15 } } },
      ],
    };
  },
};

const freelanceOpportunity: EventTemplate = {
  id: 'freelance_opportunity',
  category: 'economy',
  weight: 0.4,
  generate: () => ({
    id: 'freelance_opportunity',
    description: 'Someone offers you a freelance project that would pay well but take up your free time.',
    choices: [
      { id: 'accept', text: 'Take the project', effects: { money: 800, stats: { energy: -20, happiness: -10 } } },
      { id: 'decline', text: 'Focus on life balance', effects: { stats: { happiness: 5 } } },
    ],
  }),
};

// ============================================
// CHALLENGE EVENTS
// ============================================

const identityTheft: EventTemplate = {
  id: 'identity_theft',
  category: 'economy',
  weight: 0.2,
  condition: state => state.stats.money >= 1000,
  generate: (state) => {
    const stolenAmount = Math.min(Math.floor(state.stats.money * 0.1), 500);
    return {
      id: 'identity_theft',
      description: `Your identity was stolen! Someone made unauthorized purchases of $${stolenAmount}.`,
      choices: [
        { id: 'report', text: 'Report to bank (recover 50%)', effects: { money: Math.floor(-stolenAmount * 0.5), stats: { happiness: -10 } } },
        { id: 'pursue', text: 'Hire investigator', effects: { money: -200, stats: { happiness: -5 } } },
      ],
    };
  },
};

const naturalDisaster: EventTemplate = {
  id: 'natural_disaster',
  category: 'general',
  weight: 0.15,
  generate: () => ({
    id: 'natural_disaster',
    description: 'A severe storm has damaged your neighborhood. Some repairs are needed.',
    choices: [
      { id: 'repair', text: 'Repair immediately', effects: { money: -1500, stats: { happiness: -5 } } },
      { id: 'wait', text: 'Wait for insurance', effects: { money: -500, stats: { happiness: -15, health: -5 } } },
      { id: 'help', text: 'Help neighbors first', effects: { money: -2000, stats: { reputation: 20 } } },
    ],
  }),
};

const healthScare: EventTemplate = {
  id: 'health_scare',
  category: 'health',
  weight: 0.3,
  condition: state => state.stats.health < 70,
  generate: () => ({
    id: 'health_scare',
    description: 'You experience unusual symptoms and the doctor recommends tests.',
    choices: [
      { id: 'tests', text: 'Get all tests done', effects: { money: -500, stats: { health: 20, happiness: -10 } } },
      { id: 'basic', text: 'Just basic checkup', effects: { money: -100, stats: { health: 5, happiness: -5 } } },
      { id: 'ignore', text: 'Ignore for now', effects: { stats: { health: -10 } } },
    ],
  }),
};

const carAccident: EventTemplate = {
  id: 'car_accident',
  category: 'general',
  weight: 0.2,
  generate: () => ({
    id: 'car_accident',
    description: "Someone hit your parked car and drove off. You have the license plate number.",
    choices: [
      { id: 'police', text: 'Report to police', effects: { money: -100, stats: { reputation: 5 } } },
      { id: 'insurance', text: 'File insurance claim', effects: { money: -300, stats: { happiness: -5 } } },
      { id: 'pay', text: 'Pay for repairs yourself', effects: { money: -800, stats: { happiness: -10 } } },
    ],
  }),
};

// ============================================
// FAME EVENTS (when followers > 10k)
// ============================================

const interviewRequest: EventTemplate = {
  id: 'interview_request',
  category: 'general',
  weight: 0.5,
  condition: state => (state.socialMedia?.followers || 0) >= 10000,
  generate: () => ({
    id: 'interview_request',
    description: 'A local news outlet wants to interview you about your growing influence!',
    choices: [
      { id: 'accept', text: 'Accept the interview', effects: { stats: { reputation: 25, happiness: 10 } } },
      { id: 'decline', text: 'Stay out of spotlight', effects: { stats: { happiness: 5 } } },
    ],
  }),
};

const scandalRumor: EventTemplate = {
  id: 'scandal_rumor',
  category: 'general',
  weight: 0.35,
  condition: state => (state.socialMedia?.followers || 0) >= 10000,
  generate: () => ({
    id: 'scandal_rumor',
    description: 'A tabloid is spreading false rumors about you. This could damage your reputation.',
    choices: [
      { id: 'sue', text: 'Sue for defamation', effects: { money: -5000, stats: { reputation: 15, happiness: -10 } } },
      { id: 'ignore', text: 'Ignore and move on', effects: { stats: { reputation: -10, happiness: -5 } } },
      { id: 'statement', text: 'Release public statement', effects: { money: -500, stats: { reputation: 5, happiness: -5 } } },
    ],
  }),
};

const fanEncounter: EventTemplate = {
  id: 'fan_encounter',
  category: 'general',
  weight: 0.45,
  condition: state => (state.socialMedia?.followers || 0) >= 5000,
  generate: () => ({
    id: 'fan_encounter',
    description: "Someone recognizes you from social media and asks for a photo!",
    choices: [
      { id: 'photo', text: 'Take a photo with them', effects: { stats: { happiness: 10, reputation: 5 } } },
      { id: 'chat', text: 'Have a nice chat', effects: { stats: { happiness: 15 } } },
      { id: 'decline', text: 'Politely decline', effects: { stats: { happiness: -5 } } },
    ],
  }),
};

const brandDealOffer: EventTemplate = {
  id: 'brand_deal_offer',
  category: 'economy',
  weight: 0.4,
  condition: state => (state.socialMedia?.followers || 0) >= 10000,
  generate: (state) => {
    const payment = Math.floor((state.socialMedia?.followers || 10000) * 0.05);
    return {
      id: 'brand_deal_offer',
      description: `A company wants you to promote their product. They're offering $${payment.toLocaleString()}.`,
      choices: [
        { id: 'accept', text: 'Accept the deal', effects: { money: payment, stats: { reputation: -5 } } },
        { id: 'negotiate', text: 'Negotiate higher pay', effects: { money: Math.floor(payment * 1.5), stats: { reputation: -10 } } },
        { id: 'decline', text: 'Keep your integrity', effects: { stats: { reputation: 10 } } },
      ],
    };
  },
};

const viralMoment: EventTemplate = {
  id: 'viral_moment',
  category: 'general',
  weight: 0.25,
  condition: state => (state.socialMedia?.followers || 0) >= 1000,
  generate: () => ({
    id: 'viral_moment',
    description: "One of your posts is going viral! How do you want to capitalize on this?",
    choices: [
      { id: 'engage', text: 'Engage with comments', effects: { stats: { happiness: 15, reputation: 10, energy: -15 } } },
      { id: 'post_more', text: 'Post follow-up content', effects: { stats: { reputation: 15, energy: -20 } } },
      { id: 'enjoy', text: 'Just enjoy the moment', effects: { stats: { happiness: 20 } } },
    ],
  }),
};

// ============================================
// MISC LIFE EVENTS
// ============================================

const petsitterNeeded: EventTemplate = {
  id: 'petsitter_needed',
  category: 'general',
  weight: 0.35,
  condition: state => state.pets && state.pets.length > 0,
  generate: () => ({
    id: 'petsitter_needed',
    description: "A neighbor needs someone to pet-sit for the weekend. They'll pay!",
    choices: [
      { id: 'accept', text: 'Pet-sit for them', effects: { money: 150, stats: { happiness: 10, energy: -10 } } },
      { id: 'decline', text: 'Too busy', effects: {} },
    ],
  }),
};

const communityService: EventTemplate = {
  id: 'community_service',
  category: 'general',
  weight: 0.35,
  generate: () => ({
    id: 'community_service',
    description: 'The local community center is looking for volunteers this weekend.',
    choices: [
      { id: 'volunteer', text: 'Volunteer your time', effects: { stats: { happiness: 15, reputation: 10, energy: -15 } } },
      { id: 'donate', text: 'Donate money instead', effects: { money: -200, stats: { reputation: 8 } } },
      { id: 'skip', text: "You're too busy", effects: {} },
    ],
  }),
};

// STABILITY FIX: Scholarship event for poverty recovery path
// Triggers when player has <$500 for 20+ weeks and no education
const scholarshipOpportunity: EventTemplate = {
  id: 'scholarship_opportunity',
  category: 'economy',
  weight: 0.15,
  condition: state => {
    // Only trigger if player has been in poverty (low money) for extended period
    // STABILITY FIX: Reduced from 20 weeks to 12 weeks for faster recovery
    const weeksInPoverty = 'weeksInPoverty' in state && typeof state.weeksInPoverty === 'number' ? state.weeksInPoverty : 0;
    const hasLowMoney = state.stats.money < 500;
    const hasNoEducation = !state.educations?.some(e => e.completed);
    return weeksInPoverty >= 12 && hasLowMoney && hasNoEducation; // Reduced from 20 to 12 weeks
  },
  generate: () => ({
    id: 'scholarship_opportunity',
    description: "A scholarship opportunity has come your way! A local organization noticed your financial struggles and is offering to cover your education costs.",
    choices: [
      { id: 'accept', text: 'Accept the scholarship (Free education!)', effects: { stats: { happiness: 20, reputation: 10 } }, special: 'grant_free_education' },
      { id: 'decline', text: 'Decline (you want to earn it yourself)', effects: { stats: { reputation: 5 } } },
    ],
  }),
};

const onlineCourse: EventTemplate = {
  id: 'online_course',
  category: 'general',
  weight: 0.4,
  generate: () => ({
    id: 'online_course',
    description: "There's a highly rated online course that could boost your skills.",
    choices: [
      { id: 'enroll', text: 'Enroll in the course', effects: { money: -300, stats: { happiness: 5 } } },
      { id: 'free', text: 'Find free alternatives', effects: { stats: { happiness: 3, energy: -10 } } },
      { id: 'skip', text: 'Maybe later', effects: {} },
    ],
  }),
};

const neighborConflict: EventTemplate = {
  id: 'neighbor_conflict',
  category: 'relationship',
  weight: 0.3,
  generate: () => ({
    id: 'neighbor_conflict',
    description: "Your neighbor complains about noise from your place. They seem upset.",
    choices: [
      { id: 'apologize', text: 'Apologize and be quieter', effects: { stats: { happiness: -5, reputation: 5 } } },
      { id: 'gift', text: 'Bring them a gift', effects: { money: -50, stats: { reputation: 10 } } },
      { id: 'ignore', text: 'Ignore their complaints', effects: { stats: { reputation: -10 } } },
    ],
  }),
};

const randomActKindness: EventTemplate = {
  id: 'random_act_kindness',
  category: 'general',
  weight: 0.4,
  generate: () => ({
    id: 'random_act_kindness',
    description: 'A stranger drops their wallet. You pick it up and find $200 inside.',
    choices: [
      { id: 'return', text: 'Return it to them', effects: { stats: { happiness: 15, reputation: 10 } } },
      { id: 'return_reward', text: 'Return it (they offer reward)', effects: { money: 40, stats: { happiness: 10, reputation: 8 } } },
      { id: 'keep', text: 'Keep the money', effects: { money: 200, stats: { happiness: -10, reputation: -15 } } },
    ],
  }),
};

const unexpectedGift: EventTemplate = {
  id: 'unexpected_gift',
  category: 'general',
  weight: 0.35,
  generate: () => ({
    id: 'unexpected_gift',
    description: 'A friend surprises you with a thoughtful gift for no particular reason.',
    choices: [
      { id: 'accept', text: 'Accept graciously', effects: { stats: { happiness: 15 } } },
      { id: 'return', text: 'Get them something too', effects: { money: -100, stats: { happiness: 20 } } },
    ],
  }),
};

const bookClubInvite: EventTemplate = {
  id: 'book_club_invite',
  category: 'relationship',
  weight: 0.35,
  generate: () => ({
    id: 'book_club_invite',
    description: "You're invited to join a local book club. Great way to meet people!",
    choices: [
      { id: 'join', text: 'Join the club', effects: { money: -30, stats: { happiness: 10 } } },
      { id: 'decline', text: "Not a reader", effects: {} },
    ],
  }),
};

const fitnessChallenge: EventTemplate = {
  id: 'fitness_challenge',
  category: 'health',
  weight: 0.4,
  generate: () => ({
    id: 'fitness_challenge',
    description: 'A friend challenges you to a 30-day fitness challenge.',
    choices: [
      { id: 'accept', text: 'Accept the challenge', effects: { stats: { fitness: 10, health: 10, happiness: 5, energy: -10 } } },
      { id: 'decline', text: "I'll pass", effects: {} },
    ],
  }),
};

// ============================================
// ADDITIONAL NEW EVENTS (25+ more)
// ============================================

const unexpectedPromotion: EventTemplate = {
  id: 'unexpected_promotion',
  category: 'economy',
  weight: 0.2,
  condition: state => Boolean(state.currentJob),
  generate: () => ({
    id: 'unexpected_promotion',
    description: 'Your boss calls you in unexpectedly - they want to promote you!',
    choices: [
      { id: 'accept', text: 'Accept the promotion', effects: { money: 500, stats: { happiness: 20, reputation: 10 } } },
      { id: 'negotiate', text: 'Negotiate for more', effects: { money: 800, stats: { happiness: 15, reputation: 5 } } },
    ],
  }),
};

const workplaceConflict: EventTemplate = {
  id: 'workplace_conflict',
  category: 'relationship',
  weight: 0.35,
  condition: state => Boolean(state.currentJob),
  generate: () => ({
    id: 'workplace_conflict',
    description: 'A coworker is spreading rumors about you at work.',
    choices: [
      { id: 'confront', text: 'Confront them directly', effects: { stats: { reputation: 5, happiness: -5 } } },
      { id: 'hr', text: 'Report to HR', effects: { stats: { reputation: 10, happiness: -10 } } },
      { id: 'ignore', text: 'Ignore it', effects: { stats: { happiness: -15 } } },
    ],
  }),
};

const surpriseParty: EventTemplate = {
  id: 'surprise_party',
  category: 'relationship',
  weight: 0.25,
  condition: state => (state.relationships?.length || 0) >= 2,
  generate: () => ({
    id: 'surprise_party',
    description: 'Your friends throw a surprise party for you!',
    choices: [
      { id: 'enjoy', text: 'Enjoy the party!', effects: { stats: { happiness: 25, energy: -10 } } },
      { id: 'emotional', text: 'Get emotional', effects: { stats: { happiness: 30 } } },
    ],
  }),
};

const phoneLost: EventTemplate = {
  id: 'phone_lost',
  category: 'economy',
  weight: 0.3,
  generate: () => ({
    id: 'phone_lost',
    description: 'You lost your phone! This is going to be an expensive replacement.',
    choices: [
      { id: 'new_phone', text: 'Buy a new phone', effects: { money: -800, stats: { happiness: -10 } } },
      { id: 'cheap_phone', text: 'Get a cheap replacement', effects: { money: -200, stats: { happiness: -15 } } },
      { id: 'search', text: 'Search everywhere first', effects: { money: 0, stats: { happiness: -5, energy: -15 } } },
    ],
  }),
};

const sleepIssues: EventTemplate = {
  id: 'sleep_issues',
  category: 'health',
  weight: 0.35,
  condition: state => state.stats.energy < 50,
  generate: () => ({
    id: 'sleep_issues',
    description: "You've been having trouble sleeping lately. It's affecting your energy.",
    choices: [
      { id: 'doctor', text: 'See a sleep specialist', effects: { money: -300, stats: { health: 10, energy: 15 } } },
      { id: 'melatonin', text: 'Try natural remedies', effects: { money: -50, stats: { energy: 5 } } },
      { id: 'ignore', text: 'Push through it', effects: { stats: { health: -10, energy: -10 } } },
    ],
  }),
};

const mentorOffer: EventTemplate = {
  id: 'mentor_offer',
  category: 'general',
  weight: 0.25,
  condition: state => Boolean(state.currentJob),
  generate: () => ({
    id: 'mentor_offer',
    description: 'A successful professional offers to mentor you in your career.',
    choices: [
      { id: 'accept', text: 'Accept gratefully', effects: { stats: { reputation: 15, happiness: 10 } } },
      { id: 'decline', text: 'Politely decline', effects: {} },
    ],
  }),
};

const neighborMovingAway: EventTemplate = {
  id: 'neighbor_moving',
  category: 'relationship',
  weight: 0.3,
  generate: () => ({
    id: 'neighbor_moving',
    description: 'Your friendly neighbor is moving away. They ask if you want any furniture.',
    choices: [
      { id: 'take', text: 'Accept the furniture', effects: { stats: { happiness: 10 } } },
      { id: 'help', text: 'Help them move', effects: { stats: { happiness: 15, energy: -15, reputation: 5 } } },
      { id: 'goodbye', text: 'Just say goodbye', effects: { stats: { happiness: -5 } } },
    ],
  }),
};

const hobbyDiscover: EventTemplate = {
  id: 'hobby_discover',
  category: 'general',
  weight: 0.35,
  generate: () => ({
    id: 'hobby_discover',
    description: 'You stumble upon a new hobby that looks interesting - woodworking!',
    choices: [
      { id: 'try', text: 'Give it a try', effects: { money: -200, stats: { happiness: 15 } } },
      { id: 'skip', text: 'Not for me', effects: {} },
    ],
  }),
};

const backPain: EventTemplate = {
  id: 'back_pain',
  category: 'health',
  weight: 0.35,
  generate: () => ({
    id: 'back_pain',
    description: 'You wake up with terrible back pain. It might need attention.',
    choices: [
      { id: 'chiropractor', text: 'See a chiropractor', effects: { money: -150, stats: { health: 15, happiness: 5 } } },
      { id: 'rest', text: 'Rest and stretch', effects: { stats: { health: 5, energy: -10 } } },
      { id: 'ignore', text: 'Power through', effects: { stats: { health: -10, happiness: -10 } } },
    ],
  }),
};

const roadTrip: EventTemplate = {
  id: 'road_trip',
  category: 'general',
  weight: 0.3,
  generate: () => ({
    id: 'road_trip',
    description: 'Friends invite you on a spontaneous weekend road trip!',
    choices: [
      { id: 'go', text: 'Road trip!', effects: { money: -300, stats: { happiness: 25, energy: -15 } } },
      { id: 'cant', text: 'Too busy this time', effects: { stats: { happiness: -5 } } },
    ],
  }),
};

const lostPet: EventTemplate = {
  id: 'lost_pet',
  category: 'general',
  weight: 0.25,
  condition: state => Boolean(state.pets && state.pets.length > 0),
  generate: () => ({
    id: 'lost_pet',
    description: 'Your pet got out! You need to find them quickly!',
    choices: [
      { id: 'search', text: 'Search the neighborhood', effects: { stats: { happiness: -10, energy: -20 } } },
      { id: 'flyers', text: 'Put up lost pet flyers', effects: { money: -50, stats: { happiness: -15 } } },
      { id: 'reward', text: 'Offer a reward', effects: { money: -200, stats: { happiness: -5 } } },
    ],
  }),
};

const talentShow: EventTemplate = {
  id: 'talent_show',
  category: 'general',
  weight: 0.25,
  generate: () => ({
    id: 'talent_show',
    description: 'The local community center is hosting a talent show. Want to participate?',
    choices: [
      { id: 'perform', text: 'Show off your skills', effects: { stats: { happiness: 15, reputation: 10, energy: -15 } } },
      { id: 'watch', text: 'Just watch', effects: { stats: { happiness: 5 } } },
      { id: 'skip', text: 'Skip it', effects: {} },
    ],
  }),
};

const cookingDisaster: EventTemplate = {
  id: 'cooking_disaster',
  category: 'general',
  weight: 0.35,
  generate: () => ({
    id: 'cooking_disaster',
    description: 'You tried a new recipe and it went horribly wrong. Smoke alarm is going off!',
    choices: [
      { id: 'order', text: 'Order takeout instead', effects: { money: -40, stats: { happiness: 5 } } },
      { id: 'retry', text: 'Try again', effects: { money: -30, stats: { happiness: -5, energy: -10 } } },
      { id: 'laugh', text: 'Laugh it off', effects: { stats: { happiness: 10 } } },
    ],
  }),
};

const dentalCheckup: EventTemplate = {
  id: 'dental_checkup',
  category: 'health',
  weight: 0.3,
  generate: () => ({
    id: 'dental_checkup',
    description: "It's been a while since your last dental checkup. Time for a visit?",
    choices: [
      { id: 'go', text: 'Schedule appointment', effects: { money: -200, stats: { health: 10 } } },
      { id: 'delay', text: 'Put it off', effects: { stats: { health: -5 } } },
    ],
  }),
};

const parkRun: EventTemplate = {
  id: 'park_run',
  category: 'health',
  weight: 0.35,
  generate: () => ({
    id: 'park_run',
    description: 'There is a free community 5k run this weekend in the park.',
    choices: [
      { id: 'run', text: 'Sign up and run', effects: { stats: { fitness: 8, health: 5, happiness: 10, energy: -15 } } },
      { id: 'volunteer', text: 'Volunteer instead', effects: { stats: { reputation: 5, happiness: 5 } } },
      { id: 'skip', text: 'Skip it', effects: {} },
    ],
  }),
};

const carWash: EventTemplate = {
  id: 'car_wash',
  category: 'general',
  weight: 0.4,
  generate: () => ({
    id: 'car_wash',
    description: 'Your car is filthy. Time for a wash?',
    choices: [
      { id: 'professional', text: 'Professional detailing', effects: { money: -100, stats: { happiness: 10 } } },
      { id: 'self', text: 'Wash it yourself', effects: { stats: { happiness: 5, energy: -10 } } },
      { id: 'ignore', text: "It's fine", effects: { stats: { happiness: -3 } } },
    ],
  }),
};

const musicFestival: EventTemplate = {
  id: 'music_festival',
  category: 'general',
  weight: 0.25,
  generate: () => ({
    id: 'music_festival',
    description: 'A popular music festival is coming to town this weekend!',
    choices: [
      { id: 'vip', text: 'Get VIP tickets', effects: { money: -500, stats: { happiness: 30, energy: -20 } } },
      { id: 'general', text: 'Get general admission', effects: { money: -150, stats: { happiness: 20, energy: -15 } } },
      { id: 'skip', text: 'Not my scene', effects: {} },
    ],
  }),
};

const gameNight: EventTemplate = {
  id: 'game_night',
  category: 'relationship',
  weight: 0.4,
  generate: () => ({
    id: 'game_night',
    description: 'Friends are organizing a board game night. Join them?',
    choices: [
      { id: 'host', text: 'Offer to host', effects: { money: -50, stats: { happiness: 20 } } },
      { id: 'attend', text: 'Just attend', effects: { stats: { happiness: 15 } } },
      { id: 'busy', text: 'Too busy', effects: { stats: { happiness: -5 } } },
    ],
  }),
};

const jobInterview: EventTemplate = {
  id: 'random_job_interview',
  category: 'economy',
  weight: 0.2,
  generate: () => ({
    id: 'random_job_interview',
    description: 'A recruiter reaches out - they found your profile and want to interview you!',
    choices: [
      { id: 'interview', text: 'Take the interview', effects: { stats: { reputation: 10, happiness: 5 } } },
      { id: 'decline', text: 'Happy where I am', effects: {} },
    ],
  }),
};

const birthdayForgotten: EventTemplate = {
  id: 'birthday_forgotten',
  category: 'relationship',
  weight: 0.2,
  condition: state => (state.relationships?.length || 0) >= 1,
  generate: () => ({
    id: 'birthday_forgotten',
    description: "Oh no! You forgot a friend's birthday. It was yesterday!",
    choices: [
      { id: 'apologize', text: 'Apologize profusely', effects: { stats: { happiness: -10 } } },
      { id: 'gift', text: 'Buy an expensive gift', effects: { money: -200, stats: { happiness: -5 } } },
      { id: 'dinner', text: 'Take them to dinner', effects: { money: -150, stats: { happiness: 5 } } },
    ],
  }),
};

const taxRefund: EventTemplate = {
  id: 'tax_refund',
  category: 'economy',
  weight: 0.2,
  generate: () => {
    const refund = Math.floor(Math.random() * 1500) + 500;
    return {
      id: 'tax_refund',
      description: `Good news! You're getting a tax refund of $${refund}!`,
      choices: [
        { id: 'save', text: 'Save it', effects: { money: refund, stats: { happiness: 10 } } },
        { id: 'splurge', text: 'Treat yourself', effects: { money: Math.floor(refund * 0.5), stats: { happiness: 20 } } },
      ],
    };
  },
};

const powerOutage: EventTemplate = {
  id: 'power_outage',
  category: 'general',
  weight: 0.3,
  generate: () => ({
    id: 'power_outage',
    description: 'A massive power outage hits your area. Could last hours!',
    choices: [
      { id: 'wait', text: 'Wait it out at home', effects: { stats: { happiness: -10 } } },
      { id: 'cafe', text: 'Go to a cafe', effects: { money: -30, stats: { happiness: 5 } } },
      { id: 'friend', text: "Go to a friend's house", effects: { stats: { happiness: 10 } } },
    ],
  }),
};

const charitableRequest: EventTemplate = {
  id: 'charitable_request',
  category: 'general',
  weight: 0.35,
  generate: () => ({
    id: 'charitable_request',
    description: 'A charity calls asking for a donation to help homeless families.',
    choices: [
      { id: 'generous', text: 'Donate generously', effects: { money: -200, stats: { happiness: 15, reputation: 10 } } },
      { id: 'small', text: 'Give a small amount', effects: { money: -50, stats: { happiness: 5, reputation: 3 } } },
      { id: 'decline', text: 'Not right now', effects: {} },
    ],
  }),
};

const allergySeason: EventTemplate = {
  id: 'allergy_season',
  category: 'health',
  weight: 0.35,
  generate: () => ({
    id: 'allergy_season',
    description: 'Allergy season hits hard. Your eyes are watering and you can not stop sneezing!',
    choices: [
      { id: 'medicine', text: 'Buy allergy medicine', effects: { money: -40, stats: { health: 10 } } },
      { id: 'natural', text: 'Try natural remedies', effects: { money: -20, stats: { health: 5 } } },
      { id: 'suffer', text: 'Just deal with it', effects: { stats: { health: -5, happiness: -10 } } },
    ],
  }),
};

const socialMediaDetox: EventTemplate = {
  id: 'social_media_detox',
  category: 'health',
  weight: 0.3,
  generate: () => ({
    id: 'social_media_detox',
    description: 'You realize you have been spending too much time on social media. Time for a break?',
    choices: [
      { id: 'detox', text: 'Take a week off', effects: { stats: { happiness: 15, energy: 10 } } },
      { id: 'limit', text: 'Set time limits', effects: { stats: { happiness: 5 } } },
      { id: 'continue', text: 'It is fine', effects: { stats: { happiness: -5 } } },
    ],
  }),
};

const antiqueFinding: EventTemplate = {
  id: 'antique_finding',
  category: 'economy',
  weight: 0.15,
  generate: () => ({
    id: 'antique_finding',
    description: 'You find an old item at a garage sale that might be valuable!',
    choices: [
      { id: 'buy_appraise', text: 'Buy it ($50) and get it appraised', effects: { money: Math.random() > 0.5 ? 400 : -100, stats: { happiness: 10 } } },
      { id: 'skip', text: 'Probably junk', effects: {} },
    ],
  }),
};

const volunteerCoach: EventTemplate = {
  id: 'volunteer_coach',
  category: 'general',
  weight: 0.25,
  generate: () => ({
    id: 'volunteer_coach',
    description: 'The local youth sports team needs a volunteer coach. Interested?',
    choices: [
      { id: 'coach', text: 'Volunteer to coach', effects: { stats: { reputation: 15, happiness: 10, energy: -15 } } },
      { id: 'assist', text: 'Help out occasionally', effects: { stats: { reputation: 5, happiness: 5 } } },
      { id: 'decline', text: 'Not enough time', effects: {} },
    ],
  }),
};

const wineSurvey: EventTemplate = {
  id: 'wine_survey',
  category: 'general',
  weight: 0.3,
  condition: state => (state.date?.age || 18) >= 21,
  generate: () => ({
    id: 'wine_survey',
    description: 'A winery is offering free wine tasting in exchange for feedback.',
    choices: [
      { id: 'attend', text: 'Attend the tasting', effects: { stats: { happiness: 15, energy: -5 } } },
      { id: 'skip', text: 'Not interested', effects: {} },
    ],
  }),
};

// Vehicle Events
const speedingTicket: EventTemplate = {
  id: 'speeding_ticket',
  category: 'economy',
  weight: 0.15,
  condition: state => !!(state.vehicles || []).length && !!state.activeVehicleId,
  generate: state => {
    const vehicle = (state.vehicles || []).find(v => v.id === state.activeVehicleId);
    const fine = 150 + Math.floor(Math.random() * 100);
    return {
      id: 'speeding_ticket',
      description: `You got pulled over for speeding in your ${vehicle?.name || 'vehicle'}. The officer issues a ticket.`,
      choices: [
        { id: 'pay', text: `Pay the $${fine} fine`, effects: { money: -fine, stats: { reputation: -2 } } },
        { id: 'contest', text: 'Contest the ticket ($50 court fee)', effects: { money: Math.random() > 0.3 ? -50 : -fine, stats: { reputation: -1 } } },
      ],
    };
  },
};

const vehicleTheft: EventTemplate = {
  id: 'vehicle_theft',
  category: 'economy',
  weight: 0.05,
  condition: state => (state.vehicles || []).length > 0,
  generate: state => {
    const vehicles = state.vehicles || [];
    const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
    const hasInsurance = vehicle.insurance?.active;
    const recoveryChance = Math.random();

    return {
      id: 'vehicle_theft',
      description: `Your ${vehicle.name} was stolen! ${recoveryChance > 0.3 ? 'Police found it, but it needs repairs.' : 'It\'s gone for good.'}`,
      choices: recoveryChance > 0.3
        ? [
          {
            id: 'repair',
            text: hasInsurance ? 'File insurance claim (covers most costs)' : `Pay $${Math.floor(vehicle.price * 0.3)} for repairs`,
            effects: { money: hasInsurance ? -Math.floor(vehicle.price * 0.05) : -Math.floor(vehicle.price * 0.3), stats: { happiness: -10 } }
          },
        ]
        : [
          {
            id: 'accept',
            text: hasInsurance ? 'File insurance claim (get partial reimbursement)' : 'Accept the loss',
            effects: { money: hasInsurance ? Math.floor(vehicle.price * 0.5) : 0, stats: { happiness: -20, reputation: -5 } }
          },
        ],
    };
  },
};

const vehicleBreakdown: EventTemplate = {
  id: 'vehicle_breakdown',
  category: 'economy',
  weight: 0.2,
  condition: state => !!(state.vehicles || []).length && !!state.activeVehicleId,
  generate: state => {
    const vehicle = (state.vehicles || []).find(v => v.id === state.activeVehicleId);
    if (!vehicle) return { id: 'vehicle_breakdown', description: '', choices: [] };

    const repairCost = vehicle.condition < 30 ? 500 : vehicle.condition < 60 ? 300 : 150;
    const hasInsurance = vehicle.insurance?.active;
    const coveredCost = hasInsurance ? Math.floor(repairCost * (1 - (vehicle.insurance?.coveragePercent || 0) / 100)) : repairCost;

    return {
      id: 'vehicle_breakdown',
      description: `Your ${vehicle.name} broke down on the highway! ${vehicle.condition < 30 ? 'The engine needs major repairs.' : 'It needs immediate attention.'}`,
      choices: [
        {
          id: 'repair',
          text: hasInsurance ? `Get it repaired (insurance covers ${vehicle.insurance?.coveragePercent || 0}%, pay $${coveredCost})` : `Pay $${repairCost} for repairs`,
          effects: { money: -coveredCost, stats: { happiness: -5 } }
        },
        {
          id: 'delay',
          text: 'Wait and see (condition will worsen)',
          effects: { stats: { happiness: -10, energy: -5 } }
        },
      ],
    };
  },
};

const parkingTicket: EventTemplate = {
  id: 'parking_ticket',
  category: 'economy',
  weight: 0.25,
  condition: state => !!(state.vehicles || []).length && !!state.activeVehicleId,
  generate: () => {
    const fine = 50 + Math.floor(Math.random() * 50);
    return {
      id: 'parking_ticket',
      description: 'You find a parking ticket on your windshield. Expired meter!',
      choices: [
        { id: 'pay', text: `Pay the $${fine} fine`, effects: { money: -fine } },
        { id: 'ignore', text: 'Ignore it (risk higher fine)', effects: { money: Math.random() > 0.5 ? -fine * 2 : -fine, stats: { reputation: -2 } } },
      ],
    };
  },
};

export const eventTemplates: EventTemplate[] = [
  // Personal Crisis Events (added first for priority)
  ...personalCrisisEventTemplates,
  // Economic Event Templates (for individual economic events, not global state)
  ...economyEventTemplates,
  // Regular Events
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
  // Political Events
  politicalScandal,
  electionCampaign,
  policyProposal,
  partyMeeting,
  mediaInterview,
  constituentComplaint,
  lobbyistOffer,
  politicalDebate,
  coalitionFormation,
  publicProtest,
  // Policy Voting Events
  policyVotingEvent,
  // More Political Events
  budgetCrisis,
  corruptionInvestigation,
  internationalSummit,
  whistleblower,
  townHall,
  partySplit,
  mediaLeak,
  emergencySession,
  endorsement,
  constituentPetition,
  politicalFundraiser,
  policyBacklash,
  // Stock Market Policy Events
  stockMarketRegulation,
  companyTaxIncentive,
  marketCrashPrevention,
  // Real Estate Policy Events
  housingMarketStimulus,
  affordableHousingSuccess,
  // Education Policy Events
  educationReformImpact,
  educationScholarshipSuccess,
  // Crypto Policy Events
  cryptoRegulationChange,
  cryptoMiningBoom,
  // Technology Policy Events
  rdInnovationBoost,
  techStartupSuccess,
  // Healthcare Policy Events
  healthcareInitiative,
  publicHealthImprovement,
  // Transportation Policy Events
  transportationSubsidy,
  transitExpansionSuccess,
  // NEW Life Milestone Events
  milestoneBirthday30,
  milestoneBirthday50,
  lifeInsuranceOffer,
  // NEW Social Connection Events
  oldFriendReturns,
  familyReunion,
  networkingEvent,
  // NEW Opportunity Events
  investmentTip,
  businessPartnership,
  distantRelativeInheritance,
  freelanceOpportunity,
  // NEW Challenge Events
  identityTheft,
  naturalDisaster,
  healthScare,
  carAccident,
  // Vehicle Events
  speedingTicket,
  vehicleTheft,
  vehicleBreakdown,
  parkingTicket,
  // NEW Fame Events
  interviewRequest,
  scandalRumor,
  fanEncounter,
  brandDealOffer,
  viralMoment,
  // NEW Misc Life Events
  petsitterNeeded,
  communityService,
  onlineCourse,
  neighborConflict,
  scholarshipOpportunity, // STABILITY FIX: Poverty recovery path
  randomActKindness,
  unexpectedGift,
  bookClubInvite,
  fitnessChallenge,
  // ADDITIONAL NEW EVENTS (25+ more)
  unexpectedPromotion,
  workplaceConflict,
  surpriseParty,
  phoneLost,
  sleepIssues,
  mentorOffer,
  neighborMovingAway,
  hobbyDiscover,
  backPain,
  roadTrip,
  lostPet,
  talentShow,
  cookingDisaster,
  dentalCheckup,
  parkRun,
  carWash,
  musicFestival,
  gameNight,
  jobInterview,
  birthdayForgotten,
  taxRefund,
  powerOutage,
  charitableRequest,
  allergySeason,
  socialMediaDetox,
  antiqueFinding,
  volunteerCoach,
  wineSurvey,
  // Enhanced events with tradeoffs and hidden consequences
  ...enhancedEventTemplates,
  // Life milestone events (relationships, family, age, wellness)
  ...lifeMilestoneEventTemplates,
  // Career events (performance, workplace, firing)
  ...careerEventTemplates,
  // Travel events (experiences while on trips)
  ...travelEventTemplates,
  // Near-miss events (tension builders — "you almost died!")
  ...nearMissEventTemplates,
  // Fame tier events (paparazzi, talk shows, stalkers — fame = double-edged sword)
  ...fameEventTemplates,
  // Secret/Easter egg events (hidden triggers, community discovery)
  ...secretEventTemplates,
];

// ── ENGAGEMENT: Multi-week event chain definitions ──
// Each chain is a sequence of events that create "one more turn" cliffhangers.
// Chains use the existing activeEventChain / eventChains fields on GameState.

interface EventChainDefinition {
  chainId: string;
  /** Minimum weeksLived before this chain can trigger */
  minWeeksLived: number;
  maxWeeksLived?: number;
  /** Base probability per eligible week (before pity) */
  triggerChance: number;
  /** Additional condition */
  condition?: (state: GameState) => boolean;
  /** Ordered stages — each generates a WeeklyEvent */
  stages: ((state: GameState, stageIndex: number) => WeeklyEvent)[];
}

const eventChainDefinitions: EventChainDefinition[] = [
  // ── Health Scare: 3-stage chain ──
  {
    chainId: 'health_scare',
    minWeeksLived: 15,
    triggerChance: 0.03,
    condition: (s) => (s.stats?.health ?? 50) < 70,
    stages: [
      (_s, _i) => ({
        id: 'health_scare_symptoms',
        description:
          'You wake up with persistent chest pain and shortness of breath. Something feels wrong.',
        chainId: 'health_scare',
        chainStage: 0,
        choices: [
          {
            id: 'see_doctor',
            text: 'See a doctor immediately (-$200)',
            effects: { money: -200, stats: { energy: -10 } },
          },
          {
            id: 'ignore',
            text: 'Push through it',
            effects: { stats: { health: -8, energy: -5 } },
          },
        ],
      }),
      (s, _i) => {
        const sawDoctor = (s.eventLog || []).some(
          (e: any) => e.id === 'health_scare_symptoms' && e.choiceId === 'see_doctor',
        );
        return {
          id: 'health_scare_diagnosis',
          description: sawDoctor
            ? 'The doctor found the issue early. "Good thing you came in — we caught it before it got serious."'
            : 'The pain got worse. A trip to the ER reveals a condition that could have been caught earlier.',
          chainId: 'health_scare',
          chainStage: 1,
          choices: [
            {
              id: 'treatment',
              text: sawDoctor ? 'Start treatment (-$500)' : 'Emergency treatment (-$1,500)',
              effects: {
                money: sawDoctor ? -500 : -1500,
                stats: { health: sawDoctor ? 5 : -5, happiness: -10 },
              },
            },
            {
              id: 'alternative',
              text: 'Try lifestyle changes instead',
              effects: { stats: { happiness: -5, fitness: 5 } },
            },
          ],
        };
      },
      (s, _i) => {
        const gotTreatment = (s.eventLog || []).some(
          (e: any) => e.id === 'health_scare_diagnosis' && e.choiceId === 'treatment',
        );
        return {
          id: 'health_scare_recovery',
          description: gotTreatment
            ? 'After weeks of treatment, you feel better than ever. The experience changed your perspective on life.'
            : 'You managed to improve through sheer willpower, but the doctor warns it could return.',
          chainId: 'health_scare',
          chainStage: 2,
          choices: [
            {
              id: 'grateful',
              text: gotTreatment ? 'Embrace the new chapter' : 'Commit to healthier living',
              effects: {
                stats: {
                  health: gotTreatment ? 20 : 10,
                  happiness: 15,
                  fitness: gotTreatment ? 10 : 15,
                },
              },
            },
          ],
        };
      },
    ],
  },

  // ── Business Opportunity: 4-stage chain ──
  {
    chainId: 'business_opportunity',
    minWeeksLived: 20,
    triggerChance: 0.025,
    condition: (s) => (s.stats?.money ?? 0) >= 2000 && !!s.currentJob,
    stages: [
      (_s, _i) => ({
        id: 'biz_meet_investor',
        description:
          'At a networking event, a well-dressed stranger says: "I\'ve been watching your career. I have a proposition."',
        chainId: 'business_opportunity',
        chainStage: 0,
        choices: [
          { id: 'listen', text: 'Hear them out', effects: { stats: { happiness: 5 } } },
          { id: 'decline', text: 'Politely decline', effects: { stats: { happiness: -3 } } },
        ],
      }),
      (s, _i) => {
        const listened = (s.eventLog || []).some(
          (e: any) => e.id === 'biz_meet_investor' && e.choiceId === 'listen',
        );
        if (!listened) {
          return {
            id: 'biz_pitch',
            description:
              'You run into the investor again. "Last chance — this deal closes Friday."',
            chainId: 'business_opportunity',
            chainStage: 1,
            choices: [
              { id: 'invest_small', text: 'Invest a small amount (-$1,000)', effects: { money: -1000 } },
              { id: 'pass', text: 'Pass again', effects: {} },
            ],
          };
        }
        return {
          id: 'biz_pitch',
          description:
            'The investor presents the deal: a new venture in your field. "I need $2,000 to get started. You\'d own 20%."',
          chainId: 'business_opportunity',
          chainStage: 1,
          choices: [
            { id: 'invest_big', text: 'Go all in (-$2,000)', effects: { money: -2000, stats: { happiness: 10 } } },
            { id: 'invest_small', text: 'Invest half (-$1,000)', effects: { money: -1000 } },
            { id: 'pass', text: 'Too risky, pass', effects: {} },
          ],
        };
      },
      (_s, _i) => ({
        id: 'biz_waiting',
        description:
          'Weeks pass. The investment is showing early signs of activity. You receive a brief update: "Things are moving."',
        chainId: 'business_opportunity',
        chainStage: 2,
        choices: [
          { id: 'patient', text: 'Stay patient', effects: { stats: { happiness: -5 } } },
          { id: 'check_in', text: 'Check in on progress', effects: { stats: { energy: -5 } } },
        ],
      }),
      (s, _i) => {
        const investedBig = (s.eventLog || []).some(
          (e: any) => e.id === 'biz_pitch' && e.choiceId === 'invest_big',
        );
        const investedSmall = (s.eventLog || []).some(
          (e: any) => e.id === 'biz_pitch' && e.choiceId === 'invest_small',
        );
        const passed = !investedBig && !investedSmall;
        if (passed) {
          return {
            id: 'biz_results',
            description:
              'You hear the venture succeeded massively. The investors tripled their money. You feel a pang of regret.',
            chainId: 'business_opportunity',
            chainStage: 3,
            choices: [{ id: 'accept', text: 'Accept the lesson learned', effects: { stats: { happiness: -10 } } }],
          };
        }
        const payout = investedBig ? 6000 : 3000;
        return {
          id: 'biz_results',
          description: `The venture paid off! Your ${investedBig ? '$2,000' : '$1,000'} investment returned $${payout.toLocaleString()}.`,
          chainId: 'business_opportunity',
          chainStage: 3,
          choices: [
            {
              id: 'celebrate',
              text: `Collect your triple return (+$${payout.toLocaleString()})`,
              effects: { money: payout, stats: { happiness: 20 } },
            },
          ],
        };
      },
    ],
  },

  // ── Family Crisis: 3-stage chain ──
  {
    chainId: 'family_crisis',
    minWeeksLived: 25,
    triggerChance: 0.02,
    condition: (s) => (s.relationships || []).length > 0,
    stages: [
      (s, _i) => {
        const relationName = (s.relationships || [])[0]?.name || 'A close friend';
        return {
          id: 'family_crisis_call',
          description: `${relationName} calls you in tears: "I'm in serious trouble and I don't know who else to ask."`,
          chainId: 'family_crisis',
          chainStage: 0,
          choices: [
            { id: 'help_money', text: 'Send them money (-$500)', effects: { money: -500, stats: { happiness: -5 } } },
            { id: 'help_time', text: 'Drop everything and go help', effects: { stats: { energy: -25, happiness: -5 } } },
            { id: 'cant_help', text: '"I\'m sorry, I can\'t right now"', effects: { stats: { happiness: -15 } } },
          ],
        };
      },
      (s, _i) => {
        const helped =
          (s.eventLog || []).some(
            (e: any) =>
              e.id === 'family_crisis_call' && (e.choiceId === 'help_money' || e.choiceId === 'help_time'),
          );
        return {
          id: 'family_crisis_deepen',
          description: helped
            ? 'Your help made a real difference, but the situation is more complicated than expected. They need one more favor.'
            : "Things got worse. You hear through others that they're struggling badly. Guilt weighs on you.",
          chainId: 'family_crisis',
          chainStage: 1,
          choices: helped
            ? [
                { id: 'continue_help', text: 'See it through (-$300)', effects: { money: -300, stats: { energy: -10 } } },
                { id: 'set_boundary', text: '"I\'ve done what I can"', effects: { stats: { happiness: -10 } } },
              ]
            : [
                { id: 'reach_out', text: 'Reach out and apologize', effects: { stats: { happiness: 5, energy: -10 } } },
                { id: 'stay_away', text: 'Stay out of it', effects: { stats: { happiness: -15 } } },
              ],
        };
      },
      (s, _i) => {
        const helpedAtAll = (s.eventLog || []).some(
          (e: any) =>
            (e.id === 'family_crisis_call' && (e.choiceId === 'help_money' || e.choiceId === 'help_time')) ||
            (e.id === 'family_crisis_deepen' && (e.choiceId === 'continue_help' || e.choiceId === 'reach_out')),
        );
        return {
          id: 'family_crisis_resolution',
          description: helpedAtAll
            ? 'The crisis passed. They call you with tears of gratitude: "I will never forget what you did for me."'
            : 'The crisis eventually resolved, but the relationship may never be the same.',
          chainId: 'family_crisis',
          chainStage: 2,
          choices: [
            {
              id: 'reflect',
              text: helpedAtAll ? 'Feel proud of being there' : 'Reflect on what happened',
              effects: { stats: { happiness: helpedAtAll ? 25 : -5 }, money: helpedAtAll ? 200 : 0 },
            },
          ],
        };
      },
    ],
  },
];

/**
 * Check if any chain should start this week (used by rollWeeklyEvents).
 */
export function rollEventChain(state: GameState): WeeklyEvent | null {
  if (state.activeEventChain) return null;

  const wl = state.weeksLived || 0;
  const completedChainIds = (state.eventChains || [])
    .filter((c: any) => c.completed)
    .map((c: any) => c.chainId);

  for (const chain of eventChainDefinitions) {
    if (wl < chain.minWeeksLived) continue;
    if (chain.maxWeeksLived && wl > chain.maxWeeksLived) continue;
    if (completedChainIds.includes(chain.chainId)) continue;
    if (chain.condition && !chain.condition(state)) continue;

    const seed = (wl * 997 + chain.chainId.length * 31) % 10000;
    const roll = Math.sin(seed) * 10000 - Math.floor(Math.sin(seed) * 10000);
    if (roll < chain.triggerChance) {
      return chain.stages[0](state, 0);
    }
  }
  return null;
}

/**
 * Get the next event in an active chain.
 */
function getNextChainEvent(state: GameState): WeeklyEvent | null {
  const active = state.activeEventChain;
  if (!active) return null;

  const chain = eventChainDefinitions.find((c) => c.chainId === active.chainId);
  if (!chain) return null;

  const nextStage = active.currentStage + 1;
  if (nextStage >= chain.stages.length) return null;

  return chain.stages[nextStage](state, nextStage);
}

// ── ENGAGEMENT: Guaranteed starter events for new players ──
// These fire once at specific weeks to create positive first impressions
const starterEventTemplates: EventTemplate[] = [
  {
    id: 'starter_luck',
    category: 'economy',
    weight: 100,
    condition: (state) => (state.weeksLived || 0) === 0,
    generate: () => ({
      id: 'starter_luck',
      description: 'A relative left you a small envelope with a note: "Use this wisely — the world is yours."',
      choices: [
        {
          id: 'save',
          text: 'Save it wisely (+$300)',
          effects: { money: 300, stats: { happiness: 10 } },
        },
        {
          id: 'invest',
          text: 'Invest in yourself (+$150, +Energy)',
          effects: { money: 150, stats: { happiness: 15, energy: 20 } },
        },
      ],
    }),
  },
  {
    id: 'first_paycheck_bonus',
    category: 'economy',
    weight: 100,
    condition: (state) => {
      const wl = state.weeksLived || 0;
      return wl >= 2 && wl <= 5 && !!state.currentJob &&
        !(state.eventLog || []).some(e => e.id === 'first_paycheck_bonus');
    },
    generate: () => ({
      id: 'first_paycheck_bonus',
      description: 'Your boss pulls you aside: "Great start — here\'s a little extra for your hard work."',
      choices: [
        {
          id: 'accept',
          text: 'Accept gratefully (+$150)',
          effects: { money: 150, stats: { happiness: 10, reputation: 5 } },
        },
      ],
    }),
  },
  {
    id: 'surprise_windfall',
    category: 'economy',
    weight: 100,
    condition: (state) => {
      const wl = state.weeksLived || 0;
      return wl >= 5 && wl <= 8 &&
        !(state.eventLog || []).some(e => e.id === 'surprise_windfall');
    },
    generate: (state) => {
      const baseAmount = 200 + Math.floor(((state.weeksLived || 0) * 37) % 300);
      return {
        id: 'surprise_windfall',
        description: `You found a scratch-off ticket in your jacket pocket — and it\'s a winner!`,
        choices: [
          {
            id: 'cash_it',
            text: `Cash it in (+$${baseAmount})`,
            effects: { money: baseAmount, stats: { happiness: 15 } },
          },
          {
            id: 'share_it',
            text: `Share the winnings (+$${Math.floor(baseAmount / 2)}, +Reputation)`,
            effects: { money: Math.floor(baseAmount / 2), stats: { happiness: 10, reputation: 10 } },
          },
        ],
      };
    },
  },
];

const MAX_EVENTS_PER_WEEK = 1; // Only one event per week maximum
const EVENT_FREQUENCY_MODIFIER = 0.06; // 6% multiplier (was 10%) - less annoying for players

/**
 * Roll weekly events with reduced frequency
 * 
 * KEY CHANGES (UX improvement):
 * - Events now occur randomly with approximately 1 in 25-35 weeks frequency (3-5% chance)
 * - Pity system extended to 10 weeks to reduce guaranteed events
 * - This makes events feel more special and less annoying
 * - Players will experience longer periods of calm gameplay
 */

export function rollWeeklyEvents(state: GameState): WeeklyEvent[] {
  const events: WeeklyEvent[] = [];

  // Check for economic events first (they affect all players globally)
  // Economic events are checked and updated before other events
  const currentState = getCurrentEconomicState(state);
  const weeksLived = state.weeksLived || 0;

  if (shouldTriggerEconomicEvent(state)) {
    const newEconomicState = generateEconomicEvent(state);
    // Note: The actual state update should be handled in the week progression
    // Here we just generate the event notification

    // Check if this is a transition event (start or end)
    if (currentState && currentState.currentState !== 'normal') {
      const weeksInState = weeksLived - currentState.stateStartWeek;
      if (weeksInState >= currentState.stateDuration) {
        // Event ending - check for end notification event
        for (const template of economyEventTemplates) {
          if (template.id === 'economic_event_end' && template.condition && template.condition(state)) {
            const event = template.generate(state);
            if (event) {
              events.push(event);
              break;
            }
          }
        }
      }
    } else {
      // New economic event starting (currentState is null or normal)
      // Check if the new state is different from current (i.e., starting a new event)
      if (newEconomicState.currentState !== 'normal') {
        // Generate start notification event
        // Create a temporary state with the new economic state to check conditions
        const tempState = {
          ...state,
          economy: {
            ...state.economy,
            economyEvents: newEconomicState,
          },
          weeksLived: weeksLived,
        };

        for (const template of economyEventTemplates) {
          if (template.id !== 'economic_event_end' && template.condition && template.condition(tempState)) {
            const event = template.generate(tempState);
            if (event) {
              events.push(event);
              break;
            }
          }
        }
      }
    }
  }

  // Check for seasonal events (they have priority after economic events)
  const seasonalEvents = getSeasonalEvents(state);
  if (seasonalEvents.length > 0 && events.length < MAX_EVENTS_PER_WEEK) {
    const remainingSlots = MAX_EVENTS_PER_WEEK - events.length;
    events.push(...seasonalEvents.slice(0, remainingSlots));
  }

  // If we already have max events, return early
  if (events.length >= MAX_EVENTS_PER_WEEK) {
    return events;
  }

  // ENGAGEMENT: Check for guaranteed starter events (new player onboarding)
  // These fire with 100% probability when conditions are met, before random events
  for (const starter of starterEventTemplates) {
    if (events.length >= MAX_EVENTS_PER_WEEK) break;
    if (starter.condition && starter.condition(state)) {
      try {
        const event = starter.generate(state);
        if (event) {
          events.push(event);
        }
      } catch (e) {
        // Starter event generation failed — continue without it
      }
    }
  }
  if (events.length >= MAX_EVENTS_PER_WEEK) {
    return events;
  }

  // ENGAGEMENT: Check for active event chain continuation
  // Chain events take priority over random events to maintain narrative flow
  if (state.activeEventChain && events.length < MAX_EVENTS_PER_WEEK) {
    const chainEvent = getNextChainEvent(state);
    if (chainEvent) {
      events.push(chainEvent);
      return events; // Chain events are exclusive — no random events this week
    }
  }

  // ENGAGEMENT: Roll for starting a new event chain (if none active)
  if (!state.activeEventChain && events.length < MAX_EVENTS_PER_WEEK) {
    const chainStarter = rollEventChain(state);
    if (chainStarter) {
      events.push(chainStarter);
      return events;
    }
  }

  // Get consequence state (NEW - integrates with existing system)
  const { initializeConsequenceState } = require('@/lib/lifeMoments/consequenceTracker');
  const consequenceState = initializeConsequenceState(state);

  // Filter event templates based on consequences (NEW)
  // This happens after economic/seasonal events but before main selection
  const baseEventTemplates = eventTemplates.filter(template => {
    // Skip locked events
    if (consequenceState.lockedEvents.includes(template.id)) {
      return false;
    }

    // Check existing conditions (preserve existing logic)
    if (template.condition && !template.condition(state)) {
      return false;
    }

    return true;
  });

  // RANDOMNESS FIX: Pity system for weekly events - guaranteed event after 6 weeks without
  // MIGRATION NOTE: For old saves without lastEventWeek, default to 0 (treats as "just had event")
  // This prevents immediate guaranteed event on first load of old saves
  // PRIORITY 2 FIX: Use constant from randomnessConstants
  // TIME PROGRESSION FIX: Use weeksLived for pity calculation to handle year boundaries correctly
  const { PITY_THRESHOLD_WEEKLY_EVENTS } = require('@/lib/randomness/randomnessConstants');
  const currentWeeksLived = state.weeksLived || 0;
  const lastEventWeeksLived = state.lastEventWeeksLived !== undefined
    ? state.lastEventWeeksLived
    : (state.lastEventWeek !== undefined ? state.lastEventWeek : 0); // Fallback for old saves
  const weeksSinceLastEvent = currentWeeksLived - lastEventWeeksLived;
  // ENGAGEMENT: Shorter pity timer during mid-game to prevent long event droughts
  const pityThreshold = currentWeeksLived < 50 ? 8 : PITY_THRESHOLD_WEEKLY_EVENTS;
  // Seasonal events count as events, so they reset the pity counter (guaranteedEvent only triggers if NO events)
  const guaranteedEvent = weeksSinceLastEvent >= pityThreshold && seasonalEvents.length === 0;

  // TESTFLIGHT FIX: Deterministic random based on week number for consistency on resume
  // Use a simple seeded random function based on week number
  // TIME PROGRESSION FIX: Use weeksLived for deterministic seeding to handle year boundaries correctly
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  const weekSeed = (state.weeksLived || 0) * 1000 + (state.date?.year || 2025) * 100;

  // ENGAGEMENT: Phase-based event frequency scaling
  // Early game: rare (player is learning). Mid-game: frequent (content variety). Late game: moderate.
  let baseEventChance: number;
  if (currentWeeksLived < 8) {
    baseEventChance = 0.02; // 2% — player still learning
  } else if (currentWeeksLived < 50) {
    baseEventChance = 0.08 + Math.min(0.07, currentWeeksLived * 0.001); // 8-15% — mid-game variety
  } else {
    baseEventChance = 0.06; // 6% — moderate late game
  }
  baseEventChance += seededRandom(weekSeed) * 0.01; // Small deterministic jitter

  // Apply prestige event frequency reduction (QoL bonus)
  const unlockedBonuses = state.prestige?.unlockedBonuses || [];
  const eventFrequencyModifier = getEventFrequencyModifier(unlockedBonuses);
  baseEventChance = baseEventChance * eventFrequencyModifier;

  // Force event if pity threshold reached
  // TESTFLIGHT FIX: Use deterministic random for consistency
  if (guaranteedEvent || seededRandom(weekSeed + 1) < baseEventChance) {
    // Event will occur - continue to event selection
  } else {
    return events; // Return seasonal events if any, otherwise empty
  }

  const economyRisk = state.stats.money < 200 ? 0.4 : 0.15;
  const healthRisk = state.stats.health < 60 ? 0.4 : 0.15;
  const avgRelation =
    state.relationships.length > 0
      ? state.relationships.reduce((sum, r) => sum + r.relationshipScore, 0) / state.relationships.length
      : 50;
  const relationRisk = avgRelation < 50 ? 0.35 : 0.15;

  const riskByCategory = {
    economy: economyRisk,
    health: healthRisk,
    relationship: relationRisk,
    general: 0.2,
  } as const;

  // RANDOMNESS FIX: If guaranteed event (pity system), force at least one event
  // EDGE CASE: If no eligible events (all have unmet conditions), fallback to general event
  let eventForced = false;
  if (guaranteedEvent && events.length === 0) {
    // Force the highest weight event that meets conditions
    const eligibleEvents = baseEventTemplates
      .filter(t => !t.condition || t.condition(state))
      .sort((a, b) => {
        const weightA = typeof a.weight === 'function' ? a.weight(state) : a.weight;
        const weightB = typeof b.weight === 'function' ? b.weight(state) : b.weight;
        const modifierA = consequenceState.eventWeightModifiers[a.id] || 0;
        const modifierB = consequenceState.eventWeightModifiers[b.id] || 0;
        return (weightB + modifierB) - (weightA + modifierA); // Include modifiers in sort
      });

    if (eligibleEvents.length > 0) {
      events.push(eligibleEvents[0].generate(state));
      eventForced = true;
    } else {
      // Fallback: Force a general event if no eligible events (should never happen, but defensive)
      const generalEvent = baseEventTemplates.find(t => t.category === 'general');
      if (generalEvent) {
        events.push(generalEvent.generate(state));
        eventForced = true;
      } else {
        // Last resort: Log warning if even general events are unavailable
        logger.warn('Event pity system: No eligible events found, including general events');
      }
    }
  }

  // If event was forced, skip random selection
  if (!eventForced) {
    // Track if we've already added a personal crisis event this week
    // Personal crisis events: medical_emergency, identity_theft, relationship_crisis, legal_issue
    // (investment_opportunity and job_offer are opportunities, not crises)
    const personalCrisisEventIds = ['medical_emergency', 'identity_theft', 'relationship_crisis', 'legal_issue'];
    let hasPersonalCrisis = false;

    for (const template of baseEventTemplates) {
      if (events.length >= MAX_EVENTS_PER_WEEK) break;
      if (template.condition && !template.condition(state)) continue;

      // Prevent multiple personal crisis events in the same week
      const isPersonalCrisis = personalCrisisEventIds.includes(template.id);
      if (isPersonalCrisis && hasPersonalCrisis) {
        continue; // Skip this personal crisis event if we already have one
      }

      const weight = typeof template.weight === 'function' ? template.weight(state) : template.weight;

      // Apply weight modifiers from consequences (NEW)
      const weightModifier = consequenceState.eventWeightModifiers[template.id] || 0;
      const adjustedWeight = Math.max(0, weight + weightModifier);

      const chance = adjustedWeight * riskByCategory[template.category] * EVENT_FREQUENCY_MODIFIER;
      // TESTFLIGHT FIX: Use deterministic random based on template index for consistency
      const templateSeed = weekSeed + 100 + eventTemplates.indexOf(template);
      if (seededRandom(templateSeed) < chance) {
        events.push(template.generate(state));
        if (isPersonalCrisis) {
          hasPersonalCrisis = true; // Mark that we've added a personal crisis event
        }
      }
    }
  }

  return events;
}
