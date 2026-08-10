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

/**
 * ── The Dynasty Tree (2026-08-05) ─────────────────────────────────────────
 *
 * The six original upgrades cost **340 points in total** against an accrual
 * curve that is QUADRATIC — `floor(weeksLived/10)` every ten weeks compounds to
 * ~1,275 points by week 500 and ~5,050 by week 1,000. So the shop was bought
 * out by week ~260, and from generation 2 onward every heir started with the
 * whole thing already owned. A currency that is dead for three quarters of a
 * long life is barely better than the currency with no sink that this system
 * was built to fix.
 *
 * The fix is depth, not price inflation on the existing tier: four branches
 * with prerequisite edges, running 25 → 3,600. Total ~8,700, so a 1,000-week
 * life can buy most of a branch but not the tree — which finally makes this a
 * choice about what your family is KNOWN for.
 *
 * The original six ids are unchanged and keep their costs. They are now the
 * roots of their branches, so nothing an existing save bought is invalidated.
 *
 * Why the deep nodes are all money: `prestigeExecution` clamps every stat and
 * reputation bonus to 100, so a 900-point "+35 health" node would be mostly
 * wasted the moment the cheaper ones are owned. Money is the only unclamped
 * effect — and it is also the one the economy audit found negligible ($110k of
 * head start against a week-500 net worth of $20–30M). Depth goes where it can
 * actually be felt.
 */
export type LegacyBranch = 'wealth' | 'blood' | 'name' | 'craft';

export const LEGACY_BRANCHES: { id: LegacyBranch; name: string; blurb: string }[] = [
  { id: 'wealth', name: 'Wealth', blurb: 'What the family owns.' },
  { id: 'blood', name: 'Blood', blurb: 'What the family is made of.' },
  { id: 'name', name: 'Name', blurb: 'What doors the family opens.' },
  { id: 'craft', name: 'Craft', blurb: 'What the family knows.' },
];

export interface LegacyUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Which branch of the tree this node sits on. */
  branch: LegacyBranch;
  /**
   * Node that must be owned first. Roots have none. Single-parent by design —
   * a DAG would need cycle detection and buys nothing the player can feel.
   */
  requires?: string;
  /** Applied to the heir's starting state at `createChildGameState`. */
  effect:
    | { kind: 'money'; amount: number }
    | { kind: 'stat'; stat: 'health' | 'happiness' | 'intelligence' | 'fitness'; amount: number }
    | { kind: 'reputation'; amount: number };
}

