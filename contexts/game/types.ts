/**
 * Shared types for game contexts
 * Extracted from GameContext.tsx for reuse across split contexts
 */

import { Memory } from '@/lib/legacy/memories';
import { FamilyMemberNode } from '@/lib/legacy/familyTree';
import { PrestigeData } from '@/lib/prestige/prestigeTypes';

import { SocialState } from '@/lib/social/relations';
import { WeeklyEvent } from '@/lib/events/engine';
import { DiscoveredSystem } from '@/lib/depth/discoverySystem';
import { SystemStatistics } from '@/lib/statistics/enhancedStatistics';
import { KarmaState } from '@/lib/karma/karmaSystem';

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
  birthWeeksLived?: number;
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
  weeksAtZeroHealth?: number; // Track weeks at 0 health for death logic
  isDead?: boolean; // Flag for pet death
  vaccinated?: boolean; // Vaccination status
  isSick?: boolean; // Sickness status
  sickness?: string; // Current sickness type
  lastVetVisit?: number; // Timestamp of last vet visit
  energy?: number; // Pet energy level
  competitionWins?: number; // Number of competition wins
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

import { CareerRequirements } from '@/lib/types/requirements';

export interface Career {
  id: string;
  levels: { name: string; salary: number; experienceRequired?: number; description?: string; energyCost?: number }[];
  level: number;
  description: string;
  requirements: CareerRequirements;
  progress: number;
  applied: boolean;
  accepted: boolean;
  applicationAttempts?: number; // Track job application attempts (for pity system - guaranteed acceptance after 3 attempts)
  applicationWeeksPending?: number; // Track how many weeks the application has been pending
  startedWeeksLived?: number; // Track when career was started (for early career acceleration)
  performance?: number; // 0-100 job performance rating (affects progress speed, firing risk, raises)
  warningsReceived?: number; // Number of formal warnings (3 = auto-fired)
  currentLevel?: number; // Current level index (alias for level, used by some components)
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
  uploadWeek?: number; // Week when song was uploaded (for backward compatibility, deprecated)
  uploadWeeksLived?: number; // MONEY FLOW FIX: Weeks lived when song was uploaded (for correct decay calculation)
}

export interface Artwork {
  id: string;
  grade: 'Terrible Art' | 'Bad Art' | 'Normal' | 'Good' | 'Great' | 'Incredible';
  weeklyIncome: number;
  uploadWeek?: number; // Week when artwork was uploaded (for backward compatibility, deprecated)
  uploadWeeksLived?: number; // MONEY FLOW FIX: Weeks lived when artwork was uploaded (for correct decay calculation)
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
  consumable?: boolean;
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
  success?: boolean;
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
  weeksAtLowRelationship?: number; // Track weeks at critically low relationship (for automatic breakups/divorces)
  childAttempts?: number; // Track attempts to have a child (for pity system - guaranteed success after 15 attempts)
  moneyRequestAttempts?: number; // Track attempts to ask for money (for pity system - guaranteed success after 5 attempts)
  // NOTE: These counters are optional for backward compatibility with old saves
  // Default to 0 if undefined (fresh start for old saves is acceptable)
  // Wedding & Engagement properties
  datesCount?: number;
  lastDateWeek?: number;
  giftsReceived?: number;
  engagementWeek?: number;
  engagementRing?: EngagementRing;
  weddingPlanned?: WeddingPlan;
  marriageWeek?: number;
  anniversaryWeek?: number;
  // ANTI-EXPLOIT: Track weekly interactions to prevent spam (diminishing returns)
  weeklyInteractions?: number;
  lastInteractionWeek?: number;
  // ANTI-EXPLOIT: Track weekly dates and gifts to prevent spam
  datesThisWeek?: number;
  giftsThisWeek?: number;
  lastGiftWeek?: number;
  // Pregnancy tracking
  isPregnant?: boolean;
  pregnancyStartWeek?: number; // weeksLived when pregnancy started
  pregnancyChildGender?: 'male' | 'female';
  pregnancyChildName?: string;
  // NPC Depth System — makes NPCs feel alive
  npcGoals?: NPCGoal[];
  npcOpinion?: NPCOpinion;
  npcMemories?: NPCMemory[];
  giftPreferences?: string[]; // Gift type IDs the NPC likes
  giftDislikes?: string[]; // Gift type IDs the NPC dislikes
  lastLifeEvent?: { event: string; weeksLived: number };
  job?: string; // NPC's current job
  npcMood?: 'happy' | 'neutral' | 'stressed' | 'sad' | 'angry';
}

