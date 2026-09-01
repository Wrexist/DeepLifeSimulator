/**
 * A new life must never be written over an existing save.
 *
 * From a player report: a prestiged run was replaced by a brand-new Week 1 /
 * Age 18 / Generation 1 character, and the file validated clean with zero
 * errors and zero warnings — because it *was* clean. It was a legitimate new
 * game saved into the wrong slot.
 *
 * The flow picked the slot four screens before it wrote anything, and `Perks`
 * papered over the gap with `state.slot || 1`. Every route that reached
 * onboarding without visiting the slot picker (the death screen set no slot at
 * all) inherited the context default of 1 and clobbered it silently.
 *
 * These tests pin the rule that replaces it: the check runs against a FRESH
 * read at the moment of writing, and it refuses rather than defaults.
 */
import {
  resolveNewLifeSlot,
  inspectSlotForNewLife,
  describeOccupant,
  isValidSlotNumber,
  NEW_LIFE_SLOT_UNSET,
} from '@/src/features/onboarding/slotSafety';
import { initializeAndSaveGame, type InitializeGameDeps } from '@/src/features/onboarding/gameInitializer';
import { canAccessScreen } from '@/src/features/onboarding/flowGuard';

jest.mock('@/utils/saveValidation', () => ({
  readSaveSlot: jest.fn(),
  decodePersistedSaveEnvelope: jest.fn(),
  shouldAllowUnsignedLegacySaves: jest.fn(() => false),
}));
jest.mock('@/utils/saveSlotMeta', () => ({ probeSaveSlotBlob: jest.fn() }));

const saveValidation = jest.requireMock('@/utils/saveValidation') as {
  readSaveSlot: jest.Mock;
  decodePersistedSaveEnvelope: jest.Mock;
  shouldAllowUnsignedLegacySaves: jest.Mock;
};
const slotMeta = jest.requireMock('@/utils/saveSlotMeta') as { probeSaveSlotBlob: jest.Mock };

/** A real, meaningful save — the thing we must never destroy. */
const PRESTIGED_SAVE = {
  userProfile: { firstName: 'Mara', lastName: 'Okonkwo' },
  stats: { money: 4_200_000 },
  date: { age: 61, month: 'March' },
  weeksLived: 2231,
  generationNumber: 4,
  prestige: { prestigeLevel: 3 },
  relationships: [{}, {}],
};

/** Shaped like a save but with nothing played — safe to overwrite. */
const UNTOUCHED_SLOT = {
  userProfile: { firstName: '', lastName: '' },
  stats: { money: 0 },
  date: { age: 18, month: 'January' },
  weeksLived: 0,
};

function slotHolds(payload: unknown | null) {
  slotMeta.probeSaveSlotBlob.mockResolvedValue(payload === null ? 'empty' : 'exists');
  saveValidation.readSaveSlot.mockResolvedValue(payload === null ? null : 'envelope-blob');
  saveValidation.decodePersistedSaveEnvelope.mockReturnValue(
    payload === null ? { valid: false } : { valid: true, data: JSON.stringify(payload) },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  saveValidation.shouldAllowUnsignedLegacySaves.mockReturnValue(false);
});

// ---------------------------------------------------------------------------

describe('a slot number is only ever 1-3', () => {
  it('rejects the "unchosen" sentinel and everything else nonsensical', () => {
    expect(isValidSlotNumber(NEW_LIFE_SLOT_UNSET)).toBe(false);
    for (const bad of [0, -1, 4, 1.5, NaN, Infinity, '1', null, undefined, {}]) {
      expect(isValidSlotNumber(bad)).toBe(false);
    }
  });

  it('accepts the three real slots', () => {
    expect([1, 2, 3].every(isValidSlotNumber)).toBe(true);
  });
});

