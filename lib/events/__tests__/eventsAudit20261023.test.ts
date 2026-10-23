/**
 * Second events/copy audit (2026-10-23, EVT2-*). One regression per confirmed
 * finding; each assertion fails on the code as it stood before the fix.
 */
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';
import {
  eventTemplates,
  CARD_FRAUD_INVESTIGATOR_FEE_USD,
  type WeeklyEvent,
} from '@/lib/events/engine';
import { previewEventStatDelta, applyEventStatDeltas } from '@/lib/events/statEffects';
import { routeEvents } from '@/lib/events/routing';
import { SEASONAL_EVENT_IDS, seasonalEventTemplates } from '@/lib/events/seasonalEvents';
import { generateWeeklyMail } from '@/lib/mail/generate';
import { letterFromEvent, letterIdFor } from '@/lib/mail/letters';
import { appendMessages } from '@/lib/mail/state';
import { smartNotificationSystem } from '@/utils/smartNotifications';
import type { GameState } from '@/contexts/game/types';

const template = (id: string) => {
  const t = eventTemplates.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};

describe('EVT2-1 - the event screen previews the happiness the resolver actually adds', () => {
  it('a gain at high happiness is shown tapered, exactly as it lands', () => {
    const stats = createTestGameState({ stats: { happiness: 90 } }).stats;
    const shown = previewEventStatDelta('happiness', stats.happiness, 20);
    const landed = { ...stats };
    applyEventStatDeltas(landed, { happiness: 20 });
    expect(shown).toBeLessThan(20);
    expect(shown).toBe(Math.round(landed.happiness - stats.happiness));
  });

  it('losses, low happiness and every other stat are shown at face value', () => {
    expect(previewEventStatDelta('happiness', 90, -15)).toBe(-15);
    expect(previewEventStatDelta('happiness', 30, 10)).toBe(10);
    expect(previewEventStatDelta('health', 95, 20)).toBe(20);
    expect(previewEventStatDelta('happiness', Number.NaN, 10)).toBe(10);
  });
});

describe('EVT2-2 - a routed event that fires again gets a letter again', () => {
  const routedFine = (state: GameState, week: number): WeeklyEvent => ({
    ...routeEvents([template('legal_parking_fine').generate(state)], week)[0],
    generatedAtWeeksLived: week,
  });

  it('the second instance is delivered although the first letter is still in the mailbox', () => {
    const state = createTestGameState({ weeksLived: 260 });
    const first = routedFine(state, 200);
    const answered = letterFromEvent(first, 200)!;
    answered.decision = { ...answered.decision!, chosenId: 'pay_discounted', resolvedAs: 'chosen' };

    const second = routedFine(state, 260);
    const withSecond = { ...state, pendingEvents: [second], mail: { messages: [answered] } };
    const delivered = generateWeeklyMail({ state: withSecond, week: 260 });
    const merged = appendMessages([answered], delivered);

    const letters = merged.filter((m) => m.decision?.resolver.kind === 'event');
    expect(letters).toHaveLength(2);
    expect(letters.filter((m) => !m.decision!.chosenId)).toHaveLength(1);
    expect(letterIdFor(first)).not.toBe(letterIdFor(second));
  });

  it('one instance still gets exactly one letter across the weeks it stays open', () => {
    const state = createTestGameState({ weeksLived: 260 });
    const fine = routedFine(state, 260);
    const s = { ...state, pendingEvents: [fine], mail: { messages: [] } };
    const week1 = appendMessages([], generateWeeklyMail({ state: s, week: 260 }));
    const week2 = appendMessages(week1, generateWeeklyMail({ state: { ...s, mail: { messages: week1 } }, week: 261 }));
    expect(week2.filter((m) => m.decision?.resolver.kind === 'event')).toHaveLength(1);
  });

  it('a save holding an open letter under the old id is not sent a duplicate', () => {
    const state = createTestGameState({ weeksLived: 260 });
    const fine = routedFine(state, 258);
    const legacy = { ...letterFromEvent(fine, 258)!, id: 'mail-letter-legal_parking_fine' };
    const s = { ...state, pendingEvents: [fine], mail: { messages: [legacy] } };
    const delivered = generateWeeklyMail({ state: s, week: 260 });
    expect(delivered.filter((m) => m.decision?.resolver.kind === 'event')).toHaveLength(0);
  });
});

