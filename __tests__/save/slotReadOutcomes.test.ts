/**
 * "I could not read it" is not "there is nothing there".
 *
 * `doubleBufferLoad` returned `{ data: null, source: 'none' }` for four
 * different outcomes — nothing stored, both buffers failing CRC32/HMAC, the
 * legacy fallback declining, and the whole read throwing — and `readSaveSlot`
 * forwarded only `.data`. Three separate occupancy guards then read that null
 * as "this slot is free", so a single HMAC key rotation (a live plan, see
 * tasks/leaked-key-rotation-runbook.md) would have made every slot on every
 * device look empty and overwritable. 2026-07-29 audit PIPE-1 / SEC-1.
 *
 * A second, independent way to lose a save lived in the same function: the
 * entire buffer-reading block sat inside `if (currentActive === 'A' || 'B')`,
 * so a slot whose `_active` pointer had gone missing never had `_A` or `_B`
 * read at all. Two intact multi-megabyte saves, reported as "no data".
 * 2026-07-29 audit SAVE-OW-3.
 */
process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = 'test-key-for-slot-read-outcomes';

const store = new Map<string, string>();
let failNextRead = false;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => {
      if (failNextRead) throw new Error('storage unavailable');
      return store.has(k) ? store.get(k)! : null;
    }),
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    multiRemove: jest.fn(async (ks: string[]) => ks.forEach((k) => store.delete(k))),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
  },
}));

import {
  doubleBufferSave,
  doubleBufferLoad,
  readSaveSlotDetailed,
  createSaveEnvelope,
  decodePersistedSaveEnvelope,
} from '@/utils/saveValidation';
import { validateSaveSlot } from '@/utils/gameEntryValidation';
import { purgeSlotIfPhantom } from '@/utils/phantomSaveCleanup';

const SLOT_KEY = 'save_slot_1';
const envelope = (name: string) =>
  createSaveEnvelope(JSON.stringify({ userProfile: { firstName: name }, weeksLived: 900, version: 25 }));

beforeEach(() => {
  store.clear();
  failNextRead = false;
});

describe('a slot read says WHY it found nothing', () => {
  it('reports `none` — and only `none` — for a genuinely empty slot', async () => {
    const result = await doubleBufferLoad(SLOT_KEY);

    expect(result).toMatchObject({ data: null, source: 'none', blobPresent: false });
  });

  it('reports `unverified`, not `none`, when a stored save fails verification', async () => {
    // Exactly the shape of an HMAC key rotation: the bytes are there, intact,
    // and no longer verify.
    store.set(`${SLOT_KEY}_A`, 'not-a-valid-envelope');
    store.set(`${SLOT_KEY}_active`, 'A');

    const result = await doubleBufferLoad(SLOT_KEY);

    expect(result.data).toBeNull();
    expect(result.source).toBe('unverified');
    expect(result.blobPresent).toBe(true);
  });

  it('reports `unknown` when the read itself throws — a throw proves nothing', async () => {
    failNextRead = true;

    const result = await doubleBufferLoad(SLOT_KEY);

    expect(result.source).toBe('unknown');
    expect(result.blobPresent).toBe(true);
  });

  it('reports a clean read as coming from a real buffer', async () => {
    await doubleBufferSave(SLOT_KEY, envelope('Mara'));

    const result = await doubleBufferLoad(SLOT_KEY);

    expect(result.data).not.toBeNull();
    expect(['A', 'B']).toContain(result.source);
    expect(result.blobPresent).toBe(true);
  });

  it('exposes the same distinction through readSaveSlotDetailed', async () => {
    expect((await readSaveSlotDetailed(1)).source).toBe('none');

    store.set(`${SLOT_KEY}_B`, 'corrupt');
    store.set(`${SLOT_KEY}_active`, 'B');
    expect((await readSaveSlotDetailed(1)).source).toBe('unverified');
  });
});

describe('a lost active pointer does not lose the save', () => {
  it('still finds an intact buffer when the pointer key is gone', async () => {
    await doubleBufferSave(SLOT_KEY, envelope('Mara'));
    // The pointer disappears — a partial wipe, an interrupted write, a
    // migration. The buffers are untouched.
    store.delete(`${SLOT_KEY}_active`);
    expect(store.has(`${SLOT_KEY}_A`) || store.has(`${SLOT_KEY}_B`)).toBe(true);

    const result = await doubleBufferLoad(SLOT_KEY);

    expect(result.data).not.toBeNull();
    expect(result.blobPresent).toBe(true);
  });

  it('repairs the pointer so the next read goes straight to the good buffer', async () => {
    await doubleBufferSave(SLOT_KEY, envelope('Mara'));
    store.delete(`${SLOT_KEY}_active`);

    await doubleBufferLoad(SLOT_KEY);

    const repaired = store.get(`${SLOT_KEY}_active`);
    expect(repaired === 'A' || repaired === 'B').toBe(true);
  });

  it('falls back to the other buffer when the pointed-at one is corrupt', async () => {
    await doubleBufferSave(SLOT_KEY, envelope('Mara'));
    const active = store.get(`${SLOT_KEY}_active`) as 'A' | 'B';
    const other = active === 'A' ? 'B' : 'A';
    // A good copy in the other buffer, garbage in the active one.
    store.set(`${SLOT_KEY}_${other}`, envelope('Recovered'));
    store.set(`${SLOT_KEY}_${active}`, 'corrupt');

    const result = await doubleBufferLoad(SLOT_KEY);

    expect(result.data).toBe(store.get(`${SLOT_KEY}_${other}`));
    expect(result.source).toBe(other);
    expect(store.get(`${SLOT_KEY}_active`)).toBe(other);
  });

  it('only reports unverified once BOTH buffers and the legacy key have been tried', async () => {
    store.set(`${SLOT_KEY}_A`, 'corrupt-a');
    store.set(`${SLOT_KEY}_B`, 'corrupt-b');
    store.set(SLOT_KEY, 'corrupt-legacy');

    const result = await doubleBufferLoad(SLOT_KEY, undefined, { allowLegacy: true });

    expect(result.source).toBe('unverified');
    expect(result.blobPresent).toBe(true);
  });
});

