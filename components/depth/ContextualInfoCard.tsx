/**
 * Contextual Information Card
 * Long-press or info button reveals detailed information about a system/item
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Info,
  TrendingUp,
  TrendingDown,
  Link,
  Lock,
  Unlock,
  Target,
  Clock,
  Award,
  AlertCircle,
} from 'lucide-react-native';
import { GameState } from '@/contexts/game/types';
import { SystemHealth } from '@/lib/depth/systemInterconnections';
import { scale, fontScale, responsivePadding, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';

interface ContextualInfoCardProps {
  title: string;
  description?: string;
  currentStatus?: string;
  progress?: number;
  relatedSystems?: Array<{
    id: string;
    name: string;
    effect: 'positive' | 'negative';
    description: string;
  }>;
  unlockRequirements?: string[];
  historicalPerformance?: {
    peak: number;
    average: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  tips?: string[];
  systemHealth?: SystemHealth;
  darkMode?: boolean;
  children?: React.ReactNode;
  trigger?: 'longPress' | 'infoButton';
}

export default function ContextualInfoCard({
  title,
  description,
  currentStatus,
  progress,
  relatedSystems = [],
  unlockRequirements = [],
  historicalPerformance,
  tips = [],
  systemHealth,
  darkMode = false,
  children,
  trigger = 'longPress',
}: ContextualInfoCardProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const handleOpen = () => {
    setModalVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
    });
  };

  const triggerProps = trigger === 'longPress'
    ? { onLongPress: handleOpen }
    : {};

  return (
    <>
      <TouchableOpacity
        {...triggerProps}
        activeOpacity={0.7}
        style={styles.wrapper}
      >
        {children}
        {trigger === 'infoButton' && (
          <TouchableOpacity
            onPress={handleOpen}
            style={[styles.infoButton, darkMode && styles.infoButtonDark]}
          >
            <Info size={scale(14)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleClose}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalContent, darkMode && styles.modalContentDark]}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={[styles.title, darkMode && styles.titleDark]}>{title}</Text>
                  <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <X size={scale(20)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>

                {/* Description */}
                {description && (
                  <View style={styles.section}>
                    <Text style={[styles.description, darkMode && styles.descriptionDark]}>
                      {description}
                    </Text>
                  </View>
                )}

                {/* Current Status */}
                {currentStatus && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                      Current Status
                    </Text>
                    <View style={[styles.statusCard, darkMode && styles.statusCardDark]}>
                      <Text style={[styles.statusText, darkMode && styles.statusTextDark]}>
                        {currentStatus}
                      </Text>
                      {progress !== undefined && (
                        <View style={styles.progressContainer}>
                          <View style={[styles.progressBar, darkMode && styles.progressBarDark]}>
                            <LinearGradient
                              colors={['#3B82F6', '#2563EB']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]}
                            />
                          </View>
                          <Text style={[styles.progressText, darkMode && styles.progressTextDark]}>
                            {Math.round(progress)}%
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* System Health */}
                {systemHealth && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                      System Health
                    </Text>
                    <View style={[styles.healthCard, darkMode && styles.healthCardDark]}>
                      <View style={styles.healthRow}>
                        <Text style={[styles.healthLabel, darkMode && styles.healthLabelDark]}>
                          Health:
                        </Text>
                        <View style={styles.healthBarContainer}>
                          <View style={[styles.healthBar, darkMode && styles.healthBarDark]}>
                            <LinearGradient
                              colors={
                                systemHealth.health > 70
                                  ? ['#10B981', '#059669']
                                  : systemHealth.health > 40
                                  ? ['#F59E0B', '#D97706']
                                  : ['#EF4444', '#DC2626']
                              }
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[styles.healthFill, { width: `${systemHealth.health}%` }]}
                            />
                          </View>
                          <Text style={[styles.healthValue, darkMode && styles.healthValueDark]}>
                            {Math.round(systemHealth.health)}%
                          </Text>
                        </View>
                      </View>
                      <View style={styles.healthRow}>
                        <Text style={[styles.healthLabel, darkMode && styles.healthLabelDark]}>
                          Trend:
                        </Text>
                        {systemHealth.trend === 'improving' ? (
                          <View style={styles.trendIndicator}>
                            <TrendingUp size={scale(14)} color="#10B981" />
                            <Text style={styles.trendTextImproving}>Improving</Text>
                          </View>
                        ) : systemHealth.trend === 'declining' ? (
                          <View style={styles.trendIndicator}>
                            <TrendingDown size={scale(14)} color="#EF4444" />
                            <Text style={styles.trendTextDeclining}>Declining</Text>
                          </View>
                        ) : (
                          <Text style={[styles.trendTextStable, darkMode && styles.trendTextStableDark]}>
                            Stable
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {/* Related Systems */}
                {relatedSystems.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Link size={scale(16)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
                      <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                        Related Systems
                      </Text>
                    </View>
                    {relatedSystems.map((system, index) => (
                      <View
                        key={index}
                        style={[styles.relatedSystemCard, darkMode && styles.relatedSystemCardDark]}
                      >
                        <View style={styles.relatedSystemHeader}>
                          <Text style={[styles.relatedSystemName, darkMode && styles.relatedSystemNameDark]}>
                            {system.name}
                          </Text>
                          {system.effect === 'positive' ? (
                            <TrendingUp size={scale(14)} color="#10B981" />
                          ) : (
                            <TrendingDown size={scale(14)} color="#EF4444" />
                          )}
                        </View>
                        <Text style={[styles.relatedSystemDesc, darkMode && styles.relatedSystemDescDark]}>
                          {system.description}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Unlock Requirements */}
                {unlockRequirements.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      {unlockRequirements.some(r => r.includes('Locked')) ? (
                        <Lock size={scale(16)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                      ) : (
                        <Unlock size={scale(16)} color={darkMode ? '#10B981' : '#059669'} />
                      )}
                      <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                        Requirements
                      </Text>
                    </View>
                    {unlockRequirements.map((req, index) => (
                      <View
                        key={index}
                        style={[styles.requirementItem, darkMode && styles.requirementItemDark]}
                      >
                        <Text style={[styles.requirementText, darkMode && styles.requirementTextDark]}>
                          • {req}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Historical Performance */}
                {historicalPerformance && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Award size={scale(16)} color={darkMode ? '#F59E0B' : '#D97706'} />
                      <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                        Performance
                      </Text>
                    </View>
                    <View style={[styles.performanceCard, darkMode && styles.performanceCardDark]}>
                      <View style={styles.performanceRow}>
                        <Text style={[styles.performanceLabel, darkMode && styles.performanceLabelDark]}>
                          Peak:
                        </Text>
                        <Text style={[styles.performanceValue, darkMode && styles.performanceValueDark]}>
                          {historicalPerformance.peak}
                        </Text>
                      </View>
                      <View style={styles.performanceRow}>
                        <Text style={[styles.performanceLabel, darkMode && styles.performanceLabelDark]}>
                          Average:
                        </Text>
                        <Text style={[styles.performanceValue, darkMode && styles.performanceValueDark]}>
                          {historicalPerformance.average}
                        </Text>
                      </View>
                      <View style={styles.performanceRow}>
                        <Text style={[styles.performanceLabel, darkMode && styles.performanceLabelDark]}>
                          Trend:
                        </Text>
                        {historicalPerformance.trend === 'improving' ? (
                          <View style={styles.trendIndicator}>
                            <TrendingUp size={scale(14)} color="#10B981" />
                            <Text style={styles.trendTextImproving}>Improving</Text>
                          </View>
                        ) : historicalPerformance.trend === 'declining' ? (
                          <View style={styles.trendIndicator}>
                            <TrendingDown size={scale(14)} color="#EF4444" />
                            <Text style={styles.trendTextDeclining}>Declining</Text>
                          </View>
                        ) : (
                          <Text style={[styles.trendTextStable, darkMode && styles.trendTextStableDark]}>
                            Stable
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {/* Tips */}
                {tips.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <AlertCircle size={scale(16)} color={darkMode ? '#F59E0B' : '#D97706'} />
                      <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                        Tips & Strategies
                      </Text>
                    </View>
                    {tips.map((tip, index) => (
                      <View
                        key={index}
                        style={[styles.tipItem, darkMode && styles.tipItemDark]}
                      >
                        <Text style={[styles.tipText, darkMode && styles.tipTextDark]}>
                          • {tip}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  infoButton: {
    position: 'absolute',
    top: scale(4),
    right: scale(4),
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  infoButtonDark: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    width: '100%',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: responsiveSpacing.xs,
  },
  section: {
    marginBottom: responsiveSpacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.sm,
  },
  sectionTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  description: {
    fontSize: fontScale(14),
    color: '#6B7280',
    lineHeight: fontScale(20),
  },
  descriptionDark: {
    color: '#9CA3AF',
  },
  statusCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  statusCardDark: {
    backgroundColor: '#374151',
  },
  statusText: {
    fontSize: fontScale(14),
    color: '#374151',
    marginBottom: responsiveSpacing.sm,
  },
  statusTextDark: {
    color: '#D1D5DB',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  progressBar: {
    flex: 1,
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  progressBarDark: {
    backgroundColor: '#4B5563',
  },
  progressFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  progressText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#3B82F6',
    minWidth: scale(40),
  },
  progressTextDark: {
    color: '#60A5FA',
  },
  healthCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  healthCardDark: {
    backgroundColor: '#374151',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  healthLabel: {
    fontSize: fontScale(14),
    color: '#374151',
    width: scale(80),
  },
  healthLabelDark: {
    color: '#D1D5DB',
  },
  healthBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  healthBar: {
    flex: 1,
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  healthBarDark: {
    backgroundColor: '#4B5563',
  },
  healthFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  healthValue: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#374151',
    minWidth: scale(40),
  },
  healthValueDark: {
    color: '#D1D5DB',
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  trendTextImproving: {
    fontSize: fontScale(12),
    color: '#10B981',
    fontWeight: '600',
  },
  trendTextDeclining: {
    fontSize: fontScale(12),
    color: '#EF4444',
    fontWeight: '600',
  },
  trendTextStable: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  trendTextStableDark: {
    color: '#9CA3AF',
  },
  relatedSystemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  relatedSystemCardDark: {
    backgroundColor: '#374151',
  },
  relatedSystemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  relatedSystemName: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
  },
  relatedSystemNameDark: {
    color: '#F9FAFB',
  },
  relatedSystemDesc: {
    fontSize: fontScale(12),
    color: '#6B7280',
    lineHeight: fontScale(16),
  },
  relatedSystemDescDark: {
    color: '#9CA3AF',
  },
  requirementItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.xs,
  },
  requirementItemDark: {
    backgroundColor: '#374151',
  },
  requirementText: {
    fontSize: fontScale(13),
    color: '#374151',
    lineHeight: fontScale(18),
  },
  requirementTextDark: {
    color: '#D1D5DB',
  },
  performanceCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  performanceCardDark: {
    backgroundColor: '#374151',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  performanceLabel: {
    fontSize: fontScale(14),
    color: '#374151',
  },
  performanceLabelDark: {
    color: '#D1D5DB',
  },
  performanceValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
  },
  performanceValueDark: {
    color: '#F9FAFB',
  },
  tipItem: {
    backgroundColor: '#FEF3C7',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.xs,
  },
  tipItemDark: {
    backgroundColor: '#78350F',
  },
  tipText: {
    fontSize: fontScale(13),
    color: '#92400E',
    lineHeight: fontScale(18),
  },
  tipTextDark: {
    color: '#FCD34D',
  },
});

