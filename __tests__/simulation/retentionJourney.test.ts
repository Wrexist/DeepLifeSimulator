/**
 * RETENTION JOURNEY GATES — Master Program 9.
 *
 * The careful persona, 100 weeks on the real tick, answering what the game
 * puts in front of them. Pins the player-visible properties the program set
 * out to secure, measured before/after in `tasks/retention-journey-2026-09-03.md`:
 *   - the chapter spine moves (Chapter 2 completes inside its window);
 *   - the goal recommendation is not frozen (several SOON goals over a life,
 *     and it never rotates the urgent NOW goal away);
 *   - life moments arrive at the authored cadence once they are answered;
 *   - the week-ahead surface has something in motion regularly;
 *   - no long stretch without a single signal after the opening weeks.
 */
import { runPersona, answerPendingEvents, answerLifeMoment, meetIfOffered, keepInTouch, type SimPolicy, type SimWeekContext } from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import { recommendGoals } from '@/lib/goals';
import { upcomingEvents } from '@/lib/anticipation';
import { unlockTier } from '@/lib/progress/featureUnlocks';
import { getActiveChapter, getChapterProgress } from '@/lib/progress/lifeChapters';
import { getPromotionEligibility } from '@/lib/careers/promotionGating';

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

jest.setTimeout(900_000);

interface WeekSignals { week: number; signals: string[]; soon: string | undefined; now: string | undefined; upcoming: number }

function instrument(inner: SimPolicy, out: WeekSignals[]): SimPolicy {
  let prev: any = null;
  return async (ctx: SimWeekContext) => {
    const s = ctx.state();
    const signals: string[] = [];
    const pending = (s.pendingEvents ?? []).length;
    const tier = unlockTier(s);
    const chapter = getActiveChapter(s);
    const chapterDone = chapter ? getChapterProgress(chapter, s).completedGoals : 0;
    const goals = recommendGoals(s);
    const goalIds = goals.map((g) => g.id).join(',');
    const career = (s.careers ?? []).find((c) => c.id === s.currentJob);
    const promo = !!s.currentJob && getPromotionEligibility(career, s.weeksLived).eligible;
    const upcoming = upcomingEvents(s).length;
    const moments = s.lifeMoments?.totalMoments ?? 0;
    if (prev) {
      if (pending > prev.pending) signals.push('event');
      if (s.pendingCliffhanger) signals.push('cliff');
      if (promo && !prev.promo) signals.push('promo-ready');
      if ((career?.level ?? -1) > prev.level) signals.push('promoted');
      if (tier > prev.tier) signals.push('unlock');
      if (chapter && chapter.id === prev.chapterId && chapterDone > prev.chapterDone) signals.push('chapter-step');
      if (chapter && chapter.id !== prev.chapterId) signals.push('chapter-new');
      if (goalIds !== prev.goalIds) signals.push('goal-change');
      if (upcoming > prev.upcoming) signals.push('anticipation');
      if (moments > prev.moments) signals.push('moment');
      if ((s.diseases ?? []).length > prev.diseases) signals.push('illness');
    }
    out.push({ week: ctx.week, signals, soon: goals.find((g) => g.horizon === 'soon')?.id, now: goals[0]?.id, upcoming });
    prev = { pending, promo, level: career?.level ?? -1, tier, chapterId: chapter?.id, chapterDone, goalIds, upcoming, moments, diseases: (s.diseases ?? []).length };
    await inner(ctx);
    await answerPendingEvents(ctx);
    await answerLifeMoment(ctx);
  };
}

/**
 * The careful persona, plus the two social legs a player who opens Contacts
 * takes: say hello to whoever is around, and ring the people already in the
 * phone.
 *
 * Added with Program 11, when Chapter 2's social goal stopped being satisfied
 * by the seeded parents at their starting bond of 50 and became
 * `ch2_someone_close` (one relationship at 60). Both legs are free and both are
 * no-ops most weeks - `meetIfOffered` only fires in the week a new person is
 * around, and `keepInTouch` with `hangOut: false` is the Contacts app's free
 * Call, once per contact per week. Wrapped here rather than added to the shared
 * `C careful` persona, which the Program 7 survivability gates measure.
 */
