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
 *
 * ## Screen readers
 *
 * A drag is not an interface everyone has. `accessibilityRole="adjustable"`
 * plus increment/decrement ACTIONS is what makes this operable by swiping up
 * and down under VoiceOver and TalkBack — the role alone announces the control
 * and then offers no way to move it, which is arguably worse than an
 * unlabelled one, because it promises something it does not deliver.
 *
 * The announced value is the SIGNED readout the sighted user sees (-100..+100
 * around a neutral midpoint), not the stored 0..1. Two people looking at the
 * same control should be given the same number to talk about.
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
  /**
   * Fired once when a drag BEGINS, before the first change.
   *
   * Exists so the parent can snapshot for undo exactly once per gesture. The
   * slider emits continuously while dragging, so a parent pushing history on
   * every change would record a hundred entries for one thumb sweep and undo
   * would appear to do nothing.
   */
  onEditStart?: () => void;
  darkMode?: boolean;
}

/**
 * One press of a screen reader's increment gesture, in stored units.
 *
 * 0.05 is 5 points of the -100..+100 readout: twenty steps from neutral to
 * either rail. Fine enough to land on a value deliberately, coarse enough that
 * crossing the range is not a minute of swiping.
 */
const A11Y_STEP = 0.05;

export default function MorphSlider({
  label,
  value,
  onChange,
  onEditStart,
  darkMode = true,
}: MorphSliderProps): React.JSX.Element {
  const theme = getThemeColors(darkMode);
  const [trackWidth, setTrackWidth] = useState(0);
  // Refs, not state: the pan handlers are created once, and reading a stale
  // `trackWidth`/`value` from a closure would make the thumb jump on every drag.
  const widthRef = useRef(0);
  /** Value at the moment the drag began; `gesture.dx` is relative to it. */
  const dragStartRef = useRef(value);

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
          if (w <= 0) return;
          onEditStart?.();
          const next = clamp01(evt.nativeEvent.locationX / w);
          // Anchor the drag. `gesture.dx` is measured from where the gesture
          // STARTED, so every move must be applied to the value at that moment.
          dragStartRef.current = next;
          onChange(next);
        },
        onPanResponderMove: (_evt, gesture) => {
          const w = widthRef.current;
          if (w <= 0) return;
          // Was `valueRef.current + gesture.dx / w * 0.02`, which is wrong twice
          // over: dx is cumulative rather than a frame delta, so adding it to
          // the LIVE value integrated a growing quantity and the thumb ran away
          // quadratically; and the 0.02 factor meant dragging the entire track
          // moved the value by two percent.
          onChange(clamp01(dragStartRef.current + gesture.dx / w));
        },
        // Spec §8: haptic on RELEASE, not during the drag. Firing per-move
        // would buzz continuously for the whole gesture, which reads as a fault
        // rather than as feedback.
        onPanResponderRelease: () => haptic.light(),
      }),
    [onChange, onEditStart],
  );

  /** Move by one screen-reader step, in the same units the readout shows. */
  const nudge = useCallback(
    (direction: 1 | -1) => {
      onEditStart?.();
      onChange(clamp01(value + direction * A11Y_STEP));
      haptic.light();
    },
    [onChange, onEditStart, value],
  );

  const pct = clamp01(value);
  const thumbLeft = Math.max(0, Math.min(trackWidth - scale(18), pct * trackWidth - scale(9)));
  // Bipolar: 0.5 is NEUTRAL, not "half". The morphs are signed — a value below
  // the midpoint is a real deformation in the opposite direction — so the fill
  // grows out from the centre. Filling from the left edge would say the neutral
  // face is halfway to something, and make "narrower" look like "less".
  const signed = (pct - 0.5) * 2;
  const fillFrac = Math.abs(signed) / 2;
  const fillLeft = signed >= 0 ? 0.5 : 0.5 - fillFrac;

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <View
        style={styles.trackWrap}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        // The signed readout, so the announcement matches the number on screen.
        accessibilityValue={{ min: -100, max: 100, now: Math.round(signed * 100) }}
        accessibilityActions={[
          { name: 'increment', label: `Increase ${label}` },
          { name: 'decrement', label: `Decrease ${label}` },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') nudge(1);
          else if (event.nativeEvent.actionName === 'decrement') nudge(-1);
        }}
        {...panResponder.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
          <View
            style={[
              styles.fill,
              {
                left: `${fillLeft * 100}%`,
                width: `${fillFrac * 100}%`,
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
        {/* Neutral marker. Without it there is no way to find the default by
            eye on a bipolar track, and players cannot undo a nudge. */}
        <View pointerEvents="none" style={[styles.centreTick, { backgroundColor: theme.textSecondary }]} />
        <View
          style={[
            styles.thumb,
            { left: thumbLeft, backgroundColor: ACCENT, borderColor: '#070A10' },
          ]}
        />
      </View>
      {/* Spec §8 "floating value indicator". A slider with no readout gives the
          player no way to return to a value they liked, or to describe one. */}
      <Text style={[styles.value, { color: theme.textSecondary }]}>
        {signed > 0 ? '+' : ''}{Math.round(signed * 100)}
      </Text>
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
    position: 'absolute',
    height: '100%',
    borderRadius: radii.round,
  },
  centreTick: {
    position: 'absolute',
    left: '50%',
    width: 1,
    height: scale(11),
    opacity: 0.45,
  },
  value: {
    width: scale(34),
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
