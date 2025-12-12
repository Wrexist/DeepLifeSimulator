import { useWindowDimensions } from 'react-native';
import { getTopStatsBarHeight } from '@/utils/topStatsBarUtils';
import { useGame } from '@/contexts/GameContext';
import { useSegments } from 'expo-router';

/**
 * Hook to get the TopStatsBar height for proper content spacing
 * Returns 0 if TopStatsBar is not visible (onboarding, etc.)
 */
export function useTopStatsBarHeight(): number {
  const { width } = useWindowDimensions();
  const segments = useSegments();
  const { gameState } = useGame();
  
  // Check if we're in main game tabs
  const isMainGame = segments[0] === '(tabs)';
  const isOnboarding = segments[0] === '(onboarding)' || segments[0] === 'index' || segments[0] === 'preview';
  const showStatsBar = isMainGame && !isOnboarding && gameState?.stats;
  
  if (!showStatsBar) return 0;
  
  return getTopStatsBarHeight(width);
}

