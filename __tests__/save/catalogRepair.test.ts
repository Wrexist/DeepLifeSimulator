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
    // Spread the default: `userProfile` is REPLACED wholesale by an override
    // (it is not one of createTestGameState's deep-merged keys), so a bare
    // `{ firstName, lastName }` was leaving the profile with no `name`,
    // `handle` or `gender` at all. Harmless here — validateGameEntry reads
    // firstName/lastName — but a profile missing everything else is not what
    // this fixture means to describe.
    const base = createTestGameState({
      userProfile: { ...createTestGameState().userProfile, firstName: 'Test', lastName: 'Player' },
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

  // Regression (Codex review, PR #63): a present-but-malformed favorLedger — `{}`
  // or `{ favors: null }` from a CloudSync merge / hand-edit — is truthy, so the
  // `?? emptyLedger()` / `?? { favors: [] }` fallbacks in ContactsApp/ContactsActions
  // skip it and then crash on `ledger.favors.filter/.some`. Repair must normalize
  // the shape at the load boundary so no consumer sees a bad `favors`.
  it.each([
    ['empty object', {}],
    ['null favors', { favors: null }],
    ['string favors', { favors: 'nope' }],
  ])('normalizes a malformed favorLedger (%s) to a valid empty ledger', (_label, bad) => {
    const state = createTestGameState() as unknown as Record<string, unknown>;
    state.favorLedger = bad;
    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(Array.isArray((state.favorLedger as { favors: unknown }).favors)).toBe(true);
    expect((state.favorLedger as { favors: unknown[] }).favors).toEqual([]);
  });

  it('leaves a well-formed favorLedger untouched', () => {
    const state = createTestGameState() as unknown as Record<string, unknown>;
    const good = { favors: [{ id: 'f1', contactId: 'c1', direction: 'owed-to-player', kind: 'money', value: 100, createdWeek: 1, status: 'open' }] };
    state.favorLedger = good;
    repairGameState(state);
    expect((state.favorLedger as { favors: unknown[] }).favors).toHaveLength(1);
  });
});

describe('repairGameState clamps a tampered credit score to [300, 850] (P1-12)', () => {
  const withScore = (score: unknown): Record<string, unknown> => {
    // Deep-clone first (never mutate the shared initialGameState), THEN overwrite the
    // nested score — note NaN is set AFTER the JSON round-trip, not carried through it.
    const state = JSON.parse(JSON.stringify(createTestGameState())) as Record<string, unknown>;
    (state.banking as { creditScore: { score: unknown } }).creditScore.score = score;
    return state;
  };
  const scoreOf = (state: Record<string, unknown>): number =>
    (state.banking as { creditScore: { score: number } }).creditScore.score;

  it.each([
    [9999, 850], // above the FICO ceiling
    [851, 850], // just over
    [100, 300], // below the FICO floor
    [-5, 300], // negative
  ])('clamps a tampered score %d → %d', (raw, expected) => {
    const state = withScore(raw);
    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(scoreOf(state)).toBe(expected);
  });

  it('repairs a NaN score to the 650 default', () => {
    const state = withScore(NaN);
    repairGameState(state);
    expect(scoreOf(state)).toBe(650);
  });

  it('leaves a valid in-range score untouched', () => {
    const state = withScore(720);
    repairGameState(state);
    expect(scoreOf(state)).toBe(720);
  });
});
