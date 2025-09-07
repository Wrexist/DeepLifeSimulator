import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Gift, Star, Zap, Heart, Trophy } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
  verticalScale,
} from '@/utils/scaling';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface DailyGiftModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function DailyGiftModal({ visible, onClose }: DailyGiftModalProps) {
  const { gameState, claimDailyGift, generateWeeklyGifts, checkDailyGiftEligibility } = useGame();
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [timeUntilNextGift, setTimeUntilNextGift] = useState<string>('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const { dailyGifts } = gameState;
  const { currentStreak, weeklyGifts, claimedToday, lastClaimDate } = dailyGifts;

  useEffect(() => {
    if (visible) {
      // Generate weekly gifts if not already generated
      if (weeklyGifts.length === 0) {
        generateWeeklyGifts();
      }
      
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim, slideAnim, weeklyGifts.length, generateWeeklyGifts]);

  // Countdown timer for next daily gift
  useEffect(() => {
    const updateCountdown = () => {
      if (claimedToday && lastClaimDate) {
        const now = new Date();
        const lastClaim = new Date(lastClaimDate);
        const nextClaim = new Date(lastClaim);
        nextClaim.setDate(nextClaim.getDate() + 1);
        nextClaim.setHours(0, 0, 0, 0); // Reset to start of day
        
        const timeDiff = nextClaim.getTime() - now.getTime();
        
        if (timeDiff > 0) {
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
          
          setTimeUntilNextGift(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        } else {
          setTimeUntilNextGift('Ready!');
        }
      } else {
        setTimeUntilNextGift('Claim now!');
      }
    };

    // Update immediately
    updateCountdown();
    
    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [claimedToday, lastClaimDate]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return ['#6B7280', '#4B5563'];
      case 'rare':
        return ['#3B82F6', '#1D4ED8'];
      case 'epic':
        return ['#8B5CF6', '#7C3AED'];
      case 'legendary':
        return ['#F59E0B', '#D97706'];
      default:
        return ['#6B7280', '#4B5563'];
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'rgba(107, 114, 128, 0.3)';
      case 'rare':
        return 'rgba(59, 130, 246, 0.4)';
      case 'epic':
        return 'rgba(139, 92, 246, 0.4)';
      case 'legendary':
        return 'rgba(245, 158, 11, 0.5)';
      default:
        return 'rgba(107, 114, 128, 0.3)';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'money':
        return '💰';
      case 'gems':
        return '💎';
      case 'energy':
        return '⚡';
      case 'happiness':
        return '😊';
      case 'health':
        return '❤️';
      case 'fitness':
        return '💪';
      case 'reputation':
        return '⭐';
      case 'youth_pill':
        return '🧬';
      default:
        return '🎁';
    }
  };

  const handleClaimGift = (dayIndex: number) => {
    // Can only claim if it's the current day and not already claimed today
    if (dayIndex === currentStreak && !claimedToday) {
      claimDailyGift(dayIndex);
      setSelectedDay(dayIndex);
    }
  };

  const canClaim = (dayIndex: number) => {
    // Can only claim the current day's gift if not already claimed today
    // currentStreak represents how many days have been claimed (0-based)
    // So if currentStreak is 0, we can claim day 0
    // If currentStreak is 1, we can claim day 1, etc.
    return dayIndex === currentStreak && !claimedToday;
  };

  const isClaimed = (dayIndex: number) => {
    // A gift is claimed if it's a previous day OR if it's the current day and already claimed today
    return dayIndex < currentStreak || (dayIndex === currentStreak && claimedToday);
  };

  const isLocked = (dayIndex: number) => {
    // A gift is locked if it's a future day
    return dayIndex > currentStreak;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.gradientContainer}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.titleContainer}>
                  <Gift size={responsiveIconSize.xl} color="#F59E0B" />
                  <Text style={styles.title}>Daily Gifts</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={responsiveIconSize.lg} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              
              {/* Streak Counter */}
              <View style={styles.streakContainer}>
                <View style={styles.streakInfo}>
                  <Star size={responsiveIconSize.md} color="#F59E0B" />
                  <Text style={styles.streakText}>
                    {currentStreak}/7 Day Streak
                  </Text>
                </View>
                <View style={styles.streakProgress}>
                  {Array.from({ length: 7 }, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.streakDot,
                        index < currentStreak && styles.streakDotActive,
                        index === currentStreak && !claimedToday && styles.streakDotCurrent,
                      ]}
                    />
                  ))}
                </View>
              </View>

              {/* Countdown Timer */}
              <View style={styles.countdownContainer}>
                <View style={styles.countdownInfo}>
                  <Zap size={responsiveIconSize.md} color="#10B981" />
                  <Text style={styles.countdownLabel}>
                    {claimedToday ? 'Next gift available in:' : 'Claim your gift now!'}
                  </Text>
                </View>
                <View style={styles.countdownTimer}>
                  <Text style={styles.countdownText}>{timeUntilNextGift}</Text>
                </View>
              </View>
            </View>

            {/* Gifts Grid */}
            <ScrollView style={styles.giftsContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.giftsGrid}>
                {weeklyGifts.map((gift, index) => {
                  const isAvailable = canClaim(index);
                  const isClaimedGift = isClaimed(index);
                  const isLockedGift = isLocked(index);
                  const isSelected = selectedDay === index;
                  
                  return (
                    <TouchableOpacity
                      key={gift.id}
                      style={[
                        styles.giftCard,
                        isSelected && styles.giftCardSelected,
                        isClaimedGift && styles.giftCardClaimed,
                        isLockedGift && styles.giftCardLocked,
                      ]}
                      onPress={() => handleClaimGift(index)}
                      disabled={isLockedGift || isClaimedGift}
                    >
                      <LinearGradient
                        colors={getRarityColor(gift.rarity) as [string, string]}
                        style={[
                          styles.giftGradient,
                          isClaimedGift && styles.giftGradientClaimed,
                        ]}
                      >
                        {/* Day Number */}
                        <View style={styles.dayNumber}>
                          <Text style={styles.dayNumberText}>{index + 1}</Text>
                        </View>

                        {/* Gift Icon */}
                        <View style={styles.giftIconContainer}>
                          <Text style={styles.giftIcon}>{getTypeIcon(gift.type)}</Text>
                          {gift.rarity === 'legendary' && (
                            <View style={[styles.legendaryGlow, { shadowColor: getRarityGlow(gift.rarity) }]} />
                          )}
                        </View>

                        {/* Gift Info */}
                        <View style={styles.giftInfo}>
                          <Text style={styles.giftName}>{gift.name}</Text>
                          <Text style={styles.giftAmount}>
                            {gift.type === 'youth_pill' ? '1x' : `+${gift.amount}`}
                          </Text>
                          <Text style={styles.giftDescription}>{gift.description}</Text>
                          {gift.specialEffect && (
                            <Text style={styles.specialEffect}>{gift.specialEffect}</Text>
                          )}
                        </View>

                        {/* Status Indicators */}
                        {isClaimedGift && (
                          <View style={styles.claimedBadge}>
                            <Trophy size={responsiveIconSize.sm} color="#FFFFFF" />
                          </View>
                        )}
                        
                        {isLockedGift && (
                          <View style={styles.lockedOverlay}>
                            <Text style={styles.lockedText}>🔒</Text>
                          </View>
                        )}

                        {/* Claim Button for Available Gifts */}
                        {isAvailable && (
                          <View style={styles.claimButtonContainer}>
                            <LinearGradient
                              colors={['#10B981', '#059669']}
                              style={styles.claimButton}
                            >
                              <Text style={styles.claimButtonText}>CLAIM NOW</Text>
                            </LinearGradient>
                          </View>
                        )}

                        {/* Rarity Border */}
                        <View
                          style={[
                            styles.rarityBorder,
                            { borderColor: getRarityColor(gift.rarity)[0] },
                          ]}
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Special 7-Day Bonus */}
              {currentStreak >= 6 && (
                <View style={styles.bonusContainer}>
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    style={styles.bonusCard}
                  >
                    <View style={styles.bonusContent}>
                      <Trophy size={responsiveIconSize.xl} color="#FFFFFF" />
                      <Text style={styles.bonusTitle}>7-Day Streak Bonus!</Text>
                      <Text style={styles.bonusDescription}>
                        Complete your streak to unlock amazing rewards!
                      </Text>
                    </View>
                  </LinearGradient>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {claimedToday 
                  ? `Next gift available in ${timeUntilNextGift}` 
                  : "Claim your daily gift to continue your streak!"
                }
              </Text>
              {!claimedToday && currentStreak < 6 && (
                <Text style={styles.footerSubText}>
                  Complete 7 days for the legendary Youth Pill! 🧬
                </Text>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.large,
  },
  container: {
    width: '100%',
    maxWidth: scale(400),
    maxHeight: screenHeight * 0.9,
    borderRadius: responsiveBorderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 20,
  },
  gradientContainer: {
    flex: 1,
  },
  header: {
    padding: responsivePadding.large,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },

  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: responsiveSpacing.sm,
  },
  closeButton: {
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  streakContainer: {
    alignItems: 'center',
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  streakText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: responsiveSpacing.sm,
  },
  streakProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  streakDot: {
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: scale(4),
  },
  streakDotActive: {
    backgroundColor: '#10B981',
  },
  streakDotCurrent: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  countdownContainer: {
    marginTop: responsiveSpacing.md,
    alignItems: 'center',
    padding: responsivePadding.medium,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  countdownInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  countdownLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: responsiveSpacing.sm,
    textAlign: 'center',
  },
  countdownTimer: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: responsivePadding.medium,
    paddingVertical: responsivePadding.small,
    borderRadius: responsiveBorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  countdownText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#10B981',
    fontFamily: 'monospace',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  giftsContainer: {
    flex: 1,
    padding: responsivePadding.large,
  },
  giftsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  giftCard: {
    width: '48%',
    marginBottom: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  giftCardSelected: {
    transform: [{ scale: 1.05 }],
  },
  giftCardLocked: {
    opacity: 0.5,
  },
  giftCardClaimed: {
    opacity: 0.7,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  giftGradient: {
    padding: responsiveSpacing.lg,
    minHeight: verticalScale(140),
    position: 'relative',
  },
  giftGradientClaimed: {
    opacity: 0.6,
  },
  dayNumber: {
    position: 'absolute',
    top: responsiveSpacing.sm,
    right: responsiveSpacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: scale(12),
    width: scale(24),
    height: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumberText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  giftIconContainer: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
    position: 'relative',
  },
  giftIcon: {
    fontSize: responsiveFontSize['3xl'],
  },
  legendaryGlow: {
    position: 'absolute',
    top: -scale(5),
    left: -scale(5),
    right: -scale(5),
    bottom: -scale(5),
    borderRadius: scale(25),
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  giftInfo: {
    alignItems: 'center',
  },
  giftName: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: scale(2),
  },
  giftAmount: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: scale(2),
  },
  giftDescription: {
    fontSize: responsiveFontSize.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  specialEffect: {
    fontSize: responsiveFontSize.xs,
    color: '#FCD34D',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: scale(2),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  claimedBadge: {
    position: 'absolute',
    top: responsiveSpacing.sm,
    left: responsiveSpacing.sm,
    backgroundColor: '#10B981',
    borderRadius: scale(14),
    width: scale(28),
    height: scale(28),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedText: {
    fontSize: responsiveFontSize['2xl'],
  },
  rarityBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderRadius: responsiveBorderRadius.lg,
  },
  claimButtonContainer: {
    position: 'absolute',
    bottom: responsiveSpacing.sm,
    left: responsiveSpacing.sm,
    right: responsiveSpacing.sm,
  },
  claimButton: {
    paddingVertical: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.sm,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  claimButtonText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bonusContainer: {
    marginTop: responsiveSpacing.lg,
  },
  bonusCard: {
    padding: responsivePadding.large,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  bonusContent: {
    alignItems: 'center',
  },
  bonusTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.xs,
  },
  bonusDescription: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  footer: {
    padding: responsivePadding.large,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  footerSubText: {
    fontSize: responsiveFontSize.xs,
    color: '#FCD34D',
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
