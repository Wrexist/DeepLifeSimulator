/**
 * ReviewPromptHandler — headless watcher that turns positive beats into a
 * well-timed native review request.
 *
 * Mounted once inside `GameProvider` (next to `IAPHandler`), it renders
 * nothing and never re-renders. It subscribes straight to the GameState store,
 * diffs consecutive snapshots through the pure helpers in `utils/reviewMoments`,
 * and hands a hit to `maybeRequestReview`, which owns the frequency throttling.
 *
 * THE TIMING, WHICH IS THE WHOLE POINT
 * ------------------------------------
 * A beat commits the instant the state changes — while the toast, the haptic
 * and the celebration animation are all still running. Firing the sheet there
 * covers the reward the player is still reading, so instead the handler ARMS
 * the beat and polls `decideReviewTiming` until the moment is actually right:
 * the animation has finished, the player has stopped ticking weeks, no modal
 * is in the way, and the app is still in the foreground.
 *
 * While armed it keeps watching. A bigger beat upgrades the pending one (and a
 * second beat inside the window means the player is on a roll, which earns a
 * small streak bonus). A sour beat — bankruptcy, jail, death, a health or money
 * collapse — abandons it outright: asking for a rating seconds after a disaster
 * is how you earn one star and waste one of iOS's three yearly asks doing it.
 *
 * WHY A WATCHER AND NOT A CALL INSIDE THE REDUCERS
 * ------------------------------------------------
 * The promotion / ambition / trade paths are pure reducers and `setGameState`
 * updaters. Firing an async native call from inside a state updater is a bug
 * waiting to happen: React may invoke an updater more than once for a single
 * commit, so one positive beat would fire twice.
 *
 * WHY THE STORE AND NOT `useGameSelector`
 * ---------------------------------------
 * Beats are spread across careers, ambitions and both markets, so a selector
 * would have to select the whole snapshot — which re-renders this component on
 * every single state mutation, the exact anti-pattern the selector channel
 * exists to avoid. Subscribing directly costs zero renders. It also degrades
 * safely: `useGameSelector` THROWS without a provider, and a throw here would
 * take down the surrounding provider boundary and show the player a "Game
 * Initialization Error" screen over an entirely optional feature.
 */

import { useContext, useEffect } from 'react';
import { AppState } from 'react-native';
import { GameStoreContext } from '@/contexts/game/useGameSelector';
import {
  decideReviewTiming,
  detectReviewMoment,
  detectSourMoment,
  isCalmEnoughToAsk,
  MIN_REVIEW_INTENSITY,
  STREAK_INTENSITY_BONUS,
  TIMING_POLL_MS,
  type ReviewTrigger,
} from '@/utils/reviewMoments';
import { maybeRequestReview } from '@/utils/ratingPrompt';
import { logger } from '@/utils/logger';

interface ArmedBeat {
  trigger: ReviewTrigger;
  intensity: number;
  armedAt: number;
  /** Set when a sour beat lands while armed; checked on the next poll. */
  soured: boolean;
  /** How many qualifying beats landed in this window (2+ = on a roll). */
  beats: number;
}

export function ReviewPromptHandler() {
  const store = useContext(GameStoreContext);

  useEffect(() => {
    if (!store) {
      logger.debug('[ReviewPromptHandler] No game store in context — review prompts disabled');
      return;
    }

    // Seed from the snapshot at subscribe time so the first change is diffed
    // against real state. Without this a freshly-loaded save would read as
    // "you just got promoted" against an empty baseline.
    let prev = store.getSnapshot();
    let lastWeekChangeAt = 0;
    let armed: ArmedBeat | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const disarm = () => {
      armed = null;
      clearTimer();
    };

    const poll = () => {
      timer = null;
      if (disposed || !armed) return;

      const beat = armed;
      const decision = decideReviewTiming({
        now: Date.now(),
        armedAt: beat.armedAt,
        lastWeekChangeAt,
        appActive: AppState.currentState === 'active',
        soured: beat.soured,
        calm: isCalmEnoughToAsk(store.getSnapshot()),
      });

      if (decision === 'wait') {
        timer = setTimeout(poll, TIMING_POLL_MS);
        return;
      }

      if (decision === 'abandon') {
        logger.debug('[ReviewPromptHandler] Dropped armed review moment', {
          trigger: beat.trigger,
          soured: beat.soured,
        });
        disarm();
        return;
      }

      disarm();
      void maybeRequestReview(beat.trigger, store.getSnapshot())
        .then((outcome) => {
          if (outcome.requested) return;
          logger.debug('[ReviewPromptHandler] Skipped review prompt', {
            trigger: beat.trigger,
            reason: outcome.reason,
          });
        })
        .catch((err) => {
          // maybeRequestReview swallows its own errors; this is belt and braces
          // so a rejected promise can never surface as an unhandled rejection.
          logger.warn('[ReviewPromptHandler] Review prompt failed', {
            trigger: beat.trigger,
            err: String(err),
          });
        });
    };

    const unsubscribe = store.subscribe(() => {
      const next = store.getSnapshot();
      const before = prev;
      prev = next;

      if (next?.weeksLived !== before?.weeksLived) {
        lastWeekChangeAt = Date.now();
      }

      // A disaster kills any armed beat. Flagged rather than acted on here so
      // the decision stays in one place (`decideReviewTiming`).
      if (armed && detectSourMoment(before, next)) {
        armed = { ...armed, soured: true };
      }

      const moment = detectReviewMoment(before, next);
      if (!moment) return;

      if (armed) {
        // Already waiting on a beat. A second qualifying one inside the window
        // means the player is on a roll — keep the strongest, add the streak
        // bonus, and do NOT restart the clock: the goal is to land inside the
        // glow, not to keep pushing the ask further out.
        const intensity = Math.min(
          1,
          Math.max(armed.intensity, moment.intensity) + STREAK_INTENSITY_BONUS
        );
        armed = {
          ...armed,
          trigger: moment.intensity > armed.intensity ? moment.trigger : armed.trigger,
          intensity,
          beats: armed.beats + 1,
        };
        return;
      }

      if (moment.intensity < MIN_REVIEW_INTENSITY) {
        logger.debug('[ReviewPromptHandler] Beat too small to ask on', {
          trigger: moment.trigger,
          intensity: moment.intensity,
        });
        return;
      }

      armed = {
        trigger: moment.trigger,
        intensity: moment.intensity,
        armedAt: Date.now(),
        soured: false,
        beats: 1,
      };
      clearTimer();
      timer = setTimeout(poll, TIMING_POLL_MS);
    });

    return () => {
      disposed = true;
      clearTimer();
      unsubscribe();
    };
  }, [store]);

  return null;
}

export default ReviewPromptHandler;
