/**
 * ImageScrim — a real bottom fade over artwork, built from plain Views.
 *
 * ## Why this exists
 *
 * Card artwork needs a darkened base so an overlaid title stays legible. The
 * obvious tool is `LinearGradient`, but this app renders it through
 * `LinearGradientFallback`, which takes the FIRST colour and paints a flat
 * block. A `['transparent', 'black']` scrim therefore disappears, and a
 * `['black', 'transparent']` one becomes an opaque slab across the art.
 *
 * So the scenario card settled for a single band —
 * `height: '55%', backgroundColor: 'rgba(15, 23, 42, 0.9)'` — which is a hard
 * horizontal edge at 90% opacity across the middle of every painting. Over half
 * of each illustration was simply not visible, and the boundary read as a
 * rendering fault rather than a design choice.
 *
 * This builds the fade out of what always works: a stack of non-overlapping
 * absolutely-positioned bands, each a solid colour at its own alpha. Enough
 * steps and the banding is imperceptible; because the slices do not overlap,
 * the alpha at any height is exactly what the curve says, with no compounding.
 *
 * No native module, no fallback hazard, identical on iOS, Android and web.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

interface ImageScrimProps {
  /** How far up the image the fade reaches, as a fraction (0–1). */
  height?: number;
  /** Alpha at the very bottom — the darkest point, behind the title. */
  strength?: number;
  /**
   * Number of bands.
   *
   * Banding shows up as ALPHA steps, not pixel steps, so the number that
   * matters is the largest jump between adjacent bands — with quadratic easing
   * that is the pair nearest the bottom. At 10 steps and strength 0.7 the
   * bottom jump is ~0.12, which is invisible over busy artwork but clearly
   * visible over a large flat saturated area (it showed on the Pulse profile
   * cover, which is a solid pink field). 18 halves it.
   *
   * Raise it further for big single surfaces; the bands are empty Views, so the
   * cost is trivial — but they DO multiply across list items, which is why the
   * default is not simply set to 30.
   */
  steps?: number;
  /** Base colour as an "r, g, b" triplet. Defaults to the app's slate-900. */
  rgb?: string;
}

/**
 * Quadratic easing.
 *
 * A linear ramp still reads as a visible wash starting abruptly partway up the
 * image. Squaring keeps the top of the fade near-invisible and concentrates the
 * darkening into the last third, where the text actually sits — so the art
 * stays clear far higher up for the same legibility.
 */
const ease = (t: number): number => t * t;

export default function ImageScrim({
  height = 0.45,
  strength = 0.72,
  steps = 18,
  rgb = '15, 23, 42',
}: ImageScrimProps) {
  const bands = useMemo(() => {
    const clampedHeight = Math.max(0, Math.min(1, height));
    const clampedStrength = Math.max(0, Math.min(1, strength));
    const count = Math.max(2, Math.round(steps));
    const slice = (clampedHeight / count) * 100;

    return Array.from({ length: count }, (_, i) => {
      // Band i spans [i, i+1) slices up from the bottom. `t` is 1 at the very
      // bottom and approaches 0 at the top of the fade.
      const t = (count - i - 0.5) / count;
      return {
        key: i,
        bottom: `${i * slice}%` as const,
        height: `${slice}%` as const,
        // Overlap each band by a hairline so no seam shows on fractional
        // device pixels (a 0.5pt gap at 3x is a visible light line).
        marginBottom: -StyleSheet.hairlineWidth,
        backgroundColor: `rgba(${rgb}, ${(ease(t) * clampedStrength).toFixed(3)})`,
      };
    });
  }, [height, strength, steps, rgb]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bands.map((b) => (
        <View
          key={b.key}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: b.bottom,
            height: b.height,
            marginBottom: b.marginBottom,
            backgroundColor: b.backgroundColor,
          }}
        />
      ))}
    </View>
  );
}
