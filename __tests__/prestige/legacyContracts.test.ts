/**
 * Legacy Contracts (STATE_VERSION 33) — the long-horizon goal the game lacked.
 *
 * Nothing in DeepLife took more than a few hours: ambitions are consumed
 * permanently across lives (inert after life 8), the 23 scenarios pay out on
 * the FIRST prestige only, weekly challenges rotate on a real-world clock and
 * repeat verbatim, and the Life Chapter ladder is exhausted by week ~100.
 *
 * Two design decisions are worth pinning:
 *
 * 1. **Progress is DERIVED, not stored.** Every metric is a value the save
 *    already tracks and that only ever increases, so nothing can drift, a tick
 *    that runs twice cannot double-credit, and an existing save loads with its
 *    contracts already part-complete instead of reset to zero.
 * 2. **Only claimed ids are stored**, with a concrete default — so this takes a
 *    REAL migration backfill and a `repairGameState` mirror (CLAUDE.md §7).
 */

import {
  LEGACY_CONTRACTS,
  readMetric,
  getContractProgress,
  getAllContractProgress,
  getClaimableContracts,
  claimContract,
  totalContractRewards,
} from '@/lib/legacy/contracts';
import { STATE_VERSION, initialGameState } from '@/contexts/game/initialState';
import { CURRENT_STATE_VERSION, runMigrations } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { DEFAULT_DYNASTY_STATS } from '@/lib/legacy/dynasty';

/**
 * Build a state by MUTATING a factory instance rather than spreading over it
 * behind an `as GameState`. Hard Rule #3's static guard flags that cast, and
 * rightly: a spread-and-cast is exactly how a test ends up asserting on a shape
 * that no longer matches GameState.
 */
/** Read the field off a raw migrated/repaired object without asserting a shape. */
const readContracts = (o: unknown): { claimedIds: string[] } | undefined =>
  (o as { legacyContracts?: { claimedIds: string[] } })?.legacyContracts;

const withState = (mutate: (s: GameState) => void): GameState => {
  const state = createTestGameState();
  mutate(state);
  return state;
};

describe('catalogue integrity', () => {
  it('uses unique ids and names', () => {
    expect(new Set(LEGACY_CONTRACTS.map((c) => c.id)).size).toBe(LEGACY_CONTRACTS.length);
    expect(new Set(LEGACY_CONTRACTS.map((c) => c.name)).size).toBe(LEGACY_CONTRACTS.length);
  });

  it('every contract has a positive target and reward', () => {
    for (const c of LEGACY_CONTRACTS) {
      expect(`${c.id}:${c.target > 0 && c.reward > 0}`).toBe(`${c.id}:true`);
    }
  });

  it('targets escalate with tier within a metric chain', () => {
    const byMetric = new Map<string, typeof LEGACY_CONTRACTS>();
    for (const c of LEGACY_CONTRACTS) {
      byMetric.set(c.metric, [...(byMetric.get(c.metric) ?? []), c]);
    }
    for (const [metric, chain] of byMetric) {
      const sorted = [...chain].sort((a, b) => a.tier - b.tier);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(`${metric}:${sorted[i].target > sorted[i - 1].target}`).toBe(`${metric}:true`);
        // A harder contract must also pay more, or the tier is a downgrade.
        expect(`${metric}:${sorted[i].reward > sorted[i - 1].reward}`).toBe(`${metric}:true`);
      }
    }
  });

  it('pays enough in total to matter against the Dynasty Tree it feeds', () => {
    // The tree costs ~8,700. Contracts should be a meaningful fraction of that,
    // or claiming them is a rounding error rather than a goal.
    expect(totalContractRewards()).toBeGreaterThan(3_000);
  });

  it('includes at least one genuinely long-haul target', () => {
    // The whole point of the item: something that cannot be done in a session.
    const longest = LEGACY_CONTRACTS.filter((c) => c.metric === 'totalPrestiges')
      .map((c) => c.target)
      .sort((a, b) => b - a)[0];
    expect(longest).toBeGreaterThanOrEqual(25);
  });
});

describe('reading metrics', () => {
  it('returns 0 for a missing or corrupt state rather than NaN', () => {
    for (const metric of ['totalPrestiges', 'generations', 'peakNetWorth'] as const) {
      expect(`${metric}:${readMetric(undefined, metric)}`).toBe(`${metric}:0`);
      expect(`${metric}:${readMetric(null, metric)}`).toBe(`${metric}:0`);
    }
  });

  it('reads prestige count', () => {
    expect(readMetric(withState((s) => { s.prestige!.totalPrestiges = 7; }), 'totalPrestiges')).toBe(7);
  });

  it('reads the higher of generationNumber and dynasty generations', () => {
    const s = withState((s) => { s.generationNumber = 3; s.dynastyStats = { ...(s.dynastyStats ?? DEFAULT_DYNASTY_STATS), totalGenerations: 9 }; });
    expect(readMetric(s, 'generations')).toBe(9);
  });

  it('never reports fewer weeks than this life', () => {
    // A save whose lifetime total lags this life must not show a bar going
    // backwards. `lifetimeStats` is non-optional on PrestigeData, so the
    // realistic case is a STALE total, not a missing one.
    const s = withState((s) => {
      s.weeksLived = 900;
      s.prestige!.lifetimeStats.totalWeeksLived = 100;
    });
    expect(readMetric(s, 'weeksLivedTotal')).toBe(900);
  });

  it('treats a negative or NaN metric as 0', () => {
    const s = withState((s) => { s.prestige!.totalPrestiges = -5; });
    expect(readMetric(s, 'totalPrestiges')).toBe(0);
  });
});

