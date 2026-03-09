/**
 * Discovery & Depth Indicators
 * Show discovery progress and depth engagement
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  Compass,
  Lock,
  Unlock,
  Award,
  TrendingUp,
  Target,
  X,
  Star,
} from 'lucide-react-native';
import { GameState } from '@/contexts/game/types';
import { getDiscoveryProgress, getAllDiscoverableSystems, getSystemUnlockRequirements } from '@/lib/depth/discoverySystem';
import { scale, fontScale, responsivePadding, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';

interface DiscoveryIndicatorProps {
  gameState: GameState;
  compact?: boolean;
  darkMode?: boolean;
  onPress?: () => void;
}

export default function DiscoveryIndicator({
  gameState,
  compact = false,
  darkMode = false,
  onPress,
}: DiscoveryIndicatorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const discoveryProgress = getDiscoveryProgress(gameState);
  const allSystems = getAllDiscoverableSystems();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      setModalVisible(true);
    }
  };

  const progressPercentage = discoveryProgress.totalSystems > 0
    ? Math.round((discoveryProgress.discoveredSystems / discoveryProgress.totalSystems) * 100)
    : 0;

  if (compact) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.compactContainer, darkMode && styles.compactContainerDark]}
        activeOpacity={0.7}
      >
        <Compass size={scale(16)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
        <Text style={[styles.compactText, darkMode && styles.compactTextDark]}>
          {discoveryProgress.discoveredSystems}/{discoveryProgress.totalSystems}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.container, darkMode && styles.containerDark]}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={darkMode ? ['#1F2937', '#111827'] : ['#F3F4F6', '#E5E7EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <Compass size={scale(20)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
            <Text style={[styles.title, darkMode && styles.titleDark]}>
              Discovery Progress
            </Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, darkMode && styles.progressLabelDark]}>
                Systems Discovered
              </Text>
              <Text style={[styles.progressValue, darkMode && styles.progressValueDark]}>
                {discoveryProgress.discoveredSystems} / {discoveryProgress.totalSystems}
              </Text>
            </View>
            <View style={[styles.progressBar, darkMode && styles.progressBarDark]}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progressPercentage}%` }]}
              />
            </View>
            <Text style={[styles.progressPercentage, darkMode && styles.progressPercentageDark]}>
              {progressPercentage}%
            </Text>
          </View>

          <View style={styles.depthScoreSection}>
            <View style={styles.depthScoreHeader}>
              <Star size={scale(16)} color="#F59E0B" />
              <Text style={[styles.depthScoreLabel, darkMode && styles.depthScoreLabelDark]}>
                Depth Score
              </Text>
            </View>
            <Text style={[styles.depthScoreValue, darkMode && styles.depthScoreValueDark]}>
              {discoveryProgress.depthScore} / 100
            </Text>
            <View style={[styles.depthScoreBar, darkMode && styles.depthScoreBarDark]}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.depthScoreFill, { width: `${discoveryProgress.depthScore}%` }]}
              />
            </View>
          </View>

          <View style={styles.categoriesSection}>
            <Text style={[styles.categoriesLabel, darkMode && styles.categoriesLabelDark]}>
              By Category:
            </Text>
            <View style={styles.categoriesRow}>
              <View style={styles.categoryItem}>
                <Text style={[styles.categoryValue, darkMode && styles.categoryValueDark]}>
                  {discoveryProgress.systemsByCategory.core}
                </Text>
                <Text style={[styles.categoryLabel, darkMode && styles.categoryLabelDark]}>
                  Core
                </Text>
              </View>
              <View style={styles.categoryItem}>
                <Text style={[styles.categoryValue, darkMode && styles.categoryValueDark]}>
                  {discoveryProgress.systemsByCategory.advanced}
                </Text>
                <Text style={[styles.categoryLabel, darkMode && styles.categoryLabelDark]}>
                  Advanced
                </Text>
              </View>
              <View style={styles.categoryItem}>
                <Text style={[styles.categoryValue, darkMode && styles.categoryValueDark]}>
                  {discoveryProgress.systemsByCategory.premium}
                </Text>
                <Text style={[styles.categoryLabel, darkMode && styles.categoryLabelDark]}>
                  Premium
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <DiscoveryModal
        visible={modalVisible}
        gameState={gameState}
        discoveryProgress={discoveryProgress}
        allSystems={allSystems}
        darkMode={darkMode}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

interface DiscoveryModalProps {
  visible: boolean;
  gameState: GameState;
  discoveryProgress: ReturnType<typeof getDiscoveryProgress>;
  allSystems: ReturnType<typeof getAllDiscoverableSystems>;
  darkMode: boolean;
  onClose: () => void;
}

function DiscoveryModal({
  visible,
  gameState,
  discoveryProgress,
  allSystems,
  darkMode,
  onClose,
}: DiscoveryModalProps) {
  const discoveredSystems = gameState.discoveredSystems || [];
  const lockedSystems = discoveryProgress.lockedSystems;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, darkMode && styles.modalContentDark]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
              Discovery Center
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <X size={scale(20)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Discovered Systems */}
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <Unlock size={scale(16)} color="#10B981" />
                <Text style={[styles.modalSectionTitle, darkMode && styles.modalSectionTitleDark]}>
                  Discovered Systems ({discoveredSystems.length})
                </Text>
              </View>
              {discoveredSystems.length === 0 ? (
                <Text style={[styles.emptyStateText, darkMode && styles.emptyStateTextDark]}>
                  No systems discovered yet. Keep exploring to unlock new features!
                </Text>
              ) : (
                discoveredSystems.map((system) => {
                const systemDef = allSystems[system.systemId];
                return (
                  <View
                    key={system.systemId}
                    style={[styles.systemCard, darkMode && styles.systemCardDark]}
                  >
                    <View style={styles.systemCardHeader}>
                      <Text style={[styles.systemName, darkMode && styles.systemNameDark]}>
                        {system.systemName}
                      </Text>
                      <View style={styles.systemBadges}>
                        <View style={[styles.masteryBadge, { backgroundColor: getMasteryColor(system.masteryLevel) }]}>
                          <Award size={scale(12)} color="#FFFFFF" />
                          <Text style={styles.masteryText}>{Math.round(system.masteryLevel)}%</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.systemCategory, darkMode && styles.systemCategoryDark]}>
                      {systemDef?.category || 'unknown'}
                    </Text>
                    <Text style={[styles.systemStats, darkMode && styles.systemStatsDark]}>
                      Used {system.timesUsed} time{system.timesUsed !== 1 ? 's' : ''}
                    </Text>
                  </View>
                );
              })
              )}
            </View>

            {/* Locked Systems */}
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <Lock size={scale(16)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                <Text style={[styles.modalSectionTitle, darkMode && styles.modalSectionTitleDark]}>
                  Locked Systems ({lockedSystems.length})
                </Text>
              </View>
              {lockedSystems.length === 0 ? (
                <Text style={[styles.emptyStateText, darkMode && styles.emptyStateTextDark]}>
                  All systems unlocked! Great job exploring everything.
                </Text>
              ) : (
                lockedSystems.slice(0, 10).map((systemId) => {
                  const systemDef = allSystems[systemId];
                  const requirements = getSystemUnlockRequirements(systemId);
                  
                  return (
                    <View
                      key={systemId}
                      style={[styles.lockedSystemCard, darkMode && styles.lockedSystemCardDark]}
                    >
                      <View style={styles.lockedSystemHeader}>
                        <Lock size={scale(14)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                        <Text style={[styles.lockedSystemName, darkMode && styles.lockedSystemNameDark]}>
                          {systemDef?.name || systemId}
                        </Text>
                      </View>
                      {requirements && requirements.requirements && requirements.requirements.length > 0 && (
                        <View style={styles.requirementsList}>
                          {requirements.requirements.map((req, index) => (
                            <Text
                              key={index}
                              style={[styles.requirementText, darkMode && styles.requirementTextDark]}
                            >
                              • {req}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function getMasteryColor(masteryLevel: number): string {
  if (masteryLevel >= 80) return '#10B981';
  if (masteryLevel >= 50) return '#3B82F6';
  if (masteryLevel >= 25) return '#F59E0B';
  return '#6B7280';
}

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    paddingHorizontal: responsivePadding.small,
    paddingVertical: responsiveSpacing.xs,
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.full,
  },
  compactContainerDark: {
    backgroundColor: '#374151',
  },
  compactText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#374151',
  },
  compactTextDark: {
    color: '#D1D5DB',
  },
  container: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    marginVertical: responsiveSpacing.sm,
  },
  containerDark: {},
  gradient: {
    padding: responsiveSpacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  title: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1F2937',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  progressSection: {
    marginBottom: responsiveSpacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  progressLabel: {
    fontSize: fontScale(14),
    color: '#374151',
  },
  progressLabelDark: {
    color: '#D1D5DB',
  },
  progressValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#3B82F6',
  },
  progressValueDark: {
    color: '#60A5FA',
  },
  progressBar: {
    height: scale(12),
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    marginBottom: responsiveSpacing.xs,
  },
  progressBarDark: {
    backgroundColor: '#4B5563',
  },
  progressFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  progressPercentage: {
    fontSize: fontScale(12),
    color: '#6B7280',
    textAlign: 'right',
  },
  progressPercentageDark: {
    color: '#9CA3AF',
  },
  depthScoreSection: {
    marginBottom: responsiveSpacing.md,
  },
  depthScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.xs,
  },
  depthScoreLabel: {
    fontSize: fontScale(14),
    color: '#374151',
  },
  depthScoreLabelDark: {
    color: '#D1D5DB',
  },
  depthScoreValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: responsiveSpacing.xs,
  },
  depthScoreValueDark: {
    color: '#FBBF24',
  },
  depthScoreBar: {
    height: scale(12),
    backgroundColor: '#FEF3C7',
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  depthScoreBarDark: {
    backgroundColor: '#78350F',
  },
  depthScoreFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  categoriesSection: {
    marginTop: responsiveSpacing.sm,
  },
  categoriesLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: responsiveSpacing.xs,
  },
  categoriesLabelDark: {
    color: '#9CA3AF',
  },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  categoryItem: {
    alignItems: 'center',
  },
  categoryValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#1F2937',
  },
  categoryValueDark: {
    color: '#F9FAFB',
  },
  categoryLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: responsiveSpacing.xs / 2,
  },
  categoryLabelDark: {
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    width: '100%',
    maxWidth: scale(400),
    maxHeight: '80%',
    padding: responsiveSpacing.lg,
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  modalTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#1F2937',
  },
  modalTitleDark: {
    color: '#F9FAFB',
  },
  modalCloseButton: {
    padding: responsiveSpacing.xs,
  },
  modalSection: {
    marginBottom: responsiveSpacing.lg,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.md,
  },
  modalSectionTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1F2937',
  },
  modalSectionTitleDark: {
    color: '#F9FAFB',
  },
  systemCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  systemCardDark: {
    backgroundColor: '#374151',
  },
  systemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  systemName: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  systemNameDark: {
    color: '#F9FAFB',
  },
  systemBadges: {
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
  },
  masteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs / 2,
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.full,
  },
  masteryText: {
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  systemCategory: {
    fontSize: fontScale(11),
    color: '#6B7280',
    textTransform: 'capitalize',
    marginBottom: responsiveSpacing.xs / 2,
  },
  systemCategoryDark: {
    color: '#9CA3AF',
  },
  systemStats: {
    fontSize: fontScale(11),
    color: '#6B7280',
  },
  systemStatsDark: {
    color: '#9CA3AF',
  },
  lockedSystemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lockedSystemCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  lockedSystemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.xs,
  },
  lockedSystemName: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#6B7280',
  },
  lockedSystemNameDark: {
    color: '#9CA3AF',
  },
  requirementsList: {
    marginTop: responsiveSpacing.xs,
  },
  requirementText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    lineHeight: fontScale(16),
    marginBottom: responsiveSpacing.xs / 2,
  },
  requirementTextDark: {
    color: '#9CA3AF',
  },
  emptyStateText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: responsiveSpacing.md,
  },
  emptyStateTextDark: {
    color: '#9CA3AF',
  },
});


