/**
 * The `global.createTestGameState` shim installed by `jest.setup.js`.
 *
 * It forwards straight to `__tests__/helpers/createTestGameState`, so this
 * declaration must describe THAT function. It used to say
 * `Partial<GameState>`, which is shallow: `{ stats: { money: 5000 } }` — the
 * usage every caller of the global actually writes — did not type-check, so
 * nine stress suites reached for `as never` / `as GameState` to get past it.
 *
 * Same fix as the direct import: `TestGameStateOverrides` says what the
 * function already does, and the casts stop being necessary.
 *
 * The shim itself stays deprecated — prefer the explicit import. This only
 * makes the deprecated path honest rather than actively misleading.
 */
import type { GameState } from '@/contexts/game/types';
import type { TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';

declare global {
  function createTestGameState(overrides?: TestGameStateOverrides): GameState;

  namespace NodeJS {
    interface Global {
      createTestGameState: (overrides?: TestGameStateOverrides) => GameState;
    }
  }

  var createTestGameState: (overrides?: TestGameStateOverrides) => GameState;
}

export {};
