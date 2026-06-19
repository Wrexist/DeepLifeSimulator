import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { track } from '@/lib/analytics';
import { awardLegacyPassXp } from '@/contexts/game/actions/LegacyPassActions';
import { LEGACY_PASS_XP } from '@/lib/legacyPass/legacyPass';
import { Briefcase, ChevronRight } from 'lucide-react-native';
// expo-linear-gradient is a TurboModule that has crashed on iOS 26 — use the safe fallback.
const LinearGradient = LinearGradientFallback;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
import { fontScale, responsivePadding, responsiveSpacing, scale, responsiveBorderRadius, verticalScale } from '@/utils/scaling';
import { checkGoalCompletion, Goal } from '@/utils/goalSystem';
import { ActiveGoalsCard } from '@/components/ActiveGoalsCard';
import { FirstWeekGuide, ContextualTip, useContextualTip } from '@/components/FirstWeekGuide';
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

/**
 * Hero strip — small, refined status line at the very top of the home tab.
 *   MARCH  •  WEEK 3  •  AGE 23
 * The dot before WEEK breathes (opacity 0.45 ↔ 1) to signal "live" without
 * adding visual noise to the rest of the screen.
 */
function HeroStrip({ month, week, age }: { month: string; week: number; age: number }) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.heroRow}>
      <Text style={styles.heroSegment}>{month.toUpperCase()}</Text>
      <View style={styles.heroSeparator} />
      <View style={styles.heroLiveCluster}>
        <Animated.View style={[styles.heroLiveDot, { opacity: pulse }]} />
        <Text style={styles.heroSegment}>WEEK {week}</Text>
      </View>
      <View style={styles.heroSeparator} />
      <Text style={styles.heroSegment}>AGE {age}</Text>
    </View>
  );
}

