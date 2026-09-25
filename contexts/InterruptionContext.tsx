/**
 * InterruptionContext - one queue for everything that interrupts the player.
 *
 * ## The problem this replaces
 *
 * Before this existed there were FOUR independent popup priority chains that
 * could not see each other:
 *
 *   - `app/(tabs)/_layout.tsx`  - life moment, event inbox (and, before it was
 *     retired, the weekly result sheet)
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
 * ## The budget (UI overhaul phase 1)
 *
 * Ordering alone was not enough: the queue serialized the pile-up, but one
 * "Next Week" press could still present up to eight surfaces IN A ROW - the
 * player dismissed popup after popup to get back to the button they pressed.
 * So the queue now also carries a per-game-week budget: at most
 * `MAX_INTERRUPTIONS_PER_WEEK` budgeted grants per `weeksLived` value.
 * A claim past the budget is not lost - its `wants` flag is game state, so it
 * simply keeps claiming and presents on a later week. Player-initiated
 * surfaces (the event inbox, opened from its pill) declare
 * `countsTowardBudget: false` and are never deferred - refusing an explicit
 * tap is worse than any pile-up.
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
  useRef,
  useState,
  ReactNode,
} from 'react';
import { GameStoreContext } from '@/contexts/game/useGameSelector';

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
  // 40 was WEEK_RESULT, retired with the blocking WeeklyResultSheet -
  // LastWeekRecap on Home is the non-blocking week summary now.
  /** Optional offers. Must never cover a dialog that requires an answer. */
  PROMO: 20,
  AD_ORB: 10,
} as const;

export type InterruptionPriority =
  (typeof INTERRUPTION_PRIORITY)[keyof typeof INTERRUPTION_PRIORITY];

/**
 * How many budgeted surfaces may be GRANTED per game week. Two, because a tick
 * legitimately carries one piece of content (a life moment) plus one reward
 * beat - anything past that is the pile-up the tester called "too complex".
 */
export const MAX_INTERRUPTIONS_PER_WEEK = 2;

/**
 * The gap between one surface giving up the slot and the next one receiving it.
 *
 * Every surface here that holds the slot is (or opens) an RN Modal, and each is
 * MOUNTED only while it holds the slot. So a handoff - welcome back closes, the
 * daily reward it was queued in front of takes over - used to unmount one
 * PRESENTED Modal and present the next in back-to-back commits, while iOS was
 * still animating the first one away. iOS refuses or strands a presentation
 * started during another's dismissal, and the stranded case is a transparent
 * full-screen layer that swallows every touch: Home visible, nothing
 * responding. That is the "Home tab got frozen/stuck" report, on the most
 * ordinary session there is - the first launch of a new day. `AlertHost`
 * documents the same mechanism for the Revival Pack report.
 *
 * Long enough for a native dismissal to finish (UIKit's is ~0.3s), short
 * enough that the next surface still reads as "next".
 */
export const HANDOFF_SETTLE_MS = 450;

interface ClaimRecord {
  priority: number;
  countsTowardBudget: boolean;
  /**
   * Whether a higher-priority claim may take the slot from this surface while
   * it still wants it. False for anything that presents a Modal: pulling the
   * slot from a presented Modal unmounts it under the player's thumb, and
   * whatever outranked it then presents during that dismissal (see
   * `HANDOFF_SETTLE_MS`). A higher claim simply waits until this one closes.
   */
  preemptible: boolean;
}

interface InterruptionContextValue {
  /** Register or clear this surface's claim. */
  claim: (
    id: string,
    priority: number | null,
    countsTowardBudget?: boolean,
    preemptible?: boolean
  ) => void;
  /** The id currently holding the slot, or null when nothing wants to show. */
  activeId: string | null;
}

const InterruptionContext = createContext<InterruptionContextValue | undefined>(
  undefined
);

