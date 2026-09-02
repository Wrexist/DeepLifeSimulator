/**
 * Luxury & Collectibles — artwork wiring + per-tier visual tokens.
 *
 * The card / detail ARTWORK BANNER pulls a bundled image from LUXURY_ART keyed by
 * catalog id. Metro/RN cannot require() a path assembled at runtime, so every
 * entry is a spelled-out static require (mirrors RealEstateApp's PROPERTY_IMAGES).
 *
 * The PNGs are generated SEPARATELY from assets/images/luxury/ART-PROMPTS.md and
 * dropped into assets/images/luxury/. Until an image lands its line stays
 * commented out, so the map SHIPS EMPTY and the bundle never references a missing
 * file — the UI falls back to the per-tier solid placeholder below. To enable
 * an image: drop `<id>.png` into assets/images/luxury/ and UNCOMMENT its line
 * (the filename MUST equal the catalog id — see the .md).
 */

import type { ImageSourcePropType } from 'react-native';
import type { LuxuryItem } from '@/lib/luxury';

/**
 * Catalog id → bundled artwork.
 *
 * All twelve are LIVE and every entry resolves. If a file is ever removed,
 * comment its line back out rather than leaving a dangling require: Metro
 * resolves these at bundle time, so a missing file is a build failure, not a
 * runtime fallback.
 *
 * JPEG, not PNG. These are photographs, and PNG is a lossless format built for
 * flat graphics — as PNG the same twelve images weighed 25.1 MB against 3.7 MB
 * as JPEG q88, for a difference nobody can see at banner size. That 21 MB came
 * straight off the app download. Keep new art in .jpg for the same reason;
 * PNG is only the right choice here for something with transparency.
 */
export const LUXURY_ART: Record<string, ImageSourcePropType> = {
  'rare_watch_collection': require('@/assets/images/luxury/rare_watch_collection.webp'),
  'museum_diamond':        require('@/assets/images/luxury/museum_diamond.webp'),
  'fine_art_collection':   require('@/assets/images/luxury/fine_art_collection.webp'),
  'supercar':              require('@/assets/images/luxury/supercar.jpg'),
  'racehorse':             require('@/assets/images/luxury/racehorse.webp'),
  'vineyard_estate':       require('@/assets/images/luxury/vineyard_estate.jpg'),
  'luxury_yacht':          require('@/assets/images/luxury/luxury_yacht.webp'),
  'private_jet':           require('@/assets/images/luxury/private_jet.webp'),
  'private_island':        require('@/assets/images/luxury/private_island.jpg'),
  'trophy_penthouse':      require('@/assets/images/luxury/trophy_penthouse.webp'),
  'mega_yacht':            require('@/assets/images/luxury/mega_yacht.jpg'),
  'sports_team_stake':     require('@/assets/images/luxury/sports_team_stake.webp'),
};

/** Resolve bundled artwork for an item id, or null to use the solid fallback. */
export function luxuryArtFor(id: string): ImageSourcePropType | null {
  return LUXURY_ART[id] ?? null;
}

/** Visual language for a coarse catalog tier (the tinted chip + placeholder wash). */
export interface LuxuryTierVisual {
  /** Uppercase chip label. */
  label: string;
  /** Bright accent — chip text, emoji glow, price accent. */
  accent: string;
  /** Translucent accent fill for the chip / blob background. */
  accentSoft: string;
  /** Translucent accent border for the chip. */
  accentBorder: string;
  /**
   * Solid placeholder wash, used only if an item ever ships without artwork
   * (all twelve resolve today). It was a two-stop gradient; a flat tier-tinted
   * shade over the deep base reads the same at banner size and costs no SVG.
   */
  placeholder: string;
}

/**
 * The catalog's four coarse tiers, made visual with distinct accents:
 * blue → violet → gold → rose, entry through ultra.
 */
export const LUXURY_TIER_VISUALS: Record<LuxuryItem['tier'], LuxuryTierVisual> = {
  entry: {
    label: 'ENTRY',
    accent: '#60A5FA',
    accentSoft: 'rgba(59, 130, 246, 0.16)',
    accentBorder: 'rgba(59, 130, 246, 0.36)',
    placeholder: '#14284A',
  },
  premium: {
    label: 'PREMIUM',
    accent: '#A78BFA',
    accentSoft: 'rgba(139, 92, 246, 0.16)',
    accentBorder: 'rgba(139, 92, 246, 0.36)',
    placeholder: '#241A4A',
  },
  elite: {
    label: 'ELITE',
    accent: '#FBBF24',
    accentSoft: 'rgba(245, 158, 11, 0.16)',
    accentBorder: 'rgba(245, 158, 11, 0.38)',
    placeholder: '#33280F',
  },
  ultra: {
    label: 'ULTRA',
    accent: '#F472B6',
    accentSoft: 'rgba(236, 72, 153, 0.16)',
    accentBorder: 'rgba(236, 72, 153, 0.36)',
    placeholder: '#331333',
  },
};

/** Tier visual with a defensive fallback for unknown/legacy tiers. */
export function luxuryTierVisual(tier: LuxuryItem['tier']): LuxuryTierVisual {
  return LUXURY_TIER_VISUALS[tier] ?? LUXURY_TIER_VISUALS.entry;
}
