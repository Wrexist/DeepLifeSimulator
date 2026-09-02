/**
 * Event-availability gates measure THIS LIFE, not the absolute clock.
 *
 * `weeksLived` is absolute and seeded from the starting age
 * (`computeWeeksLived` = `(age - 18) * 52`), so an age-25 character begins at
 * **364** — see CLAUDE.md §4.2. Every event gate written as
 * `weeksLived < 12` / `weeksLived > 20` therefore answered "is this character
 * more than N weeks past 18", which is a fixed property of the SCENARIO, not
 * progress:
 *
 *   - the early-game welcome pack (`< 12`) and the starter grants (`=== 0`,
 *     `2..5`, `5..8`) were unreachable for every start that is not age 18;
 *   - every late-game gate (`> 20`, `> 30`, `> 50`, wealth's `>= 26`) was
 *     already open on the first tick of the same starts;
 *   - the pacing phases (min-gap, pity, base chance) classified a brand-new
 *     age-25 player as late-game.
 *
 * The gates now read `weeksInThisLife` (v43 `lifeStartWeek` baseline). A save
 * written before v43 has no baseline and falls back to the absolute counter,
 * i.e. exactly the behaviour it has today — asserted at the bottom.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { eventTemplates, starterEventTemplates } from '@/lib/events/engine';
import { nearMissEventTemplates } from '@/lib/events/nearMissEvents';
import { CLIFFHANGERS } from '@/lib/events/cliffhangerEvents';
import { fameEventTemplates } from '@/lib/events/fameEvents';
import { wealthEventTemplates, MIN_WEEKS_LIVED } from '@/lib/events/wealthEvents';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';

/** An age-25 scenario on its very first week: absolute 364, zero weeks lived. */
const AGE_25_START = 25 * 52 - 18 * 52; // 364

const templateById = (id: string) => {
  const t = [...eventTemplates, ...starterEventTemplates].find(e => e.id === id);
  if (!t) throw new Error(`template ${id} is not registered`);
  return t;
};

const nearMissById = (id: string) => {
  const t = nearMissEventTemplates.find(e => e.id === id);
  if (!t) throw new Error(`near-miss template ${id} not found`);
  return t;
};

/** A fresh life that started at `startWeek` and has played `played` weeks. */
const life = (
  startWeek: number,
  played: number,
  extra: Parameters<typeof createTestGameState>[0] = {},
  mutate?: (s: GameState) => void
) => {
  const state = createTestGameState({
    weeksLived: startWeek + played,
    lifeStartWeek: startWeek,
    ...extra,
  });
  mutate?.(state);
  return state;
};

/** Makes the character a celebrity, which the fame pack gates on. */
const makeCelebrity = (s: GameState) => {
  if (s.socialMedia) s.socialMedia.influenceLevel = 'celebrity';
};

