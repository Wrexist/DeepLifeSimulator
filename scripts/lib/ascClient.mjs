// scripts/lib/ascClient.mjs
//
// The one App Store Connect API client in this repo.
//
// It exists because there were about to be two. `next-build-number.mjs` grew a
// working ES256 JWT signer and an https call to look up the highest build, and
// the release script needs the same auth against the same host. Two
// implementations of one auth path is how they drift — one gets the p8-as-
// base64 handling and the other does not, one sets a timeout and the other
// hangs a build. Both callers now share this.
//
// Auth notes that are easy to get wrong and expensive to debug, because Apple
// answers every one of them with the same opaque 401:
//   • ES256 is ECDSA P-256/SHA-256, and JWT wants the raw r||s signature.
//     Node's default is DER, so `dsaEncoding: 'ieee-p1363'` is not optional.
//   • `aud` is the literal string 'appstoreconnect-v1'.
//   • Apple rejects a token whose lifetime exceeds 20 minutes.
//
// Nothing here prints a token, a key, or an Authorization header. Diagnostics
// go to stderr so a script's stdout stays a clean value contract.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { Buffer } from 'node:buffer';

/**
 * Overridable so the CLI can be driven end to end against a stub. There is no
 * other way to exercise the orchestration — the alternative is pointing a test
 * at the real API, which would create version records on the live app.
 */
export const ASC_HOST = process.env.ASC_API_BASE || 'https://api.appstoreconnect.apple.com';

/** Apple rejects anything longer; 20 min is the documented ceiling. */
const TOKEN_TTL_SECONDS = 20 * 60;
const DEFAULT_TIMEOUT_MS = 30_000;

/** An App Store Connect API error carrying Apple's own error objects. */
export class AscApiError extends Error {
  constructor(status, errors, method, path) {
    const detail = errors.length
      ? errors.map((e) => `${e.title ?? e.code ?? 'error'}: ${e.detail ?? ''}`.trim()).join(' | ')
      : '(no error body)';
    super(`App Store Connect ${method} ${path} → HTTP ${status}: ${detail}`);
    this.name = 'AscApiError';
    this.status = status;
    this.errors = errors;
  }
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Reads the .p8 private key, accepting either raw PEM or base64-encoded PEM.
 * The base64 form is how a multi-line key survives being pasted into a CI
 * secret, so both have to work or half the callers break.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | null}
 */
export function loadPrivateKey(env = process.env) {
  const inline = env.ASC_KEY_P8;
  const file = env.ASC_KEY_P8_PATH;
  let raw = null;
  if (inline && inline.trim()) raw = inline;
  else if (file && fs.existsSync(file)) raw = fs.readFileSync(file, 'utf8');
  if (!raw) return null;
  raw = raw.trim();
  if (!raw.includes('BEGIN')) {
    // Only ACCEPT the decode if it produced something PEM-shaped. Buffer's
    // base64 decoder never throws — it discards what it cannot parse — so a
    // malformed secret decodes to '' and would otherwise be reported as the
    // key being ABSENT, sending someone to set a variable they already set.
    // Keeping the original makes the key parser raise a real decode error.
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.includes('BEGIN')) raw = decoded;
  }
  return raw;
}

/**
 * The three credentials, or null when any is missing. Null is a normal answer,
 * not a failure: callers decide whether to degrade (build numbers fall back to
 * epoch) or stop (the release script cannot do anything useful).
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function loadCredentials(env = process.env) {
  const keyId = env.ASC_KEY_ID;
  const issuerId = env.ASC_ISSUER_ID;
  const privateKey = loadPrivateKey(env);
  if (!keyId || !issuerId || !privateKey) return null;
  return { keyId, issuerId, privateKey };
}

/**
 * Names whichever credentials are absent, for an actionable error message.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function missingCredentialNames(env = process.env) {
  const missing = [];
  if (!env.ASC_KEY_ID) missing.push('ASC_KEY_ID');
  if (!env.ASC_ISSUER_ID) missing.push('ASC_ISSUER_ID');
  if (!loadPrivateKey(env)) missing.push('ASC_KEY_P8 (or ASC_KEY_P8_PATH)');
  return missing;
}

export function makeToken({ keyId, issuerId, privateKey }, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: issuerId,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    aud: 'appstoreconnect-v1',
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey({ key: privateKey, format: 'pem' });
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * A thin JSON:API client.
 *
 * `dryRun` is a property of the CLIENT rather than of each call site on
 * purpose. A mutation guard that every caller has to remember to pass is a
 * guard that one caller eventually forgets, and the cost of forgetting here is
 * a write to a live App Store listing. In dry-run every non-GET is recorded and
 * returns null instead of going out, so a caller written against the real
 * client works unchanged.
 */
export class AscClient {
  /**
   * @param {{
   *   credentials?: { keyId: string, issuerId: string, privateKey: string },
   *   dryRun?: boolean,
   *   timeoutMs?: number,
   *   fetchImpl?: Function,
   *   log?: Function,
   * }} [options]
   */
  constructor({ credentials, dryRun = false, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch, log } = {}) {
    this.credentials = credentials;
    this.dryRun = dryRun;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
    this.log = log ?? ((...a) => console.error('[asc]', ...a));
    /** Every write this client would have made, in order. */
    this.plannedWrites = [];
    this._token = null;
    this._tokenExpiry = 0;
  }

  token() {
    const now = Math.floor(Date.now() / 1000);
    // Re-mint a minute early so a long run cannot post an expired token.
    if (!this._token || now >= this._tokenExpiry - 60) {
      this._token = makeToken(this.credentials, now);
      this._tokenExpiry = now + TOKEN_TTL_SECONDS;
    }
    return this._token;
  }

  async request(method, path, body = undefined) {
    const isWrite = method !== 'GET';
    if (isWrite && this.dryRun) {
      this.plannedWrites.push({ method, path, body });
      return null;
    }

    const url = path.startsWith('http') ? path : `${ASC_HOST}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token()}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`App Store Connect ${method} ${path} timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }

    // 204 is the documented success for a DELETE and for some relationship
    // updates; it has no body to parse.
    if (response.status === 204) return null;

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      throw new AscApiError(response.status, payload?.errors ?? [], method, path);
    }
    return payload;
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  patch(path, body) {
    return this.request('PATCH', path, body);
  }

  /**
   * Follows `links.next` to the end. Apple pages at 200 max, and a long-lived
   * app has more versions and builds than that, so a first-page-only read would
   * silently answer from a subset — which for "what is the highest released
   * version" is worse than not answering.
   */
  async getAll(path) {
    const items = [];
    let next = path;
    while (next) {
      const page = await this.get(next);
      if (Array.isArray(page?.data)) items.push(...page.data);
      next = page?.links?.next ?? null;
    }
    return items;
  }
}
