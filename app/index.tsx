import React, { useState, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
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
  // Bumped to re-run the navigation effect when a health check defers navigation.
  // (Must be a real value change — `setState(prev => prev)` is a no-op React bails on.)
  const [navRetry, setNavRetry] = useState(0);
  const hasNavigatedRef = useRef(false); // Use ref to prevent double navigation without re-render

  // Lightweight "alive" animations — RN core only (Animated), so the very first
  // production render stays crash-proof (no third-party animation deps here).
  const titleGlow = useRef(new Animated.Value(0)).current;
  const dot0 = useRef(new Animated.Value(0.3)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Soft pulsing glow behind the title so the screen breathes while loading.
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(titleGlow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(titleGlow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    // Three dots that pulse in sequence — a calm "working…" rhythm.
    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.delay(800 - delay),
        ])
      );

    const animations = [glow, pulse(dot0, 0), pulse(dot1, 200), pulse(dot2, 400)];
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [titleGlow, dot0, dot1, dot2]);

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
          // Don't navigate yet, retry in 500ms. Bump a counter (a real value
          // change) so the effect actually re-runs — `setRouterReady(prev => prev)`
          // is a no-op React bails on, which left the app stuck on the loader.
          setTimeout(() => {
            setNavRetry((n) => n + 1);
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
  }, [isLoading, isPreloaded, routerReady, router, navRetry]);

  // ALWAYS render a safe fallback screen (never crash)
  const currentProgress = isPreloaded ? progress : preloadProgress;
  const currentMessage = isPreloaded ? loadingMessage : 'Initializing scaling system...';

  // Dependency-light loading screen (React Native core only) so the very first
  // production render is crash-proof. This screen owns "/" — app/(tabs) must NOT
  // also claim "/" (it lives at /(tabs)/home), or a production bundle would
  // silently drop this loader. See app/(tabs)/_layout.tsx unstable_settings.
  const pct = Math.max(0, Math.min(100, currentProgress || 0));
  return (
    <View style={loadingStyles.container}>
      <View style={loadingStyles.center}>
        <View style={loadingStyles.titleWrap}>
          <Animated.View
            style={[
              loadingStyles.titleGlow,
              {
                opacity: titleGlow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
                transform: [{ scale: titleGlow.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] }) }],
              },
            ]}
          />
          <Text style={loadingStyles.title}>DeepLife Simulator</Text>
        </View>
        <Text style={loadingStyles.tagline}>Your life. Every choice.</Text>

        <View style={loadingStyles.dots}>
          <Animated.View style={[loadingStyles.dot, { opacity: dot0, transform: [{ scale: dot0 }] }]} />
          <Animated.View style={[loadingStyles.dot, { opacity: dot1, transform: [{ scale: dot1 }] }]} />
          <Animated.View style={[loadingStyles.dot, { opacity: dot2, transform: [{ scale: dot2 }] }]} />
        </View>

        <View style={loadingStyles.track}>
          <View style={[loadingStyles.bar, { width: `${pct}%` }]} />
        </View>
        <Text style={loadingStyles.message}>{currentMessage}</Text>
      </View>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  titleWrap: { alignItems: 'center', justifyContent: 'center' },
  titleGlow: {
    position: 'absolute',
    width: 240,
    height: 120,
    borderRadius: 120,
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
  },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  tagline: { color: '#94A3B8', fontSize: 15, fontWeight: '500', marginTop: 8, textAlign: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 36 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' },
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
});