describe('progress and claiming', () => {
  const contract = LEGACY_CONTRACTS.find((c) => c.id === 'contract_prestige_5')!;

  it('is incomplete below the target', () => {
    const p = getContractProgress(withState((s) => { s.prestige!.totalPrestiges = 2; }), contract);
    expect(p.complete).toBe(false);
    expect(p.claimable).toBe(false);
    expect(p.progress).toBeCloseTo(2 / 5, 5);
  });

  it('completes at the target and becomes claimable', () => {
    const p = getContractProgress(withState((s) => { s.prestige!.totalPrestiges = 5; }), contract);
    expect(p.complete).toBe(true);
    expect(p.claimable).toBe(true);
    expect(p.progress).toBe(1);
  });

  it('clamps progress to 1 well past the target', () => {
    const p = getContractProgress(withState((s) => { s.prestige!.totalPrestiges = 500; }), contract);
    expect(p.progress).toBe(1);
  });

  it('refuses a claim that is not complete', () => {
    const r = claimContract(withState((s) => { s.prestige!.totalPrestiges = 1; }), contract.id);
    expect(r.success).toBe(false);
    expect(r.reward).toBe(0);
    expect(r.claimedIds).toBeUndefined();
  });

  it('pays exactly once — the second run is a rejection', () => {
    // The property the action depends on: it runs the reducer for the report
    // and again inside the updater, so a double-tap must not pay twice.
    const state = withState((s) => { s.prestige!.totalPrestiges = 5; });
    const first = claimContract(state, contract.id);
    expect(first.success).toBe(true);
    expect(first.reward).toBe(contract.reward);

    const after = withState((s2) => {
      s2.prestige!.totalPrestiges = 5;
      s2.legacyContracts = { claimedIds: first.claimedIds! };
    });
    const second = claimContract(after, contract.id);
    expect(second.success).toBe(false);
    expect(second.reward).toBe(0);
  });

  it('refuses an unknown id', () => {
    expect(claimContract(withState(() => {}), 'nope').success).toBe(false);
  });

  it('a claimed contract stops being claimable but stays complete', () => {
    const state = withState((s) => { s.prestige!.totalPrestiges = 5; s.legacyContracts = { claimedIds: [contract.id] }; });
    const p = getContractProgress(state, contract);
    expect(p.complete).toBe(true);
    expect(p.claimed).toBe(true);
    expect(p.claimable).toBe(false);
  });

  it('getClaimableContracts returns only complete, unclaimed ones', () => {
    const state = withState((s) => { s.prestige!.totalPrestiges = 5; });
    const claimable = getClaimableContracts(state).map((p) => p.contract.id);
    expect(claimable).toContain('contract_prestige_1');
    expect(claimable).toContain('contract_prestige_5');
    expect(claimable).not.toContain('contract_prestige_25');
  });

  it('handles a state with no contracts record at all', () => {
    const s = withState((s) => { s.prestige!.totalPrestiges = 5; s.legacyContracts = undefined; });
    expect(() => getAllContractProgress(s)).not.toThrow();
    expect(getContractProgress(s, contract).claimed).toBe(false);
  });
});

describe('the save format (v33)', () => {
  it('the field ships in initialState with a concrete default', () => {
    expect(initialGameState.legacyContracts).toEqual({ claimedIds: [] });
    expect(STATE_VERSION).toBe(CURRENT_STATE_VERSION);
    expect(STATE_VERSION).toBeGreaterThanOrEqual(33);
  });

  it('the test factory inherits it, so no test hand-builds the field', () => {
    expect(createTestGameState().legacyContracts).toEqual({ claimedIds: [] });
  });

  it('a v32 save is backfilled — it is NOT a carve-out field', () => {
    const old = { ...initialGameState, version: 32 } as unknown as Record<string, unknown>;
    delete old.legacyContracts;

    const { state } = runMigrations(old as never);

    expect(readContracts(state)).toEqual({ claimedIds: [] });
    expect((state as { version?: number }).version).toBe(CURRENT_STATE_VERSION);
  });

  it('a save that already has claims keeps them', () => {
    const old = {
      ...initialGameState,
      version: 32,
      legacyContracts: { claimedIds: ['contract_prestige_1'] },
    } as unknown as Record<string, unknown>;

    const { state } = runMigrations(old as never);

    expect(readContracts(state)?.claimedIds).toEqual(['contract_prestige_1']);
  });

  it('repairGameState mirrors the migration for a PARTIAL save', () => {
    // The parity CLAUDE.md §7 warns is not checked by the static audit.
    const partial = { ...initialGameState } as unknown as Record<string, unknown>;
    delete partial.legacyContracts;

    const result = repairGameState(partial as never);

    expect(readContracts(partial)).toEqual({ claimedIds: [] });
    // And the repair reports itself, so the clone is actually written back.
    expect(result.repaired).toBe(true);
  });

  it('repairs a structurally wrong value, not just a missing one', () => {
    const broken = { ...initialGameState, legacyContracts: 'nonsense' } as unknown as Record<string, unknown>;

    repairGameState(broken as never);

    expect(readContracts(broken)).toEqual({ claimedIds: [] });
  });
});
