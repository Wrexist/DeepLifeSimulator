/**
 * EmptyState — illustrated empty state for Hustle screens.
 *
 * Uses a stylized bar-chart SVG drawn in the Hustle indigo→cyan gradient.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { HUSTLE_GRADIENT } from '../styles/hustleTheme';

interface EmptyStateProps {
  observation: string;
  nudge?: string;
  children?: React.ReactNode;
}

export default function EmptyState({ observation, nudge, children }: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <Svg width={scale(140)} height={scale(90)} viewBox="0 0 140 90">
        <Defs>
          <SvgLinearGradient id="hustleBarGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={HUSTLE_GRADIENT[0]} stopOpacity="0.9" />
            <Stop offset="1" stopColor={HUSTLE_GRADIENT[1]} stopOpacity="0.9" />
          </SvgLinearGradient>
        </Defs>
        {[
          { x: 10, h: 30 },
          { x: 35, h: 50 },
          { x: 60, h: 40 },
          { x: 85, h: 70 },
          { x: 110, h: 60 },
        ].map((b, i) => (
          <Rect key={i} x={b.x} y={80 - b.h} width={18} height={b.h} rx={3} fill="url(#hustleBarGrad)" />
        ))}
      </Svg>
      <Text style={[styles.observation, { color: theme.text }]}>{observation}</Text>
      {nudge ? <Text style={[styles.nudge, { color: theme.textSecondary }]}>{nudge}</Text> : null}
      {children ? <View style={styles.ctaWrap}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.xl,
  },
  observation: {
    fontSize: fontScale(16),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: responsiveSpacing.md,
  },
  nudge: {
    fontSize: fontScale(13),
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
  },
  ctaWrap: { marginTop: responsiveSpacing.md },
});
