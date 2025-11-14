import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useGame } from '@/contexts/GameContext';
import { Trophy, Gem, Sparkles } from 'lucide-react-native';
import { useAchievements } from '@/hooks/useAchievements';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
  verticalScale,
} from '@/utils/scaling';

export default function AchievementsProgress() {
  const { gameState, claimProgressAchievement } = useGame();
  const { achievements } = useAchievements();
  const [sort, setSort] = useState<'progress' | 'title'>('progress');
  const display = useMemo(
    () =>
      [...achievements].sort(
        sort === 'progress'
          ? (a, b) => b.progress - a.progress
          : (a, b) => a.title.localeCompare(b.title)
      ),
    [achievements, sort]
  );

  return (
    <View style={[styles.container, gameState.settings.darkMode && styles.containerDark]}>
      {/* Enhanced header with gradient background */}
      <BlurView intensity={20} style={styles.headerBlur}>
        <LinearGradient
          colors={gameState.settings.darkMode ? ['rgba(99, 102, 241, 0.1)', 'rgba(79, 70, 229, 0.1)'] : ['rgba(99, 102, 241, 0.05)', 'rgba(79, 70, 229, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View style={styles.trophyContainer}>
              <LinearGradient
                colors={['#FBBF24', '#F59E0B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.trophyGradient}
              >
                <Trophy size={responsiveIconSize.lg} color="#FFFFFF" />
              </LinearGradient>
              <Sparkles size={12} color="#6366F1" style={styles.sparkleIcon} />
            </View>
            <Text style={[styles.title, gameState.settings.darkMode && styles.titleDark]}>Achievements in Progress</Text>
          </View>
        </LinearGradient>
      </BlurView>
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => setSort(sort === 'progress' ? 'title' : 'progress')}
          style={styles.sortToggle}
        >
          <Text
            style={[
              styles.controlText,
              gameState.settings.darkMode && styles.controlTextDark,
            ]}
          >
            Sort: {sort === 'progress' ? 'Progress' : 'Title'}
          </Text>
        </TouchableOpacity>
      </View>
      <View>
        {display.length === 0 && (
          <Text style={[styles.empty, gameState.settings.darkMode && styles.cardDescDark]}>No achievements in progress.</Text>
        )}
        {display.map(a => {
          const progress = Math.min(1, a.progress);
          return (
            <View key={a.id} style={[styles.card, gameState.settings.darkMode && styles.cardDark]}>
              <View style={styles.cardHeader}>
                {a.icon && <Image source={a.icon} style={styles.achievementIcon} />}
                <Text style={[styles.cardTitle, gameState.settings.darkMode && styles.cardTitleDark]}>{a.title}</Text>
                <View style={styles.headerRight}>
                  <Text style={styles.stackText}>{`${a.stackIndex + 1}/${a.stackSize}`}</Text>
                  {a.goldReward > 0 && (
                    <View style={styles.reward}>
                      <LinearGradient
                        colors={['#6366F1', '#4F46E5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gemContainer}
                      >
                        <Gem size={responsiveIconSize.sm} color="#FFFFFF" />
                      </LinearGradient>
                      <Text style={[styles.rewardText, { color: '#6366F1' }]}>{a.goldReward}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.cardDesc, gameState.settings.darkMode && styles.cardDescDark]}>{a.description}</Text>
              {a.nextTitle && (
                <Text style={[styles.nextText, gameState.settings.darkMode && styles.cardDescDark]}>
                  Next: {a.nextTitle}
                </Text>
              )}
              {a.progress >= 1 ? (
                <TouchableOpacity onPress={() => claimProgressAchievement(a.id, a.goldReward)}>
                  <BlurView intensity={20} style={styles.claimButtonBlur}>
                    <LinearGradient
                      colors={['#6366F1', '#4F46E5']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.claimButton}
                    >
                      <Sparkles size={16} color="#FFFFFF" style={styles.claimIcon} />
                      <Text style={styles.claimText}>Claim Reward</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>
              ) : (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]}>
                    <LinearGradient
                      colors={['#A855F7', '#6366F1', '#4F46E5']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  <View style={styles.progressGlow} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: verticalScale(20),
    backgroundColor: '#1F2937',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  containerDark: {
    backgroundColor: '#1F2937',
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  headerBlur: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginBottom: responsiveSpacing.md,
  },
  headerGradient: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trophyContainer: {
    position: 'relative',
    marginRight: responsiveSpacing.sm,
  },
  trophyGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sparkleIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
  },
  title: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#F9FAFB',
    marginLeft: responsiveSpacing.sm,
    flex: 1,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  card: {
    marginBottom: responsiveSpacing.md,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDark: {
    backgroundColor: '#374151',
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementIcon: {
    width: responsiveIconSize.lg,
    height: responsiveIconSize.lg,
    marginRight: responsiveSpacing.sm,
  },
  cardTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#1F2937',
  },
  cardTitleDark: {
    color: '#F9FAFB',
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gemContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rewardText: {
    marginLeft: responsiveSpacing.xs,
    color: '#6366F1',
    fontWeight: '600',
    fontSize: responsiveFontSize.sm,
  },
  stackText: {
    marginRight: responsiveSpacing.sm,
    color: '#9CA3AF',
    fontSize: responsiveFontSize.sm,
  },
  cardDesc: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginBottom: responsiveSpacing.sm,
  },
  cardDescDark: {
    color: '#D1D5DB',
  },
  nextText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginBottom: responsiveSpacing.xs,
  },
  empty: {
    textAlign: 'center',
    marginBottom: responsiveSpacing.sm,
    color: '#6B7280',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  controlText: {
    color: '#F9FAFB',
  },
  controlTextDark: {
    color: '#F9FAFB',
  },
  sortToggle: {
    padding: responsiveSpacing.xs,
  },
  progressBar: {
    height: scale(10),
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.sm,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.sm,
    overflow: 'hidden',
  },
  progressGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: responsiveBorderRadius.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  },
  unlocked: {
    color: '#10B981',
    fontWeight: '600',
  },
  claimButtonBlur: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginTop: responsiveSpacing.xs,
  },
  claimButton: {
    paddingVertical: scale(8),
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  claimIcon: {
    marginRight: responsiveSpacing.xs,
  },
  claimText: {
    fontWeight: '600',
    color: '#FFFFFF',
    fontSize: responsiveFontSize.base,
  },
});
