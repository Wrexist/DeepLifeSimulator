/**
 * The Google Play release tool (scripts/play-release.mjs).
 *
 * It moves a build to the production track, so what is pinned here is mostly
 * the refusals and the one safety property everything else rests on: without
 * --apply the edit is validated and DISCARDED, never committed. The CLI is
 * driven end to end against a local stub of Google's API (PLAY_API_BASE /
 * PLAY_TOKEN_URL), because the alternative is pointing a test at the live app.
 */

import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';

type PlayRelease = typeof import('../../scripts/lib/playRelease.mjs');

let P: PlayRelease;
let PLAY: { releaseNotes: Record<string, string> };

const ROOT = path.resolve(__dirname, '../..');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ACCOUNT_JSON = JSON.stringify({
  client_email: 'release@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
});

beforeAll(async () => {
  P = await import('../../scripts/lib/playRelease.mjs');
  ({ PLAY } = await import('../../marketing/aso/metadata.mjs'));
});

describe('pure planning pieces', () => {
  const internal = {
    track: 'internal',
    releases: [
      { name: '2.15.0', versionCodes: ['1790000000'], status: 'completed' },
      { name: '2.16.0', versionCodes: ['1792345007'], status: 'completed' },
    ],
  };

  it('finds the newest version code and the release that carries it', () => {
    expect(P.latestVersionCode(internal)).toBe('1792345007');
    expect(P.releaseWithVersionCode(internal, 1792345007)?.name).toBe('2.16.0');
    expect(P.releaseWithVersionCode(internal, '1')).toBeNull();
    expect(P.latestVersionCode({ track: 'x', releases: [] })).toBeNull();
  });

  it('accepts a rollout fraction in (0, 1] and refuses anything else', () => {
    expect(P.parseRollout('0.2')).toBe(0.2);
    expect(P.parseRollout(1)).toBe(1);
    for (const bad of ['0', '-0.1', '1.5', 'twenty', '']) {
      expect(() => P.parseRollout(bad)).toThrow(/Rollout must be/);
    }
  });

  it('builds a staged release below 1 and a completed one, with no userFraction, at 1', () => {
    expect(P.buildRelease({ versionCode: 7, name: 'n', rollout: 0.2, releaseNotes: [] })).toEqual({
      versionCodes: ['7'], name: 'n', status: 'inProgress', userFraction: 0.2,
    });
    const full = P.buildRelease({ versionCode: '7', rollout: 1, releaseNotes: [{ language: 'en-US', text: 'x' }] });
    expect(full.status).toBe('completed');
    expect(full).not.toHaveProperty('userFraction');
    expect(full.releaseNotes).toEqual([{ language: 'en-US', text: 'x' }]);
  });

  it('sends release notes only for languages the listing carries', () => {
    const notes = P.releaseNotesFor({ 'en-US': 'a', 'fr-FR': 'b', 'de-DE': '  ' }, ['en-US', 'de-DE']);
    expect(notes).toEqual([{ language: 'en-US', text: 'a' }]);
  });

  it('signs a token-exchange assertion Google can verify', () => {
    const jwt = P.makeAssertion(P.loadServiceAccount({ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: ACCOUNT_JSON })!, 1000);
    const [h, c, s] = jwt.split('.');
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claims).toMatchObject({ iss: 'release@example.iam.gserviceaccount.com', scope: P.PLAY_SCOPE, iat: 1000, exp: 4600 });
    expect(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });

  it('keeps every Play release note inside the 500-character cap', () => {
    expect(PLAY.releaseNotes['en-US']).toBeTruthy();
    for (const [language, text] of Object.entries(PLAY.releaseNotes)) {
      expect([language, text.length <= P.RELEASE_NOTES_LIMIT]).toEqual([language, true]);
    }
  });
});

