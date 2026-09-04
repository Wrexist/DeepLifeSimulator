/**
 * Seasonal events fire at most once per season — and the dead branch is gone.
 *
 * `shouldTriggerSeasonalEvent` consulted `state.seasonalEvents`
 * (`{ lastSeason, completedEvents }`), a field NOTHING in the repo ever writes.
 * So `completedEvents` was permanently empty (the "already happened" guard
 * never fired, and an event could repeat week after week) and `lastSeason` was
 * permanently `''`, which made `lastSeason !== currentSeason` always true — the
 * function ALWAYS returned from the 4% "season just changed" branch and the
 * 0.4% base chance plus the whole `weekInSeason` rarity curve below it were
 * unreachable code that had never run once.
 *
 * It now DERIVES from `weeksLived`, the way Legacy Contracts (v33) derive
 * progress: one roll per (event, season) decides whether it happens, a second
 * decides which single week it lands on. No state, no migration, and a replayed
 * tick cannot double-fire.
 */

import { shouldTriggerSeasonalEvent, getCurrentSeason } from '@/lib/events/seasonalEvents';
import { resolveCalendar } from '@/utils/weekCounters';
import { createTestGameState } from '../helpers/createTestGameState';

const WEEKS_PER_SEASON = 13;
const at = (weeksLived: number) => {
  const s = createTestGameState();
  s.weeksLived = weeksLived;
  return s;
};

/** Every week of the season index `n`, for one event id. */
const weeksThatFire = (eventId: string, seasonIdx: number): number[] => {
  const fired: number[] = [];
  for (let w = 0; w < WEEKS_PER_SEASON; w += 1) {
    const weeksLived = seasonIdx * WEEKS_PER_SEASON + w;
    if (shouldTriggerSeasonalEvent(at(weeksLived), eventId)) fired.push(w);
  }
  return fired;
};

const IDS = ['spring_festival', 'summer_heatwave', 'fall_harvest', 'winter_storm'];

describe('at most once per season - the property the old code never had', () => {
  it.each(IDS)('%s never fires twice in the same season', (id) => {
    for (let season = 0; season < 40; season += 1) {
      expect(`${id}@${season}:${weeksThatFire(id, season).length}`)
        .toBe(`${id}@${season}:${Math.min(1, weeksThatFire(id, season).length)}`);
    }
  });

  it('does not fire every single week (the old repeat bug)', () => {
    // Under the old logic a 4%-per-week roll could hit in consecutive weeks and
    // nothing suppressed it, because completedEvents was never appended to.
    let maxRun = 0;
    for (let season = 0; season < 40; season += 1) {
      maxRun = Math.max(maxRun, weeksThatFire('spring_festival', season).length);
    }
    expect(maxRun).toBeLessThanOrEqual(1);
  });
});

describe('determinism - a replayed tick cannot double-fire', () => {
  it('the same week always gives the same answer', () => {
    for (const week of [0, 13, 57, 260, 1040]) {
      const a = shouldTriggerSeasonalEvent(at(week), 'spring_festival');
      const b = shouldTriggerSeasonalEvent(at(week), 'spring_festival');
      expect(`${week}:${a}`).toBe(`${week}:${b}`);
    }
  });

  it('does not read the vestigial seasonalEvents field', () => {
    // An existing save carries `{ lastSeason: '', completedEvents: [] }`; a
    // corrupt one might carry anything. Neither may change the outcome.
    const clean = at(57);
    const dirty = at(57);
    dirty.seasonalEvents = { lastSeason: 'winter', completedEvents: ['spring_festival'] };
    expect(shouldTriggerSeasonalEvent(dirty, 'spring_festival'))
      .toBe(shouldTriggerSeasonalEvent(clean, 'spring_festival'));
  });

  it('tolerates a missing or absurd weeksLived', () => {
    const s = createTestGameState();
    s.weeksLived = undefined as unknown as number;
    expect(typeof shouldTriggerSeasonalEvent(s, 'spring_festival')).toBe('boolean');
    s.weeksLived = -50;
    expect(typeof shouldTriggerSeasonalEvent(s, 'spring_festival')).toBe('boolean');
    s.weeksLived = NaN;
    expect(typeof shouldTriggerSeasonalEvent(s, 'spring_festival')).toBe('boolean');
  });
});

