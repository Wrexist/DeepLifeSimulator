/**
 * In-App Rating Prompt
 *
 * Asks iOS/Android to show the native "rate this app" sheet, but only at a
 * genuine positive beat (see `utils/reviewMoments.ts`) and only rarely.
 *
 * WHY THE GATING IS THIS STRICT
 * -----------------------------
 * `StoreReview.requestReview()` is a REQUEST, not a command. iOS shows the
 * sheet at most ~3 times per app per 365 days and silently no-ops after that —
 * and the promise resolves either way, so we can never tell whether the player
 * actually saw anything. Two consequences drive the design:
 *
 *  1. Every call is potentially a wasted one of three yearly chances, so the
 *     bar to spend one has to be high.
 *  2. Cooldowns MUST be measured in wall-clock time, not game weeks. A player
 *     can burn 60 in-game weeks in a single sitting; a game-week-only cooldown
 *     (what the previous version of this file used) would spend all three
 *     yearly asks in one evening and then look "broken" for a year.
 *
 * So: wall-clock cooldown is the primary guard, the game-week cooldown is a
 * secondary one that stops a single life asking twice, and there is a
 * once-per-app-session latch on top.
 *
 * TESTING NOTE: on iOS `isAvailableAsync()` resolves FALSE for TestFlight
 * builds — Apple blocks the sheet outside the App Store. A TestFlight build
 * will therefore always log `store-review-unavailable` and show nothing. That
 * is correct behaviour, not a bug; verify the gating via the logs (or the
 * unit tests), and the sheet itself only in an App Store build.
 */

import { Platform } from 'react-native';
import { lazyAsyncStorage as AsyncStorage } from './storageWrapper';
import { logger } from './logger';
import { weeksSinceLifeStart } from './weekCounters';
import type { GameState } from '@/contexts/game/types';
import type { ReviewTrigger } from './reviewMoments';

export type { ReviewTrigger } from './reviewMoments';

const STORAGE_KEY = 'reviewPrompt.v1';
/** Pre-v1 key: a bare game-week number. Read once, then folded into the record. */
const LEGACY_STORAGE_KEY = 'lastReviewPromptWeek';

/** Weeks the player must have lived before we ever consider asking. */
export const MIN_WEEKS_PLAYED = 20;
/**
 * Wall-clock gap between asks. iOS allows ~3 sheets per 365 days; 120 days
 * spaces our attempts so we never burn two on the same allowance window.
 */
export const PROMPT_COOLDOWN_DAYS = 120;
/** Game-week gap, so one long session can't produce two asks. */
export const PROMPT_COOLDOWN_WEEKS = 60;
/**
 * Wall-clock delay between the FIRST qualifying beat and the first ask. Stops
 * a player who imports a save (or blitzes 20 weeks on day one) from being
 * asked minutes after install.
 */
export const MIN_HOURS_BEFORE_FIRST_PROMPT = 24;
/** Lifetime safety net. With a 120-day gap this spans ~1.5 years. */
export const MAX_LIFETIME_PROMPTS = 5;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Why a call did or didn't reach `requestReview()`. Surfaced for logs + tests. */
export type ReviewPromptReason =
  | 'requested'
  | 'unsupported-platform'
  | 'invalid-state'
  | 'not-enough-progress'
  | 'already-asked-this-session'
  | 'settling-in'
  | 'cooldown-wallclock'
  | 'cooldown-gameweeks'
  | 'max-lifetime-prompts'
  | 'store-review-unavailable'
  | 'no-store-action'
  | 'request-failed';

export interface ReviewPromptOutcome {
  /** True only when `requestReview()` was actually called without throwing. */
  requested: boolean;
  reason: ReviewPromptReason;
}

