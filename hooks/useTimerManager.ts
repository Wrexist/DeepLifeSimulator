import { useEffect, useRef, useCallback } from 'react';

/**
 * Helper to manage multiple timers and ensure they are cleaned up on unmount
 * Tracks timer types separately for precise cleanup
 */
export function useTimerManager() {
  const intervals = useRef<Set<NodeJS.Timeout | number>>(new Set());
  const timeouts = useRef<Set<NodeJS.Timeout | number>>(new Set());

  const addInterval = useCallback((callback: () => void, ms: number) => {
    const id = setInterval(callback, ms);
    intervals.current.add(id);
    return id;
  }, []);

  const addTimeout = useCallback((callback: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeouts.current.delete(id);
      callback();
    }, ms);
    timeouts.current.add(id);
    return id;
  }, []);

  const clearIntervalId = useCallback((id: NodeJS.Timeout | number | null) => {
    if (id !== null) {
      // NOTE: `as any` cast is necessary for cross-platform compatibility
      // Node.js returns NodeJS.Timeout, but browser/React Native may return number
      // This is a known TypeScript limitation with timer types
      clearInterval(id as any);
      intervals.current.delete(id);
    }
  }, []);

  const clearTimeoutId = useCallback((id: NodeJS.Timeout | number | null) => {
    if (id !== null) {
      // NOTE: `as any` cast is necessary for cross-platform compatibility
      // Node.js returns NodeJS.Timeout, but browser/React Native may return number
      clearTimeout(id as any);
      timeouts.current.delete(id);
    }
  }, []);

  const clearAll = useCallback(() => {
    // Clear intervals using the correct function
    intervals.current.forEach((id) => {
      // NOTE: `as any` cast is necessary for cross-platform timer type compatibility
      clearInterval(id as any);
    });
    intervals.current.clear();
    
    // Clear timeouts using the correct function
    timeouts.current.forEach((id) => {
      // NOTE: `as any` cast is necessary for cross-platform timer type compatibility
      clearTimeout(id as any);
    });
    timeouts.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAll();
  }, [clearAll]);

  return {
    setInterval: addInterval,
    setTimeout: addTimeout,
    clearInterval: clearIntervalId,
    clearTimeout: clearTimeoutId,
    clearAll
  };
}


