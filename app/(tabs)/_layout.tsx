import { Tabs, useRouter, useSegments } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chrome as Home, Briefcase, Smartphone, ShoppingCart, Heart, Monitor, Trophy } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale } from '@/utils/scaling';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import React, { useEffect, lazy, Suspense } from 'react';
import { getGlassTabBar } from '@/utils/glassmorphismStyles';
import { haptic } from '@/utils/haptics';
import { useStatChanges } from '@/contexts/StatChangeContext';
import { StatChangeIndicator } from '@/components/ui/StatChangeIndicator';

const WeeklyEventModal = lazy(() => import('@/components/WeeklyEventModal'));
const LifeMomentModal = lazy(() => import('@/components/LifeMomentModal'));

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
          // Account for bottom safe area (navigation bar) on Android
          // Use at least scale(12) but add bottom inset if it exists
          paddingBottom: Platform.OS === 'android' 
            ? Math.max(scale(12), insets.bottom || 0)
            : scale(12),
          // Add bottom inset to height to prevent overlap with navigation bar
          height: Platform.OS === 'android'
            ? scale(70) + (insets.bottom || 0)
            : scale(70),
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
        name="index"
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
          title: t('tabs.progression') || 'Progress',
          tabBarIcon: ({ size, color }) => <Trophy size={size} color={color} />,
          href: isInPrison ? null : undefined,
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
    {gameState.pendingEvents && gameState.pendingEvents.length > 0 && (
      <Suspense fallback={null}>
        <WeeklyEventModal />
      </Suspense>
    )}
    {gameState.lifeMoments?.pendingMoment && (
      <Suspense fallback={null}>
        <LifeMomentModal />
      </Suspense>
    )}
    {/* ENGAGEMENT: Floating stat change indicators on week advance */}
    <StatChangeIndicator changes={changes} onAnimationComplete={clearChange} />
    </View>
  );
}
