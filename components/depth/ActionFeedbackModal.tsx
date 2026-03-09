/**
 * Rich Action Feedback Modal
 * Detailed breakdown modal after major actions
 */

import React, { useEffect, useState } from 'react';
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
  TrendingUp,
  TrendingDown,
  Link,
  Zap,
  Award,
  ArrowRight,
  Info,
} from 'lucide-react-native';
import { ActionImpact } from '@/lib/depth/systemInterconnections';
import { scale, fontScale, responsivePadding, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';

interface ActionFeedbackModalProps {
  visible: boolean;
  actionImpact: ActionImpact | null;
  darkMode?: boolean;
  onClose: () => void;
}

export default function ActionFeedbackModal({
  visible,
  actionImpact,
  darkMode = false,
  onClose,
}: ActionFeedbackModalProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(scale(50)));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: scale(50),
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!actionImpact) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View
            style={[
              styles.modal,
              darkMode && styles.modalDark,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerContent}>
                    <Zap size={scale(20)} color={darkMode ? '#F59E0B' : '#D97706'} />
                    <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>
                      {actionImpact.actionName}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <X size={scale(20)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>

                {/* Direct Effects */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                    Direct Effects
                  </Text>
                  <View style={[styles.effectsCard, darkMode && styles.effectsCardDark]}>
                    {Object.entries(actionImpact.directEffects).map(([key, value]) => {
                      if (value === 0 || value === undefined) return null;
                      const isPositive = value > 0;
                      return (
                        <View key={key} style={styles.effectRow}>
                          <Text style={[styles.effectLabel, darkMode && styles.effectLabelDark]}>
                            {key.charAt(0).toUpperCase() + key.slice(1)}:
                          </Text>
                          <View style={styles.effectValueContainer}>
                            {isPositive ? (
                              <TrendingUp size={scale(14)} color="#10B981" />
                            ) : (
                              <TrendingDown size={scale(14)} color="#EF4444" />
                            )}
                            <Text
                              style={[
                                styles.effectValue,
                                isPositive ? styles.positiveValue : styles.negativeValue,
                              ]}
                            >
                              {isPositive ? '+' : ''}{value}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* System Interconnections */}
                {actionImpact.systemEffects.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Link size={scale(16)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
                      <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                        System Effects
                      </Text>
                    </View>
                    {actionImpact.systemEffects.map((effect, index) => (
                      <View
                        key={index}
                        style={[styles.systemEffectCard, darkMode && styles.systemEffectCardDark]}
                      >
                        <View style={styles.systemEffectHeader}>
                          <Text style={[styles.systemEffectSource, darkMode && styles.systemEffectSourceDark]}>
                            {effect.sourceSystem}
                          </Text>
                          <ArrowRight size={scale(12)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                          <Text style={[styles.systemEffectTarget, darkMode && styles.systemEffectTargetDark]}>
                            {effect.targetSystem}
                          </Text>
                          {effect.effectType === 'positive' ? (
                            <TrendingUp size={scale(14)} color="#10B981" />
                          ) : (
                            <TrendingDown size={scale(14)} color="#EF4444" />
                          )}
                        </View>
                        <Text style={[styles.systemEffectDesc, darkMode && styles.systemEffectDescDark]}>
                          {effect.description}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Chain Reactions */}
                {actionImpact.chainReactions.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Link size={scale(16)} color={darkMode ? '#F59E0B' : '#D97706'} />
                      <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                        Chain Reactions
                      </Text>
                    </View>
                    <View style={[styles.chainReactionsCard, darkMode && styles.chainReactionsCardDark]}>
                      {actionImpact.chainReactions.map((reaction, index) => (
                        <View key={index} style={styles.chainReactionItem}>
                          <Text style={[styles.chainReactionText, darkMode && styles.chainReactionTextDark]}>
                            {reaction}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Modifiers */}
                {Object.keys(actionImpact.modifiers).length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Award size={scale(16)} color={darkMode ? '#F59E0B' : '#D97706'} />
                      <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                        Active Modifiers
                      </Text>
                    </View>
                    <View style={[styles.modifiersCard, darkMode && styles.modifiersCardDark]}>
                      {actionImpact.modifiers.commitmentBonus && (
                        <View style={styles.modifierRow}>
                          <Text style={[styles.modifierLabel, darkMode && styles.modifierLabelDark]}>
                            Commitment Bonus:
                          </Text>
                          <Text style={[styles.modifierValue, styles.bonusValue]}>
                            +{actionImpact.modifiers.commitmentBonus}%
                          </Text>
                        </View>
                      )}
                      {actionImpact.modifiers.prestigeBonus && (
                        <View style={styles.modifierRow}>
                          <Text style={[styles.modifierLabel, darkMode && styles.modifierLabelDark]}>
                            Prestige Bonus:
                          </Text>
                          <Text style={[styles.modifierValue, styles.bonusValue]}>
                            +{actionImpact.modifiers.prestigeBonus}%
                          </Text>
                        </View>
                      )}
                      {actionImpact.modifiers.lifestyleModifier && (
                        <View style={styles.modifierRow}>
                          <Text style={[styles.modifierLabel, darkMode && styles.modifierLabelDark]}>
                            Lifestyle Modifier:
                          </Text>
                          <Text style={[styles.modifierValue, styles.bonusValue]}>
                            +{actionImpact.modifiers.lifestyleModifier}%
                          </Text>
                        </View>
                      )}
                      {actionImpact.modifiers.mindsetModifier && (
                        <View style={styles.modifierRow}>
                          <Text style={[styles.modifierLabel, darkMode && styles.modifierLabelDark]}>
                            Mindset Modifier:
                          </Text>
                          <Text
                            style={[
                              styles.modifierValue,
                              actionImpact.modifiers.mindsetModifier > 0
                                ? styles.bonusValue
                                : styles.penaltyValue,
                            ]}
                          >
                            {actionImpact.modifiers.mindsetModifier > 0 ? '+' : ''}
                            {actionImpact.modifiers.mindsetModifier}%
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Calculated Values */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Info size={scale(16)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                      Calculation Breakdown
                    </Text>
                  </View>
                  <View style={[styles.calculationCard, darkMode && styles.calculationCardDark]}>
                    <View style={styles.calculationRow}>
                      <Text style={[styles.calculationLabel, darkMode && styles.calculationLabelDark]}>
                        Base Value:
                      </Text>
                      <Text style={[styles.calculationValue, darkMode && styles.calculationValueDark]}>
                        {actionImpact.calculatedValues.baseValue.toFixed(1)}
                      </Text>
                    </View>
                    <View style={styles.calculationRow}>
                      <Text style={[styles.calculationLabel, darkMode && styles.calculationLabelDark]}>
                        Final Value:
                      </Text>
                      <Text style={[styles.calculationValue, styles.finalValue]}>
                        {actionImpact.calculatedValues.finalValue.toFixed(1)}
                      </Text>
                    </View>
                    {actionImpact.calculatedValues.modifierBreakdown.length > 0 && (
                      <View style={styles.modifierBreakdown}>
                        {actionImpact.calculatedValues.modifierBreakdown.map((breakdown, index) => (
                          <Text
                            key={index}
                            style={[styles.modifierBreakdownText, darkMode && styles.modifierBreakdownTextDark]}
                          >
                            {breakdown}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Close Button */}
                <TouchableOpacity onPress={onClose} style={styles.closeButtonContainer}>
                  <LinearGradient
                    colors={darkMode ? ['#3B82F6', '#2563EB'] : ['#3B82F6', '#1D4ED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.closeButtonGradient}
                  >
                    <Text style={styles.closeButtonText}>Got it</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
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
  backdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    width: '100%',
    maxWidth: scale(400),
    maxHeight: '85%',
    padding: responsiveSpacing.lg,
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    flex: 1,
  },
  headerTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#1F2937',
  },
  headerTitleDark: {
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
  effectsCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  effectsCardDark: {
    backgroundColor: '#374151',
  },
  effectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  effectLabel: {
    fontSize: fontScale(14),
    color: '#374151',
    flex: 1,
  },
  effectLabelDark: {
    color: '#D1D5DB',
  },
  effectValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  effectValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  positiveValue: {
    color: '#10B981',
  },
  negativeValue: {
    color: '#EF4444',
  },
  systemEffectCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  systemEffectCardDark: {
    backgroundColor: '#374151',
  },
  systemEffectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.xs,
  },
  systemEffectSource: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#3B82F6',
  },
  systemEffectSourceDark: {
    color: '#60A5FA',
  },
  systemEffectTarget: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#1F2937',
  },
  systemEffectTargetDark: {
    color: '#F9FAFB',
  },
  systemEffectDesc: {
    fontSize: fontScale(12),
    color: '#6B7280',
    lineHeight: fontScale(16),
  },
  systemEffectDescDark: {
    color: '#9CA3AF',
  },
  chainReactionsCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  chainReactionsCardDark: {
    backgroundColor: '#78350F',
  },
  chainReactionItem: {
    marginBottom: responsiveSpacing.xs,
  },
  chainReactionText: {
    fontSize: fontScale(13),
    color: '#92400E',
    lineHeight: fontScale(18),
  },
  chainReactionTextDark: {
    color: '#FCD34D',
  },
  modifiersCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  modifiersCardDark: {
    backgroundColor: '#374151',
  },
  modifierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  modifierLabel: {
    fontSize: fontScale(14),
    color: '#374151',
    flex: 1,
  },
  modifierLabelDark: {
    color: '#D1D5DB',
  },
  modifierValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  bonusValue: {
    color: '#10B981',
  },
  penaltyValue: {
    color: '#EF4444',
  },
  calculationCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  calculationCardDark: {
    backgroundColor: '#374151',
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  calculationLabel: {
    fontSize: fontScale(14),
    color: '#374151',
  },
  calculationLabelDark: {
    color: '#D1D5DB',
  },
  calculationValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
  },
  calculationValueDark: {
    color: '#F9FAFB',
  },
  finalValue: {
    color: '#3B82F6',
    fontSize: fontScale(16),
  },
  modifierBreakdown: {
    marginTop: responsiveSpacing.sm,
    paddingTop: responsiveSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modifierBreakdownText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: responsiveSpacing.xs,
    lineHeight: fontScale(16),
  },
  modifierBreakdownTextDark: {
    color: '#9CA3AF',
    borderTopColor: '#4B5563',
  },
  closeButtonContainer: {
    marginTop: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  closeButtonGradient: {
    padding: responsiveSpacing.md,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '600',
  },
});


