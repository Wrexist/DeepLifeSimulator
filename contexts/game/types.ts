/**
 * Shared types for game contexts
 * Extracted from GameContext.tsx for reuse across split contexts
 */

// All `import type` — these are interfaces only. Using plain `import { X }` here
// makes the single-file Babel transform KEEP the import at runtime if its
// type-only-elision heuristic misfires, which creates a require cycle
// (types.ts ↔ lib/events/engine.ts ↔ … ↔ lib/legacy/familyTree.ts) that resolves
// to undefined in the production Hermes bundle. `import type` is always erased.
import type { Memory } from '@/lib/legacy/memories';
import type { FamilyMemberNode } from '@/lib/legacy/familyTree';
import type { PrestigeData } from '@/lib/prestige/prestigeTypes';

import type { WeeklyEvent } from '@/lib/events/engine';
import type { DiscoveredSystem } from '@/lib/depth/discoverySystem';
import type { KarmaState } from '@/lib/karma/karmaSystem';
import type { AutomationState } from '@/lib/automation/automationTypes';

import type { CareerRequirements } from '@/lib/types/requirements';

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

/**
 * Per-child parenting bookkeeping (weekly cap + per-action cooldowns).
 * Additive/optional — absent on old saves; treated as a fresh slate when missing.
 */
export interface ChildParentingState {
  /** weeksLived value that `actionsThisWeek` is counted against. */
  weekStamp: number;
  /** Number of parenting actions performed during `weekStamp` (resets when the week advances). */
  actionsThisWeek: number;
  /** actionId -> weeksLived when that action was last performed (drives cooldown checks). */
  lastUsedWeek: Record<string, number>;
  /** Lifetime count of parenting actions performed on this child (flavour/stats). */
  totalActions: number;
}

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
  // ── Nurture stats (parenting-side). All 0-100, optional & additive: absent on
  // old saves and on newborns, where readers default to NURTURE_DEFAULT (50).
  // These are the "nurture" complement to the genetic ("nature") derivation —
  // parenting actions raise them, and the heir/prestige-child pipeline prefers
  // them when present without disturbing the trait-based nature side.
  /** Academic aptitude — biases the child's simulated education & career upward. */
  intelligence?: number;
  /** Physical health/robustness — feeds heir starting health & fitness. */
  health?: number;
  /** Emotional wellbeing — feeds heir starting happiness. */
  happiness?: number;
  /** Self-control & behaviour — feeds heir reputation and savings discipline. */
  discipline?: number;
  /** Weekly-cap + cooldown bookkeeping for the parenting action loop. */
  parenting?: ChildParentingState;
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
  // R5-C: weeklyLived of the most recent `petSleep` call. Sleep is gated to
  // once-per-week per pet to prevent infinite free recovery exploits.
  lastSleepWeek?: number;
  // weeksLived of the most recent `enterCompetition` call. Competitions are
  // gated to once-per-week per pet: each pays 10× the entry fee at up to 90%
  // win odds, so without this gate a player could re-tap for unbounded money.
  lastCompetitionWeek?: number;
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
  raiseMultiplier?: number; // Negotiated salary premium (1 = base). Applied to paid salary; persists across promotions.
  lastRaiseWeeksLived?: number; // weeksLived of the last raise REQUEST (approved OR denied) — gates the cooldown.
}

/**
 * Per-item state for one owned luxury item (STATE_VERSION 24).
 *
 * Every field is optional and absent-means-default, so a holding minted by an
 * older build (or backfilled by the migration) is always valid.
 */
export interface LuxuryHolding {
  /** `weeksLived` when it was acquired. Drives "owned since" and appreciation. */
  acquiredWeek: number;
  /**
   * Current market value, drifted weekly by `appreciateLuxuryHoldings`.
   *
   * ABSENT means "never drifted" and falls back to the catalog price, so an
   * item bought before appreciation existed — or one that never appreciates —
   * is valued exactly as it always was. That absent-means-default is why this
   * needs no migration of its own.
   */
  currentValue?: number;
  /**
   * `weeksLived` when a luxury VERB was last performed on this item (racing it,
   * a track day, a museum loan). Drives the cooldown.
   *
   * ABSENT means never done, which is why the cooldown check treats undefined
   * as "infinitely long ago" rather than week 0 — otherwise every verb would be
   * on cooldown for a brand-new item bought late in a life.
   */
  lastActionWeek?: number;
  /** Racehorse: career runs. Absent = never raced. */
  runs?: number;
  /** Racehorse: career wins. Better form makes a better horse. */
  wins?: number;
  /** Museum loan: `weeksLived` the item comes back. Unsellable until then. */
  loanedUntilWeek?: number;
  /**
   * `weeksLived` an event was last held at this venue. Per-venue rather than
   * global, so owning both the island and the penthouse gives two places to
   * entertain — a genuine reason to own both.
   */
  lastHostedWeek?: number;
  /**
   * Condition 0-100, exactly as vehicles carry it. ABSENT means pristine, so
   * every item bought before risk existed is undamaged and valued as it was.
   */
  condition?: number;
  /**
   * Insured against incidents. Costs a real weekly premium on top of upkeep;
   * in exchange an incident costs a deductible instead of the whole loss.
   */
  insured?: boolean;
  /**
   * For DEVELOPABLE items only: the `RealEstate.id` this purchase minted.
   *
   * A private island is land. Rather than reimplementing building, upgrading,
   * furnishing and maintaining it, the purchase mints a real property and hands
   * the player the entire existing real-estate stack (`lib/realEstate/housing.ts`).
   * This id is the link between the two systems.
   */
  propertyId?: string;
}

/**
 * Everything the promotion celebration needs to tell the story of a raise.
 *
 * Built by `promoteCareer` at the moment of the promotion, because that is the
 * only place both the OLD and the NEW rung are known — once state commits, the
 * previous title and salary are gone.
 *
 * Salaries here are what the player is actually PAID (base × any negotiated
 * raiseMultiplier), so the celebrated number matches the payslip.
 */
export interface PromotionDetails {
  careerId: string;
  /** Rung title before the promotion, e.g. "Junior Developer". */
  fromTitle: string;
  /** Rung title after, e.g. "Senior Developer". */
  toTitle: string;
  /** Weekly pay before, after the raise multiplier. */
  fromSalary: number;
  /** Weekly pay after, after the raise multiplier. */
  toSalary: number;
  /** New level index (0-based). */
  level: number;
  /** Index of the top rung on this ladder. */
  topLevel: number;
  /** True when this promotion reached the top of the ladder. */
  isTopRank: boolean;
}

/** A practiced hobby/skill (v21 mastery loop). Level is derived from xp but
 *  cached for cheap reads. */
