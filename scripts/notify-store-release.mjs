#!/usr/bin/env node
// scripts/notify-store-release.mjs
//
// Watches the LIVE App Store + Google Play listings and posts to Discord
// #updates the moment a new version actually goes live (not when it's
// submitted — READY_FOR_SALE / a completed production release only).
//
// State: discord/state/last-notified-release.json, tracking the last version
// string posted per store so a rerun never double-posts. The GitHub Actions
// workflow that runs this on a schedule commits that file back with
// GITHUB_TOKEN — no new secret needed for the bookkeeping itself.
//
// Read-only against both stores: the App Store call is the same GET
// asc-release.mjs's --status uses; the Google Play call opens an edit only to
// read a track and is never committed.
//
//   node scripts/notify-store-release.mjs           post if something is new
//   node scripts/notify-store-release.mjs --dry-run  print, write nothing
//
// Needs: DISCORD_WEBHOOK_UPDATES, ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_P8,
// GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, APPLE.whatsNew in marketing/aso/metadata.mjs.
// Any one missing degrades to skipping that store, not failing the run —
// a Play outage should never block the App Store announcement or vice versa.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
// Explicit rather than relying on the runtime global. eslint.config.js does
// declare Buffer for scripts/**/*.mjs, so this is not needed to lint - it is
// the convention that block's own comment asks ESM scripts to follow.
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { AscClient, loadCredentials } from './lib/ascClient.mjs';
import { RELEASED_STATES, versionStateOf } from './lib/ascRelease.mjs';
import { renderReleasePost } from '../discord/copy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = path.join(ROOT, 'discord/state/last-notified-release.json');
const DRY_RUN = process.argv.includes('--dry-run');

function log(...a) { console.log(...a); }
function warn(...a) { console.warn(...a); }

function readState() {
  try {
    return { ...JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')), _isFirstRun: false };
  } catch {
    // No state file yet: seed from whatever is live right now rather than
    // treating the CURRENT version as "new" and posting an announcement for
    // a release that already happened before this watcher existed.
    return { _isFirstRun: true };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function readAscAppId() {
  if (process.env.ASC_APP_ID) return process.env.ASC_APP_ID;
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  return eas?.submit?.production?.ios?.ascAppId ?? null;
}

/** The live App Store version, or null if credentials/app id are missing. */
async function fetchLiveAppStoreVersion() {
  const credentials = loadCredentials();
  const appId = readAscAppId();
  if (!credentials || !appId) {
    warn('[app store] skipped — ASC credentials or app id missing.');
    return null;
  }
  const client = new AscClient({ credentials, dryRun: true });
  // No sparse fieldset, and the state is read through the shared helper. This
  // asked Apple for `appStoreVersionState` — the deprecated ENUM's name, never
  // an attribute — and got `HTTP 400: not a valid field name` every time. It
  // then matched only READY_FOR_SALE, which Apple renamed to
  // READY_FOR_DISTRIBUTION, so it would have found nothing even had it parsed.
  const versions = await client.getAll(
    `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=200`,
  );
  const live = versions.find((v) => RELEASED_STATES.has(versionStateOf(v)));
  return live?.attributes?.versionString ?? null;
}

// ---- Google Play: JWT-bearer OAuth2, RS256 (Node's native RSA signer — no
// googleapis dependency, mirroring how ascClient.mjs hand-rolls ES256). -----

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function loadPlayServiceAccount() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    warn('[google play] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is set but is not valid JSON.');
    return null;
  }
}

async function playAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), serviceAccount.private_key);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth token exchange failed: HTTP ${res.status} ${await res.text()}`);
  const body = await res.json();
  return body.access_token;
}

/** The live Google Play production-track version name, or null if unavailable. */
async function fetchLivePlayVersion(packageName) {
  const serviceAccount = loadPlayServiceAccount();
  if (!serviceAccount) {
    warn('[google play] skipped — GOOGLE_PLAY_SERVICE_ACCOUNT_JSON missing.');
    return null;
  }
  const token = await playAccessToken(serviceAccount);
  const authHeader = { Authorization: `Bearer ${token}` };
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}`;

  // Reading a track requires an open edit. It is never committed — the edit
  // expires on its own (~1h of inactivity) and nothing about the listing
  // changes from opening one.
  const editRes = await fetch(`${base}/edits`, { method: 'POST', headers: authHeader });
  if (!editRes.ok) throw new Error(`Google Play edits.insert failed: HTTP ${editRes.status} ${await editRes.text()}`);
  const { id: editId } = await editRes.json();

  try {
    const trackRes = await fetch(`${base}/edits/${editId}/tracks/production`, { headers: authHeader });
    if (!trackRes.ok) {
      throw new Error(`Google Play tracks.get failed: HTTP ${trackRes.status} ${await trackRes.text()}`);
    }
    const track = await trackRes.json();
    const completed = (track.releases ?? []).find((r) => r.status === 'completed');
    // `name` is the release name (typically the versionName); versionCodes
    // is the only field guaranteed present, so fall back to it.
    return completed?.name ?? completed?.versionCodes?.[0] ?? null;
  } finally {
    // Best-effort cleanup; an abandoned edit is harmless either way.
    fetch(`${base}/edits/${editId}`, { method: 'DELETE', headers: authHeader }).catch(() => {});
  }
}

