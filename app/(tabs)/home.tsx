import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Alert, Animated, Easing, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { track } from '@/lib/analytics';
import { awardLegacyPassXp } from '@/contexts/game/actions/LegacyPassActions';
import { canClaimDailyGemsFor } from '@/contexts/game/actions/SubscriptionActions';
import { LEGACY_PASS_XP } from '@/lib/legacyPass/legacyPass';
import { Briefcase, ChevronRight, Trophy, ChevronDown, ChevronUp, Lock } from 'lucide-react-native';
import { logger } from '@/utils/logger';
import { reconcileRedeemClaim, applyRedeemReward } from '@/utils/redeemCodes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNavigationReady } from '@/hooks/useNavigationReady';
import { useGameActions, useItemActions } from '@/contexts/GameContext';
import { useGameSelector, useSetGameState, shallowEqual } from '@/contexts/game/useGameSelector';
import type { GameState } from '@/contexts/game/types';
import { useTutorial } from '@/contexts/UIUXContext';
import AchievementsSummaryCard from '@/components/AchievementsSummaryCard';
import BannerAd from '@/components/BannerAd';
import AchievementsModal from '@/components/AchievementsModal';
import IdentityCard from '@/components/IdentityCard';
import PremiumCrownButton from '@/components/PremiumCrownButton';
import LastWeekRecap from '@/components/LastWeekRecap';
import PrestigeButton from '@/components/PrestigeButton';
import { isPrestigeAvailable } from '@/lib/prestige/prestigeTypes';
import PrestigeStatsCard from '@/components/PrestigeStatsCard';
import PrestigePreviewCard from '@/components/PrestigePreviewCard';
import PrestigeModal from '@/components/PrestigeModal';
import PrestigeShopModal from '@/components/PrestigeShopModal';
import PrestigeInfoModal from '@/components/PrestigeInfoModal';
import { getEnhancedTutorialSteps } from '@/utils/enhancedTutorialData';
import { fontScale, responsivePadding, responsiveSpacing, scale, responsiveBorderRadius, verticalScale } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import LifeChapterCard from '@/components/LifeChapterCard';
import AmbitionCard from '@/components/AmbitionCard';
import WeeklyChallengeCard from '@/components/WeeklyChallengeCard';
import AmbitionPickerCard from '@/components/AmbitionPickerCard';
import ElderCard from '@/components/ElderCard';
import { FirstWeekGuide, ContextualTip, useContextualTip } from '@/components/FirstWeekGuide';
import FirstSessionCoach from '@/components/FirstSessionCoach';
import DiscoveryIndicator from '@/components/depth/DiscoveryIndicator';
import ErrorBoundary from '@/components/ErrorBoundary';
import FadeInUp from '@/components/anim/FadeInUp';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useStatChangeTracker } from '@/contexts/StatChangeContext';
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import {
  readDiscordClaim,
  beginDiscordClaim,
  finalizeDiscordClaim,
  applyDiscordRewardGrant,
} from '@/utils/discordRewardClaim';
import { DISCORD_URL } from '@/lib/config/appConfig';
import { discordJoinRewardMoney } from '@/lib/config/gameConstants';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { applyWelcomeBackBonus, welcomeBackClaimed } from '@/utils/welcomeBackBonus';
import { isFeatureUnlocked, unlockRequirement } from '@/lib/progress/featureUnlocks';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';
import { useInterruptionSlot, INTERRUPTION_PRIORITY } from '@/contexts/InterruptionContext';

// Lazy load heavy modals and popups
const DailyRewardPopup = lazy(() => import('@/components/DailyRewardPopup'));
const WelcomeBackPopup = lazy(() => import('@/components/WelcomeBackPopup'));
const CommunityRewardPopup = lazy(() => import('@/components/CommunityRewardPopup'));

