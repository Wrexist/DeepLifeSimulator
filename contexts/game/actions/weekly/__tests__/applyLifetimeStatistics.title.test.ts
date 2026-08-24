/**
 * The tick stamps the job title while it is still true (STATE_VERSION 42).
 *
 * This is the WRITE half of the fix in #130. The read half —
 * `obituaryGenerator.lastJobTitle` preferring `entry.title` — is covered by
 * `__tests__/legacy/obituaryCareer.test.ts`, but that suite hand-builds the
 * history it reads, so it would go on passing if this stamp silently stopped.
 * The two halves are only worth anything together, so the last case here runs
 * the real tick and then the real obituary.
 *
 * Why the title is recorded rather than derived: the political exit resets
 * `careers.political.level` to 0 on purpose, so lifestyle costs and the
 * "in office?" UI stop treating a voted-out player as a sitting official.
 * Anything reconstructed from `careers` afterwards eulogised a president as
 * whatever level 0 is called. Stamping on the paid week makes the record
 * independent of what any exit path does later — including ones not yet written.
 */
import { applyLifetimeStatistics } from '../applyLifetimeStatistics';
import { generateObituary } from '@/lib/legacy/obituaryGenerator';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { Career, GameState, LifetimeStatistics } from '@/contexts/game/types';

/** The factory's own lifetimeStatistics, so nothing here is hand-built. */
function baseLifetimeStatistics(): LifetimeStatistics {
  const stats = createTestGameState().lifetimeStatistics;
  if (!stats) throw new Error('createTestGameState must carry lifetimeStatistics');
  return stats;
}

const DEV: Career = {
  id: 'software_engineer',
  levels: [
    { name: 'Junior Developer', salary: 900 },
    { name: 'Senior Developer', salary: 2_400 },
    { name: 'Engineering Lead', salary: 4_000 },
  ],
  level: 0,
  description: 'Writes software.',
  requirements: {},
  progress: 0,
  applied: true,
  accepted: true,
};

/** Employed, with one open history entry for the job being worked. */
function employed(over: Partial<Career> = {}, job = 'software_engineer'): GameState {
  return createTestGameState({
    currentJob: job,
    weeksLived: 300,
    careers: [{ ...DEV, ...over }],
    lifetimeStatistics: {
      ...baseLifetimeStatistics(),
      careerHistory: [{ job, weeks: 4, earnings: 3_600, startWeek: 296 }],
    },
  });
}

function tick(state: GameState, careerSalary = 2_400): LifetimeStatistics {
  const result = applyLifetimeStatistics({
    prevState: state,
    newBornChildrenCount: 0,
    careerSalary,
    safeNetWorth: 100_000,
    totalIncome: careerSalary,
    nextWeeksLived: (state.weeksLived ?? 0) + 1,
  }).updatedLifetimeStatistics;
  if (!result) throw new Error('fixture must carry lifetimeStatistics');
  return result;
}

const openEntry = (ls: LifetimeStatistics) => (ls.careerHistory ?? [])[0];

describe('a paid week records the title held that week', () => {
  it('stamps the title of the level currently reached', () => {
    expect(openEntry(tick(employed({ level: 1 }))).title).toBe('Senior Developer');
  });

  it('re-stamps after a promotion, so the entry holds the LATEST title', () => {
    // Stamping only once — on the first paid week — would eulogise everyone as
    // whatever they were hired as.
    const promoted = tick(employed({ level: 2 }));

    expect(openEntry(promoted).title).toBe('Engineering Lead');
  });

  it('still accumulates the week and the earnings (the control)', () => {
    // The stamp is additive to what `updateCareerHistory` already did.
    const entry = openEntry(tick(employed({ level: 1 })));

    expect(entry.weeks).toBe(5);
    expect(entry.earnings).toBe(6_000);
  });
});

describe('and it writes nothing it cannot vouch for', () => {
  it('an unpaid week leaves the entry alone', () => {
    // No salary is no work: the history must not gain a week, and a title
    // stamped for a week nobody was paid for is a title nobody held.
    const entry = openEntry(tick(employed({ level: 1 }), 0));

    expect(entry.title).toBeUndefined();
    expect(entry.weeks).toBe(4);
  });

  it('a career with no levels leaves the key ABSENT rather than empty', () => {
    // `''` would satisfy the reader's `if (last?.title)` check by being falsy,
    // but it would also be a stored key that means nothing. Absent is the
    // honest answer and the one the v42 carve-out documents.
    const entry = openEntry(tick(employed({ levels: [] })));

    expect('title' in entry).toBe(false);
  });

  it('a level index past the end of the ladder clamps instead of reading undefined', () => {
    expect(openEntry(tick(employed({ level: 99 }))).title).toBe('Engineering Lead');
  });

  it('a CLOSED history entry is never re-stamped', () => {
    // The title belongs to the week it was worked. A job you left cannot gain a
    // title from the one you hold now.
    const state = createTestGameState({
      currentJob: 'software_engineer',
      weeksLived: 300,
      careers: [{ ...DEV, level: 2 }],
      lifetimeStatistics: {
        ...baseLifetimeStatistics(),
        careerHistory: [
          { job: 'software_engineer', weeks: 40, earnings: 50_000, startWeek: 100, endWeek: 140 },
          { job: 'software_engineer', weeks: 4, earnings: 3_600, startWeek: 296 },
        ],
      },
    });

    const history = tick(state).careerHistory ?? [];
    expect('title' in history[0]).toBe(false);
    expect(history[1].title).toBe('Engineering Lead');
  });
});

describe('the two halves together - a president who left office', () => {
  it('is eulogised by the recorded title, not by the reset career', () => {
    const POLITICAL: Career = {
      ...DEV,
      id: 'political',
      levels: [
        { name: 'City Council Candidate', salary: 100 },
        { name: 'President', salary: 90_000 },
      ],
      level: 1,
    };

    // 1. The tick stamps the title while they are in office. Political pay
    //    arrives as `politicalWeeklySalary` — `careerSalary` is 0 by design,
    //    because passiveIncome owns that money.
    const inOffice = createTestGameState({
      currentJob: 'political',
      weeksLived: 300,
      careers: [POLITICAL],
      lifetimeStatistics: {
        ...baseLifetimeStatistics(),
        careerHistory: [{ job: 'political', weeks: 200, earnings: 9_000_000, startWeek: 100 }],
      },
    });
    const stamped = applyLifetimeStatistics({
      prevState: inOffice,
      newBornChildrenCount: 0,
      careerSalary: 0,
      politicalWeeklySalary: 1_730,
      safeNetWorth: 9_000_000,
      totalIncome: 1_730,
      nextWeeksLived: 301,
    }).updatedLifetimeStatistics;
    if (!stamped) throw new Error('fixture must carry lifetimeStatistics');
    expect(openEntry(stamped).title).toBe('President');

    // 2. They lose the election. The exit path sets level 0 and clears the
    //    flags — verbatim from `GameActionsContext`'s political-exit branch.
    const votedOut = createTestGameState({
      weeksLived: 400,
      deathReason: 'health',
      careers: [{ ...POLITICAL, accepted: false, applied: false, level: 0 }],
      lifetimeStatistics: stamped,
    });

    // 3. The obituary reads the record, not the wreckage.
    const text = JSON.stringify(generateObituary(votedOut));
    expect(text).toContain('President');
    expect(text).not.toContain('City Council Candidate');
  });
});
