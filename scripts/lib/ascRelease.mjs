// scripts/lib/ascRelease.mjs
//
// The decisions and payloads behind `scripts/asc-release.mjs`, kept pure so
// they can be tested without credentials or a network. The CLI is the shell:
// everything that decides whether a write is SAFE lives here.
//
// A store listing is split across TWO App Store Connect resources, and the
// split is not where you would guess. Anything that can differ per RELEASE
// lives on `appStoreVersionLocalizations` (description, keywords, promotional
// text, What's New, the support and marketing URLs). Anything that belongs to
// the APP rather than to one of its versions lives on `appInfoLocalizations`
// (name, subtitle, privacy policy URL). Writing the whole listing therefore
// means planning against both, which is why every planner here is written
// once and used twice.

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
 * States that mean a version reached, or is on its way to, the public store.
 * These are what a new version number has to beat — Apple's only real rule
 * about the version record is that it climbs past the last one that counts.
 *
 * Apple renamed several of these when `AppStoreVersionState` was deprecated in
 * favour of `AppVersionState`: READY_FOR_SALE became READY_FOR_DISTRIBUTION and
 * PROCESSING_FOR_APP_STORE became PROCESSING_FOR_DISTRIBUTION. Both spellings
 * are listed because an account can return either depending on when the version
 * shipped, and reading only the modern one would silently under-read the floor
 * — which is the failure that lets a number walk backwards.
 *
 * ACCEPTED is here deliberately: it has passed review and is going live, so the
 * number is spoken for even though nothing is public yet.
 */
export const RELEASED_STATES = new Set([
  'READY_FOR_SALE',
  'READY_FOR_DISTRIBUTION',
  'PENDING_APPLE_RELEASE',
  'PENDING_DEVELOPER_RELEASE',
  'PROCESSING_FOR_APP_STORE',
  'PROCESSING_FOR_DISTRIBUTION',
  'ACCEPTED',
  'REPLACED_WITH_NEW_VERSION',
  'REMOVED_FROM_SALE',
  'DEVELOPER_REMOVED_FROM_SALE',
]);

/**
 * The fields this repo owns on each resource, in the order they are reported.
 *
 * A field NOT listed here is Apple's or the owner's — `privacyChoicesUrl`,
 * age ratings, pricing — and is never read, written or diffed. A field listed
 * here but absent from `metadata.mjs` is still not written: the planner omits
 * undefined rather than sending an empty string, because an empty string is a
 * real value to Apple and would blank a field that someone filled in the UI.
 */
export const MANAGED_VERSION_FIELDS = [
  'description',
  'keywords',
  'promotionalText',
  'whatsNew',
  'supportUrl',
  'marketingUrl',
];

export const MANAGED_APP_INFO_FIELDS = ['name', 'subtitle', 'privacyPolicyUrl'];

/**
 * Apple's keyword field is ONE string, comma-separated with no spaces — a
 * space after a comma costs a character and buys nothing. `metadata.mjs` keeps
 * the terms as an array so they can be counted, deduplicated and diffed
 * individually; this is the one place that becomes the wire format.
 */
export function keywordField(keywords) {
  return (keywords ?? []).join(',');
}

/**
 * Attributes to write, keyed by locale then by field. Named so the maps this
 * module hands back are typed rather than inferred as `{}`, which makes every
 * `listing.versionLocalizations['en-US']` in a test an implicit-any error.
 *
 * @typedef {Record<string, Record<string, string>>} LocalizedAttributes
 */

/** Drops undefined/null entries. See MANAGED_VERSION_FIELDS on why that matters. */
function defined(object) {
  return Object.fromEntries(Object.entries(object ?? {}).filter(([, v]) => v !== undefined && v !== null));
}

/**
 * Turns `marketing/aso/metadata.mjs` into the exact attributes each locale
 * should carry on each resource. Pure, so a test can assert the mapping
 * without a network — and so the CLI never decides what the copy IS.
 *
 * Two rules are encoded here rather than left to the caller:
 *
 * - A locale marked `shipped: false` (en-GB) is not part of the listing at
 *   all. Those storefronts already fall back to en-US, so creating it would
 *   produce a second identical listing to maintain forever.
 * - The app NAME is the brand and is deliberately not translated, but Apple
 *   requires a name on every appInfo localization it creates. The en-US name
 *   carries into each locale unless that locale states its own.
 *
 * @param {Record<string, any>} APPLE the APPLE export of marketing/aso/metadata.mjs
 * @returns {{ versionLocalizations: LocalizedAttributes, appInfoLocalizations: LocalizedAttributes }}
 */
