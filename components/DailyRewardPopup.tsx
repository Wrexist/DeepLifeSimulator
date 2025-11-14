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
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Gift, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Sparkles,
  Crown,
  Star,
  Gem,
  Zap,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale, verticalScale } from '@/utils/scaling';

const { width: screenWidth } = Dimensions.get('window');

interface DailyRewardPopupProps {
  visible: boolean;
  rewardAmount: number;
  onClose: () => void;
}

export default function DailyRewardPopup({ visible, rewardAmount, onClose }: DailyRewardPopupProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const isDarkMode = settings.darkMode;

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const coinFallAnim = useRef(new Animated.Value(-100)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
      glowAnim.setValue(0);
      coinFallAnim.setValue(-100);
      rotateAnim.setValue(0);

      // Start entrance animations
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
      ]).start();

      // Delayed glow animation
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }, 300);

      // Coin fall animation
      setTimeout(() => {
        Animated.spring(coinFallAnim, {
          toValue: 0,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }, 200);

      // Sparkle rotation
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [visible]);

  const handleClose = () => {
    // Exit animation
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
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
    outputRange: [0.3, 0.8],
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
      onRequestClose={handleClose}
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
            <Sparkles size={scale(200)} color="rgba(251, 191, 36, 0.2)" style={styles.sparkleBackground} />
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
                    transform: [{ translateY: coinFallAnim }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#F59E0B', '#D97706', '#B45309']}
                  style={styles.iconGradient}
                >
                  <Gift size={scale(48)} color="#FFFFFF" />
                </LinearGradient>
                
                {/* Sparkle accents */}
                <View style={[styles.sparkleAccent, styles.sparkleTopLeft]}>
                  <Star size={scale(16)} color="#FCD34D" fill="#FCD34D" />
                </View>
                <View style={[styles.sparkleAccent, styles.sparkleTopRight]}>
                  <Star size={scale(12)} color="#FBBF24" fill="#FBBF24" />
                </View>
                <View style={[styles.sparkleAccent, styles.sparkleBottomRight]}>
                  <Star size={scale(14)} color="#FDE68A" fill="#FDE68A" />
                </View>
              </Animated.View>
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, isDarkMode && styles.titleDark]}>
                Welcome Back! 🎉
              </Text>
              <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
                Daily Login Reward
              </Text>
            </View>

            {/* Reward Display */}
            <View style={styles.rewardContainer}>
              {/* Always show gems reward */}
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED', '#6D28D9']}
                style={styles.rewardCard}
              >
                <View style={styles.rewardIconContainer}>
                  <Gem size={scale(32)} color="#FFFFFF" strokeWidth={3} />
                </View>
                <View style={styles.rewardTextContainer}>
                  <Text style={styles.rewardAmount}>+1 Gem</Text>
                  <Text style={styles.rewardLabel}>Daily Gem Bonus</Text>
                </View>
              </LinearGradient>
              
              {/* Show money reward if there is one */}
              {rewardAmount > 0 && (
                <LinearGradient
                  colors={['#10B981', '#059669', '#047857']}
                  style={[styles.rewardCard, styles.rewardCardSecondary]}
                >
                  <View style={styles.rewardIconContainer}>
                    <DollarSign size={scale(32)} color="#FFFFFF" strokeWidth={3} />
                  </View>
                  <View style={styles.rewardTextContainer}>
                    <Text style={styles.rewardAmount}>
                      ${rewardAmount.toLocaleString()}
                    </Text>
                    <Text style={styles.rewardLabel}>Money Bonus</Text>
                  </View>
                </LinearGradient>
              )}
            </View>

            {/* Daily Streak Info */}
            <View style={styles.streakContainer}>
              <View style={styles.streakRow}>
                <Calendar size={scale(20)} color="#8B5CF6" />
                <Text style={[styles.streakText, isDarkMode && styles.streakTextDark]}>
                  Come back daily for bigger rewards!
                </Text>
              </View>
            </View>

            {/* Benefits List */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <TrendingUp size={scale(16)} color="#10B981" />
                </View>
                <Text style={[styles.benefitText, isDarkMode && styles.benefitTextDark]}>
                  Reward scales with your net worth
                </Text>
              </View>
              <View style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Zap size={scale(16)} color="#3B82F6" />
                </View>
                <Text style={[styles.benefitText, isDarkMode && styles.benefitTextDark]}>
                  Keep playing to maintain progress
                </Text>
              </View>
            </View>

            {/* Claim Button */}
            <TouchableOpacity
              style={styles.claimButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED', '#6D28D9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.claimButtonGradient}
              >
                <Crown size={scale(20)} color="#FFFFFF" />
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
    padding: scale(20),
  },
  container: {
    width: '100%',
    maxWidth: scale(400),
    position: 'relative',
  },
  glowCircle: {
    position: 'absolute',
    top: -50,
    left: '50%',
    marginLeft: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 10,
  },
  sparklesContainer: {
    position: 'absolute',
    top: -20,
    left: '50%',
    marginLeft: -100,
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleBackground: {
    opacity: 0.3,
  },
  content: {
    borderRadius: scale(24),
    padding: scale(28),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: scale(20),
  },
  iconContainer: {
    position: 'relative',
    width: scale(96),
    height: scale(96),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGradient: {
    width: scale(96),
    height: scale(96),
    borderRadius: scale(48),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sparkleAccent: {
    position: 'absolute',
  },
  sparkleTopLeft: {
    top: scale(-8),
    left: scale(-8),
  },
  sparkleTopRight: {
    top: scale(-4),
    right: scale(-4),
  },
  sparkleBottomRight: {
    bottom: scale(-4),
    right: scale(-8),
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: scale(24),
  },
  title: {
    fontSize: fontScale(28),
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: scale(4),
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: fontScale(16),
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  rewardContainer: {
    width: '100%',
    marginBottom: scale(24),
    gap: scale(12),
  },
  rewardCard: {
    borderRadius: scale(16),
    padding: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rewardCardSecondary: {
    marginTop: scale(12),
  },
  rewardIconContainer: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(16),
  },
  rewardTextContainer: {
    alignItems: 'flex-start',
  },
  rewardAmount: {
    fontSize: fontScale(32),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: scale(2),
  },
  rewardLabel: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  streakContainer: {
    width: '100%',
    marginBottom: scale(20),
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakText: {
    fontSize: fontScale(14),
    color: '#4B5563',
    marginLeft: scale(8),
    fontWeight: '600',
  },
  streakTextDark: {
    color: '#D1D5DB',
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: scale(24),
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(10),
    paddingHorizontal: scale(12),
  },
  benefitIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  benefitText: {
    fontSize: fontScale(14),
    color: '#4B5563',
    flex: 1,
    fontWeight: '500',
  },
  benefitTextDark: {
    color: '#D1D5DB',
  },
  claimButton: {
    width: '100%',
    borderRadius: scale(16),
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(16),
    paddingHorizontal: scale(24),
    gap: scale(10),
  },
  claimButtonText: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

