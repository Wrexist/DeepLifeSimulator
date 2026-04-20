import { useEffect } from 'react';
import { Platform } from 'react-native';

// CRITICAL: Use turboModuleWrapper for consistent module loading
// Lazy-load SplashScreen to avoid crashes if module fails to initialize
let SplashScreen: any = null;
let splashScreenLoaded = false;
let splashScreenLoadPromise: Promise<any> | null = null;

async function loadSplashScreen(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  
  if (splashScreenLoaded && SplashScreen) {
    return true;
  }

  // Prevent race conditions - reuse existing load promise
  if (splashScreenLoadPromise) {
    try {
      await splashScreenLoadPromise;
      return splashScreenLoaded && SplashScreen !== null;
    } catch {
      return false;
    }
  }

  // Load using turboModuleWrapper for consistency
  splashScreenLoadPromise = (async () => {
    try {
      const { lazyLoadTurboModule } = await import('@/utils/turboModuleWrapper');
      const module = await lazyLoadTurboModule('expo-splash-screen', {
        retries: 1,
        retryDelay: 500,
        timeout: 2000,
      });
      
      if (module) {
        SplashScreen = module;
        splashScreenLoaded = true;
        return true;
      }
      return false;
    } catch (error) {
      if (__DEV__) {
        console.warn('expo-splash-screen not available:', error);
      }
      return false;
    }
  })();

  return await splashScreenLoadPromise;
}

export function useFrameworkReady() {
  useEffect(() => {
    // Hide splash screen on native platforms
    if (Platform.OS !== 'web') {
      // Load splash screen asynchronously
      const hideSplashScreen = async () => {
        try {
          const loaded = await loadSplashScreen();
          if (loaded && SplashScreen) {
            // On iOS, prevent auto-hide first to ensure we control when it disappears
            if (Platform.OS === 'ios' && SplashScreen.preventAutoHideAsync) {
              try {
                await SplashScreen.preventAutoHideAsync();
              } catch (preventError: any) {
                // Ignore errors from preventAutoHideAsync - it's optional
                if (__DEV__) {
                  console.log('[useFrameworkReady] Could not prevent auto-hide (this is OK):', preventError?.message);
                }
              }
            }
            
            // Add a small delay to ensure UI is ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try to hide the splash screen
            try {
              await SplashScreen.hideAsync();
              if (__DEV__) {
                console.log('[useFrameworkReady] Splash screen hidden successfully');
              }
            } catch (error: any) {
              // On iOS, if the splash screen isn't registered, it will auto-hide anyway
              // Check for the specific error about splash screen not being registered
              const errorMessage = error?.message || String(error);
              if (errorMessage.includes('No native splash screen registered') || 
                  errorMessage.includes('Call \'SplashScreen.show\'')) {
                // This is not a critical error - the splash screen will auto-hide
                // Silently handle this error to prevent uncaught promise rejection
                if (__DEV__) {
                  console.log('[useFrameworkReady] Splash screen not registered - will auto-hide. This is normal on iOS.');
                }
              } else {
                if (__DEV__) {
                  console.warn('[useFrameworkReady] Failed to hide splash screen:', error);
                }
              }
              // Continue anyway - don't block app startup
            }
          } else {
            if (__DEV__) {
              console.log('[useFrameworkReady] SplashScreen module not available');
            }
          }
        } catch (error: any) {
          // Silently handle all errors to prevent uncaught promise rejection
          // The splash screen will auto-hide on iOS anyway
          if (__DEV__) {
            const errorMessage = error?.message || String(error);
            if (!errorMessage.includes('No native splash screen registered') && 
                !errorMessage.includes('Call \'SplashScreen.show\'')) {
              console.warn('[useFrameworkReady] Failed to handle splash screen:', error);
            }
          }
        }
      };
      
      // Execute and catch any unhandled rejections
      hideSplashScreen().catch((error: any) => {
        // This catch should never be reached due to try-catch above,
        // but it's here as a safety net to prevent uncaught promise rejections
        if (__DEV__) {
          const errorMessage = error?.message || String(error);
          if (!errorMessage.includes('No native splash screen registered') && 
              !errorMessage.includes('Call \'SplashScreen.show\'')) {
            console.warn('[useFrameworkReady] Unhandled splash screen error:', error);
          }
        }
      });
    }
    
    // Web-specific: notify that framework is ready
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof (window as any).frameworkReady === 'function') {
        (window as any).frameworkReady();
      }
    }
  }, []);
}
