/**
 * Game Balance Constants
 *
 * Centralized source of truth for all game balance values.
 * Any magic number that affects gameplay should live here.
 */

// ── Time ──────────────────────────────────────────────────
export const WEEKS_PER_YEAR = 52;
export const WEEKS_PER_MONTH = 4;

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

// ── Prestige & Gems ───────────────────────────────────────
export const REVIVE_GEM_COST = 15_000;
export const DISCORD_JOIN_REWARD_GEMS = 500;

// ── Legacy ────────────────────────────────────────────────
export const ADULTHOOD_AGE = 18;

// ── Save System ───────────────────────────────────────────
export const MAX_SAVE_SIZE = 4 * 1024 * 1024; // 4 MB
