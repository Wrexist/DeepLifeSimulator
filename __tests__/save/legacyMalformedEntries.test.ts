import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { CURRENT_STATE_VERSION, runMigrations } from '@/utils/saveMigrations';

describe('legacy migrations recover individual malformed array entries', () => {
  it.each([
    { version: 10, field: 'careers', record: { id: 'old-job', name: 'Kept job', salary: 850 }, expected: { startedWeeksLived: 0 } },
    { version: 12, field: 'activeBrandDeals', record: { id: 'old-deal', payment: 400, expiresIn: 4 }, expected: { weeklyPayment: 100, postsRequired: 1 } },
    { version: 13, field: 'loans', record: { id: 'old-loan', remaining: 3500, rateAPR: 0.08 }, expected: { originalAPR: 0.08, onTimePayments: 0 } },
  ])('v$version $field reaches the current version and stays migrated on reload', ({ version, field, record, expected }) => {
    const state = createTestGameState({ version });
    const target = field === 'activeBrandDeals' ? state.socialMedia : state;
    if (!target) throw new Error('Legacy migration fixture requires socialMedia');
    Object.assign(target, { [field]: [null, false, 17, 'invalid', [], record, null] });

    const result = runMigrations(state);
    expect(result.errors).toEqual([]);
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
    const entries = field === 'activeBrandDeals'
      ? result.state.socialMedia[field]
      : result.state[field];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ ...record, ...expected });

    const saved = JSON.stringify(result.state);
    const reloaded = runMigrations(JSON.parse(saved));
    expect(reloaded.errors).toEqual([]);
    expect(reloaded.migrationsApplied).toEqual([]);
    expect(JSON.stringify(reloaded.state)).toBe(saved);
  });
});
