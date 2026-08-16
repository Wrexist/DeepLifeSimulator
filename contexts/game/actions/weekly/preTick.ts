/**
 * Pre-tick computations for the weekly game loop. R7 Phase 2 step 2.1.
 *
 * These three helpers were previously inlined inside the giant `nextWeek()`
 * callback in `GameActionsContext.tsx`. Extracting them gives the JIT a
 * smaller hot function to inline, lets the equivalence-test battery
 * (`__tests__/refactor/subsystemEquivalence.test.ts`) lock in current
 * behavior, and is the first concrete step in the `nextWeek()` refactor
 * plan documented in `tasks/round7-master-plan-2026-05-30.md`.
 *
 * Pure functions. No React, no setState, no side effects beyond logger
 * calls that match the original inline behavior. Output of each helper
 * for a given input is byte-identical to the previous inline code —
 * verified by snapshot tests on a 6-fixture battery.
 *
 * Note on `buildPreRolls`: it calls `Math.random()` and `Date.now()`, so
 * its output is NOT deterministic. That's the point — these are the RNG
 * sources pre-rolled BEFORE the React updater runs so StrictMode's
 * double-invoke produces identical results both times.
 */

import type { GameState } from '@/contexts/game/types';
import { MINER_PRICES } from '@/lib/economy/constants';
import { logger } from '@/utils/logger';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

// ============================================================================
// 1. calculateNetWorth — sum cash, savings, stocks, real estate, vehicles,
// companies, warehouse + miners, crypto, items. Heavily guarded against
// NaN / Infinity / negative values that older saves can produce.
// ============================================================================
//
// This is the exact body of the previous inline `calculateNetWorth` in
// `GameActionsContext.tsx:92-212`. Moved verbatim — same try/catch shape,
// same field iteration order, same logger calls. Any change here will
// surface as a snapshot diff in `subsystemEquivalence.test.ts`.
//
// ⚠ NOT THE CANONICAL NET WORTH, AND NOT CALLED BY THE WEEK LOOP.
//
// The figure the game actually uses is `netWorth()` in
// `lib/progress/achievements.ts` — it gates prestige, the $10M achievement,
// ambitions, the leaderboard, the passive-income soft cap, bail and ad rewards,
// and `statistics/statisticsTracker.calculateNetWorth` + `ShareLifeCard` both
// delegate to it. That one counts self-opened bank accounts
// (`nonMirrorDeposits`), savings goals and credit-card debt; this one counts
// none of the three, so the two disagree for most real saves. (Both DO count
// crypto — an earlier version of this note wrongly listed it as a difference.)
//
// It survives ONLY because `__tests__/refactor/subsystemEquivalence.test.ts`
// pins it as part of the R7 extraction snapshot. Do not wire it to anything, and
// do not "fix" its coverage to match — that would silently create a second
// authority. If the equivalence snapshot is ever retired, delete this function
// with it.

