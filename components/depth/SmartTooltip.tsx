/**
 * Smart Tooltips & Contextual Help
 * Intelligent tooltips that explain mechanics with progressive disclosure
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Info,
  X,
  ChevronDown,
  ChevronUp,
  Calculator,
  Lightbulb,
  TrendingUp,
} from 'lucide-react-native';
import { GameState } from '@/contexts/game/types';
import { scale, fontScale, responsivePadding, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';

export type DisclosureLevel = 'simple' | 'standard' | 'advanced';

interface SmartTooltipProps {
  content: TooltipContent;
  disclosureLevel?: DisclosureLevel;
  darkMode?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'press' | 'longPress';
  children: React.ReactNode;
}

interface TooltipContent {
  title: string;
  simple?: string;
  standard?: string;
  advanced?: string;
  calculatedValue?: {
    label: string;
    value: number;
    breakdown?: string[];
  };
  hiddenModifiers?: Array<{
    name: string;
    value: number;
    description: string;
  }>;
  why?: string;
  strategyTip?: string;
  context?: GameState;
}

export default function SmartTooltip({
  content,
  disclosureLevel = 'standard',
  darkMode = false,
  position = 'top',
  trigger = 'press',
  children,
}: SmartTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const tooltipRef = useRef<View>(null);

  const getContent = () => {
    switch (disclosureLevel) {
      case 'simple':
        return content.simple || content.standard || content.advanced || '';
      case 'standard':
        return content.standard || content.advanced || content.simple || '';
      case 'advanced':
        return content.advanced || content.standard || content.simple || '';
      default:
        return content.standard || content.advanced || content.simple || '';
    }
  };

  const showTooltip = () => {
    setVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const hideTooltip = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setExpanded(false);
    });
  };

  const triggerProps: any = {};
  if (trigger === 'press') {
    triggerProps.onPress = showTooltip;
  } else if (trigger === 'longPress') {
    triggerProps.onLongPress = showTooltip;
  }

  const mainContent = getContent();

  return (
    <>
      <TouchableOpacity
        {...triggerProps}
        activeOpacity={0.7}
        style={styles.trigger}
      >
        {children}
      </TouchableOpacity>

      {visible && (
        <Modal
          visible={visible}
          transparent
          animationType="none"
          onRequestClose={hideTooltip}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={hideTooltip}
          >
            <Animated.View
              ref={tooltipRef}
              style={[
                styles.tooltip,
                darkMode && styles.tooltipDark,
                getPositionStyle(position),
                { opacity: fadeAnim },
              ]}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <LinearGradient
                  colors={darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F9FAFB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tooltipGradient}
                >
                  {/* Header */}
                  <View style={styles.tooltipHeader}>
                    <View style={styles.tooltipHeaderLeft}>
                      <Info size={scale(16)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
                      <Text style={[styles.tooltipTitle, darkMode && styles.tooltipTitleDark]}>
                        {content.title}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={hideTooltip} style={styles.tooltipClose}>
                      <X size={scale(14)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                    </TouchableOpacity>
                  </View>

                  {/* Main Content */}
                  <Text style={[styles.tooltipContent, darkMode && styles.tooltipContentDark]}>
                    {mainContent}
                  </Text>

                  {/* Calculated Value */}
                  {content.calculatedValue && disclosureLevel !== 'simple' && (
                    <View style={styles.calculatedSection}>
                      <View style={styles.calculatedHeader}>
                        <Calculator size={scale(14)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
                        <Text style={[styles.calculatedLabel, darkMode && styles.calculatedLabelDark]}>
                          {content.calculatedValue.label}
                        </Text>
                      </View>
                      <Text style={[styles.calculatedValue, darkMode && styles.calculatedValueDark]}>
                        {content.calculatedValue.value}
                      </Text>
                      {content.calculatedValue.breakdown && expanded && (
                        <View style={styles.breakdown}>
                          {content.calculatedValue.breakdown.map((item, index) => (
                            <Text
                              key={index}
                              style={[styles.breakdownItem, darkMode && styles.breakdownItemDark]}
                            >
                              {item}
                            </Text>
                          ))}
                        </View>
                      )}
                      {content.calculatedValue.breakdown && (
                        <TouchableOpacity
                          onPress={() => setExpanded(!expanded)}
                          style={styles.expandButton}
                        >
                          {expanded ? (
                            <ChevronUp size={scale(12)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                          ) : (
                            <ChevronDown size={scale(12)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                          )}
                          <Text style={[styles.expandText, darkMode && styles.expandTextDark]}>
                            {expanded ? 'Hide' : 'Show'} breakdown
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Hidden Modifiers */}
                  {content.hiddenModifiers && content.hiddenModifiers.length > 0 && disclosureLevel === 'advanced' && (
                    <View style={styles.modifiersSection}>
                      <Text style={[styles.modifiersTitle, darkMode && styles.modifiersTitleDark]}>
                        Active Modifiers:
                      </Text>
                      {content.hiddenModifiers.map((modifier, index) => (
                        <View key={index} style={styles.modifierItem}>
                          <Text style={[styles.modifierName, darkMode && styles.modifierNameDark]}>
                            {modifier.name}:
                          </Text>
                          <Text
                            style={[
                              styles.modifierValue,
                              modifier.value > 0 ? styles.positiveModifier : styles.negativeModifier,
                            ]}
                          >
                            {modifier.value > 0 ? '+' : ''}{modifier.value}%
                          </Text>
                          <Text style={[styles.modifierDesc, darkMode && styles.modifierDescDark]}>
                            {modifier.description}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Why */}
                  {content.why && disclosureLevel !== 'simple' && (
                    <View style={styles.whySection}>
                      <Text style={[styles.whyTitle, darkMode && styles.whyTitleDark]}>
                        Why?
                      </Text>
                      <Text style={[styles.whyText, darkMode && styles.whyTextDark]}>
                        {content.why}
                      </Text>
                    </View>
                  )}

                  {/* Strategy Tip */}
                  {content.strategyTip && (
                    <View style={styles.tipSection}>
                      <View style={styles.tipHeader}>
                        <Lightbulb size={scale(14)} color="#F59E0B" />
                        <Text style={[styles.tipTitle, darkMode && styles.tipTitleDark]}>
                          Strategy Tip
                        </Text>
                      </View>
                      <Text style={[styles.tipText, darkMode && styles.tipTextDark]}>
                        {content.strategyTip}
                      </Text>
                    </View>
                  )}

                  {/* Disclosure Level Indicator */}
                  {disclosureLevel !== 'simple' && (
                    <View style={styles.disclosureIndicator}>
                      <Text style={[styles.disclosureText, darkMode && styles.disclosureTextDark]}>
                        {disclosureLevel === 'advanced' ? 'Advanced Mode' : 'Standard Mode'}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

function getPositionStyle(position: 'top' | 'bottom' | 'left' | 'right') {
  switch (position) {
    case 'top':
      return { bottom: scale(50) };
    case 'bottom':
      return { top: scale(50) };
    case 'left':
      return { right: scale(50) };
    case 'right':
      return { left: scale(50) };
    default:
      return { bottom: scale(50) };
  }
}

const styles = StyleSheet.create({
  trigger: {
    // Trigger takes no space, wraps children
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    maxWidth: scale(320),
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipDark: {},
  tooltipGradient: {
    padding: responsiveSpacing.md,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  tooltipHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    flex: 1,
  },
  tooltipTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  tooltipTitleDark: {
    color: '#F9FAFB',
  },
  tooltipClose: {
    padding: responsiveSpacing.xs / 2,
  },
  tooltipContent: {
    fontSize: fontScale(14),
    color: '#374151',
    lineHeight: fontScale(20),
    marginBottom: responsiveSpacing.sm,
  },
  tooltipContentDark: {
    color: '#D1D5DB',
  },
  calculatedSection: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  calculatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.xs,
  },
  calculatedLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#3B82F6',
  },
  calculatedLabelDark: {
    color: '#60A5FA',
  },
  calculatedValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: responsiveSpacing.xs,
  },
  calculatedValueDark: {
    color: '#F9FAFB',
  },
  breakdown: {
    marginTop: responsiveSpacing.xs,
  },
  breakdownItem: {
    fontSize: fontScale(11),
    color: '#6B7280',
    lineHeight: fontScale(16),
    marginBottom: responsiveSpacing.xs / 2,
  },
  breakdownItemDark: {
    color: '#9CA3AF',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs / 2,
    marginTop: responsiveSpacing.xs,
  },
  expandText: {
    fontSize: fontScale(11),
    color: '#6B7280',
  },
  expandTextDark: {
    color: '#9CA3AF',
  },
  modifiersSection: {
    marginBottom: responsiveSpacing.sm,
  },
  modifiersTitle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#374151',
    marginBottom: responsiveSpacing.xs,
  },
  modifiersTitleDark: {
    color: '#D1D5DB',
  },
  modifierItem: {
    marginBottom: responsiveSpacing.xs,
  },
  modifierName: {
    fontSize: fontScale(12),
    color: '#374151',
    fontWeight: '500',
  },
  modifierNameDark: {
    color: '#D1D5DB',
  },
  modifierValue: {
    fontSize: fontScale(12),
    fontWeight: '600',
    marginLeft: responsiveSpacing.xs,
  },
  positiveModifier: {
    color: '#10B981',
  },
  negativeModifier: {
    color: '#EF4444',
  },
  modifierDesc: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: responsiveSpacing.xs / 2,
    lineHeight: fontScale(14),
  },
  modifierDescDark: {
    color: '#9CA3AF',
  },
  whySection: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  whyTitle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: responsiveSpacing.xs,
  },
  whyTitleDark: {
    color: '#60A5FA',
  },
  whyText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    lineHeight: fontScale(16),
  },
  whyTextDark: {
    color: '#9CA3AF',
  },
  tipSection: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.xs,
  },
  tipTitle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#D97706',
  },
  tipTitleDark: {
    color: '#FBBF24',
  },
  tipText: {
    fontSize: fontScale(12),
    color: '#92400E',
    lineHeight: fontScale(16),
  },
  tipTextDark: {
    color: '#FCD34D',
  },
  disclosureIndicator: {
    marginTop: responsiveSpacing.xs,
    paddingTop: responsiveSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  disclosureText: {
    fontSize: fontScale(10),
    color: '#9CA3AF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disclosureTextDark: {
    color: '#6B7280',
  },
});

