import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { GameState } from '@/contexts/GameContext';

// Performance optimization utilities
export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private memoizedValues = new Map<string, any>();
  private lastUpdateTime = 0;
  private updateThrottle = 16; // ~60fps

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  // Throttle state updates to prevent excessive re-renders
  shouldUpdate(): boolean {
    const now = Date.now();
    if (now - this.lastUpdateTime > this.updateThrottle) {
      this.lastUpdateTime = now;
      return true;
    }
    return false;
  }

  // Memoize expensive calculations
  memoize<T>(key: string, fn: () => T, deps: any[]): T {
    const depKey = deps.map(d => JSON.stringify(d)).join('|');
    const cacheKey = `${key}_${depKey}`;
    
    if (this.memoizedValues.has(cacheKey)) {
      return this.memoizedValues.get(cacheKey);
    }
    
    const result = fn();
    this.memoizedValues.set(cacheKey, result);
    return result;
  }

  // Clear memoized values when needed
  clearMemoized(): void {
    this.memoizedValues.clear();
  }
}

// Optimized selectors for GameState
export const createGameStateSelectors = () => {
  const selectStats = (gameState: GameState) => gameState.stats;
  const selectSettings = (gameState: GameState) => gameState.settings;
  const selectItems = (gameState: GameState) => gameState.items;
  const selectRelationships = (gameState: GameState) => gameState.relationships;
  const selectPets = (gameState: GameState) => gameState.pets;
  const selectCompanies = (gameState: GameState) => gameState.companies;
  const selectRealEstate = (gameState: GameState) => gameState.realEstate;
  const selectCryptos = (gameState: GameState) => gameState.cryptos;
  const selectAchievements = (gameState: GameState) => gameState.achievements;
  const selectProgress = (gameState: GameState) => gameState.progress;

  return {
    selectStats,
    selectSettings,
    selectItems,
    selectRelationships,
    selectPets,
    selectCompanies,
    selectRealEstate,
    selectCryptos,
    selectAchievements,
    selectProgress,
  };
};

// Hook for optimized state selection
export const useOptimizedGameState = (selector: (state: GameState) => any) => {
  const { gameState } = require('@/contexts/GameContext').useGame();
  
  return useMemo(() => {
    return selector(gameState);
  }, [gameState, selector]);
};

// Debounced state updates
export const useDebouncedState = <T>(initialValue: T, delay: number = 300) => {
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSetValue = useCallback((newValue: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setValue(newValue);
    }, delay);
  }, [delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, debouncedSetValue] as const;
};

// Optimized animation values
export const useOptimizedAnimation = (initialValue: number = 0) => {
  const animatedValue = useRef(new Animated.Value(initialValue)).current;
  
  const animateTo = useCallback((toValue: number, duration: number = 300) => {
    Animated.timing(animatedValue, {
      toValue,
      duration,
      useNativeDriver: true,
    }).start();
  }, [animatedValue]);

  return { animatedValue, animateTo };
};

// Memory-efficient list rendering
export const useVirtualizedList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  scrollOffset: number = 0
) => {
  return useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - 1);
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount);
    
    return {
      visibleItems: items.slice(startIndex, endIndex + 1),
      startIndex,
      endIndex,
      totalHeight: items.length * itemHeight,
    };
  }, [items, itemHeight, containerHeight, scrollOffset]);
};

// Performance monitoring
export const usePerformanceMonitor = () => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  const logRender = useCallback((componentName: string) => {
    renderCount.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    if (__DEV__) {
      console.log(`[Performance] ${componentName} rendered ${renderCount.current} times, ${timeSinceLastRender}ms since last render`);
    }
  }, []);

  return { logRender, renderCount: renderCount.current };
};

// Batch state updates
export const useBatchedUpdates = () => {
  const batchRef = useRef<any[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const batchUpdate = useCallback((update: any) => {
    batchRef.current.push(update);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      // Process all batched updates
      const updates = batchRef.current;
      batchRef.current = [];
      
      // Apply updates in batch
      updates.forEach(updateFn => {
        if (typeof updateFn === 'function') {
          updateFn();
        }
      });
    }, 16); // ~60fps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { batchUpdate };
};

// Lazy loading for heavy components
export const useLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    importFn()
      .then(module => {
        setComponent(() => module.default);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [importFn]);

  if (loading) return fallback ? React.createElement(fallback) : null;
  if (error) return null;
  if (!Component) return null;

  return Component;
};

// Optimized image loading
export const useOptimizedImage = (_uri: string) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  return {
    loaded,
    error,
    handleLoad,
    handleError,
  };
};

// Memory cleanup utilities
export const useMemoryCleanup = () => {
  const cleanupFunctions = useRef<(() => void)[]>([]);

  const addCleanup = useCallback((fn: () => void) => {
    cleanupFunctions.current.push(fn);
  }, []);

  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach(fn => {
        try {
          fn();
        } catch (error) {
          if (__DEV__) {
            console.warn('Cleanup function failed:', error);
          }
        }
      });
      cleanupFunctions.current = [];
    };
  }, []);

  return { addCleanup };
};

export default PerformanceOptimizer;
