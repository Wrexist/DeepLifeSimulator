import {
  shouldAskForReview,
  isPositiveWeek,
  REVIEW_MIN_WEEKS_IN_LIFE,
} from '@/lib/review/inAppReview';
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

/**
 * A rating prompt that fires at the wrong moment costs a star rather than
 * earning one, so the gate is: a genuinely good week, after a real life, once.
 */
describe('when to ask for a store rating', () => {
  const ok = {
    weeksInLife: REVIEW_MIN_WEEKS_IN_LIFE,
    alreadyAsked: false,
    positiveWeek: true,
    blocked: false,
  };

  it('asks after a good week, once the life is real', () => {
    expect(shouldAskForReview(ok)).toBe(true);
  });

  it('never asks on an average week', () => {
    expect(shouldAskForReview({ ...ok, positiveWeek: false })).toBe(false);
  });

  it('never asks too early in a life', () => {
    expect(shouldAskForReview({ ...ok, weeksInLife: REVIEW_MIN_WEEKS_IN_LIFE - 1 })).toBe(false);
    expect(shouldAskForReview({ ...ok, weeksInLife: REVIEW_MIN_WEEKS_IN_LIFE })).toBe(true);
  });

  it('never repeats on the same install', () => {
    expect(shouldAskForReview({ ...ok, alreadyAsked: true })).toBe(false);
  });

  it('never interrupts a blocking moment', () => {
    expect(shouldAskForReview({ ...ok, blocked: true })).toBe(false);
  });

  it('rejects a non-finite week count', () => {
    expect(shouldAskForReview({ ...ok, weeksInLife: Number.NaN })).toBe(false);
  });
});

describe('what counts as a week worth celebrating', () => {
  it('a ready promotion counts', () => {
    expect(isPositiveWeek(createTestGameState({ weekResult: { careerProgressPercent: 100 } }))).toBe(true);
  });

  it('a play-streak bonus counts', () => {
    expect(isPositiveWeek(createTestGameState({ weekResult: { streakBonus: 25 } }))).toBe(true);
  });

  it('an ordinary week does not', () => {
    expect(isPositiveWeek(createTestGameState({ weekResult: { netChange: 10 } }))).toBe(false);
  });

  it('no week result does not', () => {
    const s = createTestGameState();
    expect(isPositiveWeek({ ...s, weekResult: undefined })).toBe(false);
    expect(isPositiveWeek(undefined)).toBe(false);
  });
});

/**
 * Whether the prompt fires at all is only answerable if the ask is measured.
 * Each outcome must report itself exactly once, and nothing but a completed
 * request may report `requested` - a sheet the OS was never asked to show must
 * not read as one it was.
 */
describe('measuring the rating ask', () => {
  type ReviewModule = typeof import('@/lib/review/inAppReview');
  type StoreReviewMock = {
    hasAction: jest.Mock;
    isAvailableAsync: jest.Mock;
    requestReview: jest.Mock;
  };

  // A fresh module per test: `requestReviewOnce` latches for the session, and
  // the storage mock remembers the per-install "asked" flag.
  const load = (): { review: ReviewModule; store: StoreReviewMock } => {
    jest.resetModules();
    const store = require('expo-store-review') as StoreReviewMock;
    const review = require('@/lib/review/inAppReview') as ReviewModule;
    return { review, store };
  };

  beforeEach(() => mockTrack.mockClear());

  it('reports a completed request as requested', async () => {
    const { review, store } = load();
    await expect(review.requestReviewOnce()).resolves.toBe(true);
    expect(store.requestReview).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('review_prompt_requested', { outcome: 'requested' });
  });

  it('reports a platform that cannot show the sheet as unavailable', async () => {
    const { review, store } = load();
    store.hasAction.mockResolvedValueOnce(false);
    await expect(review.requestReviewOnce()).resolves.toBe(false);
    expect(store.requestReview).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('review_prompt_requested', { outcome: 'unavailable' });
  });

  it('reports a failed request as an error, never as requested', async () => {
    const { review, store } = load();
    store.requestReview.mockRejectedValueOnce(new Error('native module gone'));
    await expect(review.requestReviewOnce()).resolves.toBe(false);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('review_prompt_requested', { outcome: 'error' });
  });

  it('says nothing on a repeat call in the same session', async () => {
    const { review } = load();
    await review.requestReviewOnce();
    mockTrack.mockClear();
    await expect(review.requestReviewOnce()).resolves.toBe(false);
    expect(mockTrack).not.toHaveBeenCalled();
  });
});
