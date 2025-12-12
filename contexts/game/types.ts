/**
 * Shared types for game contexts
 * Extracted from GameContext.tsx for reuse across split contexts
 */

import { Memory } from '@/lib/legacy/memories';
import { FamilyMemberNode } from '@/lib/legacy/familyTree';
import { PrestigeData } from '@/lib/prestige/prestigeTypes';

import { SocialState } from '@/lib/social/relations';
import { WeeklyEvent } from '@/lib/events/engine';

export interface GameStats {
  health: number;
  happiness: number;
  energy: number;
  fitness: number;
  money: number;
  reputation: number;
  gems: number;
}

export interface GameDate {
  year: number;
  month: string;
  week: number;
  age: number;
}

export type LifeStage = 'child' | 'teen' | 'adult' | 'senior';

export interface ChildInfo extends Relationship {
  educationLevel?: 'none' | 'highSchool' | 'university' | 'specialized';
  careerPath?: 'blueCollar' | 'whiteCollar' | 'professional' | 'entrepreneur';
  jobTier?: 1 | 2 | 3 | 4;
  savings?: number;
  mindsetHints?: string[];
  isHeirEligible?: boolean;
  expenses?: number;
  familyHappiness?: number;
  geneticTraits?: string[];
}

export interface FamilyState {
  spouse?: Relationship;
  children: ChildInfo[];
}

export interface PetToy {
  id: string;
  name: string;
  price: number;
  fun: number;
  healthBonus?: number;
}

export interface Pet {
  id: string;
  name: string;
  type: string;
  age: number;
  hunger: number;
  happiness: number;
  health: number;
  toys?: string[]; // Array of toy IDs owned by this pet
  ownedToys?: string[];
}

export type CrimeSkillId = 'stealth' | 'hacking' | 'lockpicking';

export interface CrimeSkill {
  xp: number;
  level: number;
  upgrades?: string[];
}

export interface StreetJob {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  baseSuccessRate: number;
  basePayment: number;
  rank: number;
  progress: number;
  requirements?: string[];
  criminalLevelReq?: number;
  darkWebRequirements?: string[];
  skill?: CrimeSkillId;
  risks?: string[];
  illegal?: boolean;
  wantedIncrease?: number;
  jailWeeks?: number;
}

export interface JailActivity {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  payment?: number;
  sentenceReduction?: number;
  fitnessGain?: number;
  healthGain?: number;
  happinessGain?: number;
  reputationGain?: number;
  skillGain?: string;
  successRate?: number;
  failurePenalty?: number;
  cost?: number;
  requiresEducation?: string;
  requiresWeeks?: number;
  criminalXpGain?: number;
  risk?: string;
}

export interface Career {
  id: string;
  levels: { name: string; salary: number }[];
  level: number;
  description: string;
  requirements: {
    fitness?: number;
    items?: string[];
    education?: string[];
    reputation?: number;
  };
  progress: number;
  applied: boolean;
  accepted: boolean;
}

export interface Hobby {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  skill: number;
  skillLevel: number;
  tournamentReward: number;
  songs?: Song[];
  artworks?: Artwork[];
  contracts?: Contract[];
  sponsors?: Sponsor[];
  maxSponsors?: number;
  team?: string;
  divisions?: Division[];
  league?: League;
  upgrades: HobbyUpgrade[];
}

export interface HobbyUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  level: number;
  maxLevel: number;
  skillBonusPerLevel?: number;
  incomeBonusPerLevel?: number;
  rewardBonusPerLevel?: number;
  slotIncreasePerLevel?: number;
}

export interface Song {
  id: string;
  grade: 'Terrible Song' | 'Bad Song' | 'Normal' | 'Good' | 'Great' | 'Incredible';
  weeklyIncome: number;
}

export interface Artwork {
  id: string;
  grade: 'Terrible Art' | 'Bad Art' | 'Normal' | 'Good' | 'Great' | 'Incredible';
  weeklyIncome: number;
}

export interface Contract {
  id: string;
  team: string;
  matchPay: number;
  weeksRemaining: number;
  totalWeeks: number;
  division: number;
  goal: number;
}

export interface Sponsor {
  id: string;
  name: string;
  weeklyPay: number;
  weeksRemaining: number;
}

export interface TeamInfo {
  name: string;
  goal: number;
}

export interface Division {
  name: string;
  teams: TeamInfo[];
}

export interface TeamStanding {
  team: string;
  points: number;
  played: number;
}

