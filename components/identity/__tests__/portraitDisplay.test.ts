/**
 * The player's built face has to reach the screen that shows their face.
 *
 * ## The two ways this has already been broken
 *
 * First, `identity.portraitUri` was written at onboarding, persisted, migrated
 * and repaired — and read by nothing. Every screen that shows the player
 * (`IdentityCard`, `SparkApp`, `PrestigeModal`) called `getAvatarPortrait` with
 * the stock pool's `avatarId`. A player could spend real time in the face
 * creator and then look at a stock portrait for the rest of the run.
 *
 * Second, and more quietly: `IdentityCard`'s `useGameSelector` projects a
 * SUBSET of `GameState` and casts the result `as unknown as GameState`. So
 * reading `gameState.identity` typechecks perfectly and is `undefined` at
 * runtime unless `identity` is also listed in the projection. The first fix for
 * the first bug had exactly that shape and would have shipped as a no-op.
 *
 * The cast is why neither of these is a type error, which is why they are
 * tests.
 */
import * as fs from 'fs';
import * as path from 'path';

const CARD = fs.readFileSync(
  path.join(__dirname, '..', '..', 'IdentityCard.tsx'),
  'utf8',
);

describe('IdentityCard shows the face the player built', () => {
  it('lists identity in the selector projection', () => {
    // Not a style check. The selector is cast to `GameState`, so a field
    // missing here is invisible to the compiler and reads as `undefined`
    // forever — the portrait silently never appears.
    expect(CARD).toMatch(/identity:\s*s\?\.identity/);
  });

  it('prefers the built portrait over the stock pool', () => {
    // The built face must be consulted BEFORE `getAvatarPortrait`, or the stock
    // portrait wins on every character that has one — which is all of them,
    // since onboarding always assigns an `avatarId`.
    const builtAt = CARD.search(/identity\?\.portraitUri/);
    const stockAt = CARD.search(/getAvatarPortrait\(/);
    expect(builtAt).toBeGreaterThan(-1);
    expect(stockAt).toBeGreaterThan(-1);
    expect(builtAt).toBeLessThan(stockAt);
  });

  it('only trusts a data: URI', () => {
    // `portraitUri` is a snapshot of the GL canvas. Anything else in that field
    // is a corrupt or hand-edited save, and `<Image>` with a bad uri renders
    // nothing at all — a blank where the player's face should be is worse than
    // the stock portrait.
    expect(CARD).toMatch(/startsWith\('data:image'\)/);
  });
});

describe('the face creator is reachable', () => {
  const FLAGS = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'lib', 'config', 'featureFlags.ts'),
    'utf8',
  );

  it('defaults on, and is disabled by opting OUT', () => {
    // It shipped gated on `=== 'true'`, so it was off unless a developer set an
    // env var — which no player build does. The whole creator, and everything
    // behind it, was unreachable in the product.
    expect(FLAGS).toMatch(/faceCreator3D:\s*process\.env\.EXPO_PUBLIC_ENABLE_FACE_CREATOR\s*!==\s*'false'/);
  });
});