export function desiredListing(APPLE) {
  const urls = APPLE?.urls ?? {};
  /** @type {LocalizedAttributes} */
  const versionLocalizations = {};
  /** @type {LocalizedAttributes} */
  const appInfoLocalizations = {};

  const add = (locale, source, fallback = {}) => {
    versionLocalizations[locale] = defined({
      description: source.description,
      keywords: source.keywords ? keywordField(source.keywords) : undefined,
      promotionalText: source.promotionalText,
      whatsNew: source.whatsNew,
      supportUrl: source.supportUrl ?? fallback.supportUrl,
      marketingUrl: source.marketingUrl ?? fallback.marketingUrl,
    });
    appInfoLocalizations[locale] = defined({
      name: source.name ?? fallback.name,
      subtitle: source.subtitle,
      privacyPolicyUrl: source.privacyPolicyUrl ?? fallback.privacyPolicyUrl,
    });
  };

  const shared = {
    name: APPLE?.name,
    supportUrl: urls.support,
    marketingUrl: urls.marketing,
    privacyPolicyUrl: urls.privacyPolicy,
  };

  add('en-US', APPLE ?? {}, shared);

  for (const [locale, loc] of Object.entries(APPLE?.localized ?? {})) {
    if (loc?.shipped === false) continue;
    add(locale, loc ?? {}, shared);
  }

  return { versionLocalizations, appInfoLocalizations };
}

/**
 * Narrows a desired listing to a subset of fields.
 *
 * The listing is written as ONE thing by default, which is right for a release
 * — but not every change is a release. Release notes go out with every build;
 * the app NAME is a decision that costs a review cycle and dilutes a brand, and
 * promotional text is the one field Apple lets you change any time. Sending all
 * three because you wanted one of them is how an unrelated decision rides along
 * with a routine push.
 *
 * A locale left with no fields at all is dropped rather than sent empty: a
 * create with only a `locale` attribute would make an empty listing, and an
 * update with nothing in it is a request that changes nothing.
 *
 * Returns { listing, unknown } — an unrecognised field name is reported rather
 * than silently narrowing to nothing, because "--only whatsnew" quietly writing
 * zero fields and reporting success is the worst outcome available.
 *
 * @param {{ versionLocalizations: LocalizedAttributes, appInfoLocalizations: LocalizedAttributes }} listing
 * @param {string[]} [fields]
 * @returns {{ listing: { versionLocalizations: LocalizedAttributes, appInfoLocalizations: LocalizedAttributes }, unknown: string[] }}
 */
export function restrictListing(listing, fields) {
  const wanted = (fields ?? []).map((f) => String(f).trim()).filter(Boolean);
  if (wanted.length === 0) return { listing, unknown: [] };

  const known = new Set([...MANAGED_VERSION_FIELDS, ...MANAGED_APP_INFO_FIELDS]);
  const unknown = wanted.filter((f) => !known.has(f));
  const keep = new Set(wanted);

  const narrow = (byLocale) => {
    /** @type {LocalizedAttributes} */
    const out = {};
    for (const [locale, attributes] of Object.entries(byLocale ?? {})) {
      const kept = Object.fromEntries(Object.entries(attributes).filter(([field]) => keep.has(field)));
      if (Object.keys(kept).length > 0) out[locale] = kept;
    }
    return out;
  };

  return {
    listing: {
      versionLocalizations: narrow(listing.versionLocalizations),
      appInfoLocalizations: narrow(listing.appInfoLocalizations),
    },
    unknown,
  };
}

/**
 * States where Apple HAS the version and has not finished with it.
 *
 * A version in any of these is neither editable nor done, and App Store Connect
 * will not open a new version alongside it — the "+ Version" button is not
 * there. Creating one anyway is a 409, which is why this set exists separately
 * from RELEASED_STATES: the two answer different questions. RELEASED_STATES
 * asks "what number must I beat"; this asks "may I open a new one at all".
 * A state can honestly be in both — a version pending release is both a floor
 * to clear and a reason not to start another.
 */