function carefulAndSociable(): SimPolicy {
  const inner = PERSONAS['C careful']();
  return async (ctx: SimWeekContext) => {
    await inner(ctx);
    await meetIfOffered(ctx);
    await keepInTouch(ctx, { hangOut: false });
  };
}

describe('the careful player over 100 weeks has a life that keeps going somewhere', () => {
  const weeks: WeekSignals[] = [];
  let finalChapters: string[] = [];
  let totalMoments = 0;
  let died = false;
  let chapter2Week = -1;

  beforeAll(async () => {
    const r = await runPersona({
      name: 'C', policy: instrument(carefulAndSociable(), weeks), scenarioId: 'food_courier', seed: 1, weeks: 100,
      mutateSeed: (s) => ({ ...s, lineageId: 'life_retention' }),
    });
    died = r.died;
    finalChapters = r.rows[r.rows.length - 1].chapters;
    totalMoments = r.finalState.lifeMoments?.totalMoments ?? 0;
    chapter2Week = r.rows.find((x) => x.chapters.includes('ch2_settling_in'))?.week ?? -1;
  });

  it('is alive, and the chapter spine has moved past Chapter 2 inside its window', () => {
    expect(died).toBe(false);
    expect(finalChapters).toContain('ch1_fresh_start');
    expect(finalChapters).toContain('ch2_settling_in');
    expect(chapter2Week).toBeGreaterThan(0);
    expect(chapter2Week).toBeLessThanOrEqual(30);
  });

  it('the SOON goal is not the same line for the whole life, and NOW stays the urgent one', () => {
    const soon = new Set(weeks.slice(8).map((w) => w.soon).filter(Boolean));
    expect(soon.size).toBeGreaterThanOrEqual(3);
    // NOW is an urgency ranking: while health is fine and there is cash to
    // save, it is the savings ladder every single week (never rotated away).
    const nowIds = new Set(weeks.slice(20).map((w) => w.now));
    expect(nowIds.size).toBeLessThanOrEqual(2);
  });

  it('life moments arrive at the authored pace once answered (not one a year)', () => {
    expect(totalMoments).toBeGreaterThanOrEqual(4);
  });

  it('something is in motion on the week-ahead surface regularly', () => {
    const withUpcoming = weeks.filter((w) => w.upcoming > 0).length;
    expect(withUpcoming).toBeGreaterThanOrEqual(20);
  });

  it('after the opening weeks no silent stretch runs longer than six weeks (was ten)', () => {
    let run = 0;
    let longest = 0;
    for (const w of weeks) {
      if (w.week < 10) continue;
      if (w.signals.length === 0) { run++; longest = Math.max(longest, run); } else run = 0;
    }
    // Six, not the five this asserted from Program 9 until 2026-09-04, and the
    // reason is worth reading before anyone tightens it back.
    //
    // Until Program 13 the weekly event roll was seeded on the WEEK alone, so
    // every life in the game shared ONE event schedule. "5" was therefore not a
    // property of the game; it was a property of that single schedule, measured
    // once. With the roll salted per life, the longest quiet run is a random
    // variable, and it was measured across five lineages on this exact persona:
    //
    //   life_retention 6 | life_a 5 | life_b 3 | life_c 6 | life_d 6
    //
    // Six is the typical worst case, not an outlier, and nothing approaches the
    // ten this replaced. The cohort agrees: across 50 lives x 100 weeks the
    // MEDIAN gap between event weeks FELL from 4 to 3 while the tail widened,
    // which is what a per-life draw looks like. Re-pinning to 5 by choosing a
    // luckier `lineageId` would be fitting the test to the answer.
    expect(longest).toBeLessThanOrEqual(6);
  });
});
