import React, { useEffect, useState, useRef } from 'react';
import { Text, StyleSheet, View, Dimensions, Platform } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import LottieView from 'lottie-react-native';
import { ConfettiEffect } from '@/components/ui/ParticleEffects';
import { 
  Trophy, 
  Star, 
  Zap, 
  Heart, 
  DollarSign, 
  Target, 
  Crown,
  Sparkles,
  Award,
  Gem,
  ShoppingCart,
  Users
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AchievementData {
  title: string;
  category: string;
  reward: number;
}

let trigger: ((data: AchievementData) => void) | null = null;

export const showAchievementToast = (title: string, category: string = 'general', reward: number = 1) => {
  trigger?.({ title, category, reward });
};

export default function AchievementToast() {
  const { gameState } = useGame();
  const [achievement, setAchievement] = useState<AchievementData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const confettiRef = useRef<LottieView>(null);
  const sparkleRef = useRef<LottieView>(null);

  useEffect(() => {
    trigger = (data: AchievementData) => {
      setAchievement(data);
      setIsVisible(true);
      
      // Trigger confetti animation with error handling (only on native platforms)
      if (Platform.OS !== 'web') {
        setTimeout(() => {
          try {
            confettiRef.current?.play();
          } catch (error) {
            console.warn('Failed to play confetti animation:', error);
          }
          
          try {
            sparkleRef.current?.play();
          } catch (error) {
            console.warn('Failed to play sparkle animation:', error);
          }
        }, 200);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible && achievement) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          setAchievement(null);
        }, 500);
      }, 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible, achievement]);

  const getCategoryIcon = (category: string) => {
    const iconProps = { size: 28, color: '#FFD700' };
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

  const getCategoryGradient = (category: string) => {
    switch (category) {
      case 'items': return ['#8B5CF6', '#A855F7', '#C084FC'];
      case 'health': return ['#10B981', '#34D399', '#6EE7B7'];
      case 'money': return ['#F59E0B', '#FBBF24', '#FCD34D'];
      case 'work': return ['#3B82F6', '#60A5FA', '#93C5FD'];
      case 'social': return ['#EC4899', '#F472B6', '#F9A8D4'];
      case 'special': return ['#EF4444', '#F87171', '#FCA5A5'];
      case 'gaming': return ['#06B6D4', '#22D3EE', '#67E8F9'];
      default: return ['#6366F1', '#8B5CF6', '#A78BFA'];
    }
  };

  if (!achievement || !isVisible) return null;

  const isDarkMode = gameState.settings.darkMode;
  const gradientColors = getCategoryGradient(achievement.category);

  return (
    <MotiView
      from={{ 
        opacity: 0, 
        scale: 0.3,
        translateY: -100,
        rotateX: '-90deg'
      }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        translateY: 0,
        rotateX: '0deg'
      }}
      exit={{ 
        opacity: 0, 
        scale: 0.8,
        translateY: -50,
        rotateX: '90deg'
      }}
      transition={{
        type: 'spring',
        damping: 15,
        stiffness: 150,
        mass: 1,
      }}
      style={styles.container}
    >
      {/* Background Blur */}
      <BlurView
        intensity={isDarkMode ? 20 : 30}
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.blurContainer}
      />

      {/* Main Gradient Background */}
      <LinearGradient
        colors={gradientColors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      {/* Shine Effect */}
      <LinearGradient
        colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.3)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.shineEffect}
      />

      {/* Confetti Background */}
      {Platform.OS !== 'web' && (
        <View style={styles.confettiContainer}>
          <LottieView
            ref={confettiRef}
            source={require('@/assets/lottie/confetti.json')}
            autoPlay={false}
            loop={false}
            style={styles.confetti}
            onAnimationFinish={() => {
              // Animation finished successfully
            }}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Content Container */}
      <View style={styles.contentContainer}>
        {/* Achievement Icon */}
        <MotiView
          from={{ scale: 0, rotate: '-180deg' }}
          animate={{ scale: 1, rotate: '0deg' }}
          transition={{
            type: 'spring',
            damping: 12,
            stiffness: 200,
            delay: 300,
          }}
          style={styles.iconContainer}
        >
          <View style={styles.iconBackground}>
            {getCategoryIcon(achievement.category)}
          </View>
          <View style={styles.iconGlow} />
        </MotiView>

        {/* Achievement Text */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{
            type: 'spring',
            damping: 15,
            stiffness: 150,
            delay: 500,
          }}
          style={styles.textContainer}
        >
          <Text style={[styles.achievementLabel, isDarkMode && styles.achievementLabelDark]}>
            Achievement Unlocked!
          </Text>
          <Text style={[styles.achievementTitle, isDarkMode && styles.achievementTitleDark]}>
            {achievement.title}
          </Text>
          
          {/* Reward Badge */}
          <MotiView
            from={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: 'spring',
              damping: 12,
              stiffness: 200,
              delay: 700,
            }}
            style={styles.rewardContainer}
          >
            <LinearGradient
              colors={['#FFD700', '#FFA500', '#FF8C00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.rewardBadge}
            >
              <Gem size={16} color="#FFFFFF" />
              <Text style={styles.rewardText}>+{achievement.reward}</Text>
            </LinearGradient>
          </MotiView>
        </MotiView>

        {/* Sparkle Effects */}
        {Platform.OS !== 'web' && (
          <View style={styles.sparkleContainer}>
            <LottieView
              ref={sparkleRef}
              source={require('@/assets/lottie/confetti.json')}
              autoPlay={false}
              loop={false}
              style={styles.sparkles}
              onAnimationFinish={() => {
                // Animation finished successfully
              }}
              resizeMode="cover"
            />
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <MotiView
        from={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{
          type: 'spring',
          damping: 15,
          stiffness: 100,
          delay: 1000,
        }}
        style={styles.progressContainer}
      >
        <View style={[styles.progressBar, isDarkMode && styles.progressBarDark]}>
          <LinearGradient
            colors={gradientColors as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressFill}
          />
        </View>
      </MotiView>
      
      {/* Confetti Effect */}
      <ConfettiEffect 
        visible={isVisible} 
        onComplete={() => {
          // Confetti animation completed
        }} 
      />
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    alignSelf: 'center',
    width: screenWidth * 0.9,
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  blurContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.9,
  },
  shineEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confetti: {
    width: screenWidth,
    height: 200,
    minHeight: 100,
  },
  contentContainer: {
    padding: 24,
    alignItems: 'center',
    zIndex: 10,
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  iconBackground: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    top: -8,
    left: -8,
    zIndex: -1,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  achievementLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  achievementLabelDark: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  achievementTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 12,
  },
  achievementTitleDark: {
    color: '#FFFFFF',
  },
  rewardContainer: {
    alignItems: 'center',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  rewardText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sparkleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkles: {
    width: 100,
    height: 100,
    minHeight: 50,
    minWidth: 50,
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBarDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  progressFill: {
    height: 4,
    width: '100%',
  },
});