import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, Easing } from 'react-native';
import { Platform } from 'react-native';

// Smart Timer Hook
export const useSmartTimer = (callback: () => void, delay: number, dependencies: any[] = []) => {
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(callback, delay) as any;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, delay, callback, ...dependencies]);

  const start = useCallback(() => setIsActive(true), []);
  const stop = useCallback(() => setIsActive(false), []);

  return { start, stop, isActive };
};

// Progressive Loading Hook
export const useProgressiveLoading = (criticalData: any[], remainingData: any[]) => {
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [loadedData, setLoadedData] = useState<any[]>(criticalData);

  useEffect(() => {
    // Load critical data first
    setLoadedData(criticalData);

    // Load remaining data in background
    const timer = setTimeout(() => {
      setLoadedData([...criticalData, ...remainingData]);
      setIsFullyLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [criticalData, remainingData]);

  return { loadedData, isFullyLoaded };
};

// Optimized Animation Hook
export const useOptimizedAnimation = (initialValue: number = 0) => {
  const animation = useRef(new Animated.Value(initialValue)).current;
  const isAnimating = useRef(false);

  const startAnimation = useCallback((toValue: number, duration: number = 300) => {
    if (isAnimating.current) return;

    isAnimating.current = true;
    Animated.timing(animation, {
      toValue,
      duration,
      useNativeDriver: Platform.OS !== 'web', // GPU-accelerated
      easing: Easing.out(Easing.quad),
    }).start(() => {
      isAnimating.current = false;
    });
  }, [animation]);

  const stopAnimation = useCallback(() => {
    animation.stopAnimation();
    isAnimating.current = false;
  }, [animation]);

  return { animation, startAnimation, stopAnimation, isAnimating: isAnimating.current };
};

// Image Preloading Hook
export const useImagePreloading = (imageSources: any[]) => {
  const [preloadedImages, setPreloadedImages] = useState<Set<any>>(new Set());
  const [isPreloading, setIsPreloading] = useState(false);

  const preloadImages = useCallback(async () => {
    setIsPreloading(true);
    
    try {
      const preloadPromises = imageSources.map(source => {
        return new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            setPreloadedImages(prev => new Set([...prev, source]));
            resolve(source);
          };
          image.onerror = () => resolve(source);
          image.src = source;
        });
      });

      await Promise.all(preloadPromises);
    } catch (error) {
      console.warn('Image preloading failed:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [imageSources]);

  return { preloadedImages, isPreloading, preloadImages };
};

// Performance Monitor Hook
export const usePerformanceMonitor = (componentName: string) => {
  const startTime = useRef(Date.now());
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    const endTime = Date.now();
    const duration = endTime - startTime.current;

    if (duration > 1000) {
      console.warn(`[Performance] ${componentName} took ${duration}ms to render (render #${renderCount.current})`);
    }

    startTime.current = endTime;
  });

  return { renderCount: renderCount.current };
};

// Memory Usage Monitor Hook
export const useMemoryMonitor = () => {
  const [memoryUsage, setMemoryUsage] = useState<number>(0);

  useEffect(() => {
    const checkMemory = () => {
      if (global.performance && (global.performance as any).memory) {
        const used = (global.performance as any).memory.usedJSHeapSize;
        const total = (global.performance as any).memory.totalJSHeapSize;
        const percentage = (used / total) * 100;
        
        setMemoryUsage(percentage);
        
        if (percentage > 80) {
          console.warn(`[Memory] High memory usage: ${percentage.toFixed(1)}%`);
        }
      }
    };

    const interval = setInterval(checkMemory, 5000);
    return () => clearInterval(interval);
  }, []);

  return { memoryUsage };
};

// Battery Optimization Hook
export const useBatteryOptimization = () => {
  const [isLowPowerMode, setIsLowPowerMode] = useState(false);
  const [isBackgrounded, setIsBackgrounded] = useState(false);

  useEffect(() => {
    // Monitor app state changes
    const handleAppStateChange = (nextAppState: string) => {
      setIsBackgrounded(nextAppState === 'background');
    };

    // In a real app, you would use AppState from react-native
    // AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // AppState.removeEventListener('change', handleAppStateChange);
    };
  }, []);

  const optimizeForBattery = useCallback(() => {
    // Reduce animation complexity
    // Disable non-essential features
    // Reduce update frequency
    setIsLowPowerMode(true);
  }, []);

  const restoreFullPerformance = useCallback(() => {
    setIsLowPowerMode(false);
  }, []);

  return { 
    isLowPowerMode, 
    isBackgrounded, 
    optimizeForBattery, 
    restoreFullPerformance 
  };
};