describe('the CLI against a stub of the Play API', () => {
  type Call = { method: string; path: string; body: unknown };
  let server: http.Server;
  let base: string;
  let calls: Call[];
  let tracks: unknown[];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (d) => { raw += d; });
      req.on('end', () => {
        const route = (req.url ?? '').replace('/androidpublisher/v3/applications/com.deeplife.simulator', '');
        calls.push({ method: req.method ?? '', path: route, body: raw && route !== '/token' ? JSON.parse(raw) : null });
        const send = (obj: unknown) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
        if (route === '/token') return send({ access_token: 'stub-token' });
        if (req.method === 'POST' && route === '/edits') return send({ id: 'e1' });
        if (route === '/edits/e1/tracks') return send({ tracks });
        if (route === '/edits/e1/listings') return send({ listings: [{ language: 'en-US' }, { language: 'fr-FR' }] });
        return send({});
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  beforeEach(() => {
    calls = [];
    tracks = [
      { track: 'internal', releases: [{ name: '2.16.0', versionCodes: ['1792345007'], status: 'completed' }] },
      { track: 'production', releases: [{ name: '2.15.0', versionCodes: ['1790000000'], status: 'completed' }] },
    ];
  });

  function run(args: string[]): Promise<{ code: number; out: string }> {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(ROOT, 'scripts/play-release.mjs'), ...args], {
        cwd: ROOT,
        env: {
          ...process.env,
          GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: ACCOUNT_JSON,
          PLAY_API_BASE: `${base}/androidpublisher/v3`,
          PLAY_TOKEN_URL: `${base}/token`,
        },
      });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { out += d; });
      child.on('close', (code) => resolve({ code: code ?? 1, out }));
    });
  }

  const did = (method: string, p: string) => calls.some((c) => c.method === method && c.path === p);

  it('plan validates the promotion and discards it: no commit', async () => {
    const { code } = await run(['--promote', '--version-code', '1792345007', '--rollout', '0.2']);
    expect(code).toBe(0);
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.path).toBe('/edits/e1/tracks/production');
    expect(put?.body).toEqual({
      track: 'production',
      releases: [{
        versionCodes: ['1792345007'],
        name: '2.16.0',
        status: 'inProgress',
        userFraction: 0.2,
        releaseNotes: [
          { language: 'en-US', text: PLAY.releaseNotes['en-US'] },
          { language: 'fr-FR', text: PLAY.releaseNotes['fr-FR'] },
        ],
      }],
    });
    expect(did('POST', '/edits/e1:validate')).toBe(true);
    expect(did('POST', '/edits/e1:commit')).toBe(false);
    expect(did('DELETE', '/edits/e1')).toBe(true);
  }, 30_000);

  it('--apply commits and does not discard the edit', async () => {
    const { code } = await run(['--promote', '--version-code', '1792345007', '--rollout', '0.2', '--apply']);
    expect(code).toBe(0);
    expect(did('POST', '/edits/e1:commit')).toBe(true);
    expect(did('DELETE', '/edits/e1')).toBe(false);
  }, 30_000);

  it('refuses a version code that is not on the source track, and discards the edit', async () => {
    const { code, out } = await run(['--promote', '--version-code', '42', '--apply']);
    expect(code).toBe(1);
    expect(out).toMatch(/not on "internal"/);
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    expect(did('DELETE', '/edits/e1')).toBe(true);
  }, 30_000);

  it('refuses to start a second staged rollout over one in progress', async () => {
    tracks[1] = { track: 'production', releases: [{ name: '2.15.0', versionCodes: ['1790000000'], status: 'inProgress', userFraction: 0.2 }] };
    const { code, out } = await run(['--promote', '--apply']);
    expect(code).toBe(1);
    expect(out).toMatch(/already has a staged rollout/);
    expect(did('POST', '/edits/e1:commit')).toBe(false);
  }, 30_000);

  it('raises a staged rollout but never shrinks one', async () => {
    tracks[1] = { track: 'production', releases: [{ name: '2.16.0', versionCodes: ['1792345007'], status: 'inProgress', userFraction: 0.2 }] };
    const up = await run(['--set-rollout', '1', '--apply']);
    expect(up.code).toBe(0);
    const put = calls.find((c) => c.method === 'PUT') as Call & { body: { releases: Record<string, unknown>[] } };
    expect(put.body.releases[0]).toMatchObject({ versionCodes: ['1792345007'], status: 'completed' });
    expect(put.body.releases[0]).not.toHaveProperty('userFraction');

    calls = [];
    const down = await run(['--set-rollout', '0.1', '--apply']);
    expect(down.code).toBe(1);
    expect(down.out).toMatch(/can only grow/);
  }, 30_000);

  it('status reads the tracks and changes nothing', async () => {
    const { code, out } = await run(['--status']);
    expect(code).toBe(0);
    expect(out).toMatch(/production: 2\.15\.0 \[1790000000\] completed/);
    expect(calls.some((c) => c.method === 'PUT' || c.path.endsWith(':commit'))).toBe(false);
    expect(did('DELETE', '/edits/e1')).toBe(true);
  }, 30_000);
});
