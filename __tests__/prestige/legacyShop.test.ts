/**
 * C-11 — Legacy Points finally buy something.
 *
 * They were earned every 10 weeks by the week loop and from four elder
 * activities, persisted, migrated (v11) and repaired — and never spent,
 * displayed, or checked by any mechanic. A currency with no sink and no
 * readout. The code called it a "mini-prestige"; nothing had been built to
 * prestige into.
 *
 * Owner's call: spend them on the next generation's starting position.
 *
 * ── The two design decisions worth pinning ────────────────────────────────
 *
 * 1. `legacyPoints` is a LIFETIME TOTAL, not a wallet. The week loop only ever
 *    adds to it. So the spendable balance is derived (earned − spent) rather
 *    than decremented, which also makes a purchase idempotent: owning the id is
 *    what costs the points, so re-running it cannot double-charge. That matters
 *    because the action runs the reducer twice — once for the report, once
 *    inside the updater — instead of capturing the outcome, which
 *    `__tests__/refactor/updaterTimingContract.test.tsx` showed is unreliable.
 *
 * 2. Every upgrade is a HEAD START, never a permanent multiplier, and each is
 *    once-per-id. A long life already earns hundreds of points; letting them
 *    buy compounding power would make each generation strictly stronger than
 *    the last forever, which is prestige's job.
 *
 * STATE_VERSION 28 → 29 for `legacyUpgrades`. Concrete stored default (`[]`),
 * so unlike the v26/v27/v28 carve-outs this one takes a real backfill AND a
 * `repairGameState` mirror — the parity CLAUDE.md §7 warns is not checked by
 * the static audit.
 *
 * 2026-08-01, product decision taken by the owner.
 */
import fs from 'fs';
import path from 'path';
import {
  LEGACY_UPGRADES,
  LEGACY_BRANCHES,
  upgradesForBranch,
  isUpgradeUnlocked,
  totalLegacyTreeCost,
  getLegacyUpgrade,
  legacyPointsAvailable,
  legacyPointsSpent,
  purchaseLegacyUpgrade,
  heirStartingBonuses,
} from '@/lib/legacy/legacyShop';
import { STATE_VERSION, initialGameState } from '@/contexts/game/initialState';
import { CURRENT_STATE_VERSION, runMigrations } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';

describe('C-11 — the balance is derived, not stored', () => {
  it('a fresh save can spend everything it earned', () => {
    expect(legacyPointsAvailable(100, [])).toBe(100);
  });

  it('spending deducts from the lifetime total', () => {
    const cheapest = [...LEGACY_UPGRADES].sort((a, b) => a.cost - b.cost)[0];

    expect(legacyPointsAvailable(100, [cheapest.id])).toBe(100 - cheapest.cost);
    expect(legacyPointsSpent([cheapest.id])).toBe(cheapest.cost);
  });

  it('duplicate ids are only charged once', () => {
    const u = LEGACY_UPGRADES[0];
    expect(legacyPointsSpent([u.id, u.id, u.id])).toBe(u.cost);
  });

  it('an unknown id costs nothing rather than NaN', () => {
    expect(legacyPointsSpent(['not_a_real_upgrade'])).toBe(0);
  });

  it('and the balance never goes negative (the control)', () => {
    // A save whose upgrades outvalue its points — possible if costs are ever
    // rebalanced upward — must read 0, not a negative wallet.
    const all = LEGACY_UPGRADES.map((u) => u.id);
    expect(legacyPointsAvailable(0, all)).toBe(0);
  });

  it('a corrupt legacyPoints reads as 0 (the control)', () => {
    for (const bad of [undefined, NaN, Infinity, -5]) {
      expect(`${String(bad)}: ${legacyPointsAvailable(bad as number, [])}`)
        .toBe(`${String(bad)}: 0`);
    }
  });
});

describe('C-11 — buying is a pure, idempotent reducer', () => {
  const CHEAP = [...LEGACY_UPGRADES].sort((a, b) => a.cost - b.cost)[0];

  it('a player with enough points gets the upgrade', () => {
    const r = purchaseLegacyUpgrade(CHEAP.cost, [], CHEAP.id);

    expect(r.success).toBe(true);
    expect(r.owned).toEqual([CHEAP.id]);
  });

  it('a player one point short does not', () => {
    const r = purchaseLegacyUpgrade(CHEAP.cost - 1, [], CHEAP.id);

    expect(r.success).toBe(false);
    expect(r.message).toMatch(new RegExp(`${CHEAP.cost} legacy points`));
    expect(r.owned).toBeUndefined();
  });

  it('running it TWICE on the result cannot double-charge', () => {
    // The property the action depends on: it calls this once for the report
    // and once inside the updater, so the second run must be a rejection.
    const first = purchaseLegacyUpgrade(1000, [], CHEAP.id);
    const second = purchaseLegacyUpgrade(1000, first.owned!, CHEAP.id);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already have/i);
  });

  it('an unknown id is refused', () => {
    expect(purchaseLegacyUpgrade(10_000, [], 'nope').success).toBe(false);
  });

  it('does not mutate the list it was given (the control)', () => {
    const owned: string[] = [];
    purchaseLegacyUpgrade(1000, owned, CHEAP.id);

    expect(owned).toEqual([]);
  });
});