export interface PlayerPursuit {
  xp: number;
  level: number;
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
  // ANTI-EXPLOIT: weekly training cap tracking
  lastTrainWeek?: number;
  trainsThisWeek?: number;
  // R2-G: weekly tournament-entry cap. Without this the deterministic roll
  // keyed only on (week, hobbyId) meant a single win could be re-collected
  // indefinitely the same week. Set to `weeksLived` after an entry.
  lastTournamentWeek?: number;
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

// ---------------------------------------------------------------------------
// Dark Web system (introduced in STATE_VERSION 18, OnionApp remake).
// Replaces the wantedLevel-tick + one-click-hack model with a marketplace,
// vendor reputation, multi-stage jobs, a heat meter, and a laundering chain.
// Legacy `wantedLevel`, `darkWebItems[]`, `hacks[]` remain for back-compat.
// ---------------------------------------------------------------------------

export type DarkWebHeatBand = 'cold' | 'warm' | 'hot' | 'burning';

export type DarkWebSkillId = 'hacking' | 'social' | 'opsec' | 'laundering';

export interface DarkWebSkill {
  level: number;
  xp: number;
  nextLevelXp: number;
}

export type DarkWebMarketCategory =
  | 'stolenAccounts'
  | 'cardedItems'
  | 'fakeIds'
  | 'hackingTools'
  | 'services'
  | 'data'
  | 'gear';

export type DarkWebListingTier = 'common' | 'pro' | 'elite';

export interface DarkWebVendor {
  id: string;
  handle: string;
  /** Reputation 0..100. Drives scam probability and listing price markup. */
  reputation: number;
  reviewCount: number;
  flaggedScam?: boolean;
}

export interface DarkWebMarketListing {
  id: string;
  vendorId: string;
  category: DarkWebMarketCategory;
  title: string;
  description: string;
  costBtc: number;
  tier: DarkWebListingTier;
  heatCost: number;
  minBuyerRep: number;
  postedWeek: number;
  lifetimeWeeks: number;
  xpReward?: { skill: string; amount: number };
}

export type DarkWebJobStageKind = 'recon' | 'social' | 'exploit' | 'exfiltrate' | 'fence';

export interface DarkWebActiveJob {
  id: string;
  templateId: string;
  startedWeek: number;
  currentStage: number;
  completedStages: { stage: number; week: number; outcome: 'success' | 'fail' }[];
  expiresWeek: number;
  status: 'in-progress' | 'completed' | 'failed' | 'expired';
}

export type DarkWebMixerTier = 'cheap' | 'standard' | 'premium';

export interface DarkWebLaunderingTx {
  id: string;
  tier: DarkWebMixerTier;
  dirtyAmountBtc: number;
  netAmountBtc: number;
  startedWeek: number;
  readyWeek: number;
  status: 'pending' | 'completed' | 'failed';
}

export interface DarkWebState {
  /** Persistent investigation heat 0..100. Replaces wantedLevel as the source of truth. */
  heat: number;
  /** Last week heat decay ran. */
  lastHeatDecayWeek: number;
  /** Untainted-yet BTC earned from dark-web jobs. Must be laundered before exchanges accept it. */
  dirtyBtc: number;
  /** BTC that has cleared the mixer. Can be sold via the legacy cryptos.btc flow. */
  cleanBtc: number;
  /** Buyer reputation 0..100 — unlocks higher-tier listings. */
  playerReputation: number;
  /** Vendor directory. */
  vendors: DarkWebVendor[];
  /** Currently posted listings (rotates weekly). */
  listings: DarkWebMarketListing[];
  /** Jobs the player is running. */
  activeJobs: DarkWebActiveJob[];
  /** Completed/expired jobs (capped). */
  jobHistory: DarkWebActiveJob[];
  /** Pending and completed laundering transactions. */
  laundering: DarkWebLaunderingTx[];
  /** Player skills. */
  skills: Record<DarkWebSkillId, DarkWebSkill>;
  /** Forum / news events (recent only). */
  recentEvents: { id: string; week: number; text: string }[];
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
  // The NPC's CURRENT short-term want (rotates over time in the weekly tick).
  // Distinct from the long-term `npcGoals` ("dreams of"): a want is a small,
  // satisfiable ask (spend time / a gift / space) the player can read and fulfil
  // for a bond boost — with diminishing returns — and pays a small cost for
  // ignoring. Additive/optional: absent on old saves (defaults to no want until
  // the next tick assigns one).
  npcWant?: NPCWant;
}

/**
 * A rotating, satisfiable short-term desire. The weekly NPC-depth tick assigns
 * one, rotates it every few weeks, rewards satisfying it (diminishing per cycle)
 * and levies a small cost when a "needy" want lapses unmet.
 */
export type NPCWantId =
  | 'hear_from_you'
  | 'quality_time'
  | 'deep_talk'
  | 'a_gift'
  | 'meet_friends'
  | 'space';

export interface NPCWant {
  id: NPCWantId;
  /** Player-facing phrase, e.g. "Wants to spend time together". */
  label: string;
  /** weeksLived when this want was assigned — drives rotation + neglect. */
  since: number;
  /** Times satisfied during the CURRENT cycle (drives diminishing returns). */
  satisfiedCount: number;
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
  /**
   * The week the wedding was FIRST scheduled for, in `weeksLived`.
   *
   * R3-F6: the 1-year expiry measured `nextWeeksLived - scheduledWeek` inside a
   * branch gated on `scheduledWeek === nextWeeksLived`, so the age was always
   * 0 and the branch was unreachable. The postpone path then overwrote
   * `scheduledWeek` with `nextWeeksLived + 4`, discarding the original date, so
   * the value could never drift either. Optional: a save written before this
   * field existed falls back to the current `scheduledWeek`, which restarts the
   * clock rather than expiring a plan retroactively.
   */
  originalScheduledWeek?: number;
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
  miningHistory: {
    week: number;
    earnings: number;
    cryptoMined: Record<string, number>;
    powerCost: number;
  }[];
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

// ---------------------------------------------------------------------------
// Crypto market (introduced in STATE_VERSION 16, BitcoinMiningApp remake).
// Drives volatility regimes, order books, DCA scheduling, and tax tracking.
// Legacy `cryptos[].price` remains authoritative for instantaneous reads;
// `cryptoMarket.coinMarkets[id]` adds the regime/history/spread data.
// ---------------------------------------------------------------------------

export type CryptoRegime = 'stable' | 'volatile' | 'bull' | 'bear';

export interface CoinMarket {
  cryptoId: string;
  regime: CryptoRegime;
  /** Weeks remaining in current regime before re-roll. */
  regimeWeeksRemaining: number;
  /** Last 100 weeks of price points, oldest first. */
  priceHistory: { weeksLived: number; price: number }[];
  /** Current bid/ask spread as a fraction of price (driven by regime). */
  bidAskSpread: number;
}

export type CryptoOrderType = 'market' | 'limit' | 'stop';
export type CryptoOrderSide = 'buy' | 'sell';
export type CryptoOrderStatus = 'open' | 'filled' | 'cancelled' | 'expired';

export interface CryptoOrder {
  id: string;
  cryptoId: string;
  side: CryptoOrderSide;
  type: CryptoOrderType;
  /** For buys: USD to spend. For sells: coin amount to sell. */
  amount: number;
  limitPrice?: number;
  stopPrice?: number;
  placedWeek: number;
  status: CryptoOrderStatus;
  filledPrice?: number;
  filledWeek?: number;
  reason?: 'manual' | 'dca' | 'stop-loss';
}

export interface CryptoDCARule {
  id: string;
  cryptoId: string;
  /** USD per execution. */
  amount: number;
  /** BankAccount id from gameState.banking; debits weekly/monthly. */
  fromAccountId: string;
  cadence: 'weekly' | 'monthly';
  nextExecutionWeek: number;
  enabled: boolean;
  totalInvested: number;
  totalCoinsBought: number;
}

export interface CryptoCostBasis {
  totalCost: number;
  totalShares: number;
}

export interface CryptoMarketState {
  coinMarkets: Record<string, CoinMarket>;
  openOrders: CryptoOrder[];
  /** Order history (capped to recent 50 for the UI). */
  orderHistory: CryptoOrder[];
  dcaRules: CryptoDCARule[];
  /** Average cost basis tracked per coin for capital-gains computation. */
  costBasis: Record<string, CryptoCostBasis>;
  /** Realized gains accumulated this game-year (debited at year boundary). */
  realizedGainsThisYear: number;
  /** Total realized gains lifetime — for stats/breakdown. */
  totalRealizedGains: number;
  /** Last halving event week (BTC-style supply halving). */
  lastHalvingWeek?: number;
  /** Count of halvings that have fired. Mining reward = base × 0.5^halvingCount. */
  halvingCount?: number;
  /** Last observed economy state — drives regime forcing. */
  lastEconomyState?: 'normal' | 'recession' | 'boom' | 'crash';
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
  avatarId?: string; // Chosen starter face id (`<m|f><index>`, utils/facePool)
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

// ==================== Pulse Social Platform (v13) ====================
// Types backing the Pulse in-game social app. All time-stamped fields use
// `weeksLived` (absolute, monotonic) — never `state.week` (cyclic 1-4).

export type PulseContentType = 'text' | 'photo' | 'video' | 'story' | 'live';
export type PulsePostCategory =
  | 'lifestyle' | 'career' | 'fitness' | 'travel' | 'food'
  | 'tech' | 'music' | 'gaming' | 'sponsored';
export type PulseInfluenceLevel = 'novice' | 'rising' | 'popular' | 'influencer' | 'celebrity';
export type PulseScandalType =
  | 'leaked_dm' | 'bad_take' | 'cancel'
  | 'deepfake' | 'public_meltdown' | 'brand_betrayal';
export type PulseNotificationType =
  | 'like' | 'comment' | 'follow' | 'mention' | 'repost'
  | 'brand_offer' | 'scandal_update' | 'milestone'
  | 'live_invite' | 'verified_pro_renewal' | 'system';
export type PulseHashtagSource =
  | 'organic' | 'event' | 'scandal' | 'brand' | 'season' | 'player';
export type PulseBrandCategory =
  | 'lifestyle' | 'tech' | 'fashion' | 'fitness' | 'food' | 'auto' | 'finance';
export type PulseScandalResolution = 'apology' | 'silence' | 'gems' | 'lawsuit';

export interface PulseComment {
  id: string;
  postId: string;
  authorId: string;            // 'player' | npcId | randomProfileId
  authorHandle: string;
  authorPhoto?: string;
  content: string;
  likes: number;
  timestamp: number;
  gameWeek: number;            // weeksLived
  isPlayerComment: boolean;
  parentCommentId?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'hostile';
  isFromHater?: boolean;
}

export interface PulseTrendingHashtag {
  tag: string;                 // includes '#'
  postCount: number;
  source: PulseHashtagSource;
  triggeredByEventId?: string;
  velocity: number;            // 0-100 growth this week
  decayWeek: number;           // weeksLived when this drops off
  whyReason?: string;          // shown in "Why is this trending?" tooltip
}

export interface PulseBrandOffer {
  id: string;
  brandName: string;
  type: 'sponsored_post' | 'brand_deal' | 'long_campaign' | 'ambassador';
  payment: number;
  weeklyPayment?: number;
  postsRequired: number;
  duration: number;            // weeks
  category: PulseBrandCategory;
  requirements: { minFollowers: number; minEngagementRate: number; minReputation?: number };
  description: string;
  expiresInWeeks: number;
  offeredWeek: number;         // weeksLived
  prestigeImpact?: number;
  logoColor1?: string;
  logoColor2?: string;
}

export interface PulseActiveBrandDeal {
  // Legacy fields preserved verbatim
  id: string;
  brandName: string;
  payment: number;
  expiresAt: number;           // weeksLived
  expiresIn: number;
  // v13 additive
  postsRequired?: number;
  postsDelivered?: number;
  weeklyPayment?: number;
  category?: PulseBrandCategory;
  exclusivityFlag?: string;
  riskOfBreach?: number;       // 0-100
  logoColor1?: string;
  logoColor2?: string;
}

export interface PulseRecentPost {
  id: string;
  content: string;
  likes: number;
  comments: number;
  timestamp: number;
  gameWeek?: number;           // weeksLived
  gameMonth?: string;
  gameYear?: number;
  contentType: PulseContentType;
  category?: PulsePostCategory;
  photo?: string;
  isViral?: boolean;
  hashtags?: string[];
  repostOf?: string;
  isReposted?: boolean;
  isLiked?: boolean;
  isBookmarked?: boolean;
  views?: number;
  reposts?: number;
  bookmarks?: number;
  sponsoredByDealId?: string;
  sponsoredBrandName?: string;
}

export interface PulseNotification {
  id: string;
  type: PulseNotificationType;
  timestamp: number;
  gameWeek: number;            // weeksLived
  read: boolean;
  fromId?: string;
  fromHandle?: string;
  fromPhoto?: string;
  refPostId?: string;
  refCommentId?: string;
  refDealId?: string;
  text: string;
}

export interface PulseActiveScandal {
  id: string;
  type: PulseScandalType;
  severity: number;            // 0-100
  weeksRemaining: number;
  startedWeek: number;         // weeksLived
  reputationLossThisWeek: number;
  followerLossThisWeek: number;
  headline: string;
  resolutionMethod?: PulseScandalResolution | null;
}

export interface PulseScandalRecord {
  id: string;
  type: string;
  severity: number;
  survivedAtWeek: number;      // weeksLived
  finalReputationLoss: number;
  resolutionMethod: string;
}

export interface PulseFollowGraph {
  followingNpcIds: string[];
  followedByNpcIds: string[];
  lastUpdatedWeek: number;     // weeksLived
  // ANTI-EXPLOIT: NPCs that have already granted their one-time follow-back
  // follower boost. Without this, a follow → unfollow → re-follow loop farms
  // unlimited followers (and therefore ad/brand-deal income).
  followBackGrantedNpcIds?: string[];
}

export interface PulseDeclinedOffer {
  id: string;
  declinedWeek: number;        // weeksLived
}

export interface PulseDealHistoryEntry {
  id: string;
  brandName: string;
  totalPaid: number;
  completedWeek: number;       // weeksLived
  result: 'success' | 'failed' | 'breached';
}

export interface PulseBrandInbox {
  pending: PulseBrandOffer[];
  declined: PulseDeclinedOffer[];   // cap 20
  history: PulseDealHistoryEntry[];
}

/** In-game (cash) subscription billing plan. Pulse Verified Pro and Spark
 *  Premium are paid from stats.money and auto-renew weekly on the tick. */
export type InGameSubscriptionPlan = 'weekly' | 'annual';

export interface PulseVerifiedPro {
  active: boolean;
  subscribedTimestamp?: number;     // real ms
  expiresTimestamp?: number;        // legacy IAP field — no longer used for gating
  sku?: string;                     // legacy IAP field — not set for in-game subs
  // ── In-game cash subscription (paid from stats.money, billed weekly on the
  //    tick — see applySubscriptionsForWeek). All optional so pre-existing saves
  //    load unchanged; reads are null-guarded. No STATE_VERSION bump.
  plan?: InGameSubscriptionPlan;
  weeklyPrice?: number;             // in-game $ billed each weekly tick
  startedWeek?: number;             // weeksLived when subscribed
  paidThroughWeek?: number;         // annual prepay: skip weekly billing until weeksLived >= this
  perksUnlocked: {
    blueCheckmark: boolean;
    postBoostMultiplier: number;    // 1.0 inactive, 1.25 active
    analyticsUnlocked: boolean;
    noAdsInFeed: boolean;
    longerPosts: boolean;           // 500 char vs 280
  };
}

export interface PulseLiveChatter {
  npcId: string;
  lastMessageTimestamp: number;
}

export interface PulseLiveSession {
  active: boolean;
  topic: string;
  startedTimestamp: number;          // real ms
  startedWeek: number;               // weeksLived
  currentViewers: number;
  peakViewers: number;
  minutesElapsed: number;
  donationsEarned: number;
  npcChatters: PulseLiveChatter[];
}

export interface PulsePendingBoost {
  type: 'post' | 'follower_ad' | 'recovery';
  postId?: string;
  appliedWeek: number;               // weeksLived
}

export interface PulseLifetimeStats {
  peakFollowers: number;
  peakInfluenceLevel: PulseInfluenceLevel;
  totalScandalsSurvived: number;
  totalBrandDealsCompleted: number;
  totalGemsBoostsUsed: number;
  totalVerifiedProWeeks: number;
}

// ==================== Spark Dating App (v15) ====================
// Types backing the Spark in-game dating app. All time-stamped fields use
// `weeksLived` (absolute, monotonic) — never `state.week` (cyclic 1-4).

export type SparkSwipeDirection = 'left' | 'right' | 'super';
export type SparkPremiumTier = 'free' | 'plus' | 'ultra';
export type SparkCatfishOutcome = 'exposed' | 'ignored' | 'fell_for_it';
export type SparkJealousyOutcome = 'caught_cheating' | 'denied' | 'admitted' | 'confronted' | 'dismissed';
export type SparkDateMood = 'amazing' | 'great' | 'good' | 'awkward' | 'disaster';

export interface SparkSwipe {
  profileId: string;
  direction: SparkSwipeDirection;
  matched: boolean;
  swipedWeek: number;        // weeksLived
  timestamp: number;         // wall clock ms
}

export interface SparkMatch {
  id: string;                // matches relationship.id once promoted
  profileId: string;         // original dating profile id
  matchedWeek: number;       // weeksLived
  superLiked: boolean;
  lastMessageTimestamp?: number;
  unreadByPlayer?: number;
  unreadByNpc?: number;
  /** True when the match has been "promoted" into state.relationships (chat → dating). */
  promoted: boolean;
}

export interface SparkMessage {
  id: string;
  matchId: string;
  from: 'player' | 'npc';
  text: string;
  timestamp: number;
  gameWeek: number;          // weeksLived
}

export interface SparkPlayerProfile {
  displayName?: string;
  bio: string;
  photos: string[];          // URIs (first = primary)
  interests: string[];
  age?: number;              // derived from gameState.date.age by default
  job?: string;              // derived from current career
  location?: string;
  showAge: boolean;
  showJob: boolean;
  showWealth: boolean;
  /** Cached "attractiveness score" used to bias incoming likes — recomputed weekly. */
  attractivenessScore?: number;
}

export interface SparkPremium {
  active: boolean;
  tier: SparkPremiumTier;
  subscribedTimestamp?: number;
  expiresTimestamp?: number;        // legacy IAP field — no longer used for gating
  sku?: string;                     // legacy IAP field — not set for in-game subs
  // ── In-game cash subscription (paid from stats.money, billed weekly on the
  //    tick — see applySubscriptionsForWeek). All optional; old saves unchanged.
  plan?: InGameSubscriptionPlan;
  weeklyPrice?: number;             // in-game $ billed each weekly tick
  startedWeek?: number;             // weeksLived when subscribed
  paidThroughWeek?: number;         // annual prepay: skip weekly billing until weeksLived >= this
  perks: {
    unlimitedSwipes: boolean;
    seeWhoLikedYou: boolean;
    rewindLastSwipe: boolean;
    boostMultiplier: number;      // 1.0 free, 1.5 plus, 2.5 ultra
    superLikesPerDay: number;     // 1 free, 5 plus, 10 ultra
    verifiedBadge: boolean;       // verified on dating profile
    travelMode: boolean;          // see profiles from other locations
  };
}

export interface SparkLikedYouEntry {
  profileId: string;
  likedAtWeek: number;          // weeksLived
  superLiked: boolean;
}

export interface SparkJealousyEvent {
  id: string;
  partnerId: string;             // relationship.id of the partner who got jealous
  triggerType: 'multiple_dating' | 'spotted_swiping' | 'rumored_affair' | 'flirty_dm';
  severity: number;              // 0-100
  startedWeek: number;           // weeksLived
  resolved: boolean;
  outcome?: SparkJealousyOutcome;
}

export interface SparkCatfishRecord {
  profileId: string;
  exposedAtWeek?: number;
  outcome: SparkCatfishOutcome;
  moneyLost?: number;
}

export interface SparkLifetimeStats {
  totalSwipes: number;
  totalMatches: number;
  totalSuperLikes: number;
  totalDatesGoneOn: number;
  totalGiftsGiven: number;
  totalProposals: number;
  totalMarriages: number;
  totalDivorces: number;
  totalCatfishExposed: number;
  totalJealousyEvents: number;
  peakPremiumTier: SparkPremiumTier;
  totalPremiumWeeks: number;
}

export interface SparkAppState {
  /** Player's own dating profile (separate from Pulse's userProfile). */
  profile: SparkPlayerProfile;
  /** Swipe history (ring buffer, cap 200). */
  swipes: SparkSwipe[];
  /** All matches (promoted + unpromoted). Lifecycle: match → chat → promote to relationship. */
  matches: SparkMatch[];
  /** Chat messages keyed by matchId. */
  messages: Record<string, SparkMessage[]>;
  /** Daily swipe quota. Resets weekly via Spark tick. */
  swipeQuota: number;
  swipesUsedThisWeek: number;
  lastQuotaResetWeek: number;     // weeksLived
  /** Daily super-like quota. */
  superLikesUsedThisWeek: number;
  /** Premium subscription state. */
  premium: SparkPremium;
  /** Profiles that liked the player (Premium feature reveal). */
  likedYou: SparkLikedYouEntry[];
  /** Catfish records — exposed and fallen-for. */
  catfishRecords: SparkCatfishRecord[];
  /** Active jealousy event (one at a time). */
  activeJealousy: SparkJealousyEvent | null;
  jealousyHistory: SparkJealousyEvent[];
  /** Boost active flag (gem-purchased, lasts 1 in-game week). */
  boost: { active: boolean; expiresWeek: number } | null;
  /** Profile IDs the player has dismissed as definitely catfish. */
  dismissedCatfishIds: string[];
  /** Profile IDs the player has reported. */
  reportedIds: string[];
  /** Lifetime totals (carry across prestige). */
  lifetimeStats: SparkLifetimeStats;
  /** Last time the player opened Spark (for "new matches since" prompts). */
  lastOpenedTimestamp?: number;
}

// ==================== Hustle Business App (v17) ====================
// Premium layer ON TOP of the existing `companies[]` array. The Company
// interface and CompanyActions remain canonical for upgrades, employees,
// passive income; Hustle adds campaigns, scandals, board governance, IPO,
// M&A, hiring pipeline, supplier deals. Keyed by `companyId`.

export type HustleIndustry = 'factory' | 'ai' | 'restaurant' | 'realestate' | 'bank';
export type HustleCampaignKind = 'tv' | 'social' | 'billboard' | 'influencer' | 'guerrilla';
export type HustleScandalKind =
  | 'product_defect'
  | 'labor_abuse'
  | 'environmental'
  | 'data_breach'
  | 'fraud_allegation'
  | 'pr_disaster';
export type HustleScandalResolution = 'apology' | 'recall' | 'lawsuit' | 'cover_up' | 'restructure';
export type HustleCandidateRole = 'engineer' | 'sales' | 'manager' | 'designer' | 'analyst' | 'operations';
export type HustleStockListing = 'private' | 'public';
export type HustleAcquisitionStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface HustleCandidate {
  id: string;
  name: string;
  role: HustleCandidateRole;
  skill: number;             // 0-100 baseline competence
  experience: number;        // 0-100 years-of-experience proxy
  salaryAsk: number;         // weekly salary expectation
  signOnBonus?: number;      // one-time
  postedWeek: number;        // weeksLived when the candidate appeared
  expiresWeek: number;       // weeksLived when they take another offer
  /** Sentiment toward player's offer (0-100). Falls when player lowballs. */
  interestLevel: number;
}

export interface HustleHire {
  candidateId: string;
  hiredWeek: number;
  role: HustleCandidateRole;
  salary: number;
  morale: number;            // 0-100; affects productivity + retention
  performance: number;       // 0-100; rolled weekly
}

export interface HustleHiringPipeline {
  /** Candidates currently in the player's job listings. */
  candidates: HustleCandidate[];
  /** Hired employees in addition to the flat `Company.employees` count.
   *  Each `HustleHire` represents a named/skilled hire on top of generic staff. */
  namedHires: HustleHire[];
  /** Weeks since last hire (drives morale of existing staff if hiring stalls). */
  weeksSinceLastHire: number;
  /** Total severance paid this life (for achievements). */
  totalSeverance: number;
}

export interface HustleCampaign {
  id: string;
  kind: HustleCampaignKind;
  spendPerWeek: number;
  startedWeek: number;
  durationWeeks: number;
  /** Cached projected ROI used by the UI. Recomputed weekly. */
  projectedROI: number;
  /** True if the player has actually paid the spend each week. */
  active: boolean;
}

export interface HustleBrandHealth {
  score: number;             // 0-100 — composite brand sentiment
  trend: 'rising' | 'flat' | 'declining';
  lastUpdatedWeek: number;
}

export interface HustleActiveScandal {
  id: string;
  kind: HustleScandalKind;
  severity: number;          // 0-100
  startedWeek: number;
  weeksRemaining: number;
  headline: string;
  resolutionMethod?: HustleScandalResolution | null;
  /** Weekly drag on company revenue while the scandal is active. */
  revenueDragPercent: number;
}

export interface HustleScandalRecord {
  id: string;
  kind: HustleScandalKind;
  severity: number;
  survivedAtWeek: number;
  finalReputationLoss: number;
  totalRevenueLoss: number;
  resolutionMethod: string;
}

export interface HustleBoardMember {
  id: string;
  name: string;
  role: 'chair' | 'cfo' | 'cto' | 'cmo' | 'lead_investor' | 'independent';
  votingShare: number;       // 0-100 percent
  alignment: 'aggressive_growth' | 'cost_cutting' | 'employee_focused' | 'shareholder_focused';
  satisfaction: number;      // 0-100
}

export interface HustleIPO {
  status: HustleStockListing;
  /** Set when status === 'public'. */
  listedWeek?: number;
  /** Player's remaining ownership share after IPO + dilution. */
  ownershipPercent: number;
  /** Per-share price the market is currently quoting. */
  sharePrice: number;
  /** Total shares outstanding (in thousands for readability). */
  sharesOutstandingK: number;
  /** Last quarterly earnings report week. */
  lastEarningsWeek?: number;
  /** Trend of last 4 quarterly reports — emoji-friendly. */
  recentEarnings: { week: number; revenue: number; beat: boolean }[];
}

export interface HustleAcquisitionOffer {
  id: string;
  targetName: string;        // procedurally generated rival company
  targetIndustry: HustleIndustry;
  askingPrice: number;
  estimatedAnnualRevenue: number;
  synergyBonusPercent: number;
  offeredWeek: number;
  expiresWeek: number;
  status: HustleAcquisitionStatus;
}

export interface HustleSupplier {
  id: string;
  name: string;
  industry: HustleIndustry;
  costPerWeek: number;
  reliability: number;       // 0-100
  contractEndWeek?: number;  // weeksLived; undefined = month-to-month
}

/**
 * Per-company Hustle state. Keyed by the underlying Company.id, so the
 * existing `companies[]` array stays canonical for revenue/employees/upgrades.
 */
export interface HustleCompanyOverlay {
  companyId: string;
  hiringPipeline: HustleHiringPipeline;
  activeCampaigns: HustleCampaign[];
  brand: HustleBrandHealth;
  activeScandal: HustleActiveScandal | null;
  scandalHistory: HustleScandalRecord[];
  boardSeats: HustleBoardMember[];
  ipo: HustleIPO;
  pendingAcquisitions: HustleAcquisitionOffer[];
  suppliers: HustleSupplier[];
  /** Estimated weekly market-share percent vs procedural rivals (0-100). */
  marketSharePercent: number;
  /** Notifications surfaced by this company (alerts inbox). */
  notifications: HustleNotification[];
}

export interface HustleNotification {
  id: string;
  type:
    | 'campaign_complete'
    | 'scandal_alert'
    | 'candidate_applied'
    | 'board_vote'
    | 'acquisition_offer'
    | 'ipo_milestone'
    | 'earnings_report'
    | 'supplier_issue'
    | 'system';
  text: string;
  timestamp: number;
  gameWeek: number;          // weeksLived
  read: boolean;
  refCompanyId?: string;
  refId?: string;
}

export interface HustleLifetimeStats {
  totalCompaniesFounded: number;
  totalCompaniesSold: number;
  totalIPOsLaunched: number;
  totalAcquisitionsCompleted: number;
  totalScandalsSurvived: number;
  totalCampaignsRun: number;
  totalNamedHires: number;
  totalFires: number;
  peakBrandScore: number;
  peakMarketShare: number;
  peakSharePrice: number;
}

export interface HustleAppState {
  /** Per-company overlay data, keyed by Company.id. */
  companies: Record<string, HustleCompanyOverlay>;
  /** Lifetime aggregates that carry across prestige. */
  lifetimeStats: HustleLifetimeStats;
  /** Last opened — for "new alerts since" UI. */
  lastOpenedTimestamp?: number;
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
  deepLifePlusActivated?: boolean; // DeepLife+ ad-free benefit currently active (cleared on lapse)
  deepLifePlusWelcomeClaimed?: boolean; // Sticky: welcome gems granted once ever (never cleared on lapse)
  deepLifePlusLastGemClaim?: string; // UTC day key of the last daily gem-drop claim (members-only)
  deepLifePlusGemClaimDays?: string[]; // Recent UTC day keys claimed (pruned) — powers the weekly streak strip
  deepLifePlusLastGemClaimAt?: number; // Monotonic epoch-ms high-water mark of the last claim — blocks backward-clock farming
  // Absolute `weeksLived` of the last Bank sponsored-bonus claim. Optional with
  // an undefined default (the sanctioned pattern — an absent key already equals
  // "never claimed"), so no migration or STATE_VERSION bump is owed. Keyed on
  // GAME time, never a wall-clock date: a real-time key is farmable by moving
  // the device clock (2026-07-24 daily-gem lesson).
  lastAdCashBonusWeek?: number;
  /**
   * `weeksLived` at which each HUD quick action was last used, keyed by action
   * id. The long-press quick actions had no gate at all on `rest`, so
   * rest -> social netted +6 energy and +5 happiness per cycle, repeatable
   * forever from the always-visible top bar — and energy is what gates street
   * jobs, crime, health activities and hobbies. The module comment even claimed
   * they were "self-limiting". Absent means nothing used yet.
   * 2026-07-30 audit UX-R1-02.
   */
  quickActionWeeks?: Record<string, number>;
  /**
   * `weeksLived` at which the ad orb last honoured a NO-FILL courtesy reward —
   * a grant made with no ad shown, because ads are on for this build but there
   * was no inventory.
   *
   * R4-MON-6: that courtesy was capped by a MODULE-LEVEL boolean
   * (`noFillGrantedThisSession` in `AdRewardOrb.tsx`), whose own comment said it
   * exists because otherwise "a whale could farm the capped reward on every
   * respawn with NO ad ever shown (~$10M/hr)". A module variable resets on app
   * restart, so the farm was simply "force-quit and relaunch" — and the reward
   * scales with net worth, so it is worth most to exactly the players who can
   * be bothered. CLAUDE.md §4.4: gate on game state, never on something the
   * player can reset.
   *
   * Absent means "never granted", so this is a carve-out field: STATE_VERSION
   * bumped, NO backfill and no `repairGameState` mirror. Game time, not wall
   * clock — a real-time key is farmable by moving the device clock.
   */
  lastNoFillGrantWeek?: number;
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
  /**
   * Original (pre-complication) effect magnitudes. Written the first time an
   * untreated disease worsens so compounding stays capped at 3x base, and so
   * managed care can reset symptoms back to true baseline.
   */
  baseEffects?: Partial<GameStats>;
  /**
   * Chronic-care window: weekly ticks up to and including this week apply only
   * half of this disease's stat penalties and skip complication worsening.
   * Set by doctor visits / hospital stays on non-curable, treatment-requiring
   * diseases. Optional/additive — absent (old saves / never treated) means
   * unmanaged, which is exactly the previous behavior.
   */
  managedUntilWeek?: number;
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

