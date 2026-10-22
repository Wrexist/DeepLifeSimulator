import WeekChangeToast from '@/components/feedback/WeekChangeToast';
import { responsiveSpacing as layoutSpace , scale } from '@/utils/scaling';
import { uiPalette } from '@/lib/config/theme';
import { UserRound , Home, Briefcase, Smartphone, ShoppingCart, Heart, Monitor, Bell, LayoutGrid, Activity } from 'lucide-react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Platform, View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { modalEventCount } from '@/lib/events/routing';
// M16: read through the leaf selector channel, not `useGame()`. `useGame()`
// subscribed the whole <Tabs> navigator - every tab screen's parent - to every
// GameState mutation, so a money tick re-rendered the navigator. The sibling
// app/(onboarding)/_layout.tsx documents the same reasoning (it also avoids the
// GameContext barrel's import cycle by importing the leaf module directly).
import { useGameSelector } from '@/contexts/game/useGameSelector';

import { useFullscreenApp } from '@/utils/fullscreenAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { getGlassTabBar } from '@/utils/glassmorphismStyles';
import { haptic } from '@/utils/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { StatChangeOverlay } from '@/contexts/StatChangeContext';
import SmartNotificationTicker from '@/components/SmartNotificationTicker';
import PremiumPassPromo from '@/components/PremiumPassPromo';
import AdRewardOrb from '@/components/AdRewardOrb';
import YearEndBreak from '@/components/YearEndBreak';
import RemoveAdsOrb from '@/components/RemoveAdsOrb';
import InAppReviewPrompt from '@/components/InAppReviewPrompt';
import { resumeLifeAutosave } from '@/utils/autosaveSuspension';
import { isPristineUnstartedState } from '@/utils/saveValidation';
import { logger } from '@/utils/logger';
import { useInterruptionSlot, INTERRUPTION_PRIORITY } from '@/contexts/InterruptionContext';

const WeeklyEventModal = lazy(() => import('@/components/WeeklyEventModal'));
const LifeMomentModal = lazy(() => import('@/components/LifeMomentModal'));

// The game home tab lives at `home`, NOT the bare `index`. app/index.tsx is the
// boot loader and owns "/"; if a (tabs)/index.tsx existed it would ALSO resolve
// to "/" and - in a production bundle - expo-router silently keeps whichever file
// sorts first by context key ("(tabs)/index" < "index"), dropping the loader and
// rendering the game home at launch (the long-standing launch crash). Anchoring
// the group on `home` keeps "/" unambiguously the loader.
export const unstable_settings = { initialRouteName: 'home' };

interface EventInboxPillProps {
  count: number;
  bottom: number;
  onPress: () => void;
  /**
   * Inside a full-screen app the tab bar is gone, so the wide centred pill sat
   * over the app's own content - it covered "Run for Council Member", section
   * headers and stat labels across every desktop app (screenshot pass,
   * 2026-10-11). There it shrinks to a bell + count badge in the corner.
   */
  compact?: boolean;
}

