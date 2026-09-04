/**
 * A milestone the player has already been told about must not fire again.
 *
 * PLAYER REPORT (BBQ, 2026-08-31): "There are too many frequent pop ups of
 * events that have already happened. They pop up every time the game is
 * refreshed. In this manner are they re-occurring."
 *
 * The `showOnce` record was a private `Map` on a module singleton — in-memory
 * state that dies with the JS runtime. Every milestone's condition is derived
 * from the save (`hasSpouse`, `hasChildren`, `minMoney`) and stays true forever,
 * so on each relaunch the whole backlog was eligible again and the weekly ticker
 * replayed it one at a time. Persisted as `shownNotificationIds` in v50.
 */
import { smartNotificationSystem, type NotificationContext } from '@/utils/smartNotifications';
import { createTestGameState } from '../helpers/createTestGameState';
import type { ChildInfo, GameState, Relationship } from '@/contexts/game/types';
import * as fs from 'fs';
import * as path from 'path';

const PREFS = {
  showTips: true,
  showMilestones: true,
  showWarnings: true,
  showSuggestions: true,
  notificationFrequency: 'medium' as const,
};

/** Hard Rule #3: state is always built by the factory, never hand-cast. */
function contextFor(gameState: GameState): NotificationContext {
  return {
    gameState,
    timeOfDay: 'morning',
    dayOfWeek: 3,
    season: 'spring',
    recentActions: [],
    userPreferences: PREFS,
  };
}

const SPOUSE = {
  id: 'r1',
  name: 'Alex',
  type: 'spouse',
  relationshipScore: 80,
  personality: 'Warm',
} as Relationship;

/** A married player with a child — two showOnce milestones long since passed. */
function veteranState(extra: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return {
    ...base,
    relationships: [SPOUSE],
    family: {
      ...base.family,
      spouse: SPOUSE,
      children: [{ id: 'c1', name: 'Sam' } as ChildInfo],
    },
    ...extra,
  };
}

const veteranSave = (): NotificationContext => contextFor(veteranState());

beforeEach(() => {
  // The session Map is the thing that used to be the ONLY record; clear it so
  // each test starts from a cold app launch, which is the reported scenario.
  smartNotificationSystem.clearHistory();
});

describe('showOnce notifications survive a relaunch', () => {
  it('a veteran save has milestones it has demonstrably already passed', () => {
    // The premise. If this is empty the rest proves nothing.
    expect(smartNotificationSystem.earnedShowOnceIds(veteranSave()).length).toBeGreaterThan(0);
  });

  it('a save with no record seeds itself and fires none of the backlog', () => {
    // This is the relaunch: cold Map, no stored ids, conditions still true.
    const ctx = veteranSave();
    expect(ctx.gameState.shownNotificationIds).toBeUndefined();

    const eligible = smartNotificationSystem.evaluateNotifications(ctx);
    expect(eligible.filter((n) => n.showOnce)).toEqual([]);
  });

  it('and the seed is exactly what it would have shown', () => {
    const ctx = veteranSave();
    const seeded = smartNotificationSystem.resolveShownIds(ctx);
    expect(new Set(seeded)).toEqual(new Set(smartNotificationSystem.earnedShowOnceIds(ctx)));
  });

  it('a stored record is used verbatim, not re-derived', () => {
    // Once the save HAS a record, a milestone missing from it is still owed.
    const ctx = veteranSave();
    const all = smartNotificationSystem.earnedShowOnceIds(ctx);
    const withOneMissing = all.slice(1);
    const stored = contextFor(veteranState({ shownNotificationIds: withOneMissing }));

    const eligibleIds = smartNotificationSystem
      .evaluateNotifications(stored)
      .filter((n) => n.showOnce)
      .map((n) => n.id);
    expect(eligibleIds).toEqual([all[0]]);
  });

  it('an empty stored record means nothing shown yet (a genuinely new life)', () => {
    // The distinction the carve-out turns on: [] is a real answer, undefined is
    // "no record". A new life must still get its first-child moment.
    const fresh = contextFor(veteranState({ shownNotificationIds: [] }));
    expect(smartNotificationSystem.evaluateNotifications(fresh).filter((n) => n.showOnce).length)
      .toBeGreaterThan(0);
  });

  it('showing one marks it for the rest of the session too', () => {
    const ctx = contextFor({ ...createTestGameState(), shownNotificationIds: [] });
    const first = smartNotificationSystem.evaluateNotifications(ctx).filter((n) => n.showOnce)[0];
    if (!first) return; // no showOnce eligible on a default save; nothing to assert
    smartNotificationSystem.showNotification(first, ctx);
    const after = smartNotificationSystem.evaluateNotifications(ctx).map((n) => n.id);
    expect(after).not.toContain(first.id);
  });
});

describe('the ticker persists what it resolves', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../..', 'components/SmartNotificationTicker.tsx'),
    'utf8',
  );

  it('writes the resolved set back into the save', () => {
    // Without this write a legacy save re-derives the seed every week and never
    // gains a record of its own.
    expect(src).toMatch(/shownNotificationIds: merged/);
  });

  it('dedupes against prev, so a double-invoked updater cannot grow the list', () => {
    expect(src).toMatch(/new Set\(\[\.\.\.\(prev\.shownNotificationIds \?\? \[\]\), \.\.\.nextIds\]\)/);
  });
});
