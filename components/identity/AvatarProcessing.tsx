/**
 * The wait.
 *
 * ## The progress bar is not a timer
 *
 * `progress` comes from `AvatarService`, which gets it from the provider's own
 * upload and poll responses. Nothing here counts to a hundred on its own. A bar
 * that races to 90% and then sits there is the clearest possible signal that a
 * screen is theatre, and players read it instantly — they have seen a thousand
 * of them.
 *
 * The one liberty taken is EASING: the displayed value animates towards the
 * reported one instead of jumping, because real progress arrives in lumps and a
 * bar that teleports looks broken in the other direction. It never moves past
 * what was reported, and it never moves backwards.
 *
 * ## The steps are the provider's, not a script
 *
 * `stages` is whatever the provider that will actually run says it can do. The
 * on-device match lists three steps and ticks three; the cloud model lists
 * seven. Showing a "mapping facial geometry" line that will never tick, because
 * the provider in play cannot find landmarks, is a lie with a checkmark on it.
 *
 * ## Reduce motion
 *
 * The whole animated layer is skipped under `useReducedMotion`, leaving a
 * static diagram and a bar. Vestibular triggers are not a nice-to-have, and a
 * pulsing network of nodes is exactly the sort of thing that causes them.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fontScale, scale } from '@/utils/scaling';
import type { AvatarStage } from '@/services/avatar/types';

const C = {
  bg: '#070A10',
  text: '#FFFFFF',
  sub: 'rgba(255, 255, 255, 0.62)',
  muted: 'rgba(255, 255, 255, 0.34)',
  accent: '#4C8DFF',
  accentDim: 'rgba(76, 141, 255, 0.30)',
  track: 'rgba(255, 255, 255, 0.10)',
};

const STAGE_LABEL: Record<AvatarStage, string> = {
  detecting: 'Face detected',
  geometry: 'Mapping facial geometry',
  proportions: 'Building facial proportions',
  skinTone: 'Matching skin tone',
  eyes: 'Reading eye colour',
  hair: 'Reading hair colour',
  finishing: 'Preparing your character',
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A fixed, hand-placed graph rather than a random one.
 *
 * Random node positions produce a different picture on every run and, often
 * enough, an ugly one — three nodes overlapping in a corner. These are laid out
 * loosely over a face: brow line, eye line, nose, jaw.
 */
const NODES: readonly { x: number; y: number }[] = [
  { x: 0.50, y: 0.10 }, { x: 0.28, y: 0.22 }, { x: 0.72, y: 0.22 },
  { x: 0.18, y: 0.42 }, { x: 0.38, y: 0.38 }, { x: 0.62, y: 0.38 }, { x: 0.82, y: 0.42 },
  { x: 0.50, y: 0.52 }, { x: 0.34, y: 0.64 }, { x: 0.66, y: 0.64 },
  { x: 0.50, y: 0.70 }, { x: 0.26, y: 0.78 }, { x: 0.74, y: 0.78 },
  { x: 0.50, y: 0.90 },
];

const EDGES: readonly [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 6], [1, 4], [2, 5], [4, 5], [3, 4], [5, 6],
  [4, 7], [5, 7], [7, 8], [7, 9], [8, 10], [9, 10], [8, 11], [9, 12],
  [10, 13], [11, 13], [12, 13], [3, 8], [6, 9],
];

export interface AvatarProcessingProps {
  /** Steps the running provider can actually perform, in order. */
  stages: readonly AvatarStage[];
  /** Stages it has finished. */
  done: readonly AvatarStage[];
  /** Real completion, [0, 1]. */
  progress: number;
  /** Provider label, e.g. "Cloud model" — shown so the player knows what ran. */
  providerLabel?: string;
  onCancel: () => void;
}

