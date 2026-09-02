/**
 * VerifiedBadge - the blue-check disc, in the Pulse identity colour.
 *
 * For unverified users with `showUpsellOnTapIfUnverified`, renders a faint
 * outline that opens the Pulse Pro upsell modal on tap.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { PULSE_COLORS } from '../styles/pulseTheme';

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
      <View
        style={[
          styles.badge,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: PULSE_COLORS.accent },
        ]}
      >
        <Check size={size * 0.7} color="#FFFFFF" strokeWidth={3} />
      </View>
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
});
