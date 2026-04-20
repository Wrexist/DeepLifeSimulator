import { GameState } from '@/contexts/GameContext';

declare global {
  function createTestGameState(overrides?: Partial<GameState>): GameState;

  namespace NodeJS {
    interface Global {
      createTestGameState: (overrides?: Partial<GameState>) => GameState;
    }
  }

  var createTestGameState: (overrides?: Partial<GameState>) => GameState;
}

export {};
