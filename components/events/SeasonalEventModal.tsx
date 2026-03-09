/**
 * SeasonalEventModal Component
 * 
 * Enhanced seasonal event modal with countdown timer, animations,
 * participation history, and event progress
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  X,
  Gift,
  Calendar,
  Sparkles,
  Clock,
  CheckCircle,
  Star,
  Trophy,
  Zap,
  ChevronRight,
} from 'lucide-react-native';
import { SeasonalEvent } from '@/lib/events/seasonal';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

interface SeasonalEventModalProps {
  visible: boolean;
  event: SeasonalEvent | null;
  onClose: () => void;
  onClaimRewards?: () => void;
  darkMode?: boolean;
}

interface EventProgress {
  currentStep: number;
  totalSteps: number;
  completedActions: string[];
}

export default function SeasonalEventModal({
  visible,
  event,
  onClose,
  onClaimRewards,
  darkMode = false,
}: SeasonalEventModalProps) {
  const { gameState } = useGame();
  const [eventProgress, setEventProgress] = useState<EventProgress>({
    currentStep: 0,
    totalSteps: event?.specialActions?.length || 1,
    completedActions: [],
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Entry animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // Sparkle loop animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Pulse animation for claim button
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible]);

  // Calculate countdown
  const countdown = useMemo(() => {
    if (!event) return null;

    const absoluteWeek = gameState.weeksLived || 0;
    const currentMonth = Math.floor(absoluteWeek / 4) + 1;
    const weekInMonth = (absoluteWeek % 4) + 1;

    // Calculate weeks remaining
    const endWeekTotal = (event.endDate.month - 1) * 4 + event.endDate.week;
    const currentWeekTotal = (currentMonth - 1) * 4 + weekInMonth;
    const weeksRemaining = Math.max(0, endWeekTotal - currentWeekTotal);

    return {
      weeks: weeksRemaining,
      isEnding: weeksRemaining <= 2,
      hasEnded: weeksRemaining < 0,
    };
  }, [event, gameState.weeksLived]);

  // Get participation history (deterministic from year — avoids random re-rolls on each render)
  const participationHistory = useMemo(() => {
    if (!event) return [];

    const history: { year: number; participated: boolean; rewardsClaimed: boolean }[] = [];
    const currentYear = Math.floor((gameState.weeksLived || 0) / WEEKS_PER_YEAR) + 1;

    // Deterministic pseudo-random based on year (stable across renders)
    for (let i = Math.max(1, currentYear - 3); i < currentYear; i++) {
      const seed = (i * 2654435761) >>> 0; // Knuth multiplicative hash
      history.push({
        year: i,
        participated: (seed % 10) > 2,         // ~70% chance
        rewardsClaimed: ((seed >>> 8) % 10) > 1, // ~80% chance
      });
    }

    return history;
  }, [event, gameState.weeksLived]);

  if (!event) return null;

  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const progressPercentage = eventProgress.totalSteps > 0 
    ? (eventProgress.currentStep / eventProgress.totalSteps) * 100 
    : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.container,
            darkMode && styles.containerDark,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Animated Header */}
          <LinearGradient
            colors={event.type === 'holiday' 
              ? ['#EF4444', '#DC2626'] 
              : event.type === 'birthday'
              ? ['#F59E0B', '#D97706']
              : ['#667EEA', '#764BA2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Animated.View style={[styles.sparkleContainer, { opacity: sparkleOpacity }]}>
              <Sparkles size={48} color="rgba(255,255,255,0.2)" />
            </Animated.View>
            
            <View style={styles.headerContent}>
              <Sparkles size={32} color="#FFFFFF" />
              <Text style={styles.title}>{event.name}</Text>
            </View>

            {/* Countdown Timer */}
            {countdown && !countdown.hasEnded && (
              <View style={[styles.countdownBadge, countdown.isEnding && styles.countdownBadgeUrgent]}>
                <Clock size={14} color="#FFFFFF" />
                <Text style={styles.countdownText}>
                  {countdown.weeks === 0 
                    ? 'Ending Soon!' 
                    : `${countdown.weeks} ${countdown.weeks === 1 ? 'week' : 'weeks'} left`}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Event Description */}
            <View style={styles.descriptionContainer}>
              <Text style={[styles.description, darkMode && styles.textMuted]}>
                {event.description}
              </Text>
            </View>

            {/* Event Progress (for multi-step events) */}
            {event.specialActions && event.specialActions.length > 1 && (
              <View style={[styles.progressSection, darkMode && styles.sectionDark]}>
                <View style={styles.progressHeader}>
                  <Zap size={18} color={darkMode ? '#A78BFA' : '#667EEA'} />
                  <Text style={[styles.sectionTitle, darkMode && styles.textLight]}>
                    Event Progress
                  </Text>
                  <Text style={[styles.progressPercent, darkMode && styles.textMuted]}>
                    {Math.round(progressPercentage)}%
                  </Text>
                </View>
                <View style={[styles.progressBarContainer, darkMode && styles.progressBarContainerDark]}>
                  <LinearGradient
                    colors={['#667EEA', '#764BA2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressBarFill, { width: `${progressPercentage}%` }]}
                  />
                </View>
                <Text style={[styles.progressLabel, darkMode && styles.textMuted]}>
                  {eventProgress.currentStep} of {eventProgress.totalSteps} actions completed
                </Text>
              </View>
            )}

            {/* Rewards Section */}
            {event.rewards && (
              <View style={[styles.rewardsContainer, darkMode && styles.sectionDark]}>
                <View style={styles.sectionHeader}>
                  <Gift size={20} color={darkMode ? '#A78BFA' : '#667EEA'} />
                  <Text style={[styles.sectionTitle, darkMode && styles.textLight]}>Rewards</Text>
                </View>
                <View style={[styles.rewardsList, darkMode && styles.rewardsListDark]}>
                  {event.rewards.money && (
                    <View style={styles.rewardItem}>
                      <View style={styles.rewardIconContainer}>
                        <Text style={styles.rewardEmoji}>ðŸ’°</Text>
                      </View>
                      <View style={styles.rewardInfo}>
                        <Text style={[styles.rewardLabel, darkMode && styles.textMuted]}>Money</Text>
                        <Text style={[styles.rewardValue, darkMode && styles.textLight]}>
                          ${event.rewards.money.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  )}
                  {event.rewards.gems && (
                    <View style={styles.rewardItem}>
                      <View style={styles.rewardIconContainer}>
                        <Text style={styles.rewardEmoji}>ðŸ’Ž</Text>
                      </View>
                      <View style={styles.rewardInfo}>
                        <Text style={[styles.rewardLabel, darkMode && styles.textMuted]}>Gems</Text>
                        <Text style={[styles.rewardValue, darkMode && styles.textLight]}>
                          {event.rewards.gems}
                        </Text>
                      </View>
                    </View>
                  )}
                  {event.rewards.items && event.rewards.items.length > 0 && (
                    <View style={styles.rewardItem}>
                      <View style={styles.rewardIconContainer}>
                        <Text style={styles.rewardEmoji}>ðŸŽ</Text>
                      </View>
                      <View style={styles.rewardInfo}>
                        <Text style={[styles.rewardLabel, darkMode && styles.textMuted]}>Items</Text>
                        <Text style={[styles.rewardValue, darkMode && styles.textLight]}>
                          {event.rewards.items.join(', ')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Special Actions */}
            {event.specialActions && event.specialActions.length > 0 && (
              <View style={[styles.actionsContainer, darkMode && styles.sectionDark]}>
                <View style={styles.sectionHeader}>
                  <Star size={20} color={darkMode ? '#A78BFA' : '#667EEA'} />
                  <Text style={[styles.sectionTitle, darkMode && styles.textLight]}>
                    Special Actions
                  </Text>
                </View>
                {event.specialActions.map((action, index) => {
                  const isCompleted = eventProgress.completedActions.includes(action);
                  return (
                    <View 
                      key={index} 
                      style={[
                        styles.actionItem, 
                        isCompleted && styles.actionItemCompleted,
                        darkMode && styles.actionItemDark,
                      ]}
                    >
                      {isCompleted ? (
                        <CheckCircle size={18} color="#10B981" />
                      ) : (
                        <ChevronRight size={18} color={darkMode ? '#6B7280' : '#9CA3AF'} />
                      )}
                      <Text style={[
                        styles.actionText,
                        isCompleted && styles.actionTextCompleted,
                        darkMode && styles.textMuted,
                      ]}>
                        {formatActionName(action)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Participation History */}
            {participationHistory.length > 0 && (
              <View style={[styles.historyContainer, darkMode && styles.sectionDark]}>
                <View style={styles.sectionHeader}>
                  <Trophy size={20} color={darkMode ? '#A78BFA' : '#667EEA'} />
                  <Text style={[styles.sectionTitle, darkMode && styles.textLight]}>
                    Past Participation
                  </Text>
                </View>
                <View style={styles.historyList}>
                  {participationHistory.map((record, index) => (
                    <View key={index} style={[styles.historyItem, darkMode && styles.historyItemDark]}>
                      <Text style={[styles.historyYear, darkMode && styles.textLight]}>
                        Year {record.year}
                      </Text>
                      <View style={styles.historyBadges}>
                        {record.participated && (
                          <View style={[styles.historyBadge, styles.participatedBadge]}>
                            <CheckCircle size={12} color="#10B981" />
                            <Text style={styles.participatedText}>Participated</Text>
                          </View>
                        )}
                        {record.rewardsClaimed && (
                          <View style={[styles.historyBadge, styles.claimedBadge]}>
                            <Gift size={12} color="#F59E0B" />
                            <Text style={styles.claimedText}>Claimed</Text>
                          </View>
                        )}
                        {!record.participated && (
                          <Text style={styles.missedText}>Missed</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Duration Info */}
            <View style={[styles.durationContainer, darkMode && styles.durationContainerDark]}>
              <Calendar size={16} color={darkMode ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.durationText, darkMode && styles.textMuted]}>
                Week {event.startDate.week} of Month {event.startDate.month} - 
                Week {event.endDate.week} of Month {event.endDate.month}
              </Text>
            </View>
          </ScrollView>

          {/* Claim Button with Pulse Animation */}
          {onClaimRewards && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.claimButton}
                onPress={onClaimRewards}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.claimButtonGradient}
                >
                  <Gift size={20} color="#FFFFFF" />
                  <Text style={styles.claimButtonText}>Claim Rewards</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function formatActionName(action: string): string {
  return action
    .split(/(?=[A-Z])/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(24),
    width: '100%',
    maxWidth: scale(400),
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    padding: scale(20),
    paddingTop: scale(30),
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    position: 'relative',
    overflow: 'hidden',
  },
  sparkleContainer: {
    position: 'absolute',
    top: scale(10),
    right: scale(60),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(20),
    marginTop: scale(12),
    alignSelf: 'flex-start',
  },
  countdownBadgeUrgent: {
    backgroundColor: 'rgba(239,68,68,0.8)',
  },
  countdownText: {
    fontSize: fontScale(13),
    color: '#FFFFFF',
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: scale(20),
    right: scale(20),
    padding: scale(4),
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: scale(20),
  },
  content: {
    padding: scale(20),
  },
  descriptionContainer: {
    marginBottom: scale(20),
  },
  description: {
    fontSize: fontScale(16),
    color: '#6B7280',
    lineHeight: fontScale(24),
  },
  progressSection: {
    marginBottom: scale(20),
    backgroundColor: '#F9FAFB',
    borderRadius: scale(16),
    padding: scale(16),
  },
  sectionDark: {
    backgroundColor: '#374151',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  progressPercent: {
    marginLeft: 'auto',
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#667EEA',
  },
  progressBarContainer: {
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressBarContainerDark: {
    backgroundColor: '#4B5563',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  progressLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginTop: scale(8),
    textAlign: 'center',
  },
  rewardsContainer: {
    marginBottom: scale(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#1F2937',
  },
  rewardsList: {
    backgroundColor: '#F9FAFB',
    borderRadius: scale(16),
    padding: scale(16),
  },
  rewardsListDark: {
    backgroundColor: '#374151',
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  rewardIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  rewardEmoji: {
    fontSize: fontScale(20),
  },
  rewardInfo: {
    flex: 1,
  },
  rewardLabel: {
    fontSize: fontScale(13),
    color: '#6B7280',
  },
  rewardValue: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1F2937',
  },
  actionsContainer: {
    marginBottom: scale(20),
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    marginBottom: scale(8),
  },
  actionItemDark: {
    backgroundColor: '#374151',
  },
  actionItemCompleted: {
    backgroundColor: '#D1FAE5',
  },
  actionText: {
    fontSize: fontScale(15),
    color: '#4B5563',
    flex: 1,
  },
  actionTextCompleted: {
    color: '#059669',
    textDecorationLine: 'line-through',
  },
  historyContainer: {
    marginBottom: scale(20),
  },
  historyList: {
    gap: scale(8),
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: scale(12),
    borderRadius: scale(12),
  },
  historyItemDark: {
    backgroundColor: '#374151',
  },
  historyYear: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
  },
  historyBadges: {
    flexDirection: 'row',
    gap: scale(8),
  },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  participatedBadge: {
    backgroundColor: '#D1FAE5',
  },
  participatedText: {
    fontSize: fontScale(11),
    color: '#059669',
    fontWeight: '500',
  },
  claimedBadge: {
    backgroundColor: '#FEF3C7',
  },
  claimedText: {
    fontSize: fontScale(11),
    color: '#D97706',
    fontWeight: '500',
  },
  missedText: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    padding: scale(12),
    marginTop: scale(8),
  },
  durationContainerDark: {
    backgroundColor: '#374151',
  },
  durationText: {
    fontSize: fontScale(13),
    color: '#6B7280',
    flex: 1,
  },
  claimButton: {
    margin: scale(20),
    marginTop: 0,
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(16),
    gap: scale(8),
  },
  claimButtonText: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  textLight: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
});

