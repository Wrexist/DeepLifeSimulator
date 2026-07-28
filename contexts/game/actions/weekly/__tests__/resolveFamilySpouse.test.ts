/**
 * `family.spouse` must not outlive the marriage.
 *
 * The weekly relationship-health pass can end a marriage — it removes or demotes
 * the spouse relationship — but the family block in the tick only ever ADDED a
 * spouse (on a wedding). The denormalized `family.spouse` copy therefore
 * survived the breakup, and every surface that reads it (rather than searching
 * `relationships`) kept showing the player as married. 2026-07-28 audit GL-5.
 */
import { resolveFamilySpouse } from '../resolveFamilySpouse';

const SPOUSE = { id: 'npc-7', name: 'Robin', type: 'spouse' } as never;
const NEW_SPOUSE = { id: 'npc-9', name: 'Sam', type: 'spouse' } as never;

describe('resolveFamilySpouse', () => {
  it('keeps the spouse while the spouse relationship survives the tick', () => {
    const spouse = resolveFamilySpouse({
      prevSpouse: SPOUSE,
      relationships: [{ id: 'npc-7', type: 'spouse' }, { id: 'npc-1', type: 'friend' }],
    });
    expect(spouse).toBe(SPOUSE);
  });

  it('drops the spouse when the relationship was REMOVED this tick', () => {
    const spouse = resolveFamilySpouse({
      prevSpouse: SPOUSE,
      relationships: [{ id: 'npc-1', type: 'friend' }],
    });
    expect(spouse).toBeUndefined();
  });

  it('drops the spouse when the relationship was DEMOTED out of marriage', () => {
    // The breakup path can leave the NPC in the list at a lower tier.
    const spouse = resolveFamilySpouse({
      prevSpouse: SPOUSE,
      relationships: [{ id: 'npc-7', type: 'ex' }],
    });
    expect(spouse).toBeUndefined();
  });

  it('lets a wedding committed this tick win over everything', () => {
    // applyScheduledWedding runs AFTER the health pass, so its spouse is newer
    // than anything the pass saw — including a relationships array that does not
    // list the new spouse yet.
    const spouse = resolveFamilySpouse({
      prevSpouse: undefined,
      relationships: [],
      newWeddingSpouse: NEW_SPOUSE,
    });
    expect(spouse).toBe(NEW_SPOUSE);
  });

  it('lets a same-tick remarriage replace a spouse who just left', () => {
    const spouse = resolveFamilySpouse({
      prevSpouse: SPOUSE,
      relationships: [],
      newWeddingSpouse: NEW_SPOUSE,
    });
    expect(spouse).toBe(NEW_SPOUSE);
  });

  it('stays undefined for an unmarried player', () => {
    expect(resolveFamilySpouse({ prevSpouse: undefined, relationships: [] })).toBeUndefined();
  });

  it('tolerates a missing/garbage relationships array', () => {
    expect(resolveFamilySpouse({ prevSpouse: SPOUSE, relationships: undefined })).toBeUndefined();
    expect(
      resolveFamilySpouse({ prevSpouse: SPOUSE, relationships: [null as never, undefined as never] }),
    ).toBeUndefined();
  });

  it('ignores a spouse copy with no id (cannot be matched, so cannot be kept)', () => {
    const spouse = resolveFamilySpouse({
      prevSpouse: { name: 'Ghost', type: 'spouse' } as never,
      relationships: [{ id: 'npc-7', type: 'spouse' }],
    });
    expect(spouse).toBeUndefined();
  });
});