export const LEGACY_UPGRADES: LegacyUpgrade[] = [
  // ── Wealth ──────────────────────────────────────────────────────────────
  // The only unclamped effect, so this is where the deep (and expensive) end
  // of the tree lives.
  {
    id: 'legacy_inheritance_small',
    name: 'Modest Inheritance',
    description: 'Your heir starts with $10,000 of family money.',
    cost: 25,
    branch: 'wealth',
    effect: { kind: 'money', amount: 10_000 },
  },
  {
    id: 'legacy_inheritance_large',
    name: 'Family Fortune',
    description: 'Your heir starts with $100,000 of family money.',
    cost: 120,
    branch: 'wealth',
    requires: 'legacy_inheritance_small',
    effect: { kind: 'money', amount: 100_000 },
  },
  {
    id: 'legacy_trust_fund',
    name: 'The Trust',
    description: 'A structured trust. Your heir starts with $1,000,000.',
    cost: 400,
    branch: 'wealth',
    requires: 'legacy_inheritance_large',
    effect: { kind: 'money', amount: 1_000_000 },
  },
  {
    id: 'legacy_dynasty_capital',
    name: 'Dynasty Capital',
    description: 'Generations of compounding. Your heir starts with $10,000,000.',
    cost: 1_200,
    branch: 'wealth',
    requires: 'legacy_trust_fund',
    effect: { kind: 'money', amount: 10_000_000 },
  },
  {
    id: 'legacy_sovereign_wealth',
    name: 'Sovereign Wealth',
    description: 'The family is an institution. Your heir starts with $100,000,000.',
    cost: 3_600,
    branch: 'wealth',
    requires: 'legacy_dynasty_capital',
    effect: { kind: 'money', amount: 100_000_000 },
  },

  // ── Blood ───────────────────────────────────────────────────────────────
  // Stats clamp at 100, so this branch stays deliberately short and cheap.
  {
    id: 'legacy_health',
    name: 'Strong Stock',
    description: 'Your heir starts with +15 health.',
    cost: 40,
    branch: 'blood',
    effect: { kind: 'stat', stat: 'health', amount: 15 },
  },
  {
    id: 'legacy_fitness',
    name: 'An Active Household',
    description: 'Your heir starts with +15 fitness.',
    cost: 35,
    branch: 'blood',
    effect: { kind: 'stat', stat: 'fitness', amount: 15 },
  },
  {
    id: 'legacy_constitution',
    name: 'Iron Constitution',
    description: 'Your heir starts with a further +25 health.',
    cost: 200,
    branch: 'blood',
    requires: 'legacy_health',
    effect: { kind: 'stat', stat: 'health', amount: 25 },
  },
  {
    id: 'legacy_athletic_dynasty',
    name: 'Athletic Dynasty',
    description: 'Your heir starts with a further +25 fitness.',
    cost: 200,
    branch: 'blood',
    requires: 'legacy_fitness',
    effect: { kind: 'stat', stat: 'fitness', amount: 25 },
  },

  // ── Name ────────────────────────────────────────────────────────────────
  {
    id: 'legacy_name',
    name: 'A Name That Opens Doors',
    description: 'Your heir starts with +20 reputation.',
    cost: 80,
    branch: 'name',
    effect: { kind: 'reputation', amount: 20 },
  },
  {
    id: 'legacy_influence',
    name: 'Quiet Influence',
    description: 'Your heir starts with a further +25 reputation.',
    cost: 300,
    branch: 'name',
    requires: 'legacy_name',
    effect: { kind: 'reputation', amount: 25 },
  },
  {
    id: 'legacy_institution',
    name: 'A Family Institution',
    description: 'The name is on a building. Your heir starts with a further +30 reputation.',
    cost: 900,
    branch: 'name',
    requires: 'legacy_influence',
    effect: { kind: 'reputation', amount: 30 },
  },

  // ── Craft ───────────────────────────────────────────────────────────────
  {
    id: 'legacy_education',
    name: 'A Good Upbringing',
    description: 'Your heir starts with +15 intelligence.',
    cost: 40,
    branch: 'craft',
    effect: { kind: 'stat', stat: 'intelligence', amount: 15 },
  },
  {
    id: 'legacy_tutors',
    name: 'Private Tutors',
    description: 'Your heir starts with a further +20 intelligence.',
    cost: 200,
    branch: 'craft',
    requires: 'legacy_education',
    effect: { kind: 'stat', stat: 'intelligence', amount: 20 },
  },
  {
    id: 'legacy_family_library',
    name: 'The Family Library',
    description: 'Three generations of books. Your heir starts with a further +25 intelligence.',
    cost: 650,
    branch: 'craft',
    requires: 'legacy_tutors',
    effect: { kind: 'stat', stat: 'intelligence', amount: 25 },
  },
  {
    id: 'legacy_contentment',
    name: 'A Happy Home',
    description: 'Your heir starts with +15 happiness.',
    cost: 150,
    branch: 'craft',
    effect: { kind: 'stat', stat: 'happiness', amount: 15 },
  },
  {
    id: 'legacy_stability',
    name: 'Unshakeable Stability',
    description: 'Your heir starts with a further +25 happiness.',
    cost: 550,
    branch: 'craft',
    requires: 'legacy_contentment',
    effect: { kind: 'stat', stat: 'happiness', amount: 25 },
  },
];

export function getLegacyUpgrade(id: string): LegacyUpgrade | undefined {
  return LEGACY_UPGRADES.find((u) => u.id === id);
}

/** Nodes on one branch, root first (a branch is a chain, so source order is depth order). */
export function upgradesForBranch(branch: LegacyBranch): LegacyUpgrade[] {
  return LEGACY_UPGRADES.filter((u) => u.branch === branch);
}

/**
 * Is this node's prerequisite satisfied? Roots are always unlocked.
 * Separate from affordability so the UI can distinguish "can't afford yet"
 * from "not available yet" — two different kinds of no.
 */
export function isUpgradeUnlocked(
  id: string,
  owned: readonly string[] | undefined
): boolean {
  const upgrade = getLegacyUpgrade(id);
  if (!upgrade) return false;
  if (!upgrade.requires) return true;
  return Array.isArray(owned) && owned.includes(upgrade.requires);
}

/** Total cost of the whole tree — used by the balance test, and worth stating. */
export function totalLegacyTreeCost(): number {
  return LEGACY_UPGRADES.reduce((sum, u) => sum + u.cost, 0);
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

  // Prerequisite edge. Checked here rather than only in the UI so any other
  // caller (a test, a debug tool, a future deep link) cannot buy a leaf without
  // its root and leave the tree in a state the UI can't render.
  if (upgrade.requires && !current.includes(upgrade.requires)) {
    const parent = getLegacyUpgrade(upgrade.requires);
    return {
      success: false,
      message: `${upgrade.name} needs ${parent?.name ?? 'an earlier upgrade'} first.`,
    };
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
