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

  it('drops a spouse copy with no id, and takes the real marriage instead', () => {
    // The id-less copy still cannot be matched, so it is never kept. What
    // changed is what happens next: the player IS married to npc-7 in
    // `relationships`, so that record is adopted rather than leaving `family`
    // empty. Previously this returned undefined and the family page showed the
    // player as single.
    const spouse = resolveFamilySpouse({
      prevSpouse: { name: 'Ghost', type: 'spouse' } as never,
      relationships: [{ id: 'npc-7', type: 'spouse' }],
    });
    expect(spouse).toEqual({ id: 'npc-7', type: 'spouse' });
  });

  /**
   * PLAYER REPORT (BBQ, 2026-08-31): "The bugged spouse does not show up in
   * family page." The `wedding` event's "marry" choice promoted a relationship
   * to 'spouse' without mirroring `family.spouse`, and this function used to bail
   * on a missing `prevSpouse` - so the split was permanent. FamilyTab renders the
   * partner card only when `family.spouse` is absent and the spouse card only
   * when it is present, so the person appeared on neither.
   */
  describe('adopts a marriage that was never mirrored', () => {
    it('picks up a spouse present only in relationships', () => {
      expect(
        resolveFamilySpouse({ prevSpouse: undefined, relationships: [{ id: 'npc-3', type: 'spouse' }] }),
      ).toEqual({ id: 'npc-3', type: 'spouse' });
    });

    it('never invents one from a partner, a child or a friend', () => {
      expect(
        resolveFamilySpouse({
          prevSpouse: undefined,
          relationships: [
            { id: 'npc-1', type: 'partner' },
            { id: 'npc-2', type: 'child' },
            { id: 'npc-3', type: 'friend' },
          ],
        }),
      ).toBeUndefined();
    });

    it('a wedding committed this tick still wins over an older marriage', () => {
      const spouse = resolveFamilySpouse({
        prevSpouse: undefined,
        relationships: [{ id: 'npc-9', type: 'spouse' }],
        newWeddingSpouse: NEW_SPOUSE,
      });
      expect(spouse).toBe(NEW_SPOUSE);
    });
  });
});
