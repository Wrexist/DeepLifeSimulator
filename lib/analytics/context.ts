/**
 * The common event envelope — the properties EVERY analytics event carries.
 *
 * WHY THIS EXISTS. Until now an event carried its name, a timestamp, an install
 * id and a session id, and nothing else. That is enough to count events and
 * nothing more: a regression in 2.9.0 and a regression in 2.8.1 arrive in the
 * same bucket, an iOS-only crash-adjacent funnel drop looks like a global one,
 * and a schema change made in this release is indistinguishable downstream from
 * the shape that preceded it. Every one of those questions is answered by four
 * fields that cost one read at boot.
 *
 * WHAT IT DELIBERATELY DOES NOT CARRY. No advertising id, no device id, no
 * vendor identifier, no locale-derived geography, no model string precise
 * enough to narrow a population. `platform` and `osMajor` are coarse on
 * purpose: "ios / 26" answers "is this an OS regression", which is the only
 * question the envelope is here to answer, while "iPhone17,2 / 26.1.1" would
 * additionally narrow a user. Privacy review lives in `docs/ANALYTICS.md`.
 *
 * HOW IT IS READ. `expo-constants` is a native module, and this repo has an
 * iOS 26 TurboModule crash in its history (CLAUDE.md §4.6) — so the read is
 * lazy, inside try/catch, cached after the first success, and degrades to
 * `'unknown'` rather than throwing. Resolution never blocks: an envelope we
 * cannot build is an envelope of unknowns attached to a real event, never a
 * dropped event and never a failed boot.
 */
import { Platform } from 'react-native';

/**
 * Schema version of the ENVELOPE, not of any one event.
 *
 * Bump it when a field here is added, removed or changes meaning, so a query
 * written against the old shape can exclude the new one rather than silently
 * averaging two different definitions together (§42). Per-event property
 * changes carry their own `eventVersion`; this number is about the envelope.
 */
export const ANALYTICS_SCHEMA_VERSION = 1;

export interface AnalyticsContext {
  /** Envelope schema version. */
  schemaVersion: number;
  /** Marketing version from package.json via app.config.js (CLAUDE.md §9). */
  appVersion: string;
  /** CFBundleVersion / versionCode — distinguishes two builds of one version. */
  buildNumber: string;
  /** 'ios' | 'android' | 'web'. */
  platform: string;
  /** Major OS version only. Coarse on purpose — see the header. */
  osMajor: string;
}

/**
 * The envelope as it is attached to an event, plus the experiment arms this
 * install is in. Assignments ride on EVERY event rather than only on
 * `experiment_exposed`, so any metric in the catalogue can be split by arm with
 * a filter instead of a join back to an exposure table — which is the
 * difference between an experiment readout taking a minute and taking a day.
 */
export interface AnalyticsEventContext extends AnalyticsContext {
  /** Comma-joined `experimentId:variantId`. Absent when nothing is running. */
  experiments?: string;
}

const UNKNOWN = 'unknown';

let cached: AnalyticsContext | null = null;

/** Read one value behind a try/catch, falling back rather than throwing. */
function safe<T>(read: () => T, fallback: T): T {
  try {
    const value = read();
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

/**
 * Lazily require expo-constants. Native module, so never at module top level
 * (CLAUDE.md §4.6) and never retried in a tight loop — one failure means the
 * module is absent for this process.
 */
let constantsAttempted = false;
let constantsModule: { expoConfig?: Record<string, unknown> } | null = null;

function loadConstants(): { expoConfig?: Record<string, unknown> } | null {
  if (constantsModule) return constantsModule;
  if (constantsAttempted) return null;
  constantsAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants');
    constantsModule = (mod?.default ?? mod) as { expoConfig?: Record<string, unknown> };
    return constantsModule;
  } catch {
    return null;
  }
}

/** Major component of an OS version string ('26.1.1' → '26'). */
export function majorVersion(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(Math.trunc(raw));
  if (typeof raw !== 'string') return UNKNOWN;
  const match = raw.trim().match(/^(\d+)/);
  return match ? match[1] : UNKNOWN;
}

/**
 * Build (and cache) the envelope.
 *
 * Cached because none of these can change inside a process: the binary cannot
 * be swapped under a running app, and the OS cannot be upgraded beneath it.
 * Re-reading per event would put a native bridge call on the hot path of every
 * `track()` for a value that is constant by construction.
 */
export function getAnalyticsContext(): AnalyticsContext {
  if (cached) return cached;

  const constants = loadConstants();
  const expoConfig = (constants?.expoConfig ?? undefined) as
    | {
        version?: string;
        ios?: { buildNumber?: string };
        android?: { versionCode?: number };
      }
    | undefined;

  const platform = safe(() => String(Platform.OS), UNKNOWN);

  const buildNumber = safe(() => {
    // iOS reports CFBundleVersion; Android reports versionCode. Report whichever
    // applies so an Android-only regression is still traceable to a build.
    if (platform === 'android') {
      const code = expoConfig?.android?.versionCode;
      return code === undefined || code === null ? UNKNOWN : String(code);
    }
    const build = expoConfig?.ios?.buildNumber;
    return build ? String(build) : UNKNOWN;
  }, UNKNOWN);

  cached = {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    appVersion: safe(() => expoConfig?.version || UNKNOWN, UNKNOWN),
    buildNumber,
    platform,
    osMajor: majorVersion(safe<unknown>(() => Platform.Version, undefined)),
  };
  return cached;
}

/** Test hook — drops the cache so a test can re-read under a different mock. */
export function resetAnalyticsContextCache(): void {
  cached = null;
  constantsAttempted = false;
  constantsModule = null;
}
