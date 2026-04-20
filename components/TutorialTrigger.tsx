import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HelpCircle, Play, BookOpen, Sparkles } from 'lucide-react-native';
import { useTutorial } from '@/contexts/UIUXContext';
import { useGame } from '@/contexts/GameContext';
import { getEnhancedTutorialSteps } from '@/utils/enhancedTutorialData';

interface TutorialTriggerProps {
  context?: 'game' | 'onboarding' | 'advanced';
  variant?: 'button' | 'icon' | 'floating';
  size?: 'small' | 'medium' | 'large';
  style?: any;
  onPress?: () => void;
}

export default function TutorialTrigger({
  context = 'game',
  variant = 'button',
  size = 'medium',
  style,
  onPress
}: TutorialTriggerProps) {
  const { startEnhancedTutorial, hasCompletedTutorial } = useTutorial();
  const { gameState } = useGame();

  const handleTutorialStart = () => {
    startEnhancedTutorial(context);
    onPress?.();
  };

  const getButtonText = () => {
    if (!hasCompletedTutorial) {
      return 'Start Tutorial';
    }
    
    switch (context) {
      case 'onboarding':
        return 'Onboarding Guide';
      case 'advanced':
        return 'Advanced Guide';
      default:
        return 'Tutorial';
    }
  };

  const getIcon = () => {
    if (!hasCompletedTutorial) {
      return Play;
    }
    
    switch (context) {
      case 'onboarding':
        return BookOpen;
      case 'advanced':
        return Sparkles;
      default:
        return HelpCircle;
    }
  };

  const getColors = () => {
    if (!hasCompletedTutorial) {
      return ['#10B981', '#059669'];
    }
    
    switch (context) {
      case 'onboarding':
        return ['#8B5CF6', '#7C3AED'];
      case 'advanced':
        return ['#F59E0B', '#D97706'];
      default:
        return ['#3B82F6', '#1D4ED8'];
    }
  };

  const Icon = getIcon();
  const colors = getColors();

  if (variant === 'icon') {
    return (
      <TouchableOpacity onPress={handleTutorialStart} style={[styles.iconButton, style]}>
        <Icon size={size === 'small' ? 20 : size === 'large' ? 28 : 24} color="#3B82F6" />
      </TouchableOpacity>
    );
  }

  if (variant === 'floating') {
    return (
      <TouchableOpacity onPress={handleTutorialStart} style={[styles.floatingButton, style]}>
        <LinearGradient
          colors={colors}
          style={styles.floatingGradient}
        >
          <Icon size={20} color="#FFFFFF" />
          <Text style={styles.floatingText}>{getButtonText()}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handleTutorialStart} style={[styles.button, style]}>
      <LinearGradient
        colors={colors}
        style={[
          styles.buttonGradient,
          size === 'small' && styles.buttonSmall,
          size === 'large' && styles.buttonLarge,
        ]}
      >
        <Icon 
          size={size === 'small' ? 16 : size === 'large' ? 24 : 20} 
          color="#FFFFFF" 
          style={styles.buttonIcon}
        />
        <Text style={[
          styles.buttonText,
          size === 'small' && styles.buttonTextSmall,
          size === 'large' && styles.buttonTextLarge,
        ]}>
          {getButtonText()}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonLarge: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSmall: {
    fontSize: 14,
  },
  buttonTextLarge: {
    fontSize: 18,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    borderRadius: 25,
    overflow: 'hidden',
    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 1000,
  },
  floatingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  floatingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