export default function AvatarProcessing({
  stages,
  done,
  progress,
  providerLabel,
  onCancel,
}: AvatarProcessingProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  // Eased towards the reported value; see the note at the top.
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(shown, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: reduceMotion ? 0 : 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, reduceMotion, shown]);

  // One shared 0→1 loop drives every node. Per-node timers would drift apart
  // over a twenty-second wait and end up visibly out of phase.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const size = Math.min(width, scale(260)) || scale(260);

  const nodeAnims = useMemo(
    () =>
      NODES.map((_, i) =>
        pulse.interpolate({
          // Offset per node so the pulse travels across the face rather than
          // every point breathing in unison, which reads as a loading spinner.
          inputRange: [0, 0.5, 1],
          outputRange: [
            2.2 + 1.6 * Math.sin(i * 1.7),
            2.2 + 1.6 * Math.sin(i * 1.7 + 2.1),
            2.2 + 1.6 * Math.sin(i * 1.7 + 4.2),
          ],
        }),
      ),
    [pulse],
  );

  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <View style={styles.root}>
      <View style={styles.diagramWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Svg width={size} height={size} accessibilityLabel="Analysing your photo">
          {EDGES.map(([a, b]) => (
            <Line
              key={`${a}-${b}`}
              x1={NODES[a].x * size}
              y1={NODES[a].y * size}
              x2={NODES[b].x * size}
              y2={NODES[b].y * size}
              stroke={C.accentDim}
              strokeWidth={1}
            />
          ))}
          {NODES.map((n, i) => (
            <AnimatedCircle
              key={`${n.x}-${n.y}`}
              cx={n.x * size}
              cy={n.y * size}
              r={reduceMotion ? 3 : nodeAnims[i]}
              fill={C.accent}
            />
          ))}
        </Svg>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Creating your digital twin</Text>
        <Text style={styles.subtitle}>
          {/* The claim has to match the provider. "Measuring 68 facial
              landmarks" is true of the cloud model and false of the on-device
              match, which reads colour only — and a paid feature that overstates
              what it did on the ONE screen the player stares at for fifteen
              seconds is the worst place to do it. `stages` is the provider's own
              capability list, so this cannot drift from what actually runs. */}
          {stages.includes('geometry')
            ? `We’re measuring 68 facial landmarks${providerLabel ? ` — ${providerLabel}` : ''}.`
            : `We’re reading your colouring from the photo${providerLabel ? ` — ${providerLabel}` : ''}.`}
        </Text>
      </View>

      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: shown.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.percent} accessibilityLiveRegion="polite">{`${percent}%`}</Text>

      <View style={styles.steps}>
        {stages.map((stage) => {
          const complete = done.includes(stage);
          return (
            <View key={stage} style={styles.stepRow}>
              <View style={[styles.stepDot, complete && styles.stepDotDone]}>
                {complete ? <Check size={scale(11)} color="#04121F" /> : null}
              </View>
              <Text style={[styles.stepText, complete && styles.stepTextDone]}>
                {STAGE_LABEL[stage]}
              </Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        style={styles.cancel}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, padding: scale(24), alignItems: 'center', justifyContent: 'center' },
  diagramWrap: { width: '100%', alignItems: 'center', marginBottom: scale(26) },
  copy: { alignItems: 'center' },
  title: { color: C.text, fontSize: fontScale(23), fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: {
    color: C.sub,
    fontSize: fontScale(13.5),
    marginTop: scale(8),
    textAlign: 'center',
    lineHeight: fontScale(19),
  },
  barTrack: {
    width: '100%',
    height: scale(4),
    borderRadius: 99,
    backgroundColor: C.track,
    marginTop: scale(24),
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 99, backgroundColor: C.accent },
  percent: { color: C.muted, fontSize: fontScale(12), fontWeight: '700', marginTop: scale(8) },

  steps: { width: '100%', marginTop: scale(22), gap: scale(11) },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: scale(11) },
  stepDot: {
    width: scale(19),
    height: scale(19),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: C.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: C.accent, borderColor: C.accent },
  stepText: { color: C.muted, fontSize: fontScale(14) },
  stepTextDone: { color: C.text, fontWeight: '600' },

  cancel: { marginTop: scale(26), paddingVertical: scale(8) },
  cancelText: { color: C.muted, fontSize: fontScale(14), fontWeight: '600' },
});
