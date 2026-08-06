/**
 * VerifiedBadge — gradient checkmark badge, with 600ms shimmer on first render.
 *
 * For unverified users with `showUpsellOnTapIfUnverified`, renders a faint
 * outline that opens the Pulse Pro upsell modal on tap.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale } from '@/utils/scaling';
import { PULSE_GRADIENT, PULSE_MOTION } from '../styles/pulseTheme';

const LinearGradient = Gradient;

interface VerifiedBadgeProps {
  verified: boolean;
  size?: number;
  showUpsellOnTapIfUnverified?: boolean;
  onUpsell?: () => void;
}

export default function VerifiedBadge({
  verified, size = 16, showUpsellOnTapIfUnverified = false, onUpsell,
}: VerifiedBadgeProps) {
  const { theme } = useTheme();
  const shineX = useRef(new Animated.Value(-size)).current;

  const reduced = useReducedMotion();
  useEffect(() => {
    if (!verified || reduced) return;
    Animated.timing(shineX, {
      toValue: size * 2,
      duration: PULSE_MOTION.verifiedShine,
      useNativeDriver: true,
    }).start();
  }, [verified, size, shineX, reduced]);

  if (!verified) {
    if (!showUpsellOnTapIfUnverified) return null;
    return (
      <Pressable
        onPress={onUpsell}
        accessibilityRole="button"
        accessibilityLabel="Get Pulse Verified Pro"
        hitSlop={6}
      >
        <View
          style={[
            styles.outline,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: theme.textMuted,
            },
          ]}
        >
          <Check size={size * 0.6} color={theme.textMuted} strokeWidth={2.5} />
        </View>
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel="Verified" style={{ width: size, height: size }}>
      <LinearGradient
        colors={PULSE_GRADIENT as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Check size={size * 0.7} color="#FFFFFF" strokeWidth={3} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shine,
            { width: size / 2, transform: [{ translateX: shineX }, { rotate: '20deg' }] },
          ]}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outline: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: 0, bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
});