export function calculateNetWorth(gameState: GameState): number {
  try {
    // Validate and sanitize money
    const money = typeof gameState.stats?.money === 'number' && isFinite(gameState.stats.money)
      ? gameState.stats.money
      : 0;
    let netWorth = Math.max(0, money);

    // Add bank savings (validate)
    const bankSavings = typeof gameState.bankSavings === 'number' && isFinite(gameState.bankSavings)
      ? gameState.bankSavings
      : 0;
    netWorth += Math.max(0, bankSavings);

    // Add stock value (validate each holding)
    if (gameState.stocks?.holdings && Array.isArray(gameState.stocks.holdings)) {
      const stockValue = gameState.stocks.holdings.reduce((total, holding) => {
        if (!holding) return total;
        const shares = typeof holding.shares === 'number' && isFinite(holding.shares) && holding.shares >= 0
          ? holding.shares
          : 0;
        const price = typeof holding.currentPrice === 'number' && isFinite(holding.currentPrice) && holding.currentPrice >= 0
          ? holding.currentPrice
          : 0;
        const value = shares * price;
        // Prevent overflow
        return isFinite(value) ? total + value : total;
      }, 0);
      netWorth += Math.max(0, stockValue);
    }

    // Add property values (validate each property)
    if (gameState.realEstate && Array.isArray(gameState.realEstate)) {
      gameState.realEstate.forEach((property) => {
        if (property && typeof property.price === 'number' && isFinite(property.price) && property.price >= 0) {
          netWorth += property.price;
        }
      });
    }

    // Add vehicle values (validate each vehicle)
    if (gameState.vehicles && Array.isArray(gameState.vehicles)) {
      gameState.vehicles.forEach((vehicle) => {
        if (vehicle && typeof vehicle.price === 'number' && isFinite(vehicle.price) && vehicle.price >= 0) {
          netWorth += vehicle.price;
        }
      });
    }

    // Add company values (based on weekly income valuation - standard is 10x weekly income)
    if (gameState.companies && Array.isArray(gameState.companies)) {
      gameState.companies.forEach((company) => {
        if (company && typeof company.weeklyIncome === 'number' && isFinite(company.weeklyIncome) && company.weeklyIncome > 0) {
          // Value companies at 10x weekly income (standard business valuation)
          const companyValue = company.weeklyIncome * 10;
          if (isFinite(companyValue)) {
            netWorth += companyValue;
          }
        }
      });
    }

    // Add warehouse value and miners
    if (gameState.warehouse) {
      const warehouseBaseValue = 50000; // Base warehouse cost
      const warehouseValue = warehouseBaseValue * (gameState.warehouse.level || 1);
      if (isFinite(warehouseValue)) {
        netWorth += warehouseValue;
      }

      // Add miner values in warehouse
      if (gameState.warehouse.miners) {
        Object.entries(gameState.warehouse.miners).forEach(([minerId, count]) => {
          const price = MINER_PRICES[minerId];
          if (price && typeof count === 'number' && count > 0 && isFinite(count)) {
            const minerValue = price * count;
            if (isFinite(minerValue)) {
              netWorth += minerValue;
            }
          }
        });
      }
    }

    // Add crypto holdings value
    if (gameState.cryptos && Array.isArray(gameState.cryptos)) {
      gameState.cryptos.forEach((crypto) => {
        if (crypto && typeof crypto.owned === 'number' && typeof crypto.price === 'number') {
          const owned = isFinite(crypto.owned) && crypto.owned > 0 ? crypto.owned : 0;
          const price = isFinite(crypto.price) && crypto.price > 0 ? crypto.price : 0;
          const cryptoValue = owned * price;
          if (isFinite(cryptoValue)) {
            netWorth += cryptoValue;
          }
        }
      });
    }

    // Add owned items value
    if (gameState.items && Array.isArray(gameState.items)) {
      gameState.items.forEach((item) => {
        if (item && item.owned && typeof item.price === 'number' && isFinite(item.price) && item.price >= 0) {
          netWorth += item.price;
        }
      });
    }

    // Subtract outstanding debt — net worth is ASSETS minus LIABILITIES. Without
    // this, the full property/asset price counted while the mortgage/loan behind
    // it didn't, so a player could leverage borrowed money to vault the prestige
    // net-worth threshold without actually being wealthy. Only equity counts.
    if (gameState.loans && Array.isArray(gameState.loans)) {
      gameState.loans.forEach((loan) => {
        if (loan && typeof loan.remaining === 'number' && isFinite(loan.remaining) && loan.remaining > 0) {
          netWorth -= loan.remaining;
        }
      });
    }

    // Final validation - ensure result is finite and non-negative
    const finalNetWorth = isFinite(netWorth) ? Math.max(0, netWorth) : 0;

    // Log warning if calculation produced invalid result
    if (!isFinite(netWorth) || netWorth < 0) {
      logger.warn('[calculateNetWorth] Invalid net worth calculated, using 0:', { netWorth, money, bankSavings });
    }

    return finalNetWorth;
  } catch (error) {
    logger.error('[calculateNetWorth] Error calculating net worth:', error);
    return 0; // Safe fallback
  }
}

