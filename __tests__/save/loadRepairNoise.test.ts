/**
 * VIS-27 (v57): a fresh save must not read as a repaired, corrupted one.
 *
 * Every new game and every Continue logged "Repaired corrupted state during
 * load: [Created missing loans array, Created missing checkpoints array]".
 * `loans` is optional with no initialState default, and `checkpoints` is
 * stripped from the slot payload into a sidecar by design - neither absence is
 * corruption. A repair log that fires on every load hides the one that matters.
 */
import { repairGameState } from '@/utils/saveValidation';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';

describe('repair does not report healthy saves as corrupted (VIS-27)', () => {
  it('an absent loans key is left absent and not reported', () => {
    const state = createTestGameState() as unknown as Record<string, unknown>;
    delete state.loans;
    const { repairs } = repairGameState(state);
    expect(repairs.some((r) => r.includes('loans'))).toBe(false);
    expect(state.loans).toBeUndefined();
  });

  it('initialGameState has no loans default, which is why repair must not invent one', () => {
    expect('loans' in initialGameState).toBe(false);
  });

  it('a present loans array is still scanned for corrupt numbers', () => {
    const state = createTestGameState() as unknown as Record<string, unknown>;
    state.loans = [{ id: 'l1', principal: NaN, remaining: 100, interestRate: 0.05, weeklyPayment: 10, weeksRemaining: 10 }];
    const { repairs } = repairGameState(state);
    expect(repairs.some((r) => r.startsWith('loans[0].principal'))).toBe(true);
  });

  it('checkpoints are still re-defaulted when repair is called on its own (rewind path)', () => {
    const state = createTestGameState() as unknown as Record<string, unknown>;
    delete state.checkpoints;
    const { repairs } = repairGameState(state);
    expect(state.checkpoints).toEqual([]);
    expect(repairs).toContain('Created missing checkpoints array');
  });
});