describe('reading a slot before writing over it', () => {
  it('calls an empty slot free', async () => {
    slotHolds(null);
    await expect(inspectSlotForNewLife(2)).resolves.toEqual({ status: 'free' });
  });

  it('calls a slot with a real character occupied, and names them', async () => {
    slotHolds(PRESTIGED_SAVE);
    const result = await inspectSlotForNewLife(1);

    expect(result.status).toBe('occupied');
    expect((result as { label: string }).label).toContain('Mara Okonkwo');
  });

  it('calls a shaped-but-unplayed slot free', async () => {
    slotHolds(UNTOUCHED_SLOT);
    await expect(inspectSlotForNewLife(3)).resolves.toEqual({ status: 'free' });
  });

  it('treats an undecodable envelope as UNREADABLE, never as free', async () => {
    slotMeta.probeSaveSlotBlob.mockResolvedValue('exists');
    saveValidation.readSaveSlot.mockResolvedValue('garbage');
    saveValidation.decodePersistedSaveEnvelope.mockReturnValue({ valid: false });

    // A corrupt save is often still recoverable from a backup; overwriting it
    // throws that away for good.
    await expect(inspectSlotForNewLife(1)).resolves.toEqual({ status: 'unreadable' });
  });

  it('treats unparseable JSON inside a valid envelope as unreadable', async () => {
    slotMeta.probeSaveSlotBlob.mockResolvedValue('exists');
    saveValidation.readSaveSlot.mockResolvedValue('blob');
    saveValidation.decodePersistedSaveEnvelope.mockReturnValue({ valid: true, data: '{not json' });

    await expect(inspectSlotForNewLife(1)).resolves.toEqual({ status: 'unreadable' });
  });

  it('treats a storage failure as unreadable rather than assuming empty', async () => {
    slotMeta.probeSaveSlotBlob.mockResolvedValue('unknown');
    await expect(inspectSlotForNewLife(1)).resolves.toEqual({ status: 'unreadable' });
    // Nothing may be decoded on the strength of a failed read.
    expect(saveValidation.readSaveSlot).not.toHaveBeenCalled();
  });

  /**
   * The one that nearly shipped. `readSaveSlot` returns the SAME null for
   * "nothing stored", "failed CRC32/HMAC verification" and "the read threw", so
   * branching on it called an intact-but-unverifiable save empty. One HMAC key
   * rotation (a live plan — tasks/leaked-key-rotation-runbook.md) would have
   * made every slot on every device look free to overwrite.
   */
  it('a blob that EXISTS but will not verify is unreadable, not free', async () => {
    slotMeta.probeSaveSlotBlob.mockResolvedValue('exists');
    saveValidation.readSaveSlot.mockResolvedValue(null); // verification failed upstream

    await expect(inspectSlotForNewLife(1)).resolves.toEqual({ status: 'unreadable' });
  });

  it('decides emptiness from the raw probe, not from a decode that may fail', async () => {
    slotMeta.probeSaveSlotBlob.mockResolvedValue('empty');

    await expect(inspectSlotForNewLife(2)).resolves.toEqual({ status: 'free' });
    expect(saveValidation.readSaveSlot).not.toHaveBeenCalled();
  });
});

describe('resolving the slot for a new life', () => {
  it('REFUSES when no slot was chosen - it does not fall back to slot 1', async () => {
    slotMeta.probeSaveSlotBlob.mockResolvedValue('empty');
    // This single assertion is the whole incident: the old code turned "no
    // choice" into slot 1 and destroyed whatever lived there.
    const result = await resolveNewLifeSlot(NEW_LIFE_SLOT_UNSET);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: 'no-slot-chosen' });
    // And it must not have even looked at a slot, let alone written one.
    expect(slotMeta.probeSaveSlotBlob).not.toHaveBeenCalled();
  });

  it('refuses an occupied slot and says whose save it is protecting', async () => {
    slotHolds(PRESTIGED_SAVE);
    const result = await resolveNewLifeSlot(1);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: 'slot-occupied' });
    expect((result as { message: string }).message).toContain('Mara Okonkwo');
  });

  it('refuses an unreadable slot', async () => {
    slotMeta.probeSaveSlotBlob.mockResolvedValue('exists');
    saveValidation.readSaveSlot.mockResolvedValue('blob');
    saveValidation.decodePersistedSaveEnvelope.mockReturnValue({ valid: false });

    expect(await resolveNewLifeSlot(2)).toMatchObject({ ok: false, code: 'slot-unreadable' });
  });

  it('allows a genuinely empty slot', async () => {
    slotHolds(null);
    expect(await resolveNewLifeSlot(3)).toEqual({ ok: true, slot: 3 });
  });
});

describe('describing the occupant', () => {
  it('leads with the name and adds only what distinguishes the run', () => {
    expect(describeOccupant(PRESTIGED_SAVE)).toBe('Mara Okonkwo (age 61, generation 4, prestige 3)');
  });

  it('omits generation 1 and prestige 0 - they say nothing', () => {
    expect(
      describeOccupant({
        userProfile: { firstName: 'Sam', lastName: 'Vale' },
        date: { age: 22 },
        generationNumber: 1,
        prestige: { prestigeLevel: 0 },
      }),
    ).toBe('Sam Vale (age 22)');
  });

  it('stays readable with no name at all', () => {
    expect(describeOccupant({})).toBe('An existing character');
  });
});

