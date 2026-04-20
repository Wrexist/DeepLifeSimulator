import {
  resolveRandomSex,
  computeSeekingGender,
  mapScenarioItemIds,
  computeWeeksLived,
  buildChildForSingleParent,
  buildNewGameState,
  type BuildGameStateParams,
} from '@/src/features/onboarding/gameStateBuilder';

// ---------------------------------------------------------------------------
// Mock initialGameState template for tests
// ---------------------------------------------------------------------------

const mockInitialGameState = {
  stats: { money: 0, reputation: 0, energy: 50, health: 100, happiness: 50, fitness: 30 },
  weeksLived: 0,
  week: 1,
  date: { age: 18, week: 1, month: 'Jan', year: 2025 },
  educations: [
    { id: 'business_degree', completed: false, weeksRemaining: 12 },
    { id: 'law_degree', completed: false, weeksRemaining: 16 },
  ],
  userProfile: { firstName: '', lastName: '', sex: 'male', sexuality: 'straight', gender: 'male', seekingGender: 'female' },
  items: [
    { id: 'smartphone', owned: false },
    { id: 'suit', owned: false },
    { id: 'computer', owned: false },
    { id: 'bike', owned: false },
  ],
  relationships: [],
  family: { children: [] },
  achievements: [],
  perks: {},
};

