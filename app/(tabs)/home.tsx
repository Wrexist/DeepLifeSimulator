import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Animated, Easing, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { track } from '@/lib/analytics';
import { awardLegacyPassXp } from '@/contexts/game/actions/LegacyPassActions';
import { LEGACY_PASS_XP } from '@/lib/legacyPass/legacyPass';
import { Briefcase, ChevronRight, Trophy, ChevronDown, ChevronUp } from 'lucide-react-native';
// expo-linear-gradient is a TurboModule that has crashed on iOS 26 — use the safe fallback.
const LinearGradient = LinearGradientFallback;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameActions, useItemActions } from '@/contexts/GameContext';
import { useGameSelector, useSetGameState, shallowEqual } from '@/contexts/game/useGameSelector';
import type { GameState } from '@/contexts/game/types';
import { useTutorial } from '@/contexts/UIUXContext';
import AchievementsSummaryCard from '@/components/AchievementsSummaryCard';
import BannerAd from '@/components/BannerAd';
import AchievementsModal from '@/components/AchievementsModal';
import IdentityCard from '@/components/IdentityCard';
import LastWeekRecap from '@/components/LastWeekRecap';
import PrestigeButton from '@/components/PrestigeButton';
import PrestigeStatsCard from '@/components/PrestigeStatsCard';
import PrestigePreviewCard from '@/components/PrestigePreviewCard';
import PrestigeModal from '@/components/PrestigeModal';
import PrestigeShopModal from '@/components/PrestigeShopModal';
import PrestigeInfoModal from '@/components/PrestigeInfoModal';
import { getEnhancedTutorialSteps } from '@/utils/enhancedTutorialData';
import { fontScale, responsivePadding, responsiveSpacing, scale, responsiveBorderRadius, verticalScale } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { checkGoalCompletion, Goal } from '@/utils/goalSystem';
import { ActiveGoalsCard } from '@/components/ActiveGoalsCard';
import LifeChapterCard from '@/components/LifeChapterCard';
import AmbitionCard from '@/components/AmbitionCard';
import ElderCard from '@/components/ElderCard';
import { FirstWeekGuide, ContextualTip, useContextualTip } from '@/components/FirstWeekGuide';
import DiscoveryIndicator from '@/components/depth/DiscoveryIndicator';
import ErrorBoundary from '@/components/ErrorBoundary';
import FadeInUp from '@/components/anim/FadeInUp';
import { useTheme } from '@/hooks/useTheme';
import { useStatChangeTracker } from '@/contexts/StatChangeContext';
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { DISCORD_URL } from '@/lib/config/appConfig';
import { DISCORD_JOIN_REWARD_MONEY, MS_PER_DAY } from '@/lib/config/gameConstants';
import { computeWelcomeBackBonus } from '@/utils/welcomeBackBonus';