async function postToDiscord(payload) {
  const webhook = process.env.DISCORD_WEBHOOK_UPDATES;
  if (!webhook) {
    warn('DISCORD_WEBHOOK_UPDATES is not set — printing the post instead of sending it.');
    log(JSON.stringify(payload, null, 2));
    return;
  }
  if (DRY_RUN) {
    log('[dry-run] would POST to Discord:', JSON.stringify(payload, null, 2));
    return;
  }
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord webhook post failed: HTTP ${res.status} ${await res.text()}`);
}

async function main() {
  const { APPLE } = await import(path.join(ROOT, 'marketing/aso/metadata.mjs'));
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  // app.config.js hardcodes the Android package (see its android.package
  // field) rather than reading it from eas.json, so this does too — there is
  // no single JSON source for it in this repo.
  const androidPackage = eas?.submit?.production?.android?.applicationId ?? 'com.deeplife.simulator';

  const state = readState();
  const results = await Promise.allSettled([
    fetchLiveAppStoreVersion(),
    fetchLivePlayVersion(androidPackage),
  ]);

  const [appStore, googlePlay] = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  results.forEach((r, i) => {
    if (r.status === 'rejected') warn(`[${i === 0 ? 'app store' : 'google play'}] error:`, r.reason?.message ?? r.reason);
  });

  let posted = false;

  if (state._isFirstRun) {
    log('No prior state found — seeding baseline from the current live versions without posting.');
    if (appStore) state.appStoreVersion = appStore;
    if (googlePlay) state.googlePlayVersion = googlePlay;
    delete state._isFirstRun;
    if (!DRY_RUN) writeState(state);
    return;
  }

  if (appStore && appStore !== state.appStoreVersion) {
    log(`New live App Store version: ${appStore} (was ${state.appStoreVersion ?? 'none recorded'})`);
    const payload = renderReleasePost({ storeVersion: appStore, whatsNew: APPLE.whatsNew });
    await postToDiscord(payload);
    state.appStoreVersion = appStore;
    posted = true;
  } else {
    log(`App Store: ${appStore ?? 'unknown'} (no change).`);
  }

  if (googlePlay && String(googlePlay) !== String(state.googlePlayVersion)) {
    log(`New live Google Play release: ${googlePlay} (was ${state.googlePlayVersion ?? 'none recorded'})`);
    // Google Play doesn't get its own embed shape yet — reuse the App Store
    // copy's "what's new" text under a Play-flavoured headline so both stores
    // read the same announcement without inventing a second template.
    const payload = renderReleasePost({ storeVersion: String(googlePlay), whatsNew: APPLE.whatsNew });
    payload.embeds[0].title = `🚀 Deep Life Simulator ${googlePlay} is live on Google Play`;
    await postToDiscord(payload);
    state.googlePlayVersion = googlePlay;
    posted = true;
  } else {
    log(`Google Play: ${googlePlay ?? 'unknown'} (no change).`);
  }

  if (posted && !DRY_RUN) writeState(state);
  if (!posted) log('Nothing new to announce.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
