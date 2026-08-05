/**
 * Rentable homes — the housing ladder you can reach before you can buy one.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * The tenant code path was already here: `applyRentAndHousing` charges weekly
 * rent for any property with `status === 'rented' && !owned`. Nothing in the
 * game ever created one. The only `status: 'rented'` writer is the LANDLORD
 * side, where the player rents a property OUT.
 *
 * So the only route to a home was buying one, and the cheapest is $95 000 — 16.6
 * years of a bottom-rung wage after the income rebalance. A character therefore
 * had no access to housing benefits for the first two decades of their life, and
 * "somewhere to live" was never a goal, just an eventual purchase.
 *
 * Renting is the missing rung. It also supplies the recurring bill the economy
 * has never had: rent is exactly what the arrears system was built to handle and
 * never received, so an unaffordable week now becomes a debt rather than being
 * silently forgiven.
 *
 * ── How the ladder is priced ──────────────────────────────────────────────
 *
 * Against the CURRENT income scale, not against intuition. A bottom-rung career
 * pays $110/week and the best street week is ~$95, so:
 *
 *   - the bottom tier is affordable on any income, including street work alone;
 *   - the second tier costs most of a minimum wage, so taking it is a real
 *     commitment rather than an obvious upgrade;
 *   - the top tiers need a career that has actually gone somewhere.
 *
 * That gradient is the point. A ladder where every rung is affordable is a menu,
 * not a decision. `__tests__/economy/rentalLadder.test.ts` pins the relationship
 * to the income scale so re-tuning wages surfaces here instead of silently
 * making every tier free.
 */
import type { GameState } from '@/contexts/game/types';

export interface RentalTier {
  id: string;
  name: string;
  /** One line for the card. Concrete, not marketing. */
  description: string;
  /** Weekly rent in dollars. Charged through the normal bill line. */
  weeklyRent: number;
  /** Weekly stat effects while this is your home. */
  health: number;
  happiness: number;
  energy: number;
  /**
   * Minimum weekly income a landlord will accept, in dollars. Real letting
   * agents credit-check; more importantly it stops a broke character signing for
   * a penthouse and immediately drowning in arrears, which is a trap rather
   * than a decision.
   */
  incomeRequirement: number;
}

/**
 * Weekly cost of having nowhere to live.
 *
 * Homelessness was free: no residence meant no bonuses and no penalty, so the
 * cheapest strategy was always to live nowhere. A penalty is what turns rent
 * from an optional purchase into a reason to work.
 *
 * Deliberately survivable. It should push a player toward a room, not kill them
 * — death from zero health takes four consecutive weeks (`ZERO_STAT_DEATH_WEEKS`)
 * and this alone must never be able to get there from a healthy start.
 */
export const HOMELESS_PENALTY = { health: -2, happiness: -4, energy: -5 } as const;

/**
 * The ladder, cheapest first.
 *
 * Energy and health are small numbers on purpose — they compound every week
 * against a 0-100 stat, so a "+5 energy" home is a large standing effect, not a
 * small one. Happiness carries the bigger swings because it is the stat the
 * player is most often fighting to hold up.
 */
export const RENTAL_TIERS: RentalTier[] = [
  {
    id: 'shared-room',
    name: 'Shared Room',
    description: 'A room in a shared flat. Thin walls, but it is a door that locks.',
    weeklyRent: 45,
    health: 0,
    happiness: 1,
    energy: 1,
    incomeRequirement: 0,
  },
  {
    id: 'bedsit',
    name: 'Bedsit',
    description: 'One room, your own kitchenette. Nobody else’s dishes.',
    weeklyRent: 80,
    health: 1,
    happiness: 2,
    energy: 2,
    // 100, not 120: the bottom-rung career pays $110, and a requirement above
    // that left a minimum-wage worker with exactly ONE option. A ladder whose
    // first real choice needs a promotion is not a choice. At $80 against $110
    // this is still most of the paycheck, which is the commitment it should be.
    incomeRequirement: 100,
  },
  {
    id: 'rented-studio',
    name: 'Rented Studio',
    description: 'A proper studio with light and a real bed. You sleep better here.',
    weeklyRent: 140,
    health: 2,
    happiness: 4,
    energy: 3,
    incomeRequirement: 220,
  },
  {
    id: 'rented-apartment',
    name: 'City Apartment',
    description: 'Two rooms in a decent building. Room to actually live.',
    weeklyRent: 260,
    health: 3,
    happiness: 6,
    energy: 4,
    incomeRequirement: 400,
  },
  {
    id: 'rented-house',
    name: 'Suburban House',
    description: 'A house with a garden. Quiet, and space to keep a family.',
    weeklyRent: 480,
    health: 4,
    happiness: 9,
    energy: 5,
    incomeRequirement: 750,
  },
  {
    id: 'rented-penthouse',
    name: 'Penthouse Lease',
    description: 'Top floor, floor-to-ceiling glass, a concierge who knows your name.',
    weeklyRent: 950,
    health: 5,
    happiness: 13,
    energy: 6,
    incomeRequirement: 1500,
  },
];

