/**
 * Legacy Contracts — the long-horizon goal the game did not have.
 *
 * ## The gap
 *
 * Nothing in DeepLife takes more than a few hours. Ambitions are consumed
 * permanently across lives (inert after life 8); the 23 scenarios pay out on the
 * FIRST prestige only; weekly challenges rotate on a real-world clock and repeat
 * verbatim after ~3 months; the Life Chapter ladder is exhausted by week ~100.
 * There was no repeatable, scaling, multi-life goal anywhere in the game.
 *
 * ## The design
 *
 * Contracts are multi-life objectives that persist across prestige and escalate
 * in tiers. They pay **Legacy Points**, which the Dynasty Tree spends — so this
 * creates the demand for the supply that tree provides, and the two compose into
 * an actual economy rather than two disconnected screens.
 *
 * ## Why progress is DERIVED, not accumulated
 *
 * Every contract reads a value the save already tracks and only ever increases
 * (lifetime totals, prestige counts, dynasty generations). So progress is a pure
 * function of state and needs no per-week bookkeeping: nothing can drift, and a
 * contract cannot be double-credited by a tick that runs twice.
 *
 * The ONLY thing stored is which contracts have been claimed — `claimedIds` on
 * `GameState.legacyContracts`. That is also why a partially-progressed contract
 * survives a prestige for free: the metric it reads is cross-life already.
 */

import type { GameState } from '@/contexts/game/types';
import { hasSeatWing } from '@/lib/dynasty/seat';

export type ContractMetric =
  | 'totalPrestiges'
  | 'generations'
  | 'lifetimeEarnings'
  | 'peakNetWorth'
  | 'weeksLivedTotal'
  | 'companiesFounded';

export interface LegacyContract {
  id: string;
  name: string;
  description: string;
  metric: ContractMetric;
  /** Value of the metric at which the contract completes. */
  target: number;
  /** Legacy Points paid on claim. */
  reward: number;
  /** Tier within its metric chain — display only, ascending. */
  tier: number;
}

/**
 * Deliberately escalating and deliberately unbounded at the top.
 *
 * The largest targets here are NOT meant to be finished in a session — that is
 * the whole point of the item. "Reach 25 prestiges" is the ten-hour goal the
 * depth audit found missing.
 */
export const LEGACY_CONTRACTS: LegacyContract[] = [
  // ── Lineage ───────────────────────────────────────────────────────────────
  { id: 'contract_prestige_1', name: 'Begin Again', description: 'Prestige for the first time.', metric: 'totalPrestiges', target: 1, reward: 50, tier: 1 },
  { id: 'contract_prestige_5', name: 'A Practised Hand', description: 'Prestige 5 times.', metric: 'totalPrestiges', target: 5, reward: 250, tier: 2 },
  { id: 'contract_prestige_10', name: 'Cycle Master', description: 'Prestige 10 times.', metric: 'totalPrestiges', target: 10, reward: 700, tier: 3 },
  { id: 'contract_prestige_25', name: 'The Long Game', description: 'Prestige 25 times.', metric: 'totalPrestiges', target: 25, reward: 2_500, tier: 4 },

  // ── Dynasty ───────────────────────────────────────────────────────────────
  { id: 'contract_gen_3', name: 'Three Generations', description: 'Carry the family to a third generation.', metric: 'generations', target: 3, reward: 100, tier: 1 },
  { id: 'contract_gen_10', name: 'An Old Family', description: 'Carry the family to a tenth generation.', metric: 'generations', target: 10, reward: 600, tier: 2 },
  { id: 'contract_gen_25', name: 'Unbroken Line', description: 'Carry the family to a twenty-fifth generation.', metric: 'generations', target: 25, reward: 2_000, tier: 3 },

  // ── Wealth ────────────────────────────────────────────────────────────────
  { id: 'contract_networth_10m', name: 'Eight Figures', description: 'Reach $10,000,000 net worth in a single life.', metric: 'peakNetWorth', target: 10_000_000, reward: 120, tier: 1 },
  { id: 'contract_networth_100m', name: 'Nine Figures', description: 'Reach $100,000,000 net worth in a single life.', metric: 'peakNetWorth', target: 100_000_000, reward: 500, tier: 2 },
  { id: 'contract_networth_1b', name: 'Ten Figures', description: 'Reach $1,000,000,000 net worth in a single life.', metric: 'peakNetWorth', target: 1_000_000_000, reward: 1_800, tier: 3 },

  // ── Endurance ─────────────────────────────────────────────────────────────
  { id: 'contract_weeks_2000', name: 'A Long Life', description: 'Live 2,000 weeks across every life.', metric: 'weeksLivedTotal', target: 2_000, reward: 150, tier: 1 },
  { id: 'contract_weeks_10000', name: 'Time Served', description: 'Live 10,000 weeks across every life.', metric: 'weeksLivedTotal', target: 10_000, reward: 900, tier: 2 },

  // ── Enterprise ────────────────────────────────────────────────────────────
  { id: 'contract_companies_5', name: 'Founder', description: 'Found 5 companies across every life.', metric: 'companiesFounded', target: 5, reward: 120, tier: 1 },
  { id: 'contract_companies_20', name: 'Serial Founder', description: 'Found 20 companies across every life.', metric: 'companiesFounded', target: 20, reward: 800, tier: 2 },
];