export interface NPCGoal {
  id: string;
  label: string;
  category: 'family' | 'career' | 'travel' | 'lifestyle' | 'relationship';
  fulfilled: boolean;
  fulfilledWeek?: number;
}

export interface NPCOpinion {
  trust: number;       // 0-100 — built by consistent interactions, honesty
  attraction: number;  // 0-100 — affected by gifts, dates, player stats
  respect: number;     // 0-100 — career/education achievements, keeping promises
}

export interface NPCMemory {
  id: string;
  type: 'date' | 'gift' | 'milestone' | 'conflict' | 'life_event' | 'kindness';
  description: string;
  weeksLived: number;
  sentiment: 'positive' | 'negative' | 'neutral';
}

// Wedding & Engagement Types
export interface EngagementRing {
  id: string;
  name: string;
  price: number;
  qualityTier: 'simple' | 'elegant' | 'luxury' | 'extravagant';
  acceptanceBonus: number;
  description: string;
}

export interface WeddingVenue {
  id: string;
  name: string;
  type: 'courthouse' | 'church' | 'beach' | 'garden' | 'luxury_hotel' | 'destination';
  baseCost: number;
  guestCapacity: number;
  happinessBonus: number;
  reputationBonus: number;
  description: string;
}

export interface WeddingPlan {
  venueId: string;
  venueName: string;
  venueType: 'courthouse' | 'church' | 'beach' | 'garden' | 'luxury_hotel' | 'destination';
  partnerId: string;
  guestCount: number;
  scheduledWeek: number;
  budget: number;
  catering: boolean;
  photography: boolean;
  music: boolean;
  decorations: boolean;
}

export interface LifeMilestone {
  id: string;
  type: 'first_date' | 'engagement' | 'wedding' | 'anniversary' | 'child_birth' | 'pregnancy_start' | 'promotion' | 'retirement';
  week: number;
  year: number;
  partnerId?: string;
  details?: Record<string, any>;
}

export interface Education {
  id: string;
  name: string;
  description: string;
  cost: number;
  duration: number;
  completed: boolean;
  weeksRemaining?: number;
  paused?: boolean;
  // Education revamp fields (optional for backward compatibility)
  enrolledClasses?: EducationClass[];
  examsPassed?: number;
  examsFailed?: number;
  gpa?: number; // 0.0 - 4.0
  studyGroupActive?: boolean;
  studentLoan?: { amount: number; weeklyPayment: number; remaining: number };
  semesterNumber?: number;
  lastExamWeek?: number;
  lastCampusEventWeek?: number;
}

