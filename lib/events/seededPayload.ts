/**
 * Week-seeded payload rolls for weekly-event templates.
 *
 * DETERMINISM FIX (2026-08-16 audit H7b). `EventTemplate.generate()` bodies
 * decided money signs, fine amounts, percentages, whether the player was FIRED
 * or caught a DISEASE, and which friend / pet / child / vehicle the event was
 * about with raw `Math.random()`. `generate()` runs inside the weekly tick, i.e.
 * inside a `setGameState` updater, so those draws had the same two defects
 * `pulseTick` and the notification ids were already fixed for:
 *   1. React 19 double-invokes the updater in StrictMode and may run it
 *      speculatively — each invocation drew different numbers, so the outcome
 *      the player got was whichever render React happened to commit.
 *   2. The outcome was not reproducible from the save, so re-loading and
 *      re-ticking the same week re-rolled it (save-scum).
 *
 * Same week + same event + same salt always yields the same number; distinct
 * salts are independent, so each logical decision inside one payload must pass
 * its OWN salt (`'sign'`, `'amount'`, `'victim'`, …) — reusing one would tie
 * unrelated decisions together.
 *
 * Deliberately derived from the `state` every `generate` already receives rather
 * than added as a parameter: `EventTemplate.generate` is called from five places
 * in `engine.ts` plus `seasonalEvents.ts` and ~10 test suites, and a signature
 * change would have reached into `contexts/`, which this change does not touch.
 *
 * WHY THIS IS ITS OWN LEAF MODULE: the first pass defined both helpers inside
 * `engine.ts`, which is fine for engine-owned templates but unreachable from the
 * event PACKS — `engine.ts` imports `careerEvents` / `personalCrises` /
 * `travelEvents`, so a pack importing a VALUE back out of `engine.ts` would
 * close a runtime cycle (the pack's own `import type { EventTemplate }` does
 * not: tsc erases it). This module imports nothing but `utils/seededRoll` and a
 * type, so every pack can reach it. `engine.ts` re-exports both names so the
 * first pass's call sites are untouched.
 */
import type { GameState } from '@/contexts/game/types';
import { makeLifeRoll } from '@/utils/seededRoll';

/** A namespaced, deterministic [0,1) roll for one event's PAYLOAD. */
export const payloadRoll = (state: GameState, eventId: string): ((salt: string) => number) => {
  // Keyed on the life as well as the week (Program 8): the same event on the
  // same week paid the same "variable" amount in every life.
  const weekly = makeLifeRoll(state, state?.weeksLived || 0);
  return (salt: string) => weekly(`payload-${eventId}-${salt}`);
};

/**
 * Deterministic pick from a list, seeded by the week + event + salt.
 * Index is clamped into range, so a roll of exactly 1 cannot fall off the end;
 * an EMPTY list yields `undefined` at index 0, which is what the raw
 * `list[Math.floor(Math.random() * 0)]` it replaces also did.
 */
export const pickSeeded = <T,>(list: readonly T[], roll: (salt: string) => number, salt: string): T =>
  list[Math.max(0, Math.min(list.length - 1, Math.floor(roll(salt) * list.length)))];