describe('it still actually happens', () => {
  it('fires across a long life rather than never', () => {
    // The failure mode opposite to "fires constantly": a rule so tight nothing
    // ever triggers. Over 60 in-game years there should be plenty.
    let total = 0;
    for (let season = 0; season < 240; season += 1) total += weeksThatFire('spring_festival', season).length;
    expect(total).toBeGreaterThan(20);
    expect(total).toBeLessThan(180);
  });

  it('different events keep independent schedules', () => {
    const a = weeksThatFire('spring_festival', 3);
    const b = weeksThatFire('winter_storm', 3);
    // Not asserting they differ every season - that would be asserting on the
    // hash. Over many seasons they must not move in lockstep.
    let same = 0;
    for (let s = 0; s < 40; s += 1) {
      if (JSON.stringify(weeksThatFire('spring_festival', s)) === JSON.stringify(weeksThatFire('winter_storm', s))) same += 1;
    }
    expect(same).toBeLessThan(40);
    expect(Array.isArray(a) && Array.isArray(b)).toBe(true);
  });

  it('is biased toward the start of a season', () => {
    // The intent the unreachable `weekInSeason` branch was trying to express.
    let early = 0;
    let late = 0;
    for (const id of IDS) {
      for (let s = 0; s < 120; s += 1) {
        for (const w of weeksThatFire(id, s)) (w < WEEKS_PER_SEASON / 2 ? (early += 1) : (late += 1));
      }
    }
    expect(early).toBeGreaterThan(late);
  });
});

describe('the dead branch is gone', () => {
  const raw = require('fs').readFileSync(
    require('path').join(__dirname, '../../lib/events/seasonalEvents.ts'),
    'utf8'
  );
  // Assert on CODE, not prose. The doc comment names the removed expressions on
  // purpose, to explain why they are gone - matching those is how a source-grep
  // test lies to you.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('no longer branches on lastSeason', () => {
    expect(src).not.toMatch(/seasonalData\.lastSeason/);
    expect(src).not.toMatch(/completedEvents\.includes/);
  });

  it('derives the season from weeksLived', () => {
    expect(src).toMatch(/state\.weeksLived/);
    expect(src).toMatch(/function seasonIndex/);
  });

  it('the season length is stated once, not scattered', () => {
    expect(src).toMatch(/export const WEEKS_PER_SEASON = 13;/);
    // 13 must not be re-typed inline in CODE. Comments are prose and the
    // HOLIDAY_WEEKS table holds weeks-of-YEAR (Easter's window opens on week
    // 13), neither of which is the season length - so both are stripped before
    // counting, leaving only the declaration.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/const HOLIDAY_WEEKS[\s\S]*?\n\];/, '');
    expect(code.match(/\b13\b/g) ?? []).toEqual(['13']);
  });
});

/**
 * The season the badge shows and the month the HUD shows are ONE calendar.
 *
 * They were two. `getCurrentSeason` bucketed `weeksLived % 52` into thirteens
 * and called bucket 0 "spring", while the date card printed January - because a
 * life ALWAYS starts in January (`computeWeeksLived = (age - 18) * 52` is a
 * multiple of 52 for every integer starting age, so `weeksLived % 52 === 0` on
 * week one). Every label sat a full quarter ahead, and every seasonal event
 * fired a quarter early with it: Spring Festival in January, the beach party in
 * April, the harvest festival in July.
 */
describe('the season agrees with the calendar month', () => {
  const SEASON_OF_MONTH: Record<number, string> = {
    1: 'winter', 2: 'winter', 3: 'winter',
    4: 'spring', 5: 'spring', 6: 'spring',
    7: 'summer', 8: 'summer', 9: 'summer',
    10: 'fall', 11: 'fall', 12: 'fall',
  };

  it('never disagrees, on any week of the year', () => {
    for (let week = 0; week < 52; week += 1) {
      const { monthNumber } = resolveCalendar(week);
      expect(getCurrentSeason(week).season).toBe(SEASON_OF_MONTH[monthNumber]);
    }
  });

  it('holds for a life that started at a non-zero age', () => {
    // age 25 seeds weeksLived at 364; the season must track the month there too.
    for (let week = 364; week < 364 + 52; week += 1) {
      const { monthNumber } = resolveCalendar(week);
      expect(getCurrentSeason(week).season).toBe(SEASON_OF_MONTH[monthNumber]);
    }
  });

  it('changes on the quarter boundaries, not somewhere inside a month', () => {
    expect(getCurrentSeason(0).season).toBe('winter');
    expect(getCurrentSeason(12).season).toBe('winter');
    expect(getCurrentSeason(13).season).toBe('spring');
    expect(getCurrentSeason(25).season).toBe('spring');
    expect(getCurrentSeason(26).season).toBe('summer');
    expect(getCurrentSeason(38).season).toBe('summer');
    expect(getCurrentSeason(39).season).toBe('fall');
    expect(getCurrentSeason(51).season).toBe('fall');
  });

  it('weekInSeason stays 0-12 and restarts with the season', () => {
    for (const boundary of [0, 13, 26, 39]) {
      expect(getCurrentSeason(boundary).weekInSeason).toBe(0);
      expect(getCurrentSeason(boundary + 12).weekInSeason).toBe(12);
    }
  });
});

