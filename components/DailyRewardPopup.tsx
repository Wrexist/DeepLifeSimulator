import React, { useEffect, useRef } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  Dimensions,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { 
  Gift, 
  DollarSign, 
  Gem,
  Sparkles,
  Crown,
  Calendar,
  TrendingUp,
  Zap,
  CheckCircle,
} from 'lucide-react-native';
import { useGameState } from '@/contexts/game';
import { scale, fontScale, verticalScale, responsivePadding, responsiveBorderRadius, responsiveFontSize, responsiveSpacing } from '@/utils/scaling';

const { width: screenWidth } = Dimensions.get('window');

interface DailyRewardPopupProps {
  visible: boolean;
  rewardAmount: number;
  onClose: () => void;
}

export default function DailyRewardPopup({ visible, rewardAmount, onClose }: DailyRewardPopupProps) {
  const { gameState } = useGameState();
  const { settings } = gameState || { darkMode: false };
  const isDarkMode = settings?.darkMode || false;
  const loginStreak = gameState?.loginStreak || 1;
  // Guard: ensure rewardAmount is always a valid number to prevent toLocaleString crash
  const safeRewardAmount = typeof rewardAmount === 'number' && isFinite(rewardAmount) && rewardAmount >= 0 ? rewardAmount : 0;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DAILY_LOGIN_REWARDS } = require('@/lib/config/gameConstants');
  const nextDayReward = DAILY_LOGIN_REWARDS[loginStreak % DAILY_LOGIN_REWARDS.length] || 50;

  // Unmount safety: prevent state updates and callbacks after unmount
  const isMountedRef = useRef(true);
  const claimInProgressRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Reset claim lock when popup becomes visible again
  useEffect(() => {
    if (visible) {
      claimInProgressRef.current = false;
    }
  }, [visible]);

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const coinAnim = useRef(new Animated.Value(-80)).current;
  const gemAnim = useRef(new Animated.Value(-80)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let glowLoopRef: Animated.CompositeAnimation | null = null;
    let rotateLoopRef: Animated.CompositeAnimation | null = null;
    let pulseLoopRef: Animated.CompositeAnimation | null = null;
    let delayedGlowTimeout: ReturnType<typeof setTimeout> | null = null;
    let delayedFallTimeout: ReturnType<typeof setTimeout> | null = null;

    if (visible) {
      // Reset animations
      scaleAnim.setValue(0.85);
      fadeAnim.setValue(0);
      glowAnim.setValue(0);
      coinAnim.setValue(-80);
      gemAnim.setValue(-80);
      rotateAnim.setValue(0);
      pulseAnim.setValue(1);
      checkmarkScale.setValue(0);

      // Entrance animations
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 45,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      // Delayed glow animation
      delayedGlowTimeout = setTimeout(() => {
        glowLoopRef = Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            }),
          ])
        );
        glowLoopRef.start();
      }, 400);

      // Reward icons fall animation
      delayedFallTimeout = setTimeout(() => {
        Animated.parallel([
          Animated.spring(gemAnim, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          ...(safeRewardAmount > 0
            ? [Animated.spring(coinAnim, {
                toValue: 0,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
              })]
            : []),
        ]).start();
      }, 300);

      // Sparkle rotation
      rotateLoopRef = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        })
      );
      rotateLoopRef.start();

      // Pulse animation
      pulseLoopRef = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.start();
    }

    // Cleanup function to stop animations and clear timeouts
    return () => {
      if (delayedGlowTimeout) clearTimeout(delayedGlowTimeout);
      if (delayedFallTimeout) clearTimeout(delayedFallTimeout);
      if (glowLoopRef) glowLoopRef.stop();
      if (rotateLoopRef) rotateLoopRef.stop();
      if (pulseLoopRef) pulseLoopRef.stop();
    };
  }, [visible, rewardAmount]);

  const handleClaim = () => {
    // Prevent double-tap
    if (claimInProgressRef.current) return;
    claimInProgressRef.current = true;

    // Checkmark animation
    Animated.spring(checkmarkScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Close after animation
    setTimeout(() => {
      if (!isMountedRef.current) return;
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (isMountedRef.current) {
          onClose();
        }
      });
    }, 800);
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.85],
  });

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="none"
      onRequestClose={handleClaim}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Animated background glow */}
          <Animated.View 
            style={[
              styles.glowCircle,
              {
                opacity: glowOpacity,
              },
            ]}
          />

          {/* Rotating sparkles background */}
          <Animated.View 
            style={[
              styles.sparklesContainer,
              {
                transform: [{ rotate: rotation }],
              },
            ]}
          >
            <Sparkles size={scale(220)} color="rgba(139, 92, 246, 0.25)" style={styles.sparkleBackground} />
          </Animated.View>

          <LinearGradient
            colors={isDarkMode 
              ? ['#1F2937', '#111827', '#0F172A'] 
              : ['#FFFFFF', '#F8FAFC', '#EFF6FF']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.content}
          >
            {/* Header with animated gift icon */}
            <View style={styles.header}>
              <Animated.View 
                style={[
                  styles.iconContainer,
                  {
                    transform: [
                      { translateY: gemAnim },
                      { scale: pulseAnim }
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED', '#6D28D9']}
                  style={styles.iconGradient}
                >
                  <Gift size={scale(44)} color="#FFFFFF" strokeWidth={2.5} />
                </LinearGradient>
                
                {/* Sparkle accents */}
                <View style={[styles.sparkleAccent, styles.sparkleTopLeft]}>
                  <Sparkles size={scale(16)} color="#C4B5FD" fill="#C4B5FD" />
                </View>
                <View style={[styles.sparkleAccent, styles.sparkleTopRight]}>
                  <Sparkles size={scale(14)} color="#DDD6FE" fill="#DDD6FE" />
                </View>
                <View style={[styles.sparkleAccent, styles.sparkleBottomRight]}>
                  <Sparkles size={scale(12)} color="#EDE9FE" fill="#EDE9FE" />
                </View>
              </Animated.View>
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, isDarkMode && styles.titleDark]}>
                Daily Reward! ðŸŽ
              </Text>
              <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
                Day {loginStreak} streak — keep it going!
              </Text>
            </View>

            {/* Reward Display */}
            <View style={styles.rewardContainer}>
              {/* Gem Reward - Always shown */}
              <Animated.View
                style={{
                  transform: [{ translateY: gemAnim }],
                }}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED', '#6D28D9']}
                  style={styles.rewardCard}
                >
                  <View style={styles.rewardIconContainer}>
                    <Gem size={scale(36)} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                  <View style={styles.rewardTextContainer}>
                    <Text style={styles.rewardAmount}>+1</Text>
                    <Text style={styles.rewardLabel}>Gem</Text>
                  </View>
                  <View style={styles.rewardBadge}>
                    <Crown size={scale(16)} color="#FCD34D" fill="#FCD34D" />
                  </View>
                </LinearGradient>
              </Animated.View>
              
              {/* Money Reward - Shown if there is one */}
              {safeRewardAmount > 0 && (
                <Animated.View
                  style={{
                    transform: [{ translateY: coinAnim }],
                  }}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669', '#047857']}
                    style={[styles.rewardCard, styles.rewardCardSecondary]}
                  >
                    <View style={styles.rewardIconContainer}>
                      <DollarSign size={scale(36)} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                    <View style={styles.rewardTextContainer}>
                      <Text style={styles.rewardAmount}>
                        ${safeRewardAmount.toLocaleString()}
                      </Text>
                      <Text style={styles.rewardLabel}>Money Bonus</Text>
                    </View>
                    <View style={styles.rewardBadge}>
                      <TrendingUp size={scale(16)} color="#FCD34D" />
                    </View>
                  </LinearGradient>
                </Animated.View>
              )}
            </View>

            {/* Info Section */}
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Calendar size={scale(18)} color={isDarkMode ? '#8B5CF6' : '#7C3AED'} />
                <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
                  Tomorrow: +{nextDayReward} gems (Day {loginStreak + 1})
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Zap size={scale(18)} color={isDarkMode ? '#F59E0B' : '#D97706'} />
                <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
                  {loginStreak >= 7 ? 'Max streak! Keep collecting daily!' : `${7 - loginStreak} days to max streak bonus!`}
                </Text>
              </View>
            </View>

            {/* Claim Button */}
            <TouchableOpacity
              style={styles.claimButton}
              onPress={handleClaim}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED', '#6D28D9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.claimButtonGradient}
              >
                <Animated.View
                  style={[
                    styles.checkmarkContainer,
                    {
                      transform: [{ scale: checkmarkScale }],
                      opacity: checkmarkScale,
                    },
                  ]}
                >
                  <CheckCircle size={scale(22)} color="#FFFFFF" fill="#FFFFFF" />
                </Animated.View>
                <Text style={styles.claimButtonText}>Claim Reward</Text>
                <Sparkles size={scale(20)} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  container: {
    width: '100%',
    maxWidth: scale(420),
    position: 'relative',
  },
  glowCircle: {
    position: 'absolute',
    top: -60,
    left: '50%',
    marginLeft: -110,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#8B5CF6',
    boxShadow: '0px 0px 50px rgba(139, 92, 246, 0.7)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 50,
    elevation: 12,
  },
  sparklesContainer: {
    position: 'absolute',
    top: -30,
    left: '50%',
    marginLeft: -110,
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleBackground: {
    opacity: 0.3,
  },
  content: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    boxShadow: '0px 10px 24px rgba(0, 0, 0, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 14,
  },
  header: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  iconContainer: {
    position: 'relative',
    width: scale(100),
    height: scale(100),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGradient: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  sparkleAccent: {
    position: 'absolute',
  },
  sparkleTopLeft: {
    top: scale(-6),
    left: scale(-6),
  },
  sparkleTopRight: {
    top: scale(-4),
    right: scale(-4),
  },
  sparkleBottomRight: {
    bottom: scale(-4),
    right: scale(-6),
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.xl,
  },
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: scale(4),
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: responsiveFontSize.base,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  rewardContainer: {
    width: '100%',
    marginBottom: responsiveSpacing.xl,
    gap: responsiveSpacing.md,
  },
  rewardCard: {
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    position: 'relative',
  },
  rewardCardSecondary: {
    shadowColor: '#10B981',
  },
  rewardIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
  },
  rewardTextContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rewardAmount: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: scale(2),
    letterSpacing: 0.5,
  },
  rewardLabel: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
  },
  rewardBadge: {
    position: 'absolute',
    top: responsiveSpacing.sm,
    right: responsiveSpacing.sm,
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    width: '100%',
    marginBottom: responsiveSpacing.xl,
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  infoText: {
    fontSize: responsiveFontSize.sm,
    color: '#4B5563',
    flex: 1,
    fontWeight: '500',
  },
  infoTextDark: {
    color: '#D1D5DB',
  },
  claimButton: {
    width: '100%',
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.lg,
    gap: responsiveSpacing.sm,
  },
  checkmarkContainer: {
    position: 'absolute',
    left: responsiveSpacing.lg,
  },
  claimButtonText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

