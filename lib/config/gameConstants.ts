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

// ── Life stage ───────────────────────────────────────────
/**
 * The player's life stage, derived from age.
 *
 * This lived as THREE identical private copies — `initialState.ts`,
 * `GameDataContext.tsx` and the thresholds inlined in UI copy — and the stored
 * `GameState.lifeStage` that `initialState` seeds from it is written once and
 * never updated again (no birthday handler exists), so it reads 'teen' for the
 * whole life. Derive from age at the point of use; do not trust the stored one.
 */
export type PlayerLifeStage = 'child' | 'teen' | 'adult' | 'senior';

export const LIFE_STAGE_TEEN_AGE = 13;
export const LIFE_STAGE_ADULT_AGE = 20;
export const LIFE_STAGE_SENIOR_AGE = 65;

export function getLifeStage(age: number): PlayerLifeStage {
  if (age < LIFE_STAGE_TEEN_AGE) return 'child';
  if (age < LIFE_STAGE_ADULT_AGE) return 'teen';
  if (age < LIFE_STAGE_SENIOR_AGE) return 'adult';
  return 'senior';
}

// ── Pregnancy ────────────────────────────────────────────
export const PREGNANCY_DURATION_WEEKS = 10; // ~2.5 months game time

// ── Economy ──────────────────────────────────────────────
export const BANKRUPTCY_FLOOR = 500; // Minimum cash before bankruptcy triggers

/**
 * The line under which a week counts as spent in poverty.
 *
 * Read by BOTH `applyPovertyTracking` (which counts the consecutive weeks) and
 * `scholarshipOpportunity` (which spends them). Deliberately one constant: the
 * counter and the gate it feeds disagreeing would be invisible — the event
 * would simply never fire, which is exactly the state this whole path was in
 * before the counter existed at all.
 *
 * Numerically equal to `BANKRUPTCY_FLOOR` today and kept SEPARATE on purpose.
 * That one is a soft-lock guard (autopay must not leave you under it); this one
 * describes a player's situation. Tuning either must not silently move the
 * other.
 */
export const POVERTY_MONEY_THRESHOLD = 500;

/**
 * What the poverty-recovery scholarship covers, as a tuition credit in USD.
 *
 * $18,000 is the price of Legal Studies, the most expensive CERTIFICATE in the
 * catalogue — so the award covers any certificate outright (Police Academy is
 * $12k) and takes a real bite out of an undergraduate degree ($30k-$72k)
 * without paying for one outright.
 *
 * That ceiling is the point. The event fires for a player under
 * `POVERTY_MONEY_THRESHOLD` with no education, and its job is to open the first
 * door out, not to hand a broke character a $150k medical degree from one
 * random roll. A credit rather than cash for the same reason — see
 * `GameState.tuitionWaiverUSD`.
 */
export const SCHOLARSHIP_AWARD_USD = 18_000;

// ── Real Estate Rent ────────────────────────────────────
/**
 * Canonical weekly rent, as a fraction of property value. Used for BOTH
 * player-pays-rent and landlord-earns-rent — one number, both directions.
 *
 * Was 0.005 (described as "2% per month"), which annualises to a **26% gross
 * yield**: a $95 000 studio paid $475/week and repaid its own purchase price in
 * 3.8 years. That made landlording strictly dominant over every career in the
 * game — better than a bottom-rung wage from the first property, with no energy
 * cost and no risk — and it was the real money printer behind "the game gives
 * too much money", not the salary ladder alone.
 *
 * 0.0015 is ~7.8%/yr gross, which is a believable rental return and takes ~13
 * years to repay the purchase. Property stays a genuinely good investment; it
 * stops being the only one worth making.
 *
 * NOTE this cuts both ways: renting a home is now correspondingly cheaper for
 * the player. That is the honest consequence of one shared rate, and it is the
 * right trade — the landlord side was the exploit.
 *
 * `__tests__/economy/incomeScale.test.ts` bounds the resulting yield.
 */
export const RENT_INCOME_RATE = 0.0015;

// ── Death & Health ────────────────────────────────────────
/**
 * Consecutive weeks at zero health or happiness before the character dies.
 *
 * Read by the week loop. It was NOT, until 2026-08-14: both death checks used a
 * bare `4` while this constant sat here with no code consumer at all, and
 * `lib/realEstate/rentals.ts` cited it by name as though it were authoritative.
 * Tuning the most consequential number in the game here would have done
 * nothing — the silent-no-op trap `RAISE_MIN_PERFORMANCE` in JobActions already
 * warns about ("two copies of this number would let one path call a bluff the
 * other path rewarded").
 */
