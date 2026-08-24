/**
 * EmptyState - illustrated empty state for Spark screens.
 *
 * Mirrors Pulse's EmptyState shape (observation + nudge + optional CTA) but
 * uses a heart pulse SVG drawn in Spark's rose→orange gradient.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { SPARK_GRADIENT } from '../styles/sparkTheme';

interface EmptyStateProps {
  observation: string;
  nudge?: string;
  children?: React.ReactNode;
}

// Heart silhouette traced with a single path. Looks like a heart pulse on a monitor.
const HEART_PATH =
  'M100 170 C 25 110, 25 55, 65 35 C 85 25, 100 45, 100 60 C 100 45, 115 25, 135 35 C 175 55, 175 110, 100 170 Z';

export default function EmptyState({ observation, nudge, children }: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <Svg width={scale(120)} height={scale(110)} viewBox="0 0 200 180">
        <Defs>
          <SvgLinearGradient id="sparkHeartGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={SPARK_GRADIENT[0]} stopOpacity="0.9" />
            <Stop offset="1" stopColor={SPARK_GRADIENT[1]} stopOpacity="0.9" />
          </SvgLinearGradient>
        </Defs>
        <Path d={HEART_PATH} stroke="url(#sparkHeartGrad)" strokeWidth={3} fill="none" />
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
  ctaWrap: {
    marginTop: responsiveSpacing.md,
  },
});
