/**
 * Weekly rent + housing module integration — R7 Phase 2 step 2.4c.
 *
 * Scope: three concerns previously inline in `GameActionsContext.tsx:851-902`.
 *   1. Rented-but-not-owned properties incur weekly rent (price × rate).
 *   2. `housingModule.processWeeklyHousing` runs condition decay, value
 *      appreciation, base rent + happiness bonus, and pushes "🏠 Property
 *      Alert" notifications when a property needs attention.
 *   3. `runRealEstateWeeklyTick` (Remake 4) layers neighborhood cycle +
 *      tenant lifecycle + Airbnb realized-rent variance on top.
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.notifications.push(...)` for housing alerts and real-estate
 *     tick notifications.
 *
 * Reads from `ctx`: none (all reads are via explicit parameters for
 * better test isolation).
 *
 * Returns the four aggregated values the caller's downstream blocks
 * still consume:
 *   - `weeklyRent`            — used in cashAfterIncomeAndRent + day-summary log
 *   - `updatedRealEstate`     — written into the new GameState
 *   - `housingHappinessBonus` — added to newStats.happiness later (capped)
 *   - `housingRentalIncome`   — added to cashAfterIncomeAndRent
 *   - `housingUpkeep`         — subtracted from cashAfterIncomeAndRent
 *
 * The two module calls are wrapped in try/catch matching the legacy code
 * — "module may not exist in tests" was the inline comment. Both throws
 * silently roll back to whatever was computed so far.
 *
 * `rollFor` is injected by the caller so production preserves the legacy
 * `() => Math.random()` non-determinism while tests can pass a seeded
 * roll source for stable snapshots.
 */

import type { RealEstate, RealEstateActivityEntry } from '@/contexts/game/types';
import { PLAYER_RENT_RATE_WEEKLY } from '@/lib/economy/constants';
import * as housingModule from '@/lib/realEstate/housing';
import { rentalIncomeMultiplier } from '@/lib/prestige/purchaseDiscounts';
import { runRealEstateWeeklyTick } from '@/lib/realEstate/weeklyTick';
import type { WeekContext } from './weekContext';

/** Newest-40 cap for the persisted portfolio activity slice (matches the migration). */
const ACTIVITY_CAP = 40;

/** Coerce a possibly-missing/corrupt numeric field to a finite number (else `fb`). */
const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Derive a short `kind` tag for an activity entry from the tick notification id. */
function activityKind(noteId: string): string {
  if (noteId.startsWith('re-cycle-')) return 'cycle';
  if (noteId.startsWith('re-tenant-arrive-')) return 'tenant_in';
  if (noteId.startsWith('re-tenant-leave-')) return 'tenant_out';
  if (noteId.startsWith('housing-alert')) return 'maintenance';
  return 'event';
}

export interface RentAndHousingResult {
  weeklyRent: number;
  updatedRealEstate: RealEstate[];
  housingHappinessBonus: number;
  housingRentalIncome: number;
  housingUpkeep: number;
  /**
   * v22 Wave A: capped, persisted portfolio activity timeline. Merges the prior
   * slice with this week's real-estate tick + housing-alert notifications so the
   * RealEstateApp Activity tab reads durable events instead of one-frame toasts.
   */
  realEstateActivity: RealEstateActivityEntry[];
}

