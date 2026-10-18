// scripts/lib/playRelease.mjs
//
// Google Play release plumbing: the service-account token, a tiny Android
// Publisher client, and the pure pieces scripts/play-release.mjs plans with.
//
// Why it exists: every Android build so far went to the internal or beta track
// through `eas submit`, and production was reached by hand in the Play Console.
// Promoting a build that is ALREADY on internal testing needs no rebuild (the
// local Android build is ~45 minutes), only a track update, which is what this
// does — the same bundle Google has already accepted, moved to another track.
//
// Auth notes that are easy to get wrong:
//   • The token exchange is a JWT bearer grant: RS256 over the service
//     account's own private key, `aud` = the token endpoint, the
//     androidpublisher scope. The access token then goes in Authorization.
//   • Every change goes through an EDIT: create, change, then validate (dry)
//     or commit. An edit that is never committed changes nothing, which is
//     what makes the plan mode safe.
//
// Nothing here prints a token, a key, or an Authorization header.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { Buffer } from 'node:buffer';

export const PLAY_PACKAGE = process.env.PLAY_PACKAGE_NAME || 'com.deeplife.simulator';
export const PLAY_API = process.env.PLAY_API_BASE || 'https://androidpublisher.googleapis.com/androidpublisher/v3';
export const TOKEN_URL = process.env.PLAY_TOKEN_URL || 'https://oauth2.googleapis.com/token';
export const PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/** Play's per-language cap on "What's new in this release". */
export const RELEASE_NOTES_LIMIT = 500;

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * @typedef {{ language: string, text: string }} ReleaseNote
 * @typedef {{ name?: string, versionCodes?: string[], status?: string, userFraction?: number, releaseNotes?: ReleaseNote[] }} TrackRelease
 * @typedef {{ track?: string, releases?: TrackRelease[] }} Track
 */

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * The service account, from GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the file's
 * contents, which is how the repo secret holds it) or a path in
 * GOOGLE_PLAY_SERVICE_ACCOUNT_PATH. Returns null when neither is set.
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ clientEmail: string, privateKey: string } | null}
 */
export function loadServiceAccount(env = process.env) {
  let raw = env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw && env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH) {
    raw = fs.readFileSync(env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH, 'utf8');
  }
  if (!raw) return null;
  const json = JSON.parse(raw);
  if (!json.client_email || !json.private_key) {
    throw new Error('The service-account JSON has no client_email or private_key.');
  }
  return { clientEmail: json.client_email, privateKey: json.private_key };
}

/** The signed JWT exchanged for an access token. */
export function makeAssertion({ clientEmail, privateKey }, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: clientEmail,
    scope: PLAY_SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), privateKey);
  return `${header}.${claims}.${base64url(signature)}`;
}

/** A Play API error carrying Google's own message. */
export class PlayApiError extends Error {
  constructor(status, message, method, path) {
    super(`Google Play ${method} ${path} → HTTP ${status}: ${message}`);
    this.name = 'PlayApiError';
    this.status = status;
  }
}

export class PlayClient {
  constructor({ account, packageName = PLAY_PACKAGE, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.account = account;
    this.packageName = packageName;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.token = null;
  }

  async authorize() {
    if (this.token) return this.token;
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: makeAssertion(this.account),
    });
    const res = await this.fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      throw new PlayApiError(res.status, json.error_description || json.error || 'token exchange failed', 'POST', TOKEN_URL);
    }
    this.token = json.access_token;
    return this.token;
  }

  /** `path` is relative to /applications/{package}. */
  async request(method, path, body = undefined) {
    const token = await this.authorize();
    const url = `${PLAY_API}/applications/${this.packageName}${path}`;
    const res = await this.fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new PlayApiError(res.status, json.error?.message || text || '(no body)', method, path);
    return json;
  }

  createEdit() { return this.request('POST', '/edits', {}); }
  deleteEdit(editId) { return this.request('DELETE', `/edits/${editId}`); }
  listTracks(editId) { return this.request('GET', `/edits/${editId}/tracks`); }
  listListings(editId) { return this.request('GET', `/edits/${editId}/listings`); }
  updateTrack(editId, track, releases) {
    return this.request('PUT', `/edits/${editId}/tracks/${track}`, { track, releases });
  }
  validateEdit(editId) { return this.request('POST', `/edits/${editId}:validate`); }
  commitEdit(editId) { return this.request('POST', `/edits/${editId}:commit`); }
}

// ── Pure planning pieces (pinned by __tests__/tooling/playRelease.test.ts) ──

/** The track object for `name`, or null. */
export function findTrack(tracks, name) {
  return (tracks ?? []).find((t) => t.track === name) ?? null;
}

/** The highest versionCode on a track, as a string (Play's own type), or null. */
export function latestVersionCode(track) {
  let best = null;
  for (const release of track?.releases ?? []) {
    for (const code of release.versionCodes ?? []) {
      if (best === null || Number(code) > Number(best)) best = String(code);
    }
  }
  return best;
}

/** The release on a track that carries `versionCode`, or null. */
export function releaseWithVersionCode(track, versionCode) {
  return (track?.releases ?? []).find((r) => (r.versionCodes ?? []).map(String).includes(String(versionCode))) ?? null;
}

/** A rollout fraction Play accepts: 0 < f <= 1. Throws otherwise. */
export function parseRollout(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1) {
    throw new Error(`Rollout must be a fraction above 0 and at most 1 (got "${value}"). 0.2 = 20%, 1 = everyone.`);
  }
  return n;
}

/**
 * Release notes for the languages the Play listing actually has. A language
 * the listing does not carry is dropped rather than sent, so a note never
 * fails the edit; a missing language falls back to the listing's default.
 */
export function releaseNotesFor(notesByLanguage, listingLanguages) {
  const have = new Set(listingLanguages ?? []);
  return Object.entries(notesByLanguage ?? {})
    .filter(([language, text]) => have.has(language) && typeof text === 'string' && text.trim())
    .map(([language, text]) => ({ language, text }));
}

/**
 * The release to put on the target track. Below 1 it is a staged rollout
 * (`inProgress` + `userFraction`); at 1 it is `completed`, which Play requires
 * to carry NO userFraction.
 * @param {{ versionCode: string | number, name?: string, rollout: number, releaseNotes?: ReleaseNote[] }} input
 * @returns {TrackRelease}
 */
export function buildRelease({ versionCode, name, rollout, releaseNotes }) {
  /** @type {TrackRelease} */
  const release = { versionCodes: [String(versionCode)] };
  if (name) release.name = name;
  if (rollout < 1) {
    release.status = 'inProgress';
    release.userFraction = rollout;
  } else {
    release.status = 'completed';
  }
  if (releaseNotes?.length) release.releaseNotes = releaseNotes;
  return release;
}

/** A one-line description of a track, for status output. */
export function describeTrack(track) {
  const releases = (track?.releases ?? []).map((r) => {
    const pct = typeof r.userFraction === 'number' ? ` ${Math.round(r.userFraction * 100)}%` : '';
    return `${r.name ?? '(unnamed)'} [${(r.versionCodes ?? []).join(',')}] ${r.status}${pct}`;
  });
  return `${track?.track ?? '?'}: ${releases.length ? releases.join(' | ') : '(empty)'}`;
}
