import { useEffect, useRef, useCallback } from 'react';

/**
 * Helper to manage multiple timers and ensure they are cleaned up on unmount
 */
export function useTimerManager() {
  const timers = useRef<Set<NodeJS.Timeout | number>>(new Set());

  const addInterval = useCallback((callback: () => void, ms: number) => {
    const id = setInterval(callback, ms);
    timers.current.add(id);
    return id;
  }, []);

  const addTimeout = useCallback((callback: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      callback();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  const clearIntervalId = useCallback((id: NodeJS.Timeout | number | null) => {
    if (id !== null) {
      clearInterval(id as any); // Cast for compatibility
      timers.current.delete(id);
    }
  }, []);

  const clearTimeoutId = useCallback((id: NodeJS.Timeout | number | null) => {
    if (id !== null) {
      clearTimeout(id as any);
      timers.current.delete(id);
    }
  }, []);

  const clearAll = useCallback(() => {
    timers.current.forEach((id) => {
      // Try clearing both, as we don't track type separately in the Set
      // This is safe in most environments but checking type would be better if possible
      // Since IDs are unique, we can just try clearing.
      // However, strictly speaking, we should differentiate. 
      // For simplicity in this utility, we assume standard behavior.
      clearInterval(id as any);
      clearTimeout(id as any);
    });
    timers.current.clear();
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