function HomeScreenContent() {
  const insets = useSafeAreaInsets();
  const { gameState, dismissWelcomePopup, setGameState } = useGame();
  const { theme, isDark } = useTheme();
  const { hasCompletedTutorial, startTutorial } = useTutorial();
  // ENGAGEMENT: Track stat changes for floating indicators on week advance
  useStatChangeTracker(gameState);
  const [showGoalCompletion, setShowGoalCompletion] = useState(false);
  const [completedGoal, setCompletedGoal] = useState<Goal | null>(null);
  const [nextGoal, setNextGoal] = useState<Goal | null>(null);
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

  // Check for goal completion — only re-evaluate on week advance or job change
  useEffect(() => {
    if (showGoalCompletion) return;

    const { completedGoal: newCompletedGoal, nextGoal: newNextGoal } = checkGoalCompletion(gameState);

    if (newCompletedGoal) {
      setCompletedGoal(newCompletedGoal);
      setNextGoal(newNextGoal);
      setShowGoalCompletion(true);

      const reward = newCompletedGoal.reward;
      setGameState(prev => {
        if ((prev.completedGoals || []).includes(newCompletedGoal.id)) return prev;

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
  }, [gameState.weeksLived, gameState.week, gameState.currentJob, gameState.bankSavings, gameState.completedGoals]);

  // Show tutorial for new users
  useEffect(() => {
    if (!hasCompletedTutorial && (gameState.weeksLived || 0) <= 1 && gameState.showWelcomePopup) {
      dismissWelcomePopup();
      const timer = setTimeout(() => {
        startTutorial(getEnhancedTutorialSteps('game'));
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hasCompletedTutorial, gameState.week, gameState.showWelcomePopup, startTutorial, dismissWelcomePopup]);

  // ENGAGEMENT: Daily login reward with streak system
  useEffect(() => {
    if ((gameState.weeksLived || 0) < 1 || !hasCompletedTutorial) return undefined;
    if (gameState.showDailyRewardPopup) return undefined;

    const today = new Date().toISOString().split('T')[0];
    const lastRewardDate = gameState.lastLoginRewardDate;
    if (lastRewardDate === today) return undefined;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DAILY_LOGIN_REWARDS, LOGIN_STREAK_GRACE_HOURS } = require('@/lib/config/gameConstants');
    const currentStreak = gameState.loginStreak || 0;
    const lastLogin = gameState.lastLoginDate;

    let newStreak = 1;
    if (lastLogin) {
      const hoursSinceLast = (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast <= LOGIN_STREAK_GRACE_HOURS) {
        newStreak = currentStreak + 1;
      }
    }

    const rewardIndex = (newStreak - 1) % DAILY_LOGIN_REWARDS.length;
    const gemReward = DAILY_LOGIN_REWARDS[rewardIndex] || 25;

    const timer = setTimeout(() => {
      setGameState(prev => awardLegacyPassXp({
        ...prev,
        showDailyRewardPopup: true,
        dailyRewardAmount: gemReward,
        loginStreak: newStreak,
        lastLoginDate: today,
        lastLoginRewardDate: today,
        stats: {
          ...prev.stats,
          gems: (prev.stats?.gems || 0) + gemReward,
        },
      }, LEGACY_PASS_XP.dailyChallenge));
      track('daily_reward_claimed', { streak: newStreak, gems: gemReward });
    }, 800);

    return () => clearTimeout(timer);
  }, [gameState.weeksLived, gameState.lastLoginRewardDate, hasCompletedTutorial, gameState.showDailyRewardPopup]);

  // Show welcome back popup for returning players
  useEffect(() => {
    if ((gameState.weeksLived || 0) > 1 && gameState.lastLogin) {
      const lastLogin = gameState.lastLogin || Date.now();
      const hoursAway = (Date.now() - lastLogin) / (1000 * 60 * 60);

      if (hoursAway > 6 && !gameState.showDailyRewardPopup && !showWelcomeBack && hasCompletedTutorial) {
        const timer = setTimeout(() => {
          setShowWelcomeBack(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [gameState.lastLogin, gameState.weeksLived, gameState.week, gameState.showDailyRewardPopup, showWelcomeBack, hasCompletedTutorial]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Subtle ambient depth — barely-there gradient washes from indigo at the
          top to nothing past the first card, then a deep shade at the bottom. */}
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.07)', 'rgba(99, 102, 241, 0)']}
        style={styles.topGlow}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(2, 6, 23, 0)', 'rgba(2, 6, 23, 0.55)']}
        style={styles.bottomShade}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={{
          paddingBottom: scale(100) + insets.bottom,
          paddingTop: scale(4),
          paddingHorizontal: responsivePadding.horizontal,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <HeroStrip
          month={gameState.date?.month || 'January'}
          week={gameState.date?.week || 1}
          age={Math.floor(gameState.date?.age ?? 18)}
        />

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

        {/* FTUE: prominent "Find Your First Job" CTA for brand-new players. */}
        {(() => {
          const weeksLived = gameState.weeksLived || 0;
          const hasJob = !!gameState.currentJob;
          const hasDoneStreetJob = (gameState.streetJobsCompleted ?? 0) > 0;
          const isBrandNew = weeksLived <= 5 && !hasJob && !hasDoneStreetJob;
          if (!isBrandNew) return null;
          return (
            <FadeInUp delay={30}>
              <TouchableOpacity
                style={styles.findJobCta}
                onPress={() => router.push('/(tabs)/work')}
                activeOpacity={0.85}
              >
                <View style={styles.findJobIconBubble}>
                  <Briefcase size={scale(20)} color="#34D399" />
                </View>
                <View style={styles.findJobTextWrap}>
                  <Text style={styles.findJobTitle}>Find your first job</Text>
                  <Text style={styles.findJobSubtitle}>
                    Street jobs pay 2–4× more than entry careers.
                  </Text>
                </View>
                <ChevronRight size={scale(16)} color="rgba(52, 211, 153, 0.85)" />
              </TouchableOpacity>
            </FadeInUp>
          );
        })()}

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

        {/* Prestige Preview Card - hidden in the first 5 weeks. */}
        {(!gameState.prestige || gameState.prestige.prestigeLevel === 0) &&
          (gameState.weeksLived || 0) > 5 && (
          <PrestigePreviewCard onPress={() => setShowPrestigeModal(true)} />
        )}

        {/* Active Goals Section */}
        <FadeInUp delay={60}>
          <ActiveGoalsCard compact={false} />
        </FadeInUp>

        {/* Discovery Progress Indicator. Hidden in the first few weeks. */}
        {(gameState.weeksLived || 0) > 5 && (
          <DiscoveryIndicator
            gameState={gameState}
            compact={false}
            darkMode={isDark}
          />
        )}

        <FadeInUp delay={120}>
          <AchievementsProgress />
        </FadeInUp>

        {/* First Week Guide — leave space so the overlay doesn't clip cards. */}
        {(gameState.weeksLived || 0) <= 3 && !hasCompletedTutorial && (
          <View style={{ height: 200 }} />
        )}
      </ScrollView>

      {/* First Week Guide Overlay - Floating at bottom */}
      {(gameState.weeksLived ?? 0) <= 3 && !hasCompletedTutorial && (
        <FirstWeekGuide currentWeek={gameState.weeksLived ?? 0} />
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
            setGameState(prev => ({ ...prev, lastLogin: Date.now() }));
          }}
        />
      </Suspense>

      {/* Prestige Modals */}
      <PrestigeModal visible={showPrestigeModal} onClose={() => setShowPrestigeModal(false)} />
      <PrestigeShopModal visible={showPrestigeShop} onClose={() => setShowPrestigeShop(false)} />
      <PrestigeInfoModal visible={showPrestigeInfo} onClose={() => setShowPrestigeInfo(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scrollContainer: {
    flex: 1,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: scale(220),
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: scale(200),
  },

  // Hero strip ---------------------------------------------------------------
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(8),
    marginBottom: verticalScale(8),
    gap: scale(10),
  },
  heroSegment: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(226, 232, 240, 0.62)',
    fontVariant: ['tabular-nums'],
  },
  heroSeparator: {
    width: scale(3),
    height: scale(3),
    borderRadius: scale(1.5),
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  heroLiveCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  heroLiveDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(3),
    backgroundColor: '#34D399',
  },

  // Find-job CTA — premium glass, neutral border, accent only on the icon
  findJobCta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: verticalScale(6),
    padding: responsiveSpacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: scale(12),
  },
  findJobIconBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  findJobTextWrap: {
    flex: 1,
  },
  findJobTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  findJobSubtitle: {
    fontSize: fontScale(12),
    color: 'rgba(226, 232, 240, 0.65)',
    lineHeight: fontScale(17),
  },
});

export default React.memo(HomeScreen);
