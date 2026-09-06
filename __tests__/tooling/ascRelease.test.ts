/**
 * The App Store Connect release automation.
 *
 * This is the one script in the repo that writes to a LIVE store listing, so
 * what is pinned here is mostly the refusals. Three of them matter:
 *
 *  1. A version number that does not beat the last RELEASED one must be
 *     refused. Store version numbers can only ever climb, so a bad create is
 *     not a mistake you undo — CLAUDE.md §9 calls it a one-way door.
 *  2. A version already in review or already public must not be edited.
 *  3. Nothing writes without --apply, and the dry run has to record the exact
 *     requests it would have sent. A "safe by default" that silently does
 *     nothing in apply mode would be worse than no guard.
 *
 * The payload shapes are pinned because they were verified against Apple's
 * documentation JSON rather than recalled: `whatsNew` is an attribute of
 * appStoreVersionLocalizations, and appStoreVersions has no `releaseNotes`.
 */

import crypto from 'node:crypto';

type AscRelease = typeof import('../../scripts/lib/ascRelease.mjs');
type AscClientModule = typeof import('../../scripts/lib/ascClient.mjs');

let R: AscRelease;
let C: AscClientModule;

beforeAll(async () => {
  R = await import('../../scripts/lib/ascRelease.mjs');
  C = await import('../../scripts/lib/ascClient.mjs');
});

// `appVersionState` is the attribute Apple actually returns. These fixtures
// used to say `appStoreVersionState`, which is the deprecated ENUM's name and
// has never been a field — the same wrong belief the code held, so the suite
// was green while every real run failed on the first read with HTTP 400.
const version = (versionString: string, appVersionState: string, id = versionString) => ({
  id,
  type: 'appStoreVersions',
  attributes: { versionString, appVersionState },
});

