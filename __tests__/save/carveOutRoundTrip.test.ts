/**
 * Every §7 carve-out field, written to a save and read back.
 *
 * CLAUDE.md §7 ends with an instruction: "After adding a field, load a save that
 * has it and assert it is still there." Until now no test did — a grep across
 * the save and integration suites found zero references to `lifeStartWeek`,
 * `tuitionWaiverUSD`, `grandchildren`, `rental`, `dynasty` or `mail`.
 * 2026-08-16 architecture audit M12.
 *
 * The instruction exists because a carve-out is EXACTLY the field a load can
 * erase. "No backfill needed" is a claim about the save FORMAT: the field's
 * stored default is `undefined`, so it is deliberately absent from
 * `initialGameState`. It says nothing about the round trip — and the load-time
 * merge for `stats`/`date`/`settings`/`userProfile` used to iterate
 * `initialGameState`'s keys, which is a whitelist that by construction excludes
 * every carve-out. The whole category was written to disk correctly and dropped
 * on the way back in, silently. It shipped twice: `userProfile.avatar` (v39)
 * showed the player a different face than the one they built, and
 * `settings.lastNoFillGrantWeek` (v28) reopened the restart-farm exploit it was
 * added to close.
 *
 * Two layers here, deliberately:
 *
 *  1. A table over ALL fourteen carve-outs through the composed load merge —
 *     the `{ ...initialGameState, ...parsed }` spread plus `mergeLoadedSlice`
 *     for the four key-by-key sub-objects, exactly as `loadGame` composes them
 *     (`GameActionsContext.tsx:4686-4696`). This is the stage that ate the two
 *     shipped bugs, and it is pure, so every field can be covered cheaply.
 *  2. A full serialize → v2 envelope → verify → parse → migrate → repair →
 *     merge round trip through the REAL storage layer for three representative
 *     shapes: one settings-scoped, one top-level, one nested inside an array
 *     element. Those exercise the stages the table skips — the envelope's
 *     checksum/HMAC, `runMigrations` (which must not touch a current-version
 *     save) and `repairGameState` (which deep-clones and writes back, and could
 *     drop an unknown key while doing so).
 *
 * `loadGame` itself is a `useCallback` inside `GameActionsContext` and reaches
 * for permanent perks, the IAP ledger and slot metadata, so it is not callable
 * from here. The composition it performs is reproduced instead, and
 * `__tests__/save/loadInvariants.test.ts` guards the surrounding stages.
 */
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { mergeLoadedSlice } from '@/utils/loadedStateMerge';
import { runMigrations } from '@/utils/saveMigrations';
import {
  repairGameState,
  doubleBufferSave,
  doubleBufferLoad,
  createSaveEnvelope,
  decodePersistedSaveEnvelope,
} from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = 'test-key-for-carve-out-round-trip';

const store = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    multiRemove: jest.fn(async (ks: string[]) => {
      ks.forEach((k) => store.delete(k));
    }),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
  },
}));

/** Read a value at a dotted path, tolerating a missing link (that IS the failure). */
const at = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    const idx = Number(key);
    if (Array.isArray(acc)) return Number.isInteger(idx) ? acc[idx] : undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);

/**
 * The merge `loadGame` performs on a parsed save, reproduced from
 * `GameActionsContext.tsx:4686-4696`. The four sub-objects go through
 * `mergeLoadedSlice`; everything else rides the spread.
 */
const loadMerge = (parsed: Record<string, unknown>): GameState => {
  // `Partial<GameState>`, never `as GameState` (Hard Rule #3): a parsed save is
  // genuinely partial, and the spread over `initialGameState` is what makes the
  // result complete — which is the property under test.
  const p: Partial<GameState> = parsed;
  const merged: GameState = {
    ...initialGameState,
    ...p,
    stats: p.stats ? mergeLoadedSlice(p.stats, initialGameState.stats) : initialGameState.stats,
    date: p.date ? mergeLoadedSlice(p.date, initialGameState.date) : initialGameState.date,
    settings: p.settings ? mergeLoadedSlice(p.settings, initialGameState.settings) : initialGameState.settings,
    userProfile: p.userProfile
      ? mergeLoadedSlice(p.userProfile, initialGameState.userProfile)
      : initialGameState.userProfile,
  };
  return merged;
};