// ============================================================================
// 2. computeDecayInputs — build the stat-decay multipliers from the current
// state. Replaces the inline block at GameActionsContext.tsx:388-420.
// ============================================================================
//
// Inputs:
//   - state: current GameState
//   - baseDecayRate: the base decay rate (inline default was 4)
//   - prestigeMultiplier: pre-computed via getStatDecayMultiplier(unlockedBonuses);
//     accepted as input so the helper doesn't have to import prestige modules
//   - gracePeriodWeeks: early-game grace window (inline default was 8)
//
// Outputs match the variables the inline code computed:
//   - netWorth        — raw calculateNetWorth result (may be 0)
//   - safeNetWorth    — floored at 1000 for the wealthMultiplier divisor
//   - wealthMultiplier — 100000 / max(1000, safeNetWorth), clamped [0.5, 2.0]
//   - graceFactor      — current weeks lived / gracePeriodWeeks, capped at 1.0
//   - effectiveDecayRate — base * wealth * prestige * (0.25 + 0.75 * grace)

export interface DecayInputsOptions {
  /** Base decay rate (inline value: 4). */
  baseDecayRate: number;
  /** Result of `getStatDecayMultiplier(state.prestige?.unlockedBonuses || [])`. */
  prestigeMultiplier: number;
  /** Early-game grace period in weeks (inline value: 8). */
  gracePeriodWeeks?: number;
}

export interface DecayInputs {
  netWorth: number;
  safeNetWorth: number;
  wealthMultiplier: number;
  graceFactor: number;
  effectiveDecayRate: number;
}

export function computeDecayInputs(state: GameState, opts: DecayInputsOptions): DecayInputs {
  const baseDecayRate = opts.baseDecayRate;
  const gracePeriodWeeks = opts.gracePeriodWeeks ?? 8;

  // calculateNetWorth has its own try/catch and never throws, but the inline
  // call site wrapped it in an additional try/catch defensive-belt-and-
  // suspenders. Preserve the outer try/catch so error-log timing matches.
  let netWorth = 1000;
  try {
    netWorth = calculateNetWorth(state);
  } catch (nwError) {
    logger.error('[WEEK PROGRESSION] Failed to calculate net worth:', nwError);
  }

  const safeNetWorth = isFinite(netWorth) && netWorth > 0 ? netWorth : 1000;
  const wealthMultiplier = Math.max(0.5, Math.min(2.0, 100000 / Math.max(1000, safeNetWorth)));

  const safePrestigeMultiplier = isFinite(opts.prestigeMultiplier) && opts.prestigeMultiplier > 0
    ? opts.prestigeMultiplier
    : 1;
  let effectiveDecayRate = baseDecayRate * wealthMultiplier * safePrestigeMultiplier;

  // ENGAGEMENT: Early game grace period — reduce stat decay weeks 0-8.
  // This prevents new players from feeling punished before they understand the game.
  //
  // Counted in weeks into THIS LIFE, not on the absolute counter. `weeksLived`
  // is seeded from the starting age (`computeWeeksLived` = `(age - 18) * 52`),
  // so an age-20 character begins at 104 and an age-25 one at 364 — every one
  // of them was already past an 8-week window on frame one and took FULL decay
  // from their very first tick. The grace applied to exactly one starting age
  // (18), and to no prestige heir at all (heirs start at 20). Measured on the
  // real tick: an age-18 passive life loses 3.2 health / 5.6 happiness in week
  // 1, an age-25 one loses 7.8 / 14.4 and dies three weeks sooner.
  //
  // This is the fourth instance of the bug class CLAUDE.md §4.3 names (the
  // first-session coach, `FirstWeekGuide`, Chapter 1's "Survive 4 Weeks"), and
  // it is fixed the same way: read the `lifeStartWeek` baseline (v43).
  //
  // A save written before v43 has no baseline, and `weeksSinceLifeStart` falls
  // back to the absolute counter for those — deliberately. Such a save is by
  // definition not a first session, so re-opening a grace window for it would
  // hand an established player eight weeks of quarter-rate decay.
  const currentWeeks = weeksSinceLifeStart(state.weeksLived, state.lifeStartWeek);
  const graceFactor = Math.min(1.0, currentWeeks / gracePeriodWeeks);
  effectiveDecayRate = effectiveDecayRate * (0.25 + 0.75 * graceFactor);
  // Week 0: 25% decay, Week 4: 62.5% decay, Week 8+: 100% decay.

  // Final validation of decay rate — use safe default if invalid.
  if (!isFinite(effectiveDecayRate) || effectiveDecayRate < 0) {
    logger.error('[WEEK PROGRESSION] Invalid effectiveDecayRate calculated, using default:', {
      effectiveDecayRate,
      netWorth,
      wealthMultiplier,
      prestigeMultiplier: opts.prestigeMultiplier,
    });
    effectiveDecayRate = baseDecayRate; // Safe default (matches inline behavior).
  }

  return { netWorth, safeNetWorth, wealthMultiplier, graceFactor, effectiveDecayRate };
}

