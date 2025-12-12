import { 
  GameStats, 
  GameDate, 
  StreetJob, 
  JailActivity, 
  Career, 
  Hobby, 
  Item, 
  Relationship, 
  Pet, 
  Food, 
  HealthActivity, 
  DietPlan, 
  Education, 
  Company, 
  UserProfile, 
  GameSettings, 
  Crypto, 
  Disease, 
  RealEstate, 
  SocialState, 
  EconomyState, 
  FamilyState, 
  FamilyMemberNode, 
  Memory, 
  FamilyBusiness, 
  GameProgress, 
  JournalEntry, 
  Loan, 
  GamingStreamingState, 
  Achievement, 
  WeeklyEvent,
  DailyChallengeState
} from './types';

export interface Goal {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: {
    type: 'money' | 'xp' | 'item' | 'reputation';
    value: number | string;
  };
}

export interface GoalProgress {
  current: number;
  completed: boolean;
  lastUpdated: number;
}

export interface SocialEvent {
  id: string;
  type: 'party' | 'wedding' | 'funeral' | 'graduation' | 'birthday';
  date: number;
  attendees: string[];
  cost: number;
  reputationImpact: number;
}

export interface SocialGroup {
  id: string;
  name: string;
  members: string[];
  reputation: number;
  type: 'friends' | 'colleagues' | 'club' | 'gang';
}

export interface SocialInteraction {
  id: string;
  targetId: string;
  type: string;
  date: number;
  outcome: 'positive' | 'negative' | 'neutral';
  impact: number;
}

// Re-export everything else from types to maintain compatibility
export * from './types';


