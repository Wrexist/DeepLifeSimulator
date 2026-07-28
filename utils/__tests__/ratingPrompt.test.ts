/**
 * Rating-prompt gating.
 *
 * The whole point of this module is to spend iOS's ~3-per-year review sheets
 * carefully, so the tests are mostly about the calls that must NOT happen.
 */

import {
  maybeRequestReview,
  resetReviewPromptState,
  __resetSessionLatchForTests,
  MIN_WEEKS_PLAYED,
  PROMPT_COOLDOWN_DAYS,
  PROMPT_COOLDOWN_WEEKS,
  MIN_HOURS_BEFORE_FIRST_PROMPT,
  MAX_LIFETIME_PROMPTS,
} from '../ratingPrompt';
import type { GameState } from '@/contexts/game/types';
import AsyncStorageImport from '@react-native-async-storage/async-storage';
import * as StoreReviewImport from 'expo-store-review';
import { createTestGameState } from '../../__tests__/helpers/createTestGameState';

// Both modules are jest.mock'd in jest.setup.js; cast to the mock shape so the
// per-test `mockResolvedValue` / `mockImplementation` calls typecheck.
const StoreReview = StoreReviewImport as unknown as Record<string, jest.Mock>;
const AsyncStorage = AsyncStorageImport as unknown as Record<string, jest.Mock>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NOW = 1_800_000_000_000; // fixed epoch so cooldown maths is deterministic

/** In-memory AsyncStorage so records written by one call are read by the next. */
function installMemoryStorage(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  AsyncStorage.getItem.mockImplementation((k: string) =>
    Promise.resolve(store.has(k) ? store.get(k)! : null)
  );
  AsyncStorage.setItem.mockImplementation((k: string, v: string) => {
    store.set(k, v);
    return Promise.resolve();
  });
  AsyncStorage.removeItem.mockImplementation((k: string) => {
    store.delete(k);
    return Promise.resolve();
  });
  return store;
}

const state = (weeksLived: number): GameState => ({ weeksLived }) as unknown as GameState;

/** A record that is past the settling-in delay and has never been prompted. */
function eligibleRecord(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    firstEligibleAt: NOW - 30 * DAY_MS,
    lastPromptAt: 0,
    lastPromptWeek: 0,
    promptCount: 0,
    ...overrides,
  });
}

