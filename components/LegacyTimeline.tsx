/**
 * LegacyTimeline Component
 * 
 * Displays previous lives with expandable details, family tree links,
 * and achievement badges
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  X,
  Crown,
  Calendar,
  DollarSign,
  Trophy,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Users,
  Briefcase,
  Heart,
  Home,
  Building2,
  Star,
  Award,
  Zap,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
  fontScale,
} from '@/utils/scaling';

const { width } = Dimensions.get('window');

interface LegacyTimelineProps {
  visible: boolean;
  onClose: () => void;
  onOpenFamilyTree?: (generation: number) => void;
}

interface PreviousLife {
  generation?: number;
  timestamp?: number;
  netWorth?: number;
  ageAtDeath?: number;
  deathReason?: string;
  summaryAchievements?: string[];
  careerHistory?: string[];
  totalChildren?: number;
  propertiesOwned?: number;
  companiesOwned?: number;
  happiness?: number;
  health?: number;
  totalWeeksWorked?: number;
  spouseName?: string;
  memorableEvents?: string[];
}

export default function LegacyTimeline({ visible, onClose, onOpenFamilyTree }: LegacyTimelineProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const previousLives = (gameState.previousLives || []) as PreviousLife[];
  const currentGeneration = gameState.generationNumber || 1;

  const [expandedLife, setExpandedLife] = useState<number | null>(null);

  const sortedLives = useMemo(() => {
    return [...previousLives].sort((a, b) => (b.generation || 0) - (a.generation || 0));
  }, [previousLives]);

  // Calculate total legacy stats
  const legacyStats = useMemo(() => {
    return {
      totalGenerations: previousLives.length,
      totalWealth: previousLives.reduce((sum, life) => sum + (life.netWorth || 0), 0),
      totalAchievements: previousLives.reduce((sum, life) => sum + (life.summaryAchievements?.length || 0), 0),
      averageAge: previousLives.length > 0
        ? Math.round(previousLives.reduce((sum, life) => sum + (life.ageAtDeath || 0), 0) / previousLives.length)
        : 0,
      bestLife: previousLives.reduce((best, life) => 
        (life.netWorth || 0) > (best?.netWorth || 0) ? life : best, previousLives[0]),
    };
  }, [previousLives]);

  const formatMoney = (amount: number) => {
    if (amount >= 1_000_000_000_000) {
      return `$${(amount / 1_000_000_000_000).toFixed(2)}T`;
    }
    if (amount >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    }
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(2)}M`;
    }
    if (amount > 10_000) {
      return `$${(amount / 1_000).toFixed(2)}K`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const toggleExpand = (index: number) => {
    setExpandedLife(expandedLife === index ? null : index);
  };

  const getDeathReasonDisplay = (reason?: string) => {
    switch (reason) {
      case 'health':
        return { text: 'Health Failure', color: '#EF4444', icon: Heart };
      case 'happiness':
        return { text: 'Lost Will to Live', color: '#8B5CF6', icon: Heart };
      case 'old_age':
        return { text: 'Old Age', color: '#6B7280', icon: Calendar };
      case 'accident':
        return { text: 'Accident', color: '#F59E0B', icon: Zap };
      default:
        return { text: 'Unknown', color: '#6B7280', icon: X };
    }
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
              <Crown size={scale(24)} color={settings.darkMode ? '#F59E0B' : '#D97706'} />
              <Text style={[styles.title, settings.darkMode && styles.titleDark]}>
                Legacy Timeline
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={scale(24)} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
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

          {/* Legacy Summary Stats */}
          {previousLives.length > 0 && (
            <View style={styles.legacySummary}>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryStat, settings.darkMode && styles.summaryStatDark]}>
                  <Crown size={scale(16)} color="#F59E0B" />
                  <Text style={[styles.summaryValue, settings.darkMode && styles.summaryValueDark]}>
                    {legacyStats.totalGenerations}
                  </Text>
                  <Text style={[styles.summaryLabel, settings.darkMode && styles.summaryLabelDark]}>
                    Lives
                  </Text>
                </View>
                <View style={[styles.summaryStat, settings.darkMode && styles.summaryStatDark]}>
                  <DollarSign size={scale(16)} color="#10B981" />
                  <Text style={[styles.summaryValue, settings.darkMode && styles.summaryValueDark]}>
                    {formatMoney(legacyStats.totalWealth)}
                  </Text>
                  <Text style={[styles.summaryLabel, settings.darkMode && styles.summaryLabelDark]}>
                    Total Earned
                  </Text>
                </View>
                <View style={[styles.summaryStat, settings.darkMode && styles.summaryStatDark]}>
                  <Trophy size={scale(16)} color="#8B5CF6" />
                  <Text style={[styles.summaryValue, settings.darkMode && styles.summaryValueDark]}>
                    {legacyStats.totalAchievements}
                  </Text>
                  <Text style={[styles.summaryLabel, settings.darkMode && styles.summaryLabelDark]}>
                    Achievements
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Timeline */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
            {sortedLives.length === 0 ? (
              <View style={styles.emptyState}>
                <Crown size={scale(48)} color={settings.darkMode ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.emptyText, settings.darkMode && styles.emptyTextDark]}>
                  No previous generations yet
                </Text>
                <Text style={[styles.emptySubtext, settings.darkMode && styles.emptySubtextDark]}>
                  Your legacy will begin here when you start your next generation
                </Text>
              </View>
            ) : (
              <View style={styles.timeline}>
                {sortedLives.map((life, index) => {
                  const isExpanded = expandedLife === index;
                  const deathInfo = getDeathReasonDisplay(life.deathReason);
                  const DeathIcon = deathInfo.icon;

                  return (
                    <View key={index} style={styles.timelineItem}>
                      {/* Timeline Line */}
                      {index < sortedLives.length - 1 && (
                        <View style={[styles.timelineLine, settings.darkMode && styles.timelineLineDark]} />
                      )}

                      {/* Generation Card */}
                      <TouchableOpacity
                        style={styles.generationCard}
                        onPress={() => toggleExpand(index)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={
                            settings.darkMode
                              ? ['#374151', '#1F2937']
                              : ['#F9FAFC', '#F3F4F6']
                          }
                          style={styles.cardGradient}
                        >
                          {/* Generation Header */}
                          <View style={styles.genHeader}>
                            <View style={styles.genHeaderLeft}>
                              <View style={styles.genBadge}>
                                <Crown size={scale(16)} color="#F59E0B" />
                                <Text style={styles.genNumber}>Gen {life.generation || '?'}</Text>
                              </View>
                              {life.timestamp && (
                                <View style={styles.dateBadge}>
                                  <Calendar size={scale(12)} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                                  <Text style={[styles.dateText, settings.darkMode && styles.dateTextDark]}>
                                    {formatDate(life.timestamp)}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.expandButton}>
                              {isExpanded ? (
                                <ChevronUp size={scale(20)} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                              ) : (
                                <ChevronDown size={scale(20)} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                              )}
                            </View>
                          </View>

                          {/* Quick Stats Grid */}
                          <View style={styles.statsGrid}>
                            <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
                              <DollarSign size={scale(16)} color="#10B981" />
                              <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
                                Net Worth
                              </Text>
                              <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                                {formatMoney(life.netWorth || 0)}
                              </Text>
                            </View>

                            <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
                              <TrendingUp size={scale(16)} color="#3B82F6" />
                              <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
                                Age
                              </Text>
                              <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                                {life.ageAtDeath || '?'} years
                              </Text>
                            </View>
                          </View>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <View style={styles.expandedContent}>
                              {/* Life Details Grid */}
                              <View style={styles.detailsGrid}>
                                {life.spouseName && (
                                  <View style={styles.detailItem}>
                                    <Heart size={scale(14)} color="#EC4899" />
                                    <Text style={[styles.detailText, settings.darkMode && styles.detailTextDark]}>
                                      Married to {life.spouseName}
                                    </Text>
                                  </View>
                                )}
                                {life.totalChildren !== undefined && life.totalChildren > 0 && (
                                  <View style={styles.detailItem}>
                                    <Users size={scale(14)} color="#8B5CF6" />
                                    <Text style={[styles.detailText, settings.darkMode && styles.detailTextDark]}>
                                      {life.totalChildren} {life.totalChildren === 1 ? 'Child' : 'Children'}
                                    </Text>
                                  </View>
                                )}
                                {life.propertiesOwned !== undefined && life.propertiesOwned > 0 && (
                                  <View style={styles.detailItem}>
                                    <Home size={scale(14)} color="#F59E0B" />
                                    <Text style={[styles.detailText, settings.darkMode && styles.detailTextDark]}>
                                      {life.propertiesOwned} {life.propertiesOwned === 1 ? 'Property' : 'Properties'}
                                    </Text>
                                  </View>
                                )}
                                {life.companiesOwned !== undefined && life.companiesOwned > 0 && (
                                  <View style={styles.detailItem}>
                                    <Building2 size={scale(14)} color="#3B82F6" />
                                    <Text style={[styles.detailText, settings.darkMode && styles.detailTextDark]}>
                                      {life.companiesOwned} {life.companiesOwned === 1 ? 'Company' : 'Companies'}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* Career History */}
                              {life.careerHistory && life.careerHistory.length > 0 && (
                                <View style={styles.careerSection}>
                                  <View style={styles.sectionHeader}>
                                    <Briefcase size={scale(14)} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                                    <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                                      Career History
                                    </Text>
                                  </View>
                                  <View style={styles.careerList}>
                                    {life.careerHistory.slice(0, 4).map((job, idx) => (
                                      <View key={idx} style={styles.careerItem}>
                                        <View style={styles.careerDot} />
                                        <Text style={[styles.careerText, settings.darkMode && styles.careerTextDark]}>
                                          {job}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )}

                              {/* Memorable Events */}
                              {life.memorableEvents && life.memorableEvents.length > 0 && (
                                <View style={styles.eventsSection}>
                                  <View style={styles.sectionHeader}>
                                    <Star size={scale(14)} color="#F59E0B" />
                                    <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                                      Memorable Events
                                    </Text>
                                  </View>
                                  <View style={styles.eventsList}>
                                    {life.memorableEvents.slice(0, 3).map((event, idx) => (
                                      <Text key={idx} style={[styles.eventText, settings.darkMode && styles.eventTextDark]}>
                                        â€¢ {event}
                                      </Text>
                                    ))}
                                  </View>
                                </View>
                              )}

                              {/* Death Reason */}
                              <View style={[styles.deathReason, { backgroundColor: `${deathInfo.color}15` }]}>
                                <DeathIcon size={scale(16)} color={deathInfo.color} />
                                <View style={styles.deathReasonContent}>
                                  <Text style={[styles.deathReasonLabel, settings.darkMode && styles.deathReasonLabelDark]}>
                                    Cause of Death
                                  </Text>
                                  <Text style={[styles.deathReasonText, { color: deathInfo.color }]}>
                                    {deathInfo.text}
                                  </Text>
                                </View>
                              </View>

                              {/* View Family Tree Button */}
                              {onOpenFamilyTree && (
                                <TouchableOpacity
                                  style={styles.familyTreeButton}
                                  onPress={() => onOpenFamilyTree(life.generation || 0)}
                                >
                                  <Users size={scale(16)} color="#3B82F6" />
                                  <Text style={styles.familyTreeButtonText}>View Family Tree</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}

                          {/* Achievements (always visible) */}
                          {life.summaryAchievements && life.summaryAchievements.length > 0 && (
                            <View style={styles.achievements}>
                              <View style={styles.achievementsHeader}>
                                <Trophy size={scale(14)} color="#F59E0B" />
                                <Text style={[styles.achievementsTitle, settings.darkMode && styles.achievementsTitleDark]}>
                                  Key Achievements
                                </Text>
                              </View>
                              <View style={styles.achievementsList}>
                                {life.summaryAchievements.slice(0, isExpanded ? 10 : 3).map((achievement, idx) => (
                                  <View key={idx} style={styles.achievementBadge}>
                                    <Award size={scale(10)} color="#D97706" />
                                    <Text style={styles.achievementText}>{achievement}</Text>
                                  </View>
                                ))}
                                {!isExpanded && life.summaryAchievements.length > 3 && (
                                  <Text style={[styles.moreAchievements, settings.darkMode && styles.moreAchievementsDark]}>
                                    +{life.summaryAchievements.length - 3} more
                                  </Text>
                                )}
                              </View>
                            </View>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  );
                })}
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
    width: width * 0.92,
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: scale(24),
    padding: scale(20),
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
    marginBottom: scale(16),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  title: {
    fontSize: fontScale(22),
    fontWeight: 'bold',
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: scale(8),
  },
  currentGenBadge: {
    marginBottom: scale(16),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  currentGenGradient: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
    alignItems: 'center',
  },
  currentGenText: {
    fontSize: fontScale(14),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  legacySummary: {
    marginBottom: scale(16),
  },
  summaryRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: scale(12),
    borderRadius: scale(12),
  },
  summaryStatDark: {
    backgroundColor: '#374151',
  },
  summaryValue: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#111827',
    marginTop: scale(4),
  },
  summaryValueDark: {
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: fontScale(10),
    color: '#6B7280',
    marginTop: scale(2),
  },
  summaryLabelDark: {
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(60),
  },
  emptyText: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#6B7280',
    marginTop: scale(16),
  },
  emptyTextDark: {
    color: '#9CA3AF',
  },
  emptySubtext: {
    fontSize: fontScale(14),
    color: '#9CA3AF',
    marginTop: scale(8),
    textAlign: 'center',
  },
  emptySubtextDark: {
    color: '#6B7280',
  },
  timeline: {
    paddingBottom: scale(20),
  },
  timelineItem: {
    position: 'relative',
    marginBottom: scale(16),
  },
  timelineLine: {
    position: 'absolute',
    left: scale(20),
    top: scale(60),
    width: 2,
    height: '100%',
    backgroundColor: '#E5E7EB',
    zIndex: 0,
  },
  timelineLineDark: {
    backgroundColor: '#374151',
  },
  generationCard: {
    borderRadius: scale(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGradient: {
    padding: scale(16),
    borderRadius: scale(16),
  },
  genHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  genHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  genBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(20),
  },
  genNumber: {
    fontSize: fontScale(14),
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  dateText: {
    fontSize: fontScale(11),
    color: '#6B7280',
  },
  dateTextDark: {
    color: '#9CA3AF',
  },
  expandButton: {
    padding: scale(4),
  },
  statsGrid: {
    flexDirection: 'row',
    gap: scale(10),
    marginBottom: scale(12),
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    padding: scale(12),
    borderRadius: scale(12),
    alignItems: 'center',
  },
  statCardDark: {
    backgroundColor: 'rgba(55, 65, 81, 0.6)',
  },
  statLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(4),
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: fontScale(15),
    fontWeight: 'bold',
    color: '#111827',
    marginTop: scale(2),
  },
  statValueDark: {
    color: '#FFFFFF',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    paddingTop: scale(12),
    marginTop: scale(4),
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: scale(12),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(16),
  },
  detailText: {
    fontSize: fontScale(12),
    color: '#4B5563',
  },
  detailTextDark: {
    color: '#D1D5DB',
  },
  careerSection: {
    marginBottom: scale(12),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginBottom: scale(8),
  },
  sectionTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#4B5563',
  },
  sectionTitleDark: {
    color: '#D1D5DB',
  },
  careerList: {
    gap: scale(4),
  },
  careerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  careerDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#3B82F6',
  },
  careerText: {
    fontSize: fontScale(12),
    color: '#4B5563',
  },
  careerTextDark: {
    color: '#D1D5DB',
  },
  eventsSection: {
    marginBottom: scale(12),
  },
  eventsList: {
    gap: scale(4),
  },
  eventText: {
    fontSize: fontScale(12),
    color: '#4B5563',
    lineHeight: fontScale(18),
  },
  eventTextDark: {
    color: '#D1D5DB',
  },
  deathReason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    padding: scale(12),
    borderRadius: scale(12),
    marginBottom: scale(12),
  },
  deathReasonContent: {
    flex: 1,
  },
  deathReasonLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
  },
  deathReasonLabelDark: {
    color: '#9CA3AF',
  },
  deathReasonText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    marginTop: scale(2),
  },
  familyTreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingVertical: scale(10),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  familyTreeButtonText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#3B82F6',
  },
  achievements: {
    marginTop: scale(8),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginBottom: scale(8),
  },
  achievementsTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#111827',
  },
  achievementsTitleDark: {
    color: '#FFFFFF',
  },
  achievementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(5),
    borderRadius: scale(12),
  },
  achievementText: {
    fontSize: fontScale(11),
    color: '#D97706',
    fontWeight: '500',
  },
  moreAchievements: {
    fontSize: fontScale(11),
    color: '#6B7280',
    fontStyle: 'italic',
    alignSelf: 'center',
  },
  moreAchievementsDark: {
    color: '#9CA3AF',
  },
});

