/**
 * Cosmetic actions — pure GameState transformers for equipping Legacy Pass
 * cosmetics. Cosmetics are purely visual; equipping never affects gameplay.
 */
import type { GameState } from '@/contexts/game/types';
import { getCosmetic, type CosmeticType } from '@/lib/cosmetics/cosmetics';

/** Equip an owned cosmetic into its slot (frame/theme). No-op if not owned/known. */
export function equipCosmetic(state: GameState, id: string): GameState {
  const cosmetic = getCosmetic(id);
  if (!cosmetic) return state;
  const owned = state.legacyPass?.ownedCosmetics;
  if (!Array.isArray(owned) || !owned.includes(id)) return state; // can't equip what you don't own
  return {
    ...state,
    equippedCosmetics: { ...state.equippedCosmetics, [cosmetic.type]: id },
  };
}

/** Clear the cosmetic equipped in a slot. No-op if nothing is equipped there. */
export function unequipCosmetic(state: GameState, type: CosmeticType): GameState {
  const current = state.equippedCosmetics;
  if (!current || current[type] === undefined) return state;
  const next = { ...current };
  delete next[type];
  return { ...state, equippedCosmetics: next };
}

/** Toggle: equip if not equipped in its slot, unequip if it already is. */
export function toggleCosmetic(state: GameState, id: string): GameState {
  const cosmetic = getCosmetic(id);
  if (!cosmetic) return state;
  const equippedInSlot = state.equippedCosmetics?.[cosmetic.type];
  return equippedInSlot === id ? unequipCosmetic(state, cosmetic.type) : equipCosmetic(state, id);
}
