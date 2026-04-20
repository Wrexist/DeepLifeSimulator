import { createRelation, applyRelationAction, processWeeklyRelations } from '@/lib/social/relations';

describe('social relations', () => {
  test('applyRelationAction increases affection and returns happiness', () => {
    const relation = createRelation('Alice', 'friend');
    const result = applyRelationAction(relation, 'chat', 1);
    expect(result.relation.affection).toBeGreaterThan(relation.affection);
    expect(result.relation.reliability).toBeGreaterThan(relation.reliability);
    expect(result.happiness).toBeGreaterThan(0);
    expect(result.relation.history).toHaveLength(1);
  });

  test('processWeeklyRelations applies drift when no interaction', () => {
    const relation = createRelation('Bob', 'friend');
    // Simulate an interaction in week 1
    const interacted = applyRelationAction(relation, 'chat', 1).relation;
    const result = processWeeklyRelations([interacted], 3); // two weeks later
    expect(result.relations[0].affection).toBeLessThan(interacted.affection);
    expect(result.happiness).toBeLessThanOrEqual(0);
    expect(result.events.length).toBeGreaterThan(0);
  });
});
