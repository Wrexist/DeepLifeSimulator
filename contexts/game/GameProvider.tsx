/**
 * Combined GameProvider component
 * This maintains backward compatibility with existing code
 */
import React, { ReactNode } from 'react';
import { GameStateProvider } from './GameStateContext';
import { GameActionsProvider } from './GameActionsContext';
import { GameUIProvider } from './GameUIContext';
import { GameDataProvider } from './GameDataContext';
import { initialGameState, STATE_VERSION } from './initialState';
import { GameState } from './types';

/**
 * Combined GameProvider that wraps all game contexts
 * This maintains backward compatibility with existing code
 */
export function GameProvider({ 
  children, 
  initialState = initialGameState 
}: { 
  children: ReactNode;
  initialState?: GameState;
}) {
  return (
    <GameDataProvider initialState={initialState} stateVersion={STATE_VERSION}>
      <GameStateProvider initialState={initialState}>
        <GameUIProvider>
          <GameActionsProvider>
            {children}
          </GameActionsProvider>
        </GameUIProvider>
      </GameStateProvider>
    </GameDataProvider>
  );
}