/**
 * One carve-out: the version that introduced it, where it lives, a distinctive
 * value, and a state carrying that value.
 *
 * The values are deliberately odd (week 3_777, 'a1.5n804631300', $12,500) so a
 * passing assertion cannot be a coincidental default.
 */
interface CarveOut {
  version: number;
  /** Dotted path from the state root. */
  path: string;
  /** What the field should read after the round trip. */
  value: unknown;
  /** A state with the field set at `path`. */
  build: () => GameState;
}

const base = () => createTestGameState({ weeksLived: 3_000, version: STATE_VERSION });

const CARVE_OUTS: CarveOut[] = [
  {
    version: 26,
    path: 'settings.quickActionWeeks',
    value: { hustle: 3_777 },
    build: () => createTestGameState({ settings: { quickActionWeeks: { hustle: 3_777 } }, version: STATE_VERSION }),
  },
  {
    version: 27,
    path: 'lastLoginRewardAt',
    value: 1_771_000_000_000,
    build: () => createTestGameState({ lastLoginRewardAt: 1_771_000_000_000, version: STATE_VERSION }),
  },
  {
    version: 28,
    path: 'settings.lastNoFillGrantWeek',
    value: 3_777,
    build: () => createTestGameState({ settings: { lastNoFillGrantWeek: 3_777 }, version: STATE_VERSION }),
  },
  {
    version: 31,
    path: 'lastLoginRewardWeek',
    value: 3_777,
    build: () => createTestGameState({ lastLoginRewardWeek: 3_777, version: STATE_VERSION }),
  },
  {
    version: 32,
    path: 'rental',
    value: { tierId: 'studio_apartment', startedWeek: 3_777 },
    build: () =>
      createTestGameState({
        rental: { tierId: 'studio_apartment', startedWeek: 3_777 },
        version: STATE_VERSION,
      }),
  },
  {
    version: 34,
    path: 'family.children.0.grandchildren',
    value: [{ id: 'gc-1', name: 'Nia', birthWeeksLived: 3_777 }],
    build: () => {
      const s = base();
      return {
        ...s,
        family: {
          ...s.family,
          children: [
            {
              id: 'child-1',
              name: 'Ada',
              type: 'child',
              relationshipScore: 70,
              personality: 'curious',
              gender: 'female',
              age: 8,
              grandchildren: [{ id: 'gc-1', name: 'Nia', birthWeeksLived: 3_777 }],
            },
          ],
        },
      };
    },
  },
  {
    version: 36,
    path: 'dynasty.vaultItemIds',
    value: ['heirloom-watch'],
    build: () => createTestGameState({ dynasty: { vaultItemIds: ['heirloom-watch'] }, version: STATE_VERSION }),
  },
  {
    version: 37,
    path: 'mail.lastGeneratedWeek',
    value: 3_777,
    build: () =>
      createTestGameState({
        mail: { messages: [], lastGeneratedWeek: 3_777 },
        version: STATE_VERSION,
      }),
  },
  {
    version: 39,
    path: 'userProfile.avatar',
    value: 'a1.5n804631300',
    build: () => {
      const s = base();
      return { ...s, userProfile: { ...s.userProfile, avatar: 'a1.5n804631300' } };
    },
  },
  {
    version: 40,
    path: 'settings.deepLifePlusLastGemClaimWeek',
    value: 3_777,
    build: () =>
      createTestGameState({ settings: { deepLifePlusLastGemClaimWeek: 3_777 }, version: STATE_VERSION }),
  },
  {
    version: 41,
    path: 'tuitionWaiverUSD',
    value: 12_500,
    build: () => createTestGameState({ tuitionWaiverUSD: 12_500, version: STATE_VERSION }),
  },
  {
    version: 42,
    path: 'lifetimeStatistics.careerHistory.0.title',
    value: 'President',
    build: () => {
      const s = base();
      return {
        ...s,
        lifetimeStatistics: {
          ...s.lifetimeStatistics!,
          careerHistory: [
            { job: 'political', weeks: 208, earnings: 1_000_000, startWeek: 3_000, title: 'President' },
          ],
        },
      };
    },
  },
  {
    version: 43,
    path: 'lifeStartWeek',
    value: 364,
    build: () => createTestGameState({ lifeStartWeek: 364, version: STATE_VERSION }),
  },
  {
    version: 44,
    path: 'settings.lastWelcomeBackWeek',
    value: 3_777,
    build: () => createTestGameState({ settings: { lastWelcomeBackWeek: 3_777 }, version: STATE_VERSION }),
  },
  {
    version: 45,
    path: 'sparkApp.matches.0.rapport',
    value: 73,
    build: () => sparkMatchState(),
  },
  {
    version: 45,
    path: 'sparkApp.matches.0.conversationCooldowns',
    value: { compliment: 3_777 },
    build: () => sparkMatchState(),
  },
  {
    version: 46,
    path: 'settings.deepLifePlusLastMemberClaimWeek',
    value: 3_777,
    build: () =>
      createTestGameState({
        settings: { deepLifePlusLastMemberClaimWeek: 3_777 },
        version: STATE_VERSION,
      }),
  },
];

