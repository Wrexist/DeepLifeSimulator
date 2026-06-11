/**
 * Regression: validateGameEntry REQUIRES catalog arrays (foods, streetJobs,
 * jailActivities, healthActivities, dietPlans, darkWebItems, hacks) to exist,
 * but repairGameState used to not create them — so a save missing one passed
 * repair yet failed entry, locking the player out with no recovery. repair now
 * restores them from defaults (a superset of the entry validator's list).
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { repairGameState } from '@/utils/saveValidation';
import { validateGameEntry } from '@/utils/gameEntryValidation';

describe('repairGameState backfills entry-required catalog arrays', () => {
  const catalogs = ['streetJobs', 'jailActivities', 'foods', 'healthActivities', 'dietPlans', 'darkWebItems', 'hacks'];

  it.each(catalogs)('restores a missing %s catalog so the save can still be entered', (field) => {
    // A name is required for entry; set one so the catalog array is the only
    // thing standing between the save and a successful load.
    const base = createTestGameState({
      userProfile: { firstName: 'Test', lastName: 'Player' },
    });
    const state = base as unknown as Record<string, unknown>;
    expect(validateGameEntry(state as never).canEnter).toBe(true); // valid baseline
    delete state[field];

    // Before repair: entry is blocked by the missing catalog.
    expect(validateGameEntry(state as never).canEnter).toBe(false);

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(Array.isArray(state[field])).toBe(true);
    // Catalogs must come back populated (empty would break gameplay).
    expect((state[field] as unknown[]).length).toBeGreaterThan(0);

    // After repair: entry passes again.
    expect(validateGameEntry(state as never).canEnter).toBe(true);
  });
});
