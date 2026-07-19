import React, { useState, useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePreload } from '@/hooks/usePreload';
import { shouldAllowNavigation } from '@/lib/utils/startupHealthValidator';
// Boot-safe leaf module (storageWrapper + logger only; never throws). PEEKS the
// same background index the main menu is about to TAKE, so the loader renders
// the identical artwork and boot dissolves seamlessly into the menu.
import { MENU_BACKGROUNDS, peekMenuBackgroundIndex } from '@/utils/menuBackground';
// RN-core-only (AccessibilityInfo), defensively caught — boot-safe. Mirrors the
// main menu so reduce-motion users get the same instant (un-faded) handoff.
import { useReducedMotion } from '@/hooks/useReducedMotion';

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
  const dot0 = useRef(new Animated.Value(0.3)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  // This launch's background (null until the peek resolves — the flat #020617
  // base shows meanwhile, exactly like the menu's fallback).
  const [bgIndex, setBgIndex] = useState<number | null>(null);
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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

    const animations = [pulse(dot0, 0), pulse(dot1, 200), pulse(dot2, 400)];
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [dot0, dot1, dot2]);

  useEffect(() => {
    let cancelled = false;
    void peekMenuBackgroundIndex().then((index) => {
      if (!cancelled) setBgIndex(index);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reduced = useReducedMotion();

  const handleBgLoaded = () => {
    // Match MainMenu: reduce-motion users skip the fade so the boot → menu
    // artwork handoff stays instant and identical on both screens.
    if (reduced) {
      bgOpacity.setValue(1);
      return;
    }
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

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
      {/* Same artwork the menu is about to show, behind the same flat scrim —
          pure decoration; the flat #020617 base is the instant fallback. */}
      {bgIndex != null && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
          <Image
            source={MENU_BACKGROUNDS[bgIndex]}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            onLoadEnd={handleBgLoaded}
            accessibilityIgnoresInvertColors
          />
          <View style={loadingStyles.bgScrim} />
        </Animated.View>
      )}

      <View style={loadingStyles.content}>
        {/* Same 0.9 / 1.1 framing as the main menu so the brand block sits in
            the identical position and the boot → menu handoff is seamless. */}
        <View style={loadingStyles.spacerTop} />

        <View style={loadingStyles.hero}>
          <Text style={loadingStyles.eyebrow}>LIVE A THOUSAND LIVES</Text>
          <Text style={loadingStyles.brandTop} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>
            DEEP LIFE
          </Text>
          <Text style={loadingStyles.brandBottom} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>
            SIMULATOR
          </Text>
        </View>

        <View style={loadingStyles.heroGap} />

        <View style={loadingStyles.progressBlock}>
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

        <View style={loadingStyles.spacerBottom} />
        <Text style={loadingStyles.footer}>YOUR LIFE. EVERY CHOICE.</Text>
      </View>
    </View>
  );
}

// Mirrors the MainMenu design language with fixed px values (the scaling utils
// may not be loaded yet on this very first screen — RN core only here).
const loadingStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  bgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.52)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  spacerTop: { flex: 0.9, width: '100%' },
  spacerBottom: { flex: 1.1, width: '100%' },
  hero: { alignItems: 'center' },
  eyebrow: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
  },
  brandTop: {
    color: '#F8FAFC',
    fontSize: 46,
    letterSpacing: 1.5,
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'AvenirNext-Heavy' },
      default: { fontWeight: '900' as const },
    }),
  },
  brandBottom: {
    color: '#94A3B8',
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    marginTop: 4,
    ...Platform.select({
      ios: { fontFamily: 'AvenirNext-DemiBold' },
      default: { fontWeight: '600' as const },
    }),
  },
  heroGap: { height: 44 },
  progressBlock: { width: '100%', alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
  track: {
    width: '72%',
    height: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 24,
  },
  bar: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  message: { color: '#94A3B8', fontSize: 13, fontWeight: '500', marginTop: 14, textAlign: 'center' },
  footer: {
    color: 'rgba(148, 163, 184, 0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
