/**
 * The Vault — prestige tier 2.
 *
 * ## The gap
 *
 * Nothing material has ever crossed a life boundary. Prestige rebuilds the save
 * from `initialGameState`: the cars, the watches, the jet — every luxury piece
 * a player spent a billion dollars assembling — are simply gone. The Dynasty
 * Tree carries stats and cash, and `familyBusinesses` carry a company, but no
 * OBJECT survives. So the most expensive collection in the game is also the
 * most temporary thing in it.
 *
 * ## The design
 *
 * Pay a preservation fee and one piece is put in the Vault. It is there in the
 * next life, and the one after that, until you take it out.
 *
 * Three things make it a decision rather than a freebie:
 *
 *  - **Capacity is one.** Twelve items, one slot. The Long Gallery wing of the
 *    Dynasty Seat (tier 5) raises it to three — which is most of what makes
 *    that wing worth $100M.
 *  - **The fee scales with the piece.** 25% of catalog price, so vaulting the
 *    hypercar costs what vaulting the watch does not, and it is charged NOW,
 *    out of money you were about to lose anyway.
 *  - **Upkeep still applies next life.** A vaulted item is owned, and owned
 *    luxury bleeds `weeklyUpkeep` from week 1. Handing an 18-year-old a jet is
 *    not unambiguously a gift, which is exactly the sort of choice the late
 *    game was missing.
 *
 * ## Why land is excluded
 *
 * Items with a `developable` block mint a real `RealEstate` entry when bought.
 * Restoring the item id alone would give the heir the island without the
 * compound; restoring the property too would duplicate an asset the
 * real-estate system owns. Both answers are wrong, so land does not vault.
 *
 * NEW, not gated: no item crossed a life before this. Nobody loses anything.
 */

import type { DynastyState, GameState, LuxuryHolding } from '@/contexts/game/types';
import { LUXURY_CATALOG, type LuxuryItem } from '@/lib/luxury/catalog';
import { isPrestigeFeatureUnlocked, prestigeUnlockRequirement } from '@/lib/progress/featureUnlocks';
import { hasSeatWing } from './seat';
import { vaultItemIds, withDynasty } from './state';

/** The prestige capability id gating the Vault. */
export const VAULT_FEATURE = 'feature:vault';

/** Slots without the Dynasty Seat's Long Gallery. */
export const VAULT_BASE_CAPACITY = 1;
/** Slots with it. */
export const VAULT_GALLERY_CAPACITY = 3;

/** Preservation fee, as a fraction of the item's catalog price. */
export const VAULT_FEE_FRACTION = 0.25;

export function vaultCapacity(state: GameState | undefined | null): number {
  return hasSeatWing(state, 'seat_long_gallery') ? VAULT_GALLERY_CAPACITY : VAULT_BASE_CAPACITY;
}

export function vaultFee(item: LuxuryItem): number {
  return Math.round(item.price * VAULT_FEE_FRACTION);
}

/** Land mints a property; see the header for why it cannot be preserved. */
export function isVaultable(item: LuxuryItem): boolean {
  return !item.developable;
}

/** Every catalog piece that could go in, whether or not it is owned yet. */
export function vaultableCatalog(): LuxuryItem[] {
  return LUXURY_CATALOG.filter(isVaultable);
}

/** Owned, vaultable, not already inside — what the UI offers. */
export function vaultCandidates(state: GameState | undefined | null): LuxuryItem[] {
  const owned = new Set(Array.isArray(state?.luxuryItems) ? state.luxuryItems : []);
  const inside = new Set(vaultItemIds(state));
  return vaultableCatalog().filter((i) => owned.has(i.id) && !inside.has(i.id));
}

/** What is inside, as catalog entries. Unknown ids are dropped, not thrown on. */
export function vaultContents(state: GameState | undefined | null): LuxuryItem[] {
  const inside = vaultItemIds(state);
  return inside
    .map((id) => LUXURY_CATALOG.find((i) => i.id === id))
    .filter((i): i is LuxuryItem => Boolean(i));
}

export interface VaultResult {
  success: boolean;
  message: string;
  /** Dollars to charge. 0 for a refusal, and 0 for taking an item OUT. */
  cost: number;
  dynasty?: DynastyState;
}

