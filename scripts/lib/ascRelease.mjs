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
  'PROCESSING_FOR_DISTRIBUTION',
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

export const stateOf = (v) => v?.attributes?.appVersionState ?? v?.attributes?.appStoreVersionState ?? null;
const stringOf = (v) => v?.attributes?.versionString ?? null;

/** Apple's current API rejects the retired appStoreVersionState sparse field. */
export function fetchAppStoreVersions(client, appId, platform = 'IOS') {
  return client.getAll(
    `/v1/apps/${encodeURIComponent(appId)}/appStoreVersions?filter[platform]=${encodeURIComponent(platform)}` +
      '&fields[appStoreVersions]=versionString,appVersionState,createdDate&limit=200',
  );
}

/** Only publicly available versions may trigger a release announcement. */
export function liveAppStoreVersion(versions) {
  return highestReleasedVersion((versions ?? []).filter((v) =>
    ['READY_FOR_DISTRIBUTION', 'READY_FOR_SALE'].includes(stateOf(v))));
}

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
 * The locales this repo manages on the App Store record, mapped to their
 * What's New text. Two kinds of locale are left out, for different reasons:
 *
 *   - `shipped: false` (en-GB): reference only and never created, because
 *     those storefronts already fall back to en-US.
 *   - `pending: true` (a new language): real copy, but the language does not
 *     exist on the record yet, and this script writes only What's New. It
 *     cannot add a language, and a locale created with notes alone would have
 *     no name, description or keywords. Create it by hand (`npm run aso`
 *     prints the copy), then drop `pending` so later releases manage it.
 */
export function whatsNewByLocale(APPLE) {
  const out = {};
  if (APPLE?.whatsNew) out['en-US'] = APPLE.whatsNew;
  for (const [locale, loc] of Object.entries(APPLE?.localized ?? {})) {
    if (loc?.shipped === false || loc?.pending === true) continue;
    if (loc?.whatsNew) out[locale] = loc.whatsNew;
  }
  return out;
}

/** Locales whose copy is ready but which must be created by hand first. */
export function pendingLocales(APPLE) {
  return Object.entries(APPLE?.localized ?? {})
    .filter(([, loc]) => loc?.pending === true && loc?.shipped !== false)
    .map(([locale]) => locale);
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

// ---------------------------------------------------------------------------
// The full listing. What's New alone was the first version of this tool; the
// rest of the copy (description, keywords, promotional text, and the name and
// subtitle on App Information) lived in metadata.mjs but had to be retyped
// into the App Store Connect UI, so the repo and the store drifted apart.
// ---------------------------------------------------------------------------

/** Version-level copy, on appStoreVersionLocalizations. */
export const VERSION_FIELDS = ['description', 'keywords', 'promotionalText', 'whatsNew'];
/** App-level copy, on appInfoLocalizations (only editable while a version is). */
export const INFO_FIELDS = ['name', 'subtitle'];

/** Apple stores keywords as one comma-separated string; the repo keeps an array. */
export const keywordString = (k) => (Array.isArray(k) ? k.join(',') : k);

/**
 * @param {any} src
 * @param {string[]} fields
 * @returns {Record<string, string>}
 */
function pickFields(src, fields) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const f of fields) {
    const v = f === 'keywords' ? keywordString(src?.[f]) : src?.[f];
    if (typeof v === 'string' && v.length > 0) out[f] = v;
  }
  return out;
}

/**
 * Every locale this repo manages, with the copy for each object. Unlike
 * `whatsNewByLocale`, `pending` locales ARE included: this tool creates the
 * language (both the version localization and the App Information one), so
 * "create it by hand" no longer applies. `shipped: false` stays excluded.
 * A field the repo does not declare for a locale is left out, and therefore
 * left alone on Apple's side (es-MX has no localized name, for instance).
 */
/**
 * @param {any} APPLE
 * @returns {Record<string, { version: Record<string, string>, info: Record<string, string> }>}
 */
export function listingByLocale(APPLE) {
  /** @type {Record<string, { version: Record<string, string>, info: Record<string, string> }>} */
  const out = {};
  if (APPLE) {
    out['en-US'] = { version: pickFields(APPLE, VERSION_FIELDS), info: pickFields(APPLE, INFO_FIELDS) };
  }
  for (const [locale, loc] of Object.entries(APPLE?.localized ?? {})) {
    if (loc?.shipped === false) continue;
    out[locale] = { version: pickFields(loc, VERSION_FIELDS), info: pickFields(loc, INFO_FIELDS) };
  }
  return out;
}

/**
 * Generic per-locale plan for one localization type. Only fields whose stored
 * value differs are sent, so a second run is a no-op and an update never
 * rewrites a field the repo did not change.
 *
 * @param {{ existing: any[], desired: Record<string, Record<string,string>> }} input
 */
export function planFieldLocalizations({ existing, desired }) {
  const ops = [];
  const byLocale = new Map((existing ?? []).map((l) => [l?.attributes?.locale, l]));
  for (const [locale, attrs] of Object.entries(desired ?? {})) {
    if (!attrs || Object.keys(attrs).length === 0) continue;
    const found = byLocale.get(locale);
    if (!found) {
      ops.push({ op: 'create', locale, attributes: { ...attrs } });
      continue;
    }
    const changes = {};
    for (const [k, v] of Object.entries(attrs)) {
      if ((found.attributes?.[k] ?? '') !== v) changes[k] = v;
    }
    if (Object.keys(changes).length === 0) ops.push({ op: 'unchanged', locale, id: found.id });
    else ops.push({ op: 'update', locale, id: found.id, attributes: changes });
  }
  for (const [locale] of byLocale) {
    if (!(locale in (desired ?? {}))) ops.push({ op: 'skip-unmanaged', locale });
  }
  return ops;
}

/** appInfos states in which name and subtitle can still be edited. */
export const EDITABLE_INFO_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]);

/** The App Information record that belongs to the version being prepared, or null. */
export function pickEditableAppInfo(appInfos) {
  return (appInfos ?? []).find((i) => {
    const s = i?.attributes?.state ?? i?.attributes?.appStoreState;
    return s && EDITABLE_INFO_STATES.has(s);
  }) ?? null;
}

export function versionLocalizationCreatePayload({ versionId, locale, attributes }) {
  return {
    data: {
      type: 'appStoreVersionLocalizations',
      attributes: { locale, ...attributes },
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: String(versionId) } } },
    },
  };
}

export function versionLocalizationUpdatePayload({ id, attributes }) {
  return { data: { type: 'appStoreVersionLocalizations', id: String(id), attributes: { ...attributes } } };
}

export function infoLocalizationCreatePayload({ appInfoId, locale, attributes }) {
  return {
    data: {
      type: 'appInfoLocalizations',
      attributes: { locale, ...attributes },
      relationships: { appInfo: { data: { type: 'appInfos', id: String(appInfoId) } } },
    },
  };
}

export function infoLocalizationUpdatePayload({ id, attributes }) {
  return { data: { type: 'appInfoLocalizations', id: String(id), attributes: { ...attributes } } };
}
