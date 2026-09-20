/**
 * Headless: watches for a week worth celebrating and asks for a rating once.
 *
 * Mounted at the tab-group level so it sees whichever screen the player is on.
 * Renders nothing. All the policy lives in `lib/review/inAppReview.ts`; this
 * only supplies the live signals and calls the request.
 */
import { useEffect, useRef } from 'react';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { weeksSinceLifeStart } from '@/utils/weekCounters';
import {
  isPositiveWeek,
  shouldAskForReview,
  requestReviewOnce,
  hasAskedForReview,
} from '@/lib/review/inAppReview';

export default function InAppReviewPrompt() {
  // null = not read yet; the gate waits rather than firing blind.
  const alreadyAsked = useRef<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    hasAskedForReview().then((v) => {
      if (!cancelled) alreadyAsked.current = v;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signals = useGameSelector(
    (s) => ({
      weeksLived: s?.weeksLived ?? 0,
      lifeStartWeek: s?.lifeStartWeek ?? 0,
      positive: isPositiveWeek(s),
      blocked: !!(
        s?.showDeathPopup ||
        s?.showWeddingPopup ||
        (s?.jailWeeks ?? 0) > 0 ||
        s?.lifeMoments?.pendingMoment
      ),
    }),
    shallowEqual,
  );

  useEffect(() => {
    if (alreadyAsked.current === null) return;
    const eligible = shouldAskForReview({
      weeksInLife: weeksSinceLifeStart(weeksLivedSafe(signals.weeksLived), signals.lifeStartWeek),
      alreadyAsked: alreadyAsked.current,
      positiveWeek: signals.positive,
      blocked: signals.blocked,
    });
    if (!eligible) return;
    // Optimistic latch: the ask can never re-fire while the promise settles.
    alreadyAsked.current = true;
    void requestReviewOnce();
  }, [signals]);

  return null;
}

const weeksLivedSafe = (n: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : 0;
