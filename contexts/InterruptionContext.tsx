/**
 * InterruptionContext - one queue for everything that interrupts the player.
 *
 * ## The problem this replaces
 *
 * Before this existed there were FOUR independent popup priority chains that
 * could not see each other:
 *
 *   - `app/(tabs)/_layout.tsx`  - weekly result sheet, life moment, event inbox
 *   - `app/(tabs)/home.tsx`     - goal / daily reward / welcome back / community
 *   - `components/PremiumPassPromo.tsx` - deferred by nothing at all
 *   - `components/AdRewardOrb.tsx`      - its own blocking predicate
 *
 * Each surface owned a `visible` boolean plus a hand-rolled expression like
 * `visible={showCommunityReward && !blockingModalUp && !showGoalCompletion &&
 * !gameState.showDailyRewardPopup && !showWelcomeBack}`. Every popup added a
 * term to every later popup's condition - O(n²) conditions that still could not
 * express "the sheet in the other file outranks me".
 *
 * The result: a single "Next Week" press could stack up to seven concurrent
 * surfaces, three of them RN Modals with independent backdrops, arriving on
 * staggered `setTimeout`s in an order nobody had defined.
 *
 * ## The model
 *
 * Declarative, not acquire/release. A surface says *"I want to show, at this
 * priority"* every render; the provider grants the slot to exactly one claimant
 * - the highest priority, ties broken by id so the winner is deterministic.
 *
 * This shape matters for robustness: a claim is derived from the surface's own
 * `wants` flag, so a surface that unmounts, errors, or simply stops wanting to
 * show releases automatically. There is no imperative release that can be
 * skipped and no way to deadlock the queue by forgetting one.
 *
 * ## Usage
 *
 *   const canShow = useInterruptionSlot('daily-reward', INTERRUPTION_PRIORITY.DAILY_REWARD, wantsToShow);
 *   return <DailyRewardPopup visible={canShow} … />;
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';

/**
 * Higher wins. Ordered by how much the player NEEDS to deal with the surface,
 * not by how much the app wants to show it - which is why both monetization
 * surfaces sit at the bottom.
 */
export const INTERRUPTION_PRIORITY = {
  /** Run ended. Gates its own dismissal; nothing may cover it. */
  DEATH: 100,
  WEDDING: 90,
  LIFE_MOMENT: 80,
  EVENT_INBOX: 70,
  // 60 was GOAL_COMPLETE, retired with the linear goal system (its completion
  // predicates were unreachable, so the popup could never present). The gap is
  // left deliberately: renumbering would silently reorder every surface below.
  /**
   * The return summary for a day-plus absence. Deliberately ABOVE the daily
   * gem popup: on a returning player's first session of a new day both want
   * the slot, and the session should open on "here is your life and what's
   * coming", not on a gem count. The daily reward keeps its claim while
   * outranked (its `wants` flag is game state, not a timer) and presents the
   * moment the summary closes - nothing is lost, only ordered.
   */
  WELCOME_BACK: 55,
  DAILY_REWARD: 50,
  COMMUNITY_REWARD: 42,
  /** The end-of-week payoff beat. Loses to anything the player must act on. */
  WEEK_RESULT: 40,
  /** Optional offers. Must never cover a dialog that requires an answer. */
  PROMO: 20,
  AD_ORB: 10,
} as const;

export type InterruptionPriority =
  (typeof INTERRUPTION_PRIORITY)[keyof typeof INTERRUPTION_PRIORITY];

interface InterruptionContextValue {
  /** Register or clear this surface's claim. */
  claim: (id: string, priority: number | null) => void;
  /** The id currently holding the slot, or null when nothing wants to show. */
  activeId: string | null;
}

const InterruptionContext = createContext<InterruptionContextValue | undefined>(
  undefined
);

export function InterruptionProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Record<string, number>>({});

  const claim = useCallback((id: string, priority: number | null) => {
    setClaims((prev) => {
      if (priority === null) {
        if (!(id in prev)) return prev; // no-op keeps the identity stable
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (prev[id] === priority) return prev;
      return { ...prev, [id]: priority };
    });
  }, []);

  const activeId = useMemo(() => {
    let winner: string | null = null;
    let best = -Infinity;
    // Sort the ids so equal priorities resolve the same way every render
    // rather than following object insertion order.
    for (const id of Object.keys(claims).sort()) {
      const p = claims[id];
      if (p > best) {
        best = p;
        winner = id;
      }
    }
    return winner;
  }, [claims]);

  const value = useMemo(() => ({ claim, activeId }), [claim, activeId]);

  return (
    <InterruptionContext.Provider value={value}>
      {children}
    </InterruptionContext.Provider>
  );
}

/**
 * Claim the interruption slot at `priority` while `wants` is true.
 *
 * Returns true only when this surface both wants to show AND currently outranks
 * every other claimant. Safe to call outside the provider (returns `wants`
 * unchanged) so a surface rendered in isolation - a test, a screenshot harness -
 * behaves exactly as it did before the queue existed.
 */
export function useInterruptionSlot(
  id: string,
  priority: number,
  wants: boolean
): boolean {
  const ctx = useContext(InterruptionContext);

  const claim = ctx?.claim;
  useEffect(() => {
    if (!claim) return;
    claim(id, wants ? priority : null);
    // Release on unmount so a surface that disappears mid-claim can't wedge the
    // queue shut for everything below it.
    return () => claim(id, null);
  }, [claim, id, priority, wants]);

  if (!ctx) return wants;
  return wants && ctx.activeId === id;
}

/** Read-only view, for surfaces that need to know something else is up. */
export function useInterruptionState(): { activeId: string | null } {
  const ctx = useContext(InterruptionContext);
  return { activeId: ctx?.activeId ?? null };
}

export default InterruptionProvider;
