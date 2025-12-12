export interface SocialEvent {
  id: string;
  type: SocialEventType;
  title: string;
  description: string;
  participants: string[]; // relationship IDs
  location: string;
  cost: number;
  energyCost: number;
  duration: number; // in hours
  requirements: {
    minRelationshipLevel?: number;
    maxParticipants?: number;
    minParticipants?: number;
    requiredItems?: string[];
    weatherDependent?: boolean;
  };
  outcomes: SocialEventOutcome[];
  cooldown: number; // hours before can be repeated
  category: SocialEventCategory;
  seasonality?: 'spring' | 'summer' | 'fall' | 'winter' | 'any';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | 'any';
}

export type SocialEventType = 
  | 'date'
  | 'party'
  | 'dinner'
  | 'movie'
  | 'concert'
  | 'sports'
  | 'travel'
  | 'gaming'
  | 'study'
  | 'workout'
  | 'shopping'
  | 'volunteer'
  | 'family'
  | 'business'
  | 'casual';

export type SocialEventCategory = 
  | 'romantic'
  | 'friendship'
  | 'family'
  | 'professional'
  | 'casual'
  | 'adventure'
  | 'cultural'
  | 'sports'
  | 'entertainment';

export interface SocialEventOutcome {
  id: string;
  probability: number; // 0-1
  relationshipChange: number;
  happinessChange: number;
  energyChange: number;
  moneyChange: number;
  reputationChange: number;
  specialEffects?: {
    unlockAchievement?: string;
    gainItem?: string;
    unlockEvent?: string;
    relationshipMilestone?: string;
  };
  description: string;
  requirements?: {
    minRelationshipLevel?: number;
    maxRelationshipLevel?: number;
    weatherCondition?: string;
    timeOfDay?: string;
    participantCount?: number;
  };
}

export interface RelationshipMilestone {
  id: string;
  relationshipId: string;
  type: RelationshipMilestoneType;
  title: string;
  description: string;
  achievedAt: number;
  relationshipLevel: number;
  specialReward?: {
    type: 'money' | 'gems' | 'happiness' | 'reputation' | 'item';
    amount: number;
    itemId?: string;
  };
}

export type RelationshipMilestoneType = 
  | 'first_meeting'
  | 'first_date'
  | 'first_kiss'
  | 'exclusive'
  | 'moving_in'
  | 'engagement'
  | 'marriage'
  | 'first_fight'
  | 'makeup'
  | 'anniversary'
  | 'best_friend'
  | 'business_partner'
  | 'mentor'
  | 'family_member';

export interface SocialInteraction {
  id: string;
  relationshipId: string;
  type: SocialInteractionType;
  action: string;
  response: string;
  relationshipChange: number;
  happinessChange: number;
  energyCost: number;
  moneyCost: number;
  timestamp: number;
  context: string;
  mood: 'positive' | 'neutral' | 'negative';
}

export type SocialInteractionType = 
  | 'conversation'
  | 'gift'
  | 'compliment'
  | 'support'
  | 'advice'
  | 'celebration'
  | 'apology'
  | 'conflict'
  | 'surprise'
  | 'help';

export interface SocialGroup {
  id: string;
  name: string;
  description: string;
  members: string[]; // relationship IDs
  type: SocialGroupType;
  level: number;
  activities: string[]; // social event IDs
  benefits: {
    relationshipBonus: number;
    happinessBonus: number;
    reputationBonus: number;
    unlockEvents: string[];
  };
  requirements: {
    minMembers: number;
    maxMembers: number;
    minRelationshipLevel: number;
  };
}

export type SocialGroupType = 
  | 'friend_group'
  | 'family'
  | 'work_team'
  | 'hobby_club'
  | 'study_group'
  | 'sports_team'
  | 'book_club'
  | 'gaming_guild'
  | 'volunteer_group'
  | 'business_network';

