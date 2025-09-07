import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { getDeviceType, isIPad, isAndroid } from '@/utils/scaling';

export function usePreload() {
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);

  useEffect(() => {
    const preloadResources = async () => {
      try {
        // Step 1: Initialize scaling system
        setPreloadProgress(10);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Force Dimensions to update
        Dimensions.get('window');
        
        // Step 2: Detect device type
        setPreloadProgress(20);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const deviceType = getDeviceType();
        const isTablet = isIPad();
        const isAndroidDevice = isAndroid();
        
        console.log('Device detected:', { deviceType, isTablet, isAndroidDevice });
        
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
      } catch (error) {
        console.error('Preload error:', error);
        setIsPreloaded(true); // Continue anyway
      }
    };

    preloadResources();
  }, []);

  return { isPreloaded, preloadProgress };
}