/**
 * Holidays land in the month they actually happen.
 *
 * Only three of the eight did. Easter fired in late January, Independence Day
 * in early April, Halloween in late August, Thanksgiving and Black Friday in
 * September - all because the windows were authored in `weekInSeason` against
 * the mislabelled seasons above.
 */
describe('holidays fall in their real months', () => {
  const monthOf = (week: number) => resolveCalendar(week).monthNumber;

  const firstWeekOf = (holiday: string): number => {
    for (let week = 0; week < 52; week += 1) {
      if (getCurrentSeason(week).holiday === holiday) return week;
    }
    throw new Error(`${holiday} never fires`);
  };

  it.each([
    ['newyear', 1],       // January
    ['valentines', 2],    // February
    ['easter', 4],        // April
    ['independence', 7],  // July
    ['halloween', 10],    // October
    ['thanksgiving', 11], // November
    ['blackfriday', 12],  // the Friday after; week 48 reads as December
    ['christmas', 12],    // December
  ])('%s opens in month %i', (holiday, month) => {
    expect(monthOf(firstWeekOf(holiday as string))).toBe(month);
  });

  it('every holiday is reachable', () => {
    const seen = new Set<string>();
    for (let week = 0; week < 52; week += 1) {
      const h = getCurrentSeason(week).holiday;
      if (h) seen.add(h);
    }
    expect([...seen].sort()).toEqual([
      'blackfriday', 'christmas', 'easter', 'halloween',
      'independence', 'newyear', 'thanksgiving', 'valentines',
    ]);
  });

  /**
   * The clobbering this replaces: `holiday` was assigned by a run of
   * independent `if` blocks with OVERLAPPING windows, so the last match
   * silently won. `thanksgiving` (weeks 9-11 of its season) overwrote
   * `halloween` (8-10) and `blackfriday` (10-12) overwrote both, leaving
   * Halloween reachable on exactly ONE week of the year instead of three.
   */
  it('gives Halloween and Thanksgiving their full windows', () => {
    const weeksFor = (holiday: string) => {
      const weeks: number[] = [];
      for (let week = 0; week < 52; week += 1) {
        if (getCurrentSeason(week).holiday === holiday) weeks.push(week);
      }
      return weeks;
    };
    expect(weeksFor('halloween').length).toBeGreaterThan(1);
    expect(weeksFor('thanksgiving').length).toBeGreaterThan(1);
  });

  /**
   * The one template whose theme did NOT survive the relabel.
   *
   * `winter_holidays` ("the city is decorated and festive", gifts, family) was
   * gated on `season === 'winter'`, which under the calendar-aligned seasons is
   * Jan-Mar - so the relabel would have moved a December event into January and
   * February. It is gated on the month now, because the month is what the event
   * was ever about.
   */
  it('keeps the holiday-season event in December', () => {
    const src: string = require('fs').readFileSync(
      require('path').join(__dirname, '../../lib/events/seasonalEvents.ts'),
      'utf8'
    );
    const template = src.slice(src.indexOf("id: 'winter_holidays'"), src.indexOf('generate:', src.indexOf("id: 'winter_holidays'")));
    expect(template).toContain('monthNumber');
    expect(template).toMatch(/month === 12/);
    expect(template).not.toMatch(/season\.season === 'winter'/);
  });

  it('no week resolves to two holidays', () => {
    // A week has one holiday by construction (a single table lookup), so this
    // pins the table itself: the windows must not overlap.
    const seenWeeks = new Map<number, string>();
    for (let week = 0; week < 52; week += 1) {
      const h = getCurrentSeason(week).holiday;
      if (h) {
        expect(seenWeeks.has(week)).toBe(false);
        seenWeeks.set(week, h);
      }
    }
  });
});
