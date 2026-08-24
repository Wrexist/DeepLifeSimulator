/**
 * WAVE A — BitcoinMiningApp repair loop.
 *
 * `repairRig` turns the rig-detail "Repair now · $X" readout into a real action:
 * it restores ONE miner tier to 100% durability and debits the displayed USD cost,
 * with an atomic same-batch double-tap guard (mirrors handleBuyMiner / stakeCrypto).
 *
 * `setAutoRepair` arms/disarms the already-implemented weekly auto-repair tick —
 * no component wrote `autoRepairEnabled/CryptoId/WeeklyCost` before, so the tick's
 * durability-restore path (applyMiningWarehouse) could never fire. This suite
 * asserts the fields are written AND that the tick then repairs a worn rig.
 */
import { repairRig, setAutoRepair, AUTO_REPAIR_WEEKLY_COST_FLOOR } from '@/contexts/game/actions/MiningActions';
import { applyMiningWarehouse } from '@/contexts/game/actions/weekly/applyMiningWarehouse';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function makeBatchedSetState(initial: GameState) {
  let state = initial;
  const setState: React.Dispatch<React.SetStateAction<GameState>> = (update) => {
    state = typeof update === 'function' ? update(state) : update;
  };
  return { setState, get: () => state };
}

function stateWith(opts: {
  money: number;
  miners: Record<string, number>;
  durability: Record<string, number>;
  cryptos?: GameState['cryptos'];
}): GameState {
  return createTestGameState({
    stats: { money: opts.money } as never,
    cryptos: (opts.cryptos ?? [
      { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50000, change: 0, changePercent: 0, owned: 5 },
    ]) as never,
    warehouse: {
      level: 1,
      miners: opts.miners,
      minerDurability: opts.durability,
      selectedCrypto: 'btc',
    } as never,
  });
}

describe('repairRig', () => {
  it('restores durability to 100% and debits the displayed cost', () => {
    // basic repair = $125 × (50/100 damage) × 2 units = $125.
    const snapshot = stateWith({ money: 1000, miners: { basic: 2 }, durability: { basic: 50 } });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = repairRig(snapshot, setState, 'basic');

    expect(res.success).toBe(true);
    expect(get().warehouse?.minerDurability?.basic).toBe(100);
    expect(get().stats.money).toBe(875); // 1000 − 125
  });

  it('is double-tap safe - two same-batch taps debit once', () => {
    const snapshot = stateWith({ money: 1000, miners: { basic: 2 }, durability: { basic: 50 } });
    const { setState, get } = makeBatchedSetState(snapshot);

    repairRig(snapshot, setState, 'basic');
    repairRig(snapshot, setState, 'basic'); // same stale snapshot → double-tap

    expect(get().warehouse?.minerDurability?.basic).toBe(100);
    expect(get().stats.money).toBe(875); // debited exactly once
  });

  it('rejects when the player cannot afford the repair (no money change)', () => {
    const snapshot = stateWith({ money: 50, miners: { basic: 2 }, durability: { basic: 50 } });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = repairRig(snapshot, setState, 'basic');

    expect(res.success).toBe(false);
    expect(get().stats.money).toBe(50);
    expect(get().warehouse?.minerDurability?.basic).toBe(50);
  });

  it('rejects a rig already at full durability', () => {
    const snapshot = stateWith({ money: 1000, miners: { basic: 2 }, durability: { basic: 100 } });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = repairRig(snapshot, setState, 'basic');

    expect(res.success).toBe(false);
    expect(get().stats.money).toBe(1000);
  });

  it('rejects when no units of that tier are deployed', () => {
    const snapshot = stateWith({ money: 1000, miners: { basic: 2 }, durability: {} });
    const { setState } = makeBatchedSetState(snapshot);
    expect(repairRig(snapshot, setState, 'pro').success).toBe(false);
  });
});

describe('setAutoRepair', () => {
  it('enabling stamps enabled + crypto + a positive weekly-cost floor', () => {
    const snapshot = stateWith({ money: 1000, miners: { basic: 1 }, durability: { basic: 90 } });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = setAutoRepair(snapshot, setState, { enabled: true, cryptoId: 'btc' });

    expect(res.success).toBe(true);
    expect(get().warehouse?.autoRepairEnabled).toBe(true);
    expect(get().warehouse?.autoRepairCryptoId).toBe('btc');
    expect(get().warehouse?.autoRepairWeeklyCost).toBe(AUTO_REPAIR_WEEKLY_COST_FLOOR);
    expect(get().warehouse?.autoRepairWeeklyCost).toBeGreaterThan(0);
  });

  it('enabling without a funding crypto is rejected', () => {
    const snapshot = stateWith({ money: 1000, miners: { basic: 1 }, durability: { basic: 90 } });
    const { setState, get } = makeBatchedSetState(snapshot);
    const res = setAutoRepair(snapshot, setState, { enabled: true });
    expect(res.success).toBe(false);
    expect(get().warehouse?.autoRepairEnabled).toBeFalsy();
  });

  it('enabling with an unknown crypto is rejected', () => {
    const snapshot = stateWith({ money: 1000, miners: { basic: 1 }, durability: { basic: 90 } });
    const { setState } = makeBatchedSetState(snapshot);
    expect(setAutoRepair(snapshot, setState, { enabled: true, cryptoId: 'zzz' }).success).toBe(false);
  });

  it('disabling clears the enabled flag but remembers the crypto', () => {
    const snapshot = stateWith({ money: 1000, miners: { basic: 1 }, durability: { basic: 90 } });
    const { setState, get } = makeBatchedSetState(snapshot);
    setAutoRepair(snapshot, setState, { enabled: true, cryptoId: 'btc' });
    const armed = get();
    setAutoRepair(armed, setState, { enabled: false });
    expect(get().warehouse?.autoRepairEnabled).toBe(false);
    expect(get().warehouse?.autoRepairCryptoId).toBe('btc'); // remembered
  });

  it('once armed, the weekly tick repairs a sub-50% rig to 100%', () => {
    const snapshot = stateWith({ money: 1000, miners: { basic: 1 }, durability: { basic: 40 } });
    const { setState, get } = makeBatchedSetState(snapshot);
    setAutoRepair(snapshot, setState, { enabled: true, cryptoId: 'btc' });

    const armed = get();
    const { updatedWarehouse } = applyMiningWarehouse({
      prevWarehouse: armed.warehouse,
      prevCryptos: armed.cryptos,
      weeksLived: armed.weeksLived ?? 0,
      minerDegradationRoll: 5, // 40 − 5 = 35 (< 50) → auto-repaired
    });

    expect(updatedWarehouse?.minerDurability?.basic).toBe(100);
  });
});
