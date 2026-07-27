/**
 * All THREE character-customization systems, together, and the switch between
 * them.
 *
 * The game offers three ways to get a face, and they are not alternatives that
 * replaced each other — all three ship, and a player moves between them:
 *
 *   1. STARTER PORTRAIT  — pick from a pool of 2D portraits. The original
 *                          system, free, no GL, works on every device.
 *   2. 3D STUDIO         — build a head on sliders, snapshot it to a portrait.
 *   3. SELFIE            — DeepLife+; a photo fits the genome, then drops the
 *                          player into the SAME studio with the sliders set.
 *
 * ## Why this file exists
 *
 * Because each was only ever tested alone, and the interesting failures are all
 * at the boundaries:
 *
 *   - The built portrait wins wherever it exists, so nothing cleared it when a
 *     player went back to a starter portrait. Tapping one highlighted the new
 *     choice and changed nothing they would ever see. There was no way back
 *     from system 2 or 3 to system 1 — the reason to keep all three is that a
 *     player can change their mind, and they could not.
 *   - Systems 2 and 3 exit through the same door, so a test of one is not a
 *     test of the other unless the door is asserted.
 *   - Every character carries a genome whether or not they used a creator, so
 *     "has a genome" cannot be the signal for which system is in use. The
 *     PORTRAIT is the signal.
 *
 * These run against `buildNewGameState`, which is where all three converge.
 */
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import { randomizeFace } from '@/lib/identity';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

// Same shape `__tests__/onboarding/gameStateBuilder.test.ts` uses: the builder
// takes its template as a PARAMETER rather than importing it, so a test
// supplies one instead of reaching into the real initial state.
const mockInitialGameState = {
  stats: { money: 0, reputation: 0, energy: 50, health: 100, happiness: 50, fitness: 30 },
  weeksLived: 0,
  week: 1,
  date: { age: 18, week: 1, month: 'Jan', year: 2025 },
  educations: [],
  userProfile: {
    firstName: '', lastName: '', sex: 'male', sexuality: 'straight',
    gender: 'male', seekingGender: 'female',
  },
  items: [],
  relationships: [],
  family: { children: [] },
  achievements: [],
  perks: {},
};

const base = {
  initialGameState: mockInitialGameState,
  stateVersion: 26,
  firstName: 'Ada',
  lastName: 'Lovelace',
  sex: 'female' as const,
  sexuality: 'straight',
  scenario: { id: 'dropout', start: { age: 18, cash: 500 } },
  challengeScenarioId: undefined,
  selectedPerks: [],
  permanentPerks: [],
  selectedMindset: null,
  ambitionId: undefined,
};

/** System 1: a starter portrait and nothing else. */
const starter = () => buildNewGameState({ ...base, avatarId: 'f2' } as never);

/** System 2: a face built on the sliders. */
const studio = () => buildNewGameState({
  ...base,
  avatarId: 'f2',
  faceGenome: randomizeFace('studio-seed', { sex: 'female' }),
  facePortraitUri: PNG,
} as never);

/** System 3: a selfie-fitted genome, which exits through the studio's door. */
const selfie = () => buildNewGameState({
  ...base,
  avatarId: 'f2',
  faceGenome: randomizeFace('selfie-seed', { sex: 'female' }),
  facePortraitUri: PNG,
} as never);

describe('all three systems produce a playable character', () => {
  it.each([
    ['starter portrait', starter],
    ['3D studio', studio],
    ['selfie', selfie],
  ])('%s builds a state with a full identity', (_name, build) => {
    const state = build();
    expect(state).toBeTruthy();
    // The genome is NOT conditional on the creator. Grooming, presence and
    // aging read it every week, so a starter-portrait character needs one too
    // — this is the invariant that lets all three coexist.
    expect(state.identity).toBeTruthy();
    expect(state.identity.face).toBeTruthy();
    expect(state.userProfile.avatarId).toBe('f2');
  });
});

describe('which system is on screen', () => {
  it('system 1 stores no portrait, so the starter pool is drawn', () => {
    expect(starter().identity.portraitUri).toBeUndefined();
  });

  it('systems 2 and 3 store a portrait, so the built face is drawn', () => {
    expect(studio().identity.portraitUri).toBe(PNG);
    expect(selfie().identity.portraitUri).toBe(PNG);
  });

  it('keeps the starter portrait alongside a built face', () => {
    // Both are retained on purpose: clearing the portrait must reveal the
    // player's own starter choice, not a default. If `avatarId` were dropped
    // when a face was built, going back would land on someone else's face.
    const state = studio();
    expect(state.userProfile.avatarId).toBe('f2');
    expect(state.identity.portraitUri).toBe(PNG);
  });
});

describe('switching back from a built face to a starter portrait', () => {
  it('reverts when the portrait is cleared, keeping the genome', () => {
    // What `Customize.tsx` does when a starter portrait is tapped: clear the
    // portrait, keep the genome. The genome is kept so "Edit your 3D face"
    // returns to the player's work rather than a fresh random head.
    const genome = randomizeFace('keep-me', { sex: 'female' });
    const built = buildNewGameState({
      ...base, avatarId: 'f2', faceGenome: genome, facePortraitUri: PNG,
    } as never);
    const reverted = buildNewGameState({
      ...base, avatarId: 'f2', faceGenome: genome, facePortraitUri: undefined,
    } as never);

    expect(built.identity.portraitUri).toBe(PNG);
    expect(reverted.identity.portraitUri).toBeUndefined();
    // The work survives the round trip.
    expect(reverted.identity.face).toEqual(built.identity.face);
  });

  it('ignores a portrait that is not an image, rather than drawing a blank', () => {
    // A corrupt or hand-edited save. `<Image>` with a bad uri renders nothing,
    // and a blank where a face should be is worse than the starter portrait —
    // so anything that is not a data image falls through to system 1.
    for (const bad of ['', 'https://example.com/a.png', 'file:///tmp/a.png', 'null']) {
      const state = buildNewGameState({
        ...base, avatarId: 'f2', faceGenome: randomizeFace('x'), facePortraitUri: bad,
      } as never);
      expect(state.identity.portraitUri).toBeUndefined();
    }
  });
});

describe('the starter system stands alone', () => {
  it('works with no genome supplied at all', () => {
    // System 1 must not depend on anything the other two introduced: it is the
    // fallback for every device that cannot run GL, and the way back if the 3D
    // creator is turned off again.
    const state = buildNewGameState({ ...base, avatarId: 'f2' } as never);
    expect(state.identity).toBeTruthy();
    expect(state.identity.face).toBeTruthy();
    expect(state.identity.portraitUri).toBeUndefined();
  });
});