describe('migrating a legacy-key save must not double-wrap it (SEC-3b)', () => {
  // A signed v2 envelope can sit at the bare `save_slot_N` key: it verifies
  // under the normal rules, and every pre-double-buffer restore wrote one there
  // via atomicSave. The migration branch re-wraps that blob into buffer A. If it
  // wraps the RAW envelope instead of the decoded state, buffer A holds a
  // double envelope; loading it once yields the inner envelope OBJECT, which
  // repairs to a near-default state and autosaves over the real save — the
  // SAVE-OW-1 wipe, reintroduced for the exact recovery cohort this serves.

  // The recovered payload should decode to a character, never to an inner
  // envelope — so the fields we assert on are the character's, plus `v` (which
  // is present only on the double-wrapped envelope object this guards against).
  type DecodedState = {
    userProfile?: { firstName?: string };
    weeksLived?: number;
    v?: unknown;
  };
  const loadOnce = (blob: string): DecodedState => {
    const decoded = decodePersistedSaveEnvelope(blob, { allowLegacy: false });
    expect(decoded.valid).toBe(true);
    expect(typeof decoded.data).toBe('string');
    return JSON.parse(decoded.data as string) as DecodedState;
  };

  it('migrates a v2 envelope at the legacy key to a SINGLE (not double) envelope', async () => {
    // A signed v2 envelope at the bare key, no buffers.
    store.set(SLOT_KEY, envelope('Nadia'));

    const result = await doubleBufferLoad(SLOT_KEY);

    expect(result.migrated).toBe(true);
    expect(result.source).toBe('legacy');

    // The returned blob decodes ONCE straight to the real state — not to an
    // inner envelope object (which would carry `v: 2` and no character).
    const state = loadOnce(result.data as string);
    expect(state.userProfile?.firstName).toBe('Nadia');
    expect(state.v).toBeUndefined();
    expect(state.weeksLived).toBe(900);

    // Buffer A is the canonical destination and must hold the same single
    // envelope, decoding once to the character rather than to `{ v: 2, ... }`.
    const bufferA = store.get(`${SLOT_KEY}_A`);
    expect(bufferA).toBeTruthy();
    expect(loadOnce(bufferA as string).userProfile?.firstName).toBe('Nadia');
    expect(store.get(`${SLOT_KEY}_active`)).toBe('A');
  });

  it('still migrates a raw legacy payload at the legacy key', async () => {
    // The unsigned-legacy path must keep working: the raw state string is
    // wrapped once into a proper envelope.
    const raw = JSON.stringify({
      userProfile: { firstName: 'Ione' },
      stats: { health: 80 },
      date: { year: 2026 },
      weeksLived: 400,
      version: 25,
    });
    store.set(SLOT_KEY, raw);

    const result = await doubleBufferLoad(SLOT_KEY, undefined, { allowLegacy: true });

    expect(result.migrated).toBe(true);
    const bufferA = store.get(`${SLOT_KEY}_A`);
    expect(bufferA).toBeTruthy();
    const decoded = decodePersistedSaveEnvelope(bufferA as string, { allowLegacy: true });
    expect(decoded.valid).toBe(true);
    expect(JSON.parse(decoded.data as string).userProfile.firstName).toBe('Ione');
  });
});

describe('the callers that inherited the same blindness', () => {
  it('validateSaveSlot reports an unverifiable slot as EXISTING, not empty', async () => {
    store.set(`${SLOT_KEY}_A`, 'corrupt');
    store.set(`${SLOT_KEY}_active`, 'A');

    const result = await validateSaveSlot(1);

    // `exists` was hardcoded false on the null path, so the corruption
    // messaging below it was unreachable for the case that produces it, and
    // the slot read out as empty — the one answer that invites an overwrite.
    expect(result.exists).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/verified|recoverable/i);
  });

  it('validateSaveSlot still calls a genuinely empty slot empty', async () => {
    const result = await validateSaveSlot(1);
    expect(result).toMatchObject({ exists: false, valid: false });
  });

  it('purgeSlotIfPhantom refuses to purge a slot it could not read', async () => {
    store.set(`${SLOT_KEY}_A`, 'corrupt-but-maybe-recoverable');
    store.set(`${SLOT_KEY}_active`, 'A');
    store.set('lastSlot', '1');

    // It used to fall through, wipe the summary and slot markers and report
    // success — the Continue card vanished while the blob sat on disk.
    expect(await purgeSlotIfPhantom(1)).toBe(false);
    expect(store.get(`${SLOT_KEY}_A`)).toBe('corrupt-but-maybe-recoverable');
    expect(store.get('lastSlot')).toBe('1');
  });
});