export function applyRentAndHousing(
  prevRealEstate: RealEstate[] | undefined | null,
  nextWeeksLived: number,
  rollFor: (key: string) => number,
  ctx: WeekContext,
  prevActivity?: RealEstateActivityEntry[] | null,
  /** Prestige bonus ids — feeds the Property Manager rent multiplier. */
  unlockedBonuses?: string[],
): RentAndHousingResult {
  // v22 Wave A: accumulate durable activity entries from this week's notifications.
  const newActivity: RealEstateActivityEntry[] = [];
  // 1. Weekly rent for rented-but-not-owned properties.
  let weeklyRent = 0;
  (prevRealEstate || []).forEach((property) => {
    if ('status' in property && property.status === 'rented' && !property.owned) {
      // Guard property.price: a non-numeric/corrupt price would make `rent` NaN,
      // which then poisons weeklyRent → cashAfterIncomeAndRent → stats.money.
      const rent = Math.round(safe(property.price) * PLAYER_RENT_RATE_WEEKLY);
      weeklyRent += rent;
    }
  });

  // 2. Housing & Decoration System — condition decay, appreciation, etc.
  let updatedRealEstate: RealEstate[] = (prevRealEstate || []) as RealEstate[];
  let housingHappinessBonus = 0;
  let housingRentalIncome = 0;
  let housingUpkeep = 0;
  try {
    const housingResult = housingModule.processWeeklyHousing(updatedRealEstate, nextWeeksLived);
    updatedRealEstate = housingResult.properties;
    housingHappinessBonus = housingResult.totalHappinessBonus;
    housingUpkeep = housingResult.totalUpkeep;
    // NOTE: housingResult.totalRentalIncome is intentionally NOT assigned to
    // housingRentalIncome here — the tenant-model pass below is authoritative and
    // used to immediately overwrite it (a dead double-assignment). The upgrade
    // rent bonus that figure carried now flows through runRealEstateWeeklyTick.
    // Show property condition alerts.
    if (housingResult.notifications.length > 0) {
      housingResult.notifications.forEach((msg: string, i: number) => {
        ctx.notifications.push({ id: 'housing-alert', message: msg, title: '🏠 Property Alert' });
        newActivity.push({ id: `housing-alert-${nextWeeksLived}-${i}`, week: nextWeeksLived, kind: 'maintenance', label: msg });
      });
    }
  } catch {
    // Housing module may not exist in tests — preserved silent fallback.
  }

  // 3. Real-estate Remake 4 tick: neighborhood cycle + tenant lifecycle + Airbnb variance.
  // Layers on top of the legacy housing pass — replaces `housingRentalIncome`
  // with the realized figure from the new model.
  try {
    const reTick = runRealEstateWeeklyTick({
      legacyProcessedProperties: updatedRealEstate,
      legacyRentalIncome: housingRentalIncome,
      currentWeek: nextWeeksLived,
      rollFor,
      // Prestige Property Manager (+15% tenant rent). Applied inside the tick,
      // before its $150K/wk cap.
      rentalIncomeMultiplier: rentalIncomeMultiplier(unlockedBonuses),
    });
    updatedRealEstate = reTick.properties;
    housingRentalIncome = reTick.rentalIncome;
    for (const note of reTick.notifications) {
      ctx.notifications.push({ id: note.id, title: note.title, message: note.message });
      newActivity.push({ id: note.id, week: nextWeeksLived, kind: activityKind(note.id), label: note.message });
    }
  } catch {
    // Real-estate weeklyTick module may not exist in tests — preserved silent fallback.
  }

  // Merge the new entries into the persisted slice, de-duping by id (idempotent
  // per week) and keeping only the most recent ACTIVITY_CAP entries.
  const seen = new Set((prevActivity ?? []).map((e) => e.id));
  const freshUnique = newActivity.filter((e) => !seen.has(e.id));
  const realEstateActivity = [...(prevActivity ?? []), ...freshUnique].slice(-ACTIVITY_CAP);

  // Life Skills: Budgeting (-5% weekly expenses) trims recurring housing costs
  // (rent paid + upkeep). Bounded mult ≤ 1; rental INCOME is never scaled.
  const expenseMult = ctx.lifeSkillMods?.expenseMult ?? 1;
  if (typeof expenseMult === 'number' && isFinite(expenseMult) && expenseMult > 0 && expenseMult < 1) {
    weeklyRent = Math.round(weeklyRent * expenseMult);
    housingUpkeep = Math.round(housingUpkeep * expenseMult);
  }

  return {
    weeklyRent,
    updatedRealEstate,
    housingHappinessBonus,
    housingRentalIncome,
    housingUpkeep,
    realEstateActivity,
  };
}
