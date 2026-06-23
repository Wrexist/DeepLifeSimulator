import React from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingScreenAnimation } from '@/hooks/useOnboardingScreenAnimation';
import { useOnboardingTheme } from '@/lib/config/onboardingTheme';
import { responsivePadding } from '@/utils/scaling';

interface OnboardingScreenShellV2Props {
  children: React.ReactNode;
  floatingButton?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showParticles?: boolean;
}

export default function OnboardingScreenShellV2({
  children,
  floatingButton,
  contentContainerStyle,
  showParticles = false,
}: OnboardingScreenShellV2Props) {
  const insets = useSafeAreaInsets();
  const theme = useOnboardingTheme();
  const { opacity, translateY, rotate } = useOnboardingScreenAnimation({
    duration: 1000,
    offsetY: 50,
    rotateBackground: true,
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.base }]}>
      {/* Signature amber radial glow: brightest top-center, fading to the near-black
          base. Static SVG — no per-frame JS, so it never costs frames. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="onboardingGlow" cx="50%" cy="18%" r="80%">
            <Stop offset="0%" stopColor={theme.glowColor} stopOpacity={0.42} />
            <Stop offset="45%" stopColor={theme.glowColor} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={theme.glowColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#onboardingGlow)" />
      </Svg>

      {/* Main content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity,
            transform: [{ translateY }],
            // Just the safe-area inset plus a small breathing gap. The screen's
            // own glass header already supplies its top padding, so the old
            // flat +50 here was pure dead space above the title.
            paddingTop: insets.top + 8,
          },
          contentContainerStyle,
        ]}
      >
        {children}
      </Animated.View>

      {/* Floating button */}
      {floatingButton ? (
        <View style={[styles.floatingButtonWrap, { bottom: 20 + insets.bottom }]}>
          {floatingButton}
        </View>
      ) : null}

      {/* Optional floating particles */}
      {showParticles ? (
        <View style={styles.particlesContainer}>
          {[...Array(8)].map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  left: `${(index * 12.5) % 100}%`,
                  top: `${(index * 15) % 100}%`,
                  transform: [{ rotate }],
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  floatingButtonWrap: {
    position: 'absolute',
    left: responsivePadding.horizontal,
    right: responsivePadding.horizontal,
    zIndex: 10,
  },
  particlesContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.32)',
    borderRadius: 2,
  },
});
