/**
 * useTheme — themed colours for the current dark-mode setting.
 *
 * Usage:
 *   const { theme, isDark } = useTheme();
 *   <View style={{ backgroundColor: theme.background }}>
 *     <Text style={{ color: theme.text }}>Hello</Text>
 *   </View>
 *
 * ## Why this uses a selector
 *
 * This took the ENTIRE `GameStateContext` subscription to read one boolean.
 * 64 files call it, so 64 components re-rendered on every state commit —
 * including every weekly tick — no matter how carefully they were written.
 *
 * That silently cancelled work already done elsewhere. `app/(tabs)/home.tsx`
 * builds a 20-key facade selector with `shallowEqual` and then calls
 * `useTheme()` on the next line; `components/AdRewardOrb.tsx` was narrowed to
 * two booleans under audit item PERF-7, has a dedicated guard test, and then
 * calls `useTheme()` too. Both were paying full price regardless.
 *
 * Selecting the boolean directly fixes all 64 at once: `useGameSelector`
 * compares with `Object.is`, and a boolean is stable, so the subscription only
 * fires when dark mode actually changes.
 *
 * Import from the LEAF module (`@/contexts/game/useGameSelector`), never the
 * `@/contexts/GameContext` barrel — the barrel's `export *` drags
 * `GameProvider → IAPHandler` in and caused the production Hermes
 * "Element type is invalid" crash documented atop `hooks/useTranslation.ts`.
 */

import { useMemo } from 'react';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { colors, getThemeColors } from '@/lib/config/theme';

export type ThemeColors = typeof colors.dark;

export function useTheme() {
  // Default to dark, matching the previous `!== false` reading exactly.
  const isDark = useGameSelector((s) => s.settings?.darkMode !== false);

  const theme = useMemo(() => getThemeColors(isDark), [isDark]);

  return { theme, isDark, colors } as const;
}
