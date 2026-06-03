/**
 * usePulseTheme — memoized Pulse theme bundle for the active dark/light mode.
 *
 * Reads `gameState.settings.darkMode` from the game context and returns the
 * resolved theme (gradient, density, motion, text, border, pulse colors,
 * plus the base global theme). Components depend on this single hook so
 * mode-switching cascades through the whole app at once.
 */
import { useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { resolvePulseTheme, type PulseTheme } from '../styles/pulseTheme';

export function usePulseTheme(): PulseTheme {
  const { gameState } = useGame();
  const darkMode = gameState?.settings?.darkMode ?? true;
  return useMemo(() => resolvePulseTheme(darkMode), [darkMode]);
}
