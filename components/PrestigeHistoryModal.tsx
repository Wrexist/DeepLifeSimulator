import { uiPalette } from '@/lib/config/theme';
import React, { useRef, useEffect } from 'react';
import { Platform, Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { X, Crown, Calendar, DollarSign, TrendingUp, Users, RotateCcw } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { safeSettings } from '@/utils/safeGameState';
import { PrestigeRecord } from '@/lib/prestige/prestigeTypes';
import { formatMoney } from '@/utils/moneyFormatting';
import { tier1Title, tier2 } from '@/lib/config/hierarchy';
import { fontScale } from '@/utils/scaling';

const LinearGradient = Gradient;

const { width: screenWidth } = Dimensions.get('window');

interface PrestigeHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PrestigeHistoryModal({ visible, onClose }: PrestigeHistoryModalProps) {
  const darkMode = useGameSelector((s) => safeSettings(s).darkMode);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const prestigeData = useGameSelector((s) => s.prestige);
  const history = prestigeData?.prestigeHistory || [];

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
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible, fadeAnim, scaleAnim]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
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
          <LinearGradient
            colors={darkMode ? [uiPalette.surface, uiPalette.navy] : [uiPalette.white, uiPalette.lightSurface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.content}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Crown size={28} color="#F59E0B" />
                <View>
                  <Text style={[styles.title, darkMode && styles.titleDark]}>
                    Prestige History
                  </Text>
                  <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>
                    {history.length} Prestige{history.length !== 1 ? 's' : ''} Completed
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={darkMode ? uiPalette.white : uiPalette.surface} />
              </TouchableOpacity>
            </View>

            {/* History List */}
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {history.length === 0 ? (
                <View style={styles.emptyState}>
                  <Crown size={48} color={uiPalette.muted} />
                  <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                    No prestige history yet
                  </Text>
                  <Text style={[styles.emptySubtext, darkMode && styles.emptySubtextDark]}>
                    Complete your first prestige to see it here
                  </Text>
                </View>
              ) : (
                history
                  .slice()
                  .reverse()
                  .map((record: PrestigeRecord, index: number) => (
                    <View
                      key={record.prestigeNumber}
                      style={[
                        styles.historyCard,
                        darkMode && styles.historyCardDark,
                      ]}
                    >
                      <LinearGradient
                        colors={
                          index === 0
                            ? ['#F59E0B', '#D97706']
                            : darkMode
                            ? [uiPalette.slate, uiPalette.surface]
                            : [uiPalette.lightSurface, uiPalette.line]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.historyGradient}
                      >
                        <View style={styles.historyHeader}>
                          <View style={styles.historyHeaderLeft}>
                            <View style={styles.prestigeNumberBadge}>
                              <Crown size={16} color={uiPalette.white} />
                              <Text style={styles.prestigeNumberText}>#{record.prestigeNumber}</Text>
                            </View>
                            <View style={styles.historyInfo}>
                              <Text
                                style={[
                                  styles.historyTitle,
                                  darkMode && styles.historyTitleDark,
                                  index === 0 && styles.historyTitleLatest,
                                ]}
                              >
                                Prestige #{record.prestigeNumber}
                              </Text>
                              <View style={styles.historyMeta}>
                                <Calendar size={12} color={uiPalette.muted} />
                                <Text
                                  style={[
                                    styles.historyDate,
                                    darkMode && styles.historyDateDark,
                                  ]}
                                >
                                  {formatDate(record.timestamp)}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={styles.pathBadge}>
                            {record.chosenPath === 'reset' ? (
                              <RotateCcw size={16} color="#3B82F6" />
                            ) : (
                              <Users size={16} color="#8B5CF6" />
                            )}
                            <Text
                              style={[
                                styles.pathText,
                                darkMode && styles.pathTextDark,
                              ]}
                            >
                              {record.chosenPath === 'reset' ? 'Reset' : 'Child'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.historyStats}>
                          <View style={styles.statRow}>
                            <DollarSign size={14} color="#10B981" />
                            <Text
                              style={[
                                styles.statLabel,
                                darkMode && styles.statLabelDark,
                              ]}
                            >
                              Net Worth:
                            </Text>
                            <Text
                              style={[
                                styles.statValue,
                                darkMode && styles.statValueDark,
                              ]}
                            >
                              {formatMoney(record.netWorthAtPrestige)}
                            </Text>
                          </View>
                          <View style={styles.statRow}>
                            <TrendingUp size={14} color="#F59E0B" />
                            <Text
                              style={[
                                styles.statLabel,
                                darkMode && styles.statLabelDark,
                              ]}
                            >
                              Points Earned:
                            </Text>
                            <Text
                              style={[
                                styles.statValue,
                                darkMode && styles.statValueDark,
                              ]}
                            >
                              {record.prestigePointsEarned.toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.statRow}>
                            <Calendar size={14} color="#3B82F6" />
                            <Text
                              style={[
                                styles.statLabel,
                                darkMode && styles.statLabelDark,
                              ]}
                            >
                              Age: {record.ageAtPrestige} • Weeks: {record.weeksLived}
                            </Text>
                          </View>
                        </View>

                        {record.keyAchievements && record.keyAchievements.length > 0 && (
                          <View style={styles.achievementsSection}>
                            <Text
                              style={[
                                styles.achievementsTitle,
                                darkMode && styles.achievementsTitleDark,
                              ]}
                            >
                              Key Achievements:
                            </Text>
                            <View style={styles.achievementsList}>
                              {record.keyAchievements.map((achievement, idx) => (
                                <View key={idx} style={styles.achievementBadge}>
                                  <Text
                                    style={[
                                      styles.achievementText,
                                      darkMode && styles.achievementTextDark,
                                    ]}
                                  >
                                    {achievement}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </LinearGradient>
                    </View>
                  ))
              )}
            </ScrollView>
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
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  content: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
    }),
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    ...tier1Title,
    color: uiPalette.surface,
  },
  titleDark: {
    color: uiPalette.white,
  },
  subtitle: {
    fontSize: fontScale(14),
    color: uiPalette.lightMuted,
    marginTop: 4,
  },
  subtitleDark: {
    color: uiPalette.muted,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyList: {
    maxHeight: screenWidth * 1.2,
    padding: 20,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    ...tier2,
    color: uiPalette.lightMuted,
    marginTop: 16,
  },
  emptyTextDark: {
    color: uiPalette.muted,
  },
  emptySubtext: {
    fontSize: fontScale(14),
    color: uiPalette.muted,
    marginTop: 8,
    textAlign: 'center',
  },
  emptySubtextDark: {
    color: uiPalette.lightMuted,
  },
  historyCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  historyCardDark: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyGradient: {
    padding: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  prestigeNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  prestigeNumberText: {
    fontSize: fontScale(12),
    fontWeight: 'bold',
    color: uiPalette.white,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    ...tier2,
    color: uiPalette.surface,
    marginBottom: 4,
  },
  historyTitleDark: {
    color: uiPalette.white,
  },
  historyTitleLatest: {
    color: uiPalette.white,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyDate: {
    fontSize: fontScale(12),
    color: uiPalette.lightMuted,
  },
  historyDateDark: {
    color: uiPalette.muted,
  },
  pathBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  pathText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: uiPalette.surface,
  },
  pathTextDark: {
    color: uiPalette.white,
  },
  historyStats: {
    gap: 8,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: fontScale(13),
    color: uiPalette.lightMuted,
  },
  statLabelDark: {
    color: uiPalette.muted,
  },
  statValue: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: uiPalette.surface,
    marginLeft: 'auto',
  },
  statValueDark: {
    color: uiPalette.white,
  },
  achievementsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  achievementsTitle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: uiPalette.lightMuted,
    marginBottom: 8,
  },
  achievementsTitleDark: {
    color: uiPalette.muted,
  },
  achievementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  achievementBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  achievementText: {
    fontSize: fontScale(10),
    color: uiPalette.surface,
  },
  achievementTextDark: {
    color: uiPalette.white,
  },
});

