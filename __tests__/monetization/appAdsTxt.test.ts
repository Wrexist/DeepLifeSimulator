/**
 * app-ads.txt ↔ AdMob publisher id parity.
 *
 * AdMob verifies authorized sellers by crawling `app-ads.txt` at the ROOT of the
 * developer domain taken from the store listing — for this app,
 * `https://wrexist.github.io/app-ads.txt`. Subdirectories are not accepted, and
 * on github.io that root is served only by a repo named `wrexist.github.io`.
 * Publishing it is a manual step documented in `user-pages/README.md`; this test
 * cannot check the live URL and does not try to.
 *
 * What it CAN stop is the failure mode that outlives the manual step. The repo
 * now carries three copies of the file — the repo root, `user-pages/` (the
 * ready-to-publish root site) and `support-site/` (which becomes the live copy
 * the moment a custom domain is pointed at the Pages site, since a custom domain
 * serves that folder at its own root). Three copies of one string drift, and the
 * drift is invisible: a stale publisher id serves a syntactically perfect file
 * that authorizes the wrong seller, so AdMob reports the app as UNAUTHORIZED
 * rather than as an error anyone would notice in the repo.
 *
 * The publisher id is not free-form either — it is the middle segment of the
 * AdMob app ids in `app.config.js` (`ca-app-pub-<publisher>~<app>`). Changing
 * AdMob accounts means changing both, and only one of them is in a file anyone
 * opens. So the id is derived from `app.config.js` here rather than hard-coded:
 * the config is the source of truth, and app-ads.txt has to follow it.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * Every copy of app-ads.txt in the repo. The repo-root copy is the reference
 * one and is not served by anything; the other two are publish targets — see
 * the file header for what serves which.
 */
const APP_ADS_COPIES = [
  'app-ads.txt',
  'user-pages/app-ads.txt',
  'support-site/app-ads.txt',
];

/** `google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0` */
const AUTHORIZED_SELLER_LINE = /^google\.com,\s*pub-(\d{16}),\s*DIRECT,\s*f08c47fec0942fa0$/;

const readCopy = (relativePath: string): string =>
  fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');

/** Pull the publisher segment out of every `ca-app-pub-<publisher>~<app>` in app.config.js. */
const publisherIdsInAppConfig = (): string[] => {
  const source = readCopy('app.config.js');
  const ids = [...source.matchAll(/ca-app-pub-(\d{16})~/g)].map((match) => match[1]);
  return [...new Set(ids)];
};

describe('app-ads.txt', () => {
  it('ships every publish target', () => {
    for (const relativePath of APP_ADS_COPIES) {
      expect(fs.existsSync(path.join(REPO_ROOT, relativePath))).toBe(true);
    }
  });

  it('declares AdMob with a well-formed authorized-seller line', () => {
    for (const relativePath of APP_ADS_COPIES) {
      const lines = readCopy(relativePath)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toMatch(AUTHORIZED_SELLER_LINE);
      }
    }
  });

  it('uses the publisher id from the AdMob app ids in app.config.js', () => {
    const publisherIds = publisherIdsInAppConfig();

    // iOS and Android are two apps under ONE AdMob account. Two publisher ids
    // here means a copy-paste from another account, and app-ads.txt could only
    // ever authorize one of them.
    expect(publisherIds).toHaveLength(1);

    const expectedLine = `google.com, pub-${publisherIds[0]}, DIRECT, f08c47fec0942fa0`;
    for (const relativePath of APP_ADS_COPIES) {
      expect(readCopy(relativePath).trim()).toBe(expectedLine);
    }
  });

  it('keeps every copy byte-identical', () => {
    const [first, ...rest] = APP_ADS_COPIES;
    const canonical = readCopy(first);

    for (const relativePath of rest) {
      expect(readCopy(relativePath)).toBe(canonical);
    }
  });
});
