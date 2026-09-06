/**
 * The release CLI, end to end against a fake App Store Connect.
 *
 * `ascRelease.test.ts` pins the decisions; this pins the WIRING, which is the
 * part reading the code cannot settle. A listing is split across two Apple
 * resources — description/keywords/promo/What's New/URLs on the version,
 * name/subtitle/privacy URL on the app — and a field posted to the wrong one
 * fails at Apple, after a release run has already started.
 *
 * The account modelled by the fixture is the awkward one: a released 1.3.5, an
 * open editable draft, an en-US listing that already exists carrying stale
 * copy, and no es-MX listing at all. A correct run therefore produces exactly
 * one update and one create on each resource, and — because no --apply is
 * passed — performs none of them.
 */

import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '../..');
const FAKE_API = path.join(__dirname, 'fixtures/ascFakeApi.mjs');

function runPlan(extraArgs: string[] = []): string {
  const privateKey = crypto
    .generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    .privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  return execFileSync(
    process.execPath,
    ['--import', FAKE_API, 'scripts/asc-release.mjs', ...extraArgs],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, ASC_KEY_ID: 'K', ASC_ISSUER_ID: 'I', ASC_KEY_P8: privateKey },
    },
  );
}

describe('asc-release, planned against a fake App Store Connect', () => {
  let output = '';
  beforeAll(() => {
    output = runPlan();
  });

  it('writes the release copy to the VERSION localization', () => {
    expect(output).toMatch(/appStoreVersionLocalizations/);
    expect(output).toMatch(/PATCH \/v1\/appStoreVersionLocalizations\/vloc-en/);
    expect(output).toMatch(/POST \/v1\/appStoreVersionLocalizations/);
  });

  it('writes the name and subtitle to the APP INFO localization', () => {
    expect(output).toMatch(/PATCH \/v1\/appInfoLocalizations\/iloc-en/);
    expect(output).toMatch(/POST \/v1\/appInfoLocalizations/);
    expect(output).toMatch(/name: Deep Life Simulator → Deep Life Simulator: Tycoon/);
  });

  it('picks the EDITABLE app record, never the live one', () => {
    // info-live is READY_FOR_DISTRIBUTION in the fixture. A write against it
    // would be an edit to a public listing.
    expect(output).not.toMatch(/info-live/);
  });

  it('covers every shipped locale and creates the one that is missing', () => {
    expect(output).toMatch(/UPDATE\s+en-US/);
    expect(output).toMatch(/CREATE\s+es-MX/);
    expect(output).not.toMatch(/en-GB/);
  });

  it('reuses the open draft rather than creating a second version record', () => {
    expect(output).toMatch(/REUSE\s+version record 1\.6\.0/);
    expect(output).not.toMatch(/POST \/v1\/appStoreVersions\b/);
  });

  it('performs NOTHING without --apply, and says so', () => {
    expect(output).toMatch(/Planned writes \(4\)/);
    expect(output).toMatch(/Nothing was written/);
  });

  it('reports the plan as data too, for a workflow to read', () => {
    const json = JSON.parse(runPlan(['--json']));
    expect(json.applied).toBe(false);
    expect(json.versionAction).toBe('reuse');
    expect(json.plannedWrites).toHaveLength(4);
    const enUs = json.localizations.find((l: { locale: string }) => l.locale === 'en-US');
    expect(enUs.fields).toEqual(
      expect.arrayContaining(['description', 'keywords', 'promotionalText', 'whatsNew', 'supportUrl']),
    );
  });
});
