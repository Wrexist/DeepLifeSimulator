/**
 * Master Program 6 — the first 30 minutes, pure-logic layer.
 *
 * Every case here is a moment from the fresh-life walkthrough (tasks/todo.md,
 * Program 6, Phase 1) where the game either said something false or said
 * nothing. Each asserts the player-visible signal, not the implementation.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { applyChapterProgress } from '@/contexts/game/actions/weekly/applyChapterProgress';
import { applyCareerApplications } from '@/contexts/game/actions/weekly/applyCareerApplications';
import { rollWeeklyEvents, starterEventTemplates } from '@/lib/events/engine';
import { LIFE_CHAPTERS } from '@/lib/progress/lifeChapters';
import { unlockTier } from '@/lib/progress/featureUnlocks';
import { smartNotificationSystem, type NotificationContext } from '@/utils/smartNotifications';
import { resolveCoachStep } from '@/src/features/onboarding/coachStep';
import type { Career, GameState } from '@/contexts/game/types';

/** Age-20 quick-start seed: absolute week 104, life starts there. */
const AGE_20 = 104;

const life = (weeksIntoLife: number, extra: Partial<GameState> = {}): GameState => {
  const base = createTestGameState();
  return createTestGameState({
    ...base,
    weeksLived: AGE_20 + weeksIntoLife,
    lifeStartWeek: AGE_20,
    stats: { ...base.stats, money: 1_500, health: 100, happiness: 100, energy: 100 },
    ...extra,
  });
};

describe('the first decision exists: starter_luck rolls on the first tick', () => {
  it('the template fires at week 1 of the life and never again', () => {
    const starter = starterEventTemplates.find((t) => t.id === 'starter_luck')!;
    expect(starter.condition?.(life(1))).toBe(true);
    expect(starter.condition?.(life(0))).toBe(false);
    expect(starter.condition?.(life(2))).toBe(false);
  });

  it('the roll the tick actually makes (post-advance state) contains it', () => {
    // `applyWeeklyEvents` rolls on `{ ...prev, weeksLived: nextWeeksLived }`,
    // i.e. the first tick evaluates at week 1. With the old `=== 0` gate the
    // first decision of every life was unreachable.
    const events = rollWeeklyEvents(life(1, { pendingEvents: [], eventLog: [] }));
    expect(events.some((e) => e.id === 'starter_luck')).toBe(true);
    // It is a CHOICE, not a grant.
    const starter = events.find((e) => e.id === 'starter_luck')!;
    expect(starter.choices.length).toBeGreaterThanOrEqual(2);
  });
});

describe('a hire is announced, not just logged', () => {
  const pending = (): Career[] =>
    (createTestGameState().careers ?? []).map((c) =>
      c.id === 'fast_food'
        ? { ...c, applied: true, accepted: false, applicationWeeksPending: 1 }
        : c,
    );

  it('names the job and the wage when the application resolves', () => {
    const result = applyCareerApplications({
      prevCareers: pending(),
      prevCurrentJob: undefined,
      careerAcceptDelay: 2,
      prevIsRetired: false,
    });
    expect(result.newCurrentJob).toBe('fast_food');
    expect(result.hiredNotification).not.toBeNull();
    expect(result.hiredNotification!.title).toBe('Hired: Fast Food Worker');
    expect(result.hiredNotification!.message).toMatch(/\$110/);
  });

  it('says nothing while the application is still pending', () => {
    const result = applyCareerApplications({
      prevCareers: pending().map((c) => (c.id === 'fast_food' ? { ...c, applicationWeeksPending: 0 } : c)),
      prevCurrentJob: undefined,
      careerAcceptDelay: 2, // pending 0 → 1 this tick, accepted next tick
      prevIsRetired: false,
    });
    expect(result.newCurrentJob).toBeUndefined();
    expect(result.hiredNotification).toBeNull();
  });
});

describe('the chapter banner does not announce unlocks that already happened', () => {
  it('a hired player already holds tier 1, so Chapter 1 completion pays without a false "now available"', () => {
    const base = createTestGameState();
    const state = life(6, {
      currentJob: 'fast_food',
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalMoneyEarned: 800 },
    });
    // The precondition the message used to ignore.
    expect(unlockTier(state)).toBeGreaterThanOrEqual(1);

    const result = applyChapterProgress({ state });
    expect(result.newlyCompleted).toEqual([LIFE_CHAPTERS[0].id]);
    const [note] = result.notifications;
    expect(note.title).toMatch(/Fresh Start/);
    expect(note.message).not.toMatch(/available|unlocked/i);
    // The garnish is still stated.
    expect(note.message).toMatch(/\+\$[\d,]+, \+\d+ gems/);
  });
});

describe('"Perfect Week!" is not handed to a life that has not played one', () => {
  const context = (state: GameState): NotificationContext => ({
    gameState: state,
    timeOfDay: 'afternoon',
    dayOfWeek: 2,
    season: 'spring',
    recentActions: [],
    userPreferences: {
      showTips: true,
      showMilestones: true,
      showWarnings: true,
      showSuggestions: true,
      notificationFrequency: 'high',
    },
  });

  it('is silent on week 1 of a fresh life whose stats merely started at 100', () => {
    const system = smartNotificationSystem;
    system.clearHistory();
    const ids = system.evaluateNotifications(context(life(1))).map((n) => n.id);
    expect(ids).not.toContain('perfect_week');
  });

  it('fires once the player has actually kept every stat above 90 for a month', () => {
    const system = smartNotificationSystem;
    system.clearHistory();
    const ids = system.evaluateNotifications(context(life(4, { stats: { ...createTestGameState().stats, health: 95, happiness: 95, energy: 95 } }))).map((n) => n.id);
    expect(ids).toContain('perfect_week');
  });
});

describe('the coach still asks for the right next thing (unchanged contract)', () => {
  const base = { dismissed: false, establishedLife: false, baseline: null, weeksLived: AGE_20, incomeEarned: 0 };
  it('find work → live a week → paid', () => {
    expect(resolveCoachStep({ ...base, hasJob: false })).toBe('find-work');
    expect(resolveCoachStep({ ...base, hasJob: true })).toBe('advance');
    expect(resolveCoachStep({ ...base, hasJob: true, weeksLived: AGE_20 + 1, incomeEarned: 142 })).toBe('paid');
  });
});