export interface ReviewPromptRecord {
  version: 1;
  /** Epoch ms of the first qualifying beat we ever saw. */
  firstEligibleAt: number;
  /** Epoch ms of the last `requestReview()` call. 0 = never asked. */
  lastPromptAt: number;
  /** `weeksLived` at the last ask. */
  lastPromptWeek: number;
  /** How many times we've asked, ever. */
  promptCount: number;
}

/** Minimal slice of expo-store-review we depend on. */
interface StoreReviewModule {
  isAvailableAsync: () => Promise<boolean>;
  hasAction: () => Promise<boolean>;
  requestReview: () => Promise<void>;
}

/**
 * Once-per-app-session latch. Module scope, so it resets on cold start —
 * exactly the lifetime we want. Set BEFORE awaiting the native call so two
 * beats landing in the same tick can't both get through.
 */
let askedThisSession = false;

function emptyRecord(): ReviewPromptRecord {
  return { version: 1, firstEligibleAt: 0, lastPromptAt: 0, lastPromptWeek: 0, promptCount: 0 };
}

function errorContext(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }
  return { errorValue: String(error) };
}

/** Load expo-store-review lazily — mirrors the storageWrapper pattern so a
 *  missing/failed native module degrades to "no prompt" instead of a crash. */
function loadStoreReview(): StoreReviewModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-store-review');
    if (
      mod &&
      typeof mod.requestReview === 'function' &&
      typeof mod.isAvailableAsync === 'function' &&
      typeof mod.hasAction === 'function'
    ) {
      return mod as StoreReviewModule;
    }
    return null;
  } catch (err) {
    logger.debug('[RatingPrompt] expo-store-review unavailable', errorContext(err));
    return null;
  }
}

async function readRecord(): Promise<ReviewPromptRecord> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReviewPromptRecord>;
      return {
        version: 1,
        firstEligibleAt: Number(parsed?.firstEligibleAt) || 0,
        lastPromptAt: Number(parsed?.lastPromptAt) || 0,
        lastPromptWeek: Number(parsed?.lastPromptWeek) || 0,
        promptCount: Number(parsed?.promptCount) || 0,
      };
    }

    // Migrate the pre-v1 key so players who were (theoretically) prompted by
    // the old code path keep their game-week cooldown. The old code could
    // never actually fire — expo-store-review was not installed — but reading
    // the key is free and makes the migration honest either way.
    const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    const legacyWeek = legacy ? parseInt(legacy, 10) : 0;
    if (Number.isFinite(legacyWeek) && legacyWeek > 0) {
      return { ...emptyRecord(), lastPromptWeek: legacyWeek };
    }
  } catch (err) {
    logger.warn('[RatingPrompt] Failed to read prompt record', errorContext(err));
  }
  return emptyRecord();
}

async function writeRecord(record: ReviewPromptRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (err) {
    // Never fail the caller over telemetry-ish bookkeeping.
    logger.warn('[RatingPrompt] Failed to persist prompt record', errorContext(err));
  }
}

/**
 * Consider showing the native review sheet after a positive beat.
 *
 * Safe to call freely: it is cheap when gated out, never throws, and never
 * blocks the caller on anything the player can see.
 *
 * @param trigger  Which beat prompted this call (logged, not gated on).
 * @param gameState Current state — read for `weeksLived` only.
 */
