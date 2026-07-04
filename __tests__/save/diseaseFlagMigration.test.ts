/**
 * Regression (bug report 2026-07-03): terminal diseases (heart disease,
 * stroke, organ failure, kidney disease) became curable via experimental
 * treatment in the disease rebalance, but Disease instances snapshot
 * `curable` at contraction time — a pre-rebalance save carrying one of these
 * kept `curable: false` forever, an unwinnable death countdown. repairGameState
 * now syncs the flag from the current catalog on load.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { repairGameState } from '@/utils/saveValidation';

describe('repairGameState syncs template-derived disease flags', () => {
  it('upgrades a pre-rebalance incurable heart disease to curable', () => {
    const base = createTestGameState({
      userProfile: { firstName: 'Test', lastName: 'Player' },
    });
    const state = base as unknown as Record<string, unknown>;
    state.diseases = [
      {
        id: 'heart_disease',
        name: 'Heart Disease',
        severity: 'critical',
        effects: {},
        curable: false, // old-save snapshot
        weeksUntilDeath: 8,
        contractedWeek: 100,
        description: '',
      },
    ];

    const result = repairGameState(state);

    expect(result.repaired).toBe(true);
    expect((state.diseases as { curable: boolean }[])[0].curable).toBe(true);
  });

  it('leaves genuinely incurable chronic diseases untouched', () => {
    const base = createTestGameState({
      userProfile: { firstName: 'Test', lastName: 'Player' },
    });
    const state = base as unknown as Record<string, unknown>;
    state.diseases = [
      {
        id: 'asthma',
        name: 'Asthma',
        severity: 'serious',
        effects: {},
        curable: false, // still matches the catalog
        contractedWeek: 100,
        description: '',
      },
    ];

    repairGameState(state);

    expect((state.diseases as { curable: boolean }[])[0].curable).toBe(false);
  });
});
