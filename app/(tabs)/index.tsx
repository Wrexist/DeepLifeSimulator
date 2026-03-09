import React, { useEffect, useState, lazy, Suspense } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useGame } from '@/contexts/GameContext';
import { useTutorial } from '@/contexts/UIUXContext';
import AchievementsProgress from '@/components/AchievementsProgress';
import IdentityCard from '@/components/IdentityCard';
import PrestigeButton from '@/components/PrestigeButton';
import PrestigeStatsCard from '@/components/PrestigeStatsCard';
import PrestigePreviewCard from '@/components/PrestigePreviewCard';
import PrestigeModal from '@/components/PrestigeModal';
import PrestigeShopModal from '@/components/PrestigeShopModal';
import PrestigeInfoModal from '@/components/PrestigeInfoModal';
import { getEnhancedTutorialSteps } from '@/utils/enhancedTutorialData';
import { responsivePadding, responsiveFontSize, responsiveSpacing, scale, responsiveBorderRadius } from '@/utils/scaling';
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { checkGoalCompletion, Goal } from '@/utils/goalSystem';
import { ActiveGoalsCard } from '@/components/ActiveGoalsCard';
import { FirstWeekGuide, ContextualTip, useContextualTip } from '@/components/FirstWeekGuide';
import { generateDailyChallenges } from '@/utils/dailyChallenges';
import DiscoveryIndicator from '@/components/depth/DiscoveryIndicator';
import ErrorBoundary from '@/components/ErrorBoundary';
import FadeInUp from '@/components/anim/FadeInUp';
import { useTheme } from '@/hooks/useTheme';
import { useStatChangeTracker } from '@/contexts/StatChangeContext';

// Lazy load heavy modals and popups
const DailyRewardPopup = lazy(() => import('@/components/DailyRewardPopup'));
const WelcomeBackPopup = lazy(() => import('@/components/WelcomeBackPopup'));
const GoalCompletionPopup = lazy(() => import('@/components/GoalCompletionPopup'));

function HomeScreen() {
  return (
    <ErrorBoundary>
      <HomeScreenContent />
    </ErrorBoundary>
  );
}

