/**
 * Weekly-audit regression (2026-07-02): `stakeCrypto` must fold its balance gate
 * re-check into the granting updater. Before, the `crypto.owned < amount` gate was
 * read from the stale outer `gameState` snapshot while the `setGameState` updater
 * blindly subtracted `amount` with no re-check — so two same-batch taps both passed
 * the outer gate, drove `owned` NEGATIVE, and minted a phantom staking position
 * (extra rewards on coins the player never held). The fix re-reads the coin from
 * `prev` and returns `prev` unchanged when the balance no longer covers the stake,
 * mirroring the R4-E pattern already used by `buyMinerUpgrade`.
 */
import { stakeCrypto } from '@/contexts/game/actions/MiningActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function makeBatchedSetState(initial: GameState) {
  let state = initial;
  const setState: React.Dispatch<React.SetStateAction<GameState>> = (update) => {
    state = typeof update === 'function' ? update(state) : update;
  };
  return { setState, get: () => state };
}

function snapshotWithBtc(owned: number): GameState {
  return createTestGameState({
    cryptos: [
      { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 42150, change: 0, changePercent: 0, owned },
    ] as never,
    warehouse: { level: 1, miners: {}, stakingPositions: [] } as never,
  });
}

describe('stakeCrypto same-batch race regression (weekly audit 2026-07-02)', () => {
  it('two same-batch stake taps for the full balance stake ONCE, never negative', () => {
    const snapshot = snapshotWithBtc(1.0); // enough for exactly one full stake
    const { setState, get } = makeBatchedSetState(snapshot);

    stakeCrypto(snapshot, setState, 'btc', 1.0, 1);
    stakeCrypto(snapshot, setState, 'btc', 1.0, 1); // same stale snapshot → double-tap

    const btc = get().cryptos.find((c) => c.id === 'btc');
    expect(btc?.owned).toBe(0);              // debited exactly once, never negative
    expect(btc!.owned).toBeGreaterThanOrEqual(0);
    expect(get().warehouse?.stakingPositions?.length).toBe(1); // no phantom position
  });

  it('rejects a stake larger than the held balance (no negative, no position)', () => {
    const snapshot = snapshotWithBtc(0.5);
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = stakeCrypto(snapshot, setState, 'btc', 1.0, 1);

    expect(res.success).toBe(false);
    expect(get().cryptos.find((c) => c.id === 'btc')?.owned).toBe(0.5);
    expect(get().warehouse?.stakingPositions?.length ?? 0).toBe(0);
  });

  it('a single valid stake still succeeds and records one position', () => {
    const snapshot = snapshotWithBtc(2.0);
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = stakeCrypto(snapshot, setState, 'btc', 1.5, 2);

    expect(res.success).toBe(true);
    expect(get().cryptos.find((c) => c.id === 'btc')?.owned).toBeCloseTo(0.5, 6);
    expect(get().warehouse?.stakingPositions?.length).toBe(1);
    expect(get().warehouse?.stakingPositions?.[0].amount).toBe(1.5);
  });
});