export interface League {
  division: number;
  standings: TeamStanding[];
  matchesPlayed: number;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  description?: string;
  owned: boolean;
  dailyBonus?: Partial<GameStats>;
}

export interface DarkWebItem {
  id: string;
  name: string;
  costBtc: number;
  description?: string;
  owned: boolean;
  riskReduction?: number;
  rewardBonus?: number;
}

export interface HackResult {
  caught: boolean;
  reward: number;
  btcReward: number;
  risk: number;
  jailed?: boolean;
}

export interface Hack {
  id: string;
  name: string;
  description: string;
  costBtc: number;
  risk: number;
  reward: number;
  purchased: boolean;
  energyCost: number;
}

export interface Food {
  id: string;
  name: string;
  price: number;
  healthRestore: number;
  energyRestore: number;
}

export interface HealthActivity {
  id: string;
  name: string;
  description: string;
  price: number;
  happinessGain: number;
  healthGain?: number;
  energyCost?: number;
}

export interface DietPlan {
  id: string;
  name: string;
  description: string;
  dailyCost: number;
  healthGain: number;
  energyGain: number;
  happinessGain?: number;
  active: boolean;
}

export interface Relationship {
  id: string;
  name: string;
  type: 'parent' | 'friend' | 'partner' | 'spouse' | 'child';
  relationshipScore: number;
  income?: number;
  personality: string;
  gender: 'male' | 'female';
  lastMoneyRequest?: number;
  lastCall?: number;
  livingTogether?: boolean;
  age: number;
  profilePicture?: string;
  actions?: { [action: string]: number };
  familyHappiness?: number;
  expenses?: number;
  weeksAtZero?: number;
}

export interface Education {
  id: string;
  name: string;
  description: string;
  cost: number;
  duration: number;
  completed: boolean;
  weeksRemaining?: number;
}

export interface CompanyUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  weeklyIncomeBonus: number;
  level: number;
  maxLevel: number;
}

export interface Warehouse {
  level: number;
  miners: Record<string, number>;
  selectedCrypto?: string;
  autoRepairEnabled?: boolean;
  autoRepairWeeklyCost?: number;
  autoRepairCryptoId?: string;
}

export interface RDLab {
  type: 'basic' | 'advanced' | 'cutting_edge';
  builtWeek: number;
  researchProjects: {
    id: string;
    technologyId: string;
    startWeek: number;
    duration: number;
    cost: number;
    progress: number;
    completed: boolean;
  }[];
  completedResearch: string[];
}

export interface Patent {
  id: string;
  technologyId: string;
  name: string;
  filedWeek: number;
  weeklyIncome: number;
  duration: number;
  totalDuration: number;
}

export interface CompetitionEntry {
  competitionId: string;
  competitionName: string;
  entryWeek: number;
  endWeek: number;
  score: number;
  completed: boolean;
  prize?: number;
  rank?: number;
}

export interface Company {
  id: string;
  name: string;
  type: 'factory' | 'ai' | 'restaurant' | 'realestate' | 'bank';
  weeklyIncome: number;
  baseWeeklyIncome: number;
  money?: number;
  upgrades: CompanyUpgrade[];
  employees: number;
  workerSalary: number;
  workerMultiplier: number;
  marketingLevel: number;
  selectedCrypto?: string;
  miners: Record<string, number>;
  warehouseLevel: number;
  electricalBill?: {
    monthlyAmount: number;
    dueWeek: number;
    paid: boolean;
  };
  autoRepairEnabled?: boolean;
  autoRepairWeeklyCost?: number;
  autoRepairCryptoId?: string;
  generationsHeld?: number;
  rdLab?: RDLab;
  unlockedTechnologies?: string[];
  patents?: Patent[];
  competitionHistory?: CompetitionEntry[];
}

export interface Crypto {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  owned: number;
}

export interface UserProfile {
  name: string;
  handle: string;
  bio: string;
  followers: number;
  following: number;
  gender: 'male' | 'female';
  seekingGender: 'male' | 'female';
  posts?: number;
  firstName?: string;
  lastName?: string;
  sex?: 'male' | 'female';
  sexuality?: 'straight' | 'gay' | 'bi';
  // Enhanced profile fields for X.com-style social
  profilePhoto?: string; // Base64 or URI from gallery
  headerPhoto?: string; // Cover/banner photo
  displayName?: string;
  username?: string; // @handle format
  location?: string;
  website?: string;
  joinedDate?: string;
  verified?: boolean;
  bookmarkedPosts?: string[]; // Post IDs
}

