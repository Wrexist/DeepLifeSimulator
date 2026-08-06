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

describe('at most once per season — the property the old code never had', () => {
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

describe('determinism — a replayed tick cannot double-fire', () => {
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
    // Not asserting they differ every season — that would be asserting on the
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
  // purpose, to explain why they are gone — matching those is how a source-grep
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
    expect(src).toMatch(/const WEEKS_PER_SEASON = 13;/);
    // 13 must not be re-typed inline anywhere in the code.
    expect(src.match(/\b13\b/g) ?? []).toEqual(['13']);
  });
});

describe('getCurrentSeason is untouched', () => {
  it('still maps weeks to the four seasons', () => {
    expect(getCurrentSeason(0).season).toBe('spring');
    expect(getCurrentSeason(13).season).toBe('summer');
    expect(getCurrentSeason(26).season).toBe('fall');
    expect(getCurrentSeason(39).season).toBe('winter');
  });
});
