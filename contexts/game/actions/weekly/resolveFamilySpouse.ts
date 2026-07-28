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
  if (!prevSpouseId) return undefined;

  const stillMarried = (input.relationships ?? []).some(
    (r) => r?.id === prevSpouseId && r?.type === 'spouse',
  );
  return stillMarried ? input.prevSpouse : undefined;
}
