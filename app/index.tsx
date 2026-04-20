import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import PremiumLoadingScreen from '@/components/PremiumLoadingScreen';
import { usePreload } from '@/hooks/usePreload';
import { shouldAllowNavigation, getHealthStatusSummary } from '@/lib/utils/startupHealthValidator';

export default function Index() {
  const router = useRouter();
  const { isPreloaded, preloadProgress } = usePreload();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing DeepLife Simulator...');
  const [routerReady, setRouterReady] = useState(false);
  const [startupHealthCheck, setStartupHealthCheck] = useState<any>(null);
  const hasNavigatedRef = useRef(false); // Use ref to prevent double navigation without re-render

  // CRITICAL: Startup health check - verify critical modules before rendering
  useEffect(() => {
    const checkStartupHealth = () => {
      const healthCheck = (global as any).__STARTUP_HEALTH_CHECK__;
      if (typeof healthCheck === 'function') {
        const health = healthCheck();
        setStartupHealthCheck(health);
        
        if (health && health.failedModules && health.failedModules.length > 0) {
          if (__DEV__) {
            console.warn('[Index] Startup health check: Some modules failed to load:', health.failedModules);
          }
          // Continue anyway - we have fallbacks
        }
      } else {
        // Health check not available yet, wait a bit
        setTimeout(checkStartupHealth, 100);
      }
    };

    // Check immediately and also after a short delay
    checkStartupHealth();
    const timeout = setTimeout(checkStartupHealth, 500);
    
    return () => clearTimeout(timeout);
  }, []);

  // CRITICAL: Wait for router to be ready before navigating
  useEffect(() => {
    // Ensure router is ready before allowing navigation
    const checkRouter = setTimeout(() => {
      if (router) {
        setRouterReady(true);
      }
    }, 100);

    return () => clearTimeout(checkRouter);
  }, [router]);

  useEffect(() => {
    if (isPreloaded) {
      const loadingSteps = [
        { progress: 20, message: 'Loading game assets...' },
        { progress: 40, message: 'Initializing game state...' },
        { progress: 60, message: 'Loading scaling utilities...' },
        { progress: 80, message: 'Preparing UI components...' },
        { progress: 95, message: 'Almost ready...' },
        { progress: 100, message: 'Welcome to DeepLife!' },
      ];

      let currentStep = 0;
      let timeoutId: NodeJS.Timeout | null = null;
      const interval = setInterval(() => {
        if (currentStep < loadingSteps.length) {
          const step = loadingSteps[currentStep];
          setProgress(step.progress);
          setLoadingMessage(step.message);
          currentStep++;
        } else {
          clearInterval(interval);
          timeoutId = setTimeout(() => {
            setIsLoading(false);
            timeoutId = null;
          }, 500);
        }
      }, 800);

      return () => {
        clearInterval(interval);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }
  }, [isPreloaded]);

  // CRITICAL: Programmatic navigation in useEffect, NOT in render
  // Use ref for navigation guard to avoid re-render cycles and race conditions
  useEffect(() => {
    // Guard: Only navigate once, when all conditions are met
    if (hasNavigatedRef.current || !router || !routerReady || !isPreloaded || isLoading) {
      return;
    }

    // Small delay to ensure UI is fully rendered and all providers are initialized
    const navigateTimeout = setTimeout(async () => {
      // Double-check conditions before navigating (prevent race condition)
      if (hasNavigatedRef.current || !router || !routerReady || !isPreloaded || isLoading) {
        return;
      }

      try {
        // CRITICAL: Validate startup health before navigation
        // Wrap in timeout to prevent hanging if AsyncStorage or health check stalls
        const NAVIGATION_CHECK_TIMEOUT = 5000;
        const navigationAllowed = await Promise.race([
          shouldAllowNavigation(),
          new Promise<boolean>((resolve) =>
            setTimeout(() => {
              if (__DEV__) {
                console.warn('[Index] Navigation health check timed out — proceeding anyway');
              }
              resolve(true); // Default to allowing navigation on timeout
            }, NAVIGATION_CHECK_TIMEOUT)
          ),
        ]);

        if (!navigationAllowed) {
          if (__DEV__) {
            console.warn('[Index] Navigation blocked by health check - waiting for system stabilization');
          }
          // Don't navigate yet, retry in 500ms
          setTimeout(() => {
            // Trigger effect re-run by updating state
            setRouterReady(prev => prev);
          }, 500);
          return;
        }

        hasNavigatedRef.current = true; // Mark as navigated atomically via ref
        router.replace('/(onboarding)/MainMenu');
        if (__DEV__) {
          console.log('[Index] Navigation to MainMenu successful');
        }
      } catch (navError) {
        // Reset flag on error so we can retry
        hasNavigatedRef.current = false;
        if (__DEV__) {
          console.error('[Index] Navigation error:', navError);
        }
        // Fallback: stay on loading screen rather than crash
      }
    }, 100); // Increased delay to ensure all providers are ready

    return () => clearTimeout(navigateTimeout);
  }, [isLoading, isPreloaded, routerReady, router]);

  // ALWAYS render a safe fallback screen (never crash)
  const currentProgress = isPreloaded ? progress : preloadProgress;
  const currentMessage = isPreloaded ? loadingMessage : 'Initializing scaling system...';
  
  return (
    <View style={{ flex: 1 }}>
      <PremiumLoadingScreen 
        progress={currentProgress}
        message={currentMessage}
      />
    </View>
  );
}
