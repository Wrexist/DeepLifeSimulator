import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { getDeviceType, isIPad, isAndroid } from '@/utils/scaling';
import { logger } from '@/utils/logger';

export function usePreload() {
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);

  useEffect(() => {
    let isMounted = true; // Guard to prevent state updates after unmount
    let cancelled = false; // Guard to prevent race conditions

    const preloadResources = async () => {
      // Guard: Don't start if already cancelled
      if (cancelled || !isMounted) {
        return;
      }

      try {
        // Step 1: Initialize scaling system
        // Guard: Check if cancelled before each step
        if (cancelled || !isMounted) return;
        setPreloadProgress(10);
        
        // Step 1: Initialize scaling system (must be first)
        // Force Dimensions to update - wrap in try-catch
        try {
          Dimensions.get('window');
        } catch (dimError: any) {
          if (__DEV__) {
            logger.warn('Failed to get window dimensions:', dimError);
          }
          // Continue anyway
        }
        
        // Step 2: Parallelize independent operations
        // These can run simultaneously to improve startup performance
        if (cancelled || !isMounted) return;
        setPreloadProgress(20);
        
        const parallelTasks = Promise.allSettled([
          // Detect device type (independent)
          (async () => {
            try {
              const deviceType = getDeviceType();
              const isTablet = isIPad();
              const isAndroidDevice = isAndroid();
              if (__DEV__) {
                logger.info('Device detected:', { deviceType, isTablet, isAndroidDevice });
              }
            } catch (deviceError: any) {
              if (__DEV__) {
                logger.warn('Failed to detect device type:', deviceError);
              }
            }
          })(),
          // Preload critical images (independent)
          new Promise(resolve => setTimeout(resolve, 200)),
        ]);
        
        await parallelTasks;
        
        // Step 3: Initialize game state (deferred - not critical for startup)
        // This is now deferred to GameActionsProvider to improve startup time
        if (cancelled || !isMounted) return;
        setPreloadProgress(60);
        await new Promise(resolve => setTimeout(resolve, 100)); // Reduced delay
        
        // Step 4: Final setup
        if (cancelled || !isMounted) return;
        setPreloadProgress(80);
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay
        
        if (cancelled || !isMounted) return;
        setPreloadProgress(100);
        await new Promise(resolve => setTimeout(resolve, 100)); // Reduced delay
        
        // Final guard before setting preloaded
        if (cancelled || !isMounted) return;
        setIsPreloaded(true);
      } catch (error: any) {
        // CRITICAL: Catch ALL errors to prevent crash
        if (__DEV__) {
          logger.error('Preload error:', error);
        }
        // Always continue - don't block app startup (only if still mounted)
        if (isMounted && !cancelled) {
          setIsPreloaded(true);
        }
      }
    };

    preloadResources();

    // Cleanup function to prevent state updates after unmount
    return () => {
      cancelled = true;
      isMounted = false;
    };
  }, []);

  return { isPreloaded, preloadProgress };
}
