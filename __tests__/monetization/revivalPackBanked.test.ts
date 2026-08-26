/**
 * MON-5 — the $2.99 Revival Pack was a permanent no-op when bought while alive.
 *
 * `applyBenefit` revived at the INSTANT of purchase: it wrote health, happiness
 * and energy to 100 and cleared `showDeathPopup`, right there in the grant.
 *
 * The store is reachable while alive, which is when essentially everyone buys
 * it. Bought then, every one of those writes did nothing — the stats were
 * already full and there was no death popup to clear. The player paid and
 * received nothing, permanently, while `settings.hasRevivalPack` recorded that
 * they had been given something.
 *
 * Owner decision (2026-08-02): one banked revive, consumed on death.
 *
 * The state for that already existed. `revivalPack: boolean` has been on
 * GameState and in `initialState` since the beginning, defaulting to false and
 * touched by NOTHING — a dead field, and a standing case of the drift Hard Rule
 * #3 exists to catch (a concrete stored default with no migration). It is now
 * the bank, registered at v30.
 */
import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';
import { getProductConfig, IAP_PRODUCTS } from '@/utils/iapConfig';
import { applyProductBenefitsToState } from '@/services/IAPService';
import { repairGameState } from '@/utils/saveValidation';
import { STATE_VERSION, initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import type { GameState } from '@/contexts/game/types';

/**
 * `runMigrations` and `repairGameState` both take a raw parsed save, so their
 * state is not typed as a GameState. Reading one field back through four
 * separate `as unknown as GameState` casts said nothing except "trust me" —
 * this names the one field these tests care about instead.
 */
const bankedRevive = (state: unknown): unknown =>
  (state as { revivalPack?: unknown }).revivalPack;

// ── The consume path, lifted from GameStateContext ─────────────────────────
//
// `reviveWithPack` lives in a provider, so driving it here would need the whole
// React tree. The updater it dispatches is what carries the atomicity, and that
// is what these tests exercise — through the shared setGameState stub, which
// applies updaters sequentially exactly as React batching would.
//
// The source contract below pins that this stays a faithful copy: if the real
// action stops re-checking either gate inside the updater, that test fails.
function reviveWithPackUpdater(prev: GameState): GameState {
  if (!prev.showDeathPopup) return prev;
  if (!prev.revivalPack) return prev;
  return {
    ...prev,
    revivalPack: false,
    showDeathPopup: false,
    deathReason: undefined,
    diseases: [],
    stats: { ...prev.stats, health: 100, happiness: 100, energy: 100 },
    happinessZeroWeeks: 0,
    healthZeroWeeks: 0,
  };
}

describe('the pack banks instead of firing at purchase time', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const IAP = fs.readFileSync(
    path.join(__dirname, '..', '..', 'services/IAPService.ts'), 'utf8',
  );
  // The grant is one `case` in a switch; scope to it so a match cannot come
  // from a comment or from a neighbouring product's branch.
  const GRANT = IAP.slice(
    IAP.indexOf('case IAP_PRODUCTS.REVIVAL_PACK:'),
    IAP.indexOf('case IAP_PRODUCTS.REVIVAL_PACK:') + 2600,
  ).replace(/\/\/.*$/gm, '');

  it('banks a charge', () => {
    expect(GRANT).toMatch(/gameState\.revivalPack = true;/);
  });

  it('but only on a PURCHASE - a restore must never re-bank a spent revive', () => {
    // The charge is a quantity in boolean clothing: banking it twice gives the
    // player more than they bought. Restore passes `entitlementsOnly`, and the
    // local ledger it used to lean on is wiped by a reinstall (and the RC loop
    // keyed it on a synthetic id the original purchase never wrote), so the
    // guard must live in the grant itself.
    expect(GRANT).toMatch(/if \(!entitlementsOnly\) \{\s*gameState\.revivalPack = true;/);
  });

  it('and no longer revives inline', () => {
    // The four writes that made a live purchase a no-op.
    expect(GRANT).not.toMatch(/gameState\.showDeathPopup = false;/);
    expect(GRANT).not.toMatch(/gameState\.stats\.health = 100;/);
    expect(GRANT).not.toMatch(/gameState\.happinessZeroWeeks = 0;/);
    expect(GRANT).not.toMatch(/gameState\.healthZeroWeeks = 0;/);
  });

  it('still records the purchase entitlement separately (the control)', () => {
    // `settings.hasRevivalPack` is the PURCHASE record and survives prestige;
    // `revivalPack` is the unspent CHARGE. Both are written, and they answer
    // different questions — dropping the first would lose the entitlement.
    expect(GRANT).toMatch(/gameState\.settings\.hasRevivalPack = true;/);
  });
});

describe('restore semantics: purchase record yes, spendable charge no', () => {
  // Driven through the real grant function, not a source scan. `entitlementsOnly`
  // is what both restore loops pass for the pack; the local dedupe ledger they
  // used to lean on is wiped by a reinstall (and the RC loop keyed it on a
  // synthetic `rc_restore:` id the original purchase never wrote), so restoring
  // had become a free-revive mint. The charge is the ONLY quantity this product
  // grants, so entitlements-only must reduce it to the purchase record alone.
  const grant = (entitlementsOnly: boolean) => {
    const state = createTestGameState({ revivalPack: false });
    const config = getProductConfig(IAP_PRODUCTS.REVIVAL_PACK);
    if (!config) throw new Error('no product config for the revival pack');
    applyProductBenefitsToState(state, config, IAP_PRODUCTS.REVIVAL_PACK, { entitlementsOnly });
    return state;
  };

  it('a PURCHASE banks the charge and records the entitlement', () => {
    const s = grant(false);
    expect(s.revivalPack).toBe(true);
    expect(s.settings.hasRevivalPack).toBe(true);
  });

  it('a RESTORE re-asserts the entitlement without re-banking a charge', () => {
    const s = grant(true);
    expect(s.revivalPack).toBe(false);
    expect(s.settings.hasRevivalPack).toBe(true);
  });
});

describe('consuming a banked revive', () => {
  const dead = (over: Partial<GameState> = {}) => createTestGameState({
    showDeathPopup: true,
    deathReason: 'health', // the union is health|happiness|age — 'illness' is not a member
    revivalPack: true,
    stats: { health: 0, happiness: 0, energy: 0 },
    happinessZeroWeeks: 4,
    healthZeroWeeks: 4,
    ...over,
  });

  it('brings the player back and spends the charge', () => {
    const stub = createSetGameStateStub(dead());
    stub.setGameState(reviveWithPackUpdater);
    const s = stub.current();

    expect(s.showDeathPopup).toBe(false);
    expect(s.deathReason).toBeUndefined();
    expect(s.revivalPack).toBe(false);
    expect(s.stats.health).toBe(100);
    expect(s.happinessZeroWeeks).toBe(0);
    expect(s.healthZeroWeeks).toBe(0);
  });

  it('a double tap in one batch spends ONE charge, not two (§4.4)', () => {
    // The mirror of the bug this file's neighbour already fixed for gems: two
    // taps landing in one React batch both clear the outer render's `disabled`
    // check. Here the failure mode is a free extra life rather than a double
    // charge — both gates are re-read from `prev` INSIDE the updater, so the
    // second dispatch sees `revivalPack: false` and bails.
    const stub = createSetGameStateStub(dead());
    stub.setGameState(reviveWithPackUpdater);
    stub.setGameState(reviveWithPackUpdater);

    expect(stub.current().revivalPack).toBe(false);
    expect(stub.calls()).toBe(2); // both really did dispatch
  });

  it('refuses when no pack is banked', () => {
    const stub = createSetGameStateStub(dead({ revivalPack: false }));
    stub.setGameState(reviveWithPackUpdater);

    expect(stub.current().showDeathPopup).toBe(true); // still dead
  });

  it('refuses when the player is alive - the charge is not burnable early', () => {
    const alive = createTestGameState({ showDeathPopup: false, revivalPack: true });
    const stub = createSetGameStateStub(alive);
    stub.setGameState(reviveWithPackUpdater);

    expect(stub.current().revivalPack).toBe(true);
  });

  it('cures diseases, like the gem revive does (P2-3)', () => {
    // Without this the disease that killed the player re-applies its lethal
    // penalty next tick and eats the revive for nothing — worse for a paid
    // one-shot than for gems, because there is no second one to buy.
    const withDisease = dead({
      diseases: [{ id: 'flu', name: 'Flu', severity: 'severe' }] as never,
    });
    const stub = createSetGameStateStub(withDisease);
    stub.setGameState(reviveWithPackUpdater);

    expect(stub.current().diseases).toEqual([]);
  });
});

describe('the real action keeps both gates inside the updater', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'contexts/game/GameStateContext.tsx'), 'utf8',
  );
  const BODY = SRC.slice(SRC.indexOf('const reviveWithPack'), SRC.indexOf('const value = useMemo'));

  it('the helper above is a faithful copy of the shipped updater', () => {
    expect(BODY.length).toBeGreaterThan(200);
    expect(BODY).toMatch(/wrappedSetGameState\(prev => \{/);
    // Both gates read from `prev`, not from an outer snapshot.
    expect(BODY).toMatch(/if \(!prev\.showDeathPopup\)/);
    expect(BODY).toMatch(/if \(!prev\.revivalPack\)/);
    // And the spend happens in the same returned object.
    expect(BODY).toMatch(/revivalPack: false,/);
  });
});

