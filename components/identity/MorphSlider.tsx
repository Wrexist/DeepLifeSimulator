/**
 * A single morph slider.
 *
 * Hand-rolled rather than pulled from a package: the project has no slider
 * dependency today, and `@react-native-community/slider` is a native module —
 * adding one would mean another native build gate and another entry in the
 * config-plugin alignment that Hard Rule 4 exists to protect. A PanResponder
 * over a measured track is about forty lines and has no such cost.
 *
 * Emits CONTINUOUSLY while dragging, because the whole point is watching the
 * head change under your thumb. The head rebuild is ~3k vertices of pure
 * arithmetic, which is comfortably inside a frame.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { getThemeColors, radii, spacing } from '@/lib/config/theme';
import { haptic } from '@/utils/haptics';
import { fontScale, scale } from '@/utils/scaling';

export interface MorphSliderProps {
  label: string;
  /** [0, 1]. */
  value: number;
  onChange: (value: number) => void;
  darkMode?: boolean;
}

export default function MorphSlider({
  label,
  value,
  onChange,
  darkMode = true,
}: MorphSliderProps): React.JSX.Element {
  const theme = getThemeColors(darkMode);
  const [trackWidth, setTrackWidth] = useState(0);
  // Refs, not state: the pan handlers are created once, and reading a stale
  // `trackWidth`/`value` from a closure would make the thumb jump on every drag.
  const widthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setTrackWidth(w);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Claim the gesture so the parent ScrollView does not steal a horizontal
        // drag — without this the slider is unusable inside a scrolling sheet.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const w = widthRef.current;
          if (w > 0) onChange(clamp01(evt.nativeEvent.locationX / w));
        },
        onPanResponderMove: (_evt, gesture) => {
          const w = widthRef.current;
          if (w <= 0) return;
          onChange(clamp01(valueRef.current + gesture.dx / w * 0.02));
        },
        // Spec §8: haptic on RELEASE, not during the drag. Firing per-move
        // would buzz continuously for the whole gesture, which reads as a fault
        // rather than as feedback.
        onPanResponderRelease: () => haptic.light(),
      }),
    [onChange],
  );

  const pct = clamp01(value);
  const thumbLeft = Math.max(0, Math.min(trackWidth - scale(18), pct * trackWidth - scale(9)));

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.trackWrap} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${pct * 100}%`,
                backgroundColor: ACCENT,
                // Spec §8 "thin track with glow" — the glow is what stops a 5px
                // track reading as a hairline on an OLED black background.
                shadowColor: ACCENT,
                shadowOpacity: 0.85,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          />
        </View>
        <View
          style={[
            styles.thumb,
            { left: thumbLeft, backgroundColor: ACCENT, borderColor: '#070A10' },
          ]}
        />
      </View>
      {/* Spec §8 "floating value indicator". A slider with no readout gives the
          player no way to return to a value they liked, or to describe one. */}
      <Text style={[styles.value, { color: theme.textSecondary }]}>{Math.round(pct * 100)}</Text>
    </View>
  );
}

function clamp01(n: number): number {
  return !isFinite(n) ? 0.5 : n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Spec §2 accent. Hard-coded rather than themed — see FaceStudio's palette note. */
const ACCENT = '#4C8DFF';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    width: scale(104),
    fontSize: fontScale(12),
    marginRight: spacing.sm,
  },
  trackWrap: {
    flex: 1,
    height: scale(32),
    justifyContent: 'center',
  },
  track: {
    height: scale(5),
    borderRadius: radii.round,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.round,
  },
  value: {
    width: scale(26),
    textAlign: 'right',
    fontSize: fontScale(12),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.sm,
  },
  thumb: {
    position: 'absolute',
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    borderWidth: 2,
  },
});
