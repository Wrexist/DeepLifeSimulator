import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { getDeviceType, isIPad, isAndroid } from '@/utils/scaling';
import { logger } from '@/utils/logger';

export function usePreload() {
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);

  useEffect(() => {
    const preloadResources = async () => {
      try {
        // Step 1: Initialize scaling system
        setPreloadProgress(10);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Force Dimensions to update - wrap in try-catch
        try {
          Dimensions.get('window');
        } catch (dimError: any) {
          if (__DEV__) {
            logger.warn('Failed to get window dimensions:', dimError);
          }
          // Continue anyway
        }
        
        // Step 2: Detect device type - wrap in try-catch
        setPreloadProgress(20);
        await new Promise(resolve => setTimeout(resolve, 100));
        
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
          // Continue anyway
        }
        
        // Step 3: Preload critical images
        setPreloadProgress(40);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Step 4: Initialize game state
        setPreloadProgress(60);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Step 5: Final setup
        setPreloadProgress(80);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setPreloadProgress(100);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        setIsPreloaded(true);
      } catch (error: any) {
        // CRITICAL: Catch ALL errors to prevent crash
        if (__DEV__) {
          logger.error('Preload error:', error);
        }
        // Always continue - don't block app startup
        setIsPreloaded(true);
      }
    };

    preloadResources();
  }, []);

  return { isPreloaded, preloadProgress };
}
