/**
 * ONB-7: "Bisexual" used to behave exactly like "Straight" - the builder
 * writes one concrete seekingGender and the deck filtered on it alone.
 */
import { sparkDeckGenderFilter } from '@/lib/dating/sparkLogic';
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

function profileFor(sexuality: 'straight' | 'gay' | 'bi') {
  const template = createTestGameState();
  const state = buildNewGameState({
    initialGameState: template,
    stateVersion: template.version ?? 1,
    firstName: 'A',
    lastName: 'B',
    sex: 'male',
    sexuality,
    scenario: { id: 'food_courier', start: { age: 20, cash: 500 } },
    selectedPerks: [],
    permanentPerks: [],
    selectedMindset: null,
  });
  return state.userProfile;
}

describe('sparkDeckGenderFilter', () => {
  it('shows everyone to a bisexual player', () => {
    expect(sparkDeckGenderFilter(profileFor('bi'))).toBeNull();
  });

  it('still narrows for straight and gay players', () => {
    expect(sparkDeckGenderFilter(profileFor('straight'))).toBe('female');
    expect(sparkDeckGenderFilter(profileFor('gay'))).toBe('male');
  });

  it('never empties the deck for a profile with no preference', () => {
    expect(sparkDeckGenderFilter(undefined)).toBeNull();
    expect(sparkDeckGenderFilter({})).toBeNull();
  });
});