// Stable empty array so the redeemedCodeHashes selector doesn't churn renders
// when a save has no redeemed codes (the common case).
const EMPTY_REDEEMED_HASHES: string[] = [];

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
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (reduced) {
      // Reduced motion: hold the "live" dot at full opacity — no breathing loop.
      pulse.setValue(1);
      return;
    }
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
  }, [pulse, reduced]);

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
      weeksLived: s?.weeksLived,
      // The v43 baseline that turns the absolute `weeksLived` into "weeks into
      // this life". Required by `weeksInThisLife` below AND by `unlockTier`;
      // omitting it silently degrades every gate on this screen back to the
      // absolute counter, which is the bug being fixed. CLAUDE.md §4.2.
      lifeStartWeek: s?.lifeStartWeek,
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
      // Required by unlockTier() for the Progress card's gate. Without these
      // the chapter path scores 0 and only the money/weeks fallback applies,
      // so a chapter-completing player would see a lock the Life tab does not
      // — the same inconsistency this gate exists to remove, inverted.
      completedChapters: s?.completedChapters,
      generationNumber: s?.generationNumber,
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

  // The Progress screen is `href: null` (never a tab button), so this card is
  // its front door — and must apply the same tier gate the Life tab's Stats
  // segment does. See the card below.
  const progressLocked = !isFeatureUnlocked(gameState, 'tab:progression');
  const progressLockReason = unlockRequirement(gameState, 'tab:progression');

  // Interruption slots. These popups used to gate on a hand-rolled chain of
  // `&&` terms that grew with every popup added — and could not see the weekly
  // result sheet, the premium promo or the ad orb, which live in other files.
  // Now every interrupting surface in the app competes in ONE priority queue and
  // exactly one wins. Death/wedding still short-circuit locally: they are
  // root-level modals that gate their own dismissal.
  const dailyRewardSlot = useInterruptionSlot(
    'home:daily-reward',
    INTERRUPTION_PRIORITY.DAILY_REWARD,
    !!gameState.showDailyRewardPopup && !blockingModalUp
  );
  const welcomeBackSlot = useInterruptionSlot(
    'home:welcome-back',
    INTERRUPTION_PRIORITY.WELCOME_BACK,
    showWelcomeBack && !blockingModalUp
  );
  const communitySlot = useInterruptionSlot(
    'home:community-reward',
    INTERRUPTION_PRIORITY.COMMUNITY_REWARD,
    showCommunityReward && !blockingModalUp
  );

  // Contextual tips hook for showing help when player is stuck
  const { activeTip, dismissTip } = useContextualTip(gameState);

  // Every "how far into the game is this player" gate on this screen measures
  // weeks in THIS LIFE, never the raw `weeksLived`, which is seeded from the
  // starting age ((age - 18) * 52) and so is already 364 on frame one for an
  // age-25 scenario. Before this, every first-session affordance below was
  // resolved wrong for every scenario that does not start at 18: the tutorial
  // and the First Week Guide (`<= 1` / `<= 3`) never appeared at all, while the
  // "settled in" surfaces (`> 4`, `> 5`, `> 20`) appeared immediately.
  // CLAUDE.md §4.2.
  const weeksThisLife = weeksInThisLife(gameState);

  const router = useRouter();
  // Redirects that run on this screen's first commit throw "Attempted to
  // navigate before mounting the Root Layout component" when this screen IS
  // the entry route (restored URL / deep link), which surfaces as the crash
  // screen. See hooks/useNavigationReady.ts.
  const navReady = useNavigationReady();

  // Prevent staying on home screen when in prison - redirect to work tab
  useEffect(() => {
    if (!navReady) return;
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [navReady, gameState.jailWeeks, router]);

  // REMOVED: the linear goal system (`utils/goalSystem.ts` +
  // `GoalCompletionPopup`). `checkGoalCompletion` ran here every week and could
  // never fire: in `getNextGoal` each goal's `shouldShow` predicate was the exact
  // negation of its completion predicate, so a goal was only ever OFFERED while
  // it was incomplete and vanished the instant it completed. All six were
  // affected — e.g. `earn_100` showed only while `money < 200` but completed at
  // `money >= 200`; `get_job` was offered only while `!currentJob`, which pinned
  // its `current` at 0. Zero states in the whole predicate space were completable,
  // so the popup, the rewards and `completedGoals` were unreachable code.
  // Life Chapters (`LifeChapterCard` + `applyChapterProgress`) are the real
  // progression ladder and are paid by the week tick.

  // Show tutorial for new users
  useEffect(() => {
    if (!hasCompletedTutorial && weeksThisLife <= 1 && gameState.showWelcomePopup) {
      dismissWelcomePopup();
      const timer = setTimeout(() => {
        startTutorial(getEnhancedTutorialSteps('game'));
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hasCompletedTutorial, weeksThisLife, gameState.week, gameState.showWelcomePopup, startTutorial, dismissWelcomePopup]);

  // ENGAGEMENT: Daily login reward with streak system
  useEffect(() => {
    if (weeksThisLife < 1 || !hasCompletedTutorial) return undefined;
    if (gameState.showDailyRewardPopup) return undefined;

    // FARMABLE ON THE DEVICE CLOCK. The only gate here was
    // `lastRewardDate === today`, a raw string compare against a device-clock
    // day key — so moving the date to ANY other day, forward or back, re-armed
    // the claim. Repeat indefinitely: DAILY_LOGIN_REWARDS cycles 25→500 and the
    // 48h streak grace keeps the streak climbing, so ~157 gems per clock change
    // on the premium currency that is otherwise sold as an IAP.
    //
    // Reuse `canClaimDailyGemsFor`, the guard the OTHER daily gem faucet in this
    // app already uses (SubscriptionActions), rather than writing a second one:
    // strictly-increasing day keys (never the current or an earlier day) plus an
    // epoch high-water mark that refuses a clock rewound below the last claim.
    // 2026-07-30 audit ECON-1.
    const today = new Date().toISOString().split('T')[0];
    const nowMs = Date.now();
    // The game-week gate is what actually closes this. The two clock guards
    // only refuse a REWOUND clock; advancing the device date a day at a time
    // passed both, and the 48h streak grace kept the streak climbing, so the
    // 25→500 cycle was farmable forever on premium currency. `weeksLived` is
    // the one clock a scrubber cannot move — it advances only by playing.
    const weekGate = {
      current: gameState.weeksLived,
      lastClaim: gameState.lastLoginRewardWeek,
    };
    if (!canClaimDailyGemsFor(gameState.lastLoginRewardDate, gameState.lastLoginRewardAt, today, nowMs, weekGate)) {
      return undefined;
    }

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
      setGameState(prev => {
        // Re-check against `prev`, not the effect's captured snapshot. The gate
        // above ran at render time; without this, two effect runs in one React
        // batch would both pass it and both credit gems — the gate-then-grant
        // shape CLAUDE.md 4.4 exists to stop.
        if (!canClaimDailyGemsFor(prev.lastLoginRewardDate, prev.lastLoginRewardAt, today, nowMs, {
          current: prev.weeksLived,
          lastClaim: prev.lastLoginRewardWeek,
        })) {
          return prev;
        }
        return awardLegacyPassXp({
          ...prev,
          showDailyRewardPopup: true,
          dailyRewardAmount: gemReward,
          loginStreak: newStreak,
          lastLoginDate: today,
          lastLoginRewardDate: today,
          lastLoginRewardAt: nowMs,
          // Stamped in the SAME updater as the gem credit, so the marker and the
          // grant are always persisted together.
          lastLoginRewardWeek: prev.weeksLived,
          stats: {
            ...prev.stats,
            gems: (prev.stats?.gems || 0) + gemReward,
          },
        }, LEGACY_PASS_XP.dailyChallenge);
      });
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
    weeksThisLife,
    gameState.lastLoginRewardDate,
    gameState.lastLoginRewardAt,
    gameState.lastLoginRewardWeek,
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

  // v44: the game-week marker gating the welcome-back cash bonus. Selected on
  // its own (a primitive) rather than pulling `settings` into the slice above,
  // which would re-render this screen on every unrelated settings mutation.
  const lastWelcomeBackWeek = useGameSelector((s) => s?.settings?.lastWelcomeBackWeek);

  // Show welcome back popup for returning players
  useEffect(() => {
    if (weeksThisLife > 1 && gameState.lastLogin) {
      const lastLogin = gameState.lastLogin || Date.now();
      const hoursAway = (Date.now() - lastLogin) / (1000 * 60 * 60);

      // Only after a genuine day-plus away. `lastLogin` is reset to now on
      // close, so this naturally fires at most once per ~24h absence — which
      // also gates the cash bonus granted on close (no grindable faucet).
      //
      // `welcomeBackClaimed` mirrors the inner rejection in
      // `applyWelcomeBackBonus` (the AdRewardOrb spawner pattern, v35): once the
      // bonus has been paid in this `weeksLived`, the popup is not offered at
      // all, so the player never sees one that would credit nothing.
      if (
        hoursAway > 24 &&
        !welcomeBackClaimed({ settings: { lastWelcomeBackWeek }, weeksLived: gameState.weeksLived }) &&
        !gameState.showDailyRewardPopup &&
        !showWelcomeBack &&
        hasCompletedTutorial
      ) {
        const timer = setTimeout(() => {
          setShowWelcomeBack(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [gameState.lastLogin, weeksThisLife, gameState.week, gameState.weeksLived, lastWelcomeBackWeek, gameState.showDailyRewardPopup, showWelcomeBack, hasCompletedTutorial]);

  // ENGAGEMENT: one-time, low-key invite to join the Discord for a cash reward.
  // Subtle by design — only once the player is settled in (tutorial done + a few
  // weeks lived), never stacked on the daily-reward / welcome-back popups, and
  // suppressed forever once claimed (shared `discord_reward_claimed` flag) or
  // dismissed (`discord_popup_seen`). The Settings entry stays as the fallback.
  useEffect(() => {
    if (!hasCompletedTutorial) return undefined;
    if (weeksThisLife < 4) return undefined;
    if (gameState.showDailyRewardPopup || showWelcomeBack || showCommunityReward) return undefined;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const [claim, seen] = await Promise.all([
          readDiscordClaim(),
          safeGetItem('discord_popup_seen'),
        ]);
        // Treat BOTH 'finalized' AND a pending (in-flight) claim as claimed — a
        // claim already begun must never re-surface the invite.
        if (cancelled || claim !== 'unclaimed' || seen === 'true') return;
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
  }, [hasCompletedTutorial, weeksThisLife, gameState.showDailyRewardPopup, showWelcomeBack, showCommunityReward]);

  // FINDING 1: derive the reward from the FULL state's net worth, not home's
  // PROJECTED selector slice (which omits properties, companies, stocks, vehicles
  // & crypto, so it understates net worth for wealthy players — home would grant
  // LESS than Settings for the identical reward). Select the scalar so the screen
  // re-renders only when the amount actually changes.
  const communityNetWorth = useGameSelector((s) => calculateNetWorth(s as GameState));
  const communityRewardAmount = useMemo(
    () => discordJoinRewardMoney(communityNetWorth),
    [communityNetWorth]
  );

  // Loaded-state grant flag (from FULL state), read by the reconciler to tell a
  // "grant not yet saved" crash from a "saved, just needs finalizing" one. Kept
  // in a ref so the once-on-mount reconciler always sees the latest committed value.
  const communityRewardGranted = useGameSelector((s) => s.discordRewardGranted === true);
  const communityRewardGrantedRef = useRef(communityRewardGranted);
  communityRewardGrantedRef.current = communityRewardGranted;

  // Committed redeem-code hashes (from FULL state), read by the redeem reconciler
  // via a ref to tell "grant not yet saved" from "saved, just needs finalizing".
  const redeemedCodeHashes = useGameSelector(
    (s) => s.redeemedCodeHashes ?? EMPTY_REDEEMED_HASHES,
    shallowEqual,
  );
  const redeemedCodeHashesRef = useRef(redeemedCodeHashes);
  redeemedCodeHashesRef.current = redeemedCodeHashes;

  // Discord reward reconciler — SINGLE OWNER (home is the always-mounted tab;
  // Settings is transient and can unmount mid-claim, so it cannot own recovery).
  // Completes, exactly once, any claim a force-kill interrupted. Ungated by
  // tutorial / weeksLived: a Settings claim can begin at any point, so recovery
  // must run regardless. Kill-point walkthrough (all exactly-once):
  //   - kill BEFORE begin              -> no marker; readDiscordClaim='unclaimed' -> no-op.
  //   - kill AFTER begin, before grant -> marker pending, flag FALSE -> grant the
  //                                       frozen amount, save, finalize.
  //   - kill AFTER grant+save, before finalize -> marker pending, flag TRUE (money
  //                                       already on disk) -> finalize only (no dupe).
  //   - kill AFTER finalize            -> marker 'true'; readDiscordClaim='finalized' -> no-op.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const claim = await readDiscordClaim();
        // 'unclaimed' | 'finalized' -> nothing was left in flight.
        if (cancelled || typeof claim !== 'object') return;
        const pendingAmount = claim.pendingAmount;
        if (communityRewardGrantedRef.current) {
          // Grant already landed AND saved before the crash — just finalize;
          // re-granting would duplicate the money.
          await finalizeDiscordClaim();
          return;
        }
        // Grant the FROZEN pending amount (never recomputed) + flag, atomically.
        setGameState(prev => applyDiscordRewardGrant(prev, pendingAmount));
        // Let the commit + GameActions ref-sync flush before saving: saveGame
        // reads gameStateRef.current, which lags the setGameState commit by one
        // passive-effect cycle (the same lag the daily-reward persist defers
        // around) — without this yield saveGame would persist the PRE-grant state.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;
        try {
          await saveGame();
        } catch (err) {
          // Save failed — leave the pending marker; the next launch's reconciler
          // completes it. DO NOT finalize (the designed recovery).
          logger.warn('Discord reward reconcile save failed; will retry next launch', { error: err });
          return;
        }
        await finalizeDiscordClaim();
      } catch (err) {
        logger.warn('Discord reward reconcile failed', { error: err });
      }
    })();

    // Redeem-code reconciler — same single-owner, always-mounted recovery as the
    // Discord one above. Completes, exactly once, any redeem claim a force-kill
    // interrupted: grant-not-saved -> grant+save+finalize; saved-not-finalized
    // -> finalize only (no dupe); nothing pending / malformed -> no-op.
    (async () => {
      try {
        await reconcileRedeemClaim({
          hasHash: (hash) => redeemedCodeHashesRef.current.includes(hash),
          grant: (hash, reward) => setGameState((prev) => applyRedeemReward(prev, hash, reward)),
          // Durable force-save: resolves true only when the write is verified,
          // which is what gates finalization inside the reconciler.
          save: () => saveGame(true),
        });
      } catch (err) {
        logger.warn('Redeem code reconcile failed', { error: err });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once on mount — a launch-time recovery. setGameState/saveGame are
    // stable and the grant flag is read via a ref, so no reactive deps apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoinCommunity = useCallback(async () => {
    // Freeze the amount at claim time so the pending marker, the grant and the
    // popup display can never drift (shown == granted).
    const amount = communityRewardAmount;
    // EXACTLY-ONCE: durably record the pending marker BEFORE minting any cash.
    // On failure, grant nothing and stay claimable — never mint uncommitted cash.
    const begun = await beginDiscordClaim(amount);
    if (!begun) {
      logger.warn('Could not persist Discord reward claim; granting nothing');
      setShowCommunityReward(false);
      return;
    }
    // Grant money + flag in ONE atomic, idempotent state update (canonical
    // applyMoneyDelta folded in, so the money and the flag persist together).
    setGameState(prev => applyDiscordRewardGrant(prev, amount));
    setShowCommunityReward(false);
    // Let the commit + GameActions ref-sync flush before saving (saveGame reads
    // gameStateRef.current, which lags the commit by one passive-effect cycle),
    // otherwise the PRE-grant state would hit disk.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    try {
      await saveGame();
      await finalizeDiscordClaim();
    } catch (err) {
      // saveGame rejected — DO NOT finalize. The pending marker + the home
      // reconciler complete the grant on next launch (the designed recovery).
      logger.warn('Discord reward claim save failed; will reconcile next launch', { error: err });
    }
    // Best-effort: remember the popup was seen so it doesn't resurface.
    try {
      await safeSetItem('discord_popup_seen', 'true');
    } catch {
      // Non-critical: may re-show next session if this write fails.
    }
    // Open the Discord invite (last).
    try {
      const canOpen = await Linking.canOpenURL(DISCORD_URL);
      if (canOpen) await Linking.openURL(DISCORD_URL);
    } catch {
      // Ignore — the reward has already been handled regardless of the link.
    }
  }, [setGameState, saveGame, communityRewardAmount]);

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

        {/*
          The first-session coach, at the TOP of the feed rather than pinned to
          the bottom. Two reasons, and the first was found by looking:
          absolutely positioned at `bottom: 0` it rendered BEHIND the tab bar
          and a new player never saw it at all.

          The second is the better argument anyway — this is the one thing on
          screen telling a new player what to do, and it belongs where the eye
          lands. The card a player used to meet first was a passive profile
          (name, age, "Unemployed") with nothing actionable on it.

          Mounted UNCONDITIONALLY: it owns its own gating from live game state,
          so it cannot ask for something already done and retires itself once
          the player has been paid. `FirstWeekGuide` below is gated on
          `hasCompletedTutorial`, and driving the shipped build showed it never
          rendered — the coach must not inherit that dependency.
        */}
        <FirstSessionCoach />

        <FadeInUp delay={0}>
          {/* The prestige badge on the card opens the shop this screen already
              mounts below, instead of its previous empty onPress. */}
          <IdentityCard onOpenPrestigeShop={() => setShowPrestigeShop(true)} />
        </FadeInUp>

        {/* DeepLife+ upsell — a golden crown entry to the premium paywall.
            Self-contained (owns its modal) and hides itself for members. */}
        <FadeInUp delay={10}>
          <View style={styles.premiumCrownRow}>
            <PremiumCrownButton />
          </View>
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
          const hasJob = !!gameState.currentJob;
          const hasDoneStreetJob = (gameState.streetJobsCompleted ?? 0) > 0;
          const isBrandNew = weeksThisLife <= 5 && !hasJob && !hasDoneStreetJob;
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
        {isPrestigeAvailable(gameState) && (
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
          weeksThisLife > 20 &&
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
          <AmbitionPickerCard />
          <WeeklyChallengeCard />
        </FadeInUp>

        {/* Retirement / Elder chapter — retire, pension, elder activities, legacy.
            Renders only when eligible to retire, elderly, or retired. */}
        <FadeInUp delay={57}>
          <ElderCard />
        </FadeInUp>

        {/* NAV: the Progression screen (prestige, Legacy Pass, life story,
            skill tree, lifetime stats) was hidden from the tab bar with no
            other entry point — this card is its front door. Always visible. */}
        <FadeInUp delay={110}>
          <TouchableOpacity
            onPress={() => {
              // Respect the SAME gate the Life tab enforces on its Stats
              // segment. This card used to push straight through, so a week-1
              // player was told "locked" in one place and handed the whole
              // screen in another — which reads as a broken gate and silently
              // defeated progressive disclosure for its one tier-gated surface.
              // Shown-but-locked rather than hidden: the destination stays
              // discoverable, and the requirement is stated.
              if (progressLocked) {
                Alert.alert('Your Progress', progressLockReason || 'Keep playing to unlock this.');
                return;
              }
              router.push('/(tabs)/progression');
            }}
            activeOpacity={0.85}
            style={styles.progressLinkCard}
            accessibilityRole="button"
            accessibilityState={{ disabled: progressLocked }}
          >
            <View style={styles.progressLinkIcon}>
              {progressLocked ? (
                <Lock size={scale(18)} color="#94A3B8" />
              ) : (
                <Trophy size={scale(20)} color="#F59E0B" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressLinkTitle}>Your Progress</Text>
              <Text style={styles.progressLinkSub}>
                {progressLocked
                  ? progressLockReason || 'Keep playing to unlock this.'
                  : 'Prestige, Legacy Pass, life story & lifetime stats'}
              </Text>
            </View>
            <ChevronRight size={scale(18)} color="#94A3B8" />
          </TouchableOpacity>
        </FadeInUp>

        {/* Secondary detail modules collapse behind "Show more" so the feed
            doesn't grow unbounded on an established save. */}
        {showMore && (
          <>
            {weeksThisLife > 5 && (
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
        {weeksThisLife <= 3 && !hasCompletedTutorial && (
          <View style={{ height: 200 }} />
        )}

        {/* Banner ad at the end of the scroll content — non-obscuring (scrolls
            with content, never overlaps the tab bar). Self-gating: BannerAd
            renders nothing unless the AdMob SDK is configured and the player
            hasn't bought Remove Ads / Lifetime Premium. */}
        <BannerAd style={{ marginTop: scale(12) }} />
      </ScrollView>

      {/* First Week Guide Overlay - Floating at bottom */}
      {weeksThisLife <= 3 && !hasCompletedTutorial && (
        <FirstWeekGuide currentWeek={weeksThisLife} />
      )}

      {/* NOISE: light popup coordination. The root layout owns blocking modals
          (death/wedding) — no celebration/reward popup may present on top of
          them. Within this screen, popups present strictly one at a time in
          priority order (daily reward > welcome back > community) instead of
          whichever setTimeout won the race.

          Each is MOUNTED only while it holds the slot, which is the pattern the
          rest of the app already uses for a lazy modal (`app/_layout.tsx` gates
          Death/Wedding/Sickness, `(tabs)/_layout.tsx` gates the life moment and
          the weekly sheet). This screen was the outlier: it mounted all three
          unconditionally and passed `visible={false}`, so every Home mount fired
          three dynamic `import()`s for modals the player almost never sees on
          that render — defeating the point of `lazy()`, which is to keep those
          graphs out of the screen's work, not merely out of its first paint.

          It also livelocked `__tests__/render/screens.render.test.tsx`. Under
          ts-jest an `import()` compiles to `Promise.resolve().then(() =>
          require(…))`, so it can only settle on a microtask — and the harness's
          synchronous `act()` never yields one. React kept restarting the render
          from the shell to retry the pending lazy: ~1.4M `beginWork` calls per
          pass, forever, with `scheduleUpdateOnFiber` never firing (so it was not
          a re-render loop, and jest's own `testTimeout` could not fire either
          because the spin blocks the event loop). Nothing suspends now, because
          nothing invisible mounts. */}
      {dailyRewardSlot && (
      <Suspense fallback={null}>
        <DailyRewardPopup
          visible={dailyRewardSlot}
          rewardAmount={gameState.dailyRewardAmount || 0}
          onClose={() => setGameState(prev => ({
            ...prev,
            showDailyRewardPopup: false,
            dailyRewardAmount: undefined,
          }))}
        />
      </Suspense>
      )}
      {welcomeBackSlot && (
      <Suspense fallback={null}>
        <WelcomeBackPopup
          visible={welcomeBackSlot}
          onClose={() => {
            setShowWelcomeBack(false);
            // Actually GRANT the welcome-back bonus the popup advertised (it was
            // previously only displayed, never credited). Atomic single updater:
            // compute from the OLD lastLogin, then stamp lastLogin=now so the
            // popup (and bonus) can't re-fire until another ~24h away.
            //
            // Both rejections live inside `applyWelcomeBackBonus` and are read
            // off `prev`, not off an outer flag: the daysAway<1 re-entry guard
            // (a second onClose in the same React batch), and the v44
            // forward-clock gate on `settings.lastWelcomeBackWeek` — the v35
            // `lastAdCashGrantWeek` pattern, since the day count alone only
            // refuses a REWOUND clock and a forward scrub farmed the bonus with
            // no game weeks played. Rejection is `prev` returned unchanged.
            setGameState(prev => applyWelcomeBackBonus(prev, Date.now()));
          }}
        />
      </Suspense>
      )}
      {communitySlot && (
      <Suspense fallback={null}>
        <CommunityRewardPopup
          visible={communitySlot}
          rewardAmount={communityRewardAmount}
          onJoin={handleJoinCommunity}
          onDismiss={handleDismissCommunity}
        />
      </Suspense>
      )}

      {/* Prestige Modals */}
      <PrestigeModal visible={showPrestigeModal} onClose={() => setShowPrestigeModal(false)} />
      <PrestigeShopModal visible={showPrestigeShop} onClose={() => setShowPrestigeShop(false)} />
      <PrestigeInfoModal visible={showPrestigeInfo} onClose={() => setShowPrestigeInfo(false)} />
      <AchievementsModal visible={showAchievements} onClose={() => setShowAchievements(false)} />

    </View>
  );
}

const styles = StyleSheet.create({
  premiumCrownRow: {
    alignItems: 'center',
    marginTop: verticalScale(10),
    marginBottom: verticalScale(2),
  },
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
