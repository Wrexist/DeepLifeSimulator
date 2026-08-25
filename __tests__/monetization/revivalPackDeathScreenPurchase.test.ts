/**
 * The Revival Pack is sold from the death screen (owner ask, 2026-08-25):
 * "make the revival pack like an IAP and when you click on it it opens the pay
 * screen for player. And it revives the character on success."
 *
 * Before this, the row on the death screen bought nothing. It bridged out to
 * `GemShopModal`'s `perks` tab and stopped: the player had to find the card and
 * tap Buy a second time, and when the purchase went through they were left in
 * the shop, alive-eligible but still dead, with a banked charge and one more
 * screen to dismiss. The row named a price and did not charge it.
 *
 * Two things had to be true to fix it without a second set of rules for taking
 * someone's money:
 *
 *   1. ONE purchase flow. It moved out of `GemShopModal` into
 *      `hooks/useStorePurchase.ts`; both surfaces call it.
 *   2. ONE revive. `reviveWithPack` still spends the charge in a single
 *      updater — the death screen does not write health/happiness itself, and
 *      the grant still happens in `IAPService` exactly as it always has.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import type { GameState } from '@/contexts/game/types';

const fs = require('fs') as typeof import('fs');
const path = require('path') as typeof import('path');
const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
// Comments describe the rules; they must never be what satisfies an assertion.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const DEATH = stripComments(read('components/DeathPopup.tsx'));
const SHOP = stripComments(read('components/GemShopModal.tsx'));
const HOOK = stripComments(read('hooks/useStorePurchase.ts'));
const CONTEXT = stripComments(read('contexts/game/GameStateContext.tsx'));

describe('the death screen buys the pack itself', () => {
  const BUY = DEATH.slice(
    DEATH.indexOf('const handleBuyRevivalPack'),
    DEATH.indexOf('useEffect', DEATH.indexOf('const handleBuyRevivalPack')),
  );

  it('runs the purchase for the Revival Pack SKU', () => {
    expect(BUY).toMatch(/purchase\(IAP_PRODUCTS\.REVIVAL_PACK/);
  });

  it('opens the store sheet with no confirmation dialog in front of it', () => {
    // The row already names the product and the price, and the platform's own
    // pay sheet is the confirmation. A dialog before it is one more tap between
    // a player who has decided and the game they are trying to keep playing.
    expect(BUY).toMatch(/confirm:\s*false/);
  });

  it('revives on success, through the same one updater', () => {
    expect(BUY).toMatch(/onSuccess/);
    expect(BUY).toMatch(/reviveWithPack\(\{\s*justPurchased:\s*true\s*\}\)/);
    // And does NOT hand-write the revive - health/happiness/energy and
    // showDeathPopup belong to reviveWithPack, or there are two revives to keep
    // in step and one of them will drift.
    expect(BUY).not.toMatch(/showDeathPopup:\s*false/);
    expect(BUY).not.toMatch(/health:\s*100/);
  });

  it('force-saves the spent charge', () => {
    // Otherwise the revive lives only in memory while `revivalPack: true` sits
    // on disk - a crash before the next autosave is a second free revive.
    expect(BUY).toMatch(/saveGame\(true\)/);
  });

  it('falls back to the store bridge when the SKU never loaded', () => {
    // Nothing to buy inline then, and an "Item Unavailable" alert would be a
    // dead end on the one screen where the player is trying to spend money.
    expect(BUY).toMatch(/isProductAvailable\(IAP_PRODUCTS\.REVIVAL_PACK\)/);
    expect(BUY).toMatch(/bridgeToStore\('perks'\)/);
  });
});

describe('one purchase flow, two entry points', () => {
  it('both surfaces call the shared hook', () => {
    expect(DEATH).toMatch(/useStorePurchase\(\)/);
    expect(SHOP).toMatch(/useStorePurchase\(\)/);
  });

  it('and neither drives IAPService.purchaseProduct itself', () => {
    // The whole point of extracting the flow: the availability gate, the
    // in-flight latch and the "you were charged but it did not apply" message
    // exist in exactly one place.
    expect(DEATH).not.toMatch(/purchaseProduct\(/);
    expect(SHOP).not.toMatch(/purchaseProduct\(/);
    expect(HOOK).toMatch(/iapService\.purchaseProduct\(/);
  });

  it('the in-flight latch is a ref, not state (§4.4)', () => {
    // `setPurchasingId(id)` does not update `purchasingId` until the next
    // render, so two taps in one React batch would both read null and both open
    // a store sheet. The ref flips synchronously.
    expect(HOOK).toMatch(/inFlightRef\s*=\s*useRef\(false\)/);
    expect(HOOK).toMatch(/if \(inFlightRef\.current \|\| blocked\)/);
    expect(HOOK).toMatch(/inFlightRef\.current = true;/);
    expect(HOOK).toMatch(/inFlightRef\.current = false;/);
  });

  it('a post-purchase handler that throws is not reported as a failed purchase', () => {
    // The player HAS been charged and HAS been granted by then. Telling them it
    // failed invites a second purchase attempt on a non-consumable.
    const SUCCESS = HOOK.slice(HOOK.indexOf('if (result.success)'), HOOK.indexOf('} else {'));
    expect(SUCCESS).toMatch(/try \{[\s\S]*await onSuccess\(\)[\s\S]*\} catch/);
  });
});

// ── The consume path, lifted from GameStateContext ─────────────────────────
//
// Same approach as revivalPackBanked.test.ts: the action lives in a provider,
// so the updater it dispatches is what carries the atomicity and what is
// exercised here. The source contract below pins that this stays faithful.
function reviveWithPackUpdater(
  prev: GameState,
  options?: { justPurchased?: boolean },
): GameState {
  if (!prev.showDeathPopup) return prev;
  if (!prev.revivalPack) {
    if (!options?.justPurchased) return prev;
  }
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

describe('a charge the store just confirmed', () => {
  const dead = (over: Partial<GameState> = {}) =>
    createTestGameState({
      showDeathPopup: true,
      deathReason: 'health',
      revivalPack: false,
      stats: { health: 0, happiness: 0, energy: 0 },
      ...over,
    });

  it('revives even though live state has not seen the grant yet', () => {
    // `applyBenefit` counts a purchase as granted when EITHER the in-memory
    // updater or the disk write landed. In the disk-only case (IAPHandler
    // unmounted, a clone failure) live state still reads `revivalPack: false`
    // while the player has been charged - refusing there would take $2.99 and
    // leave the character dead, which is the MON-5 failure all over again.
    const stub = createSetGameStateStub(dead());
    stub.setGameState((p) => reviveWithPackUpdater(p, { justPurchased: true }));

    expect(stub.current().showDeathPopup).toBe(false);
    expect(stub.current().stats.health).toBe(100);
  });

  it('and clears the charge, so the disk copy is corrected by the save that follows', () => {
    const stub = createSetGameStateStub(dead({ revivalPack: true }));
    stub.setGameState((p) => reviveWithPackUpdater(p, { justPurchased: true }));

    expect(stub.current().revivalPack).toBe(false);
  });

  it('a double tap in one batch still revives once', () => {
    const stub = createSetGameStateStub(dead());
    stub.setGameState((p) => reviveWithPackUpdater(p, { justPurchased: true }));
    const afterFirst = stub.current().updatedAt;
    stub.setGameState((p) => reviveWithPackUpdater(p, { justPurchased: true }));

    // The second dispatch reads `showDeathPopup: false` from `prev` and bails,
    // so it cannot revive a character who is already alive.
    expect(stub.current().showDeathPopup).toBe(false);
    expect(stub.current().updatedAt).toBe(afterFirst);
    expect(stub.calls()).toBe(2); // both really did dispatch
  });

  it('does not let a live player burn the flag early', () => {
    const alive = createTestGameState({ showDeathPopup: false, revivalPack: true });
    const stub = createSetGameStateStub(alive);
    stub.setGameState((p) => reviveWithPackUpdater(p, { justPurchased: true }));

    expect(stub.current().revivalPack).toBe(true);
  });

  it('and WITHOUT the flag an unpaid revive is still refused (the control)', () => {
    const stub = createSetGameStateStub(dead());
    stub.setGameState((p) => reviveWithPackUpdater(p));

    expect(stub.current().showDeathPopup).toBe(true);
  });
});

describe('the real action keeps the gates inside the updater', () => {
  const BODY = CONTEXT.slice(
    CONTEXT.indexOf('const reviveWithPack'),
    CONTEXT.indexOf('const value = useMemo'),
  );

  it('the helper above is a faithful copy of the shipped updater', () => {
    expect(BODY).toMatch(/wrappedSetGameState\(prev => \{/);
    expect(BODY).toMatch(/if \(!prev\.showDeathPopup\)/);
    expect(BODY).toMatch(/if \(!prev\.revivalPack\)/);
    expect(BODY).toMatch(/if \(!options\?\.justPurchased\)/);
    expect(BODY).toMatch(/revivalPack: false,/);
  });

  it('the death gate is NOT skippable by the purchase path', () => {
    // `justPurchased` waives the banked-charge gate only. A purchase made while
    // alive must still bank and wait - that is the whole MON-5 shape.
    const deathGate = BODY.indexOf('if (!prev.showDeathPopup)');
    const purchaseWaiver = BODY.indexOf('justPurchased');
    expect(deathGate).toBeGreaterThan(-1);
    expect(purchaseWaiver).toBeGreaterThan(deathGate);
  });
});

/**
 * ── The pack is a CONSUMABLE (owner, 2026-08-25) ───────────────────────────
 *
 * It shipped as a Non-Consumable, which meant one purchase per store account
 * ever: after the first revive the $2.99 offer disappeared permanently and a
 * player's only remaining way back from death was 15,000 gems. Everything below
 * is what "consumable" has to mean in the app, as opposed to in the store
 * console.
 */
