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
import { useMemo } from 'react';
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
import { resolveHub, claimableCount } from '@/lib/liveops/engine';
import type { EligibilityContext } from '@/lib/liveops/eligibility';
import type { ResolvedLiveEvent } from '@/lib/liveops/types';

/** Everything a live-ops surface needs. */
export interface LiveOpsView {
  events: ResolvedLiveEvent[];
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

  return useMemo(() => {
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
    const events = resolveHub(getLiveOpsContent().events, state, context, Date.now());
    return { events, claimable: claimableCount(events), weeksThisLife, context };
    // `state` is deliberately absent from the deps - see the header.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeksThisLife, totalPrestiges, isSubscriber, daysAway, installId, claimCount, epoch]);
}
