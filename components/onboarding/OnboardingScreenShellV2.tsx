import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { responsivePadding, responsiveSpacing } from '@/utils/scaling';
import { logger } from '@/utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const NATIVE_OK = Platform.OS !== 'web';
const log = logger.scope('OnboardingShellV2');

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

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Rotating background circles
  useEffect(() => {
    let isMounted = true;
    let rotateLoop: Animated.CompositeAnimation | null = null;
    try {
      rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 30000,
          easing: Easing.linear,
          useNativeDriver: NATIVE_OK,
        })
      );
      if (isMounted && rotateLoop) rotateLoop.start();
    } catch (error) {
      log.error('Error starting rotate animation:', error);
    }
    return () => {
      isMounted = false;
      rotateLoop?.stop();
    };
  }, [rotateAnim]);

  // Fade in + slide up
  useEffect(() => {
    let isMounted = true;
    let parallel: Animated.CompositeAnimation | null = null;
    try {
      parallel = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: NATIVE_OK,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: NATIVE_OK,
        }),
      ]);
      if (isMounted && parallel) parallel.start();
    } catch (error) {
      log.error('Error starting fade/slide animation:', error);
    }
    return () => {
      isMounted = false;
      parallel?.stop();
    };
  }, [fadeAnim, slideAnim]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Animated background circles */}
      <Animated.View
        style={[
          styles.backgroundGradient1,
          { transform: [{ rotate: rotateInterpolate }] },
        ]}
      />
      <Animated.View
        style={[
          styles.backgroundGradient2,
          { transform: [{ rotate: rotateInterpolate }] },
        ]}
      />

      {/* Main content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingTop: 50 + insets.top,
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
                  transform: [{ rotate: rotateInterpolate }],
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