describe('version ordering', () => {
  it('compares component by component, not as strings', () => {
    // The string comparison this replaces reads "1.10.0" as lower than "1.9.0".
    expect(R.compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(R.compareVersions('1.5.0', '1.5.0')).toBe(0);
    expect(R.compareVersions('1.4.9', '1.5.0')).toBeLessThan(0);
  });

  it('treats a missing component as zero, the way Apple does', () => {
    expect(R.compareVersions('1.5', '1.5.0')).toBe(0);
    expect(R.compareVersions('2', '1.9.9')).toBeGreaterThan(0);
  });

  it('accepts only plain numeric dotted versions', () => {
    expect(R.isValidVersionString('1.5.0')).toBe(true);
    expect(R.isValidVersionString('1.5')).toBe(true);
    expect(R.isValidVersionString('1.5.0-beta')).toBe(false);
    expect(R.isValidVersionString('v1.5.0')).toBe(false);
    expect(R.isValidVersionString('')).toBe(false);
  });
});

describe('reading a version\'s state, which Apple has renamed', () => {
  it('reads appVersionState, the attribute that actually exists', () => {
    expect(R.versionStateOf({ attributes: { appVersionState: 'PREPARE_FOR_SUBMISSION' } })).toBe('PREPARE_FOR_SUBMISSION');
  });

  it('still reads the deprecated appStoreState an older record can carry', () => {
    expect(R.versionStateOf({ attributes: { appStoreState: 'READY_FOR_SALE' } })).toBe('READY_FOR_SALE');
  });

  it('does NOT read appStoreVersionState - it is an enum name, not a field', () => {
    // Asking Apple for it by name in a sparse fieldset is an HTTP 400 on the
    // first read, which is exactly how this shipped.
    expect(R.versionStateOf({ attributes: { appStoreVersionState: 'READY_FOR_SALE' } })).toBeNull();
  });

  it('counts both spellings of the renamed released states', () => {
    // READY_FOR_SALE -> READY_FOR_DISTRIBUTION and
    // PROCESSING_FOR_APP_STORE -> PROCESSING_FOR_DISTRIBUTION. Reading only the
    // modern spelling under-reads the floor, which is how a number walks back.
    for (const state of ['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION', 'PROCESSING_FOR_APP_STORE', 'PROCESSING_FOR_DISTRIBUTION', 'ACCEPTED']) {
      expect(`${state}: ${R.RELEASED_STATES.has(state)}`).toBe(`${state}: true`);
    }
  });
});

describe('finding the highest released version', () => {
  it('ignores versions that never reached the store', () => {
    const versions = [
      version('1.3.5', 'READY_FOR_SALE'),
      version('9.9.9', 'PREPARE_FOR_SUBMISSION'), // drafted, never shipped
      version('1.4.0', 'DEVELOPER_REJECTED'),
    ];
    expect(R.highestReleasedVersion(versions)).toBe('1.3.5');
  });

  it('counts the modern READY_FOR_DISTRIBUTION as released', () => {
    // Apple renamed READY_FOR_SALE; live apps carry both depending on when the
    // version shipped, so missing the new name would under-read the floor.
    expect(R.highestReleasedVersion([version('1.4.0', 'READY_FOR_DISTRIBUTION')])).toBe('1.4.0');
  });

  it('returns null when nothing has shipped', () => {
    expect(R.highestReleasedVersion([version('1.0.0', 'PREPARE_FOR_SUBMISSION')])).toBeNull();
    expect(R.highestReleasedVersion([])).toBeNull();
  });
});

describe('planning the version record', () => {
  it('creates when the number beats the last released one', () => {
    const plan = R.planVersionRecord({
      versions: [version('1.3.5', 'READY_FOR_SALE')],
      versionString: '1.5.0',
    });
    expect(plan.action).toBe('create');
    expect(plan.highestReleased).toBe('1.3.5');
  });

  it('REFUSES a number that does not climb past the last released one', () => {
    const plan = R.planVersionRecord({
      versions: [version('1.5.0', 'READY_FOR_SALE')],
      versionString: '1.4.0',
    });
    expect(plan.action).toBe('refuse');
    expect(plan.reason).toMatch(/does not beat the highest version that has reached the store \(1\.5\.0\)/);
  });

  it('REFUSES an equal number - climbing means strictly greater', () => {
    const plan = R.planVersionRecord({
      versions: [version('1.5.0', 'READY_FOR_SALE'), version('1.5.0', 'READY_FOR_SALE', 'dup')],
      versionString: '1.5.0',
    });
    expect(plan.action).toBe('refuse');
  });

  it('reuses an existing record that is still editable', () => {
    const draft = version('1.5.0', 'PREPARE_FOR_SUBMISSION');
    const plan = R.planVersionRecord({ versions: [draft], versionString: '1.5.0' });
    expect(plan.action).toBe('reuse');
    expect(plan.version).toBe(draft);
  });

  it('REFUSES to edit a version that is already in review', () => {
    const plan = R.planVersionRecord({
      versions: [version('1.5.0', 'WAITING_FOR_REVIEW')],
      versionString: '1.5.0',
    });
    expect(plan.action).toBe('refuse');
    expect(plan.reason).toMatch(/not editable/);
  });

  it('REFUSES to edit a version that is already public', () => {
    const plan = R.planVersionRecord({
      versions: [version('1.5.0', 'READY_FOR_SALE')],
      versionString: '1.5.0',
    });
    expect(plan.action).toBe('refuse');
  });

  it('reuses a rejected version rather than refusing - that is the resubmit path', () => {
    // METADATA_REJECTED is exactly when you need to rewrite the release notes.
    const plan = R.planVersionRecord({
      versions: [version('1.5.0', 'METADATA_REJECTED')],
      versionString: '1.5.0',
    });
    expect(plan.action).toBe('reuse');
  });

  it('refuses a malformed version string before it reaches Apple', () => {
    expect(R.planVersionRecord({ versions: [], versionString: '2.9.0-rc1' }).action).toBe('refuse');
  });

  it('REFUSES to create a second record while a draft is open, and names the way out', () => {
    // App Store Connect holds one editable version at a time, so this create
    // is a 409 from Apple and a trip to the UI. Refusing with the number it
    // found is the difference between a plan and a failed write.
    const plan = R.planVersionRecord({
      versions: [version('1.3.5', 'READY_FOR_SALE'), version('1.5.0', 'PREPARE_FOR_SUBMISSION')],
      versionString: '1.6.0',
    });
    expect(plan.action).toBe('refuse');
    expect(plan.reason).toMatch(/--version 1\.5\.0/);
    expect(plan.reason).toMatch(/--retarget/);
  });

  it('renumbers that draft when asked explicitly', () => {
    const draft = version('1.5.0', 'PREPARE_FOR_SUBMISSION');
    const plan = R.planVersionRecord({
      versions: [version('1.3.5', 'READY_FOR_SALE'), draft],
      versionString: '1.6.0',
      retarget: true,
    });
    expect(plan).toMatchObject({ action: 'retarget', from: '1.5.0', to: '1.6.0' });
    expect(plan.version).toBe(draft);
  });

  it('still refuses a retarget that walks the number backwards', () => {
    // --retarget is a convenience, not an exemption: the climb rule is the one
    // thing about a store version number that cannot be undone.
    const plan = R.planVersionRecord({
      versions: [version('1.5.0', 'READY_FOR_SALE'), version('1.6.0', 'PREPARE_FOR_SUBMISSION')],
      versionString: '1.4.0',
      retarget: true,
    });
    expect(plan.action).toBe('refuse');
    expect(plan.reason).toMatch(/does not beat the highest version that has reached the store/);
  });
});

describe('the metadata this repo actually ships', () => {
  // The unit tests above run on fixtures. This one runs on the real file, so
  // a listing that would be written half-empty fails here rather than at Apple.
  it('produces every field Apple needs, for every shipped locale', async () => {
    const { APPLE } = await import('../../marketing/aso/metadata.mjs');
    const { versionLocalizations, appInfoLocalizations } = R.desiredListing(APPLE);

    // Reported as a list so a failure names every gap at once. A locale that
    // reaches Apple missing a description is a store page with a blank on it.
    const missing: string[] = [];
    for (const locale of Object.keys(versionLocalizations)) {
      for (const field of ['description', 'keywords', 'promotionalText', 'whatsNew', 'supportUrl']) {
        if (!versionLocalizations[locale][field]) missing.push(`${locale}.${field}`);
      }
      for (const field of ['name', 'subtitle', 'privacyPolicyUrl']) {
        if (!appInfoLocalizations[locale][field]) missing.push(`${locale}.${field}`);
      }
    }
    expect(missing).toEqual([]);
    expect(Object.keys(versionLocalizations).length).toBeGreaterThan(0);
  });

  it('does not ship the reference-only en-GB locale', async () => {
    // Present in the metadata for the reasoning, never created at Apple.
    const { APPLE } = await import('../../marketing/aso/metadata.mjs');
    expect(APPLE.localized['en-GB'].shipped).toBe(false);
    expect(Object.keys(R.desiredListing(APPLE).versionLocalizations)).not.toContain('en-GB');
  });
});

describe('deriving the listing from the metadata', () => {
  const APPLE = {
    name: 'Deep Life Simulator: Tycoon',
    subtitle: 'Careers, crime, crypto, heirs',
    keywords: ['mafia', 'prison'],
    description: 'English description',
    promotionalText: 'English promo',
    whatsNew: 'English notes',
    urls: {
      support: 'https://example.test/support.html',
      marketing: 'https://example.test/',
      privacyPolicy: 'https://example.test/privacy.html',
    },
    localized: {
      'es-MX': {
        subtitle: 'Carrera, crimen, cripto, lujo',
        keywords: ['simulador', 'vida'],
        description: 'Descripción',
        promotionalText: 'Promo',
        whatsNew: 'Novedades',
      },
      'en-GB': { shipped: false, subtitle: 'Careers, crime, crypto, heirs', keywords: ['mafia'] },
    },
  };

  it('splits the listing across the two resources Apple actually uses', () => {
    // The split is not intuitive: the support and marketing URLs are per
    // VERSION, the privacy URL is per APP, and writing either to the wrong
    // resource is a 4xx rather than a wrong value you could spot.
    const { versionLocalizations, appInfoLocalizations } = R.desiredListing(APPLE);

    expect(Object.keys(versionLocalizations['en-US']).sort()).toEqual([
      'description', 'keywords', 'marketingUrl', 'promotionalText', 'supportUrl', 'whatsNew',
    ]);
    expect(Object.keys(appInfoLocalizations['en-US']).sort()).toEqual([
      'name', 'privacyPolicyUrl', 'subtitle',
    ]);
  });

  it('joins the keyword array into the single field Apple stores', () => {
    expect(R.desiredListing(APPLE).versionLocalizations['en-US'].keywords).toBe('mafia,prison');
    expect(R.keywordField(['a', 'b'])).toBe('a,b');
  });

  it('carries the untranslated app name into every locale, because Apple requires one', () => {
    // The brand is deliberately not translated, but an appInfo localization
    // cannot be created without a name, so es-MX inherits en-US's.
    const { appInfoLocalizations } = R.desiredListing(APPLE);
    expect(appInfoLocalizations['es-MX'].name).toBe('Deep Life Simulator: Tycoon');
    expect(appInfoLocalizations['es-MX'].subtitle).toBe('Carrera, crimen, cripto, lujo');
  });

  it('never creates a locale marked shipped: false', () => {
    // en-GB storefronts fall back to en-US already; creating it would produce
    // a second identical listing to maintain forever.
    const listing = R.desiredListing(APPLE);
    expect(Object.keys(listing.versionLocalizations)).toEqual(['en-US', 'es-MX']);
    expect(Object.keys(listing.appInfoLocalizations)).toEqual(['en-US', 'es-MX']);
  });

  it('omits a field the metadata does not declare rather than blanking it', () => {
    // An empty string is a real value to Apple. Sending one for a field the
    // repo has no opinion about would erase whatever is in the UI today.
    expect(R.desiredListing({ name: 'X', urls: {} })).toEqual({
      versionLocalizations: { 'en-US': {} },
      appInfoLocalizations: { 'en-US': { name: 'X' } },
    });
  });
});

describe('narrowing what gets written', () => {
  const listing = {
    versionLocalizations: { 'en-US': { whatsNew: 'notes', description: 'desc' }, 'es-MX': { whatsNew: 'novedades' } },
    appInfoLocalizations: { 'en-US': { name: 'X', subtitle: 'Y' }, 'es-MX': { name: 'X' } },
  };

  it('keeps only the named fields, across both resources', () => {
    const { listing: narrowed } = R.restrictListing(listing, ['whatsNew']);
    expect(narrowed.versionLocalizations).toEqual({ 'en-US': { whatsNew: 'notes' }, 'es-MX': { whatsNew: 'novedades' } });
  });

  it('DROPS a locale left with nothing rather than sending it empty', () => {
    // A create carrying only a locale would make an empty listing; an update
    // carrying nothing is a request that changes nothing.
    const { listing: narrowed } = R.restrictListing(listing, ['whatsNew']);
    expect(narrowed.appInfoLocalizations).toEqual({});
  });

  it('reports an unrecognised field instead of quietly writing nothing', () => {
    // `--only whatsnew` narrowing to zero fields and reporting success is the
    // worst outcome available here.
    expect(R.restrictListing(listing, ['whatsnew']).unknown).toEqual(['whatsnew']);
    expect(R.restrictListing(listing, ['whatsNew']).unknown).toEqual([]);
  });

  it('is a no-op when no fields are named - a release writes the whole listing', () => {
    expect(R.restrictListing(listing, []).listing).toBe(listing);
  });
});

describe('planning the localization writes', () => {
  const loc = (locale: string, attributes: Record<string, string>, id = locale) => ({
    id,
    attributes: { locale, ...attributes },
  });

  it('creates a locale that does not exist yet', () => {
    const ops = R.planLocalizations({
      existingLocalizations: [],
      desiredByLocale: { 'en-US': { whatsNew: 'Fresh notes' } },
    });
    expect(ops[0]).toMatchObject({ op: 'create', locale: 'en-US', attributes: { whatsNew: 'Fresh notes' } });
  });

  it('updates ONLY the fields that differ', () => {
    // A PATCH carrying an unchanged description would re-stamp a field nobody
    // edited, and buries the change that matters in a plan nobody reads twice.
    const ops = R.planLocalizations({
      existingLocalizations: [loc('en-US', { whatsNew: 'Old notes', description: 'Same' })],
      desiredByLocale: { 'en-US': { whatsNew: 'New notes', description: 'Same' } },
    });
    expect(ops[0]).toMatchObject({ op: 'update', id: 'en-US', attributes: { whatsNew: 'New notes' } });
    expect(ops[0].attributes).not.toHaveProperty('description');
    expect(ops[0].changes).toEqual([{ field: 'whatsNew', from: 'Old notes', to: 'New notes' }]);
  });

  it('is IDEMPOTENT - identical copy produces no write at all', () => {
    const ops = R.planLocalizations({
      existingLocalizations: [loc('en-US', { whatsNew: 'Same', keywords: 'a,b' })],
      desiredByLocale: { 'en-US': { whatsNew: 'Same', keywords: 'a,b' } },
    });
    expect(ops).toEqual([{ op: 'unchanged', locale: 'en-US', id: 'en-US' }]);
  });

  it('treats a field Apple reports as absent the same as an empty one', () => {
    const ops = R.planLocalizations({
      existingLocalizations: [loc('en-US', {})],
      desiredByLocale: { 'en-US': { subtitle: 'Careers, crime, crypto, heirs' } },
    });
    expect(ops[0]).toMatchObject({ op: 'update' });
    expect(ops[0].changes).toEqual([{ field: 'subtitle', from: null, to: 'Careers, crime, crypto, heirs' }]);
  });

  it('leaves a locale it does not manage alone rather than deleting it', () => {
    // Someone may have added a listing in the App Store Connect UI. This script
    // owns the locales the repo declares and nothing else.
    const ops = R.planLocalizations({
      existingLocalizations: [loc('fr-FR', { whatsNew: 'Notes françaises' })],
      desiredByLocale: { 'en-US': { whatsNew: 'English notes' } },
    });
    expect(ops).toContainEqual({ op: 'skip-unmanaged', locale: 'fr-FR' });
  });
});

describe('choosing which app record carries the name', () => {
  const info = (state: string, id = state) => ({ id, attributes: { state } });

  it('picks the editable record, not the live one', () => {
    // Writing the name onto the live appInfo is not something Apple permits;
    // picking the wrong record is a 409 at best.
    const plan = R.planAppInfo([info('READY_FOR_DISTRIBUTION', 'live'), info('PREPARE_FOR_SUBMISSION', 'draft')]);
    expect(plan.action).toBe('use');
    expect(plan.appInfo.id).toBe('draft');
  });

  it('reads the legacy appStoreState spelling too', () => {
    const plan = R.planAppInfo([{ id: 'old', attributes: { appStoreState: 'PREPARE_FOR_SUBMISSION' } }]);
    expect(plan.action).toBe('use');
  });

  it('REFUSES when nothing is editable rather than writing to a live listing', () => {
    const plan = R.planAppInfo([info('READY_FOR_DISTRIBUTION')]);
    expect(plan.action).toBe('refuse');
    expect(plan.reason).toMatch(/No editable appInfo/);
  });
});

describe('payload shapes match Apple\'s documented schemas', () => {
  it('puts the release copy on the VERSION localization, which is where it lives', () => {
    const body = R.versionLocalizationCreatePayload({
      versionId: '42',
      locale: 'es-MX',
      attributes: { whatsNew: 'Novedades', keywords: 'a,b', supportUrl: 'https://example.test/s' },
    });
    expect(body).toEqual({
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: { locale: 'es-MX', whatsNew: 'Novedades', keywords: 'a,b', supportUrl: 'https://example.test/s' },
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: '42' } } },
      },
    });
  });

  it('puts the name, subtitle and privacy URL on the APP INFO localization', () => {
    const body = R.appInfoLocalizationCreatePayload({
      appInfoId: '7',
      locale: 'en-US',
      attributes: { name: 'Deep Life Simulator: Tycoon', subtitle: 'Careers, crime, crypto, heirs' },
    });
    expect(body.data.type).toBe('appInfoLocalizations');
    expect(body.data.relationships.appInfo.data).toEqual({ type: 'appInfos', id: '7' });
    expect(body.data.attributes.locale).toBe('en-US');
  });

  it('drops undefined attributes instead of sending them as empty values', () => {
    const body = R.appInfoLocalizationUpdatePayload({ id: '1', attributes: { name: 'X', subtitle: undefined } });
    expect(body.data.attributes).toEqual({ name: 'X' });
  });

  it('renumbers a draft through the version attribute, not by recreating it', () => {
    const body = R.versionRenumberPayload({ versionId: 'v1', versionString: '1.6.0' });
    expect(body).toEqual({
      data: { type: 'appStoreVersions', id: 'v1', attributes: { versionString: '1.6.0' } },
    });
  });

  it('never puts release notes on the version - that attribute does not exist', () => {
    const body = R.versionCreatePayload({ appId: '123', versionString: '1.5.0' });
    expect(body.data.attributes).toEqual({ versionString: '1.5.0', platform: 'IOS' });
    expect(body.data.attributes).not.toHaveProperty('releaseNotes');
    expect(body.data.relationships.app.data.id).toBe('123');
  });

  it('omits optional version attributes rather than sending empty ones', () => {
    const body = R.versionCreatePayload({ appId: '1', versionString: '1.5.0', copyright: undefined });
    expect(body.data.attributes).not.toHaveProperty('copyright');
    expect(body.data.attributes).not.toHaveProperty('releaseType');
  });

  it('uses the 3-step review flow, not the deprecated appStoreVersionSubmissions', () => {
    expect(R.reviewSubmissionCreatePayload({ appId: '1' }).data.type).toBe('reviewSubmissions');
    const item = R.reviewSubmissionItemCreatePayload({ submissionId: 's1', versionId: 'v1' });
    expect(item.data.type).toBe('reviewSubmissionItems');
    expect(item.data.relationships.reviewSubmission.data.id).toBe('s1');
    expect(item.data.relationships.appStoreVersion.data.id).toBe('v1');
    expect(R.reviewSubmissionSubmitPayload({ submissionId: 's1' }).data.attributes).toEqual({ submitted: true });
  });

  it('attaches a build through the version relationship', () => {
    const body = R.attachBuildPayload({ versionId: 'v1', buildId: 'b9' });
    expect(body.data.relationships.build.data).toEqual({ type: 'builds', id: 'b9' });
  });
});

