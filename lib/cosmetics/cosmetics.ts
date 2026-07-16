/**
 * Cosmetics catalog — maps Legacy Pass cosmetic ids to renderable metadata.
 *
 * Cosmetics are earned from the pass (`legacyPass.ownedCosmetics`) and are purely
 * visual (no gameplay effect). Two types today:
 *   - `frame` — a colored ring around the player's avatar/profile.
 *   - `theme` — a background tint for the profile/home surface.
 *
 * `getCosmetic` falls back to a sensible default for any well-formed `legacy_*`
 * id not in the explicit registry, so newly-added reward ids still render.
 */
export type CosmeticType = 'frame' | 'theme';

export interface Cosmetic {
  id: string;
  name: string;
  type: CosmeticType;
  /** Display color (hex) used for the swatch/preview. */
  color: string;
}

// Keyed to Legacy Pass season tiers (`legacy_<type>_s_<tier>`). Each id the
// reward track hands out (see lib/legacyPass/legacyPass.ts buildRewardTable) has
// a distinct look here, so the pass has visible variety instead of collapsing to
// one generic frame + one generic theme. Any id NOT listed still resolves via the
// pattern fallback below.
const REGISTRY: Record<string, Cosmetic> = {
  // Frames (avatar rings)
  legacy_frame_s_free: { id: 'legacy_frame_s_free', name: 'Legacy Frame', type: 'frame', color: '#F59E0B' },
  legacy_frame_s_5: { id: 'legacy_frame_s_5', name: 'Bronze Frame', type: 'frame', color: '#B45309' },
  legacy_frame_s_16: { id: 'legacy_frame_s_16', name: 'Rose Gold Frame', type: 'frame', color: '#FB7185' },
  legacy_frame_s_18: { id: 'legacy_frame_s_18', name: 'Verdant Frame', type: 'frame', color: '#22C55E' },
  legacy_frame_s_22: { id: 'legacy_frame_s_22', name: 'Obsidian Frame', type: 'frame', color: '#334155' },
  // Themes (profile/home background tints)
  legacy_theme_s_8: { id: 'legacy_theme_s_8', name: 'Forest Theme', type: 'theme', color: '#10B981' },
  legacy_theme_s_10: { id: 'legacy_theme_s_10', name: 'Midnight Theme', type: 'theme', color: '#6366F1' },
  legacy_theme_s_12: { id: 'legacy_theme_s_12', name: 'Aurora Theme', type: 'theme', color: '#8B5CF6' },
  legacy_theme_s_14: { id: 'legacy_theme_s_14', name: 'Ocean Theme', type: 'theme', color: '#0EA5E9' },
  legacy_theme_s_20: { id: 'legacy_theme_s_20', name: 'Ember Theme', type: 'theme', color: '#EF4444' },
};

/** Resolve a cosmetic id to its metadata, with a pattern fallback for new ids. */
export function getCosmetic(id: string): Cosmetic | undefined {
  if (REGISTRY[id]) return REGISTRY[id];
  if (typeof id === 'string') {
    if (id.startsWith('legacy_frame')) return { id, name: 'Legacy Frame', type: 'frame', color: '#F59E0B' };
    if (id.startsWith('legacy_theme')) return { id, name: 'Seasonal Theme', type: 'theme', color: '#6366F1' };
  }
  return undefined;
}

/** Resolve a list of owned ids to renderable cosmetics, dropping anything unknown. */
export function resolveOwnedCosmetics(ids: string[] | undefined): Cosmetic[] {
  if (!Array.isArray(ids)) return [];
  return ids.map(getCosmetic).filter((c): c is Cosmetic => !!c);
}
