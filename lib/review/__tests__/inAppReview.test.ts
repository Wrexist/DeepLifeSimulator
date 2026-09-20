import {
  shouldAskForReview,
  isPositiveWeek,
  REVIEW_MIN_WEEKS_IN_LIFE,
} from '@/lib/review/inAppReview';
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';

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