/**
 * Weeks behind on rent before the landlord ends the tenancy.
 *
 * Four, matching `ZERO_STAT_DEATH_WEEKS` — the game already teaches "four bad
 * weeks and something breaks", and a second, different number for the same shape
 * of consequence is just something else to learn.
 *
 * It is a month of game time, and the counter resets the moment the arrears
 * clear, so a single bad week never puts anyone on the street.
 */
export const EVICTION_AFTER_WEEKS = 4;

/** The week the player first gets told this is heading somewhere. */
const EVICTION_FIRST_WARNING_WEEK = 2;

export interface TenancyArrearsInput {
  /** The tenancy at the start of the week, if any. */
  rental: { tierId: string; startedWeek: number; missedWeeks?: number } | undefined;
  /** Arrears standing at the END of this week, after settlement. */
  overdueBalance: number;
}

export interface TenancyArrearsResult {
  /** The tenancy going forward. `undefined` means evicted (or none to begin with). */
  rental: { tierId: string; startedWeek: number; missedWeeks?: number } | undefined;
  /** True on the week the tenancy ends. */
  evicted: boolean;
  /** Player-facing warning or eviction notice. Empty when there is nothing to say. */
  notice: string;
}

/**
 * Advance the eviction clock for a tenancy.
 *
 * Pure. Being in arrears at the END of a week counts as a missed rent week:
 * arrears are settled off the top of income before anything else, so a standing
 * balance means the week's bills were not covered — and for a renter, rent is
 * almost always the largest of them.
 *
 * The counter RESETS to zero the moment the balance clears. That is what keeps
 * this a pressure mechanic rather than a countdown: paying what you owe always
 * buys back the full four weeks, so there is never a point at which the player
 * is doomed but still playing.
 *
 * Eviction does NOT clear the debt. The rent stops, the arrears remain, and the
 * homeless penalty starts — which is the honest outcome and still recoverable:
 * the bottom tier costs $45 against ~$95 a week from street work alone.
 */
export function applyTenancyArrears(input: TenancyArrearsInput): TenancyArrearsResult {
  const rental = input.rental;
  if (!rental || !getRentalTier(rental.tierId)) {
    return { rental: undefined, evicted: false, notice: '' };
  }

  const overdue = typeof input.overdueBalance === 'number' && isFinite(input.overdueBalance)
    ? input.overdueBalance
    : 0;

  if (overdue <= 0) {
    // Caught up. Drop the counter rather than merely pausing it.
    return {
      rental: rental.missedWeeks ? { ...rental, missedWeeks: 0 } : rental,
      evicted: false,
      notice: '',
    };
  }

  const missed = (typeof rental.missedWeeks === 'number' && isFinite(rental.missedWeeks)
    ? Math.max(0, rental.missedWeeks)
    : 0) + 1;

  const tier = getRentalTier(rental.tierId)!;

  if (missed >= EVICTION_AFTER_WEEKS) {
    return {
      rental: undefined,
      evicted: true,
      notice: `You have been evicted from the ${tier.name}. What you owe still stands, and you have nowhere to sleep.`,
    };
  }

  const weeksLeft = EVICTION_AFTER_WEEKS - missed;
  const notice = missed >= EVICTION_FIRST_WARNING_WEEK
    // Named, specific, and counted down — an eviction that arrives unannounced
    // is a punishment, one the player watched approaching is a decision.
    ? `Your landlord has sent a notice: ${missed} weeks behind on the ${tier.name}. ${weeksLeft} more and you are out.`
    : '';

  return { rental: { ...rental, missedWeeks: missed }, evicted: false, notice };
}

/**
 * One week of the tenancy, including the case where there should not be one.
 *
 * Buying a home ENDS the lease instead of advancing its eviction clock.
 * Ownership wins in `computeHousingWellbeing`, so an owner is charged no rent —
 * and running the countdown against arrears from other bills would evict
 * someone out of a tenancy they are not paying for, while they sit in a house
 * they own. The Rent screen also hides "Move out" once you own, so a dangling
 * tenancy could never be cleared by hand either.
 */
