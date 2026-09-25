/**
 * `npm run aso` is the paste-ready path for store copy. A locale waiting to be
 * created by hand (`pending: true`) must come out complete, name included,
 * because that is the only way an operator gets it into App Store Connect. A
 * reference-only locale (`shipped: false`) must NOT, because printing it would
 * tell the operator to build a listing those storefronts already fall back to.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = path.join(__dirname, '../..');

describe('check-aso --emit', () => {
  let out = '';
  let pending: string[] = [];
  let referenceOnly: string[] = [];

  beforeAll(async () => {
    out = execFileSync(process.execPath, ['scripts/check-aso.mjs', '--emit'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    const { APPLE } = (await import('../../marketing/aso/metadata.mjs')) as {
      APPLE: { localized?: Record<string, { pending?: boolean; shipped?: boolean }> };
    };
    const locales = Object.entries(APPLE.localized ?? {});
    pending = locales.filter(([, l]) => l.pending === true).map(([k]) => k);
    referenceOnly = locales.filter(([, l]) => l.shipped === false).map(([k]) => k);
  });

  it('has pending and reference-only locales to check', () => {
    expect(pending.length).toBeGreaterThan(0);
    expect(referenceOnly).toContain('en-GB');
  });

  it('prints every pending locale paste-ready, name first', () => {
    for (const locale of pending) {
      expect(out).toContain(`[Apple · ${locale}] PENDING`);
      for (const field of ['Name', 'Subtitle', 'Keywords', 'Promotional text', "What's New", 'Description']) {
        expect(out).toContain(`[Apple · ${locale} · ${field}`);
      }
    }
  });

  it('keeps reference-only locales out of the paste-ready copy', () => {
    for (const locale of referenceOnly) {
      expect(out).toContain(`[Apple · ${locale}] reference only`);
      expect(out).not.toContain(`[Apple · ${locale} · Subtitle`);
    }
  });
});
