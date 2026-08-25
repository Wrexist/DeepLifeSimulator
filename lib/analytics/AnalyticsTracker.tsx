/**
 * AnalyticsTracker - centralized, render-free funnel instrumentation (Wave 0.1.3).
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
import { useGameUI } from '@/contexts/game/GameUIContext';
import { track, analytics } from '@/lib/analytics';
import { checkSubscriptionHealth } from '@/services/subscriptionHealthMonitor';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

export function AnalyticsTracker(): null {
  const weeksLived = useGameSelector((s) => s.weeksLived ?? 0);
  // `week_advanced` fires on the DELTA of the absolute counter, which is right.
  // `first_week_completed` is a funnel milestone - "this player played a week" -
  // and must measure weeks into THIS life: `weeksLived` is seeded from the
  // starting age, so `>= 1` was already true at mount for every scenario that
  // does not start at 18, the ref armed itself, and the event never fired for
  // them. It is the first-session funnel that was blind. CLAUDE.md §4.2.
  const lifeStartWeek = useGameSelector((s) => s.lifeStartWeek);
  const weeksThisLife = weeksSinceLifeStart(weeksLived, lifeStartWeek);
  const generation = useGameSelector((s) => s.generationNumber ?? 1);
  // The prestige edge watches the PRESTIGE COUNTER, not the generation number:
  // the reset path deliberately does not increment generation (same character,
  // fresh start - prestigeExecution.ts:321), so a generation-edge made every
  // "start fresh" prestige invisible while counting heir continuations from
  // death - which award nothing - as prestiges. Half the funnel, mislabeled.
  const totalPrestiges = useGameSelector((s) => s.prestige?.totalPrestiges ?? 0);
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
  const prevPrestiges = useRef(totalPrestiges);
  const prevDeath = useRef(showDeathPopup);
  const firstWeekFired = useRef(weeksThisLife >= 1); // already past week 1 on load → don't fire

  // week_advanced - fire once per actual week increment; first_week_completed once.
  useEffect(() => {
    if (!ready) {
      // Keep refs armed from the (hydrating) values; do not emit.
      prevWeeks.current = weeksLived;
      firstWeekFired.current = weeksThisLife >= 1;
      return;
    }
    if (weeksLived > prevWeeks.current) {
      track('week_advanced', { weeksLived, age });
    }
    if (!firstWeekFired.current && weeksThisLife >= 1) {
      track('first_week_completed', { age });
      firstWeekFired.current = true;
    }
    prevWeeks.current = weeksLived;
  }, [weeksLived, weeksThisLife, age, ready]);

  // screen_view - fire on route change (no-op unless telemetry is enabled).
  useEffect(() => {
    if (pathname) track('screen_view', { path: pathname });
  }, [pathname]);

  // death - fire on the false→true edge of the death popup.
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

  // prestige - fire when the prestige counter advances (both paths increment
  // it; see the totalPrestiges selector note). Generation rides along as a
  // property so heir-vs-reset is still distinguishable downstream.
  useEffect(() => {
    if (!ready) {
      prevPrestiges.current = totalPrestiges;
      return;
    }
    if (totalPrestiges > prevPrestiges.current) {
      track('prestige', { generation, totalPrestiges, weeksLived });
    }
    prevPrestiges.current = totalPrestiges;
  }, [totalPrestiges, generation, weeksLived, ready]);

  // Subscription health - once per session, after the save has hydrated.
  // Reads willRenew/expiry off the customerInfo RevenueCat already fetches and
  // emits the state snapshot + cancel/renew/recover/lapse edges. Fire-and-
  // forget: the monitor is internally idempotent per session, no-ops on
  // non-RevenueCat builds, and swallows every failure path.
  useEffect(() => {
    if (!ready) return;
    void checkSubscriptionHealth();
  }, [ready]);

  // session_end + flush when the app backgrounds.
  //
  // `session_end` was in the event catalogue from the start and emitted by
  // nothing, which left SESSION LENGTH unmeasurable - and for a Day-1
  // retention figure below the 25th percentile of the peer set, how long a
  // first session lasts is the most diagnostic number there is. Nothing
  // supplies it for free either: the transport here is a plain-JS batcher, not
  // the Firebase SDK.
  //
  // It fires on the same background edge as the flush and strictly BEFORE it,
  // so the event makes the batch it belongs to instead of waiting for a next
  // launch that may never come.
  //
  // `foreground → background` only. iOS raises `inactive` for a notification
  // shade pull or an incoming call, and treating that as the end of a session
  // would cut the measured length of every session that survives one.
  const sessionStart = useRef(Date.now());
  const sessionEnded = useRef(false);
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background') {
        if (!sessionEnded.current) {
          sessionEnded.current = true;
          track('session_end', {
            durationSec: Math.round((Date.now() - sessionStart.current) / 1000),
            weeksLived,
          });
        }
        void analytics.flush();
      } else if (next === 'active' && sessionEnded.current) {
        // Resumed. Start a fresh clock rather than counting the time the app
        // spent backgrounded as play.
        sessionEnded.current = false;
        sessionStart.current = Date.now();
      } else if (next === 'inactive') {
        void analytics.flush();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [weeksLived]);

  return null;
}
