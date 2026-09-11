import { initialGameState } from '@/contexts/game/initialState';
import { repairGameState } from '@/utils/saveValidation';
import { hydrateLoadedState } from '@/utils/hydrateLoadedState';
import { runMigrations } from '@/utils/saveMigrations';

describe('save repair round trip', () => {
  it('stabilizes after repairing a serialized current save', () => {
    const state = JSON.parse(JSON.stringify(initialGameState));
    const first = repairGameState(state);
    const restored = JSON.parse(JSON.stringify(state));
    const second = repairGameState(restored);
    expect({ first: first.repairs, second: second.repairs }).toEqual({
      first: expect.any(Array), second: [],
    });
    expect(restored.stats.money).toBe(state.stats.money);
    expect(restored.weeksLived).toBe(state.weeksLived);
  });
  it('does not repair again after hydration and a save round trip', () => {
    const first = hydrateLoadedState(JSON.parse(JSON.stringify(initialGameState)), { source: 'test' });
    const second = hydrateLoadedState(JSON.parse(JSON.stringify(first.state)), { source: 'test' });
    expect(second.repairs).toEqual([]);
    expect(second.state.stats.money).toBe(first.state.stats.money);
    expect(second.state.processedIAPTransactions).toEqual(first.state.processedIAPTransactions);
  });
  it.each([22, 43, 50])('preserves money and purchase grants across a v%s upgrade and repeat load', (version) => {
    const old = JSON.parse(JSON.stringify(initialGameState));
    old.version = version;
    old.stats.money = 12765;
    old.stats.gems = 731;
    old.processedIAPTransactions = ['test-fulfilled-transaction'];
    delete old.shownNotificationIds;
    delete old.pursuits;
    const migrated = runMigrations(old).state;
    const first = hydrateLoadedState(migrated, { source: 'test' });
    const second = hydrateLoadedState(JSON.parse(JSON.stringify(first.state)), { source: 'test' });
    expect(second.repairs).toEqual([]);
    expect(second.state.stats.money).toBe(12765);
    expect(second.state.stats.gems).toBe(731);
    expect(second.state.processedIAPTransactions).toEqual(['test-fulfilled-transaction']);
  });
});