  // -------------------------------------------------------------------------
  // Remake 4 (RealEstateApp): mortgage, tenancy, neighborhood cycle. All
  // optional so existing saves load cleanly — no migration needed.
  // -------------------------------------------------------------------------
  /** Loan.id of the mortgage attached to this property. */
  mortgageId?: string;
  /** What the player paid at purchase. Used for cost-basis / capital-gains. */
  purchasePrice?: number;
  /** weeksLived when the property was bought. */
  purchasedWeek?: number;
  /** Tag identifying the neighborhood (assigned at purchase, evolves through cycles). */
  neighborhood?: string;
  /** Current market cycle for this neighborhood. */
  marketCycle?: 'stable' | 'gentrifying' | 'hot' | 'cooling';
  /** Weeks remaining in the current cycle before re-roll. */
  cycleWeeksRemaining?: number;
  /** Rental mode when status='rented'. Drives yield + variance + churn. */
  rentMode?: 'longTerm' | 'airbnb' | 'commercial';
  /** Current tenant occupying the property (longTerm/commercial). */
  tenant?: {
    id: string;
    name: string;
    satisfaction: number;
    movedInWeek: number;
    weeklyRent: number;
  };
  /** Weeks the property has been vacant. Resets to 0 when a tenant moves in. */
  weeksVacant?: number;
  /** Whether this property is acting as a laundering front. */
  launderingFront?: boolean;
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
  /** Total successful on-time payments — feeds credit score. */
  onTimePayments?: number;
  /** Missed payments — feeds credit score and triggers late fees. */
  latePayments?: number;
  /** weeksLived of last successful payment. */
  lastPaidWeek?: number;
  /** Original APR offered (may differ from rateAPR if refinanced). */
  originalAPR?: number;
  /**
   * For `type: 'auto'` loans — the id of the financed vehicle. Lets the UI link
   * a loan to its vehicle reliably (matching by name substring mismatched
   * duplicate models and collided on names that were substrings of others).
   * Optional: legacy auto loans predate this field and fall back to name match.
   */
  vehicleId?: string;
}

// ---------------------------------------------------------------------------
// Banking system (introduced in STATE_VERSION 14, AdvancedBankApp remake)
// ---------------------------------------------------------------------------

export type BankAccountType = 'checking' | 'savings' | 'highYieldSavings' | 'cd' | 'moneyMarket';

export interface BankAccount {
  id: string;
  type: BankAccountType;
  name: string;
  balance: number;
  /** Annual APR (decimal). Base value before economy/politics modifiers. */
  baseAPR: number;
  /** weeksLived when account was opened — feeds credit-score account-age. */
  openedWeek: number;
  /** For CDs and high-yield accounts: balance is locked until this week. */
  lockUntilWeek?: number;
  /** Minimum required balance (e.g. money market). */
  minBalance?: number;
}

export type CreditCardTier = 'starter' | 'standard' | 'gold' | 'platinum';
export type CreditCardRewardType = 'cashback' | 'miles' | 'points';

export interface CreditCard {
  id: string;
  name: string;
  tier: CreditCardTier;
  creditLimit: number;
  /** Current outstanding revolving balance (debt). */
  balance: number;
  baseAPR: number;
  /** Decimal — 0.01 = 1% rewards on spend. */
  rewardsRate: number;
  rewardsType: CreditCardRewardType;
  /** Accumulated, unredeemed rewards. */
  pendingRewards: number;
  openedWeek: number;
  /** Minimum credit score required to qualify. */
  minCreditScore: number;
  /** Annual fee (deducted on anniversary). */
  annualFee?: number;
}

export type BudgetCategory =
  | 'housing'
  | 'food'
  | 'transport'
  | 'health'
  | 'education'
  | 'entertainment'
  | 'lifestyle'
  | 'vice'
  | 'savings'
  | 'debt'
  | 'taxes'
  | 'other';

export type BillPaySource = 'rent' | 'mortgage' | 'loan' | 'subscription' | 'utility' | 'card' | 'manual';

export interface BillPayRule {
  id: string;
  label: string;
  category: BudgetCategory;
  amount: number;
  /** Account to debit. Must reference banking.accounts[].id. */
  fromAccountId: string;
  cadence: 'weekly' | 'monthly';
  /** weeksLived when next debit is due. */
  nextDueWeek: number;
  source: BillPaySource;
  /** ID of the source object (loan.id, realEstate.id, subscription.id). */
  sourceRefId?: string;
  enabled: boolean;
  lastPaidWeek?: number;
  /** Late payments accumulate — flushed when caught up. Drives credit-score hit. */
  missedCount: number;
}

export interface BudgetWeekBucket {
  /** weeksLived of the start of this bucket. */
  weeksLived: number;
  byCategory: Partial<Record<BudgetCategory, number>>;
}

export interface CreditScoreState {
  score: number;
  band: 'poor' | 'fair' | 'good' | 'veryGood' | 'excellent';
  componentBreakdown: {
    paymentHistory: number;
    utilization: number;
    accountAge: number;
    creditMix: number;
    inquiries: number;
  };
  lastUpdatedWeek: number;
  /** Trend history — capped to last 100 entries. */
  history: { weeksLived: number; score: number }[];
  /** Recent credit inquiries — capped to last 2 years for scoring. */
  inquiries: { weeksLived: number; type: 'loan' | 'card' | 'mortgage' }[];
}

export type SavingsGoalCategory = 'emergency' | 'house' | 'vacation' | 'retirement' | 'other';

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  /** Optional: when set, deposits to this goal pull from this account. */
  linkedAccountId?: string;
  category: SavingsGoalCategory;
  createdWeek: number;
  targetWeek?: number;
  /**
   * v22 Wave A: weekly auto-contribution swept FROM the linked account (or cash)
   * into this goal by `applySavingsGoals`. Optional; absent/0 = manual only.
   */
  autoContribute?: number;
  /**
   * v22 Wave A: the week the goal first reached its target. Set exactly once —
   * gates the bounded completion reward so it is granted only a single time.
   */
  completedWeek?: number;
}

export interface BankingState {
  accounts: BankAccount[];
  creditCards: CreditCard[];
  billPayRules: BillPayRule[];
  /** Ring buffer of last N weeks of spend by category. New entries appended in advanceToNextWeek. */
  budgetSpend: BudgetWeekBucket[];
  creditScore: CreditScoreState;
  savingsGoals: SavingsGoal[];
  totalLateFeesPaid: number;
  totalInterestEarned: number;
  totalInterestPaid: number;
  /** Capital-gains/tax accrual — debited yearly. */
  taxDueThisYear: number;
  /** Last observed economy state — used to surface "rates changed" notifications. */
  lastEconomyState?: 'normal' | 'recession' | 'boom' | 'crash';
  /**
   * v22 Wave A: live rate environment derived from `economyState` — a deposit-APY
   * multiplier and an additive loan-APR delta. Neutral default `{ depositMult: 1,
   * loanDelta: 0 }`. Read via `??` everywhere.
   */
  rateEnvironment?: { depositMult: number; loanDelta: number };
  /**
   * v22 Wave A: computer-only monthly budget targets by category (for overspend
   * alerts). Optional map; absent = no targets set.
   */
  budgetTargets?: Partial<Record<BudgetCategory, number>>;
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
  views: number;
  earnings: number;
  // Optional: different creation paths populate different subsets of these.
  description?: string;
  game?: string;
  gameId?: string;
  followers?: number;
  subscribers?: number;
  subscribersGained?: number;
  quality?: number;
  duration?: string | number;
  likes?: number;
  comments?: number;
  uploadDate?: string | number;
  uploadedAt?: number;
  timestamp?: number;
  rpm?: number;
  ctr?: number;
  avgViewDuration?: number;
  source?: string;
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
  subscribers?: number;
  chatMessages: number;
  donations: number;
  timestamp?: number; // ms since epoch; used to sort recent streams for income decay
  /** weeksLived when this stream ran — used to decay income by REAL elapsed weeks. */
  uploadedAt?: number;
  // ── Real-time LIVE session fields (v: live streaming). All optional/additive
  //    so old saves load unchanged and finished history items simply omit them.
  //    `currentStream` holds a StreamSession while a broadcast is live; these
  //    fields carry the live loop's running state. No STATE_VERSION bump.
  /** True while this session is an in-progress live broadcast (drives the drain loop). */
  live?: boolean;
  /** Real-clock ms when the broadcast went live (flavour/debug; loop uses elapsedSeconds). */
  startedAtMs?: number;
  /** Seconds actually streamed so far — accrued by the drain loop, survives reload. */
  elapsedSeconds?: number;
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
  // ANTI-EXPLOIT: same weekly cap for published videos (energy is cheaply
  // refillable in-week via food, so without a per-week cap immediate video
  // earnings are unbounded).
  videosThisWeek?: number;
  lastVideoWeek?: number; // weeksLived when last video was published
  /**
   * v22 Wave A (shared YouVideo + Streamly):
   *   - perkTier: creator perk tier derived from `level` (unfreezes the badge).
   *   - lastMemberWeek: idempotency stamp for the weekly memberships payout.
   *   - hypeStreak: Streamly hype-train consecutive-stream streak counter.
   * All optional, read via `??`.
   */
  perkTier?: number;
  lastMemberWeek?: number;
  hypeStreak?: number;
}

// Legacy social subsystem. The module lib/social/relations was removed as dead
// code: `state.social` was initialized to `{ relations: [] }` and never read or
// ticked in production. This minimal inline type is retained only so the
// `social` field below still type-checks (and old saves round-trip).
// TODO(flawless-audit): remove state.social entirely.
export interface SocialState {
  relations: unknown[];
}

// Re-export WeeklyEvent from events/engine
export type { WeeklyEvent } from '@/lib/events/engine';

/**
 * Vehicle system interfaces
 */
export type AccidentSeverity = 'minor' | 'moderate' | 'severe' | 'total';

export interface VehicleInsurance {
  id?: string;
  type: 'basic' | 'comprehensive' | 'premium';
  active: boolean;
  coveragePercent: number;
  expiresWeek: number;
  monthlyCost: number;
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
 * Legacy Pass (seasonal battle pass) progress — added in STATE_VERSION 20.
 * A dual-track (free + premium) reward pass keyed to the prestige/Legacy theme.
 * XP is earned from existing engagement signals (challenges, milestones, prestige).
 * Rewards are cosmetics / youth pills / gems / heritable traits — never raw power
 * (respects the 2.0× income soft-cap; no pay-to-win).
 */
export interface LegacyPassState {
  /** Season this progress belongs to. Progress resets when the season changes. */
  seasonId: string;
  /** Total XP earned in the current season. */
  xp: number;
  /** Whether the player has unlocked the premium reward track (IAP). */
  premiumOwned: boolean;
  /** Free-track tier indices already claimed. */
  claimedFreeTiers: number[];
  /** Premium-track tier indices already claimed. */
  claimedPremiumTiers: number[];
  /** Cosmetic ids earned from the pass (purely visual; no gameplay effect). */
  ownedCosmetics: string[];
}

/**
 * One-shot summary of a Legacy Pass season rollover, stamped when the season
 * changes so the UI can show a "new season" moment + what was auto-collected.
 * Cleared by the UI once shown. Optional (no migration needed).
 */
export interface LegacyPassSeasonSummary {
  endedSeasonId: string;
  newSeasonId: string;
  /** How many earned-but-unclaimed rewards were auto-collected at rollover. */
  collectedCount: number;
  /** Total gems auto-collected at rollover. */
  collectedGems: number;
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
  /**
   * Owned Luxury & Collectibles — a list of `LUXURY_CATALOG` ids (see
   * `lib/luxury`). Optional/additive: absent on pre-luxury saves and treated as
   * "none owned" by every consumer (no migration / no save-version bump). Each
   * owned id contributes weekly upkeep (deducted from stats.money), a small
   * happiness + prestige benefit, and a resale fraction toward net worth.
   */
  luxuryItems?: string[];
  /**
   * Per-item state for owned luxury (STATE_VERSION 24), keyed by the SAME
   * catalog id that appears in `luxuryItems`.
   *
   * `luxuryItems` remains the ownership source of truth — this is an additive
   * SIDECAR, so every existing consumer (weekly upkeep, net worth, achievements,
   * the Luxury Life completion check) keeps working untouched and a save with an
   * empty record behaves exactly as before.
   *
   * It exists because ownership as a flat `string[]` has nowhere to put anything:
   * a house built on the island, an airstrip, a horse's race record. Depth needs
   * somewhere to live, and this is it.
   */
  luxuryHoldings?: Record<string, LuxuryHolding>;
  darkWebItems: DarkWebItem[];
  hacks: Hack[];
  relationships: Relationship[];
  // ANTI-EXPLOIT: Track divorce cooldown to prevent marry/divorce cycling
  lastDivorceWeek?: number;
  pets: Pet[];
  hasPhone: boolean;
  computerPreviouslyOwned: boolean;
  hasDriversLicense?: boolean; // Driver's license for vehicle ownership
  /**
   * Pilot's licence (STATE_VERSION 25) — required to own or fly any aircraft,
   * exactly as `hasDriversLicense` gates ground vehicles. Kept as its own flag
   * rather than folded into the driving licence because flying is a separate,
   * far more expensive qualification, and gating the aircraft ladder behind it
   * is what makes a helicopter feel earned rather than merely afforded.
   */
  hasPilotLicense?: boolean;
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
  settings: GameSettings;
  cryptos: Crypto[];
  /** Extended crypto market state (STATE_VERSION 16) — regimes, order book, DCA, tax. */
  cryptoMarket?: CryptoMarketState;
  /** Dark-web system slice (STATE_VERSION 18) — heat, marketplace, jobs, laundering. */
  darkWeb?: DarkWebState;
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
  /** Seasonal Legacy Pass progress (STATE_VERSION 20). Optional for old saves. */
  legacyPass?: LegacyPassState;
  /** One-shot Legacy Pass season-rollover summary for the UI (optional). */
  legacyPassSeasonSummary?: LegacyPassSeasonSummary;
  /** Equipped cosmetics by slot (ids from legacyPass.ownedCosmetics). Optional. */
  equippedCosmetics?: { frame?: string; theme?: string };
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
    /** Weeks lived when this life ended (feeds the prestige-speed achievements).
     *  Optional: entries recorded before this field existed simply lack it. */
    weeksLivedAtEnd?: number;
    [key: string]: any;
  }[];
  lifeStage: LifeStage;
  wantedLevel: number;
  jailWeeks: number;
  escapedFromJail: boolean;
  criminalXp: number;
  weeklyJailActivities?: Record<string, number>;
  weeklyStreetJobs?: Record<string, number>; // Track how many times each street job was done this week
  // ANTI-EXPLOIT: study sessions completed per education this week. studyExtra
  // shaves a full week off a degree per call; without a per-week cap a player
  // could spam-study to complete a multi-year, tuition-gated degree instantly.
  // Resets on every week advance (like weeklyStreetJobs).
  weeklyStudySessions?: Record<string, number>;
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
  /**
   * @deprecated Since STATE_VERSION 14 — use `banking.accounts` (savings account).
   * Kept on the type for legacy save compatibility and so the old UI keeps reading it
   * until the AdvancedBankApp rewrite ships. Migration mirrors this into banking.accounts.
   */
  bankSavings?: number;
  loans?: Loan[];
  /** Banking system slice — added in STATE_VERSION 14 (AdvancedBankApp remake). */
  banking?: BankingState;
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
    /** Previous week's price snapshot — powers the ▲/▼ week-over-week change on the market board. */
    lastWeekPrices?: Record<string, { price: number; dividendYield: number }>;

