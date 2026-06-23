import React from 'react';
import { StyleSheet, View } from 'react-native';

interface FooterScrimProps {
  /** Opaque base color to fade up to (e.g. the screen background hex). */
  color: string;
  /** Total height of the scrim, in px. */
  height: number;
}

const BANDS = 8;

/**
 * A bottom-anchored fade from transparent (top) to a solid base color (bottom).
 *
 * We render a stack of solid bands with increasing opacity instead of a
 * LinearGradient because the app's LinearGradient is a fallback that only
 * paints its first color — it can't render a true multi-stop gradient. Plain
 * stacked Views give a real, dependency-free fade on every platform, so list
 * content dissolves into the background behind a floating CTA rather than
 * showing through the gap around it.
 */
export default function FooterScrim({ color, height }: FooterScrimProps) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]}>
      {Array.from({ length: BANDS }).map((_, index) => {
        // Ease-in so the top stays faint and the bottom ~third is fully opaque,
        // which is where the CTA sits — nothing peeks through behind it.
        const opacity = Math.min(1, Math.pow((index + 1) / BANDS, 1.5) * 1.25);
        return <View key={index} style={{ flex: 1, backgroundColor: color, opacity }} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    zIndex: 5,
  },
});
