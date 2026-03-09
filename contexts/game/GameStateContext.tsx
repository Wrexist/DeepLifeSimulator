import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { GameState, ChildInfo } from './types';
import { logger } from '@/utils/logger';
import { simulateChildToAge } from '@/lib/legacy/childSimulation';
import { safeSetItem } from '@/utils/safeStorage';

interface GameStateContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updateGameState: React.Dispatch<React.SetStateAction<GameState>>;
  currentSlot: number;
  setCurrentSlot: (slot: number) => void;
  startNewLifeFromLegacy: (childId: string) => void;
  reviveCharacter: () => void;
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

  // Wrapper for setGameState — respects user's dark mode preference (no longer forced)
  const wrappedSetGameState = React.useCallback<React.Dispatch<React.SetStateAction<GameState>>>(
    (update) => {
      setGameState(prev => {
        const newState = typeof update === 'function' ? update(prev) : update;
        const now = Date.now();
        const nextUpdatedAt = Math.max(now, (prev.updatedAt || 0) + 1);
        return {
          ...newState,
          updatedAt: nextUpdatedAt,
        };
      });
    },
    []
  );

  const setCurrentSlotSafe = useCallback((slot: number) => {
    const normalizedSlot = slot >= 1 && slot <= 3 ? slot : 1;
    setCurrentSlot(normalizedSlot);
    // Keep both keys in sync for legacy consumers.
    void safeSetItem('currentSlot', String(normalizedSlot));
    void safeSetItem('lastSlot', String(normalizedSlot));
  }, []);

  useEffect(() => {
    // Persist active slot on mount and whenever it changes.
    void safeSetItem('currentSlot', String(currentSlot));
  }, [currentSlot]);

  // Alias for backwards compatibility
  const updateGameState = wrappedSetGameState;

  // Start new life from legacy (continue as child)
  // Uses functional update to avoid stale state closures
  const startNewLifeFromLegacy = useCallback((childId: string) => {
    wrappedSetGameState(prev => {
      try {
        const children = prev.family?.children || [];
        const selectedChild = children.find(c => c.id === childId) as ChildInfo | undefined;

        if (!selectedChild) {
          logger.error('[startNewLifeFromLegacy] Child not found:', childId);
          return prev;
        }

        // Simulate child to age 18 if they're younger
        let childForLegacy = selectedChild;
        if ((selectedChild.age || 0) < 18) {
          childForLegacy = simulateChildToAge(selectedChild, prev, 18);
          logger.info(`[startNewLifeFromLegacy] Simulated child ${childForLegacy.name} to age 18`);
        }

        // Continue as child WITHOUT prestiging (only increment generation)
        const { continueAsChild } = require('@/lib/prestige/prestigeExecution');
        const newGameState = continueAsChild(prev, childId);

        logger.info(`[startNewLifeFromLegacy] Started new life as child: ${childForLegacy.name}`);
        return newGameState;
      } catch (error) {
        logger.error('[startNewLifeFromLegacy] Error:', error);
        return prev;
      }
    });
  }, [wrappedSetGameState]);

  // Revive character
  // Uses functional update to avoid stale state closures
  const reviveCharacter = useCallback(() => {
    const reviveCost = 15000;

    wrappedSetGameState(prev => {
      if ((prev.stats.gems || 0) < reviveCost) {
        logger.warn('[reviveCharacter] Not enough gems to revive');
        return prev;
      }

      logger.info('[reviveCharacter] Character revived');
      return {
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
        stats: {
          ...prev.stats,
          health: 100,
          happiness: 100,
          energy: 100,
          gems: (prev.stats.gems || 0) - reviveCost,
        },
        happinessZeroWeeks: 0,
        healthZeroWeeks: 0,
      };
    });
  }, [wrappedSetGameState]);

  const value = useMemo<GameStateContextType>(() => ({
    gameState,
    setGameState: wrappedSetGameState,
    updateGameState,
    currentSlot,
    setCurrentSlot: setCurrentSlotSafe,
    startNewLifeFromLegacy,
    reviveCharacter,
  }), [gameState, wrappedSetGameState, updateGameState, currentSlot, setCurrentSlotSafe, startNewLifeFromLegacy, reviveCharacter]);

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