/**
 * A save with one Spark match carrying both v45 carve-outs. Shared by the two
 * rows above so they describe the same on-disk shape rather than two shapes
 * that happen to agree.
 */
function sparkMatchState(): GameState {
  const s = base();
  if (!s.sparkApp) {
    throw new Error('sparkMatchState: base() returned a state without sparkApp');
  }
  return {
    ...s,
    sparkApp: {
      ...s.sparkApp,
      matches: [
        {
          id: 'spm-1',
          profileId: '1',
          matchedWeek: 3_000,
          superLiked: false,
          promoted: false,
          rapport: 73,
          conversationCooldowns: { compliment: 3_777 },
        },
      ],
    },
  };
}

describe('the §7 carve-out fields survive the load merge', () => {
  it('covers every carve-out CLAUDE.md §7 lists (v26 through the current version)', () => {
    // A new carve-out that lands without a row here should fail the count, not
    // pass silently — the whole point of the audit finding.
    expect(CARVE_OUTS).toHaveLength(17);
    expect(Math.max(...CARVE_OUTS.map((c) => c.version))).toBe(STATE_VERSION);
    expect(new Set(CARVE_OUTS.map((c) => c.path)).size).toBe(CARVE_OUTS.length);
  });

  it.each(CARVE_OUTS)('v$version keeps $path', ({ path, value, build }) => {
    const saved = build();
    // The field really is set going in — otherwise the assertion below could
    // pass against a state that never carried it.
    expect(at(saved, path)).toEqual(value);

    // Serialize/parse first: this is what actually reaches disk, and a field
    // holding `undefined` would vanish here rather than at the merge.
    const parsed = JSON.parse(JSON.stringify(saved)) as Record<string, unknown>;
    expect(at(loadMerge(parsed), path)).toEqual(value);
  });

  it.each(CARVE_OUTS)('v$version is absent from initialGameState, as a carve-out must be', ({ path }) => {
    // The defining property: stored default `undefined`, so no backfill and no
    // `repairGameState` mirror. It is also WHY the merge could erase it — the
    // old whitelist loop iterated exactly these defaults.
    //
    // Checked at the OWNING object rather than the leaf, because a leaf inside
    // an array element (grandchildren, careerHistory.title) has no default
    // object to look at when the array is empty.
    const leaf = path.split('.').pop()!;
    const owner = path.split('.').slice(0, -1);
    if (owner.some((seg) => Number.isInteger(Number(seg)))) return; // array-element field
    const defaults = owner.reduce<unknown>(
      (acc, key) => (acc as Record<string, unknown> | undefined)?.[key],
      initialGameState as unknown,
    );
    if (defaults === undefined) return; // whole sub-object is itself the carve-out
    expect(leaf in (defaults as Record<string, unknown>)).toBe(false);
  });
});

