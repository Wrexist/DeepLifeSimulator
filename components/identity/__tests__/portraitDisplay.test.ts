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

describe('Customize.tsx keeps all three systems switchable', () => {
  const SCREEN = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'app', '(onboarding)', 'Customize.tsx'),
    'utf8',
  );

  it('still offers the starter-portrait strip', () => {
    // System 1 is the fallback for every device that cannot run GL, and the way
    // back if the 3D creator is turned off again. It must not be replaced by
    // the creator — both ship.
    // Anchored on the CALL, not the bare name. `/listStarterAvatars/` still
    // matches `listStarterAvatarsREMOVED`, so the first version of this
    // assertion passed with system 1 deleted — found by mutating it, which is
    // the only way that class of hole ever shows up.
    expect(SCREEN).toMatch(/listStarterAvatars\(/);
    expect(SCREEN).toMatch(/setAvatarId\(option\.id\)/);
  });

  it('still offers the 3D creator and the selfie route', () => {
    expect(SCREEN).toMatch(/<FaceCreatorModal\s/);
    expect(SCREEN).toMatch(/setCreatorStart\(/);
  });

  it('clears the built portrait when a starter portrait is chosen', () => {
    // THE WAY BACK. The built face wins wherever it exists, so without this a
    // player who tried the creator was stuck with the result: tapping a starter
    // portrait highlighted the new choice and changed nothing on screen.
    const tap = SCREEN.slice(
      SCREEN.indexOf('setAvatarId(option.id)'),
      SCREEN.indexOf('setAvatarId(option.id)') + 1200,
    );
    expect(tap).toMatch(/setFacePortraitUri\(undefined\)/);
  });

  it('keeps the genome when reverting, so the creator reopens on the same face', () => {
    // Only the portrait is cleared. The genome drives grooming, presence and
    // aging whether or not a face is drawn from it, and discarding it would
    // throw away work the player can still get back.
    const tap = SCREEN.slice(
      SCREEN.indexOf('setAvatarId(option.id)'),
      SCREEN.indexOf('setAvatarId(option.id)') + 1200,
    );
    expect(tap).not.toMatch(/setFaceGenome\(undefined\)/);
  });

  it('reports which system is in use from the portrait, not the genome', () => {
    // Every character has a genome, so keying the note off it said "Using your
    // custom face" to players who had never opened the creator — and kept
    // saying it after they went back.
    expect(SCREEN).toMatch(/faceCreator3D && facePortraitUri \?/);
  });
});

describe('the creator actually captures the face it renders', () => {
  const MODAL = fs.readFileSync(
    path.join(__dirname, '..', 'FaceCreatorModal.tsx'),
    'utf8',
  );
  const STUDIO = fs.readFileSync(
    path.join(__dirname, '..', 'FaceStudio.tsx'),
    'utf8',
  );

  it('snapshots the live canvas on Done', () => {
    // THE DEFECT THAT MADE EVERY OTHER TEST HERE UNREACHABLE.
    //
    // `handleDone` passed `null` unconditionally, under a comment saying the
    // studio "renders pre-rendered art rather than a live GL head". That
    // stopped being true when the preview went live and nothing updated it, so
    // the sliders worked, the head responded, and the portrait was discarded —
    // `identity.portraitUri` could never be set by the shipping path.
    expect(MODAL).toMatch(/canvasRef\.current\?\.capture\(\)/);
  });

  it('does not hardcode a null portrait', () => {
    // The specific shape of the bug: a literal null where a capture belongs.
    expect(MODAL).not.toMatch(/onDone\?\.\(null\);/);
  });

  it('passes the handle down to the studio, which owns the canvas', () => {
    expect(MODAL).toMatch(/canvasRef=\{canvasRef\}/);
    expect(STUDIO).toMatch(/ref=\{canvasRef\}/);
  });

  it('guards against a second Done tap while the first is capturing', () => {
    // Done is asynchronous now, so without this a double tap captures twice and
    // closes twice.
    expect(MODAL).toMatch(/capturingRef\.current/);
  });
});
