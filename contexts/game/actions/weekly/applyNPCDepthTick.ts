/**
 * Weekly NPC depth tick — R7 Phase 2 step 2.6-iii-A.
 *
 * Scope: the trailing block of the relationships pass, previously inline in
 * `GameActionsContext.tsx:1005-1021` (~17 lines).
 *
 * Calls `npcDepth.processWeeklyNPCDepth(relationships, weeksLived)` to
 * compute per-relationship life-event evolution (moods, opinions, goals,
 * gift preferences). The returned `relationships` array REPLACES the
 * input array in place (1:1 — preserves the legacy
 * `processedRelationships.length = 0; push(...result)` pattern via a
 * fresh array reference). The first two life-event notifications (cap of
 * 2 per week to avoid notification spam) are pushed to `ctx.notifications`.
 *
 * The try/catch wrap is PRESERVED VERBATIM from the inline code. Reason:
 * some test environments may not have the `npcDepth` module wired up, and
 * the inline code silently swallowed any module-load failure so the tick
 * could continue. Removing the swallow would be a behavior change.
 *
 * Side effects on `ctx`:
 *   - `ctx.notifications.push(...)` — up to 2 'npc-life-event' entries.
 *
 * Returns:
 *   - `relationships` — the post-tick array. Caller swaps it in. When the
 *     NPC depth call throws, returns the input array unchanged (same as
 *     the legacy catch behavior, which left `processedRelationships`
 *     unmodified).
 */

import * as npcDepth from '@/lib/social/npcDepth';
import type { GameState } from '@/contexts/game/types';
import type { WeekContext } from './weekContext';

type Relationship = NonNullable<GameState['relationships']>[number];

export interface NPCDepthTickInput {
  relationships: Relationship[];
  weeksLived: number;
}

export interface NPCDepthTickResult {
  relationships: Relationship[];
}

// SMOOTHNESS: surface at most ONE NPC "Life Update" toast, and only on
// alternating weeks. Previously up to 2 were pushed but they all shared the id
// 'npc-life-event', so the tick's dedupe-by-id silently dropped the second —
// and one still fired nearly every week. Capping to one and gating to every
// other week keeps relationship flavor without a top-of-screen toast each tick.
const MAX_NPC_NOTIFICATIONS_PER_WEEK = 1;

export function applyNPCDepthTick(input: NPCDepthTickInput, ctx: WeekContext): NPCDepthTickResult {
  try {
    const npcResult = npcDepth.processWeeklyNPCDepth(input.relationships, input.weeksLived);
    const npcToastsAllowedThisWeek = input.weeksLived % 2 === 0;
    if (npcResult.notifications.length > 0 && npcToastsAllowedThisWeek) {
      const toShow = npcResult.notifications.slice(0, MAX_NPC_NOTIFICATIONS_PER_WEEK);
      toShow.forEach((msg: string, i: number) => {
        ctx.notifications.push({
          id: `npc-life-event-${input.weeksLived}-${i}`,
          message: msg,
          title: '💬 Life Update',
        });
      });
    }
    return { relationships: npcResult.relationships };
  } catch (_e) {
    // NPC depth module may not exist in tests - preserve inline behavior.
    return { relationships: input.relationships };
  }
}