describe('EVT2-3 - card_fraud: hiring an investigator no longer dominates reporting', () => {
  it('the investigator is an honest gamble whose worst case is its stake', () => {
    let wins = 0;
    let losses = 0;
    for (let i = 0; i < 40; i++) {
      const state = createTestGameState({ stats: { money: 20_000 }, weeksLived: 300 + i });
      const event = template('card_fraud').generate(state);
      const pursue = event.choices.find((c) => c.id === 'pursue')!;
      expect(pursue.outcomeHidden).toBe(true);
      expect(pursue.stake).toBe(CARD_FRAUD_INVESTIGATOR_FEE_USD + 500);
      expect(-(pursue.effects.money ?? 0)).toBeLessThanOrEqual(pursue.stake!);
      if (pursue.effects.money === -CARD_FRAUD_INVESTIGATOR_FEE_USD) wins += 1;
      else losses += 1;
    }
    // Both outcomes are reachable: it is a real risk, not a free recovery.
    expect(wins).toBeGreaterThan(0);
    expect(losses).toBeGreaterThan(0);
  });
});

describe('EVT2-4 - seasonal labelling and copy', () => {
  it('every seasonal template is labelled seasonal, and nothing else is', () => {
    expect([...SEASONAL_EVENT_IDS].sort()).toEqual(seasonalEventTemplates.map((t) => t.id).sort());
    for (const id of ['easter', 'black_friday', 'thanksgiving', 'independence_day']) {
      expect(SEASONAL_EVENT_IDS.has(id)).toBe(true);
    }
  });

  it('no seasonal choice promises a shop discount the game does not apply', () => {
    const state = createTestGameState({});
    for (const t of seasonalEventTemplates) {
      const event = t.generate(state);
      const copy = [event.description, ...event.choices.map((c) => c.text)].join(' ');
      expect(copy).not.toMatch(/\d+% off|discount/i);
    }
  });

  it('a seasonal choice that pays cash says so', () => {
    const state = createTestGameState({});
    for (const t of seasonalEventTemplates) {
      for (const c of t.generate(state).choices) {
        if ((c.effects.money ?? 0) >= 50) expect(c.text).toMatch(/\$/);
      }
    }
  });
});

describe('EVT2-5 - career event copy never prints the "your job" fallback as a title', () => {
  it('workplace_injury and boss_favoritism read cleanly without a resolvable title', () => {
    const state = createTestGameState({ currentJob: 'not-a-career', weeksLived: 400 });
    for (const id of ['workplace_injury', 'boss_favoritism']) {
      const text = template(id).generate(state).description;
      expect(text).not.toMatch(/as your job|at your job is|another your job|boss at /i);
    }
  });
});

describe('EVT2-6 - the retirement suggestion is not shown to someone already retired', () => {
  const ids = (gameState: GameState) =>
    smartNotificationSystem
      .evaluateNotifications({
        gameState,
        timeOfDay: 'morning',
        dayOfWeek: 1,
        season: 'spring',
        recentActions: [],
        userPreferences: { showTips: true, showMilestones: true, showWarnings: true, showSuggestions: true, notificationFrequency: 'medium' },
      })
      .map((n) => n.id);

  it('fires for a working millionaire over 60 and not for a retired one', () => {
    const base = createTestGameState({ stats: { money: 2_000_000 } });
    const working: GameState = { ...base, date: { ...base.date, age: 64 }, currentJob: 'retail_associate' };
    const retired: GameState = { ...working, currentJob: undefined, isRetired: true };
    expect(ids(working)).toContain('retirement_suggestion');
    expect(ids(retired)).not.toContain('retirement_suggestion');
  });
});