describe('maybeRequestReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetSessionLatchForTests();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    StoreReview.isAvailableAsync.mockResolvedValue(true);
    StoreReview.hasAction.mockResolvedValue(true);
    StoreReview.requestReview.mockResolvedValue(undefined);
    installMemoryStorage();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks at a positive beat once every gate is satisfied', async () => {
    installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });

    const result = await maybeRequestReview('promotion', state(200));

    expect(result).toEqual({ requested: true, reason: 'requested' });
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('records the ask so the next one is cooled down', async () => {
    const store = installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });

    await maybeRequestReview('promotion', state(200));

    const saved = JSON.parse(store.get('reviewPrompt.v1')!);
    expect(saved).toMatchObject({ lastPromptAt: NOW, lastPromptWeek: 200, promptCount: 1 });
  });

  it('does not ask before the player has played enough', async () => {
    installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });

    const result = await maybeRequestReview('promotion', state(MIN_WEEKS_PLAYED - 1));

    expect(result).toEqual({ requested: false, reason: 'not-enough-progress' });
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('never asks on the very first qualifying beat — it only starts the clock', async () => {
    const store = installMemoryStorage();

    const result = await maybeRequestReview('promotion', state(200));

    expect(result).toEqual({ requested: false, reason: 'settling-in' });
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(JSON.parse(store.get('reviewPrompt.v1')!).firstEligibleAt).toBe(NOW);
  });

  it('keeps holding off until the settling-in delay has elapsed', async () => {
    installMemoryStorage({
      'reviewPrompt.v1': eligibleRecord({
        firstEligibleAt: NOW - (MIN_HOURS_BEFORE_FIRST_PROMPT - 1) * HOUR_MS,
      }),
    });

    const result = await maybeRequestReview('promotion', state(200));

    expect(result).toEqual({ requested: false, reason: 'settling-in' });
  });

  it('asks at most once per app session, however many beats land', async () => {
    installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });

    const first = await maybeRequestReview('promotion', state(200));
    const second = await maybeRequestReview('investment_win', state(201));

    expect(first.requested).toBe(true);
    expect(second).toEqual({ requested: false, reason: 'already-asked-this-session' });
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('holds off for the wall-clock cooldown even when game weeks have flown by', async () => {
    // The failure this guards: a player blitzes hundreds of in-game weeks in
    // one evening. Game-week cooldown alone would let that burn every yearly
    // ask in a single sitting.
    installMemoryStorage({
      'reviewPrompt.v1': eligibleRecord({
        lastPromptAt: NOW - (PROMPT_COOLDOWN_DAYS - 1) * DAY_MS,
        lastPromptWeek: 10,
        promptCount: 1,
      }),
    });

    const result = await maybeRequestReview('promotion', state(9999));

    expect(result).toEqual({ requested: false, reason: 'cooldown-wallclock' });
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('holds off for the game-week cooldown even when the wall clock has passed', async () => {
    installMemoryStorage({
      'reviewPrompt.v1': eligibleRecord({
        lastPromptAt: NOW - (PROMPT_COOLDOWN_DAYS + 1) * DAY_MS,
        lastPromptWeek: 200,
        promptCount: 1,
      }),
    });

    const result = await maybeRequestReview('promotion', state(200 + PROMPT_COOLDOWN_WEEKS - 1));

    expect(result).toEqual({ requested: false, reason: 'cooldown-gameweeks' });
  });

  it('asks again once BOTH cooldowns have elapsed', async () => {
    installMemoryStorage({
      'reviewPrompt.v1': eligibleRecord({
        lastPromptAt: NOW - (PROMPT_COOLDOWN_DAYS + 1) * DAY_MS,
        lastPromptWeek: 200,
        promptCount: 1,
      }),
    });

    const result = await maybeRequestReview('promotion', state(200 + PROMPT_COOLDOWN_WEEKS));

    expect(result).toEqual({ requested: true, reason: 'requested' });
  });

  it('stops asking forever once the lifetime cap is reached', async () => {
    installMemoryStorage({
      'reviewPrompt.v1': eligibleRecord({
        lastPromptAt: NOW - 10 * 365 * DAY_MS,
        lastPromptWeek: 1,
        promptCount: MAX_LIFETIME_PROMPTS,
      }),
    });

    const result = await maybeRequestReview('promotion', state(99999));

    expect(result).toEqual({ requested: false, reason: 'max-lifetime-prompts' });
  });

  it('stays silent when the platform cannot show the sheet (e.g. TestFlight)', async () => {
    installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });
    StoreReview.isAvailableAsync.mockResolvedValue(false);

    const result = await maybeRequestReview('promotion', state(200));

    expect(result).toEqual({ requested: false, reason: 'store-review-unavailable' });
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('stays silent when there is no store action available', async () => {
    installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });
    StoreReview.hasAction.mockResolvedValue(false);

    const result = await maybeRequestReview('promotion', state(200));

    expect(result).toEqual({ requested: false, reason: 'no-store-action' });
  });

  it('does not burn the cooldown when the native call throws', async () => {
    const store = installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });
    StoreReview.requestReview.mockRejectedValue(new Error('native boom'));

    const result = await maybeRequestReview('promotion', state(200));

    expect(result).toEqual({ requested: false, reason: 'request-failed' });
    // Nothing was shown, so lastPromptAt must stay unset and the session latch
    // must reopen — otherwise one native hiccup silences the prompt for months.
    expect(JSON.parse(store.get('reviewPrompt.v1')!).lastPromptAt).toBe(0);

    StoreReview.requestReview.mockResolvedValue(undefined);
    const retry = await maybeRequestReview('promotion', state(200));
    expect(retry.requested).toBe(true);
  });

  it('rejects a malformed game state instead of throwing', async () => {
    installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });

    await expect(maybeRequestReview('promotion', null)).resolves.toEqual({
      requested: false,
      reason: 'invalid-state',
    });
    await expect(
      maybeRequestReview('promotion', createTestGameState({ weeksLived: NaN }))
    ).resolves.toEqual({ requested: false, reason: 'invalid-state' });
  });

  it('survives storage that throws on every operation', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('disk on fire'));
    AsyncStorage.setItem.mockRejectedValue(new Error('disk on fire'));

    const result = await maybeRequestReview('promotion', state(200));

    // Unreadable storage looks like a first run, which means settling-in —
    // the conservative direction. It must not throw or spuriously prompt.
    expect(result.requested).toBe(false);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('carries the pre-v1 game-week key into the new record', async () => {
    installMemoryStorage({ lastReviewPromptWeek: '150' });

    // Migrated record keeps lastPromptWeek=150, so a life at week 160 is still
    // inside the 60-week cooldown. (firstEligibleAt is unset, so settling-in
    // is what answers first — both are "do not prompt", which is the point.)
    const result = await maybeRequestReview('promotion', state(160));

    expect(result.requested).toBe(false);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('reset clears the record and reopens the session latch', async () => {
    const store = installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });
    await maybeRequestReview('promotion', state(200));
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);

    await resetReviewPromptState();
    expect(store.has('reviewPrompt.v1')).toBe(false);

    installMemoryStorage({ 'reviewPrompt.v1': eligibleRecord() });
    const again = await maybeRequestReview('promotion', state(200));
    expect(again.requested).toBe(true);
  });
});
