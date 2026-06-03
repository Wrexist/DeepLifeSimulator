/**
 * EmptyState — illustrated empty-state with one-line observation + nudge.
 *
 * The illustration is a soft EKG-line drawn as a single SVG path to fit
 * the Pulse heartbeat brand identity. Caller provides observation + nudge
 * copy and an optional CTA.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { PULSE_GRADIENT } from '../styles/pulseTheme';
import { useTheme } from '@/hooks/useTheme';

interface EmptyStateProps {
  observation: string;
  nudge?: string;
  children?: React.ReactNode; // Optional CTA
}

const EKG_PATH = 'M0 30 L40 30 L50 10 L60 50 L70 30 L120 30 L130 18 L140 42 L150 30 L200 30';

export default function EmptyState({ observation, nudge, children }: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <Svg width={scale(200)} height={scale(60)} viewBox="0 0 200 60">
        <Defs>
          <SvgLinearGradient id="pulseEKGGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={PULSE_GRADIENT[0]} stopOpacity="0.9" />
            <Stop offset="1" stopColor={PULSE_GRADIENT[1]} stopOpacity="0.9" />
          </SvgLinearGradient>
        </Defs>
        <Path d={EKG_PATH} stroke="url(#pulseEKGGrad)" strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
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