// Pre-defined social events
export const SOCIAL_EVENTS: SocialEvent[] = [
  // Romantic Events
  {
    id: 'romantic_dinner',
    type: 'dinner',
    title: 'Romantic Dinner',
    description: 'A candlelit dinner for two at a fancy restaurant',
    participants: [],
    location: 'Restaurant',
    cost: 150,
    energyCost: 20,
    duration: 3,
    requirements: {
      minRelationshipLevel: 30,
      maxParticipants: 2,
      minParticipants: 2,
    },
    outcomes: [
      {
        id: 'perfect_dinner',
        probability: 0.3,
        relationshipChange: 15,
        happinessChange: 20,
        energyChange: -20,
        moneyChange: -150,
        reputationChange: 2,
        description: 'The dinner was perfect! Great conversation and connection.',
        specialEffects: {
          relationshipMilestone: 'romantic_moment'
        }
      },
      {
        id: 'good_dinner',
        probability: 0.5,
        relationshipChange: 10,
        happinessChange: 15,
        energyChange: -20,
        moneyChange: -150,
        reputationChange: 1,
        description: 'A nice dinner with good conversation.'
      },
      {
        id: 'awkward_dinner',
        probability: 0.2,
        relationshipChange: 5,
        happinessChange: 5,
        energyChange: -20,
        moneyChange: -150,
        reputationChange: 0,
        description: 'The dinner was a bit awkward, but you made the best of it.'
      }
    ],
    cooldown: 24,
    category: 'romantic'
  },
  {
    id: 'movie_date',
    type: 'movie',
    title: 'Movie Date',
    description: 'Watch a movie together at the cinema',
    participants: [],
    location: 'Cinema',
    cost: 50,
    energyCost: 15,
    duration: 2,
    requirements: {
      minRelationshipLevel: 20,
      maxParticipants: 2,
      minParticipants: 2,
    },
    outcomes: [
      {
        id: 'great_movie',
        probability: 0.4,
        relationshipChange: 12,
        happinessChange: 18,
        energyChange: -15,
        moneyChange: -50,
        reputationChange: 0,
        description: 'You both loved the movie and had great discussions about it.'
      },
      {
        id: 'okay_movie',
        probability: 0.4,
        relationshipChange: 8,
        happinessChange: 12,
        energyChange: -15,
        moneyChange: -50,
        reputationChange: 0,
        description: 'The movie was okay, but you enjoyed spending time together.'
      },
      {
        id: 'bad_movie',
        probability: 0.2,
        relationshipChange: 5,
        happinessChange: 8,
        energyChange: -15,
        moneyChange: -50,
        reputationChange: 0,
        description: 'The movie wasn\'t great, but you laughed about it together.'
      }
    ],
    cooldown: 12,
    category: 'romantic'
  },

  // Friendship Events
  {
    id: 'friend_hangout',
    type: 'casual',
    title: 'Friend Hangout',
    description: 'Casual hangout with friends at a coffee shop',
    participants: [],
    location: 'Coffee Shop',
    cost: 25,
    energyCost: 10,
    duration: 2,
    requirements: {
      minRelationshipLevel: 15,
      maxParticipants: 6,
      minParticipants: 2,
    },
    outcomes: [
      {
        id: 'fun_hangout',
        probability: 0.6,
        relationshipChange: 8,
        happinessChange: 15,
        energyChange: -10,
        moneyChange: -25,
        reputationChange: 0,
        description: 'Great conversation and laughs with friends.'
      },
      {
        id: 'chill_hangout',
        probability: 0.4,
        relationshipChange: 5,
        happinessChange: 10,
        energyChange: -10,
        moneyChange: -25,
        reputationChange: 0,
        description: 'A relaxing time catching up with friends.'
      }
    ],
    cooldown: 8,
    category: 'friendship'
  },
  {
    id: 'game_night',
    type: 'gaming',
    title: 'Game Night',
    description: 'Board games and video games with friends',
    participants: [],
    location: 'Home',
    cost: 20,
    energyCost: 15,
    duration: 4,
    requirements: {
      minRelationshipLevel: 10,
      maxParticipants: 8,
      minParticipants: 3,
    },
    outcomes: [
      {
        id: 'epic_games',
        probability: 0.3,
        relationshipChange: 12,
        happinessChange: 20,
        energyChange: -15,
        moneyChange: -20,
        reputationChange: 0,
        description: 'Epic gaming session with lots of fun and competition!'
      },
      {
        id: 'fun_games',
        probability: 0.5,
        relationshipChange: 8,
        happinessChange: 15,
        energyChange: -15,
        moneyChange: -20,
        reputationChange: 0,
        description: 'Fun games and good times with friends.'
      },
      {
        id: 'chill_games',
        probability: 0.2,
        relationshipChange: 5,
        happinessChange: 10,
        energyChange: -15,
        moneyChange: -20,
        reputationChange: 0,
        description: 'Chill gaming session with friends.'
      }
    ],
    cooldown: 12,
    category: 'friendship'
  },

  // Family Events
  {
    id: 'family_dinner',
    type: 'family',
    title: 'Family Dinner',
    description: 'Weekly family dinner gathering',
    participants: [],
    location: 'Home',
    cost: 40,
    energyCost: 12,
    duration: 2,
    requirements: {
      minRelationshipLevel: 25,
      maxParticipants: 10,
      minParticipants: 3,
    },
    outcomes: [
      {
        id: 'warm_family_time',
        probability: 0.5,
        relationshipChange: 10,
        happinessChange: 18,
        energyChange: -12,
        moneyChange: -40,
        reputationChange: 0,
        description: 'Warm and loving family time with great food and conversation.'
      },
      {
        id: 'normal_family_dinner',
        probability: 0.3,
        relationshipChange: 6,
        happinessChange: 12,
        energyChange: -12,
        moneyChange: -40,
        reputationChange: 0,
        description: 'Nice family dinner with good food.'
      },
      {
        id: 'dramatic_family_dinner',
        probability: 0.2,
        relationshipChange: 2,
        happinessChange: 5,
        energyChange: -12,
        moneyChange: -40,
        reputationChange: 0,
        description: 'Family dinner with some drama, but you worked through it.'
      }
    ],
    cooldown: 24,
    category: 'family'
  },

  // Professional Events
  {
    id: 'business_networking',
    type: 'business',
    title: 'Business Networking',
    description: 'Professional networking event to build business connections',
    participants: [],
    location: 'Conference Center',
    cost: 100,
    energyCost: 25,
    duration: 3,
    requirements: {
      minRelationshipLevel: 20,
      maxParticipants: 50,
      minParticipants: 5,
    },
    outcomes: [
      {
        id: 'great_connections',
        probability: 0.3,
        relationshipChange: 15,
        happinessChange: 10,
        energyChange: -25,
        moneyChange: -100,
        reputationChange: 10,
        description: 'Made excellent business connections and potential partnerships.'
      },
      {
        id: 'good_networking',
        probability: 0.5,
        relationshipChange: 10,
        happinessChange: 8,
        energyChange: -25,
        moneyChange: -100,
        reputationChange: 5,
        description: 'Good networking event with some valuable connections.'
      },
      {
        id: 'okay_networking',
        probability: 0.2,
        relationshipChange: 5,
        happinessChange: 5,
        energyChange: -25,
        moneyChange: -100,
        reputationChange: 2,
        description: 'Decent networking event, made a few contacts.'
      }
    ],
    cooldown: 48,
    category: 'professional'
  },

  // Adventure Events
  {
    id: 'hiking_adventure',
    type: 'sports',
    title: 'Hiking Adventure',
    description: 'Explore nature with friends on a hiking trail',
    participants: [],
    location: 'Mountain Trail',
    cost: 30,
    energyCost: 30,
    duration: 6,
    requirements: {
      minRelationshipLevel: 15,
      maxParticipants: 8,
      minParticipants: 2,
      weatherDependent: true,
    },
    outcomes: [
      {
        id: 'amazing_hike',
        probability: 0.4,
        relationshipChange: 15,
        happinessChange: 25,
        energyChange: -30,
        moneyChange: -30,
        reputationChange: 0,
        description: 'Amazing hike with beautiful views and great company!'
      },
      {
        id: 'good_hike',
        probability: 0.4,
        relationshipChange: 10,
        happinessChange: 18,
        energyChange: -30,
        moneyChange: -30,
        reputationChange: 0,
        description: 'Good hike with friends, enjoyed the exercise and nature.'
      },
      {
        id: 'challenging_hike',
        probability: 0.2,
        relationshipChange: 8,
        happinessChange: 12,
        energyChange: -30,
        moneyChange: -30,
        reputationChange: 0,
        description: 'Challenging hike, but you supported each other through it.'
      }
    ],
    cooldown: 72,
    category: 'adventure'
  }
];

