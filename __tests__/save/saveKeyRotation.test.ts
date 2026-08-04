/**
 * What actually happens to a save when the signing key changes.
 *
 * Written after a near-miss: `EXPO_PUBLIC_SAVE_HMAC_KEY` was deleted from the
 * EAS dashboard while trying to configure release secrets. That turned out to
 * be harmless — the shipped app gets its key from GITHUB REPO SECRETS, because
 * `eas-build-local-ios.yml` runs `eas build --local` and Metro inlines the
 * runner's shell environment; EAS-stored variables are never fetched for a
 * local build. But the half hour spent establishing that would have been much
 * shorter with the consequences pinned down in executable form.
 *
 * So this exists to answer, without anyone having to re-derive it under
 * pressure: if the key is wrong, what breaks, and what fixes it?
 *
 *   1. A save signed with key A is REJECTED under key B. Not repaired,
 *      not degraded — `verifySaveData` returns false and the loader returns
 *      null. Paid permanent entitlements are signed with the same key and fail
 *      closed to [], so a rejected save also erases purchases.
 *   2. Listing the old key SECOND recovers it completely, with tamper-evidence
 *      fully intact. This is why the field is comma-separated and why
 *      `.env.example` says "newest first".
 *
 * (2) is the entire reason (1) is survivable, and it is the thing to reach for
 * before considering anything that relaxes verification.
 *
 * No production code changes with this file. It documents behaviour that is
 * already there, which is precisely the point — `utils/saveSigningConfig.ts`
 * warns about rotation in prose, and prose is not a check.
 */

/**
 * `utils/saveValidation.ts` resolves its signing config at MODULE LOAD, so the
 * environment has to be set before the import. Each case re-imports in
 * isolation and restores the ambient env afterwards.
 */
const withEnv = async <T>(
  env: Record<string, string>,
  fn: (m: typeof import('@/utils/saveValidation')) => T,
): Promise<T> => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: 'production' }, env);
    let out: T;
    await jest.isolateModulesAsync(async () => {
      const mod = await import('@/utils/saveValidation');
      out = fn(mod);
    });
    return out!;
  } finally {
    // MUST be `finally`. A throw inside `fn` or the isolated import would
    // otherwise leak a mutated HMAC config into every later test in the file,
    // and the failure would surface somewhere unrelated.
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
};

const OLD_KEY = 'old-key-that-signed-every-shipped-save-0000';
const NEW_KEY = 'a-different-key-configured-later-11111111';

interface SerializedSave {
  data: string;
  checksum: string;
  hmac: string;
}

/** A save as written by a build running the given key. */
const makeSaveUnder = (key: string): Promise<SerializedSave> =>
  withEnv({ EXPO_PUBLIC_SAVE_HMAC_KEY: key }, (m) => {
    const data = JSON.stringify({ weeksLived: 42, money: 1234 });
    return { data, checksum: m.calculateChecksum(data), hmac: m.calculateHmacSignature(data) };
  });

describe('a save is rejected outright under a different key', () => {
  it('verifySaveData returns false — the save is lost, not degraded', async () => {
    const save = await makeSaveUnder(OLD_KEY);

    const ok = await withEnv({ EXPO_PUBLIC_SAVE_HMAC_KEY: NEW_KEY }, (m) =>
      m.verifySaveData(save.data, save.checksum, undefined, save.hmac));

    expect(ok).toBe(false);
  });

  it('even though the payload is completely intact (the control)', async () => {
    // The CRC32 still matches — nothing is corrupt. What cannot be proven is
    // authorship. That distinction is why a key change is unrecoverable
    // without the old key, and why it is not a data-corruption problem.
    const save = await makeSaveUnder(OLD_KEY);

    const checksumStillValid = await withEnv({ EXPO_PUBLIC_SAVE_HMAC_KEY: NEW_KEY }, (m) =>
      m.calculateChecksum(save.data) === save.checksum);

    expect(checksumStillValid).toBe(true);
  });
});

describe('listing the old key second recovers it', () => {
  it('accepts a save signed with either key', async () => {
    // The documented rotation form: `EXPO_PUBLIC_SAVE_HMAC_KEY="new,old"`.
    // First entry signs; every entry verifies. Old saves keep loading and
    // re-sign onto the current key the next time they are written.
    const oldSave = await makeSaveUnder(OLD_KEY);
    const newSave = await makeSaveUnder(NEW_KEY);
    const rotated = { EXPO_PUBLIC_SAVE_HMAC_KEY: `${NEW_KEY},${OLD_KEY}` };

    expect(await withEnv(rotated, (m) =>
      m.verifySaveData(oldSave.data, oldSave.checksum, undefined, oldSave.hmac))).toBe(true);
    expect(await withEnv(rotated, (m) =>
      m.verifySaveData(newSave.data, newSave.checksum, undefined, newSave.hmac))).toBe(true);
  });

  it('signs NEW saves with the first entry, not the old one (the control)', async () => {
    // If rotation signed with the trailing key, the list would never converge
    // and the old key could never be dropped.
    const underRotation = await withEnv(
      { EXPO_PUBLIC_SAVE_HMAC_KEY: `${NEW_KEY},${OLD_KEY}` },
      (m) => m.calculateHmacSignature('payload'),
    );
    const underNewOnly = await withEnv(
      { EXPO_PUBLIC_SAVE_HMAC_KEY: NEW_KEY },
      (m) => m.calculateHmacSignature('payload'),
    );

    expect(underRotation).toBe(underNewOnly);
  });

  it('rejects a tampered payload at the CHECKSUM layer (the control)', async () => {
    // Crude tampering: edit the payload, leave the checksum. Caught by CRC32
    // before signatures are considered at all.
    const save = await makeSaveUnder(OLD_KEY);
    const tampered = JSON.stringify({ weeksLived: 42, money: 999999999 });

    const ok = await withEnv({ EXPO_PUBLIC_SAVE_HMAC_KEY: `${NEW_KEY},${OLD_KEY}` }, (m) =>
      m.verifySaveData(tampered, save.checksum, undefined, save.hmac));

    expect(ok).toBe(false);
  });

  it('rejects a tampered payload at the HMAC layer, checksum recomputed', async () => {
    // The case that actually tests rotation's tamper-evidence, and the one the
    // check above CANNOT reach: recompute the CRC32 like a real editor would,
    // so verification gets past the checksum and has to rely on the signature.
    // Neither rotated key can produce this HMAC for this payload.
    //
    // The earlier version of this suite only had the checksum case, so it
    // passed for the wrong reason — it never exercised the multi-key path it
    // claimed to guard. Caught in review on PR #102.
    const save = await makeSaveUnder(OLD_KEY);
    const tampered = JSON.stringify({ weeksLived: 42, money: 999999999 });

    const ok = await withEnv({ EXPO_PUBLIC_SAVE_HMAC_KEY: `${NEW_KEY},${OLD_KEY}` }, (m) =>
      m.verifySaveData(tampered, m.calculateChecksum(tampered), undefined, save.hmac));

    expect(ok).toBe(false);
  });
});
