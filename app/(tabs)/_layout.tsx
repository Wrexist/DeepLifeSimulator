import { Tabs, useRouter, useSegments } from 'expo-router';
import { Platform, View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chrome as Home, Briefcase, Smartphone, ShoppingCart, Heart, Monitor, Trophy, Bell, LayoutGrid, Activity } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale } from '@/utils/scaling';
import { useFullscreenApp } from '@/utils/fullscreenAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { getGlassTabBar } from '@/utils/glassmorphismStyles';
import { haptic } from '@/utils/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useStatChanges } from '@/contexts/StatChangeContext';
import SmartNotificationTicker from '@/components/SmartNotificationTicker';
import PremiumPassPromo from '@/components/PremiumPassPromo';
import { StatChangeIndicator } from '@/components/ui/StatChangeIndicator';
import AdRewardOrb from '@/components/AdRewardOrb';
import { resumeLifeAutosave } from '@/utils/autosaveSuspension';

const WeeklyEventModal = lazy(() => import('@/components/WeeklyEventModal'));
const LifeMomentModal = lazy(() => import('@/components/LifeMomentModal'));
const WeeklyResultSheet = lazy(() => import('@/components/WeeklyResultSheet'));

// The game home tab lives at `home`, NOT the bare `index`. app/index.tsx is the
// boot loader and owns "/"; if a (tabs)/index.tsx existed it would ALSO resolve
// to "/" and — in a production bundle — expo-router silently keeps whichever file
// sorts first by context key ("(tabs)/index" < "index"), dropping the loader and
// rendering the game home at launch (the long-standing launch crash). Anchoring
// the group on `home` keeps "/" unambiguously the loader.
export const unstable_settings = { initialRouteName: 'home' };

interface EventInboxPillProps {
  count: number;
  bottom: number;
  onPress: () => void;
}

