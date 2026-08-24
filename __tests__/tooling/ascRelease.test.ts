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

const version = (versionString: string, appStoreVersionState: string, id = versionString) => ({
  id,
  type: 'appStoreVersions',
  attributes: { versionString, appStoreVersionState },
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
    expect(plan.reason).toMatch(/does not beat the highest released version \(1\.5\.0\)/);
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
});

describe('planning the What\'s New writes', () => {
  const loc = (locale: string, whatsNew: string, id = locale) => ({
    id,
    attributes: { locale, whatsNew },
  });

  it('creates a locale that does not exist yet', () => {
    const ops = R.planLocalizations({
      existingLocalizations: [],
      whatsNewByLocale: { 'en-US': 'Fresh notes' },
    });
    expect(ops).toEqual([{ op: 'create', locale: 'en-US', whatsNew: 'Fresh notes' }]);
  });

  it('updates a locale whose text differs', () => {
    const ops = R.planLocalizations({
      existingLocalizations: [loc('en-US', 'Old notes')],
      whatsNewByLocale: { 'en-US': 'New notes' },
    });
    expect(ops[0]).toMatchObject({ op: 'update', locale: 'en-US', id: 'en-US', whatsNew: 'New notes' });
  });

  it('is IDEMPOTENT - identical text produces no write at all', () => {
    const ops = R.planLocalizations({
      existingLocalizations: [loc('en-US', 'Same notes')],
      whatsNewByLocale: { 'en-US': 'Same notes' },
    });
    expect(ops).toEqual([{ op: 'unchanged', locale: 'en-US', id: 'en-US' }]);
    expect(ops.some((o) => o.op === 'update' || o.op === 'create')).toBe(false);
  });

  it('leaves a locale it does not manage alone rather than deleting it', () => {
    // Someone may have added a listing in the App Store Connect UI. This script
    // owns the locales the repo declares and nothing else.
    const ops = R.planLocalizations({
      existingLocalizations: [loc('fr-FR', 'Notes françaises')],
      whatsNewByLocale: { 'en-US': 'English notes' },
    });
    expect(ops).toContainEqual({ op: 'skip-unmanaged', locale: 'fr-FR' });
  });
});

describe('payload shapes match Apple\'s documented schemas', () => {
  it('puts whatsNew on the LOCALIZATION, which is where it lives', () => {
    const body = R.localizationCreatePayload({ versionId: '42', locale: 'es-MX', whatsNew: 'Novedades' });
    expect(body).toEqual({
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: { locale: 'es-MX', whatsNew: 'Novedades' },
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: '42' } } },
      },
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
