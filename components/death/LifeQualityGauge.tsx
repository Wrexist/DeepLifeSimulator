/**
 * The Life Quality arc.
 *
 * A semicircle that fills left-to-right with the score, a face in the middle
 * that matches it, and the percentage underneath.
 *
 * ## Why it is built from views and not an SVG
 *
 * `react-native-svg` is in the tree, but this screen is the one place in the
 * app where a render error is unrecoverable: the death modal's close handler is
 * gated, so anything that throws here leaves the player looking at a crash
 * screen with a dead save behind it. The arc is therefore plain views, which
 * cannot fail to measure and need no native module.
 *
 * ## The geometry, because it is easy to get subtly wrong
 *
 * A border colour on a circle paints a 90° quadrant whose seams sit on the 45°
 * diagonals — so `borderTopColor` alone covers 135°→45°, not the top-left
 * quarter. Rotating the ring by -45° moves that painted quadrant to exactly
 * 180°→90°, which IS the top-left quarter, and one quadrant is the largest
 * piece that can be swept without a second mask.
 *
 * So the arc is two quadrants, each in its own square mask, each holding a ring
 * positioned so its CENTRE sits on the mask corner that the arc pivots around.
 * A rotation transform defaults to the element's own centre, so placing the
 * centre there makes `rotate` sweep the arc around the gauge's origin for free.
 *
 *   left  quadrant: mask (0,0,W/2,W/2), ring at (0,0,W,W)      → centre at mask BR
 *   right quadrant: mask (W/2,0,W/2,W/2), ring at (-W/2,0,W,W) → centre at mask BL
 *
 * Each sweeps 90° from fully-outside-its-mask to fully-filling it. A first
 * draft rotated a single half-ring and clipped it twice; it rendered a full
 * circle at low values, because the untouched left/right border colours were
 * still painted.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Frown, Meh, Smile, Laugh, Angry } from 'lucide-react-native';
import { getThemeColors } from '@/lib/config/theme';
import { fontScale, scale } from '@/utils/scaling';
import type { LifeQuality } from '@/lib/legacy/lifeQuality';

interface Props {
  quality: LifeQuality;
  darkMode: boolean;
  /** Outer diameter of the arc. */
  size?: number;
}

const FACES = {
  bleak: Angry,
  poor: Frown,
  fair: Meh,
  good: Smile,
  great: Laugh,
} as const;

/** The arc's colour, so a squandered life is not celebrated in the same purple. */
const ARC_COLOR = {
  bleak: '#B91C1C',
  poor: '#7C3AED',
  fair: '#7C3AED',
  good: '#8B5CF6',
  great: '#A78BFA',
} as const;

function LifeQualityGauge({ quality, darkMode, size = scale(104) }: Props) {
  const c = getThemeColors(darkMode);
  const s = makeStyles(darkMode, size);

  const fraction = Math.max(0, Math.min(1, quality.score / 100));
  const Face = FACES[quality.mood];
  const color = ARC_COLOR[quality.mood];

  // The two 90° halves of the sweep. The left quadrant fills first.
  const left = Math.min(fraction, 0.5) * 2;
  const right = Math.max(0, fraction - 0.5) * 2;

  return (
    <View
      style={s.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={`Life quality ${quality.score} percent, ${quality.verdict}`}
      accessibilityValue={{ min: 0, max: 100, now: quality.score }}
    >
      <View style={s.arcBox}>
        {/* Unfilled track: a full ring in a half-height clip, so only its top
            semicircle shows. All four borders are painted because the bottom
            half is clipped away regardless. */}
        <View style={[s.ring, { borderColor: darkMode ? '#2A3140' : '#D8DBE3' }]} />

        <View style={s.maskLeft}>
          <View
            style={[
              s.ring,
              s.quadrant,
              { borderTopColor: color, transform: [{ rotate: `${-135 + left * 90}deg` }] },
            ]}
          />
        </View>

        <View style={s.maskRight}>
          <View
            style={[
              s.ring,
              s.quadrant,
              s.ringShifted,
              { borderTopColor: color, transform: [{ rotate: `${-45 + right * 90}deg` }] },
            ]}
          />
        </View>

        <View style={s.face}>
          <Face size={size * 0.26} color={c.textSecondary} strokeWidth={1.8} />
        </View>
      </View>

      <Text style={s.label}>Life Quality</Text>
      {/* One string, not `{score}%` — that renders as two text nodes and can
          break the sign onto its own line at large font scales. */}
      <Text style={[s.value, { color }]}>{`${quality.score}%`}</Text>
    </View>
  );
}

const makeStyles = (darkMode: boolean, size: number) => {
  const c = getThemeColors(darkMode);
  const border = Math.max(scale(5), size * 0.075);
  const half = size / 2;

  return StyleSheet.create({
    wrap: { alignItems: 'center' },
    // Half-height, so every ring inside shows only its top semicircle.
    arcBox: { width: size, height: half, overflow: 'hidden' },
    ring: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: size,
      height: size,
      borderRadius: half,
      borderWidth: border,
    },
    // One painted quadrant. The other three sides MUST be transparent or the
    // rotation reveals a full circle at low values.
    quadrant: {
      borderRightColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: 'transparent',
    },
    /** Pulls the right quadrant's ring so its centre lands on the mask's bottom-left. */
    ringShifted: { left: -half },
    maskLeft: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: half,
      height: half,
      overflow: 'hidden',
    },
    maskRight: {
      position: 'absolute',
      top: 0,
      left: half,
      width: half,
      height: half,
      overflow: 'hidden',
    },
    face: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    label: { fontSize: fontScale(11.5), color: c.textSecondary, marginTop: scale(5) },
    value: { fontSize: fontScale(22), fontWeight: '800' },
  });
};

export default React.memo(LifeQualityGauge);