export interface GameSettings {
  lifetimePremium: boolean;
  darkMode: boolean;
  soundEnabled: boolean;
  musicEnabled?: boolean;
  hapticFeedback: boolean;
  notificationsEnabled: boolean;
  autoSave: boolean;
  language: string;
  maxStats: boolean;
  weeklySummaryEnabled: boolean;
  showDecimalsInStats: boolean;
  premiumCreditCard?: boolean;
  premiumCreditCardExpiry?: string;
  financialPlanning?: boolean;
  financialPlanningExpiry?: string;
  businessBanking?: boolean;
  businessBankingExpiry?: string;
  privateBanking?: boolean;
  privateBankingExpiry?: string;
}

export interface Disease {
  id: string;
  name: string;
  severity: 'mild' | 'serious' | 'critical';
  effects: Partial<GameStats>;
  curable: boolean;
  treatmentRequired?: boolean;
  weeksUntilDeath?: number;
}

export interface RealEstate {
  id: string;
  name: string;
  price: number;
  weeklyHappiness: number;
  weeklyEnergy: number;
  owned: boolean;
  interior: string[];
  upgradeLevel: number;
  rent?: number;
  upkeep?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category:
    | 'money'
    | 'career'
    | 'education'
    | 'relationships'
    | 'health'
    | 'items'
    | 'special'
    | 'secret';
  completed: boolean;
  reward?: number;
  secretName?: string;
  secretDescription?: string;
}

export interface AchievementProgress {
  id: string;
  name: string;
  desc: string;
  unlockedAt?: number;
}

export interface JournalEntry {
  id: string;
  atWeek: number;
  title: string;
  details: string;
  tags: string[];
}

export interface GameProgress {
  adsRemoved: boolean;
  achievements: AchievementProgress[];
  hasBeenInDebt?: boolean;
}

export interface Loan {
  id: string;
  name: string;
  principal: number;
  remaining: number;
  rateAPR: number;
  termWeeks: number;
  weeklyPayment: number;
  startWeek: number;
  autoPay: boolean;
  type: 'personal' | 'business' | 'mortgage' | 'auto';
  weeksRemaining: number;
  interestRate: number;
}

export interface EconomyState {
  inflationRateAnnual: number;
  priceIndex: number;
}

export interface FamilyBusiness {
  companyId: string;
  foundedGeneration: number;
  generationsHeld: number;
  brandValue: number;
  reputation: number;
}

// Gaming & Streaming Interfaces
export interface Video {
  id: string;
  title: string;
  description: string;
  game: string;
  views: number;
  earnings: number;
  followers: number;
  subscribers: number;
  uploadDate: string;
}

export interface VideoRecordingState {
  isRecording: boolean;
  recordProgress: number;
  renderProgress: number;
  uploadProgress: number;
  currentPhase: 'idle' | 'recording' | 'rendering' | 'uploading' | 'completed';
  videoTitle?: string;
  videoGame?: string;
  isRendering?: boolean;
  isUploading?: boolean;
}

export interface StreamingState {
  isStreaming: boolean;
  streamProgress: number;
  totalDonations: number;
  streamDuration?: number;
  selectedGame?: string;
  currentViewers?: number;
  currentSubsGained?: number;
  upgrades?: Record<string, number>;
}

export interface StreamSession {
  id: string;
  game: string;
  duration: number;
  viewers: number;
  earnings: number;
  followers: number;
  chatMessages: number;
  donations: number;
}

export interface StreamHistoryItem extends StreamSession {
  subscribers: number;
}

export interface GamingEquipment {
  microphone: boolean;
  webcam: boolean;
  gamingChair: boolean;
  greenScreen: boolean;
  lighting: boolean;
}

export interface PCComponents {
  cpu: boolean;
  gpu: boolean;
  ram: boolean;
  ssd: boolean;
  motherboard: boolean;
  cooling: boolean;
  psu: boolean;
  case: boolean;
  network: boolean;
}

export interface PCUpgradeLevels {
  cpu: number;
  gpu: number;
  ram: number;
  ssd: number;
  motherboard: number;
  cooling: number;
  psu: number;
  case: number;
  network: number;
}