/**
 * The Archive Contracts — what the Dynasty Seat's Archive wing (prestige tier
 * 5) opens.
 *
 * Deliberately beyond the board above by an order of magnitude. The top of the
 * standard ladder is "prestige 25 times"; the Archive starts where that ends,
 * and its wealth target is a number the game has no other reason to name. That
 * is the point of a capstone: the ceiling should be visible and not yet
 * reached.
 *
 * They are NEW contracts, not existing ones moved behind the wing. Nobody's
 * board shrinks when the Archive is unbuilt — it simply has three fewer rows
 * than it will have later.
 */
export const ARCHIVE_CONTRACT_WING = 'seat_archive';

export const ARCHIVE_CONTRACTS: LegacyContract[] = [
  { id: 'contract_archive_prestige_50', name: 'The Fiftieth Turn', description: 'Prestige 50 times.', metric: 'totalPrestiges', target: 50, reward: 6_000, tier: 5 },
  { id: 'contract_archive_gen_50', name: 'Fifty Generations', description: 'Carry the family to a fiftieth generation.', metric: 'generations', target: 50, reward: 5_000, tier: 4 },
  { id: 'contract_archive_networth_1t', name: 'Thirteen Figures', description: 'Reach $1,000,000,000,000 net worth in a single life.', metric: 'peakNetWorth', target: 1_000_000_000_000, reward: 8_000, tier: 4 },
];

/**
 * The contracts a given save can see.
 *
 * A save without the Archive wing sees exactly the board it saw before the wing
 * existed — the Archive rows are additive, never a replacement.
 */
export function visibleContracts(state: GameState | undefined | null): LegacyContract[] {
  return hasSeatWing(state, ARCHIVE_CONTRACT_WING)
    ? [...LEGACY_CONTRACTS, ...ARCHIVE_CONTRACTS]
    : LEGACY_CONTRACTS;
}

/** Lookup across BOTH boards — a claimed Archive id must still resolve. */
function findContract(contractId: string): LegacyContract | undefined {
  return (
    LEGACY_CONTRACTS.find((c) => c.id === contractId) ??
    ARCHIVE_CONTRACTS.find((c) => c.id === contractId)
  );
}

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * Read a contract metric off the save.
 *
 * Every one of these is cross-life and monotonically increasing, which is what
 * makes derived progress safe. Missing fields read as 0 rather than NaN.
 */