export function resolveTenancyStep(
  input: TenancyArrearsInput & { owns: boolean },
): TenancyArrearsResult {
  if (input.owns) {
    return {
      rental: undefined,
      evicted: false,
      notice: input.rental ? 'You moved into a home of your own, so your lease has ended.' : '',
    };
  }
  return applyTenancyArrears(input);
}

export function getRentalTier(id: string | undefined | null): RentalTier | undefined {
  if (!id) return undefined;
  return RENTAL_TIERS.find((t) => t.id === id);
}

/**
 * What the player earns per week, for the letting requirement.
 *
 * Uses the CAREER salary only. Deliberately not net worth or passive income: the
 * check exists to stop someone signing a lease they cannot service from wages,
 * and a landlord asking "what do you earn" is asking about a paycheck.
 */
export function weeklyIncomeForLetting(state: GameState | undefined | null): number {
  const careers = state?.careers ?? [];
  const currentJob = state?.currentJob;
  if (!currentJob) return 0;
  const career = careers.find((c) => c.id === currentJob && c.accepted);
  if (!career) return 0;
  const level = career.levels?.[career.level ?? 0];
  const salary = level?.salary;
  return typeof salary === 'number' && isFinite(salary) && salary > 0 ? salary : 0;
}

export interface LettingVerdict {
  allowed: boolean;
  /** Player-facing reason when refused. Empty when allowed. */
  reason: string;
}

/**
 * Can this player sign for this tier right now?
 *
 * Two gates, both stated to the player rather than discovered on tap:
 *  - the income requirement, and
 *  - enough cash on hand for the first week, so a lease never starts already
 *    in arrears.
 */
export function canRent(state: GameState, tier: RentalTier): LettingVerdict {
  const income = weeklyIncomeForLetting(state);
  if (income < tier.incomeRequirement) {
    return {
      allowed: false,
      reason: `Needs proof of $${tier.incomeRequirement}/wk income — you earn $${income}/wk.`,
    };
  }
  const cash = state.stats?.money;
  const safeCash = typeof cash === 'number' && isFinite(cash) ? cash : 0;
  if (safeCash < tier.weeklyRent) {
    return {
      allowed: false,
      reason: `The first week is due on signing: $${tier.weeklyRent}.`,
    };
  }
  return { allowed: true, reason: '' };
}

export interface HousingWellbeing {
  health: number;
  happiness: number;
  energy: number;
  /** Weekly rent owed for a tenancy (0 when the player owns or is homeless). */
  rent: number;
  /** True when the player has no home at all — the penalty case. */
  homeless: boolean;
}

/**
 * The weekly wellbeing effect of wherever the player currently lives.
 *
 * Ownership wins over a tenancy: someone who buys a house while renting should
 * get the better outcome, not both, and not the worse one. Owning also stops the
 * rent, which is the whole point of buying.
 *
 * OWNED residences pay health and energy here too. They never used to: the
 * catalogue gives every property a `weeklyEnergy` (2 to 10) and
 * `processWeeklyHousing` applied `weeklyHappiness` alone, while
 * `TopStatsBar` has been adding `weeklyEnergy` to its predicted weekly change
 * the whole time. The HUD was promising something the tick did not pay.
 */
/**
 * The slice this needs. Narrow on purpose: the HUD subscribes through
 * `useGameSelector` and must not pull the whole state in to ask what its home
 * is worth (a documented perf regression class — `tasks/lessons.md`, 2026-06-09).
 */
export type HousingStateSlice = Pick<GameState, 'realEstate' | 'rental'>;

export function computeHousingWellbeing(
  state: HousingStateSlice | undefined | null,
): HousingWellbeing {
  const owned = (state?.realEstate ?? []).find(
    (p) => p?.owned && 'currentResidence' in p && p.currentResidence === true,
  );

  if (owned) {
    const happiness = numberOr(owned.weeklyHappiness, 0);
    const energy = numberOr(owned.weeklyEnergy, 0);
    return {
      // Owning is the comfortable outcome, so health scales off the same tier
      // signal the other two use rather than adding a field to every catalogue
      // row. Halved because health moves slower than mood by design.
      health: Math.round(energy / 2),
      happiness,
      energy,
      rent: 0,
      homeless: false,
    };
  }

  const tier = getRentalTier(state?.rental?.tierId);
  if (tier) {
    return {
      health: tier.health,
      happiness: tier.happiness,
      energy: tier.energy,
      rent: tier.weeklyRent,
      homeless: false,
    };
  }

  return { ...HOMELESS_PENALTY, rent: 0, homeless: true };
}

const numberOr = (n: unknown, fallback: number): number =>
  typeof n === 'number' && isFinite(n) ? n : fallback;