// Lazy load heavy modals and popups
const DailyRewardPopup = lazy(() => import('@/components/DailyRewardPopup'));
const WelcomeBackPopup = lazy(() => import('@/components/WelcomeBackPopup'));
const GoalCompletionPopup = lazy(() => import('@/components/GoalCompletionPopup'));
const CommunityRewardPopup = lazy(() => import('@/components/CommunityRewardPopup'));

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
  // Sprint 2 perf: subscribe only to the slices this screen (and its goal /
  // tip / discovery / stat-change consumers) read — not the whole gameState —
  // so the dashboard subtree stops re-rendering on every decay tick. Actions
  // come from the action contexts, whose values are stable (no state sub).
  const gameState = useGameSelector(
    (s) => ({
      stats: s?.stats,
      careers: s?.careers,
      currentJob: s?.currentJob,
      bankSavings: s?.bankSavings,
      completedGoals: s?.completedGoals,
      weeksLived: s?.weeksLived,
      week: s?.week,
      jailWeeks: s?.jailWeeks,
      date: s?.date,
      showWelcomePopup: s?.showWelcomePopup,
      showDeathPopup: s?.showDeathPopup,
      showWeddingPopup: s?.showWeddingPopup,
      showDailyRewardPopup: s?.showDailyRewardPopup,
      dailyRewardAmount: s?.dailyRewardAmount,
      lastLoginRewardDate: s?.lastLoginRewardDate,
      loginStreak: s?.loginStreak,
      lastLoginDate: s?.lastLoginDate,
      lastLogin: s?.lastLogin,
      streetJobsCompleted: s?.streetJobsCompleted,
      prestigeAvailable: s?.prestigeAvailable,
      prestige: s?.prestige,
      discoveredSystems: s?.discoveredSystems,
    }),
    shallowEqual
  ) as unknown as GameState;
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const { dismissWelcomePopup } = useItemActions();
  const { theme, isDark } = useTheme();
  const { hasCompletedTutorial, startTutorial } = useTutorial();
  // ENGAGEMENT: Track stat changes for floating indicators on week advance
  useStatChangeTracker(gameState);
  const [showGoalCompletion, setShowGoalCompletion] = useState(false);
  const [completedGoal, setCompletedGoal] = useState<Goal | null>(null);
  const [nextGoal, setNextGoal] = useState<Goal | null>(null);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showCommunityReward, setShowCommunityReward] = useState(false);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showPrestigeShop, setShowPrestigeShop] = useState(false);
  const [showPrestigeInfo, setShowPrestigeInfo] = useState(false);
  // Collapses the secondary tail of the home feed so it doesn't grow unbounded.
  const [showMore, setShowMore] = useState(false);

  // Root-level blocking modals (death/wedding) own the screen — every
  // celebration/reward popup below defers to them.
  const blockingModalUp = !!(gameState.showDeathPopup || gameState.showWeddingPopup);

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
      // The persist happens in the committed-marker effect below — NOT here.
      // saveGame reads gameStateRef.current, which is synced to state in a
      // POST-COMMIT effect (in GameActionsProvider), so calling saveGame() in
      // this same tick would persist the PRE-grant state and let a force-kill
      // within ~2 min re-claim the reward. Keying the save on the committed
      // lastLoginRewardDate guarantees the post-grant state is what hits disk.
    }, 800);

    return () => clearTimeout(timer);
  }, [
    gameState.weeksLived,
    gameState.lastLoginRewardDate,
    gameState.loginStreak,
    gameState.lastLoginDate,
    gameState.showDailyRewardPopup,
    hasCompletedTutorial,
    setGameState,
  ]);

  // Persist AFTER the daily-reward grant commits. This effect fires only when
  // `lastLoginRewardDate` actually transitions to a new value (the grant above
  // stamps today's date), never on initial mount — the ref is seeded with the
  // value from first render, so mount sees `ref === current` and no-ops.
  //
  // The save is deferred to a macrotask: gameStateRef is synced in a
  // post-commit effect that lives in the *parent* GameActionsProvider, and
  // React fires passive effects child-before-parent — so at the instant this
  // (child) effect runs, the parent's ref sync for this commit has NOT run yet.
  // setTimeout(0) lets the whole passive-effect flush (including that ref sync)
  // complete first, so saveGame reads the committed post-grant state.
  //
  // No save loop: saveGame never mutates lastLoginRewardDate, so persisting
  // can't re-trigger this effect.
  const persistedRewardDateRef = useRef(gameState.lastLoginRewardDate);
  useEffect(() => {
    if (persistedRewardDateRef.current === gameState.lastLoginRewardDate) return undefined;
    persistedRewardDateRef.current = gameState.lastLoginRewardDate;
    const id = setTimeout(() => {
      void saveGame?.(false);
    }, 0);
    return () => clearTimeout(id);
  }, [gameState.lastLoginRewardDate, saveGame]);

  // Show welcome back popup for returning players
  useEffect(() => {
    if ((gameState.weeksLived || 0) > 1 && gameState.lastLogin) {
      const lastLogin = gameState.lastLogin || Date.now();
      const hoursAway = (Date.now() - lastLogin) / (1000 * 60 * 60);

      // Only after a genuine day-plus away. `lastLogin` is reset to now on
      // close, so this naturally fires at most once per ~24h absence — which
      // also gates the cash bonus granted on close (no grindable faucet).
      if (hoursAway > 24 && !gameState.showDailyRewardPopup && !showWelcomeBack && hasCompletedTutorial) {
        const timer = setTimeout(() => {
          setShowWelcomeBack(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [gameState.lastLogin, gameState.weeksLived, gameState.week, gameState.showDailyRewardPopup, showWelcomeBack, hasCompletedTutorial]);

  // ENGAGEMENT: one-time, low-key invite to join the Discord for a cash reward.
  // Subtle by design — only once the player is settled in (tutorial done + a few
  // weeks lived), never stacked on the daily-reward / welcome-back popups, and
  // suppressed forever once claimed (shared `discord_reward_claimed` flag) or
  // dismissed (`discord_popup_seen`). The Settings entry stays as the fallback.
  useEffect(() => {
    if (!hasCompletedTutorial) return undefined;
    if ((gameState.weeksLived || 0) < 4) return undefined;
    if (gameState.showDailyRewardPopup || showWelcomeBack || showCommunityReward) return undefined;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const [claimed, seen] = await Promise.all([
          safeGetItem('discord_reward_claimed'),
          safeGetItem('discord_popup_seen'),
        ]);
        if (cancelled || claimed === 'true' || seen === 'true') return;
        // Brief delay so it eases in after the screen settles, not on load.
        timer = setTimeout(() => {
          if (!cancelled) setShowCommunityReward(true);
        }, 1400);
      } catch {
        // Non-critical: the popup simply won't show this session.
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hasCompletedTutorial, gameState.weeksLived, gameState.showDailyRewardPopup, showWelcomeBack, showCommunityReward]);

  const handleJoinCommunity = async () => {
    // Grant the cash reward (updateMoney clamps to the money ceiling + logs it).
    updateMoney(setGameState, DISCORD_JOIN_REWARD_MONEY, 'Discord community reward');
    setShowCommunityReward(false);
    // Persist the one-time flags. `discord_reward_claimed` is shared with the
    // Settings entry point so the reward can't be taken twice.
    try {
      await safeSetItem('discord_reward_claimed', 'true');
      await safeSetItem('discord_popup_seen', 'true');
    } catch {
      // Non-critical: money is already granted; the flag can retry next session.
    }
    // Open the Discord invite.
    try {
      const canOpen = await Linking.canOpenURL(DISCORD_URL);
      if (canOpen) await Linking.openURL(DISCORD_URL);
    } catch {
      // Ignore — the reward has already been granted regardless of the link.
    }
  };

  const handleDismissCommunity = async () => {
    setShowCommunityReward(false);
    try {
      await safeSetItem('discord_popup_seen', 'true');
    } catch {
      // Non-critical: may re-show next session if this write fails.
    }
  };

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

        {/* Non-blocking weekly recap — restores the sense of progress that the
            (removed) weekly event pop-ups used to provide, without interrupting. */}
        <FadeInUp delay={20}>
          <LastWeekRecap />
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

        {/* Prestige Preview Card — held back until the player is actually
            established (week 20+ AND some net worth), so early game isn't
            upsold a system it can't use yet. */}
        {(!gameState.prestige || gameState.prestige.prestigeLevel === 0) &&
          (gameState.weeksLived || 0) > 20 &&
          (((gameState.stats?.money ?? 0) + (gameState.bankSavings ?? 0)) > 25000) && (
          <PrestigePreviewCard onPress={() => setShowPrestigeModal(true)} />
        )}

        {/* Life Chapter — the chunked-goal spine (was built but had no UI). */}
        <FadeInUp delay={50}>
          <LifeChapterCard />
        </FadeInUp>

        {/* Life Ambition — the lifelong goal chosen at character creation.
            Renders only when an ambition was picked (freeform lives skip it). */}
        <FadeInUp delay={55}>
          <AmbitionCard />
        </FadeInUp>

        {/* Retirement / Elder chapter — retire, pension, elder activities, legacy.
            Renders only when eligible to retire, elderly, or retired. */}
        <FadeInUp delay={57}>
          <ElderCard />
        </FadeInUp>

        {/* Active Goals Section */}
        <FadeInUp delay={60}>
          <ActiveGoalsCard compact={false} />
        </FadeInUp>

        {/* NAV: the Progression screen (prestige, Legacy Pass, life story,
            skill tree, lifetime stats) was hidden from the tab bar with no
            other entry point — this card is its front door. Always visible. */}
        <FadeInUp delay={110}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/progression')}
            activeOpacity={0.85}
            style={styles.progressLinkCard}
          >
            <View style={styles.progressLinkIcon}>
              <Trophy size={scale(20)} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressLinkTitle}>Your Progress</Text>
              <Text style={styles.progressLinkSub}>
                Prestige, Legacy Pass, life story & lifetime stats
              </Text>
            </View>
            <ChevronRight size={scale(18)} color="#94A3B8" />
          </TouchableOpacity>
        </FadeInUp>

        {/* Secondary detail modules collapse behind "Show more" so the feed
            doesn't grow unbounded on an established save. */}
        {showMore && (
          <>
            {(gameState.weeksLived || 0) > 5 && (
              <DiscoveryIndicator
                gameState={gameState}
                compact={false}
                darkMode={isDark}
              />
            )}
            <FadeInUp delay={0}>
              <AchievementsSummaryCard onViewAll={() => setShowAchievements(true)} />
            </FadeInUp>
          </>
        )}

        <TouchableOpacity
          onPress={() => setShowMore(v => !v)}
          activeOpacity={0.8}
          style={styles.showMoreBtn}
          accessibilityRole="button"
        >
          <Text style={styles.showMoreText}>{showMore ? 'Show less' : 'Show more'}</Text>
          {showMore
            ? <ChevronUp size={scale(15)} color="#94A3B8" />
            : <ChevronDown size={scale(15)} color="#94A3B8" />}
        </TouchableOpacity>

        {/* First Week Guide — leave space so the overlay doesn't clip cards. */}
        {(gameState.weeksLived || 0) <= 3 && !hasCompletedTutorial && (
          <View style={{ height: 200 }} />
        )}

        {/* Banner ad at the end of the scroll content — non-obscuring (scrolls
            with content, never overlaps the tab bar). Self-gating: BannerAd
            renders nothing unless the AdMob SDK is configured and the player
            hasn't bought Remove Ads / Lifetime Premium. */}
        <BannerAd style={{ marginTop: scale(12) }} />
      </ScrollView>

      {/* First Week Guide Overlay - Floating at bottom */}
      {(gameState.weeksLived ?? 0) <= 3 && !hasCompletedTutorial && (
        <FirstWeekGuide currentWeek={gameState.weeksLived ?? 0} />
      )}

      {/* NOISE: light popup coordination. The root layout owns blocking modals
          (death/wedding) — no celebration/reward popup may present on top of
          them. Within this screen, popups present strictly one at a time in
          priority order (goal > daily reward > welcome back > community)
          instead of whichever setTimeout won the race. */}
      <Suspense fallback={null}>
        <GoalCompletionPopup
          visible={showGoalCompletion && !blockingModalUp}
          completedGoal={completedGoal}
          nextGoal={nextGoal}
          onClose={() => setShowGoalCompletion(false)}
          darkMode={isDark}
        />
      </Suspense>
      <Suspense fallback={null}>
        <DailyRewardPopup
          visible={(gameState.showDailyRewardPopup || false) && !blockingModalUp && !showGoalCompletion}
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
          visible={showWelcomeBack && !blockingModalUp && !showGoalCompletion && !gameState.showDailyRewardPopup}
          onClose={() => {
            setShowWelcomeBack(false);
            // Actually GRANT the welcome-back bonus the popup advertised (it was
            // previously only displayed, never credited). Atomic single updater:
            // compute from the OLD lastLogin, then stamp lastLogin=now so the
            // popup (and bonus) can't re-fire until another ~24h away.
            setGameState(prev => {
              const last = prev.lastLogin || Date.now();
              const daysAway = Math.floor((Date.now() - last) / MS_PER_DAY);
              const bonus = computeWelcomeBackBonus(prev, daysAway);
              return {
                ...prev,
                lastLogin: Date.now(),
                stats: { ...prev.stats, money: (prev.stats?.money || 0) + bonus },
              };
            });
          }}
        />
      </Suspense>
      <Suspense fallback={null}>
        <CommunityRewardPopup
          visible={showCommunityReward && !blockingModalUp && !showGoalCompletion && !gameState.showDailyRewardPopup && !showWelcomeBack}
          rewardAmount={DISCORD_JOIN_REWARD_MONEY}
          onJoin={handleJoinCommunity}
          onDismiss={handleDismissCommunity}
        />
      </Suspense>

      {/* Prestige Modals */}
      <PrestigeModal visible={showPrestigeModal} onClose={() => setShowPrestigeModal(false)} />
      <PrestigeShopModal visible={showPrestigeShop} onClose={() => setShowPrestigeShop(false)} />
      <PrestigeInfoModal visible={showPrestigeInfo} onClose={() => setShowPrestigeInfo(false)} />
      <AchievementsModal visible={showAchievements} onClose={() => setShowAchievements(false)} />

    </View>
  );
}

const styles = StyleSheet.create({
  progressLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginHorizontal: responsivePadding.horizontal,
    marginBottom: verticalScale(12),
    padding: scale(14),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  progressLinkIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  progressLinkTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#F8FAFC',
  },
  progressLinkSub: {
    fontSize: fontScale(11.5),
    color: '#94A3B8',
    marginTop: scale(2),
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    alignSelf: 'center',
    marginTop: verticalScale(4),
    marginBottom: verticalScale(8),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(16),
  },
  showMoreText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#94A3B8',
  },
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
    ...getPlatformShadows(6, 0.25, 4, 14),
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