// Social groups
export const SOCIAL_GROUPS: SocialGroup[] = [
  {
    id: 'close_friends',
    name: 'Close Friends',
    description: 'Your inner circle of closest friends',
    members: [],
    type: 'friend_group',
    level: 1,
    activities: ['friend_hangout', 'game_night'],
    benefits: {
      relationshipBonus: 1.2,
      happinessBonus: 1.1,
      reputationBonus: 1.0,
      unlockEvents: ['friend_vacation', 'friend_birthday_party']
    },
    requirements: {
      minMembers: 3,
      maxMembers: 6,
      minRelationshipLevel: 40
    }
  },
  {
    id: 'work_colleagues',
    name: 'Work Colleagues',
    description: 'Professional relationships at work',
    members: [],
    type: 'work_team',
    level: 1,
    activities: ['business_networking', 'work_lunch'],
    benefits: {
      relationshipBonus: 1.1,
      happinessBonus: 1.0,
      reputationBonus: 1.3,
      unlockEvents: ['work_retreat', 'promotion_party']
    },
    requirements: {
      minMembers: 2,
      maxMembers: 15,
      minRelationshipLevel: 20
    }
  },
  {
    id: 'family_unit',
    name: 'Family Unit',
    description: 'Your immediate family members',
    members: [],
    type: 'family',
    level: 1,
    activities: ['family_dinner', 'family_vacation'],
    benefits: {
      relationshipBonus: 1.3,
      happinessBonus: 1.2,
      reputationBonus: 1.1,
      unlockEvents: ['family_reunion', 'holiday_celebration']
    },
    requirements: {
      minMembers: 2,
      maxMembers: 8,
      minRelationshipLevel: 30
    }
  }
];

