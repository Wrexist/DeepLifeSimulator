/**
 * The declarative sequel API and the once-per-life fence (2026-08-24 pass).
 *
 * `EventChoice.followUpEventId` shipped with the engine and had zero producers
 * and zero consumers — authoring a sequel required a hand-written stages[]
 * chain in engine.ts, which is why only 3 chains existed across ~400
 * templates. These tests pin the whole path: the choice → pending mapping
 * (`followUpFromChoice`), the pool-wide delivery lookup (`generateEventById`),
 * the first two shipped sequels, and the `oncePerLife` selector fence.
 */
import {
  eventTemplates,
  generateEventById,
  oncePerLifeSpent,
  rollWeeklyEvents,
} from '../engine';
import { followUpFromChoice, DEFAULT_FOLLOW_UP_DELAY_WEEKS, FOLLOW_UP_EVENTS } from '../lifeEvents';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const byId = (id: string) => {
  const t = eventTemplates.find((e) => e.id === id);
  if (!t) throw new Error(`template ${id} not registered`);
  return t;
};

describe('followUpFromChoice — the producer half', () => {
  it('returns null for every choice written before the API went live', () => {
    expect(followUpFromChoice('evt', { }, 100)).toBeNull();
    expect(followUpFromChoice('evt', undefined, 100)).toBeNull();
    expect(followUpFromChoice('evt', null, 100)).toBeNull();
  });

  it('schedules the named sequel with the default delay', () => {
    const pending = followUpFromChoice('src_evt', { followUpEventId: 'friend_repays' }, 100);
    expect(pending).toEqual({
      eventId: 'friend_repays',
      triggerWeek: 100 + DEFAULT_FOLLOW_UP_DELAY_WEEKS,
      sourceEventId: 'src_evt',
    });
  });

  it('honours an explicit delay and floors fractions', () => {
    const pending = followUpFromChoice(
      'src',
      { followUpEventId: 'x', followUpDelayWeeks: 6.9 },
      50
    );
    expect(pending?.triggerWeek).toBe(56);
  });

  it('falls back to the default on a non-positive delay', () => {
    expect(
      followUpFromChoice('src', { followUpEventId: 'x', followUpDelayWeeks: 0 }, 50)?.triggerWeek
    ).toBe(50 + DEFAULT_FOLLOW_UP_DELAY_WEEKS);
  });
});

describe('generateEventById — the pool-wide delivery half', () => {
  it('generates a registered template by id', () => {
    const state = createTestGameState({ weeksLived: 100 });
    const event = generateEventById('friend_repays', state);
    expect(event?.id).toBe('friend_repays');
    expect(event?.choices.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null for an unknown id instead of throwing', () => {
    expect(generateEventById('no_such_template', createTestGameState())).toBeNull();
  });
});

describe('the first two shipped sequels', () => {
  it('friend_help "lend" declares the friend_repays sequel', () => {
    const state = createTestGameState({
      weeksLived: 60,
      relationships: [
        { id: 'f1', name: 'Alex', type: 'friend', relationshipScore: 40, personality: '', gender: 'male', age: 25 },
      ] as never,
    });
    const event = byId('friend_help').generate(state);
    const lend = event.choices.find((c) => c.id === 'lend');
    expect(lend?.followUpEventId).toBe('friend_repays');
    expect(lend?.followUpDelayWeeks).toBe(6);
  });

  it('wedding "marry" declares the honeymoon_glow sequel', () => {
    const state = createTestGameState({
      weeksLived: 60,
      lifeStartWeek: 0,
      relationships: [
        { id: 'p1', name: 'Sam', type: 'partner', relationshipScore: 80, personality: '', gender: 'female', age: 27 },
      ] as never,
    });
    const event = byId('wedding').generate(state);
    const marry = event.choices.find((c) => c.id === 'marry');
    expect(marry?.followUpEventId).toBe('honeymoon_glow');
  });

  it('sequel-only templates carry weight 0 so they can never fire at random', () => {
    expect(byId('friend_repays').weight).toBe(0);
    expect(byId('honeymoon_glow').weight).toBe(0);
  });

  it('sequel ids resolve OUTSIDE the FOLLOW_UP_EVENTS registry (the pool path)', () => {
    // The delivery block falls back to generateEventById precisely because
    // these are not registry entries — if someone later adds them there, the
    // registry copy would shadow the richer template.
    expect(FOLLOW_UP_EVENTS).not.toHaveProperty('friend_repays');
    expect(FOLLOW_UP_EVENTS).not.toHaveProperty('honeymoon_glow');
  });

  it('friend_repays surfaces both outcomes across different weeks', () => {
    const descriptions = new Set<string>();
    for (let w = 10; w < 90; w++) {
      const event = generateEventById('friend_repays', createTestGameState({ weeksLived: w }));
      if (event) descriptions.add(event.description);
    }
    expect(descriptions.size).toBeGreaterThanOrEqual(2);
  });

  it('honeymoon_glow names the spouse when there is one', () => {
    const state = createTestGameState({
      weeksLived: 60,
      relationships: [
        { id: 'p1', name: 'Sam', type: 'spouse', relationshipScore: 90, personality: '', gender: 'female', age: 27 },
      ] as never,
    });
    expect(generateEventById('honeymoon_glow', state)?.description).toContain('Sam');
  });
});

describe('oncePerLife — narrative one-shots cannot repeat', () => {
  it('is inert for untagged templates and for an empty log', () => {
    expect(oncePerLifeSpent({ id: 'job_bonus' }, [{ id: 'job_bonus' } as never])).toBe(false);
    expect(oncePerLifeSpent({ id: 'old_friend_returns', oncePerLife: true }, [])).toBe(false);
    expect(oncePerLifeSpent({ id: 'old_friend_returns', oncePerLife: true }, undefined)).toBe(false);
  });

  it('blocks a tagged template once its id is in this life\'s eventLog', () => {
    expect(
      oncePerLifeSpent({ id: 'old_friend_returns', oncePerLife: true }, [
        { id: 'old_friend_returns' } as never,
      ])
    ).toBe(true);
  });

  it('DATA RATCHET: the fiction-breaking one-shots are tagged', () => {
    const mustBeOnce = [
      'milestone_birthday_30',
      'milestone_birthday_50',
      'old_friend_returns',
      'distant_relative_inheritance',
    ];
    for (const id of mustBeOnce) {
      expect(byId(id).oncePerLife).toBe(true);
    }
    // Every secret event: a secret is discovered once.
    const secrets = eventTemplates.filter((t) => t.id.startsWith('secret_'));
    expect(secrets.length).toBeGreaterThanOrEqual(10);
    for (const t of secrets) {
      expect(t.oncePerLife).toBe(true);
    }
  });

  it('SELECTOR: a spent birthday cannot fire again even while its age window holds', () => {
    // age === 30 is true for 52 straight weeks. Force events via pity drought
    // and check the spent template never surfaces across the whole window.
    for (let w = 624; w < 676; w += 4) {
      const state = createTestGameState({
        weeksLived: w,
        lifeStartWeek: 0,
        lastEventWeeksLived: w - 30, // deep past every pity threshold
        date: { ...createTestGameState().date, age: 30 },
        eventLog: [
          { id: 'milestone_birthday_30', description: '', choice: '', week: 1, year: 2025,
            weeksLived: 620, category: 'general', effects: {} } as never,
        ],
      });
      const events = rollWeeklyEvents(state);
      expect(events.some((e) => e.id.startsWith('milestone_birthday_30'))).toBe(false);
    }
  });
});