function HomeScreenContent() {
  const insets = useSafeAreaInsets();
  const topStatsBarHeight = useTopStatsBarHeight();
  const { gameState, dismissWelcomePopup, setGameState } = useGame();
  const { theme, isDark } = useTheme();
  const { hasCompletedTutorial, startTutorial } = useTutorial();
  // ENGAGEMENT: Track stat changes for floating indicators on week advance
  useStatChangeTracker(gameState);
  const [showGoalCompletion, setShowGoalCompletion] = useState(false);
  const [completedGoal, setCompletedGoal] = useState<Goal | null>(null);
  const [nextGoal, setNextGoal] = useState<Goal | null>(null);
  const [showDailyChallenges, setShowDailyChallenges] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [showPrestigeShop, setShowPrestigeShop] = useState(false);
  const [showPrestigeInfo, setShowPrestigeInfo] = useState(false);

  // Contextual tips hook for showing help when player is stuck
  const { activeTip, dismissTip } = useContextualTip(gameState);

  const router = useRouter();

  // Prevent staying on home screen when in prison - redirect to work tab
  useEffect(() => {
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [gameState.jailWeeks, router]);

  // Calculate unclaimed challenges
  const getUnclaimedCount = () => {
    if (!gameState.dailyChallenges) return 0;
    const todaysChallenges = generateDailyChallenges({
      weeksLived: gameState.weeksLived,
      day: gameState.day,
    });
    let count = 0;

    if (gameState.dailyChallenges.easy.progress >= todaysChallenges.easy.maxProgress && !gameState.dailyChallenges.easy.claimed) count++;
    if (gameState.dailyChallenges.medium.progress >= todaysChallenges.medium.maxProgress && !gameState.dailyChallenges.medium.claimed) count++;
    if (gameState.dailyChallenges.hard.progress >= todaysChallenges.hard.maxProgress && !gameState.dailyChallenges.hard.claimed) count++;

    return count;
  };

  const unclaimedCount = getUnclaimedCount();

  // Check for goal completion
  useEffect(() => {
    const { completedGoal: newCompletedGoal, nextGoal: newNextGoal } = checkGoalCompletion(gameState as any);

    if (newCompletedGoal && !showGoalCompletion) {
      setCompletedGoal(newCompletedGoal);
      setNextGoal(newNextGoal);
      setShowGoalCompletion(true);

      // Apply reward inside updater to avoid stale closure on gameState.stats
      const reward = newCompletedGoal.reward;
      setGameState(prev => {
        const freshStats = { ...prev.stats };
        switch (reward.type) {
          case 'money':
            freshStats.money += reward.amount;
            break;
          case 'gems':
            freshStats.gems += reward.amount;
            break;
          case 'happiness':
            freshStats.happiness = Math.min(100, freshStats.happiness + reward.amount);
            break;
          case 'energy':
            freshStats.energy = Math.min(100, freshStats.energy + reward.amount);
            break;
          case 'health':
            freshStats.health = Math.min(100, freshStats.health + reward.amount);
            break;
        }
        return {
          ...prev,
          stats: freshStats,
          completedGoals: [...(prev.completedGoals || []), newCompletedGoal.id],
        };
      });
    }
  }, [gameState.stats, gameState.week, gameState.currentJob, gameState.bankSavings, gameState.completedGoals]);

  // Show tutorial for new users (replaces the old WelcomePopup)
  useEffect(() => {
    if (!hasCompletedTutorial && (gameState.weeksLived || 0) <= 1 && gameState.showWelcomePopup) {
      // Dismiss welcome popup immediately to prevent overlap
      dismissWelcomePopup();

      // Small delay to ensure the screen is fully loaded before starting tutorial
      const timer = setTimeout(() => {
        startTutorial(getEnhancedTutorialSteps('game'));
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [hasCompletedTutorial, gameState.week, gameState.showWelcomePopup, startTutorial, dismissWelcomePopup]);

  // Show welcome back popup for returning players (NOT for new players)
  useEffect(() => {
    // Only show for returning players, not new players (week === 1)
    if ((gameState.weeksLived || 0) > 1 && gameState.lastLogin) {
      const lastLogin = gameState.lastLogin || Date.now();
      const hoursAway = (Date.now() - lastLogin) / (1000 * 60 * 60);

      // Show welcome back if away for more than 6 hours and not showing daily reward or tutorial
      if (hoursAway > 6 && !gameState.showDailyRewardPopup && !showWelcomeBack && hasCompletedTutorial) {
        // Delay to show after daily reward if it exists
        const timer = setTimeout(() => {
          setShowWelcomeBack(true);
        }, 500);

        return () => clearTimeout(timer);
      }
    }
  }, [gameState.lastLogin, gameState.weeksLived, gameState.week, gameState.showDailyRewardPopup, showWelcomeBack, hasCompletedTutorial]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={{
          paddingBottom: scale(100) + insets.bottom,
          paddingTop: scale(8),
          paddingHorizontal: responsivePadding.horizontal,
        }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <FadeInUp delay={0}>
          <IdentityCard />
        </FadeInUp>

        {/* Contextual Tips - shown when player is stuck */}
        {activeTip && (
          <ContextualTip
            type={activeTip as 'low_health' | 'low_happiness' | 'low_energy' | 'no_job' | 'low_money' | 'promotion_ready'}
            onDismiss={() => dismissTip(activeTip)}
          />
        )}

        {/* Prestige Button */}
        {gameState.prestigeAvailable && (
          <PrestigeButton onPress={() => setShowPrestigeModal(true)} />
        )}

        {/* Prestige Stats Card - Show if player has prestiged */}
        {gameState.prestige && gameState.prestige.prestigeLevel > 0 && (
          <PrestigeStatsCard
            onPress={() => setShowPrestigeModal(true)}
            onShopPress={() => setShowPrestigeShop(true)}
            onInfoPress={() => setShowPrestigeInfo(true)}
          />
        )}

        {/* Prestige Preview Card - Show if player hasn't prestiged yet */}
        {(!gameState.prestige || gameState.prestige.prestigeLevel === 0) && (
          <PrestigePreviewCard onPress={() => setShowPrestigeModal(true)} />
        )}

        {/* Active Goals Section - Enhanced with parallel goals */}
        <FadeInUp delay={60}>
          <ActiveGoalsCard compact={false} />
        </FadeInUp>

        {/* Legacy Goal Card (fallback) */}
        {/* <NextGoalCard /> */}

        {/* Discovery Progress Indicator */}
        <DiscoveryIndicator
          gameState={gameState}
          compact={false}
          darkMode={isDark}
        />

        <FadeInUp delay={120}>
          <AchievementsProgress />
        </FadeInUp>

        {/* First Week Guide - Tutorial for new players */}
        {(gameState.weeksLived || 0) <= 3 && !hasCompletedTutorial && (
          <View style={{ height: 200 }} />
        )}
      </ScrollView>

      {/* First Week Guide Overlay - Floating at bottom */}
      {gameState.weeksLived <= 3 && !hasCompletedTutorial && (
        <FirstWeekGuide currentWeek={gameState.weeksLived} />
      )}


      <Suspense fallback={null}>
        <GoalCompletionPopup
          visible={showGoalCompletion}
          completedGoal={completedGoal}
          nextGoal={nextGoal}
          onClose={() => setShowGoalCompletion(false)}
          darkMode={isDark}
        />
      </Suspense>
      <Suspense fallback={null}>
        <DailyRewardPopup
          visible={gameState.showDailyRewardPopup || false}
          rewardAmount={gameState.dailyRewardAmount || 0}
          onClose={() => setGameState(prev => ({
            ...prev,
            showDailyRewardPopup: false,
            dailyRewardAmount: undefined,
          }))}
        />
      </Suspense>
      <Suspense fallback={null}>
        <WelcomeBackPopup
          visible={showWelcomeBack}
          onClose={() => {
            setShowWelcomeBack(false);
            // Update lastLogin to prevent popup from showing again
            setGameState(prev => ({
              ...prev,
              lastLogin: Date.now(),
            }));
          }}
        />
      </Suspense>


      {/* Prestige Modals */}
      <PrestigeModal
        visible={showPrestigeModal}
        onClose={() => setShowPrestigeModal(false)}
      />
      <PrestigeShopModal
        visible={showPrestigeShop}
        onClose={() => setShowPrestigeShop(false)}
      />
      <PrestigeInfoModal
        visible={showPrestigeInfo}
        onClose={() => setShowPrestigeInfo(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  scrollContainer: {
    flex: 1,
  },
  infoSection: {
    padding: responsivePadding.large,
  },
  sectionTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: responsiveSpacing.lg,
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    letterSpacing: -0.5,
  },
  statusCard: {
    backgroundColor: '#374151',
    padding: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    marginBottom: responsiveSpacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  statusText: {
    fontSize: responsiveFontSize.lg,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  nextGoalCard: {
    margin: responsiveSpacing.lg,
    marginBottom: responsiveSpacing.md,
    padding: responsiveSpacing.lg,
    backgroundColor: '#1F2937',
    borderRadius: responsiveBorderRadius.xl,
    borderLeftWidth: 4,
    borderLeftColor: '#60A5FA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 0,
  },
  nextGoalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  nextGoalIcon: {
    marginRight: responsiveSpacing.sm,
    // Light mode: subtle icon shadow
    shadowColor: 'rgba(59, 130, 246, 0.2)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
  },
  nextGoalTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#F9FAFB',
    letterSpacing: -0.3,
  },
  nextGoalDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#9CA3AF',
    lineHeight: 22,
    marginBottom: responsiveSpacing.sm,
    fontWeight: '400',
  },
  nextGoalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextGoalProgressText: {
    fontSize: responsiveFontSize.sm,
    color: '#D1D5DB',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextGoalProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#4B5563',
    borderRadius: responsiveBorderRadius.md,
    marginLeft: responsiveSpacing.md,
    overflow: 'hidden',
    shadowColor: 'transparent',
  },
  nextGoalProgressFill: {
    height: '100%',
    backgroundColor: '#60A5FA',
    borderRadius: responsiveBorderRadius.md,
    shadowColor: 'transparent',
  },
  rewardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveSpacing.sm,
    padding: responsiveSpacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: responsiveBorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  rewardText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#D1D5DB',
    marginLeft: responsiveSpacing.xs,
  },
});

export default React.memo(HomeScreen);