export interface EducationClass {
  id: string;
  name: string;
  category: 'core' | 'elective' | 'lab' | 'seminar';
  statBonuses: Partial<Record<'health' | 'happiness' | 'energy' | 'fitness' | 'reputation', number>>;
  difficulty: 1 | 2 | 3; // 1=easy, 2=medium, 3=hard
  completed: boolean;
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

export interface MinerUpgrade {
  id: string;
  minerId: string;
  type: 'efficiency' | 'power' | 'durability' | 'cooling';
  level: number;
  maxLevel: number;
}

export interface MiningPool {
  id: string;
  cryptoId: string;
  name: string;
  bonusMultiplier: number; // e.g., 1.15 for 15% bonus
  fee: number; // e.g., 0.05 for 5% fee
  joined?: boolean;
}

export interface StakingPosition {
  cryptoId: string;
  amount: number;
  lockWeeks: number;
  startWeek: number;
  startAbsoluteWeek?: number;
  lastClaimAbsoluteWeek?: number;
  rewardRate: number; // e.g., 0.03 for 3% weekly
}

export interface MiningStatistics {
  totalCryptoMined: Record<string, number>; // cryptoId -> total amount
  totalEarnings: number;
  totalPowerCost: number;
  bestPerformingCrypto?: string;
  miningHistory: Array<{
    week: number;
    earnings: number;
    cryptoMined: Record<string, number>;
    powerCost: number;
  }>;
  minerPerformance: Record<string, {
    totalEarnings: number;
    totalPowerCost: number;
    roi: number;
  }>;
}

export interface Warehouse {
  level: number;
  miners: Record<string, number>;
  // BUG FIX: Track miner durability (average durability per miner type, 0-100)
  minerDurability?: Record<string, number>;
  selectedCrypto?: string;
  autoRepairEnabled?: boolean;
  autoRepairWeeklyCost?: number;
  autoRepairCryptoId?: string;
  // New features
  upgrades?: MinerUpgrade[];
  activePool?: string; // pool ID
  pools?: MiningPool[];
  stakingPositions?: StakingPosition[];
  statistics?: MiningStatistics;
  energyType?: 'standard' | 'solar' | 'wind' | 'hybrid';
  energyEfficiency?: number; // 0-1, reduces power costs
  automationLevel?: number; // 0-5, affects efficiency
  difficultyMultiplier?: number; // mining difficulty over time
  lastDifficultyUpdate?: number; // week number
  lastDifficultyUpdateAbsoluteWeek?: number;
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
  showStatArrows?: boolean; // Show arrows indicating stat change direction
  autoProgression?: boolean; // Auto-progression for progressive disclosure
  adsRemoved?: boolean; // IAP: Remove Ads purchased
  adsRemovedDate?: string; // When ads were removed
  hasRevivalPack?: boolean; // IAP: Revival Pack purchased
  moneyMultiplier?: boolean; // IAP: Money multiplier from bundles
  everythingUnlocked?: boolean; // IAP: Mega bundle
  unlimitedYouthPills?: boolean; // IAP: Mega bundle
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
  naturalRecoveryWeeks?: number; // Can heal naturally over time
  contractedWeek?: number; // Track when disease was contracted
  description?: string; // Disease description and symptoms
  preventionTips?: string[]; // Tips to prevent this disease
}

export interface RealEstate {
  id: string;
  name: string;
  price: number;
  weeklyHappiness: number;
  weeklyEnergy: number;
  owned: boolean;
  interior: string[]; // Decoration/furniture item IDs installed
  upgradeLevel: number;
  rent?: number;
  upkeep?: number;
  status?: 'vacant' | 'owner' | 'rented';
  // Housing depth fields
  currentResidence?: boolean; // Is this the player's home?
  currentValue?: number; // Market value (appreciates/depreciates)
  lastMaintenance?: number; // weeksLived of last maintenance
  condition?: number; // 0-100, decays without maintenance
  rooms?: string[]; // Room addition IDs installed
  totalHappinessBonus?: number; // Computed from base + interior + upgrades
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
  economyEvents?: {
    currentState: 'normal' | 'recession' | 'boom' | 'crash';
    stateStartWeek: number;
    stateDuration: number;
    modifiers: {
      incomeMultiplier: number;
      stockVolatility: number;
      jobAvailability: number;
    };
  };
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
  // ANTI-EXPLOIT: Track weekly stream count to prevent unlimited real-time income farming
  streamsThisWeek?: number;
  lastStreamWeek?: number; // weeksLived when last stream occurred
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
  id?: string;
  type?: 'basic' | 'comprehensive' | 'premium';
  active: boolean;
  coveragePercent: number;
  expiresWeek: number;
  monthlyCost?: number;
  premiumCost?: number; // Deprecated, use monthlyCost instead
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
  insurance?: VehicleInsurance; // undefined when no insurance (never purchased or cancelled)
  lastServiceWeek?: number;
  owned: boolean;
  reputationBonus: number; // Required - always present from template
  speedBonus: number; // Required - always present from template
}

/**
 * Main GameState interface
 * Contains all game state data
 */
export interface GameState {
  revivalPack: boolean;
  stats: GameStats;
  totalHappiness: number;
  /** Absolute week counter — the single source of truth for elapsed game time. Use for ALL duration/scheduling logic. */
  weeksLived: number;
  day: number;
  /** UI-only week of month, cycles 1-4. For time comparisons, scheduling, and durations, use weeksLived instead. */
  week: number;
  date: GameDate;
  streetJobs: StreetJob[];
  jailActivities: JailActivity[];
  careers: Career[];
  hobbies: Hobby[]; // DEPRECATED: Hobbies removed from game
  items: Item[];
  darkWebItems: DarkWebItem[];
  hacks: Hack[];
  relationships: Relationship[];
  // ANTI-EXPLOIT: Track divorce cooldown to prevent marry/divorce cycling
  lastDivorceWeek?: number;
  pets: Pet[];
  hasPhone: boolean;
  computerPreviouslyOwned: boolean;
  hasDriversLicense?: boolean; // Driver's license for vehicle ownership
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
  streetJobFailureCount?: Record<string, number>; // Track consecutive failures per job (for pity system - guaranteed success after 5 failures)
  // NOTE: streetJobFailureCount persists across weeks (unlike weeklyStreetJobs which resets)
  // This allows pity system to work over multiple weeks
  criminalLevel: number;
  crimeSkills: Record<CrimeSkillId, CrimeSkill>;
  /** Karma/morality system — tracks cumulative moral weight of player choices */
  karma?: KarmaState;
  version: number;
  progress: GameProgress;
  journal: JournalEntry[];
  scenarioId?: string;
  challengeScenarioId?: string; // CRITICAL FIX: Track challenge scenario ID for completion tracking and gem rewards
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
    realizedGains?: number; // Total realized gains from sold shares
    savedMarketPrices?: Record<string, { price: number; dividendYield: number }>; // Persisted market prices to prevent save/reload exploit
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
  loginStreak?: number;
  lastLoginDate?: string;
  lastLoginRewardDate?: string;
  gamingStreaming?: GamingStreamingState;
  goldUpgrades?: Record<string, boolean>;
  pendingEvents: WeeklyEvent[];
  eventLog: {
    id: string;
    description: string;
    choice: string;
    week: number;
    year: number;
    weeksLived?: number; // Track weeksLived for better history
    category?: string; // Event category
    effects?: {
      money?: number;
      stats?: Partial<GameStats>;
    }; // Track effects for analytics
  }[];
  eventChains?: {
    chainId: string;
    currentStage: number;
    stages: {
      eventId: string;
      choiceId?: string;
      week: number;
    }[];
    completed: boolean;
  }[]; // Track multi-stage event chains
  activeEventChain?: {
    chainId: string;
    eventId: string;
    currentStage: number;
    totalStages: number;
  };
  achievements: Achievement[];
  claimedProgressAchievements: string[];
  /** Rich achievement unlock context for narrative display */
  achievementUnlocks?: Record<string, {
    unlockedAt: number; // timestamp
    age: number;
    weeksLived: number;
    money: number;
    year: number;
  }>;
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
  showWeddingPopup: boolean;
  weddingPartnerName?: string;
  debtWeeks?: number; // STABILITY FIX: Track weeks in debt for bankruptcy system
  bankruptcyTriggered?: boolean; // STABILITY FIX: Track if bankruptcy has been triggered
  weeksInPoverty?: number; // STABILITY FIX: Track weeks in poverty for scholarship event
  showSicknessModal: boolean;
  lastEventWeek?: number; // Track last week an event occurred (for pity system) - DEPRECATED, use lastEventWeeksLived
  lastEventWeeksLived?: number; // TIME PROGRESSION FIX: Track weeksLived for pity system to handle year boundaries correctly
  lastDiseaseWeek?: number; // Track last week a disease was contracted (for bounds - max 1 per 4 weeks)
  lastGymVisitWeek?: number; // Track last week player visited gym (for fitness decay calculation)
  showCureSuccessModal: boolean;
  curedDiseases: string[];
  diseaseHistory?: {
    diseases: Array<{
      id: string;
      name: string;
      contractedWeek: number;
      curedWeek?: number;
      severity: string;
    }>;
    totalDiseases: number;
    totalCured: number;
    deathsFromDisease: number;
  };
  diseaseImmunities?: string[]; // Diseases player has immunity to (from previous infections)
  vaccinations?: string[]; // Vaccinations player has received
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
    lastRefreshDayKey?: string;
  };
  rngCommitLog?: RngCommitLog;
  prestige?: PrestigeData;
  prestigeAvailable?: boolean; // True when net worth >= $100M
  seasonalEvents?: {
    lastSeason: string;
    completedEvents: string[];
  };
  automation?: {
    rules: Array<{
      id: string;
      type: 'invest' | 'save' | 'pay' | 'renew';
      name: string;
      enabled: boolean;
      conditions: Array<{
        type: string;
        value: number;
      }>;
      actions: Array<{
        type: string;
        value: number;
        target?: string;
      }>;
      priority: number;
      lastExecuted?: number;
      executionCount?: number;
    }>;
    executionHistory: Array<{
      ruleId: string;
      ruleName: string;
      type: string;
      executedAt: number;
      success: boolean;
      message: string;
      actionsTaken: Array<{
        type: string;
        value: number;
        result: string;
      }>;
    }>;
    maxSlots: number;
    enabled: boolean;
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
      gameWeek?: number;
      gameMonth?: string;
      gameYear?: number;
      contentType: 'text' | 'photo' | 'video' | 'story' | 'live';
      category?: 'lifestyle' | 'career' | 'fitness' | 'travel' | 'food';
      photo?: string;
      isViral?: boolean;
    }[];
  };
  _checksum?: string;
  _saveVersion?: number;
  _appVersion?: string; // TESTFLIGHT FIX: App version when save was created (for compatibility tracking)
  _buildNumber?: string | number; // TESTFLIGHT FIX: Build number when save was created (for compatibility tracking)
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
  // Life Skills System
  unlockedLifeSkills?: string[];
  // DM System for Social App
  dmConversations?: DMConversation[];
  revealedDMClues?: string[];
  // Life Milestones (wedding, engagement, etc.)
  lifeMilestones?: LifeMilestone[];
  // Activity Commitment System - tracks focus areas and provides bonuses/penalties
  activityCommitments?: {
    primary?: 'career' | 'hobbies' | 'relationships' | 'health';
    secondary?: 'career' | 'hobbies' | 'relationships' | 'health';
    lastChangedWeek?: number;
    commitmentLevels?: {
      career: number; // 0-100, increases with work, decays when neglected
      hobbies: number; // 0-100, increases with hobby activities, decays when neglected
      relationships: number; // 0-100, increases with social activities, decays when neglected
      health: number; // 0-100, increases with health activities, decays when neglected
    };
  };
  // Depth Enhancement System - tracks discovered systems and depth metrics
  discoveredSystems?: DiscoveredSystem[];
  depthMetrics?: {
    depthScore: number; // 0-100 score of game depth engagement
    systemsEngaged: number;
    lastCalculated: number; // timestamp
  };
  progressiveDisclosureLevel?: 'simple' | 'standard' | 'advanced';
  systemStatistics?: Record<string, SystemStatistics>;
  // Life Moments & Consequence System
  consequenceState?: import('@/lib/lifeMoments/types').ConsequenceState;
  lifeMoments?: {
    lastMomentWeek: number;
    momentsThisWeek: number;
    totalMoments: number;
    pendingMoment?: import('@/lib/lifeMoments/types').LifeMoment; // Current life moment waiting for decision
  };
  // B-4: IAP processed transaction IDs stored in save envelope for cross-device resilience
  // Belt-and-suspenders: also stored in separate AsyncStorage key for cross-slot persistence
  processedIAPTransactions?: string[];
  // Education System — campus event pending for UI display
  pendingCampusEventEducationId?: string;

  // ── Engagement & Addiction Systems ──────────────────────────────
  /** Play session streak — tracks consecutive play sessions within 48h window */
  playStreak?: {
    count: number;
    lastPlayTimestamp: number;
    longestStreak: number;
  };
  /** Week advance result — lucky bonus and streak info for the result sheet */
  weekResult?: {
    luckyBonus?: number;
    luckyMessage?: string;
    luckyTier?: 'small' | 'medium' | 'rare';
    streakBonus?: number;
    incomeEarned?: number;
    expensesPaid?: number;
    netChange?: number;
    careerProgressPercent?: number;
    cliffhangerTeaser?: string;
  };
  /** Mini-prestige currency earned every 10 weeks, spent on temporary buffs */
  legacyPoints?: number;
  /** Active legacy buffs purchased with legacy points */
  legacyBuffs?: {
    luckyCharm?: { expiresWeeksLived: number }; // +10% luck for 5 weeks
    mentor?: { expiresWeeksLived: number }; // +50% career progress for 3 weeks
  };
  /** Daily challenge completion streak */
  challengeStreak?: {
    count: number;
    lastCompletionDayKey: string;
  };
  /** Life chapters — themed goal groups that unlock based on weeksLived */
  activeChapterId?: string;
  completedChapters?: string[];
  /** Tutorial step completion tracking for rewards */
  completedTutorialSteps?: string[];

  // ── Wave 2: Addiction Mechanics ────────────────────────────────
  /** Secrets/Easter eggs discovered this life */
  discoveredSecrets?: string[];
  /** Pending cliffhanger to resolve next week */
  pendingCliffhanger?: {
    resolveEventId: string;
    teaser: string;
    setWeeksLived: number;
  };
  /** Ribbon collection — persists across prestiges */
  ribbonCollection?: {
    earned: Array<{
      ribbonId: string;
      generation: number;
      earnedTimestamp: number;
      lifeAge: number;
      lifeName: string;
    }>;
    discoveredIds: string[];
  };
  /** Weekly themed challenge state */
  weeklyChallenge?: {
    challengeId: string;
    startedAt: number;
    progress: Array<{ objectiveId: string; current: number; target: number; met: boolean }>;
    completed: boolean;
    rewardClaimed: boolean;
  };
  /** Time machine checkpoints — max 5 snapshots */
  checkpoints?: Array<{
    id: string;
    label: string;
    weeksLived: number;
    age: number;
    timestamp: number;
    snapshot: string;
  }>;
  /** Number of time machine rewinds used this life (escalates cost) */
  timeMachineUsesThisLife?: number;
}

export interface DMConversation {
  id: string;
  senderName: string;
  senderHandle: string;
  senderAvatar: string;
  isVerified: boolean;
  isMysterious: boolean;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
  isPinned: boolean;
  clueType?: 'location' | 'money' | 'career' | 'relationship' | 'item' | 'secret' | 'quest';
  clueData?: {
    hint: string;
    reward?: string;
    action?: string;
    destination?: string;
    requirement?: string;
    completed?: boolean;
  };
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

export interface RngCommitLog {
  seed: number;
  sequence: number;
  entries: Record<string, number>;
  order: string[];
  lastCommittedWeek?: number;
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
  gameMonth?: string;
  gameYear?: number;
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  views: number;
  contentType?: 'text' | 'photo' | 'video' | 'story' | 'live';
  isLiked: boolean;
  isReposted: boolean;
  isBookmarked: boolean;
  isPlayerPost: boolean;
  repostOf?: string; // Original post ID if this is a repost
  quotedPost?: string; // Post ID if this is a quote
  hashtags?: string[];
  isViral?: boolean;
}
