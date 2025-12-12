import React, { createContext, useContext, ReactNode } from 'react';
import { GameState } from './types';

interface GameDataContextType {
  initialState: GameState;
  STATE_VERSION: number;
  getLifeStage: (age: number) => 'child' | 'teen' | 'adult' | 'senior';
  addWeekToAge: (age: number) => number;
}

const GameDataContext = createContext<GameDataContextType | undefined>(undefined);

export function useGameData() {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error('useGameData must be used within GameDataProvider');
  }
  return context;
}

interface GameDataProviderProps {
  children: ReactNode;
  initialState: GameState;
  stateVersion: number;
}

const getLifeStage = (age: number): 'child' | 'teen' | 'adult' | 'senior' => {
  if (age < 13) return 'child';
  if (age < 20) return 'teen';
  if (age < 65) return 'adult';
  return 'senior';
};

const addWeekToAge = (age: number): number => {
  const weeks = Math.round(age * 52);
  return (weeks + 1) / 52;
};

export function GameDataProvider({ 
  children, 
  initialState, 
  stateVersion 
}: GameDataProviderProps) {
  const value: GameDataContextType = {
    initialState,
    STATE_VERSION: stateVersion,
    getLifeStage,
    addWeekToAge,
  };

  return (
    <GameDataContext.Provider value={value}>
      {children}
    </GameDataContext.Provider>
  );
}

