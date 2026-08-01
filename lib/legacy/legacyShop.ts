/**
 * The Legacy Points sink.
 *
 * C-11. `legacyPoints` were earned every 10 weeks by the week loop and from
 * four elder activities, persisted, migrated (v11) and repaired — and then
 * never spent, displayed, or checked by any mechanic. A currency with no sink
 * and no readout. The code called it a "mini-prestige"; nothing had been built
 * to prestige INTO.
 *
 * Owner's call: spend them on the next generation's starting position.
 *
 * ── Why these upgrades and not others ─────────────────────────────────────
 *
 * Every one is a HEAD START, not a permanent multiplier. Legacy points are
 * earned by living a long life, and a long life is already rewarded; letting
 * them buy compounding power would make the second generation strictly easier
 * than the first forever, which is prestige's job, not this system's.
 *
 * They are also deliberately cheap relative to accrual. The tick grants
 * `floor(weeksLived/10) + prestigeLevel*2` every ten weeks, so a single
 * 500-week life yields hundreds of points. Pricing them high would just mean
 * the shop is empty for a new player and irrelevant for an old one.
 *
 * Purchases are stored as ids on `legacyUpgrades` and carried into the heir,
 * so what you bought is what your heir starts with. Buying is once-per-id:
 * these are unlocks, not stackable levels, which keeps the heir's starting
 * position bounded no matter how long the parent lived.
 */

export interface LegacyUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Applied to the heir's starting state at `createChildGameState`. */
  effect:
    | { kind: 'money'; amount: number }
    | { kind: 'stat'; stat: 'health' | 'happiness' | 'intelligence' | 'fitness'; amount: number }
    | { kind: 'reputation'; amount: number };
}

export const LEGACY_UPGRADES: LegacyUpgrade[] = [
  {
    id: 'legacy_inheritance_small',
    name: 'Modest Inheritance',
    description: 'Your heir starts with $10,000 of family money.',
    cost: 25,
    effect: { kind: 'money', amount: 10_000 },
  },
  {
    id: 'legacy_inheritance_large',
    name: 'Family Fortune',
    description: 'Your heir starts with $100,000 of family money.',
    cost: 120,
    effect: { kind: 'money', amount: 100_000 },
  },
  {
    id: 'legacy_education',
    name: 'A Good Upbringing',
    description: 'Your heir starts with +15 intelligence.',
    cost: 40,
    effect: { kind: 'stat', stat: 'intelligence', amount: 15 },
  },
  {
    id: 'legacy_health',
    name: 'Strong Stock',
    description: 'Your heir starts with +15 health.',
    cost: 40,
    effect: { kind: 'stat', stat: 'health', amount: 15 },
  },
  {
    id: 'legacy_fitness',
    name: 'An Active Household',
    description: 'Your heir starts with +15 fitness.',
    cost: 35,
    effect: { kind: 'stat', stat: 'fitness', amount: 15 },
  },
  {
    id: 'legacy_name',
    name: 'A Name That Opens Doors',
    description: 'Your heir starts with +20 reputation.',
    cost: 80,
    effect: { kind: 'reputation', amount: 20 },
  },
];

export function getLegacyUpgrade(id: string): LegacyUpgrade | undefined {
  return LEGACY_UPGRADES.find((u) => u.id === id);
}

/** Total points spent on the upgrades a save owns. */
export function legacyPointsSpent(owned: readonly string[] | undefined): number {
  if (!Array.isArray(owned)) return 0;
  let total = 0;
  for (const id of new Set(owned)) {
    total += getLegacyUpgrade(id)?.cost ?? 0;
  }
  return total;
}

/**
 * Points a save can still spend.
 *
 * `legacyPoints` is the LIFETIME total earned — the week loop only ever adds to
 * it — so the balance has to be derived rather than decremented. That also
 * makes the shop idempotent: re-running a purchase cannot double-charge,
 * because owning the id is what costs the points.
 */
export function legacyPointsAvailable(
  legacyPoints: number | undefined,
  owned: readonly string[] | undefined,
): number {
  const earned = typeof legacyPoints === 'number' && Number.isFinite(legacyPoints) && legacyPoints > 0
    ? Math.floor(legacyPoints)
    : 0;
  return Math.max(0, earned - legacyPointsSpent(owned));
}

export interface LegacyPurchaseResult {
  success: boolean;
  message: string;
  /** The new owned list, when the purchase landed. */
  owned?: string[];
}

/**
 * Buy an upgrade. A PURE reducer over the two stored values, so the caller can
 * run it for the state and for the report without reading anything out of a
 * `setGameState` updater — see `__tests__/refactor/updaterTimingContract.test.tsx`
 * for why that matters.
 */
export function purchaseLegacyUpgrade(
  legacyPoints: number | undefined,
  owned: readonly string[] | undefined,
  upgradeId: string,
): LegacyPurchaseResult {
  const upgrade = getLegacyUpgrade(upgradeId);
  if (!upgrade) return { success: false, message: 'Unknown legacy upgrade.' };

  const current = Array.isArray(owned) ? owned : [];
  if (current.includes(upgradeId)) {
    return { success: false, message: `You already have ${upgrade.name}.` };
  }

  const available = legacyPointsAvailable(legacyPoints, current);
  if (available < upgrade.cost) {
    return {
      success: false,
      message: `${upgrade.name} costs ${upgrade.cost} legacy points — you have ${available}.`,
    };
  }

  return {
    success: true,
    message: `${upgrade.name} secured for the next generation.`,
    owned: [...current, upgradeId],
  };
}

/** The starting bonuses an owned upgrade list grants the heir. */
export interface HeirStartingBonuses {
  money: number;
  reputation: number;
  stats: Partial<Record<'health' | 'happiness' | 'intelligence' | 'fitness', number>>;
}

export function heirStartingBonuses(owned: readonly string[] | undefined): HeirStartingBonuses {
  const out: HeirStartingBonuses = { money: 0, reputation: 0, stats: {} };
  if (!Array.isArray(owned)) return out;

  for (const id of new Set(owned)) {
    const upgrade = getLegacyUpgrade(id);
    if (!upgrade) continue;
    const e = upgrade.effect;
    if (e.kind === 'money') out.money += e.amount;
    else if (e.kind === 'reputation') out.reputation += e.amount;
    else out.stats[e.stat] = (out.stats[e.stat] ?? 0) + e.amount;
  }
  return out;
}
