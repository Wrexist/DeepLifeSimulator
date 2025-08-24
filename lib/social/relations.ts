export type RelationType = 'friend' | 'romance' | 'spouse' | 'child';
export type RelationAction = 'chat' | 'coffee' | 'date';

export interface RelationEvent {
  week: number;
  action: RelationAction | 'drift';
  affectionChange: number;
  reliabilityChange: number;
}

export interface Relation {
  id: string;
  name: string;
  type: RelationType;
  affection: number; // 0-100
  reliability: number; // 0-100
  history: RelationEvent[];
  familyHappiness?: number; // additional happiness provided weekly
  expenses?: number; // weekly financial cost
  age?: number; // for child aging
}

export interface SocialState {
  relations: Relation[];
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function createRelation(name: string, type: RelationType): Relation {
  return {
    id: `rel_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name,
    type,
    affection: 50,
    reliability: 50,
    history: [],
    ...(type === 'spouse'
      ? { familyHappiness: 5, expenses: 100 }
      : {}),
    ...(type === 'child'
      ? { familyHappiness: 3, expenses: 50, age: 0 }
      : {}),
  };
}

export function applyRelationAction(
  relation: Relation,
  action: RelationAction,
  week: number
): { relation: Relation; happiness: number } {
  let affectionChange = 0;
  let reliabilityChange = 0;
  let happiness = 0;

  switch (action) {
    case 'chat':
      affectionChange = 5;
      reliabilityChange = 2;
      happiness = 1;
      break;
    case 'coffee':
      affectionChange = 10;
      reliabilityChange = 5;
      happiness = 2;
      break;
    case 'date':
      affectionChange = 15;
      reliabilityChange = 10;
      happiness = 3;
      break;
  }

  const updated: Relation = {
    ...relation,
    type: action === 'date' ? 'romance' : relation.type,
    affection: clamp(relation.affection + affectionChange),
    reliability: clamp(relation.reliability + reliabilityChange),
    history: [
      ...relation.history,
      { week, action, affectionChange, reliabilityChange },
    ],
  };

  return { relation: updated, happiness };
}

export function processWeeklyRelations(
  relations: Relation[],
  currentWeek: number
): { relations: Relation[]; happiness: number; events: string[] } {
  let happiness = 0;
  const events: string[] = [];

  const updated = relations.map(relation => {
    const lastEvent = relation.history[relation.history.length - 1];
    const lastWeek = lastEvent ? lastEvent.week : 0;
    const weeksSince = currentWeek - lastWeek;

    let affectionChange = 0;
    if (weeksSince > 1) {
      affectionChange = -Math.min(5, weeksSince - 1);
      happiness -= 1;
      events.push(`${relation.name} feels distant`);
    }

    const newAffection = clamp(relation.affection + affectionChange);
    const newRelation: Relation = {
      ...relation,
      affection: newAffection,
      history:
        affectionChange !== 0
          ? [
              ...relation.history,
              { week: currentWeek, action: 'drift', affectionChange, reliabilityChange: 0 },
            ]
          : relation.history,
    };

    if (newAffection > 70) happiness += 1;
    return newRelation;
  });

  return { relations: updated, happiness, events };
}