describe('the client refuses to write unless told to', () => {
  // A real key: every path that reaches the network mints a token first.
  const credentials = {
    keyId: 'K',
    issuerId: 'I',
    privateKey: crypto
      .generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      .privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };

  it('records writes instead of sending them in dry run', async () => {
    const fetchImpl = jest.fn();
    const client = new C.AscClient({ credentials, dryRun: true, fetchImpl, log: () => {} });

    const result = await client.post('/v1/appStoreVersions', { data: { type: 'appStoreVersions' } });

    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(client.plannedWrites).toEqual([
      { method: 'POST', path: '/v1/appStoreVersions', body: { data: { type: 'appStoreVersions' } } },
    ]);
  });

  it('still performs GETs in dry run - reading is how it builds the plan', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ data: [] }),
    });
    const client = new C.AscClient({ credentials, dryRun: true, fetchImpl, log: () => {} });
    await client.get('/v1/apps/1/appStoreVersions');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(client.plannedWrites).toHaveLength(0);
  });

  it('surfaces Apple\'s own error detail rather than a bare status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      status: 409,
      ok: false,
      text: async () =>
        JSON.stringify({ errors: [{ title: 'Conflict', detail: 'A version with this number exists.' }] }),
    });
    const client = new C.AscClient({ credentials, fetchImpl, log: () => {} });

    await expect(client.post('/v1/appStoreVersions', {})).rejects.toThrow(
      /HTTP 409.*A version with this number exists/s,
    );
  });

  it('follows pagination so a long history is not read from page one', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ data: [{ id: 'a' }], links: { next: 'https://api/next' } }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ data: [{ id: 'b' }], links: {} }),
      });
    const client = new C.AscClient({ credentials, fetchImpl, log: () => {} });

    const all = await client.getAll('/v1/apps/1/appStoreVersions');
    expect(all.map((x: { id: string }) => x.id)).toEqual(['a', 'b']);
  });
});

