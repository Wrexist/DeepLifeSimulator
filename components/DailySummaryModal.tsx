import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, Calendar, DollarSign, Activity, Heart, Zap, Smile, Shield, Sparkles } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import FadeInUp from '@/components/anim/FadeInUp';

const STAT_ICONS: Record<string, { icon: typeof Heart; color: string }> = {
  health: { icon: Heart, color: '#EF4444' },
  happiness: { icon: Smile, color: '#F59E0B' },
  energy: { icon: Zap, color: '#3B82F6' },
  fitness: { icon: Activity, color: '#10B981' },
  reputation: { icon: Shield, color: '#8B5CF6' },
};

function DailySummaryModal() {
  const { gameState, setGameState } = useGame();
  const { settings } = gameState;
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const dailySummary = gameState.dailySummary;

  const highlight = useMemo(() => {
    const events = dailySummary?.events;
    const moneyChange = dailySummary?.moneyChange;
    if (events && events.length > 0) return events[0];
    if ((moneyChange || 0) > 1000) return `Earned $${Math.round(moneyChange || 0).toLocaleString()} this week!`;
    if ((moneyChange || 0) < -1000) return `Spent $${Math.abs(Math.round(moneyChange || 0)).toLocaleString()} this week`;
    return null;
  }, [dailySummary?.events, dailySummary?.moneyChange]);

  const netStatDirection = useMemo(() => {
    const statsChange = dailySummary?.statsChange;
    if (!statsChange) return 0;
    return Object.values(statsChange).reduce((sum, v) => sum + (v || 0), 0);
  }, [dailySummary?.statsChange]);

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

  const weekLabel = isMonthly ? 'Monthly Report' : 'Weekly Report';

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, settings.darkMode && styles.modalDark]}>
          {/* Header with gradient */}
          <LinearGradient
            colors={settings.darkMode ? ['#1E3A5F', '#1F2937'] : ['#3B82F6', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Calendar size={20} color="#FFFFFF" />
                <Text style={styles.headerTitle}>{weekLabel}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>
              Week {gameState.date.week} of {gameState.date.month} {Math.floor(gameState.date.year || 2025)} — Age {Math.floor(gameState.date.age)}
            </Text>

            {/* Big money display */}
            <View style={styles.moneyHero}>
              <Text style={styles.moneyHeroLabel}>Net Change</Text>
              <Text style={[
                styles.moneyHeroValue,
                (moneyChange || 0) > 0 && styles.moneyHeroPositive,
                (moneyChange || 0) < 0 && styles.moneyHeroNegative,
              ]}>
                {(moneyChange || 0) > 0 ? '+' : ''}{(moneyChange || 0) !== 0
                  ? `$${Math.round(moneyChange || 0).toLocaleString()}`
                  : '$0'}
              </Text>
              <Text style={styles.moneyHeroBalance}>
                Balance: ${Math.round(gameState.stats.money).toLocaleString()}
              </Text>
            </View>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >

            {/* Highlight of the Week */}
            {highlight && (
              <FadeInUp delay={0}>
                <View style={[styles.highlightCard, settings.darkMode && styles.highlightCardDark]}>
                  <Sparkles size={16} color="#F59E0B" />
                  <Text style={[styles.highlightText, settings.darkMode && styles.highlightTextDark]} numberOfLines={2}>
                    {highlight}
                  </Text>
                </View>
              </FadeInUp>
            )}

            {/* Earnings Breakdown */}
            {earningsBreakdown && (
              <FadeInUp delay={60}>
              <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
                <View style={styles.sectionHeader}>
                  <DollarSign size={18} color={settings.darkMode ? '#10B981' : '#059669'} />
                  <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                    Income Sources
                  </Text>
                </View>
                {earningsBreakdown.salary > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Salary</Text>
                    <Text style={styles.breakdownValue}>+${Math.round(earningsBreakdown.salary).toLocaleString()}</Text>
                  </View>
                )}
                {earningsBreakdown.gaming > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Gaming</Text>
                    <Text style={styles.breakdownValue}>+${Math.round(earningsBreakdown.gaming).toLocaleString()}</Text>
                  </View>
                )}
                {earningsBreakdown.streaming > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Streaming</Text>
                    <Text style={styles.breakdownValue}>+${Math.round(earningsBreakdown.streaming).toLocaleString()}</Text>
                  </View>
                )}
                {earningsBreakdown.passive > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Passive Income</Text>
                    <Text style={styles.breakdownValue}>+${Math.round(earningsBreakdown.passive).toLocaleString()}</Text>
                  </View>
                )}
                {earningsBreakdown.sponsors > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Sponsors</Text>
                    <Text style={styles.breakdownValue}>+${Math.round(earningsBreakdown.sponsors).toLocaleString()}</Text>
                  </View>
                )}
              </View>
              </FadeInUp>
            )}

            {/* Stats Changes — compact bar style */}
            <FadeInUp delay={120}>
            <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
              <View style={styles.sectionHeader}>
                <Activity size={18} color={settings.darkMode ? '#3B82F6' : '#2563EB'} />
                <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                  Stats
                </Text>
                {netStatDirection !== 0 && (
                  <View style={[styles.netBadge, netStatDirection > 0 ? styles.netBadgeUp : styles.netBadgeDown]}>
                    <Text style={styles.netBadgeText}>
                      {netStatDirection > 0 ? 'Improving' : 'Declining'}
                    </Text>
                  </View>
                )}
              </View>

              {statsChange && Object.keys(statsChange).length > 0 && Object.values(statsChange).some(change => change !== 0) ? (
                <View style={styles.statsGrid}>
                  {Object.entries(statsChange).map(([stat, change]) => {
                    if (change === 0) return null;
                    const statConfig = STAT_ICONS[stat] || { icon: Activity, color: '#6B7280' };
                    const Icon = statConfig.icon;
                    const currentValue = (gameState.stats as unknown as Record<string, number>)[stat] || 0;
                    return (
                      <View key={stat} style={[styles.statChip, settings.darkMode && styles.statChipDark]}>
                        <View style={styles.statChipTop}>
                          <Icon size={14} color={statConfig.color} />
                          <Text style={[styles.statChipName, settings.darkMode && styles.statChipNameDark]}>
                            {stat.charAt(0).toUpperCase() + stat.slice(1)}
                          </Text>
                          <Text style={[
                            styles.statChipChange,
                            change! > 0 ? styles.positiveText : styles.negativeText
                          ]}>
                            {change! > 0 ? '+' : ''}{change}
                          </Text>
                        </View>
                        {/* Mini bar */}
                        <View style={[styles.miniBar, settings.darkMode && styles.miniBarDark]}>
                          <View style={[styles.miniBarFill, { width: `${Math.min(100, currentValue)}%`, backgroundColor: statConfig.color }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.noChangesText, settings.darkMode && styles.noChangesTextDark]}>
                  No stat changes this period
                </Text>
              )}
            </View>
            </FadeInUp>

            {/* Events */}
            {events && events.length > 0 && (
              <FadeInUp delay={200}>
              <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
                <View style={styles.sectionHeader}>
                  <Calendar size={18} color={settings.darkMode ? '#F59E0B' : '#D97706'} />
                  <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                    This Week
                  </Text>
                </View>
                {events.map((event, index) => (
                  <View key={index} style={[styles.eventRow, settings.darkMode && styles.eventRowDark]}>
                    <View style={[styles.eventDot, { backgroundColor: index === 0 ? '#F59E0B' : '#6B7280' }]} />
                    <Text style={[styles.eventText, settings.darkMode && styles.eventTextDark]} numberOfLines={3}>
                      {event}
                    </Text>
                  </View>
                ))}
              </View>
              </FadeInUp>
            )}

            </ScrollView>
          </View>

          {/* Footer */}
          <View style={[styles.footer, settings.darkMode && styles.footerDark]}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    width: '95%',
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  modalDark: {
    backgroundColor: '#111827',
  },
  // Header gradient
  headerGradient: {
    paddingTop: responsiveSpacing.lg,
    paddingHorizontal: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: responsiveSpacing.md,
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // Money hero
  moneyHero: {
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
  },
  moneyHeroLabel: {
    fontSize: responsiveFontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  moneyHeroValue: {
    fontSize: responsiveFontSize['3xl'],
    fontWeight: '800',
    color: '#FFFFFF',
  },
  moneyHeroPositive: {
    color: '#6EE7B7',
  },
  moneyHeroNegative: {
    color: '#FCA5A5',
  },
  moneyHeroBalance: {
    fontSize: responsiveFontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  // Content
  content: {
    flex: 1,
    minHeight: 200,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: responsiveSpacing.md,
    paddingBottom: 8,
  },
  // Highlight card
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  highlightCardDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  highlightText: {
    flex: 1,
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#92400E',
  },
  highlightTextDark: {
    color: '#FDE68A',
  },
  // Sections
  section: {
    marginBottom: responsiveSpacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  sectionDark: {
    backgroundColor: '#1F2937',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
    gap: 8,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  sectionTitleDark: {
    color: '#F3F4F6',
  },
  // Breakdown rows
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
  // Stat chips
  statsGrid: {
    gap: 8,
  },
  statChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statChipDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  statChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statChipName: {
    flex: 1,
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    color: '#374151',
  },
  statChipNameDark: {
    color: '#D1D5DB',
  },
  statChipChange: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
  },
  positiveText: {
    color: '#10B981',
  },
  negativeText: {
    color: '#EF4444',
  },
  // Mini progress bar
  miniBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniBarDark: {
    backgroundColor: '#4B5563',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Net badge
  netBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  netBadgeUp: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  netBadgeDown: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  netBadgeText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Events
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 10,
  },
  eventRowDark: {},
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  eventText: {
    flex: 1,
    fontSize: responsiveFontSize.sm,
    color: '#374151',
    lineHeight: responsiveFontSize.sm * 1.5,
  },
  eventTextDark: {
    color: '#D1D5DB',
  },
  noChangesText: {
    fontSize: responsiveFontSize.sm,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  noChangesTextDark: {
    color: '#6B7280',
  },
  // Footer
  footer: {
    padding: responsiveSpacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerDark: {
    borderTopColor: '#1F2937',
  },
  continueButton: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: responsiveBorderRadius.md,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
  },
});

export default React.memo(DailySummaryModal);