    // -----------------------------------------------------------------------
    // StocksApp Remake 6: sectors, order book, dividends. All optional so
    // existing saves load cleanly — no migration needed.
    // -----------------------------------------------------------------------
    /** Per-sector momentum snapshots (rotating strong / neutral / weak). */
    sectorSnapshots?: {
      sector: 'tech' | 'finance' | 'healthcare' | 'consumer' | 'industrial' | 'energy';
      state: 'strong' | 'neutral' | 'weak';
      weeksRemaining: number;
    }[];
    /** Open limit / stop orders waiting for the next weekly tick. */
    openOrders?: {
      id: string;
      symbol: string;
      side: 'buy' | 'sell';
      type: 'market' | 'limit' | 'stop';
      amount: number;
      limitPrice?: number;
      stopPrice?: number;
      placedWeek: number;
      status: 'open' | 'filled' | 'cancelled' | 'expired';
      filledPrice?: number;
      filledWeek?: number;
    }[];
    /** Recent fills + cancellations (capped at 50). */
    orderHistory?: {
      id: string;
      symbol: string;
      side: 'buy' | 'sell';
      type: 'market' | 'limit' | 'stop';
      amount: number;
      limitPrice?: number;
      stopPrice?: number;
      placedWeek: number;
      status: 'open' | 'filled' | 'cancelled' | 'expired';
      filledPrice?: number;
      filledWeek?: number;
    }[];
    /** Lifetime dividends received. */
    totalDividends?: number;
    /** Dividends paid this game-year (resets at year boundary). */
    dividendsThisYear?: number;
  };
  /**
   * Perk flags, keyed by perk id.
   *
   * Two systems share this bag. The named keys are the IAP entitlements set by
   * `applyProductBenefitsToState` — kept explicit so a typo in a paid-perk
   * check is still a type error. The index signature covers the ~20 ONBOARDING
   * perks, which `gameStateBuilder` writes as `{ [perkId]: true }` for whatever
   * the player picked, and which `applyIncome` reads back by iterating
   * `Object.entries`. Those ids were absent from this type even though they are
   * written to every save, so any code naming one directly was a type error and
   * four test assertions on them silently asserted nothing.
   *
   * No migration: nothing new is stored. The keys were always written; only
   * the type was wrong.
   */
  perks?: {
    workBoost?: boolean;
    mindset?: boolean;
    fastLearner?: boolean;
    goodCredit?: boolean;
    unlockAllPerks?: boolean;
    astute_planner?: boolean;
    [perkId: string]: boolean | undefined;
  };
  dailySummary?: {
    moneyChange: number;
    totalMoneyEarned?: number;
    totalMoneySpent?: number;
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
  /**
   * Epoch ms of the last daily-login gem claim. Anti-clock-manipulation
   * high-water mark: `canClaimDailyGemsFor` refuses a claim when the device
   * clock has been rewound below it. Default `undefined` — an absent key means
   * "never claimed". 2026-07-30 audit ECON-1.
   */
  lastLoginRewardAt?: number;
  /**
   * The home the player currently RENTS, if any.
   *
   * Separate from `realEstate` on purpose. A tenancy is not a holding: putting a
   * synthetic entry in that array would make `calculateNetWorth` add the
   * property's full price to the player's wealth for a place they do not own,
   * and would surface a rental in the portfolio UI as if it were an asset.
   *
   * Default `undefined` — an absent key already means "not renting", so v32
   * bumps the version without backfilling it.
   */
  rental?: {
    /** Id from `RENTAL_TIERS`. An unknown id degrades to homeless, not a crash. */
    tierId: string;
    /** `weeksLived` when the tenancy started, for the UI and for tenure. */
    startedWeek: number;
    /**
     * Consecutive weeks ended in arrears. Four means eviction.
     *
     * Absent means zero, and it resets to zero the week the balance clears — so
     * no backfill is needed and the parent object is itself optional. Lives on
     * the tenancy rather than at the top level because it is meaningless without
     * one: moving out or being evicted should take the counter with it.
     */
    missedWeeks?: number;
  };
  /**
   * `weeksLived` at the last daily-login gem claim. The gate that actually
   * holds.
   *
   * The two clock guards beside this field (`lastLoginRewardDate`,
   * `lastLoginRewardAt`) both only refuse a claim when the device clock moves
   * BACKWARD. Moving it forward one day at a time passes both, and the 48-hour
   * streak grace keeps the streak climbing, so the 25→500 gem cycle could be
   * farmed indefinitely on the premium currency that is otherwise an IAP.
   *
   * No amount of day-key cleverness closes that: React Native has no monotonic
   * wall clock without a native module, so every device-time signal moves with
   * the scrub. The only trustworthy clock here is the GAME's — `weeksLived`
   * advances solely by playing. Requiring it to move between claims costs a real
   * player nothing (open the app, play a week) and bounds a scrubber to exactly
   * one claim per week actually played.
   *
   * Default `undefined` — an absent key means "never claimed", which is already
   * the correct default, so v31 bumps the version without backfilling this.
   */
  lastLoginRewardWeek?: number;
  /**
   * Unpaid mandatory outgoings carried into next week, in dollars.
   *
   * The weekly tick used to compute cash as
   * `Math.max(0, income − tax − rent − upkeep − diet − tuition)`, so any bill a
   * player could not cover was silently FORGIVEN. Together with the hard 0 floor
   * on `stats.money` and the absence of any baseline cost of living, that left
   * the money axis with no failure state at all: you could not go into debt, be
   * evicted, or go under. `BANKRUPTCY_FLOOR` names a bankruptcy the game cannot
   * reach.
   *
   * Letting `stats.money` go negative was the alternative and is not viable —
   * roughly forty call sites depend on the non-negative invariant, including
   * `updateMoney`'s overdraft reject. So the shortfall is booked HERE instead: it
   * is settled off the top of next week's income before anything else, and it
   * drags the credit score while it stands.
   *
   * Concrete stored default (`0`), so unlike the v26/v27/v28/v31-login
   * carve-outs this one takes a REAL migration backfill and a `repairGameState`
   * mirror.
   */
  overdueBalance?: number;
  /**
   * One-time Discord community reward: set true in the SAME state update that
   * adds the cash, so the money + this flag are always persisted together. It is
   * the in-state half of the exactly-once claim protocol (the durable other half
   * is the `discord_reward_claimed` AsyncStorage marker) — the launch reconciler
   * reads it to tell "grant not yet saved" from "saved, just needs finalizing".
   * Additive/optional: absent on every existing save; no migration needed. See
   * utils/discordRewardClaim.ts.
   */
  discordRewardGranted?: boolean;
  /**
   * Salted-SHA-256 hashes of promo redeem codes already granted on this save. Set
   * in the SAME state update that grants the reward, so the reward and this flag
   * are always persisted together — the in-state half of the exactly-once,
   * per-device redeem protocol (the durable other half is the `redeemed_codes_v1`
   * AsyncStorage ledger). The launch reconciler reads it to tell "grant not yet
   * saved" from "saved, just needs finalizing". Additive/optional: absent on every
   * existing save; no migration needed. See utils/redeemCodes.ts.
   */
  redeemedCodeHashes?: string[];
  gamingStreaming?: GamingStreamingState;
  goldUpgrades?: Record<string, boolean>;
  pendingEvents: WeeklyEvent[];
  eventLog: {
    id: string;
    description: string;
    choice: string;
    /** Stable choice identifier used by multi-week event chains to branch
     * narrative + payouts. Optional so pre-fix saves load unchanged. */
    choiceId?: string;
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
  /** Statistics milestones whose one-time gem reward has been claimed (additive set). */
  claimedMilestoneRewards?: string[];
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
  // Lifetime counters consumed by achievementsData (gs.datingMatches.length /
  // gs.totalPrisonWeeks). Both were referenced by achievements without ever
  // being declared on GameState — the matching achievements were stuck at 0.
  datingMatches?: string[];
  totalPrisonWeeks?: number;
  happinessZeroWeeks: number;
  healthZeroWeeks: number;
  healthWeeks: number;
  showZeroStatPopup: boolean;
  zeroStatType?: 'happiness' | 'health';
  showDeathPopup: boolean;
  deathReason?: 'happiness' | 'health' | 'age';
  showWeddingPopup: boolean;
  weddingPartnerName?: string;
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
    diseases: {
      id: string;
      name: string;
      contractedWeek: number;
      curedWeek?: number;
      severity: string;
    }[];
    totalDiseases: number;
    totalCured: number;
    deathsFromDisease: number;
  };
  diseaseImmunities?: string[]; // Diseases player has immunity to (from previous infections)
  vaccinations?: string[]; // Vaccinations player has received
  goals: Goal[];
  completedGoals: string[];
  // DEAD-CODE CLEANUP: the "Enhanced Social System" block (socialEvents,
  // socialGroups, socialInteractions, lastEventTimes) and the old
  // dailyChallenges shape were write-only orphans — declared + initialized but
  // never read or updated by any gameplay code. Removed; old saves carrying
  // the keys are unaffected (unknown keys are ignored on load).
  rngCommitLog?: RngCommitLog;
  prestige?: PrestigeData;
  prestigeAvailable?: boolean; // True when net worth >= $100M
  seasonalEvents?: {
    lastSeason: string;
    completedEvents: string[];
  };
  automation?: AutomationState;
  socialMedia?: {
    // ── Legacy v10-v12 fields (preserved verbatim for save compat) ──
    followers: number;
    influenceLevel: PulseInfluenceLevel;
    totalPosts: number;
    viralPosts: number;
    brandPartnerships: number;
    engagementRate: number;
    lastPostWeek?: number;       // weeksLived
    lastPostTime?: number;
    lastPostDay?: number;
    lastPostTimes?: Record<PulseContentType, number>;
    lastPostWeeks?: Record<PulseContentType, number>;
    totalLiveStreams?: number;
    totalLiveViewers?: number;
    totalLiveDuration?: number;
    peakLiveViewers?: number;
    totalEarnings?: number;
    activeBrandDeals?: PulseActiveBrandDeal[];
    recentPosts?: PulseRecentPost[];

    // ── v13 Pulse additions (all optional; migration fills defaults) ──
    commentThreads?: Record<string, PulseComment[]>;       // keyed by postId; bounded to last 50 posts
    trendingHashtags?: PulseTrendingHashtag[];
    followGraph?: PulseFollowGraph;
    activeScandal?: PulseActiveScandal | null;
    scandalHistory?: PulseScandalRecord[];
    brandInbox?: PulseBrandInbox;
    verifiedPro?: PulseVerifiedPro;
    // ANTI-EXPLOIT: sticky flag — the +500 Verified Pro signup-bonus followers
    // are granted only the FIRST time ever. Lives OUTSIDE verifiedPro (which is
    // replaced wholesale on resubscribe) and is never cleared on cancel, so a
    // cancel→resubscribe loop can't re-mint the bonus.
    verifiedProWelcomeClaimed?: boolean;
    notifications?: PulseNotification[];                   // ring buffer, cap 100
    liveSession?: PulseLiveSession | null;
    pendingBoosts?: PulsePendingBoost[];
    lifetimeStats?: PulseLifetimeStats;
    lastViralBoostBySkill?: Record<string, number>;        // weeksLived, capped 1 boost/skill/week
    lastAdBoostWeek?: number;                              // weeksLived; enforces 1/week cap for rewarded-ad boost
    // ── v22 Wave A additions (all optional; migration fills defaults) ──
    /** Capped follower history for the Creator Studio / Insights chart (last 52 points). */
    followerHistory?: { week: number; followers: number }[];
    /** Bounded scandal-risk accumulator gating the scandal spawn tick. */
    scandalRiskScore?: number;
  };
  /**
   * Spark dating app state (v15+). Owns swipes, matches, chat threads, premium,
   * catfishing, jealousy. Promoted matches still flow into `relationships[]`
   * and `family.spouse`; Spark is the surface, not a replacement for them.
   */
  sparkApp?: SparkAppState;
  /**
   * Hustle business app overlay (v17+). Layers premium business systems
   * (campaigns, scandals, board governance, IPO, M&A, hiring pipeline) on
   * top of the existing `companies[]` array. Per-company keyed by Company.id.
   */
  hustleApp?: HustleAppState;
  _appVersion?: string; // TESTFLIGHT FIX: App version when save was created (for compatibility tracking)
  travel?: TravelState;
  /**
   * v22 Wave A: capped real-estate portfolio activity timeline (~40 entries).
   * Optional additive slice; consumers read via `?? []`.
   */
  realEstateActivity?: RealEstateActivityEntry[];
  politics?: PoliticsState;
  /** Cross-system IOU/favor ledger surfaced by ContactsApp (Remake 10). */
  favorLedger?: { favors: import('@/lib/contacts/favors').Favor[] };
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
  // Depth Enhancement System - tracks discovered systems
  // (depthMetrics / progressiveDisclosureLevel / systemStatistics removed:
  // write-only orphans with no reader anywhere in gameplay code.)
  discoveredSystems?: DiscoveredSystem[];
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
  /**
   * C-11: ids from `LEGACY_UPGRADES` bought with legacy points. Concrete
   * stored default `[]`, so v29 backfills it and `repairGameState` mirrors it.
   * Carried into the heir — what you bought is what your heir starts with.
   */
  legacyUpgrades?: string[];
  /**
   * Legacy Contracts (v33) — multi-life goals that pay Legacy Points.
   *
   * Only the CLAIMED ids are stored. Progress itself is derived from metrics
   * the save already tracks and that only ever increase (prestige count,
   * generations, lifetime weeks), so nothing can drift out of sync and a
   * contract cannot be double-credited by a tick that runs twice.
   */
  legacyContracts?: { claimedIds: string[] };
  /** Active legacy buffs purchased with legacy points */
  legacyBuffs?: {
    luckyCharm?: { expiresWeeksLived: number }; // +10% luck for 5 weeks
    mentor?: { expiresWeeksLived: number }; // +50% career progress for 3 weeks
  };
  /** Daily challenge completion streak */
  /** Life chapters — themed goal groups that unlock based on weeksLived */
  completedChapters?: string[];
  /**
   * Life Ambition (v22.x, additive/optional) — a lifelong aspiration chosen at
   * character creation. `ambitionId` references lib/ambitions catalogue;
   * `ambitionCompletedMilestones` is the sticky set of reached milestone ids
   * (staged progress); `ambitionRewardClaimed` gates the one-time payoff.
   * All optional so old saves and freeform (no-ambition) lives load unchanged.
   */
  ambitionId?: string;
  ambitionCompletedMilestones?: string[];
  ambitionRewardClaimed?: boolean;
  /**
   * Retirement & Elder endgame (v22.x, additive/optional). All fields absent on
   * old saves and on any life that has not retired — every reader treats a
   * missing `isRetired` as "still working". No migration / no save-version bump;
   * already-elderly loaded lives are NOT auto-retired.
   *
   * `isRetired` is a one-way latch for the current life (anti-farm: you cannot
   * un-retire or re-retire to re-roll the pension). `pensionWeekly` is computed
   * ONCE at retirement from real work history (lib/retirement) and frozen for
   * life; it is credited weekly through the canonical income → stats.money path.
   * `elderActivity` holds per-activity cooldown bookkeeping (id → weeksLived last
   * used) for the age-gated elder activities in lib/retirement/elderActivities.
   */
  isRetired?: boolean;
  retiredAtAge?: number;
  /** weeksLived at the moment of retirement (drives "years retired" + event gating). */
  retiredAtWeek?: number;
  /** Frozen weekly pension (dollars), computed from career history at retirement. */
  pensionWeekly?: number;
  elderActivity?: {
    /** activityId → weeksLived when it was last performed (drives cooldowns). */
    lastUsedWeek: Record<string, number>;
    /** Lifetime count of elder activities performed (flavour/stats). */
    totalActivities: number;
  };
  /**
   * Hobby mastery (v21) — pursuits you practice weekly to level up, each with a
   * compounding perk. `pursuits[id]` accrues xp; `weeklyPursuitPractice` caps
   * practices per week and is reset on week advance (like weeklyStudySessions).
   */
  pursuits?: Record<string, PlayerPursuit>;
  weeklyPursuitPractice?: Record<string, number>;
  /** Tutorial step completion tracking for rewards */

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
    earned: {
      ribbonId: string;
      generation: number;
      earnedTimestamp: number;
      lifeAge: number;
      lifeName: string;
    }[];
    discoveredIds: string[];
  };
  /** Weekly themed challenge state */
  weeklyChallenge?: {
    challengeId: string;
    startedAt: number;
    /** weeksLived when this challenge instance started. ANTI-EXPLOIT: rotation
     *  and selection are anchored to this (game time), not Date.now(), so the
     *  reward can't be re-minted by advancing the device clock. */
    startedWeek?: number;
    progress: { objectiveId: string; current: number; target: number; met: boolean }[];
    completed: boolean;
    rewardClaimed: boolean;
  };
  /** Time machine checkpoints — max 5 snapshots. R3-A: snapshot is now
   * `Partial<GameState> | string` (the lib stores objects on new saves and
   * keeps string parsing for legacy migration). The previous inline type
   * declared `snapshot: string`, which was wrong but masked by the lazy
   * `require()` call sites — hoisting those requires to ES imports surfaced
   * the mismatch. Align with `Checkpoint` from `lib/timeMachine/checkpointSystem`. */
  checkpoints?: {
    id: string;
    label: string;
    weeksLived: number;
    age: number;
    timestamp: number;
    snapshot: Partial<GameState> | string;
  }[];
  /** Number of time machine rewinds used this life (escalates cost) */
  timeMachineUsesThisLife?: number;
}

export interface DMMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  isPlayer: boolean;
  hasClue: boolean;
  clueRevealed: boolean;
  clueType?: 'location' | 'money' | 'career' | 'relationship' | 'item' | 'secret' | 'quest';
  clueData?: {
    hint: string;
    reward?: string;
    action?: string;
    destination?: string;
    requirement?: string;
    completed?: boolean;
  };
  reactions?: string[];
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
  /**
   * Persisted message thread for this conversation. Optional & additive so
   * pre-existing saves (which never stored it) migrate cleanly — DMSystem
   * seeds the generated intro template the first time the thread is opened.
   */
  messages?: DMMessage[];
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
    /**
     * v23: ids of per-destination travel activities already done on THIS trip.
     * Acts as the once-per-trip cooldown gate for `lib/travel/activities`.
     * Optional/additive — old in-progress trips lack it and read as `[]`; it is
     * cleared automatically when the trip ends (currentTrip → undefined).
     */
    activitiesDone?: string[];
  };
  visitedDestinations: string[];
  passportOwned: boolean;
  businessOpportunities: Record<string, BusinessOpportunity>;
  travelHistory: {
    destinationId: string;
    week: number;
    year: number;
  }[];
  /**
   * v22 Wave A: bounded passport milestone tiers unlocked (e.g. countries-visited
   * thresholds). Optional; each id recorded once. Read via `??`.
   */
  passportMilestones?: string[];
}

