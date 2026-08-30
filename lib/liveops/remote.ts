/**
 * Remote content - shipping events without shipping a build.
 *
 * THE CONTRACT, IN ONE LINE: the network can only ever ADD events or TAKE THEM
 * AWAY. It can never break the game, never exceed a reward cap, and never
 * execute anything.
 *
 * WHY THAT IS ENFORCEABLE HERE. A definition is pure data whose objectives are
 * ids into a compiled-in registry (`objectives.ts`), so the most a payload can
 * express is a combination of reads this binary already performs. Everything
 * else - the caps, the window bounds, the schema version - is checked by
 * `validateEventDefinition` before a definition reaches a player, and a
 * definition that fails is dropped INDIVIDUALLY. One bad event costs that
 * event, never the calendar.
 *
 * THE FALLBACK LADDER (33). Three rungs, and the game is fully playable on the
 * bottom one:
 *
 *   fresh remote payload  ->  last VALID cached payload  ->  LOCAL_EVENTS
 *
 * The cache stores only definitions that already passed validation, so a
 * corrupted cache and an empty cache behave identically. Nothing here is
 * awaited on the boot path: the local catalogue is available synchronously and
 * the remote layer upgrades it when and if it arrives.
 *
 * THE KILL SWITCH (36). `disabledEventIds` removes a specific event, local or
 * remote, and `paused` takes the whole system off the air. Both are read from
 * the payload BEFORE the definitions are merged, so disabling a broken event is
 * one field change and does not require re-authoring anything. Critically,
 * disable is also honoured from the CACHE - so an event killed while the player
 * was online stays killed on their next offline launch.
 *
 * WHAT REMOTE CONTENT MUST NEVER DO, and does not: change balance constants,
 * change prices, change feature flags, or supply anything that is evaluated.
 * The M9 analytics doc records why this app is careful here - the economy is
 * gated on game state precisely because externally supplied and device-clock
 * values have been exploitable five times over.
 */
import { logger } from '@/utils/logger';
import { analyticsStorage, readJsonRecord } from '@/lib/analytics/storage';
import { LOCAL_EVENTS } from './catalogue';
import { selectValidEvents } from './validation';
import type { LiveEventDefinition } from './types';

/** AsyncStorage key. Versioned, so a shape change is a new key. */
export const LIVEOPS_CACHE_KEY = 'liveops_content_cache_v1';

/** How long a fetch may take before it is abandoned. */
const FETCH_TIMEOUT_MS = 8_000;

/** How long a cached payload stays usable. Beyond this the local catalogue wins. */
export const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** What a payload may contain. Everything is optional; an empty payload is valid. */
export interface LiveOpsPayload {
  /** Additional or overriding event definitions. */
  events?: unknown;
  /** Event ids to remove, whatever their source. The per-event kill switch. */
  disabledEventIds?: unknown;
  /** Takes the whole system off the air. The global kill switch. */
  paused?: unknown;
}

/** A validated payload, plus what was thrown away getting there. */
export interface ResolvedContent {
  events: LiveEventDefinition[];
  disabledEventIds: string[];
  paused: boolean;
  /** Which rung of the fallback ladder produced this. */
  source: 'remote' | 'cache' | 'local';
  /** Definitions dropped by validation, for the debug surface and the logs. */
  rejected: { id: string; problems: string[] }[];
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v) : [];

/**
 * Turn a raw payload into usable content.
 *
 * PURE and exported, because this is where all the safety lives and it must be
 * testable without a network or a storage mock. `fetchLiveOpsContent` is a thin
 * wrapper that decides which raw object to hand this.
 *
 * Remote definitions come FIRST in the merge, and `selectValidEvents` keeps the
 * first of any duplicate id. That ordering is the whole point of remote content:
 * an operator can correct a shipped event by re-publishing its id, without an
 * app update and without waiting for one.
 */
export function resolvePayload(
  payload: unknown,
  source: ResolvedContent['source'],
): ResolvedContent {
  const raw = (payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {}) as LiveOpsPayload;

  const paused = raw.paused === true;
  const disabledEventIds = stringArray(raw.disabledEventIds);

  // Remote first, local second - see above.
  const remoteEvents = Array.isArray(raw.events) ? raw.events : [];
  const { valid, rejected } = selectValidEvents([...remoteEvents, ...LOCAL_EVENTS]);

  const disabled = new Set(disabledEventIds);
  const events = paused ? [] : valid.filter((e) => !disabled.has(e.id));

  return { events, disabledEventIds, paused, source, rejected };
}

/** The answer with no network and no cache: the compiled-in catalogue. */
export function localContent(): ResolvedContent {
  return resolvePayload({}, 'local');
}

interface CachedEnvelope {
  fetchedAt: number;
  payload: unknown;
}

/**
 * Fetch, validate, cache and return.
 *
 * NEVER THROWS and never rejects. Every failure path - no endpoint, a timeout,
 * a non-2xx, unparseable JSON, storage unavailable - lands on the next rung of
 * the ladder. A live-ops system that can fail a boot is worse than one that
 * ships no events.
 *
 * The cache is written only for a payload that produced at least one valid
 * event OR carried a kill switch. Caching an empty, meaningless response would
 * let one bad deploy poison the cache and take the calendar down for two weeks
 * even after the server recovered.
 */
export async function fetchLiveOpsContent(
  endpoint: string | null | undefined = process.env.EXPO_PUBLIC_LIVEOPS_URL,
): Promise<ResolvedContent> {
  const cached = await readCache();

  if (endpoint) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response && response.ok) {
        const payload: unknown = await response.json();
        const resolved = resolvePayload(payload, 'remote');
        if (resolved.rejected.length > 0) {
          // Logged, not silent: a rejected definition means someone published
          // something that will never reach a player, and the only place that
          // is visible is here.
          logger.warn('[liveops] dropped invalid remote definitions', {
            rejected: resolved.rejected,
          });
        }
        if (resolved.events.length > 0 || resolved.paused || resolved.disabledEventIds.length > 0) {
          void writeCache(payload);
        }
        return resolved;
      }
    } catch (error) {
      logger.debug('[liveops] remote fetch failed (falling back)', { error });
    } finally {
      clearTimeout(timer);
    }
  }

  if (cached) return cached;
  return localContent();
}

/** The cached payload, if one is present, valid and not stale. */
async function readCache(): Promise<ResolvedContent | null> {
  try {
    const record = await readJsonRecord(LIVEOPS_CACHE_KEY);
    if (!record) return null;
    const envelope = record as unknown as CachedEnvelope;
    if (typeof envelope.fetchedAt !== 'number' || !Number.isFinite(envelope.fetchedAt)) return null;

    const age = Date.now() - envelope.fetchedAt;
    // A NEGATIVE age means the device clock moved backwards since the write.
    // Treated as fresh rather than stale: the content was valid when it was
    // fetched, and expiring it would let a clock scrub take the calendar away.
    if (age > CACHE_MAX_AGE_MS) return null;

    const resolved = resolvePayload(envelope.payload, 'cache');
    return resolved.events.length > 0 || resolved.paused ? resolved : null;
  } catch (error) {
    logger.debug('[liveops] cache read failed (ignored)', { error });
    return null;
  }
}

async function writeCache(payload: unknown): Promise<void> {
  try {
    const envelope: CachedEnvelope = { fetchedAt: Date.now(), payload };
    await analyticsStorage.setItem(LIVEOPS_CACHE_KEY, JSON.stringify(envelope));
  } catch (error) {
    logger.debug('[liveops] cache write failed (ignored)', { error });
  }
}