/**
 * The stages the table skips. One field per shape, because these run the real
 * storage layer and are correspondingly slower:
 *
 *   settings-scoped  → `settings.lastNoFillGrantWeek`, the v28 marker whose
 *                      erasure reopened a live exploit.
 *   top-level        → `lifeStartWeek`, the v43 baseline three bugs came from.
 *   nested in array  → `family.children[0].grandchildren`, the v34 field a
 *                      deep-clone in `repairGameState` could plausibly drop.
 */
describe('a full save → envelope → load → migrate → repair round trip', () => {
  const SLOT_KEY = 'save_slot_7';

  beforeEach(() => {
    store.clear();
  });

  const roundTrip = async (state: GameState): Promise<GameState> => {
    const written = await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(state)));
    expect(written.success).toBe(true);

    const read = await doubleBufferLoad(SLOT_KEY);
    expect(read.data).toBeTruthy();

    // `doubleBufferLoad` hands back the persisted ENVELOPE; unwrapping it is
    // what verifies the CRC32 + HMAC, so a field that survived the write but
    // corrupted the payload would fail here rather than at the assertion.
    const envelope = decodePersistedSaveEnvelope(read.data!);
    expect(envelope.valid).toBe(true);
    expect(envelope.format).toBe('v2');

    const parsed = JSON.parse(envelope.data!) as Record<string, unknown>;

    const migrated = runMigrations(parsed);
    expect(migrated.errors).toEqual([]);
    expect(migrated.versionFromFuture).toBeFalsy();

    // Mutates in place and only writes its clone back when it actually repaired
    // something; either way the carve-out must still be on the object after.
    repairGameState(migrated.state);

    return loadMerge(migrated.state as Record<string, unknown>);
  };

  it('keeps settings.lastNoFillGrantWeek (v28) — the marker that closes the restart farm', async () => {
    const out = await roundTrip(
      createTestGameState({ settings: { lastNoFillGrantWeek: 3_777 }, version: STATE_VERSION }),
    );
    expect(out.settings.lastNoFillGrantWeek).toBe(3_777);
  });

  it('keeps lifeStartWeek (v43) — the baseline `weeksInThisLife` reads', async () => {
    const out = await roundTrip(
      createTestGameState({ lifeStartWeek: 364, weeksLived: 3_000, version: STATE_VERSION }),
    );
    expect(out.lifeStartWeek).toBe(364);
  });

  it('keeps grandchildren (v34) — a carve-out nested inside an array element', async () => {
    const s = createTestGameState({ version: STATE_VERSION });
    const withHeir: GameState = {
      ...s,
      family: {
        ...s.family,
        children: [
          {
            id: 'child-1',
            name: 'Ada',
            type: 'child',
            relationshipScore: 70,
            personality: 'curious',
            gender: 'female',
            age: 8,
            grandchildren: [{ id: 'gc-1', name: 'Nia', birthWeeksLived: 3_777 }],
          },
        ],
      },
    };

    const out = await roundTrip(withHeir);
    expect(out.family.children[0]?.grandchildren).toEqual([
      { id: 'gc-1', name: 'Nia', birthWeeksLived: 3_777 },
    ]);
  });

  it('v44 → v45 migration keeps rapport and conversationCooldowns absent (carve-outs)', async () => {
    // A v44 save with a Spark match but without the v45 fields, passed through
    // the migration and load path to assert both fields remain absent.
    const v44state = createTestGameState({ version: 44 });
    if (!v44state.sparkApp) {
      throw new Error('v44 → v45 test: base state has no sparkApp');
    }
    const withMatch: GameState = {
      ...v44state,
      sparkApp: {
        ...v44state.sparkApp,
        matches: [
          {
            id: 'spm-v44',
            profileId: '2',
            matchedWeek: 3_000,
            superLiked: false,
            promoted: false,
            // Deliberately NO rapport or conversationCooldowns — that is the test.
          },
        ],
      },
      version: 44,
    };

    const out = await roundTrip(withMatch);
    expect(out.version).toBe(STATE_VERSION);
    expect(out.sparkApp?.matches[0]?.rapport).toBeUndefined();
    expect(out.sparkApp?.matches[0]?.conversationCooldowns).toBeUndefined();
  });
});
