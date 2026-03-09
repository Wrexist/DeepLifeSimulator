import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, View, Dimensions, Platform } from 'react-native';
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { 
  Trophy, 
  Zap, 
  Heart, 
  DollarSign, 
  Target, 
  Crown,
  Gem,
  ShoppingCart,
  Users,
  CheckCircle
} from 'lucide-react-native';
import { useGameState } from '@/contexts/game/GameStateContext';
import { setAchievementToastRef } from '@/utils/achievementToast';

const { width: screenWidth } = Dimensions.get('window');

export interface AchievementData {
  title: string;
  category: string;
  reward: number;
}

let trigger: ((data: AchievementData) => void) | null = null;

export const showAchievementToast = (title: string, category: string = 'general', reward: number = 1) => {
  trigger?.({ title, category, reward });
};

export default function AchievementToast() {
  // CRITICAL: Use useGameState directly instead of useGame() to avoid calling multiple hooks
  // This is safer during provider initialization
  // If the context isn't ready, useGameState will throw, but ErrorBoundary will catch it
  // We can't use try-catch here because hooks must be called unconditionally
  const { gameState } = useGameState();
  const insets = useSafeAreaInsets();
  const [achievement, setAchievement] = useState<AchievementData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Set up the ref for external access
  useEffect(() => {
    setAchievementToastRef({
      show: (data: AchievementData) => {
        setAchievement(data);
        setIsVisible(true);
      }
    });
  }, []);

  useEffect(() => {
    trigger = (data: AchievementData) => {
      setAchievement(data);
      setIsVisible(true);
    };
  }, []);

  useEffect(() => {
    if (isVisible && achievement) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          setAchievement(null);
        }, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible, achievement]);

  const getCategoryIcon = (category: string) => {
    const iconProps = { size: 24, color: '#FFFFFF' };
    switch (category) {
      case 'items': return <ShoppingCart {...iconProps} />;
      case 'health': return <Heart {...iconProps} />;
      case 'money': return <DollarSign {...iconProps} />;
      case 'work': return <Target {...iconProps} />;
      case 'social': return <Users {...iconProps} />;
      case 'special': return <Crown {...iconProps} />;
      case 'gaming': return <Zap {...iconProps} />;
      default: return <Trophy {...iconProps} />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'items': return '#8B5CF6';
      case 'health': return '#10B981';
      case 'money': return '#F59E0B';
      case 'work': return '#3B82F6';
      case 'social': return '#EC4899';
      case 'special': return '#EF4444';
      case 'gaming': return '#06B6D4';
      default: return '#6366F1';
    }
  };

  if (!achievement || !isVisible) return null;

  // Add null check for gameState - return null if not ready yet
  if (!gameState || !gameState.settings) return null;

  const categoryColor = getCategoryColor(achievement.category);

  return (
    <MotiView
      from={{ 
        opacity: 0, 
        scale: 0.8,
        translateY: -50
      }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        translateY: 0
      }}
      exit={{ 
        opacity: 0, 
        scale: 0.8,
        translateY: -30
      }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
      }}
      style={[
        styles.container, 
        { 
          zIndex: Z_INDEX.TOAST,
          top: insets.top + (Platform.OS === 'ios' ? 60 : 50),
        }
      ]}
    >
      <LinearGradient
        colors={[categoryColor, categoryColor + 'DD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      />

      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.successIconContainer}>
          <CheckCircle size={20} color="#10B981" />
        </View>

        {/* Achievement Icon */}
        <View style={styles.iconContainer}>
          {getCategoryIcon(achievement.category)}
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.achievementLabel}>
            ACHIEVEMENT UNLOCKED!
          </Text>
          <Text style={styles.achievementTitle} numberOfLines={3} adjustsFontSizeToFit>
            {achievement.title}
          </Text>
        </View>

        {/* Reward Badge */}
        <View style={styles.rewardContainer}>
          <Gem size={16} color="#FFFFFF" />
          <Text style={styles.rewardText}>+{achievement.reward}</Text>
        </View>
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignSelf: 'center',
    maxWidth: screenWidth - 32,
    borderRadius: 16,
    overflow: 'visible',
    zIndex: Z_INDEX.TOAST,
    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  content: {
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  successIconContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    paddingHorizontal: 8,
  },
  achievementLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  rewardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});

