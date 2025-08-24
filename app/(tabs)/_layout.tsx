import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { Chrome as Home, Briefcase, Smartphone, ShoppingCart, Heart, Monitor } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

export default function TabLayout() {
  const { gameState } = useGame();
  const { width } = useWindowDimensions();

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
        tabBarShowLabel: width > 400,
        tabBarActiveTintColor: gameState.settings.darkMode ? '#60A5FA' : '#3B82F6',
        tabBarInactiveTintColor: gameState.settings.darkMode ? '#9CA3AF' : '#6B7280',
        tabBarStyle: {
          backgroundColor: gameState.settings.darkMode ? '#1F2937' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: gameState.settings.darkMode ? '#374151' : '#E5E7EB',
          paddingTop: 5,
          paddingBottom: 5,
          height: 60,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: 'Work',
          tabBarIcon: ({ size, color }) => <Briefcase size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mobile"
        options={{
          // Hide until a smartphone is owned
          href: ownsSmartphone ? undefined : null,
          title: 'Mobile',
          tabBarIcon: ({ size, color }) => <Smartphone size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="computer"
        options={{
          // Hide until a computer is owned
          href: ownsComputer ? undefined : null,
          title: 'Computer',
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
          title: 'Market',
          tabBarIcon: ({ size, color }) => <ShoppingCart size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: 'Health',
          tabBarIcon: ({ size, color }) => <Heart size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
