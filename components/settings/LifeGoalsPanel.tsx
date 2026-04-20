/**
 * LifeGoalsPanel — Displays perk-based life goals with progress tracking.
 * Extracted from SettingsModal to reduce its size.
 */

import React from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Target, Sparkles } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { perks } from '@/src/features/onboarding/perksData';
import { useGame } from '@/contexts/GameContext';
import { responsivePadding, responsiveSpacing, scale, fontScale } from '@/utils/scaling';

export default function LifeGoalsPanel() {
  const { gameState } = useGame();
  const { settings } = gameState;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Target size={24} color="#F59E0B" />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, settings?.darkMode && styles.titleDark]}>
            Life Goals
          </Text>
          <Text style={[styles.subtitle, settings?.darkMode && styles.subtitleDark]}>
            Achieve goals to unlock powerful perks for your next life
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {perks.map(perk => {
          const isCompleted = gameState.achievements?.some(
            a => a.id === perk.unlock?.achievementId && a.completed
          ) ?? false;
          const current = isCompleted ? 1 : 0;
          const goalValue = 1;
          const progress = Math.min(1, current / goalValue);
          const progressPercent = Math.round(progress * 100);

          return (
            <View key={perk.id} style={styles.card}>
              <LinearGradient
                colors={
                  isCompleted
                    ? ['rgba(16, 185, 129, 0.15)', 'rgba(5, 150, 105, 0.2)']
                    : settings?.darkMode
                    ? ['rgba(55, 65, 81, 0.4)', 'rgba(31, 41, 55, 0.5)']
                    : ['rgba(243, 244, 246, 0.8)', 'rgba(229, 231, 235, 0.9)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.flatten([styles.gradient, isCompleted ? styles.gradientCompleted : undefined]) as ViewStyle}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.iconWrapper}>
                    {typeof perk.icon === 'string' ? (
                      <View style={[styles.perkIconContainer, isCompleted && styles.perkIconContainerCompleted]}>
                        <Text style={styles.perkIconText}>{perk.icon}</Text>
                      </View>
                    ) : (
                      <View style={[styles.perkIconContainer, isCompleted && styles.perkIconContainerCompleted]}>
                        <Image source={perk.icon} style={styles.perkIcon} />
                      </View>
                    )}
                  </View>

                  <View style={styles.infoSection}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.cardTitle,
                          settings?.darkMode && styles.cardTitleDark,
                          isCompleted && styles.cardTitleCompleted,
                        ]}
                        numberOfLines={1}
                      >
                        {perk.title}
                      </Text>
                      {isCompleted && (
                        <View style={styles.completedBadge}>
                          <Text style={styles.completedBadgeText}>✓</Text>
                        </View>
                      )}
                    </View>

                    <Text
                      style={[styles.reward, settings?.darkMode && styles.rewardDark]}
                      numberOfLines={2}
                    >
                      {perk.description}
                    </Text>
                  </View>
                </View>

                <View style={styles.requirementSection}>
                  <View style={styles.requirementRow}>
                    <Sparkles size={14} color={settings?.darkMode ? '#9CA3AF' : '#6B7280'} />
                    <Text style={[styles.requirementText, settings?.darkMode && styles.requirementTextDark]}>
                      {perk.requirement}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, settings?.darkMode && styles.progressLabelDark]}>
                      Progress
                    </Text>
                    <Text
                      style={[
                        styles.progressPercent,
                        settings?.darkMode && styles.progressPercentDark,
                        isCompleted && styles.progressPercentCompleted,
                      ]}
                    >
                      {progressPercent}%
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, settings?.darkMode && styles.progressBarDark]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progressPercent}%`,
                            backgroundColor: isCompleted ? '#10B981' : '#3B82F6',
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={[styles.progressText, settings?.darkMode && styles.progressTextDark]}>
                    {current} / {goalValue} completed
                  </Text>
                </View>
              </LinearGradient>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsivePadding.large,
    paddingVertical: responsiveSpacing.lg,
    marginBottom: responsiveSpacing.md,
    gap: responsiveSpacing.md,
  },
  iconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: fontScale(22),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: scale(4),
    letterSpacing: -0.5,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: fontScale(13),
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: fontScale(18),
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: responsivePadding.large,
    paddingBottom: responsiveSpacing.xl,
    gap: scale(14),
  },
  card: {
    marginBottom: scale(12),
    borderRadius: scale(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.2,
        shadowRadius: scale(8),
      },
      android: { elevation: 4 },
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.2,
        shadowRadius: scale(8),
      },
    }),
  },
  gradient: {
    padding: scale(18),
    minHeight: scale(160),
  },
  gradientCompleted: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.3,
        shadowRadius: scale(8),
      },
      android: { elevation: 6 },
      web: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.3,
        shadowRadius: scale(8),
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: scale(14),
    gap: scale(12),
  },
  iconWrapper: {
    alignItems: 'flex-start',
  },
  perkIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  perkIconContainerCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  perkIcon: {
    width: scale(40),
    height: scale(40),
  },
  perkIconText: {
    fontSize: scale(40),
  },
  infoSection: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(6),
  },
  cardTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    letterSpacing: -0.3,
  },
  cardTitleDark: {
    color: '#FFFFFF',
  },
  cardTitleCompleted: {
    color: '#10B981',
  },
  completedBadge: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  completedBadgeText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reward: {
    fontSize: fontScale(13),
    color: '#6B7280',
    lineHeight: fontScale(18),
    fontWeight: '500',
  },
  rewardDark: {
    color: '#D1D5DB',
  },
  requirementSection: {
    marginBottom: scale(14),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  requirementText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    fontWeight: '600',
    flex: 1,
  },
  requirementTextDark: {
    color: '#9CA3AF',
  },
  progressSection: {
    marginTop: scale(4),
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  progressLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressLabelDark: {
    color: '#9CA3AF',
  },
  progressPercent: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#3B82F6',
  },
  progressPercentDark: {
    color: '#60A5FA',
  },
  progressPercentCompleted: {
    color: '#10B981',
  },
  progressBarContainer: {
    marginBottom: scale(6),
  },
  progressBar: {
    height: scale(8),
    backgroundColor: 'rgba(229, 231, 235, 0.5)',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressBarDark: {
    backgroundColor: 'rgba(55, 65, 81, 0.6)',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(4),
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: scale(4),
      },
      android: { elevation: 2 },
      web: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: scale(4),
      },
    }),
  },
  progressText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    fontWeight: '500',
  },
  progressTextDark: {
    color: '#9CA3AF',
  },
});
