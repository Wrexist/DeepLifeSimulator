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
  /** Spend a banked Revival Pack (MON-5). No-op unless dead AND one is banked. */
  reviveWithPack: () => void;
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

  // NO mount-effect write here. There used to be one — `void safeSetItem(
  // 'currentSlot', String(currentSlot))` on every change INCLUDING the first —
  // and since `initialSlot` defaults to 1 and `GameProvider` never passes it,
  // every launch overwrote the marker the previous session left with "1"
  // before any load had run. The key looked authoritative and always read 1.
  // Two consumers prefer it over `lastSlot`: CloudSyncService uploaded under
  // slot_1, and IAPService credited a purchase to slot 1's save — so a paying
  // player's real slot never received what they bought.
  // `setCurrentSlotSafe` already persists on every real change, so the effect
  // only ever added the boot-time clobber. 2026-07-29 audit SAVE-OW-5.

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
      /**
       * R4-MON-2: the character must still be DEAD.
       *
       * The affordability half of this gate was already re-checked against
       * `prev`, but nothing re-checked `showDeathPopup`. `handleRevive` has no
       * in-flight guard and its button carries only
       * `disabled={!canAffordRevive}`, computed from a stale render snapshot —
       * and this provider is a plain `useState`, so two taps landing in one
       * React batch both passed the outer gate and both updaters ran. The
       * second saw `prev.gems` still above the cost (30,000 -> 15,000 -> 0) and
       * charged again.
       *
       * REVIVE_GEM_COST is 15,000 and the 15,000-gem pack retails at $49.99, so
       * a double tap cost a player real money for one revive, with nothing in
       * state marking the second charge as anomalous. CLAUDE.md §4.4.
       */
      if (!prev.showDeathPopup) {
        logger.warn('[reviveCharacter] Ignored: character is not currently dead');
        return prev;
      }

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

  /**
   * Spend a banked Revival Pack instead of gems (MON-5).
   *
   * The $2.99 pack used to revive at the INSTANT of purchase: `applyBenefit`
   * wrote health/happiness/energy straight onto the state and cleared the death
   * popup. Bought while alive — which is when the store is reachable — that was
   * a permanent no-op. The player paid and received nothing, forever.
   *
   * `revivalPack: boolean` has been on GameState since the beginning with a
   * default of `false`, read by nothing and written by nothing. It is exactly
   * the shape the owner chose (2026-08-02: one banked revive, consumed on
   * death), so the fix is to start using the field rather than adding one.
   *
   * Atomic in the same way `reviveCharacter` above is, and for the same reason
   * (§4.4): BOTH gates and the decrement live inside one updater. This provider
   * is a plain `useState`, so two taps in one React batch both clear the outer
   * render's `disabled` check — and a pack consumed twice is a free extra life,
   * the mirror of the double-charge bug that shape already caused here once.
   */
  const reviveWithPack = useCallback(() => {
    wrappedSetGameState(prev => {
      if (!prev.showDeathPopup) {
        logger.warn('[reviveWithPack] Ignored: character is not currently dead');
        return prev;
      }

      if (!prev.revivalPack) {
        logger.warn('[reviveWithPack] Ignored: no banked Revival Pack');
        return prev;
      }

      logger.info('[reviveWithPack] Revival Pack consumed');
      return {
        ...prev,
        revivalPack: false,
        showDeathPopup: false,
        deathReason: undefined,
        // Same P2-3 disease cure as the gem revive. Without it the disease that
        // killed the player re-applies its lethal penalty on the next tick and
        // eats the revive for nothing — which for a PAID one-shot is worse.
        diseases: [],
        stats: {
          ...prev.stats,
          health: 100,
          happiness: 100,
          energy: 100,
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
    reviveWithPack,
  }), [gameState, wrappedSetGameState, updateGameState, currentSlot, setCurrentSlotSafe, startNewLifeFromLegacy, reviveCharacter, reviveWithPack]);

  return (
    <GameStoreContext.Provider value={storeRef.current}>
      <GameStateContext.Provider value={value}>
        {children}
      </GameStateContext.Provider>
    </GameStoreContext.Provider>
  );
}

