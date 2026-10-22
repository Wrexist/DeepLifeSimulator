/**
 * LATE-4: the family tree across consecutive heir successions.
 *
 * The node written for the ending life was keyed on `prestige.totalPrestiges`,
 * which the death -> heir path never increments. So the second succession
 * reused the first one's id: `FamilyTree.addMember` overwrote the grandparent
 * with the parent, and the parent's own child node (added by the first
 * succession) pointed at that same id as its parent - a person listed as their
 * own parent, with the founder gone. The heir's existing node is now completed
 * in place, and a minted id is unique per generation.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { continueAsChild } from '@/lib/prestige/prestigeExecution';
import { FamilyTree } from '@/lib/legacy/familyTree';

function withChild(state: GameState, id: string, name: string): GameState {
  return {
    ...state,
    weeksLived: (state.weeksLived ?? 0) + 2_000,
    family: {
      ...state.family,
      children: [
        {
          id, name, type: 'child', relationshipScore: 80,
          personality: 'curious', age: 20, datesCount: 0,
        } as never,
      ],
    },
  };
}

describe('family tree across two heir successions (LATE-4)', () => {
  it('keeps three distinct generations with correct parent links', () => {
    const founder = withChild(
      {
        ...createTestGameState(),
        weeksLived: 0,
        lifeStartWeek: 0,
        userProfile: { ...createTestGameState().userProfile, firstName: 'Ada', lastName: 'Stone', name: 'Ada Stone' },
      },
      'kid_gen2',
      'Ben Stone',
    );
    const gen2 = continueAsChild(founder, 'kid_gen2');
    const gen3 = continueAsChild(withChild(gen2, 'kid_gen3', 'Cara Stone'), 'kid_gen3');

    const tree = FamilyTree.fromJSON(gen3.familyTreeData);
    const members = Object.values(tree.members);
    expect(members).toHaveLength(3);

    const byGen = (g: number) => members.filter(m => m.generation === g);
    expect(byGen(1)).toHaveLength(1);
    expect(byGen(2)).toHaveLength(1);
    expect(byGen(3)).toHaveLength(1);

    const [ada] = byGen(1);
    const [ben] = byGen(2);
    const [cara] = byGen(3);
    expect(ada.firstName).toBe('Ada');
    expect(ben.firstName).toBe('Ben');
    expect(cara.firstName).toBe('Cara');

    // The heir's node was COMPLETED in place, not duplicated.
    expect(ben.id).toBe('kid_gen2');
    expect(ben.deathYear).toBeDefined();
    expect(ben.parents).toEqual([ada.id]);
    expect(ben.children).toContain('kid_gen3');
    expect(cara.parents).toEqual([ben.id]);
    expect(ada.children).toContain('kid_gen2');

    // Nobody is their own parent.
    for (const m of members) expect(m.parents).not.toContain(m.id);
    expect(tree.getAncestors(cara.id).map(m => m.firstName)).toEqual(['Ben', 'Ada']);
  });
});
