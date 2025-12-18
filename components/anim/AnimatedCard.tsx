import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  gradient?: string[];
  glow?: boolean;
  hover?: boolean;
  disabled?: boolean;
  animationType?: 'scale' | 'lift' | 'glow';
}

export default function AnimatedCard({
  children,
  onPress,
  style,
  gradient,
  glow = false,
  hover = true,
  disabled = false,
  animationType = 'scale'
}: AnimatedCardProps) {
  const { gameState } = useGame();
  const isDarkMode = gameState.settings.darkMode;

  const getAnimationProps = () => {
    switch (animationType) {
      case 'lift':
        return {
          from: { translateY: 0, shadowOpacity: 0.1 },
          animate: { translateY: -2, shadowOpacity: 0.2 },
          exit: { translateY: 0, shadowOpacity: 0.1 },
        };
      case 'glow':
        return {
          from: { shadowOpacity: 0.1, shadowRadius: 4 },
          animate: { shadowOpacity: 0.3, shadowRadius: 12 },
          exit: { shadowOpacity: 0.1, shadowRadius: 4 },
        };
      default: // scale
        return {
          from: { scale: 1 },
          animate: { scale: 0.98 },
          exit: { scale: 1 },
        };
    }
  };

  const animationProps = getAnimationProps();

  const getTransition = () => {
    switch (animationType) {
      case 'lift':
        return {
          type: 'spring' as const,
          damping: 15,
          stiffness: 200,
        };
      case 'glow':
        return {
          type: 'timing' as const,
          duration: 200,
        };
      default:
        return {
          type: 'spring' as const,
          damping: 12,
          stiffness: 300,
        };
    }
  };

  const cardContent = (
    <MotiView
      {...animationProps}
      transition={getTransition()}
      style={[
        styles.card,
        style,
        isDarkMode && styles.cardDark,
        glow && styles.glowCard,
        disabled && styles.disabledCard
      ]}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        >
          {children}
        </LinearGradient>
      ) : (
        children
      )}
    </MotiView>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={styles.touchable}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  touchable: {
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  glowCard: {
    boxShadow: '0px 4px 12px rgba(59, 130, 246, 0.2)',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  disabledCard: {
    opacity: 0.6,
  },
  gradientBackground: {
    borderRadius: 16,
    padding: 16,
  },
});
