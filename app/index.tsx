import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import PremiumLoadingScreen from '@/components/PremiumLoadingScreen';
import { usePreload } from '@/hooks/usePreload';

export default function Index() {
  const router = useRouter();
  const { isPreloaded, preloadProgress } = usePreload();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing DeepLife Simulator...');
  const [routerReady, setRouterReady] = useState(false);

  // CRITICAL: Wait for router to be ready before navigating
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:17',message:'Index mounted - checking router',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    
    // Ensure router is ready before allowing navigation
    const checkRouter = setTimeout(() => {
      if (router) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:25',message:'Router ready',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H7'})}).catch(()=>{});
        // #endregion
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
  useEffect(() => {
    if (!isLoading && isPreloaded && routerReady && router) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:76',message:'Before router.replace',data:{isLoading,isPreloaded,routerReady},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H7'})}).catch(()=>{});
      // #endregion
      
      // Small delay to ensure UI is fully rendered
      const navigateTimeout = setTimeout(() => {
        try {
          router.replace('/(onboarding)/MainMenu');
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:84',message:'After router.replace success',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H7'})}).catch(()=>{});
          // #endregion
        } catch (navError) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:90',message:'router.replace error',data:{error:String(navError)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H7'})}).catch(()=>{});
          // #endregion
          if (__DEV__) {
            console.error('[Index] Navigation error:', navError);
          }
          // Fallback: stay on loading screen rather than crash
        }
      }, 50);

      return () => clearTimeout(navigateTimeout);
    }
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