export async function maybeRequestReview(
  trigger: ReviewTrigger,
  gameState: GameState | null | undefined
): Promise<ReviewPromptOutcome> {
  try {
    // The sheet is a native affordance; there is nothing to show on web.
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return { requested: false, reason: 'unsupported-platform' };
    }

    const weeksLived = gameState?.weeksLived;
    if (typeof weeksLived !== 'number' || !Number.isFinite(weeksLived)) {
      logger.warn('[RatingPrompt] Invalid gameState', { weeksLived });
      return { requested: false, reason: 'invalid-state' };
    }

    // Progress is measured in weeks into THIS life. `weeksLived` is absolute and
    // seeded from the starting age ((age - 18) * 52), so an age-25 scenario read
    // 364 before the player had pressed anything and every "have they played
    // enough to have an opinion" check passed on frame one — the store prompt
    // could fire in the first session. CLAUDE.md §4.2. The cooldown below keeps
    // the ABSOLUTE counter: it is a delta between two stamps, not progress.
    if (weeksSinceLifeStart(weeksLived, gameState?.lifeStartWeek) < MIN_WEEKS_PLAYED) {
      return { requested: false, reason: 'not-enough-progress' };
    }

    if (askedThisSession) {
      return { requested: false, reason: 'already-asked-this-session' };
    }

    const now = Date.now();
    const record = await readRecord();

    // First qualifying beat: remember when, ask on a later one.
    if (record.firstEligibleAt === 0) {
      await writeRecord({ ...record, firstEligibleAt: now });
      return { requested: false, reason: 'settling-in' };
    }
    if (now - record.firstEligibleAt < MIN_HOURS_BEFORE_FIRST_PROMPT * HOUR_MS) {
      return { requested: false, reason: 'settling-in' };
    }

    if (record.promptCount >= MAX_LIFETIME_PROMPTS) {
      return { requested: false, reason: 'max-lifetime-prompts' };
    }

    if (record.lastPromptAt > 0 && now - record.lastPromptAt < PROMPT_COOLDOWN_DAYS * DAY_MS) {
      return { requested: false, reason: 'cooldown-wallclock' };
    }

    if (record.lastPromptWeek > 0 && weeksLived - record.lastPromptWeek < PROMPT_COOLDOWN_WEEKS) {
      return { requested: false, reason: 'cooldown-gameweeks' };
    }

    const StoreReview = loadStoreReview();
    if (!StoreReview) {
      return { requested: false, reason: 'store-review-unavailable' };
    }

    // iOS: false in TestFlight and in the simulator. Android: false below 5.0.
    if (!(await StoreReview.isAvailableAsync())) {
      logger.debug('[RatingPrompt] Store review not available on this build/device');
      return { requested: false, reason: 'store-review-unavailable' };
    }
    if (!(await StoreReview.hasAction())) {
      logger.debug('[RatingPrompt] Store review has no action available');
      return { requested: false, reason: 'no-store-action' };
    }

    // Latch BEFORE the await: a second beat in the same tick must not race in
    // behind this one and spend another of the yearly allowance.
    askedThisSession = true;

    try {
      await StoreReview.requestReview();
    } catch (err) {
      // Unlatch: nothing was shown, so a later beat this session may still try.
      askedThisSession = false;
      logger.warn('[RatingPrompt] requestReview threw', errorContext(err));
      return { requested: false, reason: 'request-failed' };
    }

    await writeRecord({
      version: 1,
      firstEligibleAt: record.firstEligibleAt,
      lastPromptAt: now,
      lastPromptWeek: weeksLived,
      promptCount: record.promptCount + 1,
    });

    logger.info('[RatingPrompt] Review requested', {
      trigger,
      weeksLived,
      promptCount: record.promptCount + 1,
    });
    return { requested: true, reason: 'requested' };
  } catch (err) {
    logger.error('[RatingPrompt] Unexpected error in maybeRequestReview', err);
    return { requested: false, reason: 'request-failed' };
  }
}

/** Current persisted record — for dev tools and tests. @internal */
export async function getReviewPromptRecord(): Promise<ReviewPromptRecord> {
  return readRecord();
}

/** Wipe the cooldown/session state so the next beat can ask again. @internal */
export async function resetReviewPromptState(): Promise<void> {
  askedThisSession = false;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    logger.info('[RatingPrompt] Prompt state reset');
  } catch (err) {
    logger.warn('[RatingPrompt] Failed to reset prompt state', errorContext(err));
  }
}

/** Test seam: clear the once-per-session latch without touching storage. @internal */
export function __resetSessionLatchForTests(): void {
  askedThisSession = false;
}
