import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { fontScale, scale, screenDimensions, verticalScale } from '@/utils/scaling';

interface MainMenuTitleProps {
  /** Top word, rendered large (e.g. "DEEP"). */
  primary: string;
  /** Lower words, rendered wide with letter spacing (e.g. "LIFE SIMULATOR"). */
  secondary: string;
  tagline: string;
}

/**
 * Hero title block: a large gradient-style wordmark, a glowing "heartbeat"
 * pulse divider (SVG), and a tagline. Purely presentational.
 */
export default function MainMenuTitle({ primary, secondary, tagline }: MainMenuTitleProps) {
  const pulseWidth = Math.min(screenDimensions.width * 0.7, scale(300));
  const pulseHeight = verticalScale(28);
  const midY = pulseHeight / 2;
  // A flat baseline with a single heartbeat spike in the centre.
  const points = [
    `0,${midY}`,
    `${pulseWidth * 0.34},${midY}`,
    `${pulseWidth * 0.42},${midY - pulseHeight * 0.32}`,
    `${pulseWidth * 0.5},${midY + pulseHeight * 0.38}`,
    `${pulseWidth * 0.58},${midY - pulseHeight * 0.45}`,
    `${pulseWidth * 0.66},${midY}`,
    `${pulseWidth},${midY}`,
  ].join(' ');

  return (
    <View style={styles.container}>
      <Text style={styles.primary} numberOfLines={1} adjustsFontSizeToFit>
        {primary}
      </Text>
      <Text style={styles.secondary} numberOfLines={1} adjustsFontSizeToFit>
        {secondary}
      </Text>

      <Svg width={pulseWidth} height={pulseHeight} style={styles.pulse}>
        <Polyline points={points} fill="none" stroke="#7DD3FC" strokeWidth={2} strokeLinecap="round" />
      </Svg>

      <Text style={styles.tagline} numberOfLines={1} adjustsFontSizeToFit>
        {tagline}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  primary: {
    fontSize: fontScale(56),
    fontWeight: '900',
    color: '#DBEAFE',
    letterSpacing: scale(4),
    textShadowColor: 'rgba(96, 165, 250, 0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  secondary: {
    fontSize: fontScale(26),
    fontWeight: '700',
    color: '#93C5FD',
    letterSpacing: scale(6),
    marginTop: verticalScale(-2),
    textShadowColor: 'rgba(96, 165, 250, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  pulse: {
    marginTop: verticalScale(6),
  },
  tagline: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: 'rgba(147, 197, 253, 0.92)',
    marginTop: verticalScale(10),
    letterSpacing: scale(0.3),
  },
});
