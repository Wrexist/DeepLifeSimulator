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
import { useGameSelector, useGameStateGetter } from '@/contexts/game/useGameSelector';
import { useGameUI } from '@/contexts/game/GameUIContext';
import { track, analytics } from '@/lib/analytics';
import { resolveProgressionStage, type ProgressionStage } from '@/lib/analytics/progression';
import {
  diffEconomySamples,
  isEconomySampleWeek,
  type EconomySample,
} from '@/lib/analytics/economySnapshot';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { trackFeatureUse } from '@/lib/analytics/featureAdoption';
import { featureForRoute } from '@/lib/analytics/featureRoutes';
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

  // progression_stage - fire on the EDGE between stages, never per week.
  //
  // A week histogram cannot answer "where does the game stop giving players a
  // reason to continue", because it has no notion of a player having arrived
  // anywhere. The edge carries how many weeks the PREVIOUS stage took, which is
  // what turns a drop-off into a diagnosis: a stage everyone reaches and nobody
  // leaves is a content wall, and one that takes three times as long as the
  // stage before it is a difficulty spike.
  //
  // Regressions are emitted too, not filtered. `endgame` is reached by
  // prestiging, and a prestige resets the life clock — so stage moves BACKWARD
  // legitimately, and a forward-only guard would silently drop the transition
  // that matters most for the endgame loop. `direction` records which it was.
  const stage = resolveProgressionStage({ weeksThisLife, totalPrestiges });
  const prevStage = useRef<ProgressionStage>(stage);
  const stageEnteredAtWeek = useRef(weeksThisLife);
  useEffect(() => {
    if (!ready) {
      prevStage.current = stage;
      stageEnteredAtWeek.current = weeksThisLife;
      return;
    }
    if (stage !== prevStage.current) {
      track('progression_stage', {
        stage,
        fromStage: prevStage.current,
        direction: stage === 'endgame' || weeksThisLife >= stageEnteredAtWeek.current ? 'forward' : 'reset',
        weeksThisLife,
        // Floored at zero: a prestige resets the life clock, so the raw
        // subtraction across that edge is negative and would read as a stage
        // completed in negative time.
        weeksInPreviousStage: Math.max(0, weeksThisLife - stageEnteredAtWeek.current),
        totalPrestiges,
      });
      prevStage.current = stage;
      stageEnteredAtWeek.current = weeksThisLife;
    }
  }, [stage, weeksThisLife, totalPrestiges, ready]);

  // economy_week - a sampled aggregate rollup, one in-game MONTH at a time.
  //
  // Read through `getState()` rather than a selector: net worth is a walk over
  // properties, businesses and portfolios, and a selector would recompute it on
  // every state change all game to produce a number that is read four times a
  // month. Here the whole read happens only on a sample boundary.
  //
  // The previous sample is held in a ref, NOT persisted. A rollup that spans an
  // app restart would report a month's earnings against whatever the counters
  // held at launch, and the first sample of each session already reports the
  // life's totals so far (see diffEconomySamples), so nothing is lost — the
  // spans still tile the life, they are just cut at session boundaries, which
  // `spanWeeks` makes visible.
  const getState = useGameStateGetter();
  const lastEconomySample = useRef<EconomySample | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (!isEconomySampleWeek(weeksThisLife)) return;
    if (lastEconomySample.current?.weeksThisLife === weeksThisLife) return;
    try {
      const state = getState();
      const lifetime = state.lifetimeStatistics;
      const sample: EconomySample = {
        totalEarned: lifetime?.totalMoneyEarned ?? 0,
        totalSpent: lifetime?.totalMoneySpent ?? 0,
        money: state.stats?.money ?? 0,
        netWorth: calculateNetWorth(state),
        weeksThisLife,
      };
      track('economy_week', { ...diffEconomySamples(lastEconomySample.current, sample) });
      lastEconomySample.current = sample;
    } catch {
      // Telemetry must never take down a week advance. A missed sample costs
      // one row; a throw here would land inside the core loop.
    }
  }, [weeksThisLife, ready, getState]);

  // screen_view - fire on route change (no-op unless telemetry is enabled).
  //
  // The same edge feeds feature adoption for the routes that ARE features
  // (`featureForRoute` returns null for hubs like home and the app launcher, so
  // they do not appear as permanent 100%-adoption rows and crowd out the real
  // ones). Doing it here rather than in each screen is what keeps every feature
  // measured the same way; twenty scattered call sites is how three of them end
  // up with the wrong id.
  //
  // `weeksLived` is read through a REF, not a dependency. Adding it to the
  // dependency array would re-run this effect on every week advance and emit a
  // `screen_view` per week for a route the player never left - inflating the
  // most-used event in the catalogue with rows that describe nothing. The ref
  // gives the current value without making the effect depend on it.
  const weeksLivedRef = useRef(weeksLived);
  weeksLivedRef.current = weeksLived;
  useEffect(() => {
    if (!pathname) return;
    track('screen_view', { path: pathname });
    const feature = featureForRoute(pathname);
    if (feature) trackFeatureUse(feature, weeksLivedRef.current);
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
        // Re-check subscription health on resume: the monitor self-throttles
        // (6h window, and a FAILED check never stamps), so this is what lets
        // an offline launch recover visibility once connectivity returns and
        // a week-resident process still see a renewal happen.
        void checkSubscriptionHealth();
      } else if (next === 'inactive') {
        void analytics.flush();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [weeksLived]);

  return null;
}
