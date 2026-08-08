/**
 * ImageScrim — a real bottom fade over artwork.
 *
 * ## Why this exists
 *
 * Card artwork needs a darkened base so an overlaid title stays legible. The
 * obvious tool is `LinearGradient`, but `expo-linear-gradient` is BANNED
 * app-wide — direct imports hard-abort on iOS 26 TurboModule init (recorded as
 * P0-7/P0-8 in `tasks/critical-bugs-2026-05-29.md`). Every call site used to go
 * through `LinearGradientFallback`, which took `colors[0]` and painted a flat
 * block: a `['transparent', 'black']` scrim disappeared, and a
 * `['black', 'transparent']` one became an opaque slab across the art. Call
 * sites now render `components/ui/Gradient` (SVG) and the flat fallback is
 * deleted — but this component stays, because a scrim wants exactly one
 * purpose-built shape and gets to own its alpha curve.
 *
 * Four separate surfaces independently settled for a single flat band —
 * `height: '55%', backgroundColor: 'rgba(15, 23, 42, 0.9)'` and friends — which
 * is a hard horizontal edge at 90% opacity across the middle of every painting.
 *
 * ## Why SVG, not stacked Views
 *
 * The first version of this component faked the fade with a stack of flat
 * bands. That removed the hard edge but replaced it with visible BANDING, and
 * more steps could not fix it: banding is quantisation of the composited
 * colour, not of pixels. Over the Optimist card's yellow sun (~250,190,60)
 * against slate (15,23,42), one channel spans ~235 levels, so an alpha step of
 * 0.05 is a 12-level jump — plainly visible. Getting under one level would need
 * ~250 bands per card.
 *
 * `react-native-svg` renders a genuinely interpolated gradient and is already
 * an established, safe dependency here (`GradientButton`, `ProgressRing`,
 * `DeepLifePlusUpsell` all import it directly). It is a different library from
 * the crashing Expo module. So: one `<Rect>` filled by a real
 * `<LinearGradient>`, smooth at any size, and ONE node per card instead of
 * eighteen.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

interface ImageScrimProps {
  /** How far up the image the fade reaches, as a fraction (0–1). */
  height?: number;
  /** Alpha at the very bottom — the darkest point, behind the title. */
  strength?: number;
  /** Base colour. Defaults to the app's slate-900. */
  color?: string;
}

/**
 * Unique gradient id per instance.
 *
 * SVG `<Defs>` ids share one document namespace on web, so two scrims with the
 * same id would both resolve to whichever mounted last. `GradientButton` solves
 * it the same way.
 */
let _gid = 0;

/**
 * Stops approximating a quadratic ramp.
 *
 * A linear fade reads as a wash that starts abruptly partway up the image;
 * squaring keeps the top near-invisible and concentrates the darkening into the
 * last third, where the text actually sits — so the art stays clear far higher
 * up for the same legibility. These are `t` and `t²` at five points; SVG
 * interpolates smoothly between them, so five stops is a curve, not five steps.
 */
const CURVE: readonly [number, number][] = [
  [0, 0],
  [0.25, 0.0625],
  [0.5, 0.25],
  [0.75, 0.5625],
  [1, 1],
];

export default function ImageScrim({
  height = 0.45,
  strength = 0.72,
  color = '#0F172A',
}: ImageScrimProps) {
  const gid = useMemo(() => `scrim-${(_gid += 1)}`, []);

  const clampedHeight = Math.max(0, Math.min(1, height));
  const clampedStrength = Math.max(0, Math.min(1, strength));

  if (clampedHeight <= 0 || clampedStrength <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        // Occupy only the fading portion, anchored to the bottom, so the SVG
        // viewport maps 1:1 onto the ramp.
        { height: `${clampedHeight * 100}%` },
      ]}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1">
        <Defs>
          <SvgLinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            {CURVE.map(([offset, t]) => (
              <Stop
                key={offset}
                offset={String(offset)}
                stopColor={color}
                stopOpacity={t * clampedStrength}
              />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
