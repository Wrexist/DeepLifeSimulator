import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// import { BlurView } from 'expo-blur'; // Removed - TurboModule crash fix
import {
  Trophy,
  Star,
  Gem,
  Clock,
  CheckCircle2,
  Circle,
  X,
  Zap,
  TrendingUp,
  Award,
} from 'lucide-react-native';
import { useGameState, useGameActions } from '@/contexts/GameContext';
import { scale, fontScale, verticalScale } from '@/utils/scaling';
import { generateDailyChallenges, getTimeUntilReset, DailyChallenge } from '@/utils/dailyChallenges';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface DailyChallengesModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function DailyChallengesModal({ visible, onClose }: DailyChallengesModalProps) {
  const { gameState } = useGameState();
  const { claimDailyChallengeReward } = useGameActions();
  const { settings, dailyChallenges } = gameState;
  const isDarkMode = settings.darkMode;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Countdown timer
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilReset());

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      slideAnim.setValue(50);
      glowAnim.setValue(0);

      // Start entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Glow animation
      Animated.loop(
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
      ).start();

      // Update countdown every second
      const interval = setInterval(() => {
        setTimeUntilReset(getTimeUntilReset());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [visible]);

  if (!dailyChallenges) {
    return null;
  }

  const todaysChallenges = generateDailyChallenges();

  const handleClaim = (difficulty: 'easy' | 'medium' | 'hard') => {
    const result = claimDailyChallengeReward(difficulty);
    if (result.success) {
      // Show success feedback
    }
  };

  const renderChallengeCard = (
    difficulty: 'easy' | 'medium' | 'hard',
    challenge: DailyChallenge,
    challengeState: { id: string; progress: number; claimed: boolean }
  ) => {
    const progress = (challengeState.progress / challenge.maxProgress) * 100;
    const isCompleted = challengeState.progress >= challenge.maxProgress;
    const isClaimed = challengeState.claimed;

    const colors = {
      easy: { gradient: ['#10B981', '#34D399'], glow: 'rgba(16, 185, 129, 0.3)', text: '#10B981' },
      medium: { gradient: ['#3B82F6', '#60A5FA'], glow: 'rgba(59, 130, 246, 0.3)', text: '#3B82F6' },
      hard: { gradient: ['#8B5CF6', '#A78BFA'], glow: 'rgba(139, 92, 246, 0.3)', text: '#8B5CF6' },
    };

    const color = colors[difficulty];

    return (
      <Animated.View
        style={[
          styles.challengeCard,
          isDarkMode && styles.challengeCardDark,
          {
            transform: [{ scale: scaleAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Glow effect for completed challenges */}
        {isCompleted && !isClaimed && (
          <Animated.View
            style={[
              styles.cardGlow,
              {
                opacity: glowAnim,
                shadowColor: color.text,
              },
            ]}
          />
        )}

        <LinearGradient
          colors={color.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.difficultyBadge}
        >
          <Text style={styles.difficultyText}>{difficulty.toUpperCase()}</Text>
          <View style={styles.rewardBadge}>
            <Gem size={scale(12)} color="#FFF" />
            <Text style={styles.rewardText}>{challenge.reward}</Text>
          </View>
        </LinearGradient>

        <View style={styles.challengeContent}>
          <View style={styles.challengeHeader}>
            <Text style={[styles.challengeName, isDarkMode && styles.textDark]}>
              {challenge.name}
            </Text>
            {isCompleted && (
              <CheckCircle2 size={scale(24)} color={color.text} />
            )}
          </View>

          <Text style={[styles.challengeDescription, isDarkMode && styles.textMutedDark]}>
            {challenge.description}
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, isDarkMode && styles.progressBarDark]}>
              <LinearGradient
                colors={color.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]}
              />
            </View>
            <Text style={[styles.progressText, isDarkMode && styles.textMutedDark]}>
              {challengeState.progress} / {challenge.maxProgress}
            </Text>
          </View>

          {/* Claim Button */}
          {isCompleted && !isClaimed && (
            <TouchableOpacity
              onPress={() => handleClaim(difficulty)}
              activeOpacity={0.8}
              style={styles.claimButton}
            >
              <LinearGradient
                colors={color.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.claimButtonGradient}
              >
                <Trophy size={scale(16)} color="#FFF" />
                <Text style={styles.claimButtonText}>Claim +{challenge.reward} Gems</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isClaimed && (
            <View style={styles.claimedBadge}>
              <CheckCircle2 size={scale(16)} color={color.text} />
              <Text style={[styles.claimedText, { color: color.text }]}>Claimed</Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  const totalCompleted = [
    dailyChallenges.easy.claimed,
    dailyChallenges.medium.claimed,
    dailyChallenges.hard.claimed,
  ].filter(Boolean).length;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <BlurView intensity={30} style={styles.overlay}>
        <Animated.View
          style={[
            styles.modal,
            isDarkMode && styles.modalDark,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <LinearGradient
            colors={['#F59E0B', '#F97316', '#EF4444']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Zap size={scale(32)} color="#FFF" />
                <View>
                  <Text style={styles.title}>Daily Challenges</Text>
                  <Text style={styles.subtitle}>{totalCompleted}/3 Completed</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={scale(24)} color="#FFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Streak and Timer Row */}
          <View style={[styles.streakTimerRow, isDarkMode && styles.streakTimerRowDark]}>
            {/* Streak Counter */}
            <View style={styles.streakContainer}>
              <Animated.View
                style={[
                  styles.streakIconContainer,
                  {
                    transform: [{
                      scale: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.1],
                      }),
                    }],
                  },
                ]}
              >
                <TrendingUp size={scale(18)} color="#F59E0B" />
              </Animated.View>
              <View>
                <Text style={[styles.streakValue, isDarkMode && styles.textDark]}>
                  {dailyChallenges.streak || 0}
                </Text>
                <Text style={[styles.streakLabel, isDarkMode && styles.textMutedDark]}>
                  Day Streak
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.streakDivider, isDarkMode && styles.streakDividerDark]} />

            {/* Countdown Timer */}
            <View style={styles.timerContent}>
              <Clock size={scale(16)} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <View>
                <Text style={[styles.timerValue, isDarkMode && styles.textDark]}>
                  {String(timeUntilReset.hours).padStart(2, '0')}:
                  {String(timeUntilReset.minutes).padStart(2, '0')}:
                  {String(timeUntilReset.seconds).padStart(2, '0')}
                </Text>
                <Text style={[styles.timerLabel, isDarkMode && styles.textMutedDark]}>
                  Until Reset
                </Text>
              </View>
            </View>
          </View>

          {/* Challenges List */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Streak Bonus Banner */}
            {(dailyChallenges.streak || 0) >= 3 && (
              <View style={styles.streakBonusBanner}>
                <LinearGradient
                  colors={['#F59E0B', '#EF4444']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.streakBonusGradient}
                >
                  <Star size={scale(18)} color="#FFF" />
                  <Text style={styles.streakBonusText}>
                    🔥 {Math.min(((dailyChallenges.streak || 0) - 2) * 5, 25)}% Streak Bonus Active!
                  </Text>
                </LinearGradient>
              </View>
            )}

            {/* Daily Challenges Header */}
            <View style={styles.sectionHeader}>
              <Zap size={scale(18)} color={isDarkMode ? '#F59E0B' : '#D97706'} />
              <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
                Daily Challenges
              </Text>
            </View>

            {renderChallengeCard('easy', todaysChallenges.easy, dailyChallenges.easy)}
            {renderChallengeCard('medium', todaysChallenges.medium, dailyChallenges.medium)}
            {renderChallengeCard('hard', todaysChallenges.hard, dailyChallenges.hard)}

            {/* Weekly Challenges Section */}
            <View style={[styles.sectionHeader, { marginTop: scale(16) }]}>
              <Trophy size={scale(18)} color={isDarkMode ? '#A78BFA' : '#8B5CF6'} />
              <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
                Weekly Challenge
              </Text>
              <View style={styles.weeklyBadge}>
                <Text style={styles.weeklyBadgeText}>BONUS</Text>
              </View>
            </View>

            <View style={[styles.weeklyCard, isDarkMode && styles.weeklyCardDark]}>
              <LinearGradient
                colors={['#8B5CF6', '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.weeklyHeader}
              >
                <View style={styles.weeklyHeaderContent}>
                  <Trophy size={scale(24)} color="#FFF" />
                  <View style={styles.weeklyHeaderText}>
                    <Text style={styles.weeklyTitle}>Complete All Daily Challenges</Text>
                    <Text style={styles.weeklySubtitle}>7 days in a row</Text>
                  </View>
                </View>
                <View style={styles.weeklyReward}>
                  <Gem size={scale(14)} color="#FFF" />
                  <Text style={styles.weeklyRewardText}>200</Text>
                </View>
              </LinearGradient>

              <View style={styles.weeklyProgress}>
                <View style={styles.weeklyProgressDays}>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const weeklyProgress = dailyChallenges.weeklyProgress || 0;
                    const isCompleted = day < weeklyProgress;
                    const isCurrent = day === weeklyProgress;
                    return (
                      <View
                        key={day}
                        style={[
                          styles.weeklyDay,
                          isCompleted && styles.weeklyDayCompleted,
                          isCurrent && styles.weeklyDayCurrent,
                          isDarkMode && !isCompleted && !isCurrent && styles.weeklyDayDark,
                        ]}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={scale(14)} color="#FFF" />
                        ) : (
                          <Text style={[
                            styles.weeklyDayText,
                            isCurrent && styles.weeklyDayTextCurrent,
                            isDarkMode && styles.weeklyDayTextDark,
                          ]}>
                            {day + 1}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.weeklyProgressText, isDarkMode && styles.textMutedDark]}>
                  {dailyChallenges.weeklyProgress || 0}/7 days completed
                </Text>
              </View>
            </View>

            {/* Streak Milestones */}
            <View style={[styles.sectionHeader, { marginTop: scale(16) }]}>
              <TrendingUp size={scale(18)} color={isDarkMode ? '#10B981' : '#059669'} />
              <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
                Streak Milestones
              </Text>
            </View>

            <View style={styles.milestonesRow}>
              {[
                { days: 3, reward: 25, icon: '🔥' },
                { days: 7, reward: 75, icon: '⚡' },
                { days: 14, reward: 150, icon: '🏆' },
                { days: 30, reward: 500, icon: '👑' },
              ].map((milestone, index) => {
                const currentStreak = dailyChallenges.streak || 0;
                const isReached = currentStreak >= milestone.days;
                return (
                  <View
                    key={index}
                    style={[
                      styles.milestoneCard,
                      isReached && styles.milestoneCardReached,
                      isDarkMode && styles.milestoneCardDark,
                    ]}
                  >
                    <Text style={styles.milestoneIcon}>{milestone.icon}</Text>
                    <Text style={[
                      styles.milestoneDays,
                      isReached && styles.milestoneDaysReached,
                      isDarkMode && styles.textDark,
                    ]}>
                      {milestone.days}
                    </Text>
                    <Text style={[styles.milestoneLabel, isDarkMode && styles.textMutedDark]}>
                      days
                    </Text>
                    <View style={styles.milestoneReward}>
                      <Gem size={scale(10)} color={isReached ? '#10B981' : (isDarkMode ? '#6B7280' : '#9CA3AF')} />
                      <Text style={[
                        styles.milestoneRewardText,
                        isReached && styles.milestoneRewardTextReached,
                        isDarkMode && styles.textMutedDark,
                      ]}>
                        {milestone.reward}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Total Rewards */}
            <View style={[styles.totalRewards, isDarkMode && styles.totalRewardsDark]}>
              <Award size={scale(24)} color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
              <Text style={[styles.totalRewardsText, isDarkMode && styles.textDark]}>
                Complete all challenges to earn{' '}
                <Text style={styles.totalRewardsGems}>85 gems</Text> today!
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: screenWidth * 0.9,
    maxWidth: 500,
    maxHeight: screenHeight * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    overflow: 'hidden',
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    padding: scale(20),
    paddingTop: scale(24),
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: fontScale(14),
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: scale(2),
  },
  closeButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    padding: scale(12),
    backgroundColor: '#F3F4F6',
  },
  timerContainerDark: {
    backgroundColor: '#111827',
  },
  timerText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#6B7280',
  },
  scrollView: {
    padding: scale(16),
  },
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(16),
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  challengeCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: scale(16),
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(12),
    marginBottom: scale(12),
  },
  difficultyText: {
    fontSize: fontScale(12),
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  rewardText: {
    fontSize: fontScale(12),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  challengeContent: {
    gap: scale(12),
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeName: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  textDark: {
    color: '#F9FAFB',
  },
  challengeDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    lineHeight: fontScale(20),
  },
  textMutedDark: {
    color: '#9CA3AF',
  },
  progressContainer: {
    gap: scale(8),
  },
  progressBar: {
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressBarDark: {
    backgroundColor: '#4B5563',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  progressText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    textAlign: 'right',
  },
  claimButton: {
    marginTop: scale(8),
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(12),
    borderRadius: scale(12),
  },
  claimButtonText: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(12),
    borderRadius: scale(12),
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  claimedText: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  totalRewards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    padding: scale(16),
    backgroundColor: '#EFF6FF',
    borderRadius: scale(12),
    marginTop: scale(8),
    marginBottom: scale(16),
  },
  totalRewardsDark: {
    backgroundColor: '#1E3A8A',
  },
  totalRewardsText: {
    flex: 1,
    fontSize: fontScale(14),
    color: '#1F2937',
    lineHeight: fontScale(20),
  },
  totalRewardsGems: {
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  // Streak and Timer Row
  streakTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(12),
    backgroundColor: '#F3F4F6',
    gap: scale(16),
  },
  streakTimerRowDark: {
    backgroundColor: '#111827',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  streakIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#1F2937',
  },
  streakLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
  },
  streakDivider: {
    width: 1,
    height: scale(32),
    backgroundColor: '#E5E7EB',
  },
  streakDividerDark: {
    backgroundColor: '#374151',
  },
  timerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  timerValue: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#1F2937',
  },
  timerLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
  },
  // Streak Bonus Banner
  streakBonusBanner: {
    marginBottom: scale(16),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  streakBonusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
  },
  streakBonusText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  sectionTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  // Weekly Challenges
  weeklyBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(6),
  },
  weeklyBadgeText: {
    fontSize: fontScale(10),
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  weeklyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    overflow: 'hidden',
    marginBottom: scale(16),
    borderWidth: 2,
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  weeklyCardDark: {
    backgroundColor: '#374151',
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(14),
  },
  weeklyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    flex: 1,
  },
  weeklyHeaderText: {
    flex: 1,
  },
  weeklyTitle: {
    fontSize: fontScale(15),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  weeklySubtitle: {
    fontSize: fontScale(12),
    color: 'rgba(255,255,255,0.8)',
    marginTop: scale(2),
  },
  weeklyReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(5),
    borderRadius: scale(10),
  },
  weeklyRewardText: {
    fontSize: fontScale(14),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  weeklyProgress: {
    padding: scale(14),
    gap: scale(10),
  },
  weeklyProgressDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weeklyDay: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyDayDark: {
    backgroundColor: '#4B5563',
  },
  weeklyDayCompleted: {
    backgroundColor: '#10B981',
  },
  weeklyDayCurrent: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  weeklyDayText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#6B7280',
  },
  weeklyDayTextDark: {
    color: '#9CA3AF',
  },
  weeklyDayTextCurrent: {
    color: '#92400E',
  },
  weeklyProgressText: {
    fontSize: fontScale(13),
    color: '#6B7280',
    textAlign: 'center',
  },
  // Milestones
  milestonesRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginBottom: scale(16),
  },
  milestoneCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    padding: scale(10),
    alignItems: 'center',
  },
  milestoneCardDark: {
    backgroundColor: '#374151',
  },
  milestoneCardReached: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  milestoneIcon: {
    fontSize: fontScale(18),
    marginBottom: scale(4),
  },
  milestoneDays: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#374151',
  },
  milestoneDaysReached: {
    color: '#059669',
  },
  milestoneLabel: {
    fontSize: fontScale(10),
    color: '#6B7280',
  },
  milestoneReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    marginTop: scale(4),
  },
  milestoneRewardText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#9CA3AF',
  },
  milestoneRewardTextReached: {
    color: '#10B981',
  },
});