// Social interaction templates
export const SOCIAL_INTERACTIONS = {
  conversation: {
    positive: [
      { action: 'Have a deep conversation', response: 'They open up and share personal thoughts', relationshipChange: 8, happinessChange: 12 },
      { action: 'Share a funny story', response: 'They laugh and share their own story', relationshipChange: 6, happinessChange: 15 },
      { action: 'Discuss shared interests', response: 'Great discussion with lots of enthusiasm', relationshipChange: 7, happinessChange: 10 },
    ],
    neutral: [
      { action: 'Make small talk', response: 'Pleasant conversation about everyday topics', relationshipChange: 3, happinessChange: 5 },
      { action: 'Ask about their day', response: 'They share some details about their activities', relationshipChange: 4, happinessChange: 6 },
    ],
    negative: [
      { action: 'Bring up a sensitive topic', response: 'They seem uncomfortable and change the subject', relationshipChange: -2, happinessChange: -3 },
      { action: 'Complain about something', response: 'They try to be supportive but seem drained', relationshipChange: 1, happinessChange: -2 },
    ]
  },
  gift: {
    positive: [
      { action: 'Give a thoughtful gift', response: 'They are touched and grateful', relationshipChange: 12, happinessChange: 18, moneyCost: 50 },
      { action: 'Give a small surprise', response: 'They are pleasantly surprised', relationshipChange: 8, happinessChange: 12, moneyCost: 25 },
    ],
    neutral: [
      { action: 'Give a practical gift', response: 'They appreciate the thoughtfulness', relationshipChange: 6, happinessChange: 8, moneyCost: 30 },
    ],
    negative: [
      { action: 'Give an inappropriate gift', response: 'They seem confused and uncomfortable', relationshipChange: -3, happinessChange: -5, moneyCost: 20 },
    ]
  },
  support: {
    positive: [
      { action: 'Offer emotional support', response: 'They feel comforted and supported', relationshipChange: 10, happinessChange: 15 },
      { action: 'Help with a problem', response: 'They are grateful for your assistance', relationshipChange: 8, happinessChange: 12 },
    ],
    neutral: [
      { action: 'Listen to their concerns', response: 'They appreciate having someone to talk to', relationshipChange: 5, happinessChange: 8 },
    ],
    negative: [
      { action: 'Give unsolicited advice', response: 'They seem annoyed by your input', relationshipChange: -2, happinessChange: -3 },
    ]
  }
};

