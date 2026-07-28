/**
 * Identity & Body — public surface.
 *
 * Everything exported here is pure data or a pure function. The 3D renderer
 * lives in `components/identity/` and imports FROM this module; nothing in this
 * module imports React, react-native, expo-gl or three. That separation is what
 * keeps the chapter fully unit-testable on a machine with no GPU, and what
 * guarantees a device that cannot initialise a GL context still simulates every
 * body, style and procedure correctly.
 */

export * from './types';
export * from './faceGenome';
export * from './body';
export * from './style';
export * from './regimen';
export * from './presence';
export * from './procedures';

import { normalizeGenome, randomizeFace } from './faceGenome';
import { createBody, normalizeBody } from './body';
import { createStyle, normalizeStyle } from './style';
import { createRegimen, normalizeRegimen } from './regimen';
import type { CosmeticProcedureRecord, Identity } from './types';

/** A complete identity for a newly created character. */
export function createIdentity(seed: string, sex: string, age: number): Identity {
  return {
    face: randomizeFace(seed, { sex }),
    body: createBody(seed, sex, age),
    style: createStyle(),
    regimen: createRegimen(),
    procedures: [],
  };
}

/**
 * Largest stored portrait, in characters of its data URI.
 *
 * Mirrors `PORTRAIT_MAX_BYTES` in `FaceCanvas`, deliberately as a separate
 * constant rather than an import: this module is the SAVE path and must not
 * depend on a React component to decide whether a save is loadable. Capture
 * bounds what this app writes; this bounds what it will accept from anywhere.
 */
export const MAX_PORTRAIT_BYTES = 512 * 1024;

/**
 * Force anything into a valid `Identity`.
 *
 * The single entry point used by the save migration, `repairGameState` and the
 * context loader. Having one function means a corrupt or partial identity can
 * only be repaired one way, so the three call sites cannot drift apart — which
 * is exactly the failure the save-system auditor exists to catch.
 */
export function normalizeIdentity(
  input: Partial<Identity> | null | undefined,
  seed = 'player',
  sex = 'male',
  age = 18,
): Identity {
  if (!input || typeof input !== 'object') {
    return createIdentity(seed, sex, age);
  }
  const procedures: CosmeticProcedureRecord[] = Array.isArray(input.procedures)
    ? input.procedures.filter(
        (r): r is CosmeticProcedureRecord =>
          !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.week === 'number',
      )
    : [];

  const identity: Identity = {
    face: normalizeGenome(input.face, seed),
    body: input.body ? normalizeBody(input.body) : createBody(seed, sex, age),
    style: normalizeStyle(input.style),
    regimen: normalizeRegimen(input.regimen),
    procedures,
  };

  // A portrait is only carried over when it is actually a data URI. A stale
  // file:// path from a reinstalled app points at nothing, and rendering it
  // yields a blank circle with no way to recover — dropping it falls back to the
  // portrait pool, which always renders something.
  //
  // And only when it is a SANE SIZE. The capture bounds its own resolution, but
  // this function is also the door for saves written by an older build, restored
  // from a backup, or edited by hand — and an oversized portrait is the one field
  // that can make a save unwritable forever. `pruneSaveData` trims arrays only,
  // so it cannot shrink this; the save exceeds `MAX_SAVE_SIZE`, survives both
  // prune passes, and `saveQueue` throws. Dropping it here costs a custom face
  // and rescues the run.
  if (
    typeof input.portraitUri === 'string'
    && input.portraitUri.startsWith('data:image')
    && input.portraitUri.length <= MAX_PORTRAIT_BYTES
  ) {
    identity.portraitUri = input.portraitUri;
    if (typeof input.portraitWeek === 'number' && isFinite(input.portraitWeek)) {
      identity.portraitWeek = input.portraitWeek;
    }
  }

  return identity;
}
export * from './faceProportions';
export * from './hairSpec';
export * from './headMesh';
export * from './morphBinding';
