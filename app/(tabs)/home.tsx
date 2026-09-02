import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { track } from '@/lib/analytics';
import { awardLegacyPassXp } from '@/contexts/game/actions/LegacyPassActions';
import { canClaimDailyGemsFor } from '@/contexts/game/actions/SubscriptionActions';
import { LEGACY_PASS_XP } from '@/lib/legacyPass/legacyPass';
import { ChevronRight, Trophy, ChevronDown, ChevronUp, Lock } from 'lucide-react-native';
import { logger } from '@/utils/logger';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNavigationReady } from '@/hooks/useNavigationReady';
import { useGameActions } from '@/contexts/GameContext';
import { useGameSelector, useSetGameState, shallowEqual } from '@/contexts/game/useGameSelector';
import type { GameState } from '@/contexts/game/types';
import AchievementsSummaryCard from '@/components/AchievementsSummaryCard';
import BannerAd from '@/components/BannerAd';
import AchievementsModal from '@/components/AchievementsModal';
import IdentityCard from '@/components/IdentityCard';
import LastWeekRecap from '@/components/LastWeekRecap';
import PrestigeButton from '@/components/PrestigeButton';
import { isPrestigeAvailable } from '@/lib/prestige/prestigeTypes';
import PrestigeStatsCard from '@/components/PrestigeStatsCard';
import PrestigePreviewCard from '@/components/PrestigePreviewCard';
import PrestigeModal from '@/components/PrestigeModal';
import PrestigeShopModal from '@/components/PrestigeShopModal';
import PrestigeInfoModal from '@/components/PrestigeInfoModal';
import { fontScale, responsivePadding, scale, responsiveBorderRadius, verticalScale } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import LifeChapterCard from '@/components/LifeChapterCard';
import AmbitionCard from '@/components/AmbitionCard';
import WeeklyChallengeCard from '@/components/WeeklyChallengeCard';
import LiveEventsCard from '@/components/LiveEventsCard';
import ScenarioChallengeCard from '@/components/ScenarioChallengeCard';
import NextGoalsCard from '@/components/NextGoalsCard';
import WeekAheadCard from '@/components/WeekAheadCard';
import AmbitionPickerCard from '@/components/AmbitionPickerCard';
import ElderCard from '@/components/ElderCard';
import GoalsCard from '@/components/GoalsCard';
import { ContextualTip, useContextualTip, type ContextualTipType } from '@/components/ContextualTip';
import FirstSessionCoach from '@/components/FirstSessionCoach';
import DiscoveryIndicator from '@/components/depth/DiscoveryIndicator';
import ErrorBoundary from '@/components/ErrorBoundary';
import FadeInUp from '@/components/anim/FadeInUp';
import { useTheme } from '@/hooks/useTheme';
import {
  readDiscordClaim,
  beginDiscordClaim,
  finalizeDiscordClaim,
  applyDiscordRewardGrant,
} from '@/utils/discordRewardClaim';
import {
  readInviteOffers,
  recordInviteOffer,
  shouldOfferInvite,
  type InviteOfferRecord,
} from '@/utils/communityInvitePrompt';
import { DISCORD_URL } from '@/lib/config/appConfig';
import { discordJoinRewardMoney } from '@/lib/config/gameConstants';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { applyWelcomeBackBonus, welcomeBackClaimed, refreshSessionClock } from '@/utils/welcomeBackBonus';
import { isFeatureUnlocked, unlockRequirement } from '@/lib/progress/featureUnlocks';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';
import { useInterruptionSlot, INTERRUPTION_PRIORITY } from '@/contexts/InterruptionContext';
import { gameAlert } from '@/utils/gameAlert';
import SectionGroup from '@/components/ui/SectionGroup';
import { rhythm } from '@/lib/config/hierarchy';

