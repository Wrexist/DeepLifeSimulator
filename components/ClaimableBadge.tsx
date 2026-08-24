/**
 * ClaimableBadge - a small red count badge that gently pulses to draw the eye
 * when rewards are waiting. Honors reduced-motion (renders static). Position it
 * inside a `position: relative` parent (default for RN View).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, fontScale } from '@/utils/scaling';
import { accent, colors } from '@/lib/config/theme';

export function ClaimableBadge({ count }: { count: number }): React.ReactElement | null {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced || count <= 0) {
      scale.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, count, scale]);

  if (count <= 0) return null;

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: scale(6),
    right: scale(6),
    minWidth: scale(20),
    height: scale(20),
    paddingHorizontal: scale(5),
    borderRadius: scale(10),
    backgroundColor: accent.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.palette.white, fontSize: fontScale(11), fontWeight: '800' },
});