describe('event gates are relative to the life, not the absolute clock', () => {
  it('the fixture models the bug: absolute counter is already 364 at week 0', () => {
    const fresh = life(AGE_25_START, 0);
    expect(fresh.weeksLived).toBe(364);
    expect(weeksInThisLife(fresh)).toBe(0);
  });

  // ── (a) early-game events reach a non-18 start ───────────────────────────

  describe('early-game events are available to a fresh age-25 start', () => {
    const earlyIds = ['find_cash', 'neighbor_job_tip', 'free_meal'];

    it.each(earlyIds)('%s passes for the age-25 first week', id => {
      const template = templateById(id);
      expect(template.condition?.(life(AGE_25_START, 0))).toBe(true);
    });

    it.each(earlyIds)('%s is identical for an age-18 start (lifeStartWeek 0)', id => {
      const template = templateById(id);
      expect(template.condition?.(life(0, 0))).toBe(true);
    });

    it.each(earlyIds)('%s still closes once the life passes week 12', id => {
      const template = templateById(id);
      expect(template.condition?.(life(AGE_25_START, 20))).toBe(false);
      expect(template.condition?.(life(0, 20))).toBe(false);
    });

    it('the starter grant fires on the FIRST TICK (week 1) of an age-25 life', () => {
      const starter = templateById('starter_luck');
      // Events are rolled on the post-advance state (`weeksLived: nextWeeksLived`),
      // so the first tick of a life evaluates at week 1. A `=== 0` gate could
      // never fire for any scenario (Program 6 walkthrough).
      expect(starter.condition?.(life(AGE_25_START, 1))).toBe(true);
      expect(starter.condition?.(life(0, 1))).toBe(true);
      // …and only on that tick.
      expect(starter.condition?.(life(AGE_25_START, 0))).toBe(false);
      expect(starter.condition?.(life(AGE_25_START, 2))).toBe(false);
    });

    it('first_paycheck_bonus opens in weeks 2-5 of the life, not weeks 2-5 past 18', () => {
      const t = templateById('first_paycheck_bonus');
      const employed = { currentJob: 'job_1', eventLog: [] };
      expect(t.condition?.(life(AGE_25_START, 0, employed))).toBe(false);
      expect(t.condition?.(life(AGE_25_START, 3, employed))).toBe(true);
      expect(t.condition?.(life(AGE_25_START, 9, employed))).toBe(false);
      // age-18 parity
      expect(t.condition?.(life(0, 3, employed))).toBe(true);
    });
  });

  // ── (b) late-game gates stay shut on a fresh start ───────────────────────

  describe('late-game gates do NOT open on the first week of an age-25 life', () => {
    it('near-miss "settled in" windows are closed at week 0 and open later', () => {
      const gated = [
        { id: 'near_miss_falling_object', weeks: 10 }, // > 10
        { id: 'near_miss_tornado', weeks: 20 },        // > 20
      ];
      for (const { id, weeks } of gated) {
        const t = nearMissById(id);
        expect(t.condition?.(life(AGE_25_START, 0))).toBe(false);
        expect(t.condition?.(life(AGE_25_START, weeks + 1))).toBe(true);
        // age-18 behaviour unchanged
        expect(t.condition?.(life(0, 0))).toBe(false);
        expect(t.condition?.(life(0, weeks + 1))).toBe(true);
      }
    });

    it('cliffhanger unlocks are closed at week 0 and open for a veteran life', () => {
      const police = CLIFFHANGERS.find(c => c.id === 'ch_police_visit');
      expect(police).toBeDefined();
      expect(police!.condition?.(life(AGE_25_START, 0))).toBe(false);
      expect(police!.condition?.(life(AGE_25_START, 30))).toBe(true);
      expect(police!.condition?.(life(0, 30))).toBe(true);
    });

    it('the fame stalker (>30 weeks) is closed at week 0 of a famous age-25 start', () => {
      const stalker = fameEventTemplates.find(t => t.id === 'fame_stalker');
      expect(stalker).toBeDefined();
      expect(stalker!.condition?.(life(AGE_25_START, 0, {}, makeCelebrity))).toBe(false);
      expect(stalker!.condition?.(life(AGE_25_START, 40, {}, makeCelebrity))).toBe(true);
      expect(stalker!.condition?.(life(0, 40, {}, makeCelebrity))).toBe(true);
    });

    it('the wealth pack still requires 26 weeks of ordinary life for a rich start', () => {
      // Net worth is irrelevant here: the week half of the gate must reject on
      // its own, which is the whole point of MIN_WEEKS_LIVED for rich scenarios.
      const rich = { stats: { money: 500_000_000 } };
      const gatedAtWeekZero = wealthEventTemplates.filter(
        t => t.condition?.(life(AGE_25_START, 0, rich)) === true
      );
      expect(gatedAtWeekZero).toHaveLength(0);

      const veteran = wealthEventTemplates.filter(
        t => t.condition?.(life(AGE_25_START, MIN_WEEKS_LIVED + 5, rich)) === true
      );
      expect(veteran.length).toBeGreaterThan(0);
    });

    it('the wedding gate (>=36 weeks) does not open on week 0 of an age-25 life', () => {
      const wedding = templateById('wedding');
      // A real Relationship literal, not a cast partial: the previous fixture
      // carried a `level` field that is not on Relationship at all (the gate
      // reads `type === 'partner'`), which only compiled because of the cast.
      const partnered: Parameters<typeof createTestGameState>[0] = {
        relationships: [
          {
            id: 'r1',
            name: 'Alex',
            type: 'partner',
            relationshipScore: 80,
            personality: 'caring',
            gender: 'female',
            age: 25,
          },
        ],
      };
      expect(wedding.condition?.(life(AGE_25_START, 0, partnered))).toBeFalsy();
      expect(wedding.condition?.(life(AGE_25_START, 40, partnered))).toBeTruthy();
      expect(wedding.condition?.(life(0, 40, partnered))).toBeTruthy();
    });
  });

  // ── (c) pre-v43 saves behave exactly as they do today ────────────────────

  describe('pre-v43 saves (no lifeStartWeek) keep their current behaviour', () => {
    const legacy = (
      weeksLived: number,
      extra: Parameters<typeof createTestGameState>[0] = {}
    ) => {
      const s = createTestGameState({ weeksLived, ...extra });
      delete (s as { lifeStartWeek?: number }).lifeStartWeek;
      return s;
    };

    it('weeksInThisLife falls back to the absolute counter', () => {
      expect((legacy(364) as { lifeStartWeek?: number }).lifeStartWeek).toBeUndefined();
      expect(weeksInThisLife(legacy(364))).toBe(364);
    });

    it('an early-game gate reads the absolute counter, as before', () => {
      const findCash = templateById('find_cash');
      expect(findCash.condition?.(legacy(5))).toBe(true);
      expect(findCash.condition?.(legacy(364))).toBe(false);
    });

    it('a late-game gate reads the absolute counter, as before', () => {
      const tornado = nearMissById('near_miss_tornado');
      expect(tornado.condition?.(legacy(5))).toBe(false);
      expect(tornado.condition?.(legacy(364))).toBe(true);
    });
  });
});
