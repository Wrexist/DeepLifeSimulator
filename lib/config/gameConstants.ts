/**
 * Game Balance Constants
 *
 * Centralized source of truth for all game balance values.
 * Any magic number that affects gameplay should live here.
 */

// ── Time ──────────────────────────────────────────────────
export const WEEKS_PER_YEAR = 52;
export const WEEKS_PER_MONTH = 4;

// Real-world (wall-clock) millisecond durations. Use these instead of inline
// `24 * 60 * 60 * 1000` style literals so the magic numbers live in one place.
export const MS_PER_HOUR = 60 * 60 * 1000; // 3_600_000
export const MS_PER_DAY = 24 * MS_PER_HOUR; // 86_400_000
export const MS_PER_WEEK = 7 * MS_PER_DAY; // 604_800_000

// ── Pregnancy ────────────────────────────────────────────
export const PREGNANCY_DURATION_WEEKS = 10; // ~2.5 months game time

// ── Economy ──────────────────────────────────────────────
export const BANKRUPTCY_FLOOR = 500; // Minimum cash before bankruptcy triggers

// ── Real Estate Rent ────────────────────────────────────
/** Canonical rent rate: 2% of property value per month, applied weekly (0.02 / 4 = 0.005).
 *  Used for BOTH player-pays-rent and landlord-earns-rent calculations. */
export const RENT_INCOME_RATE = 0.005;

// ── Death & Health ────────────────────────────────────────
export const ZERO_STAT_DEATH_WEEKS = 4;
export const ZERO_STAT_WARNING_WEEKS = [1, 3] as const;
export const BASE_LIFE_EXPECTANCY = 80;

// ── Economy ───────────────────────────────────────────────
export const ITEM_SELL_RATE = 0.5;
export const STUDENT_LOAN_APR = 0.045;
export const STUDENT_LOAN_TERM_WEEKS = 260; // 5 years

// ── Wedding & Divorce ─────────────────────────────────────
export const WEDDING_DEPOSIT_RATE = 0.25;
export const WEDDING_REMAINDER_RATE = 0.75;
export const DIVORCE_SETTLEMENT_BASE = 0.15;
export const DIVORCE_SETTLEMENT_RANGE = 0.20;
export const DIVORCE_LAWYER_BASE_FEE = 5000;

// ── Politics ──────────────────────────────────────────────
export const CAMPAIGN_MINIMUM_AMOUNT = 500;

// ── R&D ──────────────────────────────────────────────────
export const PATENT_COSTS: Record<number, number> = { 1: 10000, 2: 50000, 3: 100000 };

// ── Vehicles ──────────────────────────────────────────────
export const VEHICLE_WEEKLY_MILEAGE = 200;
export const VEHICLE_WEEKLY_CONDITION_DECAY = 1;
export const VEHICLE_ACCIDENT_BASE_CHANCE = 0.01;
export const VEHICLE_ACCIDENT_POOR_CONDITION_CHANCE = 0.03;

// ── Pets ──────────────────────────────────────────────────
export const PET_LIFESPANS: Record<string, number> = {
  dog: 15,
  cat: 18,
  bird: 12,
  fish: 5,
  hamster: 3,
  rabbit: 10,
  turtle: 30,
};

// ── Early Game Engagement ────────────────────────────────
// Players reported "Heads Up" event popups firing almost every Next Week and
// freezing the flow, so early-game frequency is dialled way down. Events are
// now an occasional surprise, not a near-constant interruption.
export const EARLY_GAME_EVENT_CHANCE = 0.08; // ~8% base event chance weeks 1-8 (was 45%)
export const EARLY_GAME_THRESHOLD_WEEKS = 8;
export const EARLY_GAME_PITY_THRESHOLD = 16; // Force event only after 16 dry weeks (was 3)

// ── Event Pacing (smoothness) ────────────────────────────
// Minimum quiet weeks between discretionary weekly-event popups ("Heads Up"
// cards). Independent event sources (random, chain starts, seasonal) each roll
// every tick; without a shared floor they stack and a popup can appear almost
// every "Next Week". The pity system can still force an event after a long
// drought, so progression never goes fully silent.
export const EVENT_MIN_GAP_EARLY = 3; // weeks 1-8: at least 3 quiet weeks between popups
export const EVENT_MIN_GAP_MID = 6; // weeks 9-49: at most ~1 popup / 6 weeks
export const EVENT_MIN_GAP_LATE = 8; // week 50+: calm — at most ~1 popup / 8 weeks

// ── Economic Events (global macro banner) ────────────────
// Economic events drive the recession/boom/crash banner AND an "Economic Event"
// popup. Previously the post-event "normal" stretch was a timed state that
// GUARANTEED a fresh event when it expired, so the economy cycled perpetually
// and the banner was visible 30-45% of the time. These make events genuinely
// rare with a guaranteed calm stretch afterwards.
export const ECONOMY_EVENT_WEEKLY_CHANCE = 0.01; // 1% per eligible week (was 2-3% + perpetual cycle)
export const ECONOMY_EVENT_MIN_CALM_WEEKS = 20; // enforced quiet weeks after an event ends

// ── Beginner Luck ───────────────────────────────────────
export const BEGINNER_LUCK_WEEKS = 20;
export const BEGINNER_LUCK_BASE_BONUS = 15; // Guaranteed weekly cash bonus
export const BEGINNER_LUCK_RANDOM_MAX = 25; // Additional random bonus 0-25

// ── Variable Rewards ────────────────────────────────────
export const SCRATCH_TICKET_REWARDS = [10, 25, 50, 100, 250, 500, 1000];
export const SCRATCH_TICKET_WEIGHTS = [30, 25, 20, 12, 8, 4, 1]; // Heavily weighted toward small

// ── Milestone Proximity ─────────────────────────────────
export const MILESTONE_MONEY_THRESHOLDS = [100, 500, 1000, 5000, 10000, 50000, 100000, 1000000];
export const MILESTONE_WEEKS_THRESHOLDS = [4, 10, 26, 52, 104];
export const MILESTONE_RELATIONSHIP_THRESHOLDS = [1, 3, 5, 10];
export const MILESTONE_FITNESS_THRESHOLDS = [25, 50, 75, 100];
export const MILESTONE_PROXIMITY_PERCENT = 0.15; // Show "almost there" at 85%+

// ── Daily Login Rewards ─────────────────────────────────
export const DAILY_LOGIN_REWARDS = [25, 50, 75, 100, 150, 200, 500]; // 7-day gem cycle
export const LOGIN_STREAK_GRACE_HOURS = 48; // Forgiving: miss 1 day, keep streak

// ── Prestige & Gems ───────────────────────────────────────
export const REVIVE_GEM_COST = 15_000;
export const DISCORD_JOIN_REWARD_GEMS = 500;
// One-time cash reward for joining the Discord community. Granted from either the
// in-game CommunityRewardPopup or the Settings "Join Our Discord" button — both
// share the `discord_reward_claimed` flag so it can be claimed exactly once.
export const DISCORD_JOIN_REWARD_MONEY = 5000;

// ── Legacy ────────────────────────────────────────────────
export const ADULTHOOD_AGE = 18;

// ── Save System ───────────────────────────────────────────
export const MAX_SAVE_SIZE = 4 * 1024 * 1024; // 4 MB
