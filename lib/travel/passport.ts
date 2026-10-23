/**
 * The one answer to "does this life own a passport?" (APP2-5).
 *
 * A passport can be bought in two places: the market (which sets the
 * `passport` item's `owned`) and the Travel app (which set only
 * `travel.passportOwned`). Every travel gate already accepted either, but the
 * market read only the item, so a passport bought in Travel was offered for
 * sale again at full price, and selling the market one left the travel flag
 * standing. Both screens and both actions now read and write through here.
 *
 * `travel.passportOwned` stays a valid source on its own: saves written before
 * this carry it without the item, and rewriting them would need a migration.
 */
import type { GameState, Item } from '@/contexts/game/types';

export const PASSPORT_ITEM_ID = 'passport';

export function ownsPassport(state: Pick<GameState, 'items' | 'travel'>): boolean {
  if (state.travel?.passportOwned) return true;
  return !!state.items?.find((i) => i.id === PASSPORT_ITEM_ID)?.owned;
}

/** `item.owned`, except that the passport also counts the Travel app's flag. */
export function isItemOwned(state: Pick<GameState, 'items' | 'travel'>, item: Pick<Item, 'id' | 'owned'>): boolean {
  if (item.id === PASSPORT_ITEM_ID) return ownsPassport(state);
  return !!item.owned;
}