// Utility functions
export const calculateRelationshipCompatibility = (relationship1: any, relationship2: any): number => {
  // Calculate compatibility based on shared interests, values, etc.
  let compatibility = 0.5; // base compatibility
  
  // Add compatibility bonuses based on shared traits
  if (relationship1.interests && relationship2.interests) {
    const sharedInterests = relationship1.interests.filter((interest: string) => 
      relationship2.interests.includes(interest)
    );
    compatibility += sharedInterests.length * 0.1;
  }
  
  return Math.min(1, Math.max(0, compatibility));
};

export const getSocialEventOutcome = (event: SocialEvent, participants: any[]): SocialEventOutcome => {
  // Calculate weighted random outcome based on relationship levels and other factors
  const totalRelationshipLevel = participants.reduce((sum, p) => sum + (p.relationshipLevel || 0), 0);
  const avgRelationshipLevel = totalRelationshipLevel / participants.length;
  
  // Adjust probabilities based on relationship level
  const adjustedOutcomes = event.outcomes.map(outcome => ({
    ...outcome,
    probability: outcome.probability * (1 + (avgRelationshipLevel / 100))
  }));
  
  // Normalize probabilities
  const totalProbability = adjustedOutcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  const normalizedOutcomes = adjustedOutcomes.map(outcome => ({
    ...outcome,
    probability: outcome.probability / totalProbability
  }));
  
  // Select random outcome
  const random = Math.random();
  let cumulativeProbability = 0;
  
  for (const outcome of normalizedOutcomes) {
    cumulativeProbability += outcome.probability;
    if (random <= cumulativeProbability) {
      return outcome;
    }
  }
  
  return normalizedOutcomes[normalizedOutcomes.length - 1];
};

export const canParticipateInEvent = (event: SocialEvent, participant: any): boolean => {
  if (event.requirements.minRelationshipLevel && 
      (participant.relationshipLevel || 0) < event.requirements.minRelationshipLevel) {
    return false;
  }
  
  if (event.requirements.requiredItems) {
    // Check if participant has required items
    // This would need to be implemented based on your item system
  }
  
  return true;
};

export const getEventCooldownRemaining = (event: SocialEvent, lastParticipated: number): number => {
  const cooldownMs = event.cooldown * 60 * 60 * 1000; // convert hours to milliseconds
  const timeSinceLastEvent = Date.now() - lastParticipated;
  return Math.max(0, cooldownMs - timeSinceLastEvent);
};

export const formatCooldownTime = (cooldownMs: number): string => {
  const hours = Math.ceil(cooldownMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  const days = Math.ceil(hours / 24);
  return `${days}d`;
};
