import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GameState } from './types';

interface GameStateContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updateGameState: React.Dispatch<React.SetStateAction<GameState>>;
  currentSlot: number;
  setCurrentSlot: (slot: number) => void;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider');
  }
  return context;
}

interface GameStateProviderProps {
  children: ReactNode;
  initialState: GameState;
  initialSlot?: number;
}

export function GameStateProvider({ 
  children, 
  initialState, 
  initialSlot = 1 
}: GameStateProviderProps) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [currentSlot, setCurrentSlot] = useState<number>(initialSlot);

  // Wrapper for setGameState that ensures type safety
  const updateGameState = React.useCallback<React.Dispatch<React.SetStateAction<GameState>>>(
    (update) => {
      setGameState(update);
    },
    []
  );

  const value: GameStateContextType = {
    gameState,
    setGameState,
    updateGameState,
    currentSlot,
    setCurrentSlot,
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

