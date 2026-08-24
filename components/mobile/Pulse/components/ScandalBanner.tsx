/**
 * ScandalBanner - sticky banner shown when an active scandal exists.
 *
 * Visual treatment depends on severity:
 *   ≥ 70: red gradient + alert role + warning haptic on mount
 *   40-69: amber gradient + alert role
 *   < 40: hidden (notification only - too quiet to block the feed)
 *
 * Tapping opens the ScandalRecoveryModal (provided by the caller).
 */
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { scale, fontScale, responsiveSpacing, responsiveIconSize } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { PULSE_SCANDAL_HIGH, PULSE_SCANDAL_MID } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';
import type { PulseActiveScandal } from '@/contexts/game/types';

const LinearGradient = Gradient;

interface ScandalBannerProps {
  scandal: PulseActiveScandal;
  onPress: () => void;
}

export default function ScandalBanner({ scandal, onPress }: ScandalBannerProps) {
  const severity = scandal.severity;

  // Fire a warning haptic once on mount when severity is high.
  useEffect(() => {
    if (severity >= 70) {
      pulseHaptics.warning();
    }
  }, [severity, scandal.id]);

  const gradientColors = useMemo<readonly [string, string]>(
    () => (severity >= 70 ? PULSE_SCANDAL_HIGH : PULSE_SCANDAL_MID),
    [severity],
  );

  if (severity < 40) return null;

  return (
    <Pressable
      onPress={() => {
        pulseHaptics.medium();
        onPress();
      }}
      accessibilityRole={Platform.OS === 'ios' ? 'alert' : 'button'}
      accessibilityLabel={`Active scandal, severity ${severity} out of 100, ${scandal.weeksRemaining} weeks remaining. Tap to respond.`}
      accessibilityLiveRegion={Platform.OS === 'android' ? 'assertive' : undefined}
      style={({ pressed }) => [styles.touch, pressed && styles.pressed]}
    >
      <LinearGradient colors={gradientColors as unknown as string[]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <View style={styles.iconWrap}>
          <AlertTriangle size={responsiveIconSize.md} color="#FFFFFF" strokeWidth={2.2} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            Scandal · {scandal.headline}
          </Text>
          <Text style={styles.subtitle}>
            Severity {severity}/100 · {scandal.weeksRemaining}w left · Tap to respond
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: {
    zIndex: Z_INDEX.DROPDOWN,
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.xs,
  },
  pressed: {
    opacity: 0.92,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(12),
  },
  iconWrap: {
    marginRight: responsiveSpacing.sm,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: fontScale(11),
    marginTop: 2,
  },
});
