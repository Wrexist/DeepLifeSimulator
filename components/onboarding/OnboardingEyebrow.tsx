import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useOnboardingTheme } from '@/lib/config/onboardingTheme';
import { fontScale, responsiveSpacing, scale } from '@/utils/scaling';

interface OnboardingEyebrowProps {
  /** Short label, rendered uppercase (e.g. "Choose Your Path"). */
  label: string;
}

/**
 * The amber pill badge above a hero title (e.g. "CHOOSE YOUR PATH").
 * Purely presentational; pulls from the constant amber-dark menu theme.
 */
export default function OnboardingEyebrow({ label }: OnboardingEyebrowProps) {
  const theme = useOnboardingTheme();
  return (
    <View
      style={[styles.pill, { borderColor: theme.eyebrowBorder, backgroundColor: theme.floatingChipBg }]}
      accessibilityRole="text"
    >
      <Text style={[styles.text, { color: theme.eyebrow }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: scale(6),
  },
  text: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
