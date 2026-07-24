/**
 * ReviewPromptHandler — headless watcher that turns positive beats into a
 * native review request.
 *
 * Mounted once inside `GameProvider` (next to `IAPHandler`), it renders
 * nothing and never re-renders. It subscribes straight to the GameState store,
 * diffs consecutive snapshots through the pure `detectReviewMoment`, and hands
 * any hit to `maybeRequestReview`, which owns all throttling.
 *
 * WHY A WATCHER AND NOT A CALL INSIDE THE REDUCERS
 * ------------------------------------------------
 * The promotion / ambition / trade paths are pure reducers and `setGameState`
 * updaters. Firing an async native call from inside a state updater is a bug
 * waiting to happen: React may invoke an updater more than once for a single
 * commit, so one positive beat would fire twice. Subscribing after commit gives
 * exactly one callback per committed change, and it is also the right MOMENT to
 * ask — the celebration toast is already on screen and the player is idle.
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
import { GameStoreContext } from '@/contexts/game/useGameSelector';
import { detectReviewMoment } from '@/utils/reviewMoments';
import { maybeRequestReview } from '@/utils/ratingPrompt';
import { logger } from '@/utils/logger';

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

    return store.subscribe(() => {
      const next = store.getSnapshot();
      const trigger = detectReviewMoment(prev, next);
      prev = next;
      if (!trigger) return;

      void maybeRequestReview(trigger, next)
        .then((outcome) => {
          if (outcome.requested) return;
          logger.debug('[ReviewPromptHandler] Skipped review prompt', {
            trigger,
            reason: outcome.reason,
          });
        })
        .catch((err) => {
          // maybeRequestReview swallows its own errors; this is belt and braces
          // so a rejected promise can never surface as an unhandled rejection.
          logger.warn('[ReviewPromptHandler] Review prompt failed', {
            trigger,
            err: String(err),
          });
        });
    });
  }, [store]);

  return null;
}

export default ReviewPromptHandler;
