/**
 * Lightweight "game flow" checks that run in the Node Jest environment.
 * Full GameProvider + RTL integration is deferred until a jest-expo / native test host is configured.
 */
import { initialGameState } from '@/contexts/game/initialState';

describe('Game flow bootstrap (Node)', () => {
  it('exposes consistent starting economy and vitals', () => {
    expect(initialGameState.stats.money).toBe(200);
    expect(initialGameState.stats.health).toBe(100);
    expect(initialGameState.stats.happiness).toBe(100);
    expect(initialGameState.stats.energy).toBe(100);
    expect(initialGameState.weeksLived).toBe(0);
    expect(initialGameState.week).toBe(1);
  });
});
