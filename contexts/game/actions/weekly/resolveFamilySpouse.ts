/**
 * Re-derive `family.spouse` from the relationships that survived the tick.
 *
 * `family.spouse` is a DENORMALIZED copy of the spouse relationship, kept
 * because a lot of UI and progression reads it directly rather than searching
 * `relationships`. The weekly relationship-health pass can END a marriage — it
 * removes or demotes the spouse relationship — but the family block only ever
 * ADDED a spouse (on a wedding) and never dropped one. The copy therefore
 * outlived the breakup, and the player kept reading as married everywhere
 * `family.spouse` is the source of truth (2026-07-28 audit GL-5).
 *
 * Pure and exported for the same reason `advanceEventChain` is: this decision
 * used to be inline in the weekly-tick updater in the React context, where no
 * test could drive it — which is precisely the shape of code that quietly rots.
 *
 * A wedding committed THIS tick always wins: `applyScheduledWedding` runs after
 * the health pass, so its spouse is newer than anything the pass observed.
 *
 * It ADOPTS as well as drops. The function used to bail the moment `prevSpouse`
 * was absent, which made it a one-way valve: a path that promoted a relationship
 * to `type: 'spouse'` without also writing `family.spouse` produced a marriage
 * this function could never notice, no matter how many ticks ran. The `wedding`
 * event's "marry" choice was exactly that path (see the branch in
 * `GameActionsContext.resolveEvent`), and the result was a player married in
 * `relationships` and single in `family` - which renders as NEITHER card on the
 * family page, because FamilyTab shows the partner card only when `family.spouse`
 * is absent and the spouse card only when it is present.
 *
 * That branch is fixed at source, but saves written before the fix still carry the
 * split, and a save cannot be migrated out of it (there is no version bump here -
 * `family.spouse` is derived, so re-deriving it is the migration). Adopting makes
 * those saves correct on their next tick, and makes the next path that forgets to
 * mirror a bug that heals itself in a week instead of one that hides for a life.
 */
import type { GameState } from '@/contexts/game/types';

type Spouse = NonNullable<GameState['family']>['spouse'];
type Relationship = { id?: string; type?: string };

export function resolveFamilySpouse(input: {
  /** The spouse copy carried by the state at the start of the tick. */
  prevSpouse: Spouse | undefined;
  /** Relationships as they stand AFTER this tick's processing. */
  relationships: readonly Relationship[] | undefined;
  /** A spouse created by a wedding committed this tick, if any. */
  newWeddingSpouse?: Spouse | undefined;
}): Spouse | undefined {
  if (input.newWeddingSpouse) return input.newWeddingSpouse;

  const prevSpouseId = input.prevSpouse?.id;
  if (prevSpouseId) {
    const stillMarried = (input.relationships ?? []).some(
      (r) => r?.id === prevSpouseId && r?.type === 'spouse',
    );
    if (stillMarried) return input.prevSpouse;
    // The marriage ended: drop the stale copy, then fall through in case the
    // player is somehow married to someone else in `relationships`.
  }

  // Adopt an unmirrored spouse (see the header). Only a relationship the player
  // is actually married to qualifies, so this can never invent a marriage.
  const unmirrored = (input.relationships ?? []).find((r) => r?.type === 'spouse');
  return (unmirrored as Spouse | undefined) ?? undefined;
}
