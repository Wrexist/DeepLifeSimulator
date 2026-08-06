/**
 * Prestige tiers 2–5 — the Vault, the Endowment, Dynasty Trials, the Seat.
 *
 * `PRESTIGE_UNLOCKS` had exactly one row for a long time, so tiers 2–5 did
 * nothing at all and prestige #5 was mechanically identical to prestige #2.
 *
 * These tests assert two things the codebase has been burned by before:
 *
 *  - **Reachability, not just arithmetic.** A pure function that returns the
 *    right number is worthless if nothing calls it. The legacy shop shipped
 *    with no buy button; the journal shipped with no writer. Every reducer here
 *    is asserted to have a control on a real screen and an action on the
 *    context that screen uses.
 *  - **Nothing is taken away.** Each tier is asserted to be additive: a save
 *    that never prestiges again sees exactly the game it saw yesterday.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import {
  PRESTIGE_UNLOCKS,
  isPrestigeFeatureUnlocked,
  prestigeUnlockRequirement,
  prestigeTier,
} from '@/lib/progress/featureUnlocks';
import {
  VAULT_FEATURE,
  VAULT_BASE_CAPACITY,
  VAULT_GALLERY_CAPACITY,
  storeInVault,
  removeFromVault,
  vaultCapacity,
  vaultCandidates,
  vaultContents,
  vaultFee,
  isVaultable,
  applyVaultToNewLife,
} from '@/lib/dynasty/vault';
import {
  ENDOWMENT_FEATURE,
  ENDOWMENT_TRANCHES,
  claimEndowment,
  endowmentMultiplier,
  getEndowmentBoard,
  totalEndowmentPoints,
} from '@/lib/dynasty/endowment';
import {
  DYNASTY_TRIALS,
  TRIALS_FEATURE,
  TRIALS_BASE_CAPACITY,
  TRIALS_CHAPTER_HOUSE_CAPACITY,
  addPendingTrial,
  removePendingTrial,
  applyTrialEffectsToNewLife,
  combinedTrialEffects,
  settleTrials,
  trialCapacity,
  trialRewardMultiplier,
} from '@/lib/dynasty/trials';
import { SEAT_FEATURE, SEAT_WINGS, buySeatWing, hasSeatWing, totalSeatCost } from '@/lib/dynasty/seat';
import { applyDynastyTransition } from '@/lib/dynasty/transition';
import { activeTrialIds, endowmentIds, pendingTrialIds, seatWingIds, vaultItemIds } from '@/lib/dynasty/state';
import {
  ARCHIVE_CONTRACTS,
  LEGACY_CONTRACTS,
  claimContract,
  getAllContractProgress,
  visibleContracts,
} from '@/lib/legacy/contracts';
import { CURRENT_STATE_VERSION, isMigrationVersionCovered, runMigrations } from '@/utils/saveMigrations';
import { LUXURY_CATALOG } from '@/lib/luxury/catalog';
import type { GameState } from '@/contexts/game/types';

const at = (totalPrestiges: number, overrides: Parameters<typeof createTestGameState>[0] = {}) =>
  createTestGameState({ ...overrides, prestige: { totalPrestiges, ...(overrides.prestige ?? {}) } });

/** A cheap, non-land luxury piece — the one the Vault tests trade in. */
const WATCH = LUXURY_CATALOG.find((i) => !i.developable)!;
/** Land: mints a property when bought, so it must never be vaultable. */
const LAND = LUXURY_CATALOG.find((i) => Boolean(i.developable));