export interface GamingStreamingState {
  followers: number;
  subscribers: number;
  totalViews: number;
  totalEarnings: number;
  totalDonations: number;
  totalSubEarnings: number;
  level: number;
  experience: number;
  gamesPlayed: string[];
  streamHours: number;
  averageViewers: number;
  bestStream: StreamSession | null;
  currentStream: StreamSession | null;
  equipment: GamingEquipment;
  pcComponents: PCComponents;
  pcUpgradeLevels: PCUpgradeLevels;
  unlockedGames: string[];
  ownedGames: string[];
  streamHistory: StreamHistoryItem[];
  videoTitleCounters: Record<string, number>;
  videos?: Video[];
  videoRecordingState?: VideoRecordingState;
  streamingState?: StreamingState;
  paidMembers?: number;
  membershipRate?: number;
  upgrades?: Record<string, number>;
}

// Re-export from lib/social/relations for convenience
export type { Relation, RelationAction, SocialState } from '@/lib/social/relations';

// Re-export WeeklyEvent from events/engine
export type { WeeklyEvent } from '@/lib/events/engine';

/**
 * Vehicle system interfaces
 */
export type AccidentSeverity = 'minor' | 'moderate' | 'severe' | 'total';

export interface VehicleInsurance {
  active: boolean;
  coveragePercent: number;
  expiresWeek: number;
  premiumCost: number;
}

export interface Vehicle {
  id: string;
  name: string;
  type: 'car' | 'motorcycle' | 'bicycle' | 'boat' | 'plane';
  brand: string;
  model: string;
  year: number;
  price: number;
  condition: number; // 0-100
  fuelLevel: number; // 0-100
  fuelCapacity: number;
  fuelEfficiency: number; // miles per gallon
  mileage: number;
  weeklyMaintenanceCost: number;
  weeklyFuelCost: number;
  maxSpeed: number;
  insurance?: VehicleInsurance;
  lastServiceWeek?: number;
  owned: boolean;
}

/**
 * Main GameState interface
 * Contains all game state data
 */
