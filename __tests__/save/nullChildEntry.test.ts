/**
 * A null hole in family.children must not make a life unloadable or unsaveable.
 *
 * validateRelationshipState read `child.id` bare, and both hydrateLoadedState
 * (load) and saveGame call it, so `family.children = [null]` threw
 * "Cannot read properties of null" on load and on every save, and nothing
 * repaired it. 2026-10-21 audit SAVE-11.
 */
import { hydrateLoadedState } from '@/utils/hydrateLoadedState';
import { repairGameState } from '@/utils/saveValidation';
import { validateRelationshipState } from '@/utils/relationshipValidation';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function stateWithHoles(): GameState {
  const base = createTestGameState();
  const child = {
    id: 'kid-1',
    name: 'Kid',
    type: 'child' as const,
    relationshipScore: 70,
    personality: 'kind',
    gender: 'female' as const,
    age: 4,
  };
  const s = createTestGameState({
    relationships: [...(base.relationships ?? []), child] as GameState['relationships'],
  });
  // The hole is the point of the test, so it is written through `unknown`.
  (s.family as unknown as { children: unknown[] }).children = [null, child, undefined];
  return s;
}

describe('null entries in family.children', () => {
  it('validateRelationshipState skips the hole instead of throwing', () => {
    expect(() => validateRelationshipState(stateWithHoles())).not.toThrow();
  });

  it('repairGameState drops the holes and reports the repair', () => {
    const s = stateWithHoles();
    const result = repairGameState(s);
    expect(result.repaired).toBe(true);
    expect(s.family.children.map((c) => c.id)).toEqual(['kid-1']);
  });

  it('hydrateLoadedState loads the life with its real child intact', () => {
    const parsed = JSON.parse(JSON.stringify(stateWithHoles()));
    const { state } = hydrateLoadedState(parsed, { source: 'test:null-child' });
    expect(state.family.children.map((c) => c.id)).toEqual(['kid-1']);
  });
});
