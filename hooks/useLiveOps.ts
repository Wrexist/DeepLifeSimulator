/**
 * The hook every live-ops surface reads - one resolution, shared.
 *
 * WHY IT LIVES IN `hooks/` AND NOT `lib/liveops/`. It reads `GameState` through
 * `useGameSelector`, and `lib/` may not import values from `contexts/` - an
 * upward edge that closes a cycle reads as `undefined` at module init rather
 * than failing the build (CLAUDE.md 5). Everything below it is pure and stays
 * in `lib/liveops/`; this is the one layer that touches React and the store.
 *
 * WHY A HOOK AND NOT A CONTEXT. The content itself is loaded once per session
 * into a module-level holder (`content.ts`), so there is nothing to provide;
 * what varies per render is the SAVE, and this hook is where the two meet. A
 * provider would add a tree wrapper and a re-render boundary for a value the
 * hub and the home card can each derive in a memo.
 *
 * WHY IT MEMOISES ON PRIMITIVES AND NOT ON THE STATE OBJECT. Objectives read
 * arbitrary fields, so the resolution genuinely depends on the whole save - but
 * `GameState` gets a new identity on every tick, and re-resolving on every one
 * would put a `net_worth` portfolio walk on the hot path. The memo key is the
 * set of things that can actually change an answer: the week, the claim ledger,
 * and the content epoch. Between those, a stale progress number costs one
 * render of a slightly out-of-date bar; recomputing eagerly costs the walk.
 */
import { useEffect, useMemo } from 'react';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { weeksSinceLifeStart } from '@/utils/weekCounters';
// The CANONICAL entitlement check. Reading `settings.deepLifePlusActivated`
// directly here would miss `lifetimePremium`, so a lifetime purchaser would be
// refused a members-only event they paid for.
import { hasDeepLifePlusEntitlement } from '@/lib/subscription/deepLifePlus';
import type { GameState } from '@/contexts/game/types';
import { getLiveOpsContent, getContentEpoch } from '@/lib/liveops/content';
import { daysBetween, ensureLiveOpsSession, getLiveOpsSession } from '@/lib/liveops/session';
import { analytics } from '@/lib/analytics';
import { resolveAll, forDisplay, claimableCount } from '@/lib/liveops/engine';
import { observeLiveOpsFunnel } from '@/lib/liveops/funnel';
import type { EligibilityContext } from '@/lib/liveops/eligibility';
import type { ResolvedLiveEvent } from '@/lib/liveops/types';

/** A stable empty array, so the observer effect does not re-run on identity. */
const EMPTY_IDS: readonly string[] = [];

/** Everything a live-ops surface needs. */
export interface LiveOpsView {
  /** What the player sees: `unavailable` and `expired` removed, sorted. */
  events: ResolvedLiveEvent[];
  /** Everything, for the funnel observer. Not for rendering. */
  all: ResolvedLiveEvent[];
  claimable: number;
  /** Weeks into this life, for the claim call. */
  weeksThisLife: number;
  context: EligibilityContext;
}

/**
 * Resolve the hub for the current player.
 *
 * `installId` and `daysAway` come from the FROZEN session (`liveops/session.ts`)
 * rather than being read live. Both of them move during a session - `lastLogin`
 * is rewritten by the welcome-back path, and the install id is empty until the
 * analytics service finishes loading - so reading either at render time would
 * make an event appear and then vanish under the player's finger. See that
 * file for the full reasoning.
 */
export function useLiveOps(): LiveOpsView {
  const state = useGameSelector((s) => s) as GameState;
  const weeksLived = state?.weeksLived ?? 0;
  const lifeStartWeek = state?.lifeStartWeek;
  const weeksThisLife = weeksSinceLifeStart(weeksLived, lifeStartWeek);
  const totalPrestiges = state?.prestige?.totalPrestiges ?? 0;
  const isSubscriber = hasDeepLifePlusEntitlement(state?.settings);

  // The claim ledger's LENGTH is enough of a key: it only ever grows, and the
  // one thing a claim changes about this view is that an event moves to
  // `claimed`. Hashing the ids would be more precise and cost more than the
  // re-resolution it saves.
  const claimCount = state?.liveOps?.claimedInstanceIds?.length ?? 0;
  const epoch = getContentEpoch();
  // Capture on the first read where both are knowable, then frozen for the
  // process. `lastLogin` lives in the save, so the boot sequence is too early;
  // this is the earliest point at which it and the install id both exist, and
  // it is still before any live-ops surface has rendered.
  ensureLiveOpsSession(analytics.getInstallId(), daysBetween(state?.lastLogin, Date.now()));
  const { installId, daysAway } = getLiveOpsSession();

  const claimedIds = state?.liveOps?.claimedInstanceIds ?? EMPTY_IDS;

  const view = useMemo(() => {
    const context: EligibilityContext = {
      weeksThisLife,
      totalPrestiges,
      isSubscriber,
      daysAway,
      installId,
    };
    // The clock is read at resolution time, so a session left open across an
    // event boundary picks the change up on its next re-resolve rather than
    // holding a stale window forever.
    // Resolve EVERYTHING, then split: the observer needs the events the hub
    // hides (an expiry is a transition nobody else can see), the player does
    // not.
    const now = Date.now();
    const all = resolveAll(getLiveOpsContent().events, state, context, now);
    const events = forDisplay(all, now);
    return { all, events, claimable: claimableCount(events), weeksThisLife, context };
    // `state` is deliberately absent from the deps - see the header.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeksThisLife, totalPrestiges, isSubscriber, daysAway, installId, claimCount, epoch]);

  // The funnel's three TRANSITION steps - progressed, completed, expired - live
  // here rather than in the memo above, because emitting from a memo body is a
  // side effect during the render phase and double-fires under StrictMode. The
  // observer is idempotent per session, so an extra run costs nothing.
  useEffect(() => {
    observeLiveOpsFunnel(view.all, claimedIds, view.weeksThisLife);
  }, [view, claimedIds]);

  return view;
}
