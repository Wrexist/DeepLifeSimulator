import React, { useState, useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePreload } from '@/hooks/usePreload';
import { shouldAllowNavigation } from '@/lib/utils/startupHealthValidator';
// Boot-safe leaf module (storageWrapper + logger only; never throws). PEEKS the
// same background index the main menu is about to TAKE, so the loader renders
// the identical artwork and boot dissolves seamlessly into the menu.
import { MENU_BACKGROUNDS, peekMenuBackgroundIndex } from '@/utils/menuBackground';
// RN-core-only (AccessibilityInfo), defensively caught - boot-safe. Mirrors the
// main menu so reduce-motion users get the same instant (un-faded) handoff.
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Minimum time the loader stays on screen. This is POLISH, not work: without it a
// warm start flashes the splash for a frame or two, which reads as a glitch. It is
// the ONLY intentional delay on the boot path - everything else waits on a real
// readiness signal (preload complete, router ready, startup health gate).
const MIN_SPLASH_MS = 600;

// Health-check poll: bounded so a build where `__STARTUP_HEALTH_CHECK__` never
// appears cannot self-schedule forever (it previously recursed at 10 Hz for the
// lifetime of the app).
const HEALTH_POLL_INTERVAL_MS = 100;
const HEALTH_POLL_MAX_ATTEMPTS = 20;

export default function Index() {
  const router = useRouter();
  const { isPreloaded, preloadProgress } = usePreload();
  const [routerReady, setRouterReady] = useState(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  // Diagnostics only - nothing renders from this, so it is a ref, not state
  // (the old `useState` re-rendered the boot screen for a value no one read).
  const startupHealthCheckRef = useRef<any>(null);
  const healthPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped to re-run the navigation effect when a health check defers navigation.
  // (Must be a real value change - `setState(prev => prev)` is a no-op React bails on.)
  const [navRetry, setNavRetry] = useState(0);
  const hasNavigatedRef = useRef(false); // Use ref to prevent double navigation without re-render

  // Lightweight "alive" animations - RN core only (Animated), so the very first
  // production render stays crash-proof (no third-party animation deps here).
  const dot0 = useRef(new Animated.Value(0.3)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  // This launch's background (null until the peek resolves - the flat #020617
  // base shows meanwhile, exactly like the menu's fallback).
  const [bgIndex, setBgIndex] = useState<number | null>(null);
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Three dots that pulse in sequence - a calm "working…" rhythm.
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

  // CRITICAL: Startup health check - verify critical modules before rendering.
  // Bounded poll: the recursive `setTimeout` used to be unstored and uncleared, so
  // a build without `__STARTUP_HEALTH_CHECK__` polled forever, past unmount.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const checkStartupHealth = () => {
      if (cancelled) return;
      const healthCheck = (global as any).__STARTUP_HEALTH_CHECK__;
      if (typeof healthCheck === 'function') {
        const health = healthCheck();
        startupHealthCheckRef.current = health;

        if (health && health.failedModules && health.failedModules.length > 0) {
          if (__DEV__) {
            console.warn('[Index] Startup health check: Some modules failed to load:', health.failedModules);
          }
          // Continue anyway - we have fallbacks
        }
        return;
      }

      attempts += 1;
      if (attempts >= HEALTH_POLL_MAX_ATTEMPTS) {
        if (__DEV__) {
          console.warn('[Index] Startup health check never became available - giving up');
        }
        return;
      }
      healthPollTimerRef.current = setTimeout(checkStartupHealth, HEALTH_POLL_INTERVAL_MS);
    };

    checkStartupHealth();

    return () => {
      cancelled = true;
      if (healthPollTimerRef.current) {
        clearTimeout(healthPollTimerRef.current);
        healthPollTimerRef.current = null;
      }
    };
  }, []);

  // The router object from `useRouter()` is available as soon as this component
  // renders inside the navigator; no timer needed to "wait" for it.
  useEffect(() => {
    if (router) {
      setRouterReady(true);
    }
  }, [router]);

  // The one intentional delay on the boot path - see MIN_SPLASH_MS.
  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // CRITICAL: Programmatic navigation in useEffect, NOT in render
  // Use ref for navigation guard to avoid re-render cycles and race conditions
  useEffect(() => {
    // Guard: Only navigate once, when all conditions are met
    if (hasNavigatedRef.current || !router || !routerReady || !isPreloaded || !minSplashElapsed) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // H9: readiness-driven. This used to sit behind a scripted 6 × 800 ms progress
    // interval + a 500 ms hand-off + a 100 ms "ensure providers are ready" delay,
    // none of which measured anything.
    const run = async () => {
      if (cancelled || hasNavigatedRef.current) {
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
                console.warn('[Index] Navigation health check timed out - proceeding anyway');
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
          // change) so the effect actually re-runs - `setRouterReady(prev => prev)`
          // is a no-op React bails on, which left the app stuck on the loader.
          retryTimer = setTimeout(() => {
            if (!cancelled) {
              setNavRetry((n) => n + 1);
            }
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
    };

    void run();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [isPreloaded, routerReady, router, navRetry, minSplashElapsed]);

  // ALWAYS render a safe fallback screen (never crash).
  // H9: the bar is driven by the REAL signals it is waiting on - preload progress
  // (80% of the bar) and router readiness (the last 20%) - instead of a scripted
  // six-step script that narrated work nobody was doing.
  const currentProgress = Math.round(preloadProgress * 0.8) + (routerReady ? 20 : 0);
  const currentMessage = 'Loading…';

  // Dependency-light loading screen (React Native core only) so the very first
  // production render is crash-proof. This screen owns "/" - app/(tabs) must NOT
  // also claim "/" (it lives at /(tabs)/home), or a production bundle would
  // silently drop this loader. See app/(tabs)/_layout.tsx unstable_settings.
  const pct = Math.max(0, Math.min(100, currentProgress || 0));
  return (
    <View style={loadingStyles.container}>
      {/* Same artwork the menu is about to show, behind the same flat scrim -
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
// may not be loaded yet on this very first screen - RN core only here).
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
