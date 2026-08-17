// scripts/lib/ascRelease.mjs
//
// The decisions and payloads behind `scripts/asc-release.mjs`, kept pure so
// they can be tested without credentials or a network. The CLI is the shell:
// everything that decides whether a write is SAFE lives here.

/**
 * States in which App Store Connect still lets you edit a version's metadata.
 * Anything else is either in front of Apple or already public, and writing to
 * it either fails or silently edits a live listing.
 */
export const EDITABLE_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'METADATA_REJECTED',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'INVALID_BINARY',
]);

/**
 * States that mean a version reached (or is reaching) the public store. These
 * are what a new version number has to beat — Apple's only real rule about the
 * version record is that it climbs past the last RELEASED one.
 *
 * READY_FOR_SALE is the historical name and READY_FOR_DISTRIBUTION the current
 * one; both appear on live apps depending on when the version shipped, so both
 * are listed rather than assuming the account has been migrated.
 */
export const RELEASED_STATES = new Set([
  'READY_FOR_SALE',
  'READY_FOR_DISTRIBUTION',
  'PENDING_APPLE_RELEASE',
  'PENDING_DEVELOPER_RELEASE',
  'PROCESSING_FOR_APP_STORE',
  'REPLACED_WITH_NEW_VERSION',
  'REMOVED_FROM_SALE',
  'DEVELOPER_REMOVED_FROM_SALE',
]);

/**
 * Compares two store version strings numerically, component by component.
 * Returns <0, 0 or >0.
 *
 * Not a semver library: App Store version records are plain numeric dotted
 * strings with no pre-release or build metadata, and a missing component reads
 * as 0 so "1.5" and "1.5.0" compare equal, which is how Apple treats them.
 */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** True for a plain numeric dotted version, which is all Apple accepts. */
export function isValidVersionString(v) {
  return /^\d+(\.\d+){0,2}$/.test(String(v ?? ''));
}

const stateOf = (v) => v?.attributes?.appStoreVersionState ?? v?.attributes?.appVersionState ?? null;
const stringOf = (v) => v?.attributes?.versionString ?? null;

/** The highest version that has reached the public store, or null. */
export function highestReleasedVersion(versions) {
  let best = null;
  for (const v of versions ?? []) {
    if (!RELEASED_STATES.has(stateOf(v))) continue;
    const s = stringOf(v);
    if (!s) continue;
    if (best === null || compareVersions(s, best) > 0) best = s;
  }
  return best;
}

/** An existing record with this exact version string, or null. */
export function findVersion(versions, versionString) {
  return (versions ?? []).find((v) => stringOf(v) === versionString) ?? null;
}

/**
 * Decides what to do about the version record itself, WITHOUT performing it.
 *
 * Returns one of:
 *   { action: 'create' }                     — no such record yet
 *   { action: 'reuse', version }             — exists and is still editable
 *   { action: 'refuse', reason }             — exists but must not be touched,
 *                                              or the number does not climb
 */
export function planVersionRecord({ versions, versionString }) {
  if (!isValidVersionString(versionString)) {
    return { action: 'refuse', reason: `"${versionString}" is not a valid App Store version string (digits and dots only).` };
  }

  const existing = findVersion(versions, versionString);
  if (existing) {
    const state = stateOf(existing);
    if (!EDITABLE_STATES.has(state)) {
      return {
        action: 'refuse',
        reason:
          `Version ${versionString} already exists and is in state ${state}, which is not editable. ` +
          `Editing it here would either fail at Apple or change a listing that is already in review or live.`,
      };
    }
    return { action: 'reuse', version: existing, state };
  }

  // Only enforce the climb when creating. An existing editable record has
  // already been accepted by Apple, so re-deriving the rule against it would
  // refuse work on a record the owner deliberately made.
  const highest = highestReleasedVersion(versions);
  if (highest && compareVersions(versionString, highest) <= 0) {
    return {
      action: 'refuse',
      reason:
        `Version ${versionString} does not beat the highest released version (${highest}). ` +
        `App Store version numbers can only climb; pick a number above ${highest}.`,
    };
  }

  return { action: 'create', highestReleased: highest };
}

/**
 * Decides, per locale, whether What's New needs writing.
 *
 * Idempotence lives here: a locale whose stored text already equals the
 * intended text produces no operation at all, so a second run is a no-op
 * rather than a redundant PATCH.
 */
export function planLocalizations({ existingLocalizations, whatsNewByLocale }) {
  const ops = [];
  const byLocale = new Map(
    (existingLocalizations ?? []).map((l) => [l?.attributes?.locale, l]),
  );

  for (const [locale, whatsNew] of Object.entries(whatsNewByLocale ?? {})) {
    const existing = byLocale.get(locale);
    if (!existing) {
      ops.push({ op: 'create', locale, whatsNew });
      continue;
    }
    if ((existing.attributes?.whatsNew ?? '') === whatsNew) {
      ops.push({ op: 'unchanged', locale, id: existing.id });
      continue;
    }
    ops.push({ op: 'update', locale, id: existing.id, whatsNew, previous: existing.attributes?.whatsNew ?? '' });
  }

  // A locale that exists on the version but has no copy here is left alone.
  // This script owns the locales the repo declares; it does not get to delete
  // a listing someone added in the App Store Connect UI.
  for (const [locale] of byLocale) {
    if (!(locale in (whatsNewByLocale ?? {}))) {
      ops.push({ op: 'skip-unmanaged', locale });
    }
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Payload builders. Shapes verified against Apple's documentation JSON, not
// from memory — `whatsNew` is an attribute of appStoreVersionLocalizations and
// there is no `releaseNotes` on appStoreVersions.
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   appId: string | number,
 *   versionString: string,
 *   platform?: string,
 *   copyright?: string,
 *   releaseType?: string,
 * }} options
 */
export function versionCreatePayload({ appId, versionString, platform = 'IOS', copyright, releaseType }) {
  const attributes = { versionString, platform };
  if (copyright) attributes.copyright = copyright;
  if (releaseType) attributes.releaseType = releaseType;
  return {
    data: {
      type: 'appStoreVersions',
      attributes,
      relationships: { app: { data: { type: 'apps', id: String(appId) } } },
    },
  };
}

export function localizationCreatePayload({ versionId, locale, whatsNew }) {
  return {
    data: {
      type: 'appStoreVersionLocalizations',
      attributes: { locale, whatsNew },
      relationships: {
        appStoreVersion: { data: { type: 'appStoreVersions', id: String(versionId) } },
      },
    },
  };
}

export function localizationUpdatePayload({ id, whatsNew }) {
  return {
    data: { type: 'appStoreVersionLocalizations', id: String(id), attributes: { whatsNew } },
  };
}

export function attachBuildPayload({ versionId, buildId }) {
  return {
    data: {
      type: 'appStoreVersions',
      id: String(versionId),
      relationships: { build: { data: { type: 'builds', id: String(buildId) } } },
    },
  };
}

// The 3-step review flow. `appStoreVersionSubmissions` is deprecated and gone
// from the current documentation; these three replace it.

export function reviewSubmissionCreatePayload({ appId, platform = 'IOS' }) {
  return {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform },
      relationships: { app: { data: { type: 'apps', id: String(appId) } } },
    },
  };
}

export function reviewSubmissionItemCreatePayload({ submissionId, versionId }) {
  return {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: String(submissionId) } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: String(versionId) } },
      },
    },
  };
}

export function reviewSubmissionSubmitPayload({ submissionId }) {
  return {
    data: { type: 'reviewSubmissions', id: String(submissionId), attributes: { submitted: true } },
  };
}