export interface GameState {
  revivalPack: boolean;
  stats: GameStats;
  totalHappiness: number;
  weeksLived: number;
  day: number;
  week: number;
  date: GameDate;
  streetJobs: StreetJob[];
  jailActivities: JailActivity[];
  careers: Career[];
  hobbies: Hobby[];
  items: Item[];
  darkWebItems: DarkWebItem[];
  hacks: Hack[];
  relationships: Relationship[];
  pets: Pet[];
  hasPhone: boolean;
  computerPreviouslyOwned: boolean;
  foods: Food[];
  healthActivities: HealthActivity[];
  dietPlans: DietPlan[];
  educations: Education[];
  companies: Company[];
  company?: Company;
  warehouse?: Warehouse;
  userProfile: UserProfile;
  currentJob?: string;
  youthPills: number;
  showWelcomePopup: boolean;
  hasSeenJobTutorial: boolean;
  hasSeenInvestmentTutorial: boolean;
  hasSeenDatingTutorial: boolean;
  hasSeenHealthWarning: boolean;
  hasSeenEnergyWarning: boolean;
  hasSeenMoneyManagementTutorial: boolean;
  hasSeenSocialMediaTutorial: boolean;
  hasSeenRealEstateTutorial: boolean;
  settings: GameSettings;
  cryptos: Crypto[];
  diseases: Disease[];
  realEstate: RealEstate[];
  social: SocialState;
  economy: EconomyState;
  family: FamilyState;
  generationNumber: number;
  lineageId: string;
  ancestors: FamilyMemberNode[];
  activeTraits: string[];
  memories: Memory[];
  familyTreeData?: {
    members: Record<string, FamilyMemberNode>;
    lineageId: string;
  };
  legacyBonuses?: {
    incomeMultiplier: number;
    learningMultiplier: number;
    reputationBonus: number;
  };
  familyBusinesses?: FamilyBusiness[];
  mindset?: {
    activeTraitId?: string;
    [key: string]: any;
  };
  previousLives?: {
    generation: number;
    netWorth: number;
    ageAtDeath: number;
    deathReason?: string;
    timestamp?: number;
    summaryAchievements?: string[];
    [key: string]: any;
  }[];
  lifeStage: LifeStage;
  wantedLevel: number;
  jailWeeks: number;
  escapedFromJail: boolean;
  criminalXp: number;
  weeklyJailActivities?: Record<string, number>;
  weeklyStreetJobs?: Record<string, number>; // Track how many times each street job was done this week
  criminalLevel: number;
  crimeSkills: Record<CrimeSkillId, CrimeSkill>;
  version: number;
  progress: GameProgress;
  journal: JournalEntry[];
  scenarioId?: string;
  bankSavings?: number;
  loans?: Loan[];
  stocksOwned?: { [key: string]: number };
  stocks?: {
    holdings: {
      symbol: string;
      shares: number;
      averagePrice: number;
      currentPrice: number;
    }[];
    watchlist: string[];
  };
  perks?: {
    workBoost?: boolean;
    mindset?: boolean;
    fastLearner?: boolean;
    goodCredit?: boolean;
    unlockAllPerks?: boolean;
    astute_planner?: boolean;
  };
  dailySummary?: {
    moneyChange: number;
    statsChange: Partial<GameStats>;
    events: string[];
    earningsBreakdown?: {
      gaming: number;
      streaming: number;
      passive: number;
      salary: number;
      sponsors: number;
      other: number;
    };
  };
  showDailyRewardPopup?: boolean;
  dailyRewardAmount?: number;
  gamingStreaming?: GamingStreamingState;
  goldUpgrades?: Record<string, boolean>;
  pendingEvents: WeeklyEvent[];
  eventLog: {
    id: string;
    description: string;
    choice: string;
    week: number;
    year: number;
  }[];
  achievements: Achievement[];
  claimedProgressAchievements: string[];
  lastLogin: number;
  updatedAt?: number;
  streetJobsCompleted: number;
  happinessZeroWeeks: number;
  healthZeroWeeks: number;
  healthWeeks: number;
  showZeroStatPopup: boolean;
  zeroStatType?: 'happiness' | 'health';
  showDeathPopup: boolean;
  deathReason?: 'happiness' | 'health';
  showSicknessModal: boolean;
  showCureSuccessModal: boolean;
  curedDiseases: string[];
  goals: Goal[];
  goalProgress: Record<string, GoalProgress>;
  completedGoals: string[];
  socialEvents: SocialEvent[];
  socialGroups: SocialGroup[];
  socialInteractions: SocialInteraction[];
  lastEventTimes: Record<string, number>;
  dailyChallenges?: {
    easy: DailyChallengeState;
    medium: DailyChallengeState;
    hard: DailyChallengeState;
    lastRefresh: number;
  };
  prestige?: PrestigeData;
  prestigeAvailable?: boolean; // True when net worth >= $100M
  seasonalEvents?: {
    lastSeason: string;
    completedEvents: string[];
  };
  socialMedia?: {
    followers: number;
    influenceLevel: 'novice' | 'rising' | 'popular' | 'influencer' | 'celebrity';
    totalPosts: number;
    viralPosts: number;
    brandPartnerships: number;
    engagementRate: number;
    lastPostWeek?: number;
    lastPostTime?: number;
    lastPostDay?: number;
    lastPostTimes?: Record<'text' | 'photo' | 'video' | 'story' | 'live', number>; // Track cooldown per content type
    lastPostWeeks?: Record<'text' | 'photo' | 'video' | 'story' | 'live', number>;
    totalLiveStreams?: number;
    totalLiveViewers?: number;
    totalLiveDuration?: number;
    peakLiveViewers?: number;
    totalEarnings?: number;
    activeBrandDeals?: {
      id: string;
      brandName: string;
      payment: number;
      expiresAt: number;
      expiresIn: number;
    }[];
    recentPosts?: {
      id: string;
      content: string;
      likes: number;
      comments: number;
      timestamp: number;
      contentType: 'text' | 'photo' | 'video' | 'story' | 'live';
      category?: 'lifestyle' | 'career' | 'fitness' | 'travel' | 'food';
      photo?: string;
      isViral?: boolean;
    }[];
  };
  _checksum?: string;
  _saveVersion?: number;
  travel?: TravelState;
  politics?: PoliticsState;
  // Statistics & Analytics
  lifetimeStatistics?: LifetimeStatistics;
  // Dynasty System
  dynastyStats?: DynastyStats;
  // Event Chaining
  pendingChainedEvents?: PendingChainedEvent[];
  // Enhanced Social Posts
  socialPosts?: SocialPost[];
  // Pet food inventory
  petFood?: Record<string, number>;
  // Vehicle system
  vehicles?: Vehicle[];
  activeVehicleId?: string;
}

export interface BusinessOpportunity {
  id: string;
  destinationId: string;
  name: string;
  description: string;
  cost: number;
  weeklyIncome: number;
  unlocked: boolean;
  invested?: boolean;
}

export interface TravelState {
  currentTrip?: {
    destinationId: string;
    returnWeek: number;
    startWeek: number;
  };
  visitedDestinations: string[];
  passportOwned: boolean;
  businessOpportunities: Record<string, BusinessOpportunity>;
  travelHistory: {
    destinationId: string;
    week: number;
    year: number;
  }[];
}

