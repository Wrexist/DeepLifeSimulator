/**
 * LiquidGlassDisc - the shared "liquid glass" material for the HUD's round
 * controls (shop, settings, season).
 *
 * WHY. Those controls were flat slate discs, and the season disc carried a 1px
 * white border that anti-aliased into pale crescents once clipped by
 * `overflow: 'hidden'` (owner screenshot, 2026-09-18). This replaces the border
 * with light: a translucent body, a soft accent bloom behind the glyph and a
 * faint top sheen.
 *
 * WHY NO GRADIENTS. The HUD is mounted for the whole session, and the
 * compact-HUD pass deliberately moved these controls OFF gradients to save an
 * SVG layer each (see TopStatsBar). The UI ratchet also forbids adding JSX
 * gradients. The depth here is plain translucent Views, so the material costs
 * no SVG layers and no ratchet budget.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface LiquidGlassDiscProps {
  /**
   * Identity colour for the bloom behind the glyph (a season colour, or a
   * control accent). Six-digit hex; optional.
   */
  accent?: string;
  /** Extra style for the clipped disc (usually sizing/flex). */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** 8-digit hex alpha for a translucent View background. */
const withAlpha = (hex: string, alpha: number): string => {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
};

export default function LiquidGlassDisc({ accent, style, children }: LiquidGlassDiscProps) {
  return (
    <View style={[styles.disc, style]}>
      {/* Accent bloom behind the glyph, so the icon sits IN the glass. A plain
          translucent circle rather than a radial gradient. */}
      {!!accent && (
        <View
          pointerEvents="none"
          style={[styles.bloom, { backgroundColor: withAlpha(accent, 0.18) }]}
        />
      )}
      {/* Faint top sheen. Low alpha, so the one hard edge inside the circle is
          invisible; deliberately not a bright bubble or a dark bottom slab. */}
      <View pointerEvents="none" style={styles.sheen} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(51,65,85,0.5)',
  },
  bloom: {
    position: 'absolute',
    width: '64%',
    height: '64%',
    borderRadius: 999,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
