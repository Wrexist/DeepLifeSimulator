/**
 * Game Contexts - Split from monolithic GameContext
 * 
 * This module exports 4 focused contexts:
 * 1. GameStateContext - Core game state management
 * 2. GameActionsContext - All game action functions
 * 3. GameUIContext - UI state (loading, modals, etc.)
 * 4. GameDataContext - Static data and utilities
 * 
 * Usage:
 * ```tsx
 * import { GameProvider, useGame } from '@/contexts/game';
 * 
 * // In your app
 * <GameProvider>
 *   <YourApp />
 * </GameProvider>
 * 
 * // In components
 * const { gameState, updateMoney } = useGame();
 * ```
 */

// Export types
// Combined provider and hook for backward compatibility
import { useGameState } from './GameStateContext';
import { useGameActions } from './GameActionsContext';
import { useGameUI } from './GameUIContext';
import { useGameData } from './GameDataContext';

export * from './types';

// Export contexts
export { GameStateProvider, useGameState } from './GameStateContext';
export { GameActionsProvider, useGameActions } from './GameActionsContext';
export { GameUIProvider, useGameUI } from './GameUIContext';
export { GameDataProvider, useGameData } from './GameDataContext';

// Export initial state
export { initialGameState, STATE_VERSION } from './initialState';

// Export GameProvider from separate .tsx file (contains JSX)
export { GameProvider } from './GameProvider';

/**
 * Combined hook that provides access to all game contexts
 * This maintains backward compatibility with existing useGame() calls
 */
export function useGame() {
  const gameState = useGameState();
  const gameActions = useGameActions();
  const gameUI = useGameUI();
  const gameData = useGameData();

  return {
    ...gameState,
    ...gameActions,
    ...gameUI,
    ...gameData,
  };
}
