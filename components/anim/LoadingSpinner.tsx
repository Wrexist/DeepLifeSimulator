import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { useGame } from '@/contexts/GameContext';
import { Z_INDEX } from '@/utils/zIndexConstants';

const { width: screenWidth } = Dimensions.get('window');

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  size = 'medium', 
  color = '#3B82F6', 
  text,
  fullScreen = false 
}: LoadingSpinnerProps) {
  const { gameState } = useGame();
  const isDarkMode = gameState.settings.darkMode;

  const getSize = () => {
    switch (size) {
      case 'small': return 24;
      case 'large': return 64;
      default: return 40;
    }
  };

  const spinnerSize = getSize();

  if (fullScreen) {
    return (
      <View style={[styles.fullScreenContainer, isDarkMode && styles.fullScreenContainerDark]}>
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'spring',
            damping: 15,
            stiffness: 150,
          }}
          style={styles.fullScreenContent}
        >
          {/* Background Blur */}
          <View style={[styles.fullScreenBlur, isDarkMode && styles.fullScreenBlurDark]} />
          
          {/* Spinner Container */}
          <View style={styles.spinnerContainer}>
            <MotiView
              from={{ rotate: '0deg' }}
              animate={{ rotate: '360deg' }}
              transition={{
                type: 'timing',
                duration: 1000,
                loop: true,
              }}
              style={styles.spinner}
            >
              <LinearGradient
                colors={[color, color + '80', color + '40', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.spinnerGradient, { width: spinnerSize, height: spinnerSize }]}
              />
            </MotiView>
            
            {/* Inner Ring */}
            <MotiView
              from={{ rotate: '360deg' }}
              animate={{ rotate: '0deg' }}
              transition={{
                type: 'timing',
                duration: 800,
                loop: true,
              }}
              style={styles.innerRing}
            >
              <View style={[styles.innerRingGradient, { 
                width: spinnerSize * 0.6, 
                height: spinnerSize * 0.6,
                borderColor: color + '40'
              }]} />
            </MotiView>
          </View>

          {/* Loading Text */}
          {text && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 150,
                delay: 200,
              }}
            >
              <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
                {text}
              </Text>
            </MotiView>
          )}

          {/* Dots Animation */}
          <View style={styles.dotsContainer}>
            {[0, 1, 2].map((index) => (
              <MotiView
                key={index}
                from={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1.2, opacity: 1 }}
                transition={{
                  type: 'timing',
                  duration: 600,
                  delay: index * 200,
                  loop: true,
                }}
                style={[styles.dot, { backgroundColor: color }]}
              />
            ))}
          </View>
        </MotiView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{
          type: 'timing',
          duration: 1000,
          loop: true,
        }}
        style={styles.spinner}
      >
        <LinearGradient
          colors={[color, color + '80', color + '40', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.spinnerGradient, { width: spinnerSize, height: spinnerSize }]}
        />
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: Z_INDEX.LOADING,
  },
  fullScreenContainerDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  fullScreenBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  fullScreenBlurDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  fullScreenContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  spinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  spinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerGradient: {
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  innerRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRingGradient: {
    borderRadius: 50,
    borderWidth: 2,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingTextDark: {
    color: '#F9FAFB',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

