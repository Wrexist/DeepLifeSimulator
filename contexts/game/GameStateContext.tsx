import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { GameState, ChildInfo } from './types';
import { logger } from '@/utils/logger';
import { simulateChildToAge } from '@/lib/legacy/childSimulation';
import { safeSetItem } from '@/utils/safeStorage';
import { REVIVE_GEM_COST } from '@/lib/config/gameConstants';
import { GameStoreContext, GameStore } from './useGameSelector';

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

  // --- Selector channel (Sprint 2) -----------------------------------------
  // An external-store mirror of `gameState` so `useGameSelector` consumers can
  // subscribe to slices and re-render only when their slice changes. This is
  // purely additive — `useGameState()`/`useGame()` below are unchanged.
  const mirrorRef = useRef<{ state: GameState; listeners: Set<() => void> } | null>(null);
  if (mirrorRef.current === null) {
    mirrorRef.current = { state: gameState, listeners: new Set() };
  } else {
    // Keep the mirror in sync synchronously so getSnapshot never tears.
    mirrorRef.current.state = gameState;
  }
  // Stable store object (created once) — its identity never changes, so the
  // GameStoreContext provider never causes re-renders on its own. Its
  // setGameState forwards through a ref to the wrapped setter declared below
  // (stable useCallback), giving write access without a state subscription.
  const setterRef = useRef<React.Dispatch<React.SetStateAction<GameState>>>(() => {});
  const storeRef = useRef<GameStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = {
      subscribe: (listener: () => void) => {
        mirrorRef.current!.listeners.add(listener);
        return () => {
          mirrorRef.current!.listeners.delete(listener);
        };
      },
      getSnapshot: () => mirrorRef.current!.state,
      setGameState: (update) => setterRef.current(update),
    };
  }
  // Notify selector subscribers after the source-of-truth commit.
  useLayoutEffect(() => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    mirror.state = gameState;
    mirror.listeners.forEach((l) => l());
  }, [gameState]);
  // -------------------------------------------------------------------------

  // Wrapper for setGameState — respects user's dark mode preference (no longer forced).
  // CRITICAL: short-circuit on identity. Actions use `return prev` to mean "no change"
  // (e.g. rejecting an overdraw); bumping updatedAt on no-ops cascades whole-app re-renders.
  const wrappedSetGameState = React.useCallback<React.Dispatch<React.SetStateAction<GameState>>>(
    (update) => {
      setGameState(prev => {
        const newState = typeof update === 'function' ? update(prev) : update;
        if (newState === prev) return prev;
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
  // Keep the store's forwarding setter pointed at the wrapped setter.
  setterRef.current = wrappedSetGameState;

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
    // Use the shared constant the DeathPopup gates on, so the button enable
    // condition and the actual charge can never drift apart (L8).
    const reviveCost = REVIVE_GEM_COST;

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
        // P2-3: cure active diseases on revive. Without this, a disease that
        // caused the death is still present at full severity and re-applies its
        // lethal penalty on the very next tick — re-killing the player and
        // consuming another 15,000-gem revive with no progress.
        diseases: [],
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
    <GameStoreContext.Provider value={storeRef.current}>
      <GameStateContext.Provider value={value}>
        {children}
      </GameStateContext.Provider>
    </GameStoreContext.Provider>
  );
}

