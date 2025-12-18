import { useEffect } from 'react';
import { Platform } from 'react-native';

// Lazy-load SplashScreen to avoid crashes if module fails to initialize
let SplashScreen: any = null;
let splashScreenLoaded = false;

function loadSplashScreen(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  
  if (splashScreenLoaded && SplashScreen) {
    return true;
  }
  
  try {
    SplashScreen = require('expo-splash-screen');
    splashScreenLoaded = true;
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('expo-splash-screen not available:', error);
    }
    return false;
  }
}

export function useFrameworkReady() {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFrameworkReady.ts:30',message:'useFrameworkReady effect start',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    
    // Hide splash screen on native platforms
    if (Platform.OS !== 'web') {
      if (loadSplashScreen() && SplashScreen) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFrameworkReady.ts:38',message:'Before SplashScreen.hideAsync',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        
        // Add a small delay to ensure UI is ready
        setTimeout(async () => {
          try {
            await SplashScreen.hideAsync();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFrameworkReady.ts:47',message:'After SplashScreen.hideAsync success',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
            // #endregion
            if (__DEV__) {
              console.log('[useFrameworkReady] Splash screen hidden successfully');
            }
          } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFrameworkReady.ts:55',message:'SplashScreen.hideAsync error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
            // #endregion
            if (__DEV__) {
              console.warn('[useFrameworkReady] Failed to hide splash screen:', error);
            }
            // Continue anyway - don't block app startup
          }
        }, 100);
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFrameworkReady.ts:66',message:'SplashScreen not loaded',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        if (__DEV__) {
          console.log('[useFrameworkReady] SplashScreen module not available');
        }
      }
    }
    
    // Web-specific: notify that framework is ready
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof (window as any).frameworkReady === 'function') {
        (window as any).frameworkReady();
      }
    }
  }, []);
}