export function readMetric(state: GameState | undefined | null, metric: ContractMetric): number {
  if (!state) return 0;
  const lifetime = state.prestige?.lifetimeStats as Record<string, unknown> | undefined;

  switch (metric) {
    case 'totalPrestiges':
      return num(state.prestige?.totalPrestiges);
    case 'generations':
      return Math.max(num(state.generationNumber), num(state.dynastyStats?.totalGenerations));
    case 'lifetimeEarnings':
      return num(state.lifetimeStatistics?.totalMoneyEarned);
    case 'peakNetWorth':
      // Lives on `lifetimeStatistics`, not `statistics` — and it is a PEAK, so
      // it survives a crash back to zero, which is what makes it a fair target.
      return num(state.lifetimeStatistics?.peakNetWorth);
    case 'weeksLivedTotal':
      // Lifetime total when present, else this life — never less than this life,
      // so the bar cannot go backwards on a save that lacks the lifetime field.
      return Math.max(num(lifetime?.totalWeeksLived), num(state.weeksLived));
    case 'companiesFounded':
      return Math.max(
        num(state.lifetimeStatistics?.totalCompaniesOwned),
        (state.companies ?? []).length
      );
    default:
      return 0;
  }
}

export interface ContractProgress {
  contract: LegacyContract;
  current: number;
  target: number;
  /** 0..1 */
  progress: number;
  complete: boolean;
  claimed: boolean;
  /** Complete AND not yet claimed — the only state where a button should act. */
  claimable: boolean;
}

export function getContractProgress(
  state: GameState | undefined | null,
  contract: LegacyContract
): ContractProgress {
  const current = readMetric(state, contract.metric);
  const claimed = (state?.legacyContracts?.claimedIds ?? []).includes(contract.id);
  const complete = current >= contract.target;
  return {
    contract,
    current,
    target: contract.target,
    progress: contract.target > 0 ? Math.max(0, Math.min(1, current / contract.target)) : 0,
    complete,
    claimed,
    claimable: complete && !claimed,
  };
}

/** Every contract this save can see, in catalogue order. */
export function getAllContractProgress(state: GameState | undefined | null): ContractProgress[] {
  return visibleContracts(state).map((c) => getContractProgress(state, c));
}

/** Contracts that can be claimed right now. */
export function getClaimableContracts(state: GameState | undefined | null): ContractProgress[] {
  return getAllContractProgress(state).filter((p) => p.claimable);
}

export interface ClaimResult {
  success: boolean;
  message: string;
  /** Legacy points to award. 0 when the claim was refused. */
  reward: number;
  /** New claimed list, when the claim landed. */
  claimedIds?: string[];
}

/**
 * Claim a completed contract.
 *
 * A PURE reducer over state + id, mirroring `purchaseLegacyUpgrade`, so the
 * caller can run it for the report and again inside the updater without risk —
 * owning the id is what blocks the second run, so it cannot double-pay.
 */
export function claimContract(
  state: GameState | undefined | null,
  contractId: string
): ClaimResult {
  const contract = findContract(contractId);
  if (!contract) return { success: false, message: 'Unknown contract.', reward: 0 };

  // An Archive contract is only claimable while the wing that opened it stands.
  // Checked here rather than only in the UI so no other caller can claim a row
  // the player cannot see.
  if (
    ARCHIVE_CONTRACTS.some((c) => c.id === contractId) &&
    !hasSeatWing(state, ARCHIVE_CONTRACT_WING)
  ) {
    return { success: false, message: 'The Archive is not built.', reward: 0 };
  }

  const claimedIds = state?.legacyContracts?.claimedIds ?? [];
  if (claimedIds.includes(contractId)) {
    return { success: false, message: `${contract.name} is already claimed.`, reward: 0 };
  }

  const progress = getContractProgress(state, contract);
  if (!progress.complete) {
    return {
      success: false,
      message: `${contract.name}: ${progress.current.toLocaleString()} / ${contract.target.toLocaleString()}.`,
      reward: 0,
    };
  }

  return {
    success: true,
    message: `${contract.name} complete — ${contract.reward.toLocaleString()} legacy points.`,
    reward: contract.reward,
    claimedIds: [...claimedIds, contractId],
  };
}

/** Total points the whole contract board can ever pay, Archive included or not. */
export function totalContractRewards(includeArchive = false): number {
  const board = includeArchive ? [...LEGACY_CONTRACTS, ...ARCHIVE_CONTRACTS] : LEGACY_CONTRACTS;
  return board.reduce((sum, c) => sum + c.reward, 0);
}