function baseParams(overrides: Partial<BuildGameStateParams> = {}): BuildGameStateParams {
  return {
    initialGameState: mockInitialGameState,
    stateVersion: 12,
    firstName: 'John',
    lastName: 'Doe',
    sex: 'male',
    sexuality: 'straight',
    scenario: { id: 'dropout', start: { age: 18, cash: 500 } },
    challengeScenarioId: undefined,
    selectedPerks: [],
    permanentPerks: [],
    selectedMindset: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveRandomSex
// ---------------------------------------------------------------------------

describe('resolveRandomSex', () => {
  it('returns male when male', () => {
    expect(resolveRandomSex('male')).toBe('male');
  });

  it('returns female when female', () => {
    expect(resolveRandomSex('female')).toBe('female');
  });

  it('returns male or female when random', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) results.add(resolveRandomSex('random'));
    expect(results.has('male')).toBe(true);
    expect(results.has('female')).toBe(true);
    expect(results.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeSeekingGender
// ---------------------------------------------------------------------------

describe('computeSeekingGender', () => {
  it('straight male seeks female', () => {
    expect(computeSeekingGender('male', 'straight')).toBe('female');
  });

  it('straight female seeks male', () => {
    expect(computeSeekingGender('female', 'straight')).toBe('male');
  });

  it('gay male seeks male', () => {
    expect(computeSeekingGender('male', 'gay')).toBe('male');
  });

  it('gay female seeks female', () => {
    expect(computeSeekingGender('female', 'gay')).toBe('female');
  });

  it('bi male defaults to seeking female', () => {
    expect(computeSeekingGender('male', 'bi')).toBe('female');
  });

  it('bi female defaults to seeking male', () => {
    expect(computeSeekingGender('female', 'bi')).toBe('male');
  });
});

// ---------------------------------------------------------------------------
// mapScenarioItemIds
// ---------------------------------------------------------------------------

describe('mapScenarioItemIds', () => {
  it('maps known aliases to game IDs', () => {
    expect(mapScenarioItemIds(['business_suit', 'basic_camera'])).toEqual(['suit', 'camera']);
  });

  it('passes through unknown IDs unchanged', () => {
    expect(mapScenarioItemIds(['unknown_item'])).toEqual(['unknown_item']);
  });

  it('returns empty for empty input', () => {
    expect(mapScenarioItemIds([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeWeeksLived
// ---------------------------------------------------------------------------

describe('computeWeeksLived', () => {
  it('returns 0 for ADULTHOOD_AGE', () => {
    expect(computeWeeksLived(18)).toBe(0);
  });

  it('returns positive weeks for ages above adulthood', () => {
    const weeks = computeWeeksLived(20);
    expect(weeks).toBeGreaterThan(0);
  });

  it('never returns negative', () => {
    expect(computeWeeksLived(10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildChildForSingleParent
// ---------------------------------------------------------------------------

describe('buildChildForSingleParent', () => {
  it('creates a child with correct age', () => {
    const child = buildChildForSingleParent(5);
    expect(child.age).toBe(5);
    expect(child.type).toBe('child');
    expect(child.relationshipScore).toBe(100);
  });

  it('generates a unique ID', () => {
    const a = buildChildForSingleParent(3);
    const b = buildChildForSingleParent(3);
    expect(a.id).not.toBe(b.id);
  });

  it('has expected shape', () => {
    const child = buildChildForSingleParent(4);
    expect(child).toHaveProperty('name');
    expect(child).toHaveProperty('gender');
    expect(child).toHaveProperty('personality');
    expect(child).toHaveProperty('educationLevel', 'none');
    expect(child).toHaveProperty('datesCount', 0);
    expect(child).toHaveProperty('savings', 0);
  });
});

// ---------------------------------------------------------------------------
// buildNewGameState
// ---------------------------------------------------------------------------

describe('buildNewGameState', () => {
  it('sets identity fields correctly', () => {
    const state = buildNewGameState(baseParams());
    expect(state.userProfile.firstName).toBe('John');
    expect(state.userProfile.lastName).toBe('Doe');
    expect(state.userProfile.sex).toBe('male');
    expect(state.userProfile.sexuality).toBe('straight');
    expect(state.userProfile.seekingGender).toBe('female');
  });

  it('sets money from scenario cash', () => {
    const state = buildNewGameState(baseParams({ scenario: { id: 'test', start: { age: 20, cash: 3000 } } }));
    expect(state.stats.money).toBe(3000);
  });

  it('adds legacy_builder bonus when selected', () => {
    const state = buildNewGameState(baseParams({ selectedPerks: ['legacy_builder'] }));
    expect(state.stats.money).toBe(500 + 5000);
    expect(state.stats.reputation).toBe(0 + 5);
  });

  it('adds astute_planner energy bonus when selected', () => {
    const state = buildNewGameState(baseParams({ selectedPerks: ['astute_planner'] }));
    expect(state.stats.energy).toBe(50 + 10);
  });

  it('merges permanent and selected perks', () => {
    const state = buildNewGameState(baseParams({ selectedPerks: ['iron_will'], permanentPerks: ['lucky_charm'] }));
    expect(state.perks.iron_will).toBe(true);
    expect(state.perks.lucky_charm).toBe(true);
  });

  it('sets mindset when provided', () => {
    const state = buildNewGameState(baseParams({ selectedMindset: 'optimistic' as any }));
    expect(state.mindset).toEqual({ activeTraitId: 'optimistic', traits: ['optimistic'] });
  });

  it('leaves mindset undefined when null', () => {
    const state = buildNewGameState(baseParams({ selectedMindset: null }));
    expect(state.mindset).toBeUndefined();
  });

  it('maps scenario items to owned game items', () => {
    const state = buildNewGameState(
      baseParams({ scenario: { id: 'tech', start: { age: 22, cash: 1000, items: ['smartphone', 'computer'] } } })
    );
    const phone = state.items.find((i: any) => i.id === 'smartphone');
    const pc = state.items.find((i: any) => i.id === 'computer');
    expect(phone.owned).toBe(true);
    expect(pc.owned).toBe(true);
  });

  it('sets hasPhone when smartphone in items', () => {
    const state = buildNewGameState(
      baseParams({ scenario: { id: 'x', start: { age: 18, cash: 0, items: ['smartphone'] } } })
    );
    expect(state.hasPhone).toBe(true);
  });

  it('marks education complete for College scenario', () => {
    const state = buildNewGameState(
      baseParams({ scenario: { id: 'intern', start: { age: 22, cash: 500, education: 'College' } } })
    );
    const biz = state.educations.find((e: any) => e.id === 'business_degree');
    expect(biz.completed).toBe(true);
  });

  it('sets version from stateVersion param', () => {
    const state = buildNewGameState(baseParams({ stateVersion: 14 }));
    expect(state.version).toBe(14);
  });

  it('stores challengeScenarioId when provided', () => {
    const state = buildNewGameState(baseParams({ challengeScenarioId: 'challenge_1' }));
    expect(state.challengeScenarioId).toBe('challenge_1');
  });

  it('creates child for single parent scenario', () => {
    const state = buildNewGameState(
      baseParams({ scenario: { id: 'single_parent', start: { age: 28, cash: 1200, hasChild: true, childAge: 5 } } })
    );
    expect(state.family.children).toHaveLength(1);
    expect(state.family.children[0].age).toBe(5);
    expect(state.relationships).toContainEqual(expect.objectContaining({ type: 'child' }));
  });

  it('handles noChildren scenario', () => {
    const state = buildNewGameState(
      baseParams({ scenario: { id: 'test', start: { age: 18, cash: 0, noChildren: true } } })
    );
    expect(state.family.children).toEqual([]);
  });
});
