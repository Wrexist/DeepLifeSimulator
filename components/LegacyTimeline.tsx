import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Crown, Calendar, DollarSign, Trophy, TrendingUp } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
} from '@/utils/scaling';

const { width } = Dimensions.get('window');

interface LegacyTimelineProps {
  visible: boolean;
  onClose: () => void;
}

export default function LegacyTimeline({ visible, onClose }: LegacyTimelineProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const previousLives = gameState.previousLives || [];
  const currentGeneration = gameState.generationNumber || 1;

  const sortedLives = useMemo(() => {
    return [...previousLives].sort((a, b) => (b.generation || 0) - (a.generation || 0));
  }, [previousLives]);

  const formatMoney = (amount: number) => {
    if (amount >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    }
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(2)}M`;
    }
    if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(2)}K`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Crown size={24} color={settings.darkMode ? '#F59E0B' : '#D97706'} />
              <Text style={[styles.title, settings.darkMode && styles.titleDark]}>
                Legacy Timeline
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Current Generation Badge */}
          <View style={styles.currentGenBadge}>
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              style={styles.currentGenGradient}
            >
              <Text style={styles.currentGenText}>
                Current: Generation {currentGeneration}
              </Text>
            </LinearGradient>
          </View>

          {/* Timeline */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
            {sortedLives.length === 0 ? (
              <View style={styles.emptyState}>
                <Crown size={48} color={settings.darkMode ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.emptyText, settings.darkMode && styles.emptyTextDark]}>
                  No previous generations yet
                </Text>
                <Text style={[styles.emptySubtext, settings.darkMode && styles.emptySubtextDark]}>
                  Your legacy will begin here when you start your next generation
                </Text>
              </View>
            ) : (
              <View style={styles.timeline}>
                {sortedLives.map((life, index) => (
                  <View key={index} style={styles.timelineItem}>
                    {/* Timeline Line */}
                    {index < sortedLives.length - 1 && (
                      <View style={[styles.timelineLine, settings.darkMode && styles.timelineLineDark]} />
                    )}

                    {/* Generation Card */}
                    <View style={styles.generationCard}>
                      <LinearGradient
                        colors={
                          settings.darkMode
                            ? ['#374151', '#1F2937']
                            : ['#F9FAFC', '#F3F4F6']
                        }
                        style={styles.cardGradient}
                      >
                        {/* Generation Number */}
                        <View style={styles.genHeader}>
                          <View style={styles.genBadge}>
                            <Crown size={16} color="#F59E0B" />
                            <Text style={styles.genNumber}>Gen {life.generation || '?'}</Text>
                          </View>
                          {life.timestamp && (
                            <View style={styles.dateBadge}>
                              <Calendar size={12} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                              <Text style={[styles.dateText, settings.darkMode && styles.dateTextDark]}>
                                {formatDate(life.timestamp)}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Stats Grid */}
                        <View style={styles.statsGrid}>
                          <View style={styles.statCard}>
                            <DollarSign size={16} color="#10B981" />
                            <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
                              Net Worth
                            </Text>
                            <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                              {formatMoney(life.netWorth || 0)}
                            </Text>
                          </View>

                          <View style={styles.statCard}>
                            <TrendingUp size={16} color="#3B82F6" />
                            <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
                              Age at Death
                            </Text>
                            <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                              {life.ageAtDeath || '?'} years
                            </Text>
                          </View>
                        </View>

                        {/* Death Reason */}
                        {life.deathReason && (
                          <View style={styles.deathReason}>
                            <Text style={[styles.deathReasonLabel, settings.darkMode && styles.deathReasonLabelDark]}>
                              Cause of Death:
                            </Text>
                            <Text style={[styles.deathReasonText, settings.darkMode && styles.deathReasonTextDark]}>
                              {life.deathReason === 'health'
                                ? 'Health Failure'
                                : life.deathReason === 'happiness'
                                ? 'Lost Will to Live'
                                : 'Unknown'}
                            </Text>
                          </View>
                        )}

                        {/* Achievements */}
                        {life.summaryAchievements && life.summaryAchievements.length > 0 && (
                          <View style={styles.achievements}>
                            <View style={styles.achievementsHeader}>
                              <Trophy size={14} color="#F59E0B" />
                              <Text style={[styles.achievementsTitle, settings.darkMode && styles.achievementsTitleDark]}>
                                Key Achievements
                              </Text>
                            </View>
                            <View style={styles.achievementsList}>
                              {life.summaryAchievements.slice(0, 3).map((achievement, idx) => (
                                <View key={idx} style={styles.achievementBadge}>
                                  <Text style={styles.achievementText}>{achievement}</Text>
                                </View>
                              ))}
                              {life.summaryAchievements.length > 3 && (
                                <Text style={[styles.moreAchievements, settings.darkMode && styles.moreAchievementsDark]}>
                                  +{life.summaryAchievements.length - 3} more
                                </Text>
                              )}
                            </View>
                          </View>
                        )}
                      </LinearGradient>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </LinearGradient>
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
  },
  container: {
    width: width * 0.9,
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  currentGenBadge: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  currentGenGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  currentGenText: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyTextDark: {
    color: '#9CA3AF',
  },
  emptySubtext: {
    fontSize: responsiveFontSize.sm,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  emptySubtextDark: {
    color: '#6B7280',
  },
  timeline: {
    paddingBottom: 20,
  },
  timelineItem: {
    position: 'relative',
    marginBottom: 24,
  },
  timelineLine: {
    position: 'absolute',
    left: 20,
    top: 60,
    width: 2,
    height: '100%',
    backgroundColor: '#E5E7EB',
    zIndex: 0,
  },
  timelineLineDark: {
    backgroundColor: '#374151',
  },
  generationCard: {
    marginLeft: 0,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  genHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  genBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  genNumber: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
  },
  dateTextDark: {
    color: '#9CA3AF',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 4,
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#111827',
  },
  statValueDark: {
    color: '#FFFFFF',
  },
  deathReason: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  deathReasonLabel: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    marginBottom: 4,
  },
  deathReasonLabelDark: {
    color: '#9CA3AF',
  },
  deathReasonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#DC2626',
  },
  deathReasonTextDark: {
    color: '#F87171',
  },
  achievements: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  achievementsTitle: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#111827',
  },
  achievementsTitleDark: {
    color: '#FFFFFF',
  },
  achievementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  achievementBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  achievementText: {
    fontSize: responsiveFontSize.xs,
    color: '#D97706',
    fontWeight: '500',
  },
  moreAchievements: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    fontStyle: 'italic',
    alignSelf: 'center',
  },
  moreAchievementsDark: {
    color: '#9CA3AF',
  },
});