// ---------------------------------------------------------------------------

describe('the write itself refuses - not just the screen four steps earlier', () => {
  function deps(overrides: Partial<InitializeGameDeps> = {}): InitializeGameDeps {
    return {
      validateOnboardingState: () => ({ valid: true, errors: [], warnings: [] }),
      applySafeDefaults: () => ({ defaults: [] }),
      createBackupFromState: jest.fn().mockResolvedValue(undefined),
      forceSave: jest.fn().mockResolvedValue(undefined),
      loadGame: jest.fn().mockResolvedValue({ version: 25 }),
      validateGameEntry: () => ({ canEnter: true, errors: [], warnings: [] }),
      isSaveSigningConfigError: () => false,
      resolveNewLifeSlot: jest.fn().mockResolvedValue({ ok: true, slot: 1 }),
      ...overrides,
    };
  }

  it('does not save, and does not even back up, when the slot is refused', async () => {
    const d = deps({
      resolveNewLifeSlot: jest
        .fn()
        .mockResolvedValue({ ok: false, code: 'slot-occupied', title: 'T', message: 'M' }),
    });

    const result = await initializeAndSaveGame({ any: 'state' }, 1, d);

    expect(result.success).toBe(false);
    expect(result.slotProblem).toBe('slot-occupied');
    expect(d.forceSave).not.toHaveBeenCalled();
    // The pre-save backup writes under the same slot, so it must be gated too —
    // otherwise a refused run still pollutes the occupant's backup ring.
    expect(d.createBackupFromState).not.toHaveBeenCalled();
  });

  it('checks the slot BEFORE building or validating anything', async () => {
    const order: string[] = [];
    const d = deps({
      resolveNewLifeSlot: jest.fn().mockImplementation(async () => {
        order.push('resolve');
        return { ok: true, slot: 2 };
      }),
      validateOnboardingState: jest.fn().mockImplementation(() => {
        order.push('validate');
        return { valid: true, errors: [], warnings: [] };
      }),
      forceSave: jest.fn().mockImplementation(async () => {
        order.push('save');
      }),
    });

    await initializeAndSaveGame({}, 2, d);

    expect(order).toEqual(['resolve', 'validate', 'save']);
  });

  it('writes to the slot the resolver approved, not the one it was handed', async () => {
    const d = deps({ resolveNewLifeSlot: jest.fn().mockResolvedValue({ ok: true, slot: 3 }) });

    await initializeAndSaveGame({}, 3, d);

    expect(d.forceSave).toHaveBeenCalledWith(3, expect.anything());
    expect(d.loadGame).toHaveBeenCalledWith(3);
  });

  it('surfaces "no slot chosen" as a slot problem the caller can route on', async () => {
    const d = deps({
      resolveNewLifeSlot: jest
        .fn()
        .mockResolvedValue({ ok: false, code: 'no-slot-chosen', title: 'T', message: 'M' }),
    });

    const result = await initializeAndSaveGame({}, NEW_LIFE_SLOT_UNSET, d);
    expect(result.slotProblem).toBe('no-slot-chosen');
  });
});

// ---------------------------------------------------------------------------

describe('the flow guard will not let a slotless run reach the write', () => {
  const filledIn = { scenario: { id: 's' }, firstName: 'Ada', lastName: 'Byron' };

  it.each(['Customize', 'Perks'] as const)(
    'bounces %s back to the slot picker when no slot was chosen',
    (screen) => {
      const result = canAccessScreen(screen, { ...filledIn, slot: NEW_LIFE_SLOT_UNSET });

      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/(onboarding)/SaveSlots');
    },
  );

  it('bounces on a missing slot key too (an old persisted draft)', () => {
    expect(canAccessScreen('Perks', filledIn).allowed).toBe(false);
  });

  it('lets a fully-specified run through', () => {
    expect(canAccessScreen('Perks', { ...filledIn, slot: 2 })).toEqual({ allowed: true });
  });

  it('leaves Scenarios an entry point, so picking a slot then navigating cannot race', () => {
    expect(canAccessScreen('Scenarios', {}).allowed).toBe(true);
  });

  it('still enforces the ORIGINAL prerequisites once a slot exists', () => {
    expect(canAccessScreen('Customize', { slot: 1 })).toMatchObject({
      allowed: false,
      redirectTo: '/(onboarding)/Scenarios',
    });
    expect(canAccessScreen('Perks', { slot: 1, scenario: { id: 's' }, firstName: ' ' })).toMatchObject({
      allowed: false,
      redirectTo: '/(onboarding)/Customize',
    });
  });
});
