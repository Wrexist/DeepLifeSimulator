/**
 * updateMyProfile → scorePlayerProfile.
 *
 * The Spark profile editor (SparkProfileEditModal) wires bio + interests into
 * updateMyProfile; the profile-strength meter reads scorePlayerProfile. This
 * pins that filling in a bio and interests actually raises the score.
 */
import { updateMyProfile } from '@/contexts/game/actions/SparkActions';
import { scorePlayerProfile } from '@/lib/dating/sparkLogic';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function harness(initial: GameState) {
  let current = initial;
  const setGameState = (u: any) => { current = typeof u === 'function' ? u(current) : u; };
  return { setGameState, getState: () => current };
}

function freshState(): GameState {
  const s = createTestGameState({ weeksLived: 1 });
  if (s.sparkApp) s.sparkApp = JSON.parse(JSON.stringify(s.sparkApp));
  s.stats = { ...s.stats };
  return s;
}

describe('updateMyProfile raises the profile score', () => {
  it('a bio + interests increase scorePlayerProfile', () => {
    const { setGameState, getState } = harness(freshState());
    const before = scorePlayerProfile(getState());

    updateMyProfile(setGameState, {
      bio: 'Adventurer, coffee snob, and part-time chef looking for a partner in crime.',
      interests: ['Travel', 'Coffee', 'Cooking', 'Hiking', 'Music'],
    });

    const after = scorePlayerProfile(getState());
    expect(after).toBeGreaterThan(before);
    expect(getState().sparkApp!.profile.interests).toEqual(['Travel', 'Coffee', 'Cooking', 'Hiking', 'Music']);
  });

  it('each added dimension contributes (interests alone raise the score)', () => {
    const { setGameState, getState } = harness(freshState());
    const before = scorePlayerProfile(getState());
    updateMyProfile(setGameState, { interests: ['Art', 'Music', 'Fitness'] });
    expect(scorePlayerProfile(getState())).toBeGreaterThan(before);
  });
});