// The inbox pill conditional-mounts after weeks with queued events, so it would
// otherwise pop into place with no bridge. On mount it runs a small entrance:
// opacity 0→1 and translateY 8→0 in parallel (200ms, Easing.out(Easing.cubic),
// native driver). Reduce Motion keeps the opacity feedback but drops the
// movement - it renders settled. No exit animation (the conditional unmount is
// acceptable). Tap behavior and copy are unchanged from the inline pill.
function EventInboxPill({ count, bottom, onPress, compact = false }: EventInboxPillProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 8)).current;

  useEffect(() => {
    if (reducedMotion) {
      // Settled: preserve opacity feedback, skip the movement.
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [reducedMotion, opacity, translateY]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom,
        ...(compact ? { right: scale(14) } : { alignSelf: 'center' as const }),
        opacity,
        transform: [{ translateY }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${count} decision${count === 1 ? '' : 's'} waiting`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: layoutSpace.sm,
          paddingVertical: layoutSpace.sm,
          paddingHorizontal: compact ? layoutSpace.sm : layoutSpace.md,
          minHeight: 44,
          minWidth: 44,
          justifyContent: 'center',
          borderRadius: scale(999),
          // Opaque: at 0.92 the card text it floats over ghosted through the
          // label ("Re[tir]ement", VIS-8).
          backgroundColor: uiPalette.navy,
          borderWidth: 1,
          borderColor: 'rgba(96, 165, 250, 0.5)',
        }}
      >
        <Bell size={scale(15)} color={uiPalette.blue} />
        <Text style={{ color: uiPalette.paper, fontWeight: '700', fontSize: scale(13) }}>
          {compact ? count : `${count} decision${count === 1 ? '' : 's'} waiting`}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TabLayout() {
  // The exact slices this layout reads. Each is a primitive or a stable
  // reference, so the navigator re-renders only when one of them actually
  // changes - not on every mutation.
  const jailWeeks = useGameSelector((s) => s?.jailWeeks ?? 0);

  const showDeathPopup = useGameSelector((s) => s?.showDeathPopup === true);
  const showWeddingPopup = useGameSelector((s) => s?.showWeddingPopup === true);
  const pendingMoment = useGameSelector((s) => s?.lifeMoments?.pendingMoment);
  // Letter-shaped events live in the mail app, so they must not inflate the
  // pill - a player who saw "2 decisions waiting", opened the inbox and found
  // one would have no way to find the other. One selector, shared with
  // `WeeklyEventModal`, so the two can never disagree.
  const pendingEventCount = useGameSelector((s) => modalEventCount(s));
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  
  const { isDark } = useTheme();

  // R3-S1: being inside the tab tree means a life is in play, so the ambient
  // autosave must be live. Entering the pre-game stack suspends it; this is the
  // counterpart that covers every way back - loading a slot, starting a new
  // life, or simply backing out of SaveSlots without choosing anything. Without
  // this last case the player's progress would silently stop autosaving for the
  // rest of the session.
  useEffect(() => {
    resumeLifeAutosave();
  }, []);

  // VIS-1: the game tabs must never run on the provider's template state.
  // The state lives in a provider inside the ROOT route, so anything that
  // re-mounts the root (on web, React Navigation's `resetRoot` on a
  // browser Back/Forward to a history entry it did not create; on native, a
  // root reset from a deep link or a router reset) brings the provider back
  // up on `initialGameState` while the router stays on the tabs. The player
  // then saw a stranger ('Player', 18, $200) and could play weeks that the
  // pristine-state save guard silently never persisted. Bounce to the main
  // menu instead, where Continue loads the real save. A real life always has
  // a scenario or a name, so this never fires mid-game.
  const isTemplateState = useGameSelector((s) => isPristineUnstartedState(s));
  useEffect(() => {
    if (!isTemplateState) return;
    logger.warn('[TabLayout] Tabs mounted on the unstarted template state - returning to the main menu');
    router.replace('/(onboarding)/MainMenu');
  }, [isTemplateState, router]);

  const isInPrison = jailWeeks > 0;
  // Hide the floating tab bar while an in-phone app runs full-screen.
  const fullscreenApp = useFullscreenApp();
  const currentRoute = segments.length > 0 ? segments[segments.length - 1] : null;

  // The blocking end-of-week sheet is retired: LastWeekRecap on Home is the
  // week summary now, non-blocking and gated by the same Settings switch. One
  // less surface competing for the post-tick moment.

  // Non-blocking weekly-event inbox: events queue but never auto-pop. The
  // player opens them from a pill; the modal walks the queue on demand.
  const [eventInboxOpen, setEventInboxOpen] = useState(false);
  useEffect(() => {
    if (pendingEventCount === 0 && eventInboxOpen) setEventInboxOpen(false);
  }, [pendingEventCount, eventInboxOpen]);


  // ── The two surfaces the queue declared but nobody claimed ────────────────
  //
  // `INTERRUPTION_PRIORITY` has carried LIFE_MOMENT (80) and EVENT_INBOX (70)
  // since it was written, and NOTHING claimed either. Both were suppressed
  // downward by `higherModalUp` - which is exactly the hand-rolled, single-file
  // chain the queue exists to replace. It works one way only: these two hid the
  // surfaces in THIS file, while every surface in another file was blind to
  // them. So an open Life Moment could be covered by the daily reward (50),
  // welcome back (45) or community reward (42) from `home.tsx`, by the premium
  // promo (20), or by the ad orb (10) - the modal the player is supposed to be
  // reading, buried under an upsell.
  //
  // Claiming makes them visible to every other surface. Death and wedding stay
  // deliberately unclaimed: they are root-level modals that gate their own
  // dismissal, documented as short-circuiting locally in InterruptionContext.
  // That is why both still appear in the guards below.
  const showLifeMoment = useInterruptionSlot(
    'tabs:life-moment',
    INTERRUPTION_PRIORITY.LIFE_MOMENT,
    !!pendingMoment && !showDeathPopup && !showWeddingPopup
  );
  const showEventInbox = useInterruptionSlot(
    'tabs:event-inbox',
    INTERRUPTION_PRIORITY.EVENT_INBOX,
    eventInboxOpen && pendingEventCount > 0 && !showDeathPopup && !showWeddingPopup,
    // Player-initiated (the pill was tapped) - never deferred by the
    // per-week interruption budget; refusing a direct tap reads as a bug.
    { countsTowardBudget: false }
  );
  // The inbox pill shows when decisions are waiting and nothing else is up.
  // Keyed on the life moment actually SHOWING, not merely pending: a moment the
  // per-week budget has deferred is not on screen, and hiding the pill for it
  // left the player with decisions waiting and nothing to tap until next week.
  const higherModalUp = !!(
    showDeathPopup || showWeddingPopup || showLifeMoment || eventInboxOpen
  );
  const showEventPill = pendingEventCount > 0 && !higherModalUp && !isInPrison;

  // Force navigation to work tab when entering prison
  useEffect(() => {
    if (isInPrison && currentRoute && currentRoute !== 'work') {
      try {
        router.replace('/(tabs)/work');
      } catch (error) {
        // Navigation might fail if already navigating, ignore
        if (__DEV__) {
          console.warn('Navigation to work tab failed:', error);
        }
      }
    }
  }, [isInPrison, currentRoute, router]);

  // Apps remains a stable destination. Its launchers enforce device ownership.
  // Profile is the long-term progression destination; prison still owns navigation.


  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenListeners={{ tabPress: () => haptic.light() }}
      screenOptions={{
        headerShown: false,
        // PERF: freeze blurred tab screens (react-native-screens). Every tab
        // screen subscribes to game state, so without this all mounted tabs
        // re-rendered on every state change - 5 hidden screens' worth of work
        // on each "Next Week" press. Frozen screens catch up on focus.
        freezeOnBlur: true,
        tabBarShowLabel: true,
        // The bar is a fixed scale(56) tall; unbounded Dynamic Type (up to
        // ~3.1x on iOS accessibility sizes) clips the labels out of it. Icons
        // carry the meaning at that point - native iOS tab bars do the same.
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarActiveTintColor: isDark ? uiPalette.blue : '#3B82F6',
        tabBarInactiveTintColor: isDark ? uiPalette.muted : uiPalette.lightMuted,
        // Hide tab bar completely when in prison
        tabBarStyle: (isInPrison || fullscreenApp) ? { display: 'none' } : {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          ...getGlassTabBar(isDark),
          paddingTop: layoutSpace.sm,
          // Sit the icon row lower and tighter. Still clears the home indicator /
          // Android nav bar, but trims the oversized inset padding + tall base
          // height that left the labels floating high with dead space beneath.
          // ~scale(10) is shaved off the inset (24pt clearance on a notched
          // iPhone - plenty), and the base height drops scale(70) → scale(56).
          paddingBottom: Math.max(scale(8), (insets.bottom || 0) - scale(10)),
          // The 24pt icon and the 10pt label do NOT scale, so the row they sit
          // in must not shrink below 56 either: at 320pt scale(56) is ~48 and
          // the labels lost their bottom half (VIS-5).
          height: Math.max(56, scale(56)) + Math.max(scale(8), (insets.bottom || 0) - scale(10)),
        },
        tabBarBackground: () => (
          <View style={{
            flex: 1,
            ...getGlassTabBar(isDark),
            ...Platform.select({
              web: {
                backdropFilter: 'blur(20px) saturate(180%)',
              },
            }),
          }} />
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
          // Disable navigation when in prison
          href: isInPrison ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: t('tabs.work'),
          tabBarIcon: ({ size, color }) => <Briefcase size={size} color={color} />,
          // Always allow work tab (prison screen is shown here)
        }}
      />
      {/* Apps - merged device tab. Shows the phone grid or (once owned) the
          desktop launcher with its own Desktop/Mobile sub-toggle. The bar stays stable; the launcher explains missing devices. Hidden in prison. */}
      <Tabs.Screen
        name="apps"
        options={{
          title: t('tabs.apps') || 'Apps',
          tabBarIcon: ({ size, color }) => <LayoutGrid size={size} color={color} />,
          href: isInPrison ? null : undefined,
        }}
      />
      {/* Life - merged personal tab: a Health / Shop / Stats sub-menu that opens
          on Health, so vitals stay one tap away without their own bar icon. */}
      <Tabs.Screen
        name="life"
        options={{
          title: t('tabs.life') || 'Life',
          tabBarIcon: ({ size, color }) => <Activity size={size} color={color} />,
          href: isInPrison ? null : undefined,
        }}
      />
      {/* The five screens below are no longer their own bottom-bar tabs - they're
          folded into Apps (mobile, computer) and Life (market, health,
          progression). Their routes stay registered with href: null so deep
          links and direct router.push() navigation still resolve; they just
          never render a tab button. Without an explicit entry, expo-router would
          auto-surface each file as a default tab and undo the merge. */}
      <Tabs.Screen
        name="mobile"
        options={{
          href: null,
          title: t('tabs.mobile'),
          tabBarIcon: ({ size, color }) => <Smartphone size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="computer"
        options={{
          href: null,
          title: t('tabs.computer'),
          tabBarIcon: ({ size, color }) => <Monitor size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progression"
        options={{
          href: isInPrison ? null : undefined,
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <UserRound size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          href: null,
          title: t('tabs.market'),
          tabBarIcon: ({ size, color }) => <ShoppingCart size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          href: null,
          title: t('tabs.health'),
          tabBarIcon: ({ size, color }) => <Heart size={size} color={color} />,
        }}
      />
    </Tabs>
    <WeekChangeToast />
    {/* R2-H: render exclusively - both modals are <Modal transparent fade>,
        and on a tick that produces both a life moment AND a weekly event,
        their backdrops stack and taps on the lower one are blocked. Let the
        life moment win first; the weekly event will show after dismissal. */}
    {/* P2-6: suppress these tabs-layer modals while the root-level DeathPopup is
        up. DeathPopup gates its own dismissal, so a transparent LifeMoment/Weekly
        modal underneath would otherwise intercept taps and soft-lock the player.
        Same for the WeddingPopup - a wedding + life-moment landing on one tick
        stacked two full-screen modals. */}
    {showLifeMoment ? (
      <Suspense fallback={null}>
        <LifeMomentModal />
      </Suspense>
    ) : showEventInbox ? (
      <Suspense fallback={null}>
        <WeeklyEventModal />
      </Suspense>
    ) : null}
    {/* Urgent smart notifications (critical/high only) auto-surface after a
        week advance - the authored warning content was manual-only before. */}
    <SmartNotificationTicker />
    {/* Occasional animated premium-pass upsell (gated: unsubscribed + rewards
        already earned & waiting + long cooldown). */}
    <PremiumPassPromo />
    {/* Non-blocking event inbox pill - tap to review decisions on your own time. */}
    {/* Not inside a full-screen app: those have their own bottom nav, and the
        compact pill sat on Spark's Profile tab and the Stocks star buttons
        (VIS-8). The decisions wait - the pill is back the moment the app
        closes. */}
    {showEventPill && !fullscreenApp ? (
      <EventInboxPill
        count={pendingEventCount}
        bottom={scale(88) + insets.bottom}
        onPress={() => setEventInboxOpen(true)}
      />
    ) : null}
    {/* ENGAGEMENT: Floating stat change indicators on week advance. Tracker +
        indicator live in one leaf overlay here (not on Home) so pills fire on
        whichever tab the player is on WITHOUT subscribing this layout to
        every stat mutation. */}
    <StatChangeOverlay />
    {/* Floating "watch ad → cash / vitality" reward orb - mounted at the
        tab-group level so it drifts in over ANY game tab (Home / Work / Apps /
        Life), not just Home. Self-manages its own appear/hide scheduling and
        hides itself during blocking moments (death/wedding/jail) + when ads are
        removed. */}
    <AdRewardOrb />
    <YearEndBreak />
    {/* The Remove Ads OFFER, as a matching circular orb on the same left edge
        (offset below the reward orb). Self-gating: hidden once ads are removed
        or when IAP is disabled, and paced slower than the reward orb. */}
    <RemoveAdsOrb />
    {/* Headless: asks for a store rating once, on a week worth celebrating
        (a ready promotion or a streak bonus), never on a timer. */}
    <InAppReviewPrompt />
    </View>
  );
}
