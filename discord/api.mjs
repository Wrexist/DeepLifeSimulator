/**
 * The Discord REST client.
 *
 * Deliberately dependency-free — Node 22 has `fetch`, and the alternative is
 * pulling a gateway library and its transitive tree into a React Native app's
 * lockfile to make about a dozen HTTP calls that never need a socket.
 *
 * Two things here are not optional and are easy to leave out:
 *
 *   **Rate limits.** Building this server is roughly fifty writes in a row and
 *   Discord's channel bucket is small. Without backoff the run dies about a
 *   third of the way in, having already created a third of the server — so the
 *   client waits on `retry_after` and pre-empts the bucket when the headers say
 *   the next call would 429.
 *
 *   **`dryRun` on the CLIENT, not the call site.** A guard every caller must
 *   remember is a guard one caller eventually forgets, and forgetting it here
 *   rewrites a live community server. Same reasoning as
 *   `scripts/lib/ascClient.mjs`, which this follows.
 *
 * Nothing in this file logs the token, and diagnostics go to stderr so stdout
 * stays a clean value contract for `--json`.
 */

const API = 'https://discord.com/api/v10';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 5;

/** A Discord API error carrying Discord's own error body. */
export class DiscordApiError extends Error {
  constructor(status, payload, method, path) {
    const detail = payload?.message
      ? `${payload.message}${payload.code ? ` (code ${payload.code})` : ''}`
      : '(no error body)';
    super(`Discord ${method} ${path} → HTTP ${status}: ${detail}`);
    this.name = 'DiscordApiError';
    this.status = status;
    this.code = payload?.code;
    this.payload = payload;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class DiscordClient {
  /**
   * @param {{
   *   token?: string,
   *   guildId?: string,
   *   dryRun?: boolean,
   *   timeoutMs?: number,
   *   fetchImpl?: Function,
   *   sleepImpl?: Function,
   *   log?: Function,
   *   reason?: string,
   * }} [options]
   */
  constructor({ token, guildId, dryRun = false, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch, sleepImpl = sleep, log, reason = 'discord:sync' } = {}) {
    this.token = token;
    this.guildId = guildId;
    this.dryRun = dryRun;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
    this.sleep = sleepImpl;
    this.reason = reason;
    this.log = log ?? ((...a) => console.error('[discord]', ...a));
    /** Every write this client made, or would have made. In order. */
    this.writes = [];
    this._dryIds = 0;
  }

  /**
   * In a dry run a write returns a SYNTHETIC object rather than null.
   *
   * A create whose id comes back null cannot be a parent, cannot be linked from
   * a document and cannot be named in an onboarding prompt, so a null would cut
   * the plan short at the first new channel and print something far less useful
   * than the run it is previewing. The fake ids are obvious on sight (`dry:7`)
   * and never leave the process.
   */
  _dryResult(body) {
    return { id: `dry:${++this._dryIds}`, ...(body ?? {}) };
  }

  async request(method, path, body = undefined, { allowNotFound = false } = {}) {
    const isWrite = method !== 'GET';
    if (isWrite && this.dryRun) {
      this.writes.push({ method, path, body });
      return this._dryResult(body);
    }

    const url = path.startsWith('http') ? path : `${API}${path}`;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bot ${this.token}`,
            'Content-Type': 'application/json',
            // Discord documents this as required for bots and some edges
            // enforce it. A missing one fails as a 403 that reads like an auth
            // problem, which sends you looking at the token.
            'User-Agent': 'DeepLifeSimulator-DiscordSync (https://github.com/Wrexist/DeepLifeSimulator, 1.0)',
            ...(isWrite ? { 'X-Audit-Log-Reason': this.reason } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timer);
        if (error?.name === 'AbortError') throw new Error(`Discord ${method} ${path} timed out after ${this.timeoutMs}ms`);
        if (attempt === MAX_ATTEMPTS) throw error;
        await this.sleep(2 ** attempt * 250);
        continue;
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 429) {
        const retry = await this._retryAfter(response);
        this.log(`rate limited on ${method} ${path} — waiting ${retry}ms (attempt ${attempt}/${MAX_ATTEMPTS})`);
        await this.sleep(retry);
        continue;
      }

      // 5xx from Discord is usually transient and usually resolves inside a
      // couple of seconds. Retrying it is the difference between a sync that
      // finishes and one that leaves the server half-built.
      if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
        await this.sleep(2 ** attempt * 250);
        continue;
      }

      if (response.status === 404 && allowNotFound) return null;
      if (response.status === 204) {
        if (isWrite) this.writes.push({ method, path, body });
        return null;
      }

      const text = await response.text();
      let payload = null;
      if (text) {
        try { payload = JSON.parse(text); } catch { payload = null; }
      }

      if (!response.ok) throw new DiscordApiError(response.status, payload, method, path);
      if (isWrite) this.writes.push({ method, path, body });

      // Spend the bucket down before the next call rather than after a 429.
      // The reactive path costs a wasted round trip and a full `retry_after`
      // wait every time; this costs the few hundred milliseconds Discord asked
      // for, and only when the bucket is actually empty.
      await this._respectBucket(response);
      return payload;
    }

    throw new Error(`Discord ${method} ${path} failed after ${MAX_ATTEMPTS} attempts`);
  }

  async _retryAfter(response) {
    let seconds = Number(response.headers?.get?.('retry-after') ?? 0);
    try {
      const body = await response.clone?.().json?.();
      if (body?.retry_after) seconds = Number(body.retry_after);
    } catch { /* header value stands */ }
    // A floor, because Discord sometimes answers 0 and an immediate retry is
    // just another 429.
    return Math.max(1000, Math.ceil(seconds * 1000) + 250);
  }

  async _respectBucket(response) {
    const remaining = Number(response.headers?.get?.('x-ratelimit-remaining') ?? NaN);
    const resetAfter = Number(response.headers?.get?.('x-ratelimit-reset-after') ?? NaN);
    if (remaining === 0 && Number.isFinite(resetAfter) && resetAfter > 0) {
      await this.sleep(Math.ceil(resetAfter * 1000) + 100);
    }
  }

  get(path, options) { return this.request('GET', path, undefined, options); }
  post(path, body) { return this.request('POST', path, body); }
  patch(path, body) { return this.request('PATCH', path, body); }
  put(path, body) { return this.request('PUT', path, body); }

  // ── Guild ──────────────────────────────────────────────────────────────
  /** The bot's own user, which is also the cheapest way to prove the token works. */
  me() { return this.get('/users/@me'); }
  guild() { return this.get(`/guilds/${this.guildId}`); }
  /** The bot's member record — `roles` is what tells us whether it can actually write. */
  selfMember() { return this.get(`/guilds/${this.guildId}/members/@me`, { allowNotFound: true }); }

  roles() { return this.get(`/guilds/${this.guildId}/roles`); }
  createRole(body) { return this.post(`/guilds/${this.guildId}/roles`, body); }
  updateRole(id, body) { return this.patch(`/guilds/${this.guildId}/roles/${id}`, body); }

  channels() { return this.get(`/guilds/${this.guildId}/channels`); }
  createChannel(body) { return this.post(`/guilds/${this.guildId}/channels`, body); }
  updateChannel(id, body) { return this.patch(`/channels/${id}`, body); }
  /** One request for the whole layout — see `planPositions` for why. */
  setPositions(entries) { return this.patch(`/guilds/${this.guildId}/channels`, entries); }

  // ── Messages ───────────────────────────────────────────────────────────
  messages(channelId, limit = 50) { return this.get(`/channels/${channelId}/messages?limit=${limit}`); }
  createMessage(channelId, body) { return this.post(`/channels/${channelId}/messages`, body); }
  editMessage(channelId, messageId, body) { return this.patch(`/channels/${channelId}/messages/${messageId}`, body); }
  pinMessage(channelId, messageId) { return this.put(`/channels/${channelId}/pins/${messageId}`, undefined); }
  /**
   * Push an announcement-channel post to every server that follows this one.
   * Only valid in an announcement channel; a text channel answers 400.
   */
  crosspost(channelId, messageId) { return this.post(`/channels/${channelId}/messages/${messageId}/crosspost`, {}); }

  // ── Onboarding ─────────────────────────────────────────────────────────
  onboarding() { return this.get(`/guilds/${this.guildId}/onboarding`, { allowNotFound: true }); }
  setOnboarding(body) { return this.put(`/guilds/${this.guildId}/onboarding`, body); }
}

/**
 * Read the token from the environment.
 *
 * Absent is a normal answer, not a crash: `validate` and a dry-run `sync` are
 * both useful without one, and the commands that genuinely need it say so by
 * name rather than failing on a 401.
 */
export function loadToken(env = process.env) {
  const token = env.DISCORD_BOT_TOKEN;
  return token && token.trim() ? token.trim() : null;
}

export function loadGuildId(env = process.env) {
  const id = env.DISCORD_GUILD_ID;
  return id && id.trim() ? id.trim() : null;
}
