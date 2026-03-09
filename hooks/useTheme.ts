/**
 * useTheme — Provides themed colors based on the current dark mode setting.
 *
 * Usage:
 *   const { theme, isDark } = useTheme();
 *   <View style={{ backgroundColor: theme.background }}>
 *     <Text style={{ color: theme.text }}>Hello</Text>
 *   </View>
 */

import { useMemo } from 'react';
import { useGameState } from '@/contexts/game/GameStateContext';
import { colors, getThemeColors } from '@/lib/config/theme';

export type ThemeColors = typeof colors.dark;

export function useTheme() {
  const { gameState } = useGameState();
  const isDark = gameState.settings?.darkMode !== false; // Default to dark

  const theme = useMemo(() => getThemeColors(isDark), [isDark]);

  return { theme, isDark, colors } as const;
}