describe('C-11 — the upgrades are head starts, not multipliers', () => {
  it('every upgrade grants money, a stat, reputation, or a TIMED buff — nothing compounding', () => {
    // A timed buff is a head start, not a permanent multiplier: it expires on
    // a weeksLived deadline, so generation N+1 is not strictly stronger than
    // generation N forever. The anti-compounding rule stays for anything that
    // does not expire.
    for (const u of LEGACY_UPGRADES) {
      expect(`${u.id}: ${u.effect.kind}`)
        .toMatch(/: (money|stat|reputation|buff)$/);
      if (u.effect.kind === 'buff') {
        expect(u.effect.weeks).toBeGreaterThan(0);
        expect(u.effect.weeks).toBeLessThanOrEqual(260); // ≤5 years — a head start, not a life
      }
    }
  });

  it('every upgrade costs something and resolves by id', () => {
    for (const u of LEGACY_UPGRADES) {
      expect(u.cost).toBeGreaterThan(0);
      expect(getLegacyUpgrade(u.id)?.name).toBe(u.name);
    }
  });

  it('the first rung of every branch is affordable inside one early life', () => {
    // REPLACES "owning everything is affordable within one long life"
    // (total < 1000), which pinned the exact design the 2026-08-05 audit found
    // broken: accrual is QUADRATIC (~1,275 points by week 500, ~5,050 by week
    // 1,000) against a 340-point catalogue, so the shop was bought out by week
    // ~260 and every heir from generation 2 on started with all of it. The
    // currency was dead for three quarters of a long life.
    //
    // What must stay true is that the tree OPENS cheaply — a player who has
    // just met legacy points can afford a root. Depth beyond that is the point.
    for (const branch of LEGACY_BRANCHES) {
      const root = upgradesForBranch(branch.id).find((u) => !u.requires);
      expect(`${branch.id}:${root ? root.cost <= 150 : 'missing root'}`).toBe(`${branch.id}:true`);
    }
  });

  it('the whole tree costs more than one long life can earn', () => {
    // The other half of the same intent: buying out the tree must NOT be the
    // default outcome. ~5,050 points is the yield of a 1,000-week life.
    expect(totalLegacyTreeCost()).toBeGreaterThan(5_050);
  });

  it('the bonuses sum correctly across owned ids', () => {
    const money = LEGACY_UPGRADES.filter((u) => u.effect.kind === 'money');
    const b = heirStartingBonuses(money.map((u) => u.id));

    expect(b.money).toBe(
      money.reduce((s, u) => s + (u.effect.kind === 'money' ? u.effect.amount : 0), 0),
    );
  });

  it('an empty or corrupt list grants nothing (the control)', () => {
    for (const bad of [undefined, [], ['nope']]) {
      const b = heirStartingBonuses(bad as string[]);
      expect(`${JSON.stringify(bad)}: ${b.money} ${b.reputation} ${Object.keys(b.stats).length}`)
        .toBe(`${JSON.stringify(bad)}: 0 0 0`);
    }
  });
});