describe('v30 - the field is finally registered', () => {
  // Asserted against the live constants, not the literal 30. What this suite
  // cares about is that the v30 registration still WORKS, not what the current
  // version number happens to be — pinning the literal made an unrelated bump
  // (v31, the arrears field) fail here and taught the next person to edit the
  // number rather than read the test.
  it('the migration ladder still reaches the current version', () => {
    expect(CURRENT_STATE_VERSION).toBe(STATE_VERSION);
    expect(STATE_VERSION).toBeGreaterThanOrEqual(30);
  });

  it('a pre-v30 save without the key arrives with no banked revive', () => {
    const old = { ...structuredClone(initialGameState), version: 29 } as unknown as Record<string, unknown>;
    delete old.revivalPack;

    const { state } = runMigrations(old as never);

    expect(bankedRevive(state)).toBe(false);
    // Migrated all the way forward, not merely to 30 — a chain that halts early is
    // the failure this is really watching for.
    expect(state.version).toBe(CURRENT_STATE_VERSION);
  });

  it('and does NOT get one just for having bought the pack before', () => {
    // `settings.hasRevivalPack` means "purchased", and every such player
    // already received their instant revive under the old behaviour. Reading it
    // here would hand all of them a second, free life.
    const old = structuredClone(initialGameState) as unknown as Record<string, unknown>;
    old.version = 29;
    (old.settings as Record<string, unknown>).hasRevivalPack = true;
    delete old.revivalPack;

    const { state } = runMigrations(old as never);

    expect(bankedRevive(state)).toBe(false);
  });

  it('a banked charge already present is not clobbered by the migration', () => {
    const old = { ...structuredClone(initialGameState), version: 29, revivalPack: true } as unknown as Record<string, unknown>;

    const { state } = runMigrations(old as never);

    expect(bankedRevive(state)).toBe(true);
  });

  it('repairGameState mirrors the backfill for a partial save', () => {
    // §7: migration↔repair parity is NOT checked by the static audit. A field
    // with a migration and no mirror survives until a partial save hits it.
    const partial = structuredClone(initialGameState) as unknown as Record<string, unknown>;
    delete partial.revivalPack;

    repairGameState(partial as never);

    expect(bankedRevive(partial)).toBe(false);
  });

  it('and the repair actually writes back - `repaired = true` was set (the control)', () => {
    // The trap §7 calls out by name: the repaired clone is only copied onto the
    // caller's object when the flag is set, so a backfill without it is
    // computed and silently discarded. The assertion above would still pass if
    // some OTHER repair in the same pass had set the flag, so pin it alone.
    const partial = structuredClone(initialGameState) as unknown as Record<string, unknown>;
    delete partial.revivalPack;

    const result = repairGameState(partial as never);

    expect(result.repaired).toBe(true);
    expect(result.repairs.some((r: string) => /revivalPack/.test(r))).toBe(true);
  });
});
