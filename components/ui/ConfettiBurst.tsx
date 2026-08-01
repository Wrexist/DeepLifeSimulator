/**
 * ConfettiBurst — the app's one confetti implementation.
 *
 * Lifted verbatim out of `work/PromotionCelebrationModal`, which had the only
 * copy, at the point a second celebration needed it. The behaviour there is
 * unchanged: same deterministic scatter, same durations, same transforms. Only
 * the colours, flake count and fall distance are parameters now.
 *
 * Two properties worth keeping if this is ever edited:
 *
 * - NATIVE-DRIVER ONLY. Every animated value drives `opacity` or `transform`,
 *   never layout, so the flakes run off the JS thread and keep moving while the
 *   celebration's own state updates land.
 * - NO `Math.random()`. The scatter is derived from the flake's index, so the
 *   layout is stable across re-renders and identical in tests and screenshots.
 *   A random scatter re-rolls on every parent render and makes the flakes jump.
 *
 * Callers are responsible for `useReducedMotion` — pass `play={false}` and
 * nothing mounts at all.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing } from 'react-native';
import { scale } from '@/utils/scaling';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const DEFAULT_CONFETTI_COLORS = ['#E8C15C', '#FDE9B0', '#7DD3A0', '#8AB4F8', '#F0F4FF'];

/** One confetti flake. Native-driver friendly: only transform + opacity. */
function Flake({
  index,
  play,
  colors,
  fallFraction,
}: {
  index: number;
  play: boolean;
  colors: string[];
  fallFraction: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  // Deterministic per-index scatter — see the header.
  const spread = ((index * 37) % 100) / 100;
  const startX = spread * SCREEN_W;
  const drift = ((index % 5) - 2) * scale(26);
  const delay = (index % 7) * 55;
  const size = scale(6 + (index % 3) * 3);
  const color = colors[index % colors.length];

  useEffect(() => {
    if (!play) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 2600 + (index % 4) * 420,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [play, progress, delay, index]);

  if (!play) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -scale(40),
        left: startX,
        width: size,
        height: size * 1.6,
        borderRadius: 1,
        backgroundColor: color,
        opacity: progress.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, SCREEN_H * fallFraction],
            }),
          },
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${540 + index * 30}deg`],
            }),
          },
        ],
      }}
    />
  );
}

export interface ConfettiBurstProps {
  /** Nothing mounts while false. Callers gate this on `useReducedMotion`. */
  play: boolean;
  count?: number;
  colors?: string[];
  /** How far down the screen a flake travels, as a fraction of screen height. */
  fallFraction?: number;
}

function ConfettiBurst({
  play,
  count = 22,
  colors = DEFAULT_CONFETTI_COLORS,
  fallFraction = 0.72,
}: ConfettiBurstProps) {
  if (!play) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Flake key={i} index={i} play={play} colors={colors} fallFraction={fallFraction} />
      ))}
    </>
  );
}

export default React.memo(ConfettiBurst);
