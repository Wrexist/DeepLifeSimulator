import { uiPalette } from '@/lib/config/theme';
import type { ImageSourcePropType } from 'react-native';
import type { LuxuryItem } from '@/lib/luxury';
import { LUXURY_ART } from '@/lib/content/luxuryArtAssets';
export { LUXURY_ART } from '@/lib/content/luxuryArtAssets';

/** Original illustrated art; provenance and deterministic crops in art/luxury-v2. */
export function luxuryArtFor(id: string): ImageSourcePropType | null {
  return Object.prototype.hasOwnProperty.call(LUXURY_ART, id) ? LUXURY_ART[id] : null;
}

/** Visual language for a coarse catalog tier (the tinted chip + placeholder wash). */
export interface LuxuryTierVisual {
  /** Uppercase chip label. */
  label: string;
  /** Bright accent — chip text and price accent. */
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
    accent: uiPalette.blue,
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