describe('the Dynasty Tree — branches and prerequisites', () => {
  it('every node sits on a declared branch', () => {
    const branchIds = LEGACY_BRANCHES.map((b) => b.id);
    for (const u of LEGACY_UPGRADES) {
      expect(`${u.id}:${branchIds.includes(u.branch)}`).toBe(`${u.id}:true`);
    }
  });

  it('every branch is enterable — at least one root, and no empty branch', () => {
    // Originally asserted EXACTLY one root, on the reasoning that multiple
    // roots make "the branch you invested in" meaningless. That reasoning was
    // wrong: Blood carries parallel health and fitness lines, and Craft carries
    // intelligence and happiness, which is a real tree shape and gives the
    // player a choice WITHIN a branch. The invariant that actually matters is
    // that no branch is unreachable (zero roots) or empty — reachability of the
    // deeper nodes is covered by the cycle test below.
    for (const branch of LEGACY_BRANCHES) {
      const nodes = upgradesForBranch(branch.id);
      const roots = nodes.filter((u) => !u.requires);
      expect(`${branch.id}:nodes=${nodes.length > 0}`).toBe(`${branch.id}:nodes=true`);
      expect(`${branch.id}:roots=${roots.length > 0}`).toBe(`${branch.id}:roots=true`);
    }
  });

  it('every prerequisite exists and sits on the same branch', () => {
    for (const u of LEGACY_UPGRADES) {
      if (!u.requires) continue;
      const parent = getLegacyUpgrade(u.requires);
      expect(`${u.id}:parent=${parent?.id}`).toBe(`${u.id}:parent=${u.requires}`);
      expect(`${u.id}:branch=${parent?.branch}`).toBe(`${u.id}:branch=${u.branch}`);
    }
  });

  it('has no prerequisite cycles — every node reaches a root', () => {
    for (const u of LEGACY_UPGRADES) {
      const seen = new Set<string>();
      let cursor: string | undefined = u.id;
      while (cursor) {
        expect(`${u.id}:cycle-at-${cursor}`).toBe(`${u.id}:cycle-at-${cursor}`);
        if (seen.has(cursor)) throw new Error(`prerequisite cycle through ${cursor}`);
        seen.add(cursor);
        cursor = getLegacyUpgrade(cursor)?.requires;
      }
      // A chain that terminates has visited at most the whole catalogue.
      expect(seen.size).toBeLessThanOrEqual(LEGACY_UPGRADES.length);
    }
  });

  it('costs increase with depth along a branch', () => {
    // A deeper node that cost LESS would make the prerequisite a formality.
    for (const branch of LEGACY_BRANCHES) {
      const nodes = upgradesForBranch(branch.id);
      for (const node of nodes) {
        if (!node.requires) continue;
        const parent = getLegacyUpgrade(node.requires)!;
        expect(`${node.id}:${node.cost > parent.cost}`).toBe(`${node.id}:true`);
      }
    }
  });

  it('refuses a leaf whose prerequisite is not owned, however rich the player', () => {
    const leaf = LEGACY_UPGRADES.find((u) => u.requires)!;
    const r = purchaseLegacyUpgrade(1_000_000, [], leaf.id);

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/needs/i);
    expect(r.owned).toBeUndefined();
  });

  it('allows it once the prerequisite is owned', () => {
    const leaf = LEGACY_UPGRADES.find((u) => u.requires)!;
    const r = purchaseLegacyUpgrade(1_000_000, [leaf.requires!], leaf.id);

    expect(r.success).toBe(true);
    expect(r.owned).toContain(leaf.id);
  });

  it('isUpgradeUnlocked agrees with what the reducer will accept', () => {
    for (const u of LEGACY_UPGRADES) {
      const owned = u.requires ? [u.requires] : [];
      expect(`${u.id}:${isUpgradeUnlocked(u.id, owned)}`).toBe(`${u.id}:true`);
      if (u.requires) {
        expect(`${u.id}:${isUpgradeUnlocked(u.id, [])}`).toBe(`${u.id}:false`);
      }
      // And the reducer must not refuse for a PREREQUISITE reason when unlocked.
      const r = purchaseLegacyUpgrade(1_000_000, owned, u.id);
      expect(`${u.id}:${r.success}`).toBe(`${u.id}:true`);
    }
  });

  it('an unknown id is not unlocked (the control)', () => {
    expect(isUpgradeUnlocked('not_a_real_upgrade', [])).toBe(false);
  });

  it('keeps every original id, so no existing save loses a purchase', () => {
    // The six pre-tree upgrades. Renaming or dropping one would silently strip
    // it from `legacyUpgrades` on load and refund nothing.
    for (const id of [
      'legacy_inheritance_small',
      'legacy_inheritance_large',
      'legacy_education',
      'legacy_health',
      'legacy_fitness',
      'legacy_name',
    ]) {
      expect(`${id}:${!!getLegacyUpgrade(id)}`).toBe(`${id}:true`);
    }
  });
});

describe('the shop is REACHABLE from the app, not just from tests', () => {
  // `tasks/lessons.md` records this failure mode three times now: "is it
  // called?" is a different question from "does it work?". `legacyShop` shipped
  // fully tested, wired into MoneyActionsContext — and NO screen called
  // `purchaseLegacyUpgrade`, so the whole system was unreachable in the app.
  // The modal showed the point balance and offered nowhere to spend it.
  const shopModal = fs.readFileSync(
    path.join(__dirname, '../../components/PrestigeShopModal.tsx'),
    'utf8'
  );

  it('a screen calls the purchase action', () => {
    expect(shopModal).toMatch(/purchaseLegacyUpgrade/);
  });

  it('the tree is rendered, not just the balance', () => {
    expect(shopModal).toMatch(/LEGACY_BRANCHES/);
    expect(shopModal).toMatch(/upgradesForBranch/);
  });

  it('locked nodes are distinguishable from unaffordable ones', () => {
    // Two different kinds of no. Collapsing them tells a player to save up for
    // something they cannot buy at any price.
    expect(shopModal).toMatch(/isUpgradeUnlocked/);
  });
});

