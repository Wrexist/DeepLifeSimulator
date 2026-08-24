/**
 * The weekly challenge system had no UI at all.
 *
 * Twelve hand-authored challenges rotate every 4 game weeks, are re-evaluated
 * on every tick, and pay 125–300 gems plus 50 Legacy-Pass XP each — 2,300 gems
 * across a 48-week cycle. A repo-wide grep for `weeklyChallenge` found hits only
 * in the tick, the type, `initialState` and the lib itself: no screen or
 * component read it. The player was never shown that a challenge existed, what
 * its objectives were, how long was left, or that they had just been paid — the
 * gem counter jumped with a `logger.info` as the only record.
 * 2026-07-30 audit GP-1.
 *
 * These pin the pure helpers the card renders from. The card itself is
 * deliberately READ-ONLY — the tick owns evaluation and the grant, and
 * duplicating either in a component would risk a second payout.
 */
import { weeksLeftLabel, objectiveFraction } from '@/components/WeeklyChallengeCard';
import {
  ROTATION_GAME_WEEKS,
  getOrRotateWeeklyChallenge,
  getWeeklyChallengeDefinition,
  evaluateChallengeProgress,
  WEEKLY_CHALLENGES,
} from '@/lib/challenges/weeklyChallenges';
import { createTestGameState } from '../helpers/createTestGameState';

describe('the card can say how long is left', () => {
  it('counts down within the rotation window', () => {
    expect(weeksLeftLabel(40, 40)).toBe('4 weeks left');
    expect(weeksLeftLabel(40, 42)).toBe('2 weeks left');
    expect(weeksLeftLabel(40, 43)).toBe('1 week left');
  });

  it('says so on the rotation week rather than showing a negative', () => {
    expect(weeksLeftLabel(40, 44)).toBe('Rotates this week');
    expect(weeksLeftLabel(40, 99)).toBe('Rotates this week');
  });

  it('degrades gracefully for a legacy challenge with no startedWeek', () => {
    // Old saves adopted a challenge without stamping the week.
    expect(weeksLeftLabel(undefined, 40)).toBe('Rotates soon');
    expect(weeksLeftLabel(NaN, 40)).toBe('Rotates soon');
  });

  it('agrees with the rotation constant the tick uses', () => {
    expect(weeksLeftLabel(0, 0)).toBe(`${ROTATION_GAME_WEEKS} weeks left`);
  });
});

describe('objective progress bars', () => {
  it('is a clamped 0..1 fraction', () => {
    expect(objectiveFraction(0, 10)).toBe(0);
    expect(objectiveFraction(5, 10)).toBe(0.5);
    expect(objectiveFraction(10, 10)).toBe(1);
    // Overshoot must not render a bar wider than its track.
    expect(objectiveFraction(50, 10)).toBe(1);
  });

  it('never produces NaN or Infinity from a garbage objective', () => {
    for (const [current, target] of [
      [NaN, 10],
      [5, 0],
      [5, NaN],
      [Infinity, 10],
      [5, Infinity],
    ] as const) {
      const f = objectiveFraction(current, target);
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe('the card has something to render for a real save', () => {
  it('resolves a definition and objectives for a freshly rotated challenge', () => {
    const state = createTestGameState({ weeksLived: 12 });
    const challenge = getOrRotateWeeklyChallenge(state);

    expect(challenge).toBeDefined();
    const definition = getWeeklyChallengeDefinition(challenge!.challengeId);
    expect(definition).toBeDefined();
    expect(definition!.name).toBeTruthy();
    expect(definition!.reward).toBeGreaterThan(0);

    const objectives = evaluateChallengeProgress(challenge!.challengeId, state);
    expect(objectives.length).toBeGreaterThan(0);
    for (const o of objectives) {
      expect(typeof o.description).toBe('string');
      expect(o.description.length).toBeGreaterThan(0);
    }
  });

  it('every challenge in the catalogue is renderable', () => {
    // A challenge with no emoji, no name or no objectives would render a blank
    // card - worse than no card.
    for (const c of WEEKLY_CHALLENGES) {
      expect(c.name).toBeTruthy();
      expect(c.reward).toBeGreaterThan(0);
      expect(c.objectives.length).toBeGreaterThan(0);
      for (const o of c.objectives) {
        expect(o.description).toBeTruthy();
        expect(o.target).toBeGreaterThan(0);
      }
    }
  });

  it('renders nothing rather than crashing when the save has no challenge', () => {
    // Old saves and a life that has not ticked yet. The card returns null; what
    // is asserted here is that the lookup is safe.
    const state = createTestGameState({ weeksLived: 0 });
    expect(state.weeklyChallenge).toBeUndefined();
    expect(getWeeklyChallengeDefinition('does_not_exist')).toBeUndefined();
    expect(evaluateChallengeProgress('does_not_exist', state)).toEqual([]);
  });
});
