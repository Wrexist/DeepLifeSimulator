#!/usr/bin/env node
// scripts/next-build-number.mjs
//
// Resolves the next iOS CFBundleVersion (build number) so every build is
// STRICTLY higher than anything already on App Store Connect — which prevents
// the "You've already submitted this build of the app" rejection at submit time.
//
// Resolution order:
//   1. App Store Connect API (authoritative) — the highest build number Apple
//      already has on record for the app, + 1. Enabled when ASC_KEY_ID,
//      ASC_ISSUER_ID and ASC_KEY_P8 (or ASC_KEY_P8_PATH) are set.
//   2. Epoch-seconds fallback — strictly monotonic and always higher than any
//      small historical build number. Used when ASC creds are absent or the
//      lookup fails, so a build is never blocked on Apple connectivity.
//
// Output contract: the chosen integer is printed to STDOUT and nothing else, so
// it is safe to capture with `BUILD_NUMBER=$(node scripts/next-build-number.mjs)`.
// Every diagnostic goes to STDERR.
//
// Flags:
//   --ask       In a TTY, show the proposed number and let the user accept
//               (Enter), override (type a number), or abort ('n'). Ignored in
//               non-interactive CI (no TTY) so automated builds never hang.
//   --selftest  Build and print the App Store Connect JWT from the provided
//               creds WITHOUT calling Apple (to debug auth setup), then exit.

import crypto from 'node:crypto';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const ARGS = process.argv.slice(2);
const has = (flag) => ARGS.includes(flag);
const log = (...a) => console.error('[next-build-number]', ...a);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID_VERSION_CODE_CAP = 2_100_000_000; // Google Play hard ceiling.

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getAscAppId() {
  try {
    const eas = readJSON(path.join(ROOT, 'eas.json'));
    return eas?.submit?.production?.ios?.ascAppId || process.env.ASC_APP_ID || null;
  } catch {
    return process.env.ASC_APP_ID || null;
  }
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Accepts the .p8 either as raw PEM contents or as base64-encoded PEM (a common
// way to store a multi-line key in a single CI secret).
function loadP8() {
  const inline = process.env.ASC_KEY_P8;
  const file = process.env.ASC_KEY_P8_PATH;
  let raw = null;
  if (inline && inline.trim()) raw = inline;
  else if (file && fs.existsSync(file)) raw = fs.readFileSync(file, 'utf8');
  if (!raw) return null;
  raw = raw.trim();
  if (!raw.includes('BEGIN')) {
    try {
      raw = Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      /* fall through with the original */
    }
  }
  return raw;
}

function makeAscJwt({ keyId, issuerId, p8 }) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey({ key: p8, format: 'pem' });
  // ES256 (ECDSA P-256/SHA-256). JWT requires the raw r||s signature, so use
  // the IEEE-P1363 encoding rather than Node's default DER.
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${b64url(sig)}`;
}

function httpsGetJson(reqUrl, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(reqUrl);
    const req = https.request(
      {
        method: 'GET',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`ASC API HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('ASC API timeout')));
    req.end();
  });
}

function maxBuildFromAscPayload(payload) {
  const data = Array.isArray(payload?.data) ? payload.data : [];
  let max = 0;
  for (const b of data) {
    // For a Build resource, attributes.version IS the CFBundleVersion.
    const n = parseInt(String(b?.attributes?.version), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

async function fromAppStoreConnect() {
  const keyId = process.env.ASC_KEY_ID;
  const issuerId = process.env.ASC_ISSUER_ID;
  const p8 = loadP8();
  const appId = getAscAppId();

  if (!keyId || !issuerId || !p8) {
    log('ASC creds not set (need ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8) — skipping App Store Connect lookup.');
    return null;
  }
  if (!appId) {
    log('No ascAppId in eas.json and ASC_APP_ID unset — skipping App Store Connect lookup.');
    return null;
  }

  const token = makeAscJwt({ keyId, issuerId, p8 });

  if (has('--selftest')) {
    const [h, p, s] = token.split('.');
    log('JWT header :', Buffer.from(h, 'base64').toString());
    log('JWT payload:', Buffer.from(p, 'base64').toString());
    log('JWT signature bytes:', Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').length, '(ES256 expects 64)');
    process.exit(0);
  }

  // Sort by most-recently-uploaded so the highest numbers are in the first page;
  // compute the max client-side regardless of sort. Sparse fieldset keeps it light.
  const api =
    `https://api.appstoreconnect.apple.com/v1/builds` +
    `?filter%5Bapp%5D=${encodeURIComponent(appId)}` +
    `&sort=-uploadedDate&limit=200&fields%5Bbuilds%5D=version`;
  const payload = await httpsGetJson(api, token);
  const max = maxBuildFromAscPayload(payload);
  log(`App Store Connect highest build for app ${appId}: ${max} (scanned ${payload?.data?.length ?? 0} builds).`);
  return max + 1;
}

function epochFallback() {
  const n = Math.floor(Date.now() / 1000);
  log(`Falling back to epoch seconds: ${n} (strictly monotonic, always higher than small historical numbers).`);
  return n;
}

async function maybeAsk(proposed, source) {
  if (!has('--ask') || !process.stdin.isTTY) return proposed; // CI: never block.
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((res) =>
    rl.question(
      `Next build number = ${proposed} (source: ${source}).\n` +
        `  • Enter to accept  • type a number to override  • 'n' to abort: `,
      res,
    ),
  );
  rl.close();
  const t = answer.trim();
  if (t === '') return proposed;
  if (/^n(o)?$/i.test(t)) {
    log('Aborted by user.');
    process.exit(1);
  }
  const override = parseInt(t, 10);
  if (Number.isFinite(override) && override > 0) return override;
  log(`Unrecognized input "${t}" — keeping ${proposed}.`);
  return proposed;
}

async function main() {
  let chosen = null;
  let source = null;

  try {
    const asc = await fromAppStoreConnect();
    if (asc != null) {
      chosen = asc;
      source = 'app-store-connect';
    }
  } catch (e) {
    log('App Store Connect lookup failed:', e.message);
  }

  if (chosen == null) {
    chosen = epochFallback();
    source = 'epoch';
  }

  chosen = await maybeAsk(chosen, source);

  // Final guards: positive integer, and within Android's versionCode ceiling
  // (app.config.js derives android.versionCode from this same value).
  chosen = parseInt(String(chosen), 10);
  if (!Number.isFinite(chosen) || chosen <= 0) chosen = Math.floor(Date.now() / 1000);
  if (chosen > ANDROID_VERSION_CODE_CAP) {
    log(`WARNING: ${chosen} exceeds Android versionCode cap (${ANDROID_VERSION_CODE_CAP}); using epoch instead.`);
    chosen = Math.floor(Date.now() / 1000);
  }

  log(`Resolved build number: ${chosen} (source: ${source}).`);
  process.stdout.write(`${chosen}\n`);
}

main().catch((e) => {
  // Never fail the build over resolution: emit a monotonic epoch and warn.
  log('Unexpected error, using epoch fallback:', e?.message || e);
  process.stdout.write(`${Math.floor(Date.now() / 1000)}\n`);
});
