import { Tabs, useRouter, useSegments } from 'expo-router';
import { useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chrome as Home, Briefcase, Smartphone, ShoppingCart, Heart, Monitor } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { responsiveIconSize, touchTargets, scale } from '@/utils/scaling';
import { useTranslation } from '@/hooks/useTranslation';
import { useEffect } from 'react';

export default function TabLayout() {
  const { gameState } = useGame();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  
  const isInPrison = gameState.jailWeeks > 0;
  const currentRoute = segments.length > 0 ? segments[segments.length - 1] : null;

  // Force navigation to work tab when entering prison
  useEffect(() => {
    if (isInPrison && currentRoute && currentRoute !== 'work') {
      // Small delay to ensure navigation happens after state update
      const timer = setTimeout(() => {
        try {
          router.replace('/(tabs)/work');
        } catch (error) {
          // Navigation might fail if already navigating, ignore
          if (__DEV__) {
            console.warn('Navigation to work tab failed:', error);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInPrison, currentRoute, router]);

  // Determine which tabs to show based on device ownership
  const ownsSmartphone = gameState.items.some(
    (item) => item.id === 'smartphone' && item.owned
  );
  const ownsComputer = gameState.items.some(
    (item) => item.id === 'computer' && item.owned
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: gameState.settings.darkMode ? '#60A5FA' : '#3B82F6',
        tabBarInactiveTintColor: gameState.settings.darkMode ? '#9CA3AF' : '#6B7280',
        // Hide tab bar completely when in prison
        tabBarStyle: isInPrison ? { display: 'none' } : {
          backgroundColor: gameState.settings.darkMode ? '#1F2937' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: gameState.settings.darkMode ? '#374151' : '#E5E7EB',
          paddingTop: scale(8),
          // Account for bottom safe area (navigation bar) on Android
          // Use at least scale(8) but add bottom inset if it exists
          paddingBottom: Platform.OS === 'android' 
            ? Math.max(scale(8), insets.bottom || 0)
            : scale(8),
          // Add bottom inset to height to prevent overlap with navigation bar
          height: Platform.OS === 'android'
            ? scale(60) + (insets.bottom || 0)
            : scale(60),
        },
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
          // Hide until a smartphone is owned, or disable when in prison
          href: (isInPrison || !ownsSmartphone) ? null : undefined,
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
      {/* Hidden progression screen - accessible but not shown in tab bar */}
      <Tabs.Screen
        name="progression"
        options={{ href: null }}
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
  );
}
