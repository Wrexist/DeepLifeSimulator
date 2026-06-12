import React from 'react';
import {
  Animated,
  Dimensions,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingScreenAnimation } from '@/hooks/useOnboardingScreenAnimation';
import { responsivePadding } from '@/utils/scaling';

const { width: screenWidth } = Dimensions.get('window');

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
  const { opacity, translateY, rotate } = useOnboardingScreenAnimation({
    duration: 1000,
    offsetY: 50,
    rotateBackground: true,
  });

  return (
    <View style={styles.container}>
      {/* Animated background circles */}
      <Animated.View
        style={[
          styles.backgroundGradient1,
          { transform: [{ rotate }] },
        ]}
      />
      <Animated.View
        style={[
          styles.backgroundGradient2,
          { transform: [{ rotate }] },
        ]}
      />

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
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  backgroundGradient1: {
    position: 'absolute',
    width: screenWidth * 2,
    height: screenWidth * 2,
    borderRadius: screenWidth,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    top: -screenWidth / 2,
    left: -screenWidth / 2,
  },
  backgroundGradient2: {
    position: 'absolute',
    width: screenWidth * 1.5,
    height: screenWidth * 1.5,
    borderRadius: screenWidth,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    bottom: -screenWidth / 3,
    right: -screenWidth / 3,
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
    backgroundColor: 'rgba(59,130,246,0.3)',
    borderRadius: 2,
  },
});
