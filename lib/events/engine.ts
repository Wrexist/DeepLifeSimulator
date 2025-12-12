import type { GameState, GameStats } from '@/contexts/GameContext';
import { marketCrash, sideGig, earningsReport } from './economy';
import { getSeasonalEvents } from './seasonalEvents';
import { POLICIES } from '@/lib/politics/policies';
import { getEventFrequencyModifier } from '@/lib/prestige/applyQOLBonuses';

export interface EventChoiceEffects {
  money?: number;
  stats?: Partial<GameStats>;
  relationship?: number; // change to specific relation if relationId provided
  pet?: { hunger?: number; happiness?: number; health?: number };
  policy?: string; // Policy ID that gets enacted
  approvalRating?: number; // Change to political approval rating
  policyInfluence?: number; // Change to policy influence
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
  condition: state => Boolean(state.politics && state.politics.careerLevel > 0 && state.politics.nextElectionWeek && state.week >= state.politics.nextElectionWeek - 4),
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
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.nextElectionWeek && state.week >= state.politics.nextElectionWeek - 2),
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
  condition: state => Boolean(state.politics && state.politics.careerLevel >= 2 && state.politics.nextElectionWeek && state.week >= state.politics.nextElectionWeek - 8),
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
  generate: () => ({
    id: 'investment_tip',
    description: 'A successful investor shares a tip about an undervalued stock. It could double or lose 50%.',
    choices: [
      { id: 'invest_big', text: 'Invest $5,000', effects: { money: Math.random() > 0.5 ? 5000 : -2500 } },
      { id: 'invest_small', text: 'Invest $1,000', effects: { money: Math.random() > 0.5 ? 1000 : -500 } },
      { id: 'pass', text: 'Pass on the opportunity', effects: {} },
    ],
  }),
};

const businessPartnership: EventTemplate = {
  id: 'business_partnership',
  category: 'economy',
  weight: 0.25,
  condition: state => state.companies && state.companies.length > 0,
  generate: () => ({
    id: 'business_partnership',
    description: 'A successful entrepreneur wants to partner with your business. They offer capital for equity.',
    choices: [
      { id: 'accept', text: 'Accept the partnership', effects: { money: 50000, stats: { reputation: 10 } } },
      { id: 'negotiate', text: 'Negotiate better terms', effects: { money: 75000, stats: { reputation: 5 } } },
      { id: 'decline', text: 'Keep full ownership', effects: { stats: { reputation: -5 } } },
    ],
  }),
};

const distantRelativeInheritance: EventTemplate = {
  id: 'distant_relative_inheritance',
  category: 'economy',
  weight: 0.15,
  generate: () => {
    const inheritance = Math.floor(Math.random() * 10000) + 5000;
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
  const events: WeeklyEvent[] = [];
  
  // Check for seasonal events first (they have priority)
  const seasonalEvents = getSeasonalEvents(state);
  if (seasonalEvents.length > 0) {
    events.push(...seasonalEvents);
  }
  
  // If we already have 2 events (max), return early
  if (events.length >= MAX_EVENTS_PER_WEEK) {
    return events;
  }
  
  // Base random chance for any event to occur (approximately 1 in 4 weeks)
  // Add some variation: 20-30% chance to make it feel more natural
  let baseEventChance = 0.2 + (Math.random() * 0.1); // 20-30% chance
  
  // Apply prestige event frequency reduction (QoL bonus)
  const unlockedBonuses = state.prestige?.unlockedBonuses || [];
  const eventFrequencyModifier = getEventFrequencyModifier(unlockedBonuses);
  baseEventChance = baseEventChance * eventFrequencyModifier;
  
  if (Math.random() > baseEventChance) {
    return events; // Return seasonal events if any, otherwise empty
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