export const ZERO_STAT_DEATH_WEEKS = 4;
// `ZERO_STAT_WARNING_WEEKS = [1, 3]` was deleted here. It scheduled a zero-stat
// popup on the 1st and 3rd bad week; that popup was removed from the week
// advance (the warning is now passive, in IdentityCard's "Health Issues" row),
// so the schedule had no consumer anywhere, tests included. Retired rather than
// left to read as live tuning.
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
// Early game (weeksLived < EARLY_GAME_THRESHOLD_WEEKS) intentionally has NO pity
// floor. This threshold (16) deliberately exceeds the 8-week early window, so the
// early branch of the pity check in lib/events/engine.ts (~L3343) can never fire:
// `weeksSinceLastEvent` there is at most `weeksLived` (< 8), so it never reaches
// 16. Early game leans on EARLY_GAME_EVENT_CHANCE (8%) alone — matching the
// "occasional surprise, not a near-constant interruption" intent above (the pity
// was raised 3 → 16 precisely to stop early droughts from forcing popups). The
// first pity that CAN fire is the mid-game floor (12, from week 12+).
// NOTE: giving early game a real, reachable pity would require a CONSUMER edit in
// the (this-wave-forbidden) engine.ts — lower this below EARLY_GAME_THRESHOLD_WEEKS
// or widen the gate — so the semantics are documented here rather than flipped,
// which would reverse the deliberate low-early-event balance decision.
export const EARLY_GAME_PITY_THRESHOLD = 16;

// ── Event Pacing (smoothness) ────────────────────────────
// Minimum quiet weeks between discretionary weekly-event popups ("Heads Up"
// cards). Independent event sources (random, chain starts, seasonal) each roll
// every tick; without a shared floor they stack and a popup can appear almost
// every "Next Week". The pity system can still force an event after a long
// drought, so progression never goes fully silent.
export const EVENT_MIN_GAP_EARLY = 4; // weeks 1-8: at least 4 quiet weeks between popups
export const EVENT_MIN_GAP_MID = 8; // weeks 9-49: at most ~1 popup / 8 weeks
export const EVENT_MIN_GAP_LATE = 8; // week 50+: calm — with the ~12% gate, ~1 popup / 15 weeks

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
/**
 * Gems to revive in place after death.
 *
 * Was 15,000, which was wrong against the game's own price list rather than
 * merely expensive. The 15,000-gem pack retails at $49.99, and the Revival Pack
 * IAP — which does the IDENTICAL thing, by its own feature list ("Instant
 * revival on death · Restore health/happiness/energy to 100 · Continue your
 * progress") — is $2.99. So the gem path charged roughly sixteen times the
 * real-money path for the same outcome, and the only players who took it were
 * the ones who had not seen the store.
 *
 * 5,000 keeps revive a serious sink (250 days of daily-login gems) and well
 * clear of a rewind, while leaving the $2.99 pack the honest best deal — which
 * the death screen now says out loud instead of hiding.
 */
export const REVIVE_GEM_COST = 5_000;
export const DISCORD_JOIN_REWARD_GEMS = 500;
// One-time cash reward FLOOR for joining the Discord community. Granted from
// either the in-game CommunityRewardPopup or the Settings "Join Our Discord"
// button — both share the `discord_reward_claimed` flag so it can be claimed
// exactly once. The actual reward scales with wealth via discordJoinRewardMoney
// below; this constant is the minimum so early players still get $5k.
export const DISCORD_JOIN_REWARD_MONEY = 5000;

/**
 * Net-worth-scaled Discord join reward so a flat $5k isn't meaningless to a
 * wealthy player. = clamp( netWorth * 1%, $5k floor, $250k ceiling ), rounded.
 * EVERY display site and the grant site must call this with the same net worth
 * so the shown amount always equals the granted amount. The one-time claim guard
 * (`discord_reward_claimed`) is unchanged.
 */
export function discordJoinRewardMoney(netWorth: number): number {
  const worth = Number.isFinite(netWorth) ? netWorth : 0;
  const base = worth * 0.01;
  return Math.round(Math.min(Math.max(base, DISCORD_JOIN_REWARD_MONEY), 250_000));
}

// ── Crime & Jail ──────────────────────────────────────────
/**
 * Bail scales with BOTH time served and wealth so it keeps punishing the rich
 * instead of being a rounding error. = clamp( max(jailWeeks * $500, netWorth *
 * 0.5%), $500 floor, $250k ceiling ), rounded. Shared by JailScreen (display)
 * and JobActionsContext.payBail (charge) so the shown price and the amount
 * actually deducted can never drift apart.
 */
export function computeBailCost(jailWeeks: number, netWorth: number): number {
  const weeks = Number.isFinite(jailWeeks) ? Math.max(0, jailWeeks) : 0;
  const worth = Number.isFinite(netWorth) ? netWorth : 0;
  const base = Math.max(weeks * 500, worth * 0.005);
  return Math.round(Math.min(Math.max(base, 500), 250_000));
}

// ── Legacy ────────────────────────────────────────────────
export const ADULTHOOD_AGE = 18;

// ── Save System ───────────────────────────────────────────
export const MAX_SAVE_SIZE = 4 * 1024 * 1024; // 4 MB

/**
 * Absolute `weeksLived` for a character starting at a given age.
 *
 * Lives here, beside `ADULTHOOD_AGE` and `WEEKS_PER_YEAR`, because BOTH places
 * that begin a life need it — onboarding (`gameStateBuilder`) and the prestige
 * heir path (`lib/prestige/prestigeExecution`). It was previously only in
 * `src/features/onboarding`, which `lib/` must not import from, and the heir
 * path consequently left `weeksLived` at 0 while setting `age` to the child's —
 * a state `aiIntegrityChecks` already flags as "weeks lived inconsistent with
 * age".
 */
export function computeWeeksLived(startingAge: number): number {
  const age = Number(startingAge);
  if (!Number.isFinite(age)) return 0;
  return Math.max(0, Math.floor((age - ADULTHOOD_AGE) * WEEKS_PER_YEAR));
}
