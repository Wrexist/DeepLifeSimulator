/**
 * LiquidGlassDisc - the shared "liquid glass" material for the HUD's round
 * controls (shop, settings, season).
 *
 * WHY. Those controls were flat slate discs, and the season disc carried a 1px
 * white border. On a circle clipped by `overflow: 'hidden'` that border
 * anti-aliases into pale crescents around the rim (owner screenshot,
 * 2026-09-18). Flat fill also has no depth. This replaces both problems with
 * layered light rather than a stroke: a translucent body lit from the top-left,
 * a soft specular dome near the top, an accent bloom behind the glyph, and a
 * shaded lower edge. There is deliberately NO uniform border, so the crescents
 * cannot return.
 *
 * The material is SVG gradients plus plain views, so it renders identically on
 * web and native without pulling in a blur native module.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Gradient from '@/components/ui/Gradient';

interface LiquidGlassDiscProps {
  /**
   * Identity colour for the bloom behind the glyph (a season colour, or a
   * control accent). Six-digit hex; optional.
   */
  accent?: string;
  /** Extra style for the clipped disc (usually sizing/flex). */
  style?: StyleProp<ViewStyle>;
  /** 0-1 specular dome strength. Lower it for a quieter control. */
  specular?: number;
  children?: React.ReactNode;
}

/** 8-digit hex alpha that `Gradient` splits into colour + opacity. */
const withAlpha = (hex: string, alpha: number): string => {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
};

export default function LiquidGlassDisc({
  accent,
  style,
  specular = 0.22,
  children,
}: LiquidGlassDiscProps) {
  return (
    <View style={[styles.disc, style]}>
      {/* Glass body, lit from the top-left. */}
      <Gradient
        colors={['rgba(226,232,240,0.20)', 'rgba(30,41,59,0.42)', 'rgba(2,6,23,0.55)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Accent bloom behind the glyph, so the icon sits IN the glass. */}
      {!!accent && (
        <Gradient
          colors={[withAlpha(accent, 0.4), withAlpha(accent, 0)]}
          start={{ x: 0.5, y: 0.12 }}
          end={{ x: 0.5, y: 0.95 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {/* Shaded lower edge: the depth cue that replaces the outline. */}
      <Gradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)']}
        start={{ x: 0.5, y: 0.58 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Specular dome near the top edge. */}
      <View style={[styles.specular, { opacity: specular }]} pointerEvents="none" />
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
  },
  specular: {
    position: 'absolute',
    top: '7%',
    left: '20%',
    right: '20%',
    height: '30%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
