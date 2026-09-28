import { PORTRAITS, isPortraitId, randomPortrait } from '@/lib/avatar/portraits';
import { resolveAvatar } from '@/lib/avatar/resolve';
import { avatarFromSeed } from '@/lib/avatar/random';
import { encodeAvatar } from '@/lib/avatar/encode';
import { repairGameState } from '@/utils/saveValidation';
import { runMigrations } from '@/utils/saveMigrations';
import { createTestGameState } from '../helpers/createTestGameState';

describe('curated portrait compatibility', () => {
  test.each(PORTRAITS)('$id survives save repair without replacing the inherited custom face', ({ id }) => {
    const state = createTestGameState();
    const config = avatarFromSeed('existing player', 'female');
    state.userProfile = { ...state.userProfile, avatarId: id, avatar: encodeAvatar(config), sex: 'female' };
    const loaded = runMigrations(JSON.parse(JSON.stringify(state))).state;
    repairGameState(loaded);
    expect(loaded.userProfile?.avatarId).toBe(id);
    expect(resolveAvatar(loaded.userProfile)).toEqual(config);
  });
  it('never recognizes a legacy pick or a corrupt id as a new portrait', () => {
    for (const value of ['m1', 'f3', 'portrait-v1:unknown', undefined, null, 1]) expect(isPortraitId(value)).toBe(false);
  });
  it('randomize always chooses a different valid portrait, even with bad entropy', () => {
    for (const previous of PORTRAITS) for (const roll of [0, 0.3, 0.999, 1, -1, NaN]) {
      const next = randomPortrait(previous.id, roll);
      expect(isPortraitId(next)).toBe(true);
      expect(next).not.toBe(previous.id);
    }
  });
});
