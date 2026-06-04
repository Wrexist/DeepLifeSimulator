import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePreload } from '@/hooks/usePreload';
import { shouldAllowNavigation } from '@/lib/utils/startupHealthValidator';

export default function Index() {
  const router = useRouter();
  const { isPreloaded, preloadProgress } = usePreload();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing DeepLife Simulator...');
  const [routerReady, setRouterReady] = useState(false);
  const [_startupHealthCheck, setStartupHealthCheck] = useState<any>(null);
  const hasNavigatedRef = useRef(false); // Use ref to prevent double navigation without re-render

  // R8 DIAGNOSTIC: probe the MainMenu route module (and its key deps) directly.
  // The native crash shows SceneView rendering `undefined` with NO MainMenu frame,
  // i.e. MainMenu's module default is undefined in the production Hermes bundle.
  // Dynamically importing each module tells us exactly which one fails to evaluate
  // (and the throw message), instead of guessing. If everything resolves, we clear
  // the gate and navigate as normal.
  const [diag, setDiag] = useState<string[]>([]);
  const [probeOk, setProbeOk] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    const out: string[] = [];
    const push = (s: string) => { out.push(s); if (!cancelled) setDiag([...out]); };
    const probe = async (name: string, fn: () => Promise<any>) => {
      try {
        const m: any = await fn();
        const def = m?.default;
        const kind = typeof def;
        push(`${kind === 'undefined' ? '❌' : '✅'} ${name}: default=${kind}`);
        return kind !== 'undefined';
      } catch (e: any) {
        push(`💥 ${name}: THREW ${e?.message || e}`);
        return false;
      }
    };
    (async () => {
      // leaf deps first (innermost), then MainMenu (which imports them all)
      await probe('lucide-react-native', () => import('lucide-react-native'));
      await probe('fallbacks/BlurView', () => import('@/components/fallbacks/BlurViewFallback'));
      await probe('fallbacks/LinearGradient', () => import('@/components/fallbacks/LinearGradientFallback'));
      await probe('GlassActionButton', () => import('@/components/onboarding/GlassActionButton'));
      await probe('OnboardingScreenShell', () => import('@/components/onboarding/OnboardingScreenShell'));
      await probe('useTranslation', () => import('@/hooks/useTranslation'));
      await probe('saveSlotHelpers', () => import('@/src/features/onboarding/saveSlotHelpers'));
      await probe('gameEntryValidation', () => import('@/utils/gameEntryValidation'));
      const ok = await probe('app/(onboarding)/MainMenu', () => import('./(onboarding)/MainMenu'));
      if (!cancelled) setProbeOk(ok);
    })();
    return () => { cancelled = true; };
  }, []);

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
    if (!isPreloaded) return;

    const loadingSteps = [
      { progress: 20, message: 'Loading game assets...' },
      { progress: 40, message: 'Initializing game state...' },
      { progress: 60, message: 'Loading scaling utilities...' },
      { progress: 80, message: 'Preparing UI components...' },
      { progress: 95, message: 'Almost ready...' },
      { progress: 100, message: 'Welcome to DeepLife!' },
    ];

    let currentStep = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
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
  }, [isPreloaded]);

  // CRITICAL: Programmatic navigation in useEffect, NOT in render
  // Use ref for navigation guard to avoid re-render cycles and race conditions
  useEffect(() => {
    // Guard: Only navigate once, when all conditions are met
    if (hasNavigatedRef.current || !router || !routerReady || !isPreloaded || isLoading || probeOk !== true) {
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
  }, [isLoading, isPreloaded, routerReady, router, probeOk]);

  // ALWAYS render a safe fallback screen (never crash)
  const currentProgress = isPreloaded ? progress : preloadProgress;
  const currentMessage = isPreloaded ? loadingMessage : 'Initializing scaling system...';
  
  // R8 hotfix: render a dependency-light loading screen (React Native core only).
  // PremiumLoadingScreen pulled in lazy TurboModule loading + gradient fallbacks;
  // a production-only `undefined` element somewhere in that subtree was crashing
  // the router on first paint ("Element type is invalid"). Keep the critical
  // first render crash-proof — and cleaner-looking than the old bare splash.
  const pct = Math.max(0, Math.min(100, currentProgress || 0));
  return (
    <View style={loadingStyles.container}>
      <View style={loadingStyles.center}>
        <Text style={loadingStyles.title}>DeepLife Simulator</Text>
        <Text style={loadingStyles.tagline}>Your life. Every choice.</Text>
        <ActivityIndicator size="large" color="#3B82F6" style={loadingStyles.spinner} />
        <View style={loadingStyles.track}>
          <View style={[loadingStyles.bar, { width: `${pct}%` }]} />
        </View>
        <Text style={loadingStyles.message}>{currentMessage}</Text>
        {probeOk === false && (
          <View style={loadingStyles.diagBox}>
            <Text style={loadingStyles.diagTitle}>Startup module probe</Text>
            <ScrollView style={loadingStyles.diagScroll}>
              {diag.map((line, i) => (
                <Text key={i} style={loadingStyles.diagLine}>{line}</Text>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  tagline: { color: '#94A3B8', fontSize: 15, fontWeight: '500', marginTop: 8, textAlign: 'center' },
  spinner: { marginTop: 32 },
  track: {
    width: '70%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 28,
  },
  bar: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  message: { color: '#64748B', fontSize: 13, marginTop: 16, textAlign: 'center' },
  diagBox: {
    marginTop: 24,
    width: '100%',
    maxHeight: 320,
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderColor: 'rgba(248,113,113,0.5)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  diagTitle: { color: '#FCA5A5', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  diagScroll: { maxHeight: 270 },
  diagLine: { color: '#FECACA', fontSize: 12, fontFamily: 'Courier', marginBottom: 3 },
});