/**
 * v22 Wave A: one real-estate portfolio activity entry (tenancy events, rent
 * cycles, value changes) feeding the RealEstate Activity tab. Kept as a capped
 * top-level slice (`GameState.realEstateActivity`, ~40 entries).
 */
export interface RealEstateActivityEntry {
  id: string;
  week: number;
  kind: string;
  label: string;
  amount?: number;
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

/**
 * Active political scandal — surfaces from high dark-web heat, dirty PAC money,
 * controversial policies, or negative karma. Drains approval over its lifetime;
 * suppression spending shortens it. (PoliticalApp Remake 5)
 */
export interface PoliticalScandalEntry {
  id: string;
  category: 'corruption' | 'extramarital' | 'tax-evasion' | 'criminal-ties' | 'policy-flip' | 'donor-fraud';
  severity: 'minor' | 'moderate' | 'major' | 'career-ending';
  headline: string;
  startedWeek: number;
  weeksRemaining: number;
  approvalLost: number;
  suppressedUSD: number;
  active: boolean;
  resolution?: 'survived' | 'forced-resignation' | 'image-restored';
}

/**
 * PAC — Political Action Committee fundraising pool. Clean and dirty buckets.
 * Spending from PAC is more efficient than direct campaigning. Dirty intake
 * permanently increases scandal risk via lifetimeDirtyUSD. (PoliticalApp Remake 5)
 */
export interface PACPoolState {
  cleanUSD: number;
  dirtyUSD: number;
  lifetimeDirtyUSD: number;
  lastRaiseWeek?: number;
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
  // Same-batch dedup marker: set on EVERY election attempt (win OR loss) so a
  // duplicate same-week tap no-ops regardless of the independent win/loss roll.
  // Kept separate from lastElectionWeek, which feeds the election-cooldown math
  // and must only advance on a win.
  lastElectionAttemptWeek?: number;
  nextElectionWeek?: number;
  activePolicyEffects?: {
    /**
     * R4-X7: the policy `economy.inflationRate` was declared, priced into three
     * policies, and rendered on the policy card as "Inflation +2.0%" — and the
     * aggregator had no `economy` slice at all, so nothing could read it even
     * in principle. Optional so existing saves load unchanged; absent means the
     * base annual rate.
     */
    economy?: { inflationRate: number; };
    stocks?: { volatilityModifier: number; dividendBonus: number; companyBoost?: string[]; };
    realEstate?: { priceModifier: number; rentModifier: number; propertyTaxRate?: number; };
    education?: { weeksReduction: number; costReduction: number; scholarshipAmount?: number; };
    crypto?: { miningBonus: number; priceStability: number; regulationLevel?: number; };
    technology?: { rdBonus: number; patentBonus: number; innovationGrants?: number; };
    healthcare?: { healthBonus: number; medicalCostReduction: number; };
    transportation?: { travelCostReduction: number; commuteTimeReduction?: number; };
  };
  // ---------------------------------------------------------------------
  // PoliticalApp Remake 5: scandals + PAC. All optional so existing saves
  // load cleanly — no migration needed.
  // ---------------------------------------------------------------------
  /** Active and recent scandals. Capped to the most recent ~30. */
  scandals?: PoliticalScandalEntry[];
  /** PAC fundraising pool. */
  pac?: PACPoolState;
  /** Last week we checked for scandal exposure (so we don't double-roll). */
  lastScandalCheckWeek?: number;
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

export interface RngCommitLog {
  seed: number;
  sequence: number;
  entries: Record<string, number>;
  order: string[];
  lastCommittedWeek?: number;
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
  /**
   * Pulse v13+ — cumulative peak followers across all prestige resets.
   * On prestige, current life's `socialMedia.lifetimeStats.peakFollowers`
   * is added here. New lives start with `floor(carry × 0.001)` follower head start.
   */
  pulseLifetimeFollowersCarry?: number;
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