export function InterruptionProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Record<string, ClaimRecord>>({});
  /** Budgeted grants made in the current game week. */
  const [usedThisWeek, setUsedThisWeek] = useState(0);
  /** The current grant holder - read by the winner memo so an in-flight grant
   *  is never evicted by its own budget increment. */
  const activeRef = useRef<string | null>(null);
  /** The surface currently granted the slot (trails the winner on handoff). */
  const [granted, setGranted] = useState<string | null>(null);
  /** When the slot was last given up - the start of the handoff gap. Starts at
   *  0 so the very first grant of a session is immediate. */
  const lastReleaseAtRef = useRef(0);

  const claim = useCallback(
    (
      id: string,
      priority: number | null,
      countsTowardBudget: boolean = true,
      preemptible: boolean = false
    ) => {
      setClaims((prev) => {
        if (priority === null) {
          if (!(id in prev)) return prev; // no-op keeps the identity stable
          const next = { ...prev };
          delete next[id];
          return next;
        }
        const existing = prev[id];
        if (
          existing &&
          existing.priority === priority &&
          existing.countsTowardBudget === countsTowardBudget &&
          existing.preemptible === preemptible
        ) {
          return prev;
        }
        return { ...prev, [id]: { priority, countsTowardBudget, preemptible } };
      });
    },
    []
  );

  // Reset the budget whenever the game week advances. The provider sits inside
  // GameProvider, but tests and isolated harnesses may mount it bare - so the
  // store is read optionally, and without one the budget simply never resets
  // (each such harness exercises a single moment anyway).
  const store = useContext(GameStoreContext);
  useEffect(() => {
    if (!store) return undefined;
    let lastWeek: number | undefined;
    try {
      lastWeek = store.getSnapshot()?.weeksLived;
    } catch {
      lastWeek = undefined;
    }
    return store.subscribe(() => {
      let w: number | undefined;
      try {
        w = store.getSnapshot()?.weeksLived;
      } catch {
        return;
      }
      if (w !== undefined && w !== lastWeek) {
        lastWeek = w;
        setUsedThisWeek(0);
      }
    });
  }, [store]);

  // Who SHOULD hold the slot right now, before the handoff gap below.
  const winner = useMemo(() => {
    // A non-preemptible holder that still wants the slot keeps it, whatever
    // has arrived above it since. See `ClaimRecord.preemptible`.
    if (granted && claims[granted] && !claims[granted].preemptible) return granted;

    let winner: string | null = null;
    let best = -Infinity;
    // Sort the ids so equal priorities resolve the same way every render
    // rather than following object insertion order.
    for (const id of Object.keys(claims).sort()) {
      const c = claims[id];
      // A budgeted claim is eligible while the week's budget lasts - or while
      // it already holds the slot (a grant must never be revoked by the
      // increment it caused).
      const eligible =
        !c.countsTowardBudget ||
        usedThisWeek < MAX_INTERRUPTIONS_PER_WEEK ||
        id === granted;
      if (!eligible) continue;
      if (c.priority > best) {
        best = c.priority;
        winner = id;
      }
    }
    return winner;
  }, [claims, usedThisWeek, granted]);

  // The actual grant, which trails `winner` by one settle gap on every handoff.
  // A slot that CHANGES hands always passes through null first, so the outgoing
  // surface unmounts in one commit and the incoming one presents at least
  // HANDOFF_SETTLE_MS later - never in the next commit.
  useEffect(() => {
    if (winner === granted) return undefined;
    if (granted !== null) {
      lastReleaseAtRef.current = Date.now();
      setGranted(null);
      return undefined;
    }
    const wait = HANDOFF_SETTLE_MS - (Date.now() - lastReleaseAtRef.current);
    if (wait <= 0) {
      setGranted(winner);
      return undefined;
    }
    const timer = setTimeout(() => setGranted(winner), wait);
    return () => clearTimeout(timer);
  }, [winner, granted]);

  const activeId = granted;

  // Account a grant: each transition to a NEW budgeted holder spends one unit.
  useEffect(() => {
    const prev = activeRef.current;
    activeRef.current = activeId;
    if (activeId && activeId !== prev && claims[activeId]?.countsTowardBudget) {
      setUsedThisWeek((u) => u + 1);
    }
  }, [activeId, claims]);

  const value = useMemo(() => ({ claim, activeId }), [claim, activeId]);

  return (
    <InterruptionContext.Provider value={value}>
      {children}
    </InterruptionContext.Provider>
  );
}

export interface InterruptionSlotOptions {
  /**
   * Whether a grant to this surface spends the week's interruption budget.
   * Defaults to true. Pass false ONLY for surfaces the player explicitly
   * asked to open (e.g. tapping the event-inbox pill) - deferring those
   * refuses a direct tap.
   */
  countsTowardBudget?: boolean;
  /**
   * Whether a higher-priority surface may take the slot while this one still
   * wants it. Defaults to false, which is right for anything that presents a
   * Modal. Pass true only for a surface that is safe to yank mid-display (the
   * ad orb's floating pill, which is not a Modal).
   */
  preemptible?: boolean;
}

/**
 * Claim the interruption slot at `priority` while `wants` is true.
 *
 * Returns true only when this surface both wants to show AND currently outranks
 * every other claimant AND is within the week's interruption budget. Safe to
 * call outside the provider (returns `wants` unchanged) so a surface rendered
 * in isolation - a test, a screenshot harness - behaves exactly as it did
 * before the queue existed.
 */
export function useInterruptionSlot(
  id: string,
  priority: number,
  wants: boolean,
  options?: InterruptionSlotOptions
): boolean {
  const ctx = useContext(InterruptionContext);
  const countsTowardBudget = options?.countsTowardBudget !== false;
  const preemptible = options?.preemptible === true;

  const claim = ctx?.claim;
  useEffect(() => {
    if (!claim) return;
    claim(id, wants ? priority : null, countsTowardBudget, preemptible);
    // Release on unmount so a surface that disappears mid-claim can't wedge the
    // queue shut for everything below it.
    return () => claim(id, null);
  }, [claim, id, priority, wants, countsTowardBudget, preemptible]);

  if (!ctx) return wants;
  return wants && ctx.activeId === id;
}

/** Read-only view, for surfaces that need to know something else is up. */
export function useInterruptionState(): { activeId: string | null } {
  const ctx = useContext(InterruptionContext);
  return { activeId: ctx?.activeId ?? null };
}

export default InterruptionProvider;