export interface Lobbyist {
  id: string;
  name: string;
  cost: number;
  influence: number;
  active: boolean;
}

export interface PoliticalAlliance {
  id: string;
  characterId: string;
  name: string;
  influence: number;
  formedWeek: number;
}

export interface ActivePolicy {
  policyId: string;
  enactedWeek: number;
  expiresWeek?: number;
}

export interface PoliticsState {
  careerLevel: number;
  party?: 'democratic' | 'republican' | 'independent';
  approvalRating: number; // 0-100
  policyInfluence: number; // 0-100
  electionsWon: number;
  policiesEnacted: string[];
  activePolicies?: ActivePolicy[];
  lobbyists: Lobbyist[];
  alliances: PoliticalAlliance[];
  campaignFunds: number;
  lastElectionWeek?: number;
  nextElectionWeek?: number;
  activePolicyEffects?: {
    stocks?: { volatilityModifier: number; dividendBonus: number; companyBoost?: string[]; };
    realEstate?: { priceModifier: number; rentModifier: number; propertyTaxRate?: number; };
    education?: { weeksReduction: number; costReduction: number; scholarshipAmount?: number; };
    crypto?: { miningBonus: number; priceStability: number; regulationLevel?: number; };
    technology?: { rdBonus: number; patentBonus: number; innovationGrants?: number; };
    healthcare?: { healthBonus: number; medicalCostReduction: number; };
    transportation?: { travelCostReduction: number; commuteTimeReduction?: number; };
  };
}

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

export interface DailyChallengeState {
  id: string;
  progress: number;
  claimed: boolean;
  initialState: number; // Changed from any to number for tracking initial value
}

// ============================================
// Statistics & Analytics Dashboard Interfaces
// ============================================

export interface CareerHistoryEntry {
  job: string;
  weeks: number;
  earnings: number;
  startWeek: number;
  endWeek?: number;
}

export interface NetWorthSnapshot {
  week: number;
  value: number;
}

export interface LifetimeStatistics {
  totalMoneyEarned: number;
  totalMoneySpent: number;
  peakNetWorth: number;
  peakNetWorthWeek: number;
  totalWeeksWorked: number;
  totalRelationships: number;
  totalChildren: number;
  totalCompaniesOwned: number;
  totalPropertiesOwned: number;
  totalCrimesCommitted: number;
  totalJailTime: number;
  totalTravelDestinations: number;
  totalPostsMade: number;
  totalViralPosts: number;
  careerHistory: CareerHistoryEntry[];
  netWorthHistory: NetWorthSnapshot[]; // Sample every 10 weeks
  weeklyEarningsHistory: NetWorthSnapshot[];
  highestSalary: number;
  totalHobbiesLearned: number;
  totalAchievementsUnlocked: number;
}

// ============================================
// Legacy & Dynasty System Interfaces
// ============================================

export interface Heirloom {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'legendary';
  generationsHeld: number;
  originalOwner: string;
  currentValue: number;
  bonuses: {
    incomeBonus?: number; // Percentage
    reputationBonus?: number;
    happinessBonus?: number;
    learningBonus?: number;
  };
  icon: string;
}

export interface DynastyStats {
  totalGenerations: number;
  totalWealth: number; // Combined net worth of all generations
  familyReputation: number;
  heirlooms: Heirloom[];
  familyAchievements: string[];
  longestLivingMember: { name: string; age: number };
  wealthiestMember: { name: string; netWorth: number };
  totalChildrenAllGenerations: number;
  dynastyFoundedYear: number;
  familyMotto?: string;
}

// ============================================
// Event Chaining System Interfaces
// ============================================

export interface ChainedEvent {
  triggerEventId: string;
  followUpEventId: string;
  delayWeeks: number;
  condition?: string; // Serializable condition identifier
}

export interface PendingChainedEvent {
  eventId: string;
  triggerWeek: number;
  sourceEventId: string;
}

// ============================================
// Social Media Post Interfaces (X.com style)
// ============================================

export interface SocialPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorPhoto?: string;
  authorVerified?: boolean;
  content: string;
  photo?: string;
  timestamp: number;
  gameWeek: number;
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  views: number;
  isLiked: boolean;
  isReposted: boolean;
  isBookmarked: boolean;
  isPlayerPost: boolean;
  repostOf?: string; // Original post ID if this is a repost
  quotedPost?: string; // Post ID if this is a quote
  hashtags?: string[];
  isViral?: boolean;
}