export const IN_FLIGHT_STATES = new Set([
  'READY_FOR_REVIEW',
  'WAITING_FOR_EXPORT_COMPLIANCE',
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'ACCEPTED',
  'PENDING_APPLE_RELEASE',
  'PENDING_DEVELOPER_RELEASE',
  'PROCESSING_FOR_APP_STORE',
  'PROCESSING_FOR_DISTRIBUTION',
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

/**
 * A version's state. `appVersionState` is the current attribute and
 * `appStoreState` the deprecated one an older record can still carry.
 *
 * There is NO `appStoreVersionState` attribute and there never was — that is
 * the name of the deprecated enum TYPE, not of a field. This function used to
 * read it first, and the sparse fieldset on the request asked Apple for it by
 * name, which answers with `HTTP 400: 'appStoreVersionState' is not a valid
 * field name` on the very first read. The `??` fallback hid it here while the
 * request made every real run fail.
 */
const stateOf = (v) => v?.attributes?.appVersionState ?? v?.attributes?.appStoreState ?? null;
const stringOf = (v) => v?.attributes?.versionString ?? null;

/**
 * An appInfo's editability. `state` is the current attribute and
 * `appStoreState` the one older records carry; an account can hold both
 * spellings at once, so both are read rather than assuming a migration.
 */
export const appInfoStateOf = (a) => a?.attributes?.state ?? a?.attributes?.appStoreState ?? null;

/** Exposed so the CLI and its tests read a version's state exactly one way. */
export const versionStateOf = stateOf;

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
 *   { action: 'retarget', version, from }    — an editable record exists under
 *                                              a DIFFERENT number; renumber it
 *   { action: 'refuse', reason }             — exists but must not be touched,
 *                                              or the number does not climb
 *
 * The retarget case is the one that is not obvious. App Store Connect holds at
 * most ONE editable version per platform, so asking to create 1.6.0 while a
 * 1.5.0 draft is open is not a new record — it is a 409 from Apple and a trip
 * to the UI to fix by hand, which is the thing this script exists to remove.
 * Renumbering that draft is a single documented PATCH, and it still has to
 * clear the climb rule, so it cannot be used to walk a number backwards.
 */
export function planVersionRecord({ versions, versionString, retarget = false }) {
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
        `Version ${versionString} does not beat the highest version that has reached the store (${highest}). ` +
        `App Store version numbers can only climb; pick a number above ${highest}.`,
    };
  }

  // Apple will not open a new version while one is with review. This is the
  // same shape as the open-draft refusal below and was found the same way: a
  // plan run reported CREATE 1.6.0 against an account whose 1.5.5 was
  // WAITING_FOR_REVIEW, which Apple would have answered with a 409.
  const inFlight = (versions ?? []).find((v) => IN_FLIGHT_STATES.has(stateOf(v)));
  if (inFlight) {
    return {
      action: 'refuse',
      reason:
        `Version ${stringOf(inFlight)} is ${stateOf(inFlight)}, so App Store Connect will not open ` +
        `${versionString} alongside it. Wait for it to be released or removed from review, or — if ` +
        `${stringOf(inFlight)} is the release you meant — leave the metadata for it alone, because a ` +
        `version with Apple is not editable.`,
    };
  }

  const openDraft = (versions ?? []).find((v) => EDITABLE_STATES.has(stateOf(v)));
  if (openDraft) {
    const from = stringOf(openDraft);
    if (!retarget) {
      return {
        action: 'refuse',
        reason:
          `An editable version record already exists (${from}, ${stateOf(openDraft)}), and App Store Connect allows ` +
          `only one at a time — creating ${versionString} would be rejected by Apple. Either release against ${from} ` +
          `(--version ${from}) or renumber that draft to ${versionString} (--retarget).`,
      };
    }
    return { action: 'retarget', version: openDraft, from, to: versionString, state: stateOf(openDraft), highestReleased: highest };
  }

  return { action: 'create', highestReleased: highest };
}

/**
 * Decides which appInfo record carries the editable name and subtitle.
 *
 * An app has one appInfo per lifecycle state: the live one, and — once a
 * version is being prepared — an editable one. Writing the name onto the live
 * record is not a thing Apple permits, so picking the wrong one is a 409 at
 * best and an edit to a public listing at worst.
 */