describe('C-11 — the save format', () => {
  it('the field ships in initialState, and v29 is still on the ladder', () => {
    // This used to pin STATE_VERSION === 29. That made it a tripwire for every
    // LATER bump rather than a test of C-11 — v30 (revivalPack) broke it while
    // changing nothing about legacyUpgrades. `luxuryHoldingsMigration.test.ts`
    // owns the current-version assertion; this file owns its own field.
    expect(CURRENT_STATE_VERSION).toBe(STATE_VERSION);
    expect(STATE_VERSION).toBeGreaterThanOrEqual(29);
    expect(initialGameState.legacyUpgrades).toEqual([]);
  });

  it('the test factory inherits it, so no test hand-builds the field', () => {
    expect(createTestGameState().legacyUpgrades).toEqual([]);
  });

  it('a v28 save is backfilled — it is NOT a carve-out field', () => {
    // Concrete stored default, so unlike v26/v27/v28 this one gets a real
    // backfill. Every reader guards with Array.isArray today, but the first
    // bare `.includes` would break on an absent key.
    const { state } = runMigrations({ version: 28, legacyPoints: 40 });

    // Runs the whole remaining ladder, so assert the CURRENT version rather
    // than a hardcoded 29 — the point here is the backfill, not the endpoint.
    expect(state.version).toBe(STATE_VERSION);
    expect(state.legacyUpgrades).toEqual([]);
    expect(state.legacyPoints).toBe(40);
  });

  it('a save that already has purchases keeps them', () => {
    const { state } = runMigrations({
      version: 28, legacyPoints: 200, legacyUpgrades: [LEGACY_UPGRADES[0].id],
    });

    expect(state.legacyUpgrades).toEqual([LEGACY_UPGRADES[0].id]);
  });

  it('repairGameState mirrors the migration for a PARTIAL save', () => {
    // The parity CLAUDE.md §7 says the static audit does not check — a field
    // with a migration but no repair mirror survives until a partial save
    // hits it.
    const partial = { ...createTestGameState() } as Record<string, unknown>;
    delete partial.legacyUpgrades;

    // repairGameState returns { repaired, repairs } and writes the repaired
    // clone back ONTO the caller's object — it does not return the state.
    const result = repairGameState(partial as never);

    expect(result.repairs.join(' ')).toMatch(/legacyUpgrades/);
    expect(partial.legacyUpgrades).toEqual([]);
  });

  it('and the repair reports itself, so the clone is written back', () => {
    // A backfill without `repaired = true` is computed and then discarded.
    const partial = { ...createTestGameState() } as Record<string, unknown>;
    delete partial.legacyUpgrades;

    expect(repairGameState(partial as never).repaired).toBe(true);
  });
});

describe('C-11 — the heir actually starts with what was bought', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'lib/prestige/prestigeExecution.ts'), 'utf8',
  );

  it('the child path carries the points AND the purchases', () => {
    expect(SRC).toMatch(/newState\.legacyPoints = oldState\.legacyPoints \|\| 0;/);
    expect(SRC).toMatch(/newState\.legacyUpgrades = \[\.\.\.\(oldState\.legacyUpgrades \|\| \[\]\)\];/);
  });

  it('and applies the starting bonuses', () => {
    expect(SRC).toMatch(/const heirBonuses = heirStartingBonuses\(newState\.legacyUpgrades\);/);
  });

  it('the RESET path carries them but does NOT apply the bonuses (the control)', () => {
    // Every upgrade is worded "Your heir starts with…". A prestige reset is
    // the same character starting over, not a new generation — but the
    // purchase must not be destroyed either, which is the MON-1/2/3 class.
    const reset = SRC.slice(
      SRC.indexOf('function createResetGameState'),
      SRC.indexOf('function createChildGameState'),
    );

    expect(reset).toMatch(/newState\.legacyUpgrades = \[\.\.\.\(oldState\.legacyUpgrades \|\| \[\]\)\];/);
    expect(reset).not.toMatch(/heirStartingBonuses/);
  });

  it('stat bonuses are clamped to 100 (the control)', () => {
    // A heir cannot start above the cap no matter how much was bought.
    expect(SRC).toMatch(/Math\.min\(100, current \+ amount\)/);
    expect(SRC).toMatch(/Math\.min\(100, \(newState\.stats\.reputation \|\| 0\) \+ heirBonuses\.reputation\)/);
  });
});