describe('the Revival Pack is a consumable', () => {
  const { CONSUMABLE_PRODUCTS, NON_CONSUMABLE_PRODUCTS, isConsumableProduct, hasPermanentEntitlements, IAP_PRODUCTS } =
    require('@/utils/iapConfig') as typeof import('@/utils/iapConfig');

  it('is classified as one, and is no longer in the non-consumable list', () => {
    expect(isConsumableProduct(IAP_PRODUCTS.REVIVAL_PACK)).toBe(true);
    expect(CONSUMABLE_PRODUCTS as readonly string[]).toContain(IAP_PRODUCTS.REVIVAL_PACK);
    expect(NON_CONSUMABLE_PRODUCTS as readonly string[]).not.toContain(IAP_PRODUCTS.REVIVAL_PACK);
  });

  it('and carries no permanent entitlement, so Restore has nothing to re-grant', () => {
    // Both restore loops skip `isConsumableProduct(id) && !hasPermanentEntitlements(id)`.
    // If this ever flipped, every Restore Purchases tap would mint a free
    // revive - the charge is inventory, and a spent one is spent.
    expect(hasPermanentEntitlements(IAP_PRODUCTS.REVIVAL_PACK)).toBe(false);
  });

  it('is still finished as a consumable transaction, so the store allows a re-buy', () => {
    // Android will refuse a second purchase of an unconsumed product ("already
    // owned"). Every non-subscription purchase is finished with
    // isConsumable=true, which is what consumes it.
    const IAP = read('services/IAPService.ts');
    expect(IAP).toMatch(/finishTransactionAsync\(\s*purchase,\s*!isSubscriptionProduct\(purchase\.productId\),?\s*\)/);
  });

  it('is still a non-idempotent grant, so one purchase banks exactly one charge', () => {
    const IAP = stripComments(read('services/IAPService.ts'));
    const FN = IAP.slice(IAP.indexOf('function isNonIdempotentGrant'), IAP.indexOf('export class IAPService'));
    expect(FN).toMatch(/IAP_PRODUCTS\.REVIVAL_PACK/);
  });
});