/**
 * Put a piece in the Vault.
 *
 * PURE reducer, same contract as `buySeatWing`: safe to run once for the report
 * and again inside the updater against `prev`. Presence of the id blocks the
 * second run, so a double-tap cannot charge the fee twice (§4.4).
 */
export function storeInVault(
  state: GameState | undefined | null,
  itemId: string
): VaultResult {
  const item = LUXURY_CATALOG.find((i) => i.id === itemId);
  if (!item) return { success: false, message: 'Unknown item.', cost: 0 };

  if (!isPrestigeFeatureUnlocked(state, VAULT_FEATURE)) {
    return { success: false, message: prestigeUnlockRequirement(state, VAULT_FEATURE), cost: 0 };
  }

  if (!isVaultable(item)) {
    return { success: false, message: `${item.name} is land — it cannot leave with you.`, cost: 0 };
  }

  const owned = Array.isArray(state?.luxuryItems) ? state.luxuryItems : [];
  if (!owned.includes(itemId)) {
    return { success: false, message: `You do not own ${item.name}.`, cost: 0 };
  }

  const inside = vaultItemIds(state);
  if (inside.includes(itemId)) {
    return { success: false, message: `${item.name} is already preserved.`, cost: 0 };
  }

  const capacity = vaultCapacity(state);
  if (inside.length >= capacity) {
    return {
      success: false,
      message: capacity === VAULT_BASE_CAPACITY
        ? 'The Vault holds one piece. Build the Long Gallery for more.'
        : `The Vault is full (${capacity}).`,
      cost: 0,
    };
  }

  const fee = vaultFee(item);
  const money = state?.stats?.money;
  const cash = typeof money === 'number' && Number.isFinite(money) ? money : 0;
  if (cash < fee) {
    return {
      success: false,
      message: `Preserving ${item.name} costs $${fee.toLocaleString()} — you have $${Math.floor(cash).toLocaleString()}.`,
      cost: 0,
    };
  }

  return {
    success: true,
    message: `${item.name} will be there when you are not.`,
    cost: fee,
    dynasty: withDynasty(state, { vaultItemIds: [...inside, itemId] }),
  };
}

/**
 * Take a piece out. Free, and NOT refunded — the fee bought preservation, not
 * an option. Refunding it would make vaulting-then-unvaulting a way to park
 * money through a prestige, which is precisely the thing the Endowment (tier 3)
 * charges for.
 */
export function removeFromVault(
  state: GameState | undefined | null,
  itemId: string
): VaultResult {
  const inside = vaultItemIds(state);
  if (!inside.includes(itemId)) {
    return { success: false, message: 'That piece is not in the Vault.', cost: 0 };
  }
  const item = LUXURY_CATALOG.find((i) => i.id === itemId);
  return {
    success: true,
    message: `${item?.name ?? 'The piece'} is out of the Vault. The fee is not refunded.`,
    cost: 0,
    dynasty: withDynasty(state, { vaultItemIds: inside.filter((id) => id !== itemId) }),
  };
}

/**
 * Seed a freshly-built life with whatever is in the Vault.
 *
 * Mutates `newState` because it is called from inside `createResetGameState` /
 * `createChildGameState`, which are building an object nobody else can see yet.
 *
 * `acquiredWeek: 0` — the new life is at week 0, and appreciation reads the
 * holding's own `currentValue` (absent = catalog price), so an heirloom arrives
 * valued exactly as the catalog says rather than carrying a stale drift from a
 * life that no longer exists.
 */
export function applyVaultToNewLife(
  newState: GameState,
  vaultIds: readonly string[]
): void {
  const ids = vaultIds.filter((id) => LUXURY_CATALOG.some((i) => i.id === id));
  if (ids.length === 0) return;

  const existing = Array.isArray(newState.luxuryItems) ? newState.luxuryItems : [];
  newState.luxuryItems = Array.from(new Set([...existing, ...ids]));

  const holdings: Record<string, LuxuryHolding> = { ...(newState.luxuryHoldings ?? {}) };
  for (const id of ids) {
    if (!holdings[id]) holdings[id] = { acquiredWeek: 0 };
  }
  newState.luxuryHoldings = holdings;
}
