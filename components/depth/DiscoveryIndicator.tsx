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
import Gradient from '@/components/ui/Gradient';
import {
  Compass,
  Lock,
  Unlock,
  Award,
  X,
  Star,
 ChevronRight } from 'lucide-react-native';
import { GameState } from '@/contexts/game/types';
import { getDiscoveryProgress, getAllDiscoverableSystems, getSystemUnlockRequirements } from '@/lib/depth/discoverySystem';
import { routeForSystem } from '@/lib/depth/systemRoutes';
import { useRouter } from 'expo-router';
import { scale, fontScale, responsivePadding, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
const LinearGradient = Gradient;

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
          colors={darkMode ? ['#1E293B', '#0F172A'] : ['#F1F5F9', '#E2E8F0']}
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
  const router = useRouter();
  const discoveredSystems = gameState.discoveredSystems || [];
  const lockedSystems = discoveryProgress.lockedSystems;

  /**
   * Take the player to the system they just tapped.
   *
   * The whole point of the change: this screen listed all 20 systems as inert
   * cards, so it showed the player the entire game and gave them no way in.
   * Close first, then navigate - leaving the modal mounted over the destination
   * strands them behind an overlay they have to dismiss to see what they asked
   * for.
   */
  const goToSystem = (systemId: string) => {
    const route = routeForSystem(systemId);
    if (!route) return;
    onClose();
    // Life's segment deep link is consume-once keyed on (segment, ts), so the
    // nonce lets a repeated tap of the same card still land.
    router.push(
      route.appId
        ? ({ pathname: route.pathname, params: { app: route.appId } } as never)
        : route.segment
          ? ({ pathname: route.pathname, params: { segment: route.segment, ts: String(Date.now()) } } as never)
          : (route.pathname as never)
    );
  };

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
              <X size={scale(20)} color={darkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
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
                const route = routeForSystem(system.systemId);
                // A system with no single home stays a plain card rather than a
                // button that lies about where it goes.
                const Card = route ? TouchableOpacity : View;
                return (
                  <Card
                    key={system.systemId}
                    onPress={route ? () => goToSystem(system.systemId) : undefined}
                    accessibilityRole={route ? 'button' : undefined}
                    accessibilityLabel={route ? `${system.systemName}. ${route.label}` : undefined}
                    activeOpacity={0.85}
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
                    <View style={styles.systemFooter}>
                      <Text style={[styles.systemStats, darkMode && styles.systemStatsDark]}>
                        Used {system.timesUsed} time{system.timesUsed !== 1 ? 's' : ''}
                      </Text>
                      {route && (
                        <View style={styles.systemGoRow}>
                          <Text style={styles.systemGoText}>{route.label}</Text>
                          <ChevronRight size={scale(14)} color="#60A5FA" />
                        </View>
                      )}
                    </View>
                  </Card>
                );
              })
              )}
            </View>

            {/* Locked Systems */}
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <Lock size={scale(16)} color={darkMode ? '#94A3B8' : '#64748B'} />
                <Text style={[styles.modalSectionTitle, darkMode && styles.modalSectionTitleDark]}>
                  Locked Systems ({lockedSystems.length})
                </Text>
              </View>
              {lockedSystems.length === 0 ? (
                <Text style={[styles.emptyStateText, darkMode && styles.emptyStateTextDark]}>
                  All systems unlocked! Great job exploring everything.
                </Text>
              ) : (
                lockedSystems.map((systemId) => {
                  const systemDef = allSystems[systemId];
                  const requirements = getSystemUnlockRequirements(systemId);
                  
                  return (
                    <View
                      key={systemId}
                      style={[styles.lockedSystemCard, darkMode && styles.lockedSystemCardDark]}
                    >
                      <View style={styles.lockedSystemHeader}>
                        <Lock size={scale(14)} color={darkMode ? '#94A3B8' : '#64748B'} />
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
  return '#64748B';
}

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    paddingHorizontal: responsivePadding.small,
    paddingVertical: responsiveSpacing.xs,
    backgroundColor: '#F1F5F9',
    borderRadius: responsiveBorderRadius.full,
  },
  compactContainerDark: {
    backgroundColor: '#334155',
  },
  compactText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#334155',
  },
  compactTextDark: {
    color: '#CBD5E1',
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
    color: '#1E293B',
  },
  titleDark: {
    color: '#F8FAFC',
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
    color: '#334155',
  },
  progressLabelDark: {
    color: '#CBD5E1',
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
    backgroundColor: '#E2E8F0',
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    marginBottom: responsiveSpacing.xs,
  },
  progressBarDark: {
    backgroundColor: '#475569',
  },
  progressFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  progressPercentage: {
    fontSize: fontScale(12),
    color: '#64748B',
    textAlign: 'right',
  },
  progressPercentageDark: {
    color: '#94A3B8',
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
    color: '#334155',
  },
  depthScoreLabelDark: {
    color: '#CBD5E1',
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
    color: '#64748B',
    marginBottom: responsiveSpacing.xs,
  },
  categoriesLabelDark: {
    color: '#94A3B8',
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
    color: '#1E293B',
  },
  categoryValueDark: {
    color: '#F8FAFC',
  },
  categoryLabel: {
    fontSize: fontScale(11),
    color: '#64748B',
    marginTop: responsiveSpacing.xs / 2,
  },
  categoryLabelDark: {
    color: '#94A3B8',
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
    backgroundColor: '#1E293B',
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
    color: '#1E293B',
  },
  modalTitleDark: {
    color: '#F8FAFC',
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
    color: '#1E293B',
  },
  modalSectionTitleDark: {
    color: '#F8FAFC',
  },
  systemCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  systemCardDark: {
    backgroundColor: '#334155',
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
    color: '#1E293B',
    flex: 1,
  },
  systemNameDark: {
    color: '#F8FAFC',
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
    color: '#64748B',
    textTransform: 'capitalize',
    marginBottom: responsiveSpacing.xs / 2,
  },
  systemCategoryDark: {
    color: '#94A3B8',
  },
  systemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
  },
  systemGoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
  },
  systemGoText: {
    fontSize: fontScale(12),
    fontWeight: '700',
    color: '#60A5FA',
  },
  systemStats: {
    fontSize: fontScale(11),
    color: '#64748B',
  },
  systemStatsDark: {
    color: '#94A3B8',
  },
  lockedSystemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockedSystemCardDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
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
    color: '#64748B',
  },
  lockedSystemNameDark: {
    color: '#94A3B8',
  },
  requirementsList: {
    marginTop: responsiveSpacing.xs,
  },
  requirementText: {
    fontSize: fontScale(11),
    color: '#64748B',
    lineHeight: fontScale(16),
    marginBottom: responsiveSpacing.xs / 2,
  },
  requirementTextDark: {
    color: '#94A3B8',
  },
  emptyStateText: {
    fontSize: fontScale(12),
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: responsiveSpacing.md,
  },
  emptyStateTextDark: {
    color: '#94A3B8',
  },
});