describe('what decides whether the pack can be bought', () => {
  it('the death screen offers it again once the charge is gone', () => {
    // `settings.hasRevivalPack` used to be in this condition, which hid the row
    // forever after the first purchase. Correct for a Non-Consumable; for a
    // consumable it would leave a player who had spent their charge with the
    // 15,000-gem route and nothing else.
    const ACTIONS = DEATH.slice(DEATH.indexOf('<View style={styles.actions}>'));
    expect(ACTIONS).toMatch(/\{!hasBankedRevive && revivalPackPrice \?/);
    expect(ACTIONS).not.toMatch(/settings\.hasRevivalPack/);
  });

  it('and hides it only while a charge is in hand', () => {
    // One at a time is deliberate: `revivalPack` is a boolean, so a second
    // purchase stacked on an unspent one would be money for nothing. The row
    // directly above it spends the charge, so nothing is lost.
    expect(DEATH).toMatch(/const hasBankedRevive = gameState\.revivalPack === true;/);
  });

  it('the shop card closes on the charge, not on having ever bought one', () => {
    // Bounded by the NEXT product entry, whichever it is - LIFETIME_PREMIUM
    // also appears earlier in the file as a hero card, so indexing on it from
    // the front produced an empty slice and a test that asserted nothing.
    const start = SHOP.indexOf('id: IAP_PRODUCTS.REVIVAL_PACK');
    const next = SHOP.indexOf('id: IAP_PRODUCTS.', start + 10);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const CARD = SHOP.slice(start, next);
    expect(CARD).toMatch(/owned: revivalCharged,/);
    expect(CARD).not.toMatch(/hasRevivalPack/);
  });
});

describe('an unspent charge is paid inventory and survives a life boundary', () => {
  const {
    PURCHASED_STATE_KEYS,
    carryAccountLevelEntitlements,
  } = require('@/lib/prestige/accountEntitlements') as typeof import('@/lib/prestige/accountEntitlements');

  it('is listed alongside the other paid inventory', () => {
    // Same category as `youthPills`. It was missing, so prestige and the
    // death-screen "continue as your heir" path both destroyed an unspent
    // $2.99 charge silently.
    expect(PURCHASED_STATE_KEYS as readonly string[]).toContain('revivalPack');
    expect(PURCHASED_STATE_KEYS as readonly string[]).toContain('youthPills');
  });

  it('and the carry actually moves it onto the new life', () => {
    const old = createTestGameState({ revivalPack: true, youthPills: 3 });
    const fresh = createTestGameState({ revivalPack: false, youthPills: 0 });

    const carried = carryAccountLevelEntitlements(old, fresh);

    expect(carried.revivalPack).toBe(true);
    expect(carried.youthPills).toBe(3);
  });

  it('without inventing one for a player who never had a charge (the control)', () => {
    const old = createTestGameState({ revivalPack: false });
    const carried = carryAccountLevelEntitlements(old, createTestGameState({ revivalPack: false }));

    expect(carried.revivalPack).toBe(false);
  });
});
