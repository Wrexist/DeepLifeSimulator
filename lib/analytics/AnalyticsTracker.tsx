/**
 * AnalyticsTracker — centralized, render-free funnel instrumentation (Wave 0.1.3).
 *
 * Watches a few primitive GameState fields via `useGameSelector` and emits
 * analytics events on *transitions* (not every render). Keeping this in one
 * place avoids sprinkling `track()` calls through the hot `nextWeek()` updater
 * and across screens. `track()` is itself a hard no-op unless telemetry is
 * enabled + consented, so this component is inert in default builds.
 *
 * Mount once inside the GameProvider tree (see app/_layout.tsx).
 */
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { useGameUI } from '@/contexts/game/GameUIContext';
import { track, analytics } from '@/lib/analytics';

/**
 * Pure decision for a foreground/background transition, given whether a session
 * is currently considered active. Tracking `sessionActive` (rather than the raw
 * previous AppState) is what makes this correct across iOS's transient
 * `inactive` hop: resume is background → inactive → active, so by the time we
 * see `active` the previous state is `inactive`, not `background`. The transient
 * `inactive` state just flushes and never opens/closes a session.
 * Extracted so the boundary rules are unit-testable without mounting.
 */
export function nextSessionAction(
  sessionActive: boolean,
  next: AppStateStatus
): { emit: 'session_start' | 'session_end' | null; flush: boolean } {
  if (next === 'background' && sessionActive) {
    return { emit: 'session_end', flush: true };
  }
  if (next === 'active' && !sessionActive) {
    return { emit: 'session_start', flush: false };
  }
  if (next === 'inactive') {
    return { emit: null, flush: true };
  }
  return { emit: null, flush: false };
}

export function AnalyticsTracker(): null {
  const weeksLived = useGameSelector((s) => s.weeksLived ?? 0);
  const generation = useGameSelector((s) => s.generationNumber ?? 1);
  const showDeathPopup = useGameSelector((s) => !!s.showDeathPopup);
  const deathReason = useGameSelector((s) => s.deathReason ?? '');
  const age = useGameSelector((s) => s.date?.age ?? 0);
  const pathname = usePathname();
  // Gate transition events until the save has hydrated: while `isLoading` is true,
  // the loaded values arrive AFTER mount, which would otherwise be mis-read as
  // in-session week/prestige/death transitions for returning players.
  const { isLoading } = useGameUI();
  const ready = !isLoading;

  const prevWeeks = useRef(weeksLived);
  const prevGeneration = useRef(generation);
  const prevDeath = useRef(showDeathPopup);
  const firstWeekFired = useRef(weeksLived >= 1); // already past week 1 on load → don't fire

  // week_advanced — fire once per actual week increment; first_week_completed once.
  useEffect(() => {
    if (!ready) {
      // Keep refs armed from the (hydrating) values; do not emit.
      prevWeeks.current = weeksLived;
      firstWeekFired.current = weeksLived >= 1;
      return;
    }
    if (weeksLived > prevWeeks.current) {
      track('week_advanced', { weeksLived, age });
    }
    if (!firstWeekFired.current && weeksLived >= 1) {
      track('first_week_completed', { age });
      firstWeekFired.current = true;
    }
    prevWeeks.current = weeksLived;
  }, [weeksLived, age, ready]);

  // screen_view — fire on route change (no-op unless telemetry is enabled).
  useEffect(() => {
    if (pathname) track('screen_view', { path: pathname });
  }, [pathname]);

  // death — fire on the false→true edge of the death popup.
  useEffect(() => {
    if (!ready) {
      prevDeath.current = showDeathPopup;
      return;
    }
    if (showDeathPopup && !prevDeath.current) {
      track('death', { weeksLived, age, reason: deathReason });
    }
    prevDeath.current = showDeathPopup;
  }, [showDeathPopup, weeksLived, age, deathReason, ready]);

  // prestige — fire when the generation counter advances.
  useEffect(() => {
    if (!ready) {
      prevGeneration.current = generation;
      return;
    }
    if (generation > prevGeneration.current) {
      track('prestige', { generation, weeksLived });
    }
    prevGeneration.current = generation;
  }, [generation, weeksLived, ready]);

  // Session boundaries + flush on background. The initial `session_start` fires
  // once at app init (app/_layout.tsx); here we pair it: emit `session_end` when
  // the app backgrounds (with the session's duration) and a fresh `session_start`
  // when it returns to the foreground — so a reopened app still counts as an
  // active session for DAU/retention instead of one start lasting forever.
  // Only the clean active↔background edges are session boundaries; the
  // transient 'inactive' state (app switcher, notification shade) just flushes.
  // Mounted during the init session (app/_layout.tsx already fired its
  // `session_start`), so we start in the active state.
  const sessionActiveRef = useRef(true);
  const sessionStartTsRef = useRef<number>(Date.now());
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const { emit, flush } = nextSessionAction(sessionActiveRef.current, next);
      if (emit === 'session_end') {
        track('session_end', { durationMs: Date.now() - sessionStartTsRef.current });
        sessionActiveRef.current = false;
      } else if (emit === 'session_start') {
        sessionStartTsRef.current = Date.now();
        track('session_start', { platform: Platform.OS, resumed: true });
        sessionActiveRef.current = true;
      }
      if (flush) void analytics.flush();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return null;
}
