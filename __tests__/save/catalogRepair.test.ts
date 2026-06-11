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

describe('repairGameState backfills app subsystems (H1)', () => {
  it('restores an entirely-missing banking slice', () => {
    const state = createTestGameState() as unknown as Record<string, unknown>;
    delete state.banking;
    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect((state.banking as Record<string, unknown>)?.creditScore).toBeDefined();
  });

  it('fills a present-but-partial banking slice (missing creditScore)', () => {
    // Deep-clone so deleting a NESTED field doesn't mutate the shared
    // initialGameState that the test factory and repair both reference.
    const state = JSON.parse(JSON.stringify(createTestGameState())) as Record<string, unknown>;
    const banking = state.banking as Record<string, unknown>;
    delete banking.creditScore; // partial object — migrations would skip it
    repairGameState(state);
    expect((state.banking as Record<string, unknown>).creditScore).toBeDefined();
  });

  it('restores darkWeb.heat and cryptoMarket.coinMarkets when their slices are missing', () => {
    const state = createTestGameState() as unknown as Record<string, unknown>;
    delete state.darkWeb;
    delete state.cryptoMarket;
    repairGameState(state);
    expect((state.darkWeb as Record<string, unknown>)?.heat).toBeDefined();
    expect((state.cryptoMarket as Record<string, unknown>)?.coinMarkets).toBeDefined();
  });
});