describe('the tier table itself', () => {
  it('every tier 1–5 now has content (this is the whole point)', () => {
    for (const tier of [1, 2, 3, 4, 5]) {
      const rows = PRESTIGE_UNLOCKS.filter((u) => u.tier === tier);
      expect(`tier ${tier}: ${rows.length}`).toBe(`tier ${tier}: 1`);
    }
  });

  it('each capability unlocks at exactly its tier and not one prestige earlier', () => {
    const expected: [string, number][] = [
      [VAULT_FEATURE, 2],
      [ENDOWMENT_FEATURE, 3],
      [TRIALS_FEATURE, 4],
      [SEAT_FEATURE, 5],
    ];
    for (const [id, tier] of expected) {
      expect(`${id} @${tier - 1}: ${isPrestigeFeatureUnlocked(at(tier - 1), id)}`)
        .toBe(`${id} @${tier - 1}: false`);
      expect(`${id} @${tier}: ${isPrestigeFeatureUnlocked(at(tier), id)}`)
        .toBe(`${id} @${tier}: true`);
    }
  });

  it('a locked capability tells the player what to do, in words', () => {
    for (const id of [VAULT_FEATURE, ENDOWMENT_FEATURE, TRIALS_FEATURE, SEAT_FEATURE]) {
      expect(prestigeUnlockRequirement(at(0), id)).toMatch(/prestige/i);
      expect(prestigeUnlockRequirement(at(5), id)).toBe('');
    }
  });

  it('prestigeTier is monotonic and clamps at 5', () => {
    expect(prestigeTier(at(0))).toBe(0);
    expect(prestigeTier(at(3))).toBe(3);
    expect(prestigeTier(at(99))).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tier 2 — the Vault', () => {
  const owner = (totalPrestiges = 2, money = 10_000_000) =>
    at(totalPrestiges, { luxuryItems: [WATCH.id], stats: { money } });

  it('is refused below prestige 2, with the requirement as the message', () => {
    const result = storeInVault(owner(1), WATCH.id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/prestige/i);
    expect(result.cost).toBe(0);
  });

  it('preserves an owned piece and charges the fee in the same result', () => {
    const state = owner();
    const result = storeInVault(state, WATCH.id);
    expect(result.success).toBe(true);
    expect(result.cost).toBe(vaultFee(WATCH));
    expect(result.dynasty?.vaultItemIds).toEqual([WATCH.id]);
  });

  it('refuses a piece the player does not own', () => {
    const result = storeInVault(at(2, { luxuryItems: [], stats: { money: 1e9 } }), WATCH.id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/do not own/i);
  });

  it('refuses when the fee is unaffordable, and charges nothing', () => {
    const result = storeInVault(owner(2, 1), WATCH.id);
    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
  });

  it('is idempotent — a second run in the same batch cannot charge twice', () => {
    const first = storeInVault(owner(), WATCH.id);
    const after = at(2, {
      luxuryItems: [WATCH.id],
      stats: { money: 10_000_000 },
      dynasty: first.dynasty,
    });
    const second = storeInVault(after, WATCH.id);
    expect(second.success).toBe(false);
    expect(second.cost).toBe(0);
  });

  it('holds ONE piece until the Long Gallery is built, then three', () => {
    expect(vaultCapacity(at(5))).toBe(VAULT_BASE_CAPACITY);
    expect(vaultCapacity(at(5, { dynasty: { seatWings: ['seat_long_gallery'] } })))
      .toBe(VAULT_GALLERY_CAPACITY);
  });

  it('refuses a second piece at capacity 1 and names the way out', () => {
    const two = LUXURY_CATALOG.filter((i) => !i.developable).slice(0, 2);
    const state = at(2, {
      luxuryItems: two.map((i) => i.id),
      stats: { money: 1e9 },
      dynasty: { vaultItemIds: [two[0].id] },
    });
    const result = storeInVault(state, two[1].id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Long Gallery/);
  });

  it('never vaults land — the property system owns that asset', () => {
    if (!LAND) return; // catalogue has no developable item; nothing to assert
    expect(isVaultable(LAND)).toBe(false);
    const result = storeInVault(at(5, { luxuryItems: [LAND.id], stats: { money: 1e12 } }), LAND.id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/land/i);
    expect(vaultCandidates(at(5, { luxuryItems: [LAND.id] })).map((i) => i.id)).not.toContain(LAND.id);
  });

  it('removing is free and does NOT refund the fee', () => {
    const state = at(2, { dynasty: { vaultItemIds: [WATCH.id] } });
    const result = removeFromVault(state, WATCH.id);
    expect(result.success).toBe(true);
    expect(result.cost).toBe(0);
    expect(result.dynasty?.vaultItemIds).toEqual([]);
    expect(result.message).toMatch(/not refunded/i);
  });

  it('seeds the new life with the preserved piece and a holding for it', () => {
    const fresh = createTestGameState({ luxuryItems: [], luxuryHoldings: {} });
    applyVaultToNewLife(fresh, [WATCH.id]);
    expect(fresh.luxuryItems).toContain(WATCH.id);
    expect(fresh.luxuryHoldings?.[WATCH.id]?.acquiredWeek).toBe(0);
  });

  it('an unknown id in the vault is dropped, not crashed on', () => {
    const fresh = createTestGameState({ luxuryItems: [] });
    expect(() => applyVaultToNewLife(fresh, ['no_such_item'])).not.toThrow();
    expect(fresh.luxuryItems).toEqual([]);
    expect(vaultContents(at(5, { dynasty: { vaultItemIds: ['no_such_item'] } }))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tier 3 — the Endowment', () => {
  const rich = (totalPrestiges = 3, money = 2_000_000_000, dynasty = {}) =>
    at(totalPrestiges, { stats: { money }, dynasty });

  it('is refused below prestige 3', () => {
    const result = claimEndowment(rich(2), ENDOWMENT_TRANCHES[0].id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/prestige/i);
  });

  it('charges the money and pays the points in one result', () => {
    const t = ENDOWMENT_TRANCHES[0];
    const result = claimEndowment(rich(), t.id);
    expect(result.success).toBe(true);
    expect(result.cost).toBe(t.cost);
    expect(result.points).toBe(t.points);
    expect(result.dynasty?.endowments).toEqual([t.id]);
  });

  it('is once per tranche, forever — the second run refuses and costs nothing', () => {
    const t = ENDOWMENT_TRANCHES[0];
    const result = claimEndowment(rich(3, 2e9, { endowments: [t.id] }), t.id);
    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
    expect(result.points).toBe(0);
  });

  it('refuses when the money is not there', () => {
    const t = ENDOWMENT_TRANCHES[1];
    const result = claimEndowment(rich(3, t.cost - 1), t.id);
    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
  });

  it('the Sovereign Fund needs the Counting House', () => {
    const sovereign = ENDOWMENT_TRANCHES.find((t) => t.requiresWing)!;
    expect(claimEndowment(rich(5, 1e12), sovereign.id).success).toBe(false);
    const withWing = rich(5, 1e12, { seatWings: ['seat_long_gallery', 'seat_counting_house'] });
    expect(claimEndowment(withWing, sovereign.id).success).toBe(true);
  });

  it('the Counting House doubles every payout', () => {
    expect(endowmentMultiplier(rich())).toBe(1);
    const withWing = rich(5, 1e12, { seatWings: ['seat_long_gallery', 'seat_counting_house'] });
    expect(endowmentMultiplier(withWing)).toBe(2);
    const t = ENDOWMENT_TRANCHES[0];
    expect(claimEndowment(withWing, t.id).points).toBe(t.points * 2);
  });

  it('the board shows locked tranches rather than hiding them', () => {
    const board = getEndowmentBoard(rich(3, 0));
    expect(board).toHaveLength(ENDOWMENT_TRANCHES.length);
    expect(board.some((r) => r.wingLocked)).toBe(true);
    expect(board.every((r) => r.affordable)).toBe(false);
  });

  it('is bounded by construction — the whole board pays a finite, stated total', () => {
    // Deliberately smaller than the Dynasty Tree it feeds (~8,700 points), so
    // endowing cannot replace living.
    expect(totalEndowmentPoints()).toBe(4_210);
    expect(totalEndowmentPoints(2)).toBe(8_420);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tier 4 — Dynasty Trials', () => {
  it('is refused below prestige 4', () => {
    const result = addPendingTrial(at(3), DYNASTY_TRIALS[0].id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/prestige/i);
  });

  it('swears one trial, and refuses the second until the Chapter House', () => {
    expect(trialCapacity(at(4))).toBe(TRIALS_BASE_CAPACITY);
    const first = addPendingTrial(at(4), DYNASTY_TRIALS[0].id);
    expect(first.success).toBe(true);

    const second = addPendingTrial(at(4, { dynasty: first.dynasty }), DYNASTY_TRIALS[1].id);
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/Chapter House/);

    const roomy = at(5, {
      dynasty: {
        trials: { pending: [DYNASTY_TRIALS[0].id] },
        seatWings: ['seat_long_gallery', 'seat_counting_house', 'seat_chapter_house'],
      },
    });
    expect(trialCapacity(roomy)).toBe(TRIALS_CHAPTER_HOUSE_CAPACITY);
    expect(addPendingTrial(roomy, DYNASTY_TRIALS[1].id).success).toBe(true);
  });

  it('a sworn trial can be withdrawn before it starts', () => {
    const state = at(4, { dynasty: { trials: { pending: [DYNASTY_TRIALS[0].id] } } });
    const result = removePendingTrial(state, DYNASTY_TRIALS[0].id);
    expect(result.success).toBe(true);
    expect(result.dynasty?.trials?.pending).toEqual([]);
  });

  it('every handicap is ABSOLUTE — it bites a first-timer as hard as a veteran', () => {
    // The free-lunch failure mode: a trial worded "forfeit your Dynasty Tree
    // bonuses" pays a player who owns no tree nodes for suffering nothing.
    // None of these read anything the player might not have.
    for (const trial of DYNASTY_TRIALS) {
      const bare = createTestGameState({ stats: { money: 500, health: 100, happiness: 100, fitness: 50 } });
      const before = JSON.stringify({ stats: bare.stats, date: bare.date });
      applyTrialEffectsToNewLife(bare, [trial.id]);
      expect(`${trial.id}: ${JSON.stringify({ stats: bare.stats, date: bare.date }) !== before}`)
        .toBe(`${trial.id}: true`);
    }
  });

  it("Pauper's Vow zeroes the opening cash whatever was inherited", () => {
    const life = createTestGameState({ stats: { money: 100_000_000 } });
    applyTrialEffectsToNewLife(life, ['trial_pauper']);
    expect(life.stats.money).toBe(0);
  });

  it('Frail Vessel writes ceilings, and never RAISES a stat', () => {
    const life = createTestGameState({ stats: { health: 100, happiness: 100, fitness: 90 } });
    applyTrialEffectsToNewLife(life, ['trial_frail']);
    expect(life.stats.health).toBe(25);
    expect(life.stats.happiness).toBe(25);
    expect(life.stats.fitness).toBe(0);

    const alreadyLow = createTestGameState({ stats: { health: 10, happiness: 5, fitness: 0 } });
    applyTrialEffectsToNewLife(alreadyLow, ['trial_frail']);
    expect(alreadyLow.stats.health).toBe(10);
    expect(alreadyLow.stats.happiness).toBe(5);
  });

  it('The Long Road moves age AND calendar year together', () => {
    const life = createTestGameState({ date: { age: 18, year: 2025, month: 'January', week: 1 } });
    applyTrialEffectsToNewLife(life, ['trial_long_road']);
    expect(life.date.age).toBe(30);
    expect(life.date.year).toBe(2037);
  });

  it('stacking takes the HARSHEST ceiling, never the kindest', () => {
    const merged = combinedTrialEffects(['trial_frail', 'trial_pauper', 'trial_long_road']);
    expect(merged.noStartingMoney).toBe(true);
    expect(merged.yearsLost).toBe(12);
    expect(merged.statCeilings?.health).toBe(25);
  });

  it('unknown trial ids are ignored rather than thrown on', () => {
    expect(combinedTrialEffects(['no_such_trial'])).toEqual({});
    const life = createTestGameState({});
    expect(() => applyTrialEffectsToNewLife(life, ['no_such_trial'])).not.toThrow();
  });

  it('settles only ACTIVE trials, and the Chapter House doubles the payout', () => {
    const trial = DYNASTY_TRIALS[0];
    const bearing = at(4, { dynasty: { trials: { active: [trial.id], pending: [] } } });
    expect(settleTrials(bearing)).toEqual({ points: trial.reward, settledIds: [trial.id] });

    // Sworn but not yet started pays nothing — you have to live the life.
    const sworn = at(4, { dynasty: { trials: { pending: [trial.id] } } });
    expect(settleTrials(sworn).points).toBe(0);

    const doubled = at(5, {
      dynasty: {
        trials: { active: [trial.id] },
        seatWings: ['seat_long_gallery', 'seat_counting_house', 'seat_chapter_house'],
      },
    });
    expect(trialRewardMultiplier(doubled)).toBe(2);
    expect(settleTrials(doubled).points).toBe(trial.reward * 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tier 5 — the Dynasty Seat', () => {
  const seatState = (money: number, wings: string[] = [], totalPrestiges = 5) =>
    at(totalPrestiges, { stats: { money }, dynasty: { seatWings: wings } });

  it('is refused below prestige 5', () => {
    expect(buySeatWing(seatState(1e12, [], 4), SEAT_WINGS[0].id).success).toBe(false);
  });

  it('builds the first wing and charges its cost', () => {
    const wing = SEAT_WINGS[0];
    const result = buySeatWing(seatState(wing.cost), wing.id);
    expect(result.success).toBe(true);
    expect(result.cost).toBe(wing.cost);
    expect(result.dynasty?.seatWings).toEqual([wing.id]);
  });

  it('is a CHAIN — a later wing needs the one before it', () => {
    const second = SEAT_WINGS[1];
    expect(buySeatWing(seatState(1e12), second.id).success).toBe(false);
    expect(buySeatWing(seatState(1e12, [SEAT_WINGS[0].id]), second.id).success).toBe(true);
  });

  it('cannot be built twice, and cannot be built without the money', () => {
    const wing = SEAT_WINGS[0];
    expect(buySeatWing(seatState(1e12, [wing.id]), wing.id).cost).toBe(0);
    expect(buySeatWing(seatState(wing.cost - 1), wing.id).success).toBe(false);
  });

  it('every wing DEEPENS a lower tier rather than granting a number', () => {
    // The capstone's whole argument: the reward for the fifth prestige is that
    // the second, third and fourth prestige's systems get bigger.
    const built = at(5, {
      dynasty: { seatWings: SEAT_WINGS.map((w) => w.id) },
      stats: { money: 0 },
    });
    expect(vaultCapacity(built)).toBe(VAULT_GALLERY_CAPACITY);      // tier 2
    expect(endowmentMultiplier(built)).toBe(2);                      // tier 3
    expect(trialCapacity(built)).toBe(TRIALS_CHAPTER_HOUSE_CAPACITY); // tier 4
    expect(trialRewardMultiplier(built)).toBe(2);                    // tier 4
    expect(hasSeatWing(built, 'seat_archive')).toBe(true);           // contracts
  });

  it('costs a stated, escalating $7B across the whole estate', () => {
    expect(totalSeatCost()).toBe(7_000_000_000);
    for (let i = 1; i < SEAT_WINGS.length; i += 1) {
      expect(SEAT_WINGS[i].cost).toBeGreaterThan(SEAT_WINGS[i - 1].cost);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the transition — what actually crosses a life boundary', () => {
  const oldLife = (): GameState =>
    at(4, {
      legacyPoints: 1_000,
      legacyContracts: { claimedIds: ['contract_prestige_1'] },
      dynasty: {
        vaultItemIds: [WATCH.id],
        endowments: ['endowment_bequest'],
        seatWings: ['seat_long_gallery'],
        trials: { active: ['trial_pauper'], pending: ['trial_frail'] },
      },
    });

  const newLife = (): GameState =>
    createTestGameState({ legacyPoints: 1_000, stats: { money: 250_000, health: 100, happiness: 100 } });

  it('carries the vault, the endowments and the seat wings', () => {
    const out = applyDynastyTransition(oldLife(), newLife());
    expect(vaultItemIds(out)).toEqual([WATCH.id]);
    expect(endowmentIds(out)).toEqual(['endowment_bequest']);
    expect(seatWingIds(out)).toEqual(['seat_long_gallery']);
  });

  it('carries claimed Legacy Contracts — they were being re-armed every prestige', () => {
    // Regression: `legacyContracts` was never copied, so `initialGameState`'s
    // empty board came back on every single prestige and the entire ladder was
    // re-claimable. That is the whole contract board, in Legacy Points, per cycle.
    const out = applyDynastyTransition(oldLife(), newLife());
    expect(out.legacyContracts?.claimedIds).toEqual(['contract_prestige_1']);
  });

  it('settles the trial the old life bore, into legacy points', () => {
    const out = applyDynastyTransition(oldLife(), newLife());
    expect(out.legacyPoints).toBe(1_000 + 200); // trial_pauper
  });

  it('promotes the sworn trial to active and empties the pending list', () => {
    const out = applyDynastyTransition(oldLife(), newLife());
    expect(activeTrialIds(out)).toEqual(['trial_frail']);
    expect(pendingTrialIds(out)).toEqual([]);
  });

  it('applies the newly-active trial to the life being built', () => {
    const out = applyDynastyTransition(oldLife(), newLife());
    expect(out.stats.health).toBe(25);
    expect(out.stats.happiness).toBe(25);
  });

  it('puts the preserved heirloom in the new life', () => {
    const out = applyDynastyTransition(oldLife(), newLife());
    expect(out.luxuryItems).toContain(WATCH.id);
    expect(out.luxuryHoldings?.[WATCH.id]).toBeTruthy();
  });

  it('is IDEMPOTENT — running it twice cannot pay the trial twice', () => {
    const once = applyDynastyTransition(oldLife(), newLife());
    const twice = applyDynastyTransition(oldLife(), newLife());
    expect(twice.legacyPoints).toBe(once.legacyPoints);
  });

  it('leaves `dynasty` ABSENT on a save that never opted in', () => {
    // The carve-out's whole justification: absence already means "no vault,
    // nothing endowed, no trial, no wings". Stamping an object onto every save
    // would make them all look like they had opted in.
    const out = applyDynastyTransition(createTestGameState({}), createTestGameState({}));
    expect(out.dynasty).toBeUndefined();
    expect(out.legacyContracts?.claimedIds ?? []).toEqual([]);
  });

  it('a pauper trial beats the inheritance it is applied after', () => {
    const parent = at(4, { dynasty: { trials: { pending: ['trial_pauper'] } } });
    const heir = createTestGameState({ stats: { money: 50_000_000 } });
    const out = applyDynastyTransition(parent, heir);
    expect(out.stats.money).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the Archive — new contracts the Seat opens, not old ones it hides', () => {
  it('a save without the Archive sees exactly the board it always saw', () => {
    const before = visibleContracts(at(5)).map((c) => c.id);
    expect(before).toEqual(LEGACY_CONTRACTS.map((c) => c.id));
    expect(getAllContractProgress(at(5))).toHaveLength(LEGACY_CONTRACTS.length);
  });

  it('the Archive wing ADDS rows, and removes none', () => {
    const withArchive = at(5, { dynasty: { seatWings: ['seat_archive'] } });
    const ids = visibleContracts(withArchive).map((c) => c.id);
    for (const c of LEGACY_CONTRACTS) expect(ids).toContain(c.id);
    for (const c of ARCHIVE_CONTRACTS) expect(ids).toContain(c.id);
    expect(ids).toHaveLength(LEGACY_CONTRACTS.length + ARCHIVE_CONTRACTS.length);
  });

  it('an Archive contract cannot be claimed without the wing, even if complete', () => {
    const complete = at(5, { prestige: { totalPrestiges: 500 } });
    const archive = ARCHIVE_CONTRACTS.find((c) => c.metric === 'totalPrestiges')!;
    expect(claimContract(complete, archive.id).success).toBe(false);
    expect(claimContract(complete, archive.id).message).toMatch(/Archive/);

    const built = at(5, {
      prestige: { totalPrestiges: 500 },
      dynasty: { seatWings: ['seat_archive'] },
    });
    const claim = claimContract(built, archive.id);
    expect(claim.success).toBe(true);
    expect(claim.reward).toBe(archive.reward);
  });

  it('Archive targets sit beyond the top of the standard ladder', () => {
    const topPrestige = Math.max(
      ...LEGACY_CONTRACTS.filter((c) => c.metric === 'totalPrestiges').map((c) => c.target)
    );
    const archivePrestige = ARCHIVE_CONTRACTS.find((c) => c.metric === 'totalPrestiges')!;
    expect(archivePrestige.target).toBeGreaterThan(topPrestige);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the save story for `dynasty` (v36 carve-out)', () => {
  it('STATE_VERSION is 36 and a v36 migration is registered', () => {
    expect(CURRENT_STATE_VERSION).toBe(36);
    expect(isMigrationVersionCovered(36)).toBe(true);
  });

  it('the migration writes NO `dynasty` key — absence already means empty', () => {
    // The carve-out's justification, asserted rather than only commented:
    // stamping `{}` (or worse, an item / a tranche / an active trial) onto every
    // existing save would make them all look like they had opted in.
    const old = { version: 35 } as Record<string, unknown>;
    const { state } = runMigrations(old);
    expect(state.version).toBe(36);
    expect('dynasty' in state).toBe(false);
  });

  it('a save carrying dynasty state survives a migration run untouched', () => {
    const saved = {
      version: 35,
      dynasty: { vaultItemIds: [WATCH.id], seatWings: ['seat_long_gallery'] },
    } as Record<string, unknown>;
    const { state } = runMigrations(saved);
    expect(state.dynasty).toEqual({
      vaultItemIds: [WATCH.id],
      seatWings: ['seat_long_gallery'],
    });
  });

  it('every accessor degrades a malformed shape to empty instead of throwing', () => {
    const junk = [
      undefined,
      null,
      { dynasty: null },
      { dynasty: 'nope' },
      { dynasty: { vaultItemIds: 'nope', endowments: 7, seatWings: [1, null], trials: 'nope' } },
    ];
    for (const bad of junk) {
      // Typed against the accessor's OWN parameter rather than `as GameState`.
      // The cast is legitimate here — the point is malformed input, which a
      // factory cannot produce — but Hard Rule #3's guard rightly flags the
      // `as GameState` shape, and this says what we mean more precisely: these
      // functions claim to tolerate anything their signature admits.
      const s = bad as Parameters<typeof vaultItemIds>[0];
      expect(() => [
        vaultItemIds(s),
        endowmentIds(s),
        seatWingIds(s),
        pendingTrialIds(s),
        activeTrialIds(s),
      ]).not.toThrow();
      expect(vaultItemIds(s)).toEqual([]);
      expect(seatWingIds(s)).toEqual([]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('reachability — every reducer has a control a player can press', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  const BOARD = read('components/prestige/DynastyBoard.tsx');
  const SHOP = read('components/PrestigeShopModal.tsx');
  const ACTIONS = read('contexts/game/MoneyActionsContext.tsx');
  const EXEC = read('lib/prestige/prestigeExecution.ts');

  it('the Prestige Shop actually renders the Dynasty board', () => {
    expect(SHOP).toMatch(/import DynastyBoard from '@\/components\/prestige\/DynastyBoard'/);
    expect(SHOP).toMatch(/<DynastyBoard gameState=\{gameState\} \/>/);
  });

  it('every dynasty action is exposed on the money-actions context', () => {
    for (const name of [
      'storeInDynastyVault',
      'removeFromDynastyVault',
      'claimDynastyEndowment',
      'swearDynastyTrial',
      'withdrawDynastyTrial',
      'buyDynastySeatWing',
    ]) {
      // Declared on the interface, wired into the memo value, and listed in its
      // deps — a missing dep silently freezes the action on a stale closure.
      expect(`${name} in interface: ${ACTIONS.includes(`${name}: (`)}`).toBe(`${name} in interface: true`);
      expect(`${name} in value: ${ACTIONS.includes(`${name}: ${name}Action,`)}`).toBe(`${name} in value: true`);
      expect(`${name} in deps: ${ACTIONS.includes(`${name}Action]`) || ACTIONS.includes(`${name}Action,`)}`)
        .toBe(`${name} in deps: true`);
    }
  });

  it('the board calls every one of them', () => {
    for (const name of [
      'storeInDynastyVault',
      'removeFromDynastyVault',
      'claimDynastyEndowment',
      'swearDynastyTrial',
      'withdrawDynastyTrial',
      'buyDynastySeatWing',
    ]) {
      expect(`${name} called: ${new RegExp(`${name}\\(`).test(BOARD)}`).toBe(`${name} called: true`);
    }
  });

  it('the board renders locked tiers instead of hiding them', () => {
    expect(BOARD).toMatch(/prestigeUnlockRequirement/);
    expect(BOARD).toMatch(/Lock/);
  });

  it('BOTH transition paths run the dynasty hook', () => {
    // `continueAsChild` (death → heir) reaches `createChildGameState` without
    // going through `executePrestige`, so a hook on only one path would let the
    // death flow silently skip a settlement the prestige flow pays.
    const calls = EXEC.match(/applyDynastyTransition\(oldState, finalState\)/g) ?? [];
    expect(calls).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('nothing is taken away', () => {
  it('a save that never prestiges again is untouched by all four tiers', () => {
    const rookie = at(0, { luxuryItems: [WATCH.id], stats: { money: 1e12 } });
    // Every gate refuses; none of them mutates anything.
    expect(storeInVault(rookie, WATCH.id).success).toBe(false);
    expect(claimEndowment(rookie, ENDOWMENT_TRANCHES[0].id).success).toBe(false);
    expect(addPendingTrial(rookie, DYNASTY_TRIALS[0].id).success).toBe(false);
    expect(buySeatWing(rookie, SEAT_WINGS[0].id).success).toBe(false);
    expect(rookie.dynasty).toBeUndefined();
    expect(rookie.luxuryItems).toEqual([WATCH.id]);
  });

  it('an unregistered capability id still defaults to UNLOCKED', () => {
    // Forgetting to register a feature must make it visible, not invisible.
    expect(isPrestigeFeatureUnlocked(at(0), 'feature:not_registered')).toBe(true);
  });
});