// ============================================================================
// 3. buildPreRolls — pre-roll every RNG draw the updater will consume.
// ============================================================================
//
// React StrictMode invokes the updater twice in development to surface
// impure logic. If the updater itself calls Math.random(), the two
// invocations produce different state and tests/dev-builds become flaky.
// The pre-roll pattern fixes this: every RNG draw happens ONCE here,
// outside setGameState, and the updater only reads from the result.
//
// This is the exact same object literal that was inlined at
// GameActionsContext.tsx:451-478 — same keys, same array lengths, same
// distributions. Moved verbatim.

export interface PreRolls {
  /** Career application acceptance delay (1 or 2 weeks). */
  careerAcceptDelay: 1 | 2;
  /** Auto-reinvest stock pick. */
  stockPickRoll: number;
  /** Child birth: gender + ID suffix + personality index. */
  childGender: 'male' | 'female';
  childIdSuffix: string;
  childPersonality: number;
  /** Per-relationship rolls (up to 20 relationships). */
  relBreakup: number[];
  relDisappointed: number[];
  /** Police encounter roll. */
  policeEncounter: number;
  /** Miner durability degradation (2-5% per week). */
  minerDegradation: number;
  /** Per-disease rolls (up to 20 active diseases). */
  diseaseComplication: number[];
  diseaseProgression: number[];
  /** Per-pet sickness rolls (sized to 20; consumer wraps the index modulo
   * the array length, so any pet count is covered). */
  petSickness: number[];
  petSicknessType: number[];
  /** Per-vehicle accident rolls (up to 10 vehicles). */
  /** Per-luxury-item incident rolls (theft, storm, injury). */
  luxuryIncident: number[];
  vehicleAccident: number[];
  vehicleAccidentSeverity: number[];
  /** Timestamp captured outside the updater (Date.now() is impure too). */
  timestamp: number;
  /** Open index signature — `lib/social/pulseTick.ts` and other subsystem
   * ticks accept the pre-rolls as an open record so callers can layer in
   * extra per-subsystem seeds without us having to know about them here. */
  [key: string]: unknown;
}

export function buildPreRolls(): PreRolls {
  return {
    // Career application acceptance delay (1 or 2 weeks)
    careerAcceptDelay: Math.random() < 0.5 ? 1 : 2,
    // Auto-reinvest stock pick
    stockPickRoll: Math.random(),
    // Child birth
    childGender: Math.random() < 0.5 ? 'male' as const : 'female' as const,
    childIdSuffix: Math.random().toString(36).slice(2, 8),
    childPersonality: Math.floor(Math.random() * 5),
    // Relationship breakup/disappointment (one pair per relationship, max 20)
    relBreakup: Array.from({ length: 20 }, () => Math.random()),
    relDisappointed: Array.from({ length: 20 }, () => Math.random()),
    // Police encounter
    policeEncounter: Math.random(),
    // Miner durability degradation (2-5% per week)
    minerDegradation: 2 + Math.random() * 3,
    // Disease complications (one set per disease, max 20)
    diseaseComplication: Array.from({ length: 20 }, () => Math.random()),
    diseaseProgression: Array.from({ length: 20 }, () => Math.random()),
    // Pet sickness (one pair per pet). Sized to 20; the consumer wraps the
    // index (modulo) so larger pet collections still get a valid roll instead
    // of an out-of-range `undefined` that reads as sickness-immune.
    luxuryIncident: Array.from({ length: 20 }, () => Math.random()),
    petSickness: Array.from({ length: 20 }, () => Math.random()),
    petSicknessType: Array.from({ length: 20 }, () => Math.random()),
    // Vehicle accidents (one pair per vehicle, max 10)
    vehicleAccident: Array.from({ length: 10 }, () => Math.random()),
    vehicleAccidentSeverity: Array.from({ length: 10 }, () => Math.random()),
    // Timestamps (Date.now() is impure under StrictMode double-invoke)
    timestamp: Date.now(),
  };
}