export function planAppInfo(appInfos) {
  const list = appInfos ?? [];
  if (list.length === 0) {
    return { action: 'refuse', reason: 'App Store Connect returned no appInfo records for this app, so there is nowhere to write the name and subtitle.' };
  }
  const editable = list.find((a) => EDITABLE_STATES.has(appInfoStateOf(a)));
  if (!editable) {
    return {
      action: 'refuse',
      reason:
        `No editable appInfo (states: ${list.map((a) => appInfoStateOf(a) ?? '?').join(', ')}). ` +
        `The name, subtitle and privacy URL can only be changed while a version is being prepared for submission.`,
    };
  }
  return { action: 'use', appInfo: editable, state: appInfoStateOf(editable) };
}

/**
 * Decides, per locale, which FIELDS need writing on a localization.
 *
 * One planner for both resources: `appStoreVersionLocalizations` and
 * `appInfoLocalizations` differ only in which attributes they carry and which
 * endpoint they are posted to, and duplicating this logic is how the two
 * halves of a listing drift apart.
 *
 * Idempotence lives here: a locale whose stored attributes already equal the
 * intended ones produces no operation at all, so a second run is a no-op
 * rather than a redundant PATCH — which matters because a PATCH that changes
 * nothing still resets the field's "edited" state in App Store Connect.
 */
export function planLocalizations({ existingLocalizations, desiredByLocale }) {
  const ops = [];
  const byLocale = new Map(
    (existingLocalizations ?? [])
      .filter((l) => l?.attributes?.locale)
      .map((l) => [l.attributes.locale, l]),
  );

  for (const [locale, wanted] of Object.entries(desiredByLocale ?? {})) {
    const attributes = defined(wanted);
    const existing = byLocale.get(locale);

    if (!existing) {
      ops.push({
        op: 'create',
        locale,
        attributes,
        changes: Object.entries(attributes).map(([field, to]) => ({ field, from: null, to })),
      });
      continue;
    }

    const changes = [];
    for (const [field, to] of Object.entries(attributes)) {
      const from = existing.attributes?.[field] ?? null;
      if ((from ?? '') !== to) changes.push({ field, from, to });
    }

    if (changes.length === 0) {
      ops.push({ op: 'unchanged', locale, id: existing.id });
      continue;
    }

    ops.push({
      op: 'update',
      locale,
      id: existing.id,
      attributes: Object.fromEntries(changes.map((c) => [c.field, c.to])),
      changes,
    });
  }

  // A locale that exists on the listing but has no copy here is left alone.
  // This script owns the locales the repo declares; it does not get to delete
  // a listing someone added in the App Store Connect UI.
  for (const [locale] of byLocale) {
    if (!(locale in (desiredByLocale ?? {}))) {
      ops.push({ op: 'skip-unmanaged', locale });
    }
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Payload builders. Shapes verified against Apple's documentation JSON, not
// from memory — `whatsNew`, `description`, `keywords`, `promotionalText`,
// `supportUrl` and `marketingUrl` are attributes of
// appStoreVersionLocalizations; `name`, `subtitle` and `privacyPolicyUrl` are
// attributes of appInfoLocalizations; and there is no `releaseNotes` anywhere.
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

/** Renumbers an existing editable version record. See planVersionRecord. */
export function versionRenumberPayload({ versionId, versionString }) {
  return {
    data: { type: 'appStoreVersions', id: String(versionId), attributes: { versionString } },
  };
}

export function versionLocalizationCreatePayload({ versionId, locale, attributes }) {
  return {
    data: {
      type: 'appStoreVersionLocalizations',
      attributes: { locale, ...defined(attributes) },
      relationships: {
        appStoreVersion: { data: { type: 'appStoreVersions', id: String(versionId) } },
      },
    },
  };
}

export function versionLocalizationUpdatePayload({ id, attributes }) {
  return {
    data: { type: 'appStoreVersionLocalizations', id: String(id), attributes: defined(attributes) },
  };
}

export function appInfoLocalizationCreatePayload({ appInfoId, locale, attributes }) {
  return {
    data: {
      type: 'appInfoLocalizations',
      attributes: { locale, ...defined(attributes) },
      relationships: {
        appInfo: { data: { type: 'appInfos', id: String(appInfoId) } },
      },
    },
  };
}

export function appInfoLocalizationUpdatePayload({ id, attributes }) {
  return {
    data: { type: 'appInfoLocalizations', id: String(id), attributes: defined(attributes) },
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