// Lazy load heavy modals and popups
const DailyRewardPopup = lazy(() => import('@/components/DailyRewardPopup'));
const WelcomeBackPopup = lazy(() => import('@/components/WelcomeBackPopup'));
const CommunityRewardPopup = lazy(() => import('@/components/CommunityRewardPopup'));

function HomeScreen() {
  return (
    <ErrorBoundary>
      <HomeScreenContent />
    </ErrorBoundary>
  );
}

function HomeScreenContent() {
  const insets = useSafeAreaInsets();
  // Sprint 2 perf: subscribe only to the slices this screen (and its goal /
  // tip / discovery / stat-change consumers) read - not the whole gameState -
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
      // - the same inconsistency this gate exists to remove, inverted.
      completedChapters: s?.completedChapters,
      generationNumber: s?.generationNumber,
    }),
    shallowEqual
  ) as unknown as GameState;
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const { theme, isDark } = useTheme();
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showCommunityReward, setShowCommunityReward] = useState(false);
  // The offer record the visible popup was decided from. Spending an offer
  // increments THIS value rather than re-reading, so a dismissal can never
  // lose a concurrently-written count.
  const offerRecordRef = useRef<InviteOfferRecord>({ count: 0 });
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showPrestigeShop, setShowPrestigeShop] = useState(false);
  const [showPrestigeInfo, setShowPrestigeInfo] = useState(false);
  // Collapses the secondary tail of the home feed so it doesn't grow unbounded.
  const [showMore, setShowMore] = useState(false);
  // The "working toward" band's disclosure. Defaults closed: the audit found
  // five near-identical checklist cards stacked here, so the summary GoalsCard
  // is the default and the per-system detail cards are opt-in.
  const [showGoalDetails, setShowGoalDetails] = useState(false);

  // Root-level blocking modals (death/wedding) own the screen - every
  // celebration/reward popup below defers to them.
  const blockingModalUp = !!(gameState.showDeathPopup || gameState.showWeddingPopup);

  // The Progress screen is `href: null` (never a tab button), so this card is
  // its front door - and must apply the same tier gate the Life tab's Stats
  // segment does. See the card below.
  const progressLocked = !isFeatureUnlocked(gameState, 'tab:progression');
  const progressLockReason = unlockRequirement(gameState, 'tab:progression');

  // Interruption slots. These popups used to gate on a hand-rolled chain of
  // `&&` terms that grew with every popup added - and could not see the weekly
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

  // THE LEAD SLOT. Home's dominant element is chosen from player state, most
  // consequential first: a prestige the player can take now beats a crisis
  // tip (it is the one irreversible decision on the screen), a crisis beats
  // the goal ladder (a vital in the CRITICAL band is not a goal, it is a countdown), and
  // otherwise the closest objective leads. Everything else on the feed is
  // tier 2 or lower and sits under `rhythm.major` of whitespace.
  const lead: 'prestige' | 'tip' | 'goals' = isPrestigeAvailable(gameState)
    ? 'prestige'
    : activeTip
      ? 'tip'
      : 'goals';

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
  // affected - e.g. `earn_100` showed only while `money < 200` but completed at
  // `money >= 200`; `get_job` was offered only while `!currentJob`, which pinned
  // its `current` at 0. Zero states in the whole predicate space were completable,
  // so the popup, the rewards and `completedGoals` were unreachable code.
  // Life Chapters (`LifeChapterCard` + `applyChapterProgress`) are the real
  // progression ladder and are paid by the week tick.

  // The modal tutorial is retired: FirstSessionCoach (below, in the feed) is
  // the one teaching surface, gated on live game state rather than a
  // device-wide AsyncStorage flag. Everything that used to wait for
  // `hasCompletedTutorial` now waits for actual play instead: `weeksThisLife`
  // only advances by living weeks, so it is the honest "past the first
  // moments" signal - and unlike the old flag it resets with each new life
  // and cannot be pre-satisfied by a previous install. CLAUDE.md §4.2.

  // ENGAGEMENT: Daily login reward with streak system
  useEffect(() => {
    // `< 2`, not `< 1`: the first Next Week of a life is the tick that teaches
    // the loop (the coach's "You earned $N" payoff, the first recap, the first
    // vital drift). Measured on a fresh quick start, this modal landed on that
    // same tick together with a gem floater and a "Perfect Week" toast — three
    // surfaces over the one consequence the player needed to read. One tap
    // later costs the player nothing (same session) and gives the wage its
    // moment. Program 6, pacing.
    if (weeksThisLife < 2) return undefined;
    if (gameState.showDailyRewardPopup) return undefined;

    // FARMABLE ON THE DEVICE CLOCK. The only gate here was
    // `lastRewardDate === today`, a raw string compare against a device-clock
    // day key - so moving the date to ANY other day, forward or back, re-armed
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
    // the one clock a scrubber cannot move - it advances only by playing.
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
        // batch would both pass it and both credit gems - the gate-then-grant
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
      // The persist happens in the committed-marker effect below - NOT here.
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
    setGameState,
  ]);

  // Persist AFTER the daily-reward grant commits. This effect fires only when
  // `lastLoginRewardDate` actually transitions to a new value (the grant above
  // stamps today's date), never on initial mount - the ref is seeded with the
  // value from first render, so mount sees `ref === current` and no-ops.
  //
  // The save is deferred to a macrotask: gameStateRef is synced in a
  // post-commit effect that lives in the *parent* GameActionsProvider, and
  // React fires passive effects child-before-parent - so at the instant this
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

  // Honest session clock. `lastLogin` used to be stamped ONLY at life creation
  // and on welcome-back grant - so for a player who kept returning inside the
  // 24h window it went stale for as long as the habit lasted, and the next
  // day-plus absence was reported (and PAID) as the whole stale span: "Last
  // played: 1 week ago" plus seven days of salary for a one-day absence. Stamp
  // it once per Home mount, but only while inside the 24h window - a genuine
  // day-plus absence is left untouched so the popup can still measure it and
  // the grant can still close it (`applyWelcomeBackBonus` stamps on close).
  const sessionClockStampedRef = useRef(false);
  useEffect(() => {
    if (sessionClockStampedRef.current) return;
    sessionClockStampedRef.current = true;
    // All gates re-checked against `prev` inside the pure helper: a stale
    // stamp inside 24h is refreshed; a day-plus absence and a rewound clock
    // are both left untouched (the former belongs to the return summary).
    setGameState(prev => refreshSessionClock(prev, Date.now()));
  }, [setGameState]);

  // Show welcome back popup for returning players
  useEffect(() => {
    if (weeksThisLife > 1 && gameState.lastLogin) {
      const lastLogin = gameState.lastLogin || Date.now();
      const hoursAway = (Date.now() - lastLogin) / (1000 * 60 * 60);

      // Only after a genuine day-plus away. `lastLogin` is reset to now on
      // close, so this naturally fires at most once per ~24h absence - which
      // also gates the cash bonus granted on close (no grindable faucet).
      //
      // `welcomeBackClaimed` mirrors the inner rejection in
      // `applyWelcomeBackBonus` (the AdRewardOrb spawner pattern, v35): once the
      // bonus has been paid in this `weeksLived`, the popup is not offered at
      // all, so the player never sees one that would credit nothing.
      //
      // Deliberately NOT gated on `showDailyRewardPopup` any more: both may
      // want the slot on the same session, and the interruption queue orders
      // them (WELCOME_BACK 55 > DAILY_REWARD 50) - the old gate meant the
      // return summary was silently suppressed on exactly the session type it
      // was built for, because the daily popup's spawner fired 700ms earlier.
      if (
        hoursAway > 24 &&
        !welcomeBackClaimed({ settings: { lastWelcomeBackWeek }, weeksLived: gameState.weeksLived }) &&
        !showWelcomeBack
      ) {
        // 600ms: ahead of the daily popup's 800ms spawn, so the higher-priority
        // summary claims the slot before the gem popup ever presents - the
        // player sees summary → gems, not a gem flash replaced mid-animation.
        const timer = setTimeout(() => {
          setShowWelcomeBack(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [gameState.lastLogin, weeksThisLife, gameState.week, gameState.weeksLived, lastWelcomeBackWeek, showWelcomeBack]);

  // ENGAGEMENT: low-key invite to join the Discord for a cash reward.
  // Subtle by design - only once the player is settled in (tutorial done + a few
  // weeks lived) and never stacked on the daily-reward / welcome-back popups.
  //
  // It is no longer one-shot. Joining still suppresses it forever (the shared
  // `discord_reward_claimed` marker), but DISMISSING now spends one of a small
  // number of asks and starts a cooldown in game weeks, instead of writing a
  // permanent tombstone - see utils/communityInvitePrompt.ts for why one "maybe
  // later" at week 4 was the worst possible moment to close this funnel on.
  // The Settings entry stays as the always-available fallback.
  useEffect(() => {
    if (gameState.showDailyRewardPopup || showWelcomeBack || showCommunityReward) return undefined;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const [claim, record] = await Promise.all([
          readDiscordClaim(),
          readInviteOffers(),
        ]);
        if (cancelled) return;
        // One predicate, shared with the tests. Treats BOTH 'finalized' AND a
        // pending (in-flight) claim as claimed - a claim already begun must
        // never re-surface the invite.
        if (!shouldOfferInvite({
          claim,
          record,
          weeksInThisLife: weeksThisLife,
          weeksLived: gameState.weeksLived,
        })) return;
        // Remember which record this offer was decided from, so spending it
        // increments the value that was actually read.
        offerRecordRef.current = record;
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
  }, [weeksThisLife, gameState.weeksLived, gameState.showDailyRewardPopup, showWelcomeBack, showCommunityReward]);

  // FINDING 1: derive the reward from the FULL state's net worth, not home's
  // PROJECTED selector slice (which omits properties, companies, stocks, vehicles
  // & crypto, so it understates net worth for wealthy players - home would grant
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

  // Discord reward reconciler - SINGLE OWNER (home is the always-mounted tab;
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
          // Grant already landed AND saved before the crash - just finalize;
          // re-granting would duplicate the money.
          await finalizeDiscordClaim();
          return;
        }
        // Grant the FROZEN pending amount (never recomputed) + flag, atomically.
        setGameState(prev => applyDiscordRewardGrant(prev, pendingAmount));
        // Let the commit + GameActions ref-sync flush before saving: saveGame
        // reads gameStateRef.current, which lags the setGameState commit by one
        // passive-effect cycle (the same lag the daily-reward persist defers
        // around) - without this yield saveGame would persist the PRE-grant state.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;
        try {
          await saveGame();
        } catch (err) {
          // Save failed - leave the pending marker; the next launch's reconciler
          // completes it. DO NOT finalize (the designed recovery).
          logger.warn('Discord reward reconcile save failed; will retry next launch', { error: err });
          return;
        }
        await finalizeDiscordClaim();
      } catch (err) {
        logger.warn('Discord reward reconcile failed', { error: err });
      }
    })();

    // (The redeem-code reconciler was removed with the promo-code feature -
    // App Review 3.1.1: a promo code cannot unlock digital content outside of
    // In-App Purchase. No in-app redemption path remains, so there is nothing
    // to recover on launch.)

    return () => {
      cancelled = true;
    };
    // Runs once on mount - a launch-time recovery. setGameState/saveGame are
    // stable and the grant flag is read via a ref, so no reactive deps apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoinCommunity = useCallback(async () => {
    // Freeze the amount at claim time so the pending marker, the grant and the
    // popup display can never drift (shown == granted).
    const amount = communityRewardAmount;
    // EXACTLY-ONCE: durably record the pending marker BEFORE minting any cash.
    // On failure, grant nothing and stay claimable - never mint uncommitted cash.
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
      // saveGame rejected - DO NOT finalize. The pending marker + the home
      // reconciler complete the grant on next launch (the designed recovery).
      logger.warn('Discord reward claim save failed; will reconcile next launch', { error: err });
    }
    // No offer record is written here: the claim marker (finalized OR pending)
    // already outranks every offer rule, so a joined player is never re-asked.
    // Open the Discord invite (last).
    try {
      const canOpen = await Linking.canOpenURL(DISCORD_URL);
      if (canOpen) await Linking.openURL(DISCORD_URL);
    } catch {
      // Ignore - the reward has already been handled regardless of the link.
    }
  }, [setGameState, saveGame, communityRewardAmount]);

  const handleDismissCommunity = async () => {
    setShowCommunityReward(false);
    // Spend one ask and start the cooldown - NOT a tombstone. A failed write
    // costs one repeated ask next session, which is the safe direction.
    await recordInviteOffer(gameState.weeksLived, offerRecordRef.current);
  };

  // The goal card and its disclosure travel together: the "Show details"
  // toggle belongs under the card it expands, whether the card is the lead
  // (below the identity strip) or, when something more urgent took the
  // slot, back in its band.
  const goalsBlock = (
    <>
      <GoalsCard onShowDetails={() => setShowGoalDetails(true)} />
      {/* No FadeInUp inside the disclosure: these mount on a toggle, and
          re-animating seven cards on every open is exactly the motion the
          summary card exists to avoid. */}
      {showGoalDetails && (
        <>
          <NextGoalsCard />
          <WeekAheadCard />

          {/* Life Chapter - the chunked-goal spine (was built but had no UI). */}
          <LifeChapterCard />

          {/* Life Ambition - the lifelong goal chosen at character creation.
              Renders only when an ambition was picked (freeform lives skip it). */}
          <AmbitionCard />
          {/* The challenge-scenario run chosen at onboarding - win conditions
              were previously invisible between onboarding and first prestige.
              Renders null for non-challenge lives and prestiged dynasties. */}
          <ScenarioChallengeCard />
          {/* Live events sit ABOVE the weekly challenge: they are the only
              surface here with a real-world deadline, and the challenge rotates
              on game weeks so it waits for the player either way. The card
              renders nothing at all when there is nothing active, so a quiet
              week costs no space. */}
          <LiveEventsCard />
          <WeeklyChallengeCard />
        </>
      )}

      <TouchableOpacity
        onPress={() => setShowGoalDetails(v => !v)}
        activeOpacity={0.8}
        style={styles.showMoreBtn}
        accessibilityRole="button"
      >
        <Text style={styles.showMoreText}>
          {showGoalDetails ? 'Hide details' : 'Show details'}
        </Text>
        {showGoalDetails
          ? <ChevronUp size={scale(15)} color="#94A3B8" />
          : <ChevronDown size={scale(15)} color="#94A3B8" />}
      </TouchableOpacity>

    </>
  );

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
        {/* No hero strip: the HUD's date box directly above this screen already
            shows month, week and age - one fact, one surface. */}

        {/*
          The first-session coach, at the TOP of the feed rather than pinned to
          the bottom. Two reasons, and the first was found by looking:
          absolutely positioned at `bottom: 0` it rendered BEHIND the tab bar
          and a new player never saw it at all.

          The second is the better argument anyway - this is the one thing on
          screen telling a new player what to do, and it belongs where the eye
          lands. The card a player used to meet first was a passive profile
          (name, age, "Unemployed") with nothing actionable on it.

          Mounted UNCONDITIONALLY: it owns its own gating from live game state,
          so it cannot ask for something already done and retires itself once
          the player has been paid. It is also the ONLY teaching surface now -
          the modal tutorial and the FirstWeekGuide are retired (the latter was
          dead by construction: gated on a device-wide flag the tutorial set
          first in a 500ms race).
        */}
        <FirstSessionCoach />

        <FadeInUp delay={0}>
          {/* The prestige badge on the card opens the shop this screen already
              mounts below, instead of its previous empty onPress. */}
          <IdentityCard onOpenPrestigeShop={() => setShowPrestigeShop(true)} />
        </FadeInUp>

        {/* No crown upsell here any more: the HUD's store button and the gem
            chip's + are the store entries. Four concurrent paywall
            affordances on one screen was the audit's monetization finding. */}

        {/* THE LEAD SLOT - see `lead` above. One element, chosen by state,
            with the feed's widest gap under it so the eye lands here first and
            reads everything below as "the rest". */}
        <View style={styles.leadSlot}>
          {lead === 'prestige' && (
            <PrestigeButton onPress={() => setShowPrestigeModal(true)} />
          )}
          {lead === 'tip' && activeTip && (
            <ContextualTip
              type={activeTip as ContextualTipType}
              onDismiss={() => dismissTip(activeTip)}
            />
          )}
          {lead === 'goals' && <FadeInUp delay={20}>{goalsBlock}</FadeInUp>}
        </View>

        {/* Non-blocking weekly recap - restores the sense of progress that the
            (removed) weekly event pop-ups used to provide, without interrupting. */}
        <SectionGroup label="This week" collapsibleId="home.thisWeek">
        <FadeInUp delay={30}>
          <LastWeekRecap />
        </FadeInUp>

        {/* A tip that did not win the lead slot (prestige did) still shows -
            it is the only surface that names the fix for a failing vital. The
            'no_job' tip and the find-a-job CTA that used to sit here are gone:
            FirstSessionCoach above owns that message. */}
        {lead !== 'tip' && activeTip && (
          <ContextualTip
            type={activeTip as ContextualTipType}
            onDismiss={() => dismissTip(activeTip)}
          />
        )}

        {/* Prestige Stats Card - Show if player has prestiged */}
        {gameState.prestige && gameState.prestige.prestigeLevel > 0 && (
          <PrestigeStatsCard
            onPress={() => setShowPrestigeModal(true)}
            onShopPress={() => setShowPrestigeShop(true)}
            onInfoPress={() => setShowPrestigeInfo(true)}
          />
        )}

        {/* Prestige Preview Card - held back until the player is actually
            established (week 20+ AND some net worth), so early game isn't
            upsold a system it can't use yet. */}
        {(!gameState.prestige || gameState.prestige.prestigeLevel === 0) &&
          weeksThisLife > 20 &&
          (((gameState.stats?.money ?? 0) + (gameState.bankSavings ?? 0)) > 25000) && (
          <PrestigePreviewCard onPress={() => setShowPrestigeModal(true)} />
        )}

        </SectionGroup>

        {/* What next / what is coming. Life Chapters and the Ambition are the
            same for everyone at the same point, while GoalsCard reads the
            player's own situation - so it leads the feed (above) unless
            something more urgent took the slot, in which case it opens this
            band instead. Both render null when they have nothing to say, so a
            quiet early week is not padded with cards. */}
        <SectionGroup label="What you're working toward" collapsibleId="home.goals">
        {lead !== 'goals' && <FadeInUp delay={45}>{goalsBlock}</FadeInUp>}

        {/* Outside the disclosure on purpose: the picker PROMPTS a choice not
            yet made (hiding it would hide the ambition system from anyone who
            never opens the details), and Elder is a life-stage surface, not
            another checklist. */}
        <FadeInUp delay={55}>
          <AmbitionPickerCard />
        </FadeInUp>

        {/* Retirement / Elder chapter - retire, pension, elder activities, legacy.
            Renders only when eligible to retire, elderly, or retired. */}
        <FadeInUp delay={57}>
          <ElderCard />
        </FadeInUp>
        </SectionGroup>

        {/* NAV: the Progression screen (prestige, Legacy Pass, life story,
            skill tree, lifetime stats) was hidden from the tab bar with no
            other entry point - this card is its front door. Always visible. */}
        <FadeInUp delay={110}>
          <TouchableOpacity
            onPress={() => {
              // Respect the SAME gate the Life tab enforces on its Stats
              // segment. This card used to push straight through, so a week-1
              // player was told "locked" in one place and handed the whole
              // screen in another - which reads as a broken gate and silently
              // defeated progressive disclosure for its one tier-gated surface.
              // Shown-but-locked rather than hidden: the destination stays
              // discoverable, and the requirement is stated.
              if (progressLocked) {
                gameAlert('Your Progress', progressLockReason || 'Keep playing to unlock this.');
                return;
              }
              // Canonical door: Progress lives on the Life shell's Stats
              // segment. Pushing the hidden `/(tabs)/progression` route
              // rendered a second, un-chromed copy with no tab highlighted.
              router.push({ pathname: '/(tabs)/life', params: { segment: 'stats', ts: String(Date.now()) } });
            }}
            activeOpacity={0.85}
            style={styles.progressLinkCard}
            accessibilityRole="button"
            accessibilityLabel="Your Progress"
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

        {/* Banner ad at the end of the scroll content - non-obscuring (scrolls
            with content, never overlaps the tab bar). Self-gating: BannerAd
            renders nothing unless the AdMob SDK is configured and the player
            hasn't bought Remove Ads / Lifetime Premium. */}
        <BannerAd style={{ marginTop: scale(12) }} />
      </ScrollView>

      {/* NOISE: light popup coordination. The root layout owns blocking modals
          (death/wedding) - no celebration/reward popup may present on top of
          them. Within this screen, popups present strictly one at a time in
          priority order (welcome back > daily reward > community) instead of
          whichever setTimeout won the race.

          Each is MOUNTED only while it holds the slot, which is the pattern the
          rest of the app already uses for a lazy modal (`app/_layout.tsx` gates
          Death/Wedding/Sickness, `(tabs)/_layout.tsx` gates the life moment and
          the weekly sheet). This screen was the outlier: it mounted all three
          unconditionally and passed `visible={false}`, so every Home mount fired
          three dynamic `import()`s for modals the player almost never sees on
          that render - defeating the point of `lazy()`, which is to keep those
          graphs out of the screen's work, not merely out of its first paint.

          It also livelocked `__tests__/render/screens.render.test.tsx`. Under
          ts-jest an `import()` compiles to `Promise.resolve().then(() =>
          require(…))`, so it can only settle on a microtask - and the harness's
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
            // forward-clock gate on `settings.lastWelcomeBackWeek` - the v35
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

      {/* Prestige/achievement modals - mounted only while open, the same rule
          the reward popups above follow. Mounting them permanently with
          visible={false} did all their subscription and layout work on every
          Home render for surfaces the player almost never opens. */}
      {showPrestigeModal && (
        <PrestigeModal visible onClose={() => setShowPrestigeModal(false)} />
      )}
      {showPrestigeShop && (
        <PrestigeShopModal visible onClose={() => setShowPrestigeShop(false)} />
      )}
      {showPrestigeInfo && (
        <PrestigeInfoModal visible onClose={() => setShowPrestigeInfo(false)} />
      )}
      {showAchievements && (
        <AchievementsModal visible onClose={() => setShowAchievements(false)} />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  /** The lead slot's bottom gap plus SectionGroup's own top margin (sm) add
   *  up to `rhythm.major` - the feed's one wide gap, under the one element
   *  that leads. */
  leadSlot: {
    marginTop: rhythm.tight,
    marginBottom: rhythm.section,
  },
  progressLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
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
});

export default React.memo(HomeScreen);
