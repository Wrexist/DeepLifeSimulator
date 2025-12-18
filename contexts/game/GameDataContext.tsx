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
  // CRITICAL FIX: Improve precision by using more precise calculation
  // Store age as decimal years, but calculate with higher precision
  if (typeof age !== 'number' || isNaN(age) || age < 0) {
    return 0; // Return 0 for invalid ages
  }
  // Use more precise calculation: age in years * 52 + 1 week, then convert back
  // This reduces floating-point error accumulation
  const totalWeeks = Math.round(age * 52) + 1;
  // Round to 4 decimal places to maintain reasonable precision
  return Math.round((totalWeeks / 52) * 10000) / 10000;
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

