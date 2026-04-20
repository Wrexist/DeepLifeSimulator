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
  Home,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
  Heart,
  DollarSign,
  Zap,
} from 'lucide-react-native';
import { useGameState } from '@/contexts/GameContext';
import { scale, responsivePadding, responsiveBorderRadius, responsiveFontSize, responsiveSpacing } from '@/utils/scaling';

const { width: _screenWidth } = Dimensions.get('window');

interface WelcomeBackPopupProps {
  visible: boolean;
  onClose: () => void;
}

export default function WelcomeBackPopup({ visible, onClose }: WelcomeBackPopupProps) {
  const { gameState } = useGameState();
  const { settings } = gameState;
  const isDarkMode = settings.darkMode;

  // Calculate time away
  const lastLogin = gameState.lastLogin || Date.now();
  const daysAway = Math.floor((Date.now() - lastLogin) / (1000 * 60 * 60 * 24));
  const weeksAway = Math.floor(daysAway / 7);
  const hoursAway = Math.floor((Date.now() - lastLogin) / (1000 * 60 * 60));

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let glowLoopRef: Animated.CompositeAnimation | null = null;
    let pulseLoopRef: Animated.CompositeAnimation | null = null;

    if (visible) {
      // Reset animations
      scaleAnim.setValue(0.9);
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      glowAnim.setValue(0);
      pulseAnim.setValue(1);

      // Entrance animations
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Glow pulse animation
      glowLoopRef = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      glowLoopRef.start();

      // Pulse animation for icon
      pulseLoopRef = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.start();
    }

    return () => {
      if (glowLoopRef) glowLoopRef.stop();
      if (pulseLoopRef) pulseLoopRef.stop();
    };
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const getTimeAwayText = () => {
    if (daysAway === 0) {
      if (hoursAway < 1) return 'Just now';
      if (hoursAway === 1) return '1 hour ago';
      return `${hoursAway} hours ago`;
    }
    if (daysAway === 1) return 'Yesterday';
    if (daysAway < 7) return `${daysAway} days ago`;
    if (weeksAway === 1) return '1 week ago';
    if (weeksAway < 4) return `${weeksAway} weeks ago`;
    const monthsAway = Math.floor(weeksAway / 4);
    if (monthsAway === 1) return '1 month ago';
    return `${monthsAway} months ago`;
  };

  const getWelcomeMessage = () => {
    if (daysAway === 0) return "Welcome back!";
    if (daysAway < 7) return "Welcome back!";
    if (weeksAway < 4) return "Long time no see!";
    return "Welcome back, traveler!";
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
              ],
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

          <LinearGradient
            colors={isDarkMode
              ? ['#1F2937', '#111827', '#0F172A']
              : ['#FFFFFF', '#F8FAFC', '#EFF6FF']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.content}
          >
            {/* Header with animated home icon */}
            <View style={styles.header}>
              <Animated.View
                style={[
                  styles.iconContainer,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB', '#1D4ED8']}
                  style={styles.iconGradient}
                >
                  <Home size={scale(40)} color="#FFFFFF" strokeWidth={2.5} />
                </LinearGradient>

                {/* Sparkle accents */}
                <View style={[styles.sparkleAccent, styles.sparkleTopLeft]}>
                  <Sparkles size={scale(14)} color="#60A5FA" fill="#60A5FA" />
                </View>
                <View style={[styles.sparkleAccent, styles.sparkleTopRight]}>
                  <Sparkles size={scale(12)} color="#93C5FD" fill="#93C5FD" />
                </View>
              </Animated.View>
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, isDarkMode && styles.titleDark]}>
                {getWelcomeMessage()}
              </Text>
              <View style={styles.timeAwayContainer}>
                <Clock size={scale(16)} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                <Text style={[styles.timeAway, isDarkMode && styles.timeAwayDark]}>
                  Last played: {getTimeAwayText()}
                </Text>
              </View>
            </View>

            {/* Stats Preview */}
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
                <View style={styles.statIconContainer}>
                  <DollarSign size={scale(20)} color="#10B981" />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                    Net Worth
                  </Text>
                  <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
                    ${((gameState.stats.money || 0) + (gameState.bankSavings || 0)).toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
                <View style={styles.statIconContainer}>
                  <Heart size={scale(20)} color="#EF4444" />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                    Life Progress
                  </Text>
                  <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
                    Week {gameState.weeksLived || 0} | Age {gameState.date?.age?.toFixed(1) || 0}
                  </Text>
                </View>
              </View>
            </View>

            {/* ENGAGEMENT: Scaled Welcome Back Bonus */}
            <View style={styles.infoContainer}>
              {(() => {
                // Calculate welcome bonus based on player income level
                const currentCareer = gameState.careers?.find((c: any) => c?.id === gameState.currentJob && c?.accepted);
                const weeklySalary = currentCareer?.levels?.[currentCareer?.level || 0]?.salary || 0;
                const rewardWeeks = Math.min(Math.max(daysAway, 1), 7);
                const welcomeBonus = Math.max(100, Math.round(weeklySalary * rewardWeeks * 0.5));
                const streakCount = gameState.playStreak?.count || 0;
                return (
                  <>
                    <View style={styles.infoRow}>
                      <View style={styles.infoIcon}>
                        <DollarSign size={scale(18)} color="#10B981" />
                      </View>
                      <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
                        Welcome back bonus: +${welcomeBonus.toLocaleString()}
                      </Text>
                    </View>
                    {streakCount > 1 && (
                      <View style={styles.infoRow}>
                        <View style={styles.infoIcon}>
                          <TrendingUp size={scale(18)} color="#F59E0B" />
                        </View>
                        <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
                          Play streak: {streakCount} days (+{Math.min(streakCount * 2, 20)}% income)
                        </Text>
                      </View>
                    )}
                    <View style={styles.infoRow}>
                      <View style={styles.infoIcon}>
                        <Zap size={scale(18)} color="#8B5CF6" />
                      </View>
                      <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
                        Continue your life journey
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.continueButtonGradient}
              >
                <Text style={styles.continueButtonText}>Continue Playing</Text>
                <ArrowRight size={scale(20)} color="#FFFFFF" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
    marginLeft: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3B82F6',
    boxShadow: '0px 0px 40px rgba(59, 130, 246, 0.6)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 10,
  },
  content: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  iconContainer: {
    position: 'relative',
    width: scale(88),
    height: scale(88),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGradient: {
    width: scale(88),
    height: scale(88),
    borderRadius: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sparkleAccent: {
    position: 'absolute',
  },
  sparkleTopLeft: {
    top: scale(-4),
    left: scale(-4),
  },
  sparkleTopRight: {
    top: scale(-2),
    right: scale(-2),
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
    marginBottom: responsiveSpacing.sm,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  timeAwayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  timeAway: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  timeAwayDark: {
    color: '#9CA3AF',
  },
  statsContainer: {
    width: '100%',
    gap: responsiveSpacing.md,
    marginBottom: responsiveSpacing.lg,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
  },
  statCardDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  statIconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: scale(2),
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: responsiveFontSize.base,
    color: '#1F2937',
    fontWeight: '700',
  },
  statValueDark: {
    color: '#FFFFFF',
  },
  infoContainer: {
    width: '100%',
    marginBottom: responsiveSpacing.xl,
    gap: responsiveSpacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.sm,
  },
  infoIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
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
  continueButton: {
    width: '100%',
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.lg,
    gap: responsiveSpacing.sm,
  },
  continueButtonText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});