// The inbox pill conditional-mounts after weeks with queued events, so it would
// otherwise pop into place with no bridge. On mount it runs a small entrance:
// opacity 0→1 and translateY 8→0 in parallel (200ms, Easing.out(Easing.cubic),
// native driver). Reduce Motion keeps the opacity feedback but drops the
// movement — it renders settled. No exit animation (the conditional unmount is
// acceptable). Tap behavior and copy are unchanged from the inline pill.
function EventInboxPill({ count, bottom, onPress }: EventInboxPillProps) {
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
        alignSelf: 'center',
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
          gap: scale(8),
          paddingVertical: scale(9),
          paddingHorizontal: scale(16),
          borderRadius: scale(999),
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          borderWidth: 1,
          borderColor: 'rgba(96, 165, 250, 0.5)',
        }}
      >
        <Bell size={scale(15)} color="#60A5FA" />
        <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: scale(13) }}>
          {count} decision{count === 1 ? '' : 's'} waiting
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TabLayout() {
  const { gameState } = useGame();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  
  const { isDark } = useTheme();
  const { changes, clearChange } = useStatChanges();

  // R3-S1: being inside the tab tree means a life is in play, so the ambient
  // autosave must be live. Entering the pre-game stack suspends it; this is the
  // counterpart that covers every way back — loading a slot, starting a new
  // life, or simply backing out of SaveSlots without choosing anything. Without
  // this last case the player's progress would silently stop autosaving for the
  // rest of the session.
  useEffect(() => {
    resumeLifeAutosave();
  }, []);

  const isInPrison = (gameState?.jailWeeks ?? 0) > 0;
  // Hide the floating tab bar while an in-phone app runs full-screen.
  const fullscreenApp = useFullscreenApp();
  const currentRoute = segments.length > 0 ? segments[segments.length - 1] : null;
  const items = gameState?.items ?? [];

  // Weekly payoff sheet — shows after a week actually advances during the
  // session (never on app load), and only when the week had something worth
  // reporting. Sits below the death/wedding/life-moment/event modals.
  const [resultWeek, setResultWeek] = useState<number | null>(null);
  const prevWeekRef = useRef<number | null>(null);
  // Player-facing on/off switch (Settings → "Week Summary"). Defaults to on;
  // only an explicit `false` suppresses the recap sheet.
  const weekSummaryEnabled = gameState?.settings?.weeklySummaryEnabled !== false;
  useEffect(() => {
    const w = gameState?.weeksLived ?? 0;
    if (prevWeekRef.current === null) { prevWeekRef.current = w; return; } // first observe
    if (w > prevWeekRef.current) {
      prevWeekRef.current = w;
      const wr = gameState?.weekResult;
      const meaningful = !!wr && (
        (wr.incomeEarned ?? 0) > 0 || (wr.expensesPaid ?? 0) > 0 ||
        (wr.luckyBonus ?? 0) > 0 || (wr.streakBonus ?? 0) > 0 ||
        (wr.careerProgressPercent ?? 0) > 0 || !!wr.cliffhangerTeaser
      );
      if (meaningful && weekSummaryEnabled && !gameState?.showDeathPopup) setResultWeek(w);
    } else {
      prevWeekRef.current = w;
    }
  }, [gameState?.weeksLived, gameState?.weekResult, gameState?.showDeathPopup, weekSummaryEnabled]);

  // Non-blocking weekly-event inbox: events queue but never auto-pop. The
  // player opens them from a pill; the modal walks the queue on demand.
  const [eventInboxOpen, setEventInboxOpen] = useState(false);
  const pendingEventCount = gameState?.pendingEvents?.length ?? 0;
  useEffect(() => {
    if (pendingEventCount === 0 && eventInboxOpen) setEventInboxOpen(false);
  }, [pendingEventCount, eventInboxOpen]);

  const higherModalUp = !!(
    gameState?.showDeathPopup || gameState?.showWeddingPopup ||
    gameState?.lifeMoments?.pendingMoment || eventInboxOpen
  );
  const showWeekResult = resultWeek !== null && !higherModalUp && weekSummaryEnabled;
  // The inbox pill shows when decisions are waiting and nothing else is up.
  const showEventPill = pendingEventCount > 0 && !higherModalUp && !showWeekResult && !isInPrison;

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

  // Determine which tabs to show based on device ownership
  const ownsSmartphone = items.some(
    (item) => item.id === 'smartphone' && item.owned
  );
  const ownsComputer = items.some(
    (item) => item.id === 'computer' && item.owned
  );
  // The merged Apps tab appears in the bar once the player owns any device.
  // (Which launcher shows — phone grid vs desktop — is decided inside apps.tsx.)
  const ownsAnyDevice = ownsSmartphone || ownsComputer;

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenListeners={{ tabPress: () => haptic.light() }}
      screenOptions={{
        headerShown: false,
        // PERF: freeze blurred tab screens (react-native-screens). Every tab
        // screen subscribes to game state, so without this all mounted tabs
        // re-rendered on every state change — 5 hidden screens' worth of work
        // on each "Next Week" press. Frozen screens catch up on focus.
        freezeOnBlur: true,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarActiveTintColor: isDark ? '#60A5FA' : '#3B82F6',
        tabBarInactiveTintColor: isDark ? '#94A3B8' : '#6B7280',
        // Hide tab bar completely when in prison
        tabBarStyle: (isInPrison || fullscreenApp) ? { display: 'none' } : {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          ...getGlassTabBar(isDark),
          paddingTop: scale(8),
          // Sit the icon row lower and tighter. Still clears the home indicator /
          // Android nav bar, but trims the oversized inset padding + tall base
          // height that left the labels floating high with dead space beneath.
          // ~scale(10) is shaved off the inset (24pt clearance on a notched
          // iPhone — plenty), and the base height drops scale(70) → scale(56).
          paddingBottom: Math.max(scale(8), (insets.bottom || 0) - scale(10)),
          height: scale(56) + Math.max(scale(8), (insets.bottom || 0) - scale(10)),
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
      {/* Apps — merged device tab. Shows the phone grid or (once owned) the
          desktop launcher with its own Desktop/Mobile sub-toggle. Hidden from
          the bar until the player owns any device, and while in prison. */}
      <Tabs.Screen
        name="apps"
        options={{
          title: t('tabs.apps') || 'Apps',
          tabBarIcon: ({ size, color }) => <LayoutGrid size={size} color={color} />,
          href: (isInPrison || !ownsAnyDevice) ? null : undefined,
        }}
      />
      {/* Life — merged personal tab: a Health / Shop / Stats sub-menu that opens
          on Health, so vitals stay one tap away without their own bar icon. */}
      <Tabs.Screen
        name="life"
        options={{
          title: t('tabs.life') || 'Life',
          tabBarIcon: ({ size, color }) => <Activity size={size} color={color} />,
          href: isInPrison ? null : undefined,
        }}
      />
      {/* The five screens below are no longer their own bottom-bar tabs — they're
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
          href: null,
          title: t('tabs.progression') || 'Progress',
          tabBarIcon: ({ size, color }) => <Trophy size={size} color={color} />,
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
    {/* R2-H: render exclusively — both modals are <Modal transparent fade>,
        and on a tick that produces both a life moment AND a weekly event,
        their backdrops stack and taps on the lower one are blocked. Let the
        life moment win first; the weekly event will show after dismissal. */}
    {/* P2-6: suppress these tabs-layer modals while the root-level DeathPopup is
        up. DeathPopup gates its own dismissal, so a transparent LifeMoment/Weekly
        modal underneath would otherwise intercept taps and soft-lock the player.
        Same for the WeddingPopup — a wedding + life-moment landing on one tick
        stacked two full-screen modals. */}
    {(gameState.showDeathPopup || gameState.showWeddingPopup) ? null : gameState.lifeMoments?.pendingMoment ? (
      <Suspense fallback={null}>
        <LifeMomentModal />
      </Suspense>
    ) : eventInboxOpen && pendingEventCount > 0 ? (
      <Suspense fallback={null}>
        <WeeklyEventModal />
      </Suspense>
    ) : null}
    {/* Urgent smart notifications (critical/high only) auto-surface after a
        week advance — the authored warning content was manual-only before. */}
    <SmartNotificationTicker />
    {/* Occasional animated premium-pass upsell (gated: unsubscribed + rewards
        already earned & waiting + long cooldown). */}
    <PremiumPassPromo />
    {/* Weekly payoff sheet — the satisfying end-of-week beat. Lowest priority:
        only shows once the modals above have cleared. */}
    {showWeekResult ? (
      <Suspense fallback={null}>
        <WeeklyResultSheet
          visible={showWeekResult}
          gameState={gameState}
          onClose={() => setResultWeek(null)}
        />
      </Suspense>
    ) : null}
    {/* Non-blocking event inbox pill — tap to review decisions on your own time. */}
    {showEventPill ? (
      <EventInboxPill
        count={pendingEventCount}
        bottom={scale(88) + insets.bottom}
        onPress={() => setEventInboxOpen(true)}
      />
    ) : null}
    {/* ENGAGEMENT: Floating stat change indicators on week advance */}
    <StatChangeIndicator changes={changes} onAnimationComplete={clearChange} />
    {/* Floating "watch ad → cash / vitality" reward orb — mounted at the
        tab-group level so it drifts in over ANY game tab (Home / Work / Apps /
        Life), not just Home. Self-manages its own appear/hide scheduling and
        hides itself during blocking moments (death/wedding/jail) + when ads are
        removed. */}
    <AdRewardOrb />
    </View>
  );
}
