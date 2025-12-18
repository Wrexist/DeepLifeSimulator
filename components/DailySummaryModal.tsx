import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, TrendingUp, TrendingDown, Calendar, DollarSign, Activity, Heart, Network, Link, Compass, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';
import { getSystemHealth, getSystemInterconnections } from '@/lib/depth/systemInterconnections';
import { getDiscoveryProgress } from '@/lib/depth/discoverySystem';

export default function DailySummaryModal() {
  const { gameState, setGameState } = useGame();
  const { settings } = gameState;
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Check if we should show the modal
  const shouldShow = gameState.dailySummary && settings.weeklySummaryEnabled;
  const isMonthly = (gameState.weeksLived || 0) % 4 === 0;

  useEffect(() => {
    if (shouldShow && !isClosing) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow, isClosing]);

  // Cleanup effect to reset state when component unmounts
  useEffect(() => {
    return () => {
      // Clear any pending timeout to prevent setState on unmounted component
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setIsClosing(false);
      setIsVisible(false);
    };
  }, []);

  const handleClose = () => {
    if (isClosing) return; // Prevent multiple close calls
    
    setIsClosing(true);
    setIsVisible(false);
    
    // Clear the daily summary immediately to prevent race conditions
    setGameState(prev => ({
      ...prev,
      dailySummary: undefined,
    }));
    
    // Clear any existing timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    
    // Reset closing state after animation (tracked with ref)
    closeTimeoutRef.current = setTimeout(() => {
      setIsClosing(false);
      closeTimeoutRef.current = null;
    }, 300);
  };

  if (!shouldShow || !isVisible) return null;

  const { moneyChange, statsChange, events, earningsBreakdown } = gameState.dailySummary || {};


  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, settings.darkMode && styles.modalDark]}>
          {/* Header */}
          <View style={[styles.header, settings.darkMode && styles.headerDark]}>
            <View style={styles.headerLeft}>
              <Calendar size={24} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
              <Text style={[styles.title, settings.darkMode && styles.titleDark]}>
                {isMonthly ? 'Monthly Summary' : 'Weekly Summary'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContent}
            >
            {/* Financial Summary */}
            <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
              <View style={styles.sectionHeader}>
                <DollarSign size={20} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
                <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                  Financial Changes
                </Text>
              </View>
              
              <View style={[styles.changeCard, settings.darkMode && styles.changeCardDark]}>
                <View style={styles.changeRow}>
                  {(moneyChange || 0) > 0 ? (
                    <TrendingUp size={20} color="#10B981" />
                  ) : (moneyChange || 0) < 0 ? (
                    <TrendingDown size={20} color="#EF4444" />
                  ) : (
                    <DollarSign size={20} color="#6B7280" />
                  )}
                  <Text style={[
                    styles.changeText,
                    (moneyChange || 0) > 0 ? styles.positiveText :
                    (moneyChange || 0) < 0 ? styles.negativeText :
                    settings.darkMode ? styles.neutralTextDark : styles.neutralText
                  ]}>
                    {(moneyChange || 0) !== 0 
                      ? `$${Math.round(moneyChange || 0).toLocaleString()}`
                      : 'No financial changes'
                    }
                  </Text>
                </View>
              </View>

              {/* Earnings Breakdown */}
              {earningsBreakdown && (
                <View style={[styles.breakdown, settings.darkMode && styles.breakdownDark]}>
                  <Text style={[styles.breakdownTitle, settings.darkMode && styles.breakdownTitleDark]}>
                    Earnings Breakdown
                  </Text>
                  {earningsBreakdown.salary > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Salary:</Text>
                      <Text style={[styles.breakdownValue, settings.darkMode && styles.breakdownValueDark]}>
                        +${Math.round(earningsBreakdown.salary).toLocaleString()}
                      </Text>
                    </View>
                  )}
                  {earningsBreakdown.gaming > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Gaming:</Text>
                      <Text style={[styles.breakdownValue, settings.darkMode && styles.breakdownValueDark]}>
                        +${Math.round(earningsBreakdown.gaming).toLocaleString()}
                      </Text>
                    </View>
                  )}
                  {earningsBreakdown.streaming > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Streaming:</Text>
                      <Text style={[styles.breakdownValue, settings.darkMode && styles.breakdownValueDark]}>
                        +${Math.round(earningsBreakdown.streaming).toLocaleString()}
                      </Text>
                    </View>
                  )}
                  {earningsBreakdown.passive > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Passive Income:</Text>
                      <Text style={[styles.breakdownValue, settings.darkMode && styles.breakdownValueDark]}>
                        +${Math.round(earningsBreakdown.passive).toLocaleString()}
                      </Text>
                    </View>
                  )}
                  {earningsBreakdown.sponsors > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Sponsors:</Text>
                      <Text style={[styles.breakdownValue, settings.darkMode && styles.breakdownValueDark]}>
                        +${Math.round(earningsBreakdown.sponsors).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Stats Changes */}
            <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
              <View style={styles.sectionHeader}>
                <Activity size={20} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
                <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                  Stats Changes
                </Text>
              </View>
              
              {statsChange && Object.keys(statsChange).length > 0 && Object.values(statsChange).some(change => change !== 0) ? (
                Object.entries(statsChange).map(([stat, change]) => {
                  if (change === 0) return null;
                  return (
                    <View key={stat} style={[styles.changeCard, settings.darkMode && styles.changeCardDark]}>
                      <View style={styles.changeRow}>
                        {change! > 0 ? (
                          <TrendingUp size={20} color="#10B981" />
                        ) : (
                          <TrendingDown size={20} color="#EF4444" />
                        )}
                        <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
                          {stat.charAt(0).toUpperCase() + stat.slice(1)}:
                        </Text>
                        <Text style={[
                          styles.changeText,
                          change! > 0 ? styles.positiveText : styles.negativeText
                        ]}>
                          {change! > 0 ? '+' : ''}{change}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={[styles.changeCard, settings.darkMode && styles.changeCardDark]}>
                  <Text style={[styles.noChangesText, settings.darkMode && styles.noChangesTextDark]}>
                    No stat changes this period
                  </Text>
                </View>
              )}
            </View>

            {/* Events */}
            <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
              <View style={styles.sectionHeader}>
                <Calendar size={20} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
                <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                  Events
                </Text>
              </View>
              
              {events && events.length > 0 ? (
                events.map((event, index) => (
                  <View key={index} style={[styles.eventCard, settings.darkMode && styles.eventCardDark]}>
                    <Text style={[styles.eventText, settings.darkMode && styles.eventTextDark]}>
                      • {event}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={[styles.eventCard, settings.darkMode && styles.eventCardDark]}>
                  <Text style={[styles.noChangesText, settings.darkMode && styles.noChangesTextDark]}>
                    No special events this period
                  </Text>
                </View>
              )}
            </View>

            {/* Current Status */}
            <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
              <View style={styles.sectionHeader}>
                <Heart size={20} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
                <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                  Current Status
                </Text>
              </View>
              
              <View style={[styles.statusCard, settings.darkMode && styles.statusCardDark]}>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, settings.darkMode && styles.statusLabelDark]}>Money:</Text>
                  <Text style={[styles.statusValue, settings.darkMode && styles.statusValueDark]}>
                    ${Math.round(gameState.stats.money).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, settings.darkMode && styles.statusLabelDark]}>Age:</Text>
                  <Text style={[styles.statusValue, settings.darkMode && styles.statusValueDark]}>
                    {Math.floor(gameState.date.age)} years old
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, settings.darkMode && styles.statusLabelDark]}>Week:</Text>
                  <Text style={[styles.statusValue, settings.darkMode && styles.statusValueDark]}>
                    {gameState.date.week} of {gameState.date.month} {Math.floor(gameState.date.year || 2025)}
                  </Text>
                </View>
              </View>
            </View>
            </ScrollView>
          </View>

          {/* Footer */}
          <View style={[styles.footer, settings.darkMode && styles.footerDark]}>
            <Text style={[styles.footerHint, settings.darkMode && styles.footerHintDark]}>
              You can disable these summaries in Settings
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.continueButton}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    width: '95%',
    height: '85%',
    maxHeight: '90%',
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    borderBottomColor: '#374151',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: responsiveSpacing.sm,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: responsiveSpacing.sm,
  },
  content: {
    flex: 1,
    minHeight: 400,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: responsiveSpacing.lg,
    flexGrow: 1,
  },
  section: {
    marginBottom: responsiveSpacing.lg,
    backgroundColor: '#F9FAFB',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  sectionDark: {
    backgroundColor: '#374151',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: responsiveSpacing.sm,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  changeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  changeCardDark: {
    backgroundColor: '#4B5563',
    borderColor: '#6B7280',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    marginLeft: responsiveSpacing.sm,
  },
  positiveText: {
    color: '#10B981',
  },
  negativeText: {
    color: '#EF4444',
  },
  neutralText: {
    color: '#6B7280',
  },
  neutralTextDark: {
    color: '#9CA3AF',
  },
  statLabel: {
    fontSize: responsiveFontSize.base,
    color: '#374151',
    marginLeft: responsiveSpacing.sm,
    flex: 1,
  },
  statLabelDark: {
    color: '#D1D5DB',
  },
  breakdown: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
  },
  breakdownDark: {
    backgroundColor: '#4B5563',
  },
  breakdownTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#374151',
    marginBottom: responsiveSpacing.sm,
  },
  breakdownTitleDark: {
    color: '#D1D5DB',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.xs,
  },
  breakdownLabel: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
  },
  breakdownLabelDark: {
    color: '#9CA3AF',
  },
  breakdownValue: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#10B981',
  },
  breakdownValueDark: {
    color: '#10B981',
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventCardDark: {
    backgroundColor: '#4B5563',
    borderColor: '#6B7280',
  },
  eventText: {
    fontSize: responsiveFontSize.sm,
    color: '#374151',
    lineHeight: responsiveFontSize.sm * 1.4,
  },
  eventTextDark: {
    color: '#D1D5DB',
  },
  statusCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.md,
  },
  statusCardDark: {
    backgroundColor: '#4B5563',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.xs,
  },
  statusLabel: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusLabelDark: {
    color: '#9CA3AF',
  },
  statusValue: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusValueDark: {
    color: '#FFFFFF',
  },
  noChangesText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  noChangesTextDark: {
    color: '#9CA3AF',
  },
  footer: {
    padding: responsiveSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerDark: {
    borderTopColor: '#374151',
  },
  footerHint: {
    fontSize: responsiveFontSize.xs,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: responsiveSpacing.sm,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  footerHintDark: {
    color: '#6B7280',
  },
  continueButton: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: responsiveSpacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
  },
  engagementCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  engagementCardDark: {
    backgroundColor: '#374151',
  },
  engagementText: {
    fontSize: responsiveFontSize.sm,
    color: '#374151',
    marginBottom: responsiveSpacing.sm,
    fontWeight: '500',
  },
  engagementTextDark: {
    color: '#D1D5DB',
  },
  systemsList: {
    gap: responsiveSpacing.sm,
  },
  systemItem: {
    marginBottom: responsiveSpacing.xs,
  },
  systemName: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    marginBottom: responsiveSpacing.xs / 2,
  },
  systemNameDark: {
    color: '#9CA3AF',
  },
  systemHealthBar: {
    height: scale(6),
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  systemHealthBarDark: {
    backgroundColor: '#4B5563',
  },
  systemHealthFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  discoveryCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  discoveryCardDark: {
    backgroundColor: '#374151',
  },
  newSystemsSection: {
    marginBottom: responsiveSpacing.md,
  },
  newSystemsTitle: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
    marginBottom: responsiveSpacing.sm,
  },
  newSystemsTitleDark: {
    color: '#D1D5DB',
  },
  newSystemItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.xs,
  },
  newSystemName: {
    fontSize: responsiveFontSize.sm,
    color: '#1F2937',
    fontWeight: '500',
  },
  newSystemNameDark: {
    color: '#F9FAFB',
  },
  depthScoreSection: {
    marginTop: responsiveSpacing.sm,
  },
  depthScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.xs,
  },
  depthScoreLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
  },
  depthScoreLabelDark: {
    color: '#D1D5DB',
  },
  depthScoreBar: {
    height: scale(8),
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
  debugTest: {
    borderRadius: 8,
  },
});