/**
 * CMP-4 (v57): the notification panel's category toggles are persisted in
 * `settings.notificationPrefs` and honoured by the evaluator the weekly ticker
 * uses. They used to be component state - reset on every close, and never seen
 * by the ticker, which hard-coded all four categories on.
 */
import { resolveNotificationPrefs, smartNotificationSystem, type NotificationContext } from '@/utils/smartNotifications';
import { carryAccountLevelEntitlements, USER_PREFERENCE_SETTINGS_KEYS } from '@/lib/prestige/accountEntitlements';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function ctx(gameState: GameState): NotificationContext {
  return {
    gameState,
    timeOfDay: 'morning',
    dayOfWeek: 1,
    season: 'spring',
    recentActions: [],
    userPreferences: resolveNotificationPrefs(gameState.settings),
  };
}

function struggling(prefs?: GameState['settings']['notificationPrefs']): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, health: 5, happiness: 5, energy: 5, money: 0 },
    settings: { ...base.settings, notificationPrefs: prefs },
  });
}

describe('resolveNotificationPrefs', () => {
  it('absent (every pre-v57 save) means every category on', () => {
    expect(resolveNotificationPrefs(undefined)).toMatchObject({
      showTips: true, showMilestones: true, showWarnings: true, showSuggestions: true,
    });
    expect(resolveNotificationPrefs({})).toMatchObject({ showWarnings: true });
  });

  it('only an explicit false switches a category off; a missing key stays on', () => {
    const p = resolveNotificationPrefs({ notificationPrefs: { showWarnings: false } });
    expect(p.showWarnings).toBe(false);
    expect(p.showTips).toBe(true);
    expect(p.showMilestones).toBe(true);
    expect(p.showSuggestions).toBe(true);
  });
});

describe('the evaluator honours the saved toggles', () => {
  it('a struggling life raises warnings with defaults, and none once warnings are off', () => {
    const on = smartNotificationSystem.evaluateNotifications(ctx(struggling()));
    expect(on.some((n) => n.type === 'warning')).toBe(true);

    const off = smartNotificationSystem.evaluateNotifications(ctx(struggling({ showWarnings: false })));
    expect(off.some((n) => n.type === 'warning')).toBe(false);
  });
});

describe('the toggles are a device preference, so they follow the player into a new life', () => {
  it('is on the carried preference list', () => {
    expect(USER_PREFERENCE_SETTINGS_KEYS).toContain('notificationPrefs');
  });

  it('carries across a rebuilt state', () => {
    const old = struggling({ showTips: false, showWarnings: false });
    const fresh = { ...initialGameState, settings: { ...initialGameState.settings } } as GameState;
    const next = carryAccountLevelEntitlements(old, fresh);
    expect(resolveNotificationPrefs(next.settings).showTips).toBe(false);
    expect(resolveNotificationPrefs(next.settings).showWarnings).toBe(false);
    expect(initialGameState.settings.notificationPrefs).toBeUndefined();
  });
});
