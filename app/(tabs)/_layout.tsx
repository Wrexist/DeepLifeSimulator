import { Tabs, useRouter, useSegments } from 'expo-router';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chrome as Home, Briefcase, Smartphone, ShoppingCart, Heart, Monitor, Trophy, Bell } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale } from '@/utils/scaling';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { getGlassTabBar } from '@/utils/glassmorphismStyles';
import { haptic } from '@/utils/haptics';
import { useStatChanges } from '@/contexts/StatChangeContext';
import { StatChangeIndicator } from '@/components/ui/StatChangeIndicator';

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

export default function TabLayout() {
  const { gameState } = useGame();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  
  const { isDark } = useTheme();
  const { changes, clearChange } = useStatChanges();

  const isInPrison = (gameState?.jailWeeks ?? 0) > 0;
  const currentRoute = segments.length > 0 ? segments[segments.length - 1] : null;
  const items = gameState?.items ?? [];

  // Weekly payoff sheet — shows after a week actually advances during the
  // session (never on app load), and only when the week had something worth
  // reporting. Sits below the death/wedding/life-moment/event modals.
  const [resultWeek, setResultWeek] = useState<number | null>(null);
  const prevWeekRef = useRef<number | null>(null);
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
      if (meaningful && !gameState?.showDeathPopup) setResultWeek(w);
    } else {
      prevWeekRef.current = w;
    }
  }, [gameState?.weeksLived, gameState?.weekResult, gameState?.showDeathPopup]);

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
  const showWeekResult = resultWeek !== null && !higherModalUp;
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
  // Hide mobile tab if computer is owned (mobile apps accessible through desktop)
  const showMobileTab = ownsSmartphone && !ownsComputer;

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
        tabBarInactiveTintColor: isDark ? '#9CA3AF' : '#6B7280',
        // Hide tab bar completely when in prison
        tabBarStyle: isInPrison ? { display: 'none' } : {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          ...getGlassTabBar(isDark),
          paddingTop: scale(12),
          // Account for the bottom safe area (Android navigation bar / iOS
          // home indicator). Both platforms need the inset — omitting it on
          // iOS left the bar short on notched iPhones.
          paddingBottom: Math.max(scale(12), insets.bottom || 0),
          height: scale(70) + (insets.bottom || 0),
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
      <Tabs.Screen
        name="mobile"
        options={{
          // Hide until a smartphone is owned, hide if computer is owned (mobile apps in desktop tab), or disable when in prison
          href: (isInPrison || !showMobileTab) ? null : undefined,
          title: t('tabs.mobile'),
          tabBarIcon: ({ size, color }) => <Smartphone size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="computer"
        options={{
          // Hide until a computer is owned, or disable when in prison
          href: (isInPrison || !ownsComputer) ? null : undefined,
          title: t('tabs.computer'),
          tabBarIcon: ({ size, color }) => <Monitor size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progression"
        options={{
          // Hidden from the bottom nav — the route still exists for direct
          // navigation, but it's no longer surfaced as a tab.
          href: null,
          title: t('tabs.progression') || 'Progress',
          tabBarIcon: ({ size, color }) => <Trophy size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: t('tabs.market'),
          tabBarIcon: ({ size, color }) => <ShoppingCart size={size} color={color} />,
          // Disable navigation when in prison
          href: isInPrison ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: t('tabs.health'),
          tabBarIcon: ({ size, color }) => <Heart size={size} color={color} />,
          // Disable navigation when in prison
          href: isInPrison ? null : undefined,
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
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setEventInboxOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${pendingEventCount} decision${pendingEventCount === 1 ? '' : 's'} waiting`}
        style={{
          position: 'absolute',
          bottom: scale(88) + insets.bottom,
          alignSelf: 'center',
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
          {pendingEventCount} decision{pendingEventCount === 1 ? '' : 's'} waiting
        </Text>
      </TouchableOpacity>
    ) : null}
    {/* ENGAGEMENT: Floating stat change indicators on week advance */}
    <StatChangeIndicator changes={changes} onAnimationComplete={clearChange} />
    </View>
  );
}
