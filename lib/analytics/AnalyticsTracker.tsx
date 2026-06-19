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
import { AppState, AppStateStatus } from 'react-native';
import { usePathname } from 'expo-router';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { track, analytics } from '@/lib/analytics';

export function AnalyticsTracker(): null {
  const weeksLived = useGameSelector((s) => s.weeksLived ?? 0);
  const generation = useGameSelector((s) => s.generationNumber ?? 1);
  const showDeathPopup = useGameSelector((s) => !!s.showDeathPopup);
  const deathReason = useGameSelector((s) => s.deathReason ?? '');
  const age = useGameSelector((s) => s.date?.age ?? 0);
  const pathname = usePathname();

  const prevWeeks = useRef(weeksLived);
  const prevGeneration = useRef(generation);
  const prevDeath = useRef(showDeathPopup);
  const firstWeekFired = useRef(weeksLived >= 1); // already past week 1 on load → don't fire

  // week_advanced — fire once per actual week increment; first_week_completed once.
  useEffect(() => {
    if (weeksLived > prevWeeks.current) {
      track('week_advanced', { weeksLived, age });
    }
    if (!firstWeekFired.current && weeksLived >= 1) {
      track('first_week_completed', { age });
      firstWeekFired.current = true;
    }
    prevWeeks.current = weeksLived;
  }, [weeksLived, age]);

  // screen_view — fire on route change (no-op unless telemetry is enabled).
  useEffect(() => {
    if (pathname) track('screen_view', { path: pathname });
  }, [pathname]);

  // death — fire on the false→true edge of the death popup.
  useEffect(() => {
    if (showDeathPopup && !prevDeath.current) {
      track('death', { weeksLived, age, reason: deathReason });
    }
    prevDeath.current = showDeathPopup;
  }, [showDeathPopup, weeksLived, age, deathReason]);

  // prestige — fire when the generation counter advances.
  useEffect(() => {
    if (generation > prevGeneration.current) {
      track('prestige', { generation, weeksLived });
    }
    prevGeneration.current = generation;
  }, [generation, weeksLived]);

  // Flush queued events when the app backgrounds so a kill doesn't drop them
  // (the interval flush alone can lose the tail of a session).
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') void analytics.flush();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return null;
}
