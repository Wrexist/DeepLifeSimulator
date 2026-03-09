/**
 * Game Contexts - Split from monolithic GameContext
 *
 * This module exports focused contexts + selector hooks:
 * 1. GameStateContext - Core game state management
 * 2. GameActionsContext - All game action functions
 * 3. GameUIContext - UI state (loading, modals, etc.)
 * 4. GameDataContext - Static data and utilities
 *
 * Performance: Use specific hooks (useGameStats, useMoneyActions, etc.)
 * instead of the combined useGame() hook whenever possible.
 *
 * Usage:
 * ```tsx
 * import { useGameState, useMoneyActions } from '@/contexts/game';
 *
 * // Targeted subscription — only re-renders when relevant state changes
 * const { gameState } = useGameState();
 * const { updateMoney } = useMoneyActions();
 * ```
 */

import { useMemo } from 'react';

// Combined provider and hook for backward compatibility
import { useGameState } from './GameStateContext';
import { useGameActions } from './GameActionsContext';
import { useGameUI } from './GameUIContext';
import { useGameData } from './GameDataContext';
import { useItemActions } from './ItemActionsContext';
import { useMoneyActions } from './MoneyActionsContext';
import { useJobActions } from './JobActionsContext';
import { useSocialActions } from './SocialActionsContext';
import { useCompanyActions } from './CompanyActionsContext';

export * from './types';

// Export contexts
export { GameStateProvider, useGameState } from './GameStateContext';
export { GameActionsProvider, useGameActions } from './GameActionsContext';
export { GameUIProvider, useGameUI } from './GameUIContext';
export { GameDataProvider, useGameData } from './GameDataContext';
export { ItemActionsProvider, useItemActions } from './ItemActionsContext';
export { MoneyActionsProvider, useMoneyActions } from './MoneyActionsContext';
export { JobActionsProvider, useJobActions } from './JobActionsContext';
export { SocialActionsProvider, useSocialActions } from './SocialActionsContext';
export { CompanyActionsProvider, useCompanyActions } from './CompanyActionsContext';

// Export initial state
export { initialGameState, STATE_VERSION } from './initialState';

// Export GameProvider from separate .tsx file (contains JSX)
export { GameProvider } from './GameProvider';

// ─── Selector Hooks ────────────────────────────────────────────────────
// These return memoized slices of game state. Components that only need
// a specific slice should prefer these over useGame() to reduce re-renders.

/** Returns core stats: health, happiness, energy, fitness, money, reputation, gems */
export function useGameStats() {
  const { gameState } = useGameState();
  return useMemo(() => gameState.stats, [gameState.stats]);
}

/** Returns money value only */
export function useGameMoney() {
  const { gameState } = useGameState();
  return gameState.stats.money;
}

/** Returns character age */
export function useGameAge() {
  const { gameState } = useGameState();
  return gameState.date.age;
}

/** Returns relationships array */
export function useGameRelationships() {
  const { gameState } = useGameState();
  return gameState.relationships;
}

/** Returns career/job state */
export function useGameCareer() {
  const { gameState } = useGameState();
  return useMemo(() => ({
    currentJob: gameState.currentJob,
    educations: gameState.educations,
  }), [gameState.currentJob, gameState.educations]);
}

/** Returns prestige state */
export function useGamePrestige() {
  const { gameState } = useGameState();
  return gameState.prestige;
}

/**
 * Combined hook that provides access to all game contexts.
 * Prefer specific hooks (useGameState, useMoneyActions, etc.) for better performance.
 */
export function useGame() {
  const gameState = useGameState();
  const gameActions = useGameActions();
  const gameUI = useGameUI();
  const gameData = useGameData();
  const itemActions = useItemActions();
  const moneyActions = useMoneyActions();
  const jobActions = useJobActions();
  const socialActions = useSocialActions();
  const companyActions = useCompanyActions();

  return useMemo(() => ({
    ...gameState,
    ...gameActions,
    ...gameUI,
    ...gameData,
    ...itemActions,
    ...moneyActions,
    ...jobActions,
    ...socialActions,
    ...companyActions,
  }), [gameState, gameActions, gameUI, gameData, itemActions, moneyActions, jobActions, socialActions, companyActions]);
}
