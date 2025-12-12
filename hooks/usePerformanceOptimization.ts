import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { View } from 'react-native';
import { debounce } from '@/utils/debounce';
import { logger } from '@/utils/logger';

/**
 * Custom hook for performance optimization
 * Prevents unnecessary re-renders and calculations
 */
export function usePerformanceOptimization() {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());

  // Track render performance
  useEffect(() => {
    renderCountRef.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;

    if (__DEV__ && timeSinceLastRender < 16) {
      logger.warn(`Performance warning: Render ${renderCountRef.current} took ${timeSinceLastRender}ms (target: 16ms)`);
    }
  });

  // Debounced function creator
  const createDebouncedFunction = useCallback(
    <T extends (...args: any[]) => any>(
      func: T,
      delay: number = 300
    ): T => {
      return debounce(func, delay) as T;
    },
    []
  );

  // Note: Cannot create hooks inside callbacks - React hooks must be called at top level
  // If you need memoization, use useMemo/useCallback directly in your component

  return {
    createDebouncedFunction,
    renderCount: renderCountRef.current,
  };
}

/**
 * Hook for optimizing expensive calculations
 */
export function useExpensiveCalculation<T>(
  calculation: () => T,
  deps: React.DependencyList,
  options: {
    enabled?: boolean;
    debounceMs?: number;
  } = {}
): T | null {
  const { enabled = true, debounceMs = 0 } = options;
  const [result, setResult] = useState<T | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const debouncedCalculation = useMemo(
    () => {
      if (debounceMs > 0) {
        return debounce(() => {
          if (!enabled) return;
          setIsCalculating(true);
          try {
            const value = calculation();
            setResult(value);
          } catch (error) {
            if (__DEV__) {
              logger.error('Calculation error:', error);
            }
            setResult(null);
          } finally {
            setIsCalculating(false);
          }
        }, debounceMs);
      } else {
        return () => {
          if (!enabled) return;
          setIsCalculating(true);
          try {
            const value = calculation();
            setResult(value);
          } catch (error) {
            if (__DEV__) {
              logger.error('Calculation error:', error);
            }
            setResult(null);
          } finally {
            setIsCalculating(false);
          }
        };
      }
    },
    [calculation, enabled, debounceMs]
  );

  useEffect(() => {
    debouncedCalculation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
}

/**
 * Hook for managing component visibility and lazy loading
 */
export function useLazyLoading(threshold: number = 0.1) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const ref = useRef<View>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (!hasBeenVisible) {
            setHasBeenVisible(true);
          }
        } else {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, hasBeenVisible]);

  return { ref, isVisible, hasBeenVisible };
}