describe('the JWT Apple actually accepts', () => {
  // Every one of these is answered by an indistinguishable 401 if wrong.
  const privateKey = crypto
    .generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    .privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  it('signs ES256 with the raw r||s signature, not DER', async () => {
    const token = C.makeToken({ keyId: 'K', issuerId: 'I', privateKey });
    const signature = Buffer.from(token.split('.')[2].replace(/-/g, '+').replace(/\//g, '/'), 'base64url');
    expect(signature).toHaveLength(64); // DER would be ~70 and variable
  });

  it('sets the audience and keeps the lifetime inside Apple\'s 20-minute cap', () => {
    const now = 1_700_000_000;
    const token = C.makeToken({ keyId: 'K', issuerId: 'ISS', privateKey }, now);
    const [header, payload] = token
      .split('.')
      .slice(0, 2)
      .map((p) => JSON.parse(Buffer.from(p, 'base64url').toString()));

    expect(header).toEqual({ alg: 'ES256', kid: 'K', typ: 'JWT' });
    expect(payload.aud).toBe('appstoreconnect-v1');
    expect(payload.iss).toBe('ISS');
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(20 * 60);
  });
});

describe('credential loading', () => {
  it('names exactly what is missing', () => {
    expect(C.missingCredentialNames({})).toEqual([
      'ASC_KEY_ID',
      'ASC_ISSUER_ID',
      'ASC_KEY_P8 (or ASC_KEY_P8_PATH)',
    ]);
    expect(C.missingCredentialNames({ ASC_KEY_ID: 'K', ASC_ISSUER_ID: 'I', ASC_KEY_P8: 'pem' })).toEqual([]);
  });

  it('accepts a base64-wrapped key, which is how it survives a CI secret', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----';
    const wrapped = Buffer.from(pem).toString('base64');
    expect(C.loadPrivateKey({ ASC_KEY_P8: wrapped })).toBe(pem);
    expect(C.loadPrivateKey({ ASC_KEY_P8: pem })).toBe(pem);
  });

  it('reports a MALFORMED key as present, not as missing', () => {
    // Buffer's base64 decoder discards what it cannot parse rather than
    // throwing, so garbage used to decode to '' and read as "you never set
    // this" — sending someone to set a variable they had already set wrong.
    expect(C.loadPrivateKey({ ASC_KEY_P8: 'not-a-key' })).toBe('not-a-key');
    expect(C.missingCredentialNames({ ASC_KEY_ID: 'K', ASC_ISSUER_ID: 'I', ASC_KEY_P8: 'not-a-key' })).toEqual([]);
  });

  it('returns null rather than a partial credential set', () => {
    expect(C.loadCredentials({ ASC_KEY_ID: 'K' })).toBeNull();
  });
});
