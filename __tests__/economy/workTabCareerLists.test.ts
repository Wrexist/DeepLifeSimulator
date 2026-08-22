/**
 * Every career belongs to exactly one list on the Work tab.
 *
 * The screen has two career sections — "Standard Careers", fed from
 * `gameState.careers`, and "Advanced Careers", fed from the `ADVANCED_CAREERS`
 * catalog — and the only thing keeping them from overlapping was a literal in
 * the middle of a 1,300-line screen file:
 *
 *   const advancedIds = ['politician', 'celebrity', 'athlete'];
 *
 * which names a DIFFERENT set from the one the Advanced section iterates. All
 * three of those live in `INITIAL_CAREERS`; the catalog holds ceo,
 * research_scientist, creative_director, investment_banker and surgeon. So the
 * filter got both halves wrong at once:
 *
 *   - politician, celebrity and athlete were excluded from Standard and never
 *     picked up by Advanced, so they rendered NOWHERE — unreachable careers
 *     that achievements, two ambition lines and a weekly event all still read.
 *   - the five real advanced careers rendered TWICE once applied for: from the
 *     player's own `careers` entry (real level, real pay, Manage Job) and again
 *     from the catalog stub at rung 0 ("Resident $1,150/wk" beside "Surgical
 *     Director $26K/wk").
 *
 * The second half is the reported bug — "unsure of what the income is, usually
 * the case with every job, conflicting numbers" — arriving as two cards rather
 * than as two screens.
 *
 * These tests pin the partition itself, not the literal: they compute list
 * membership the way the screen does and assert every catalogued career lands
 * in exactly one list.
 */
import {
  ADVANCED_CAREERS,
  ADVANCED_CAREER_IDS,
  isAdvancedCareer,
} from '@/lib/careers/advancedCareers';
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import fs from 'fs';
import path from 'path';

/**
 * Comments stripped, the way the sibling source-pattern suites read a file:
 * the shapes asserted below are discussed in prose in that file, and a
 * prohibition that its own explanatory comment trips is a test that can only be
 * passed by not documenting the fix.
 */
const workTabSource = fs
  .readFileSync(path.join(__dirname, '..', '..', 'app', '(tabs)', 'work.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('the advanced id set is derived, not transcribed', () => {
  it('matches the catalog exactly', () => {
    expect([...ADVANCED_CAREER_IDS].sort()).toEqual(ADVANCED_CAREERS.map((c) => c.id).sort());
  });

  it('the screen derives it rather than listing ids by hand', () => {
    // The specific literal that caused this. Its absence is the fix; a
    // re-transcribed list under any name would drift the same way.
    expect(workTabSource).not.toMatch(/\['politician',\s*'celebrity',\s*'athlete'\]/);
    expect(workTabSource).toMatch(/isAdvancedCareer/);
  });

  it('grows on its own when a career is added to the catalog', () => {
    // The property the literal did not have. Guarded by construction, asserted
    // here so a future refactor back to a hand-written array fails.
    expect(ADVANCED_CAREER_IDS.size).toBe(ADVANCED_CAREERS.length);
    for (const career of ADVANCED_CAREERS) {
      expect(isAdvancedCareer(career.id)).toBe(true);
    }
  });
});

describe('the two catalogs are disjoint, so the partition is total', () => {
  it('no career is in both INITIAL_CAREERS and ADVANCED_CAREERS', () => {
    const initialIds = new Set(INITIAL_CAREERS.map((c) => c.id));
    const overlap = ADVANCED_CAREERS.map((c) => c.id).filter((id) => initialIds.has(id));
    // An id in both would render twice again, from a different direction.
    expect(overlap).toEqual([]);
  });

  it('every catalogued career lands in exactly one list', () => {
    // `basicCareers` is `gameState.careers.filter(c => !isAdvancedCareer(c.id))`
    // and the advanced section renders `ADVANCED_CAREERS`. Model both.
    const all = [...INITIAL_CAREERS.map((c) => c.id), ...ADVANCED_CAREERS.map((c) => c.id)];
    for (const id of all) {
      const inStandard = INITIAL_CAREERS.some((c) => c.id === id) && !isAdvancedCareer(id);
      const inAdvanced = isAdvancedCareer(id);
      expect(`${id}:${Number(inStandard) + Number(inAdvanced)}`).toBe(`${id}:1`);
    }
  });

  it('politician, celebrity and athlete are reachable again', () => {
    // The three the literal hid. Named explicitly because they are the reported
    // casualties, and because each is read by live systems that had no way to
    // fire: `achievementsData` reads celebrity/athlete level, `lib/ambitions`
    // reads politician, `lib/events/engine.ts` gates an event on holding one.
    for (const id of ['politician', 'celebrity', 'athlete']) {
      expect(`${id}:standard`).toBe(
        `${id}:${INITIAL_CAREERS.some((c) => c.id === id) && !isAdvancedCareer(id) ? 'standard' : 'MISSING'}`,
      );
    }
  });
});

describe('an advanced career the player holds renders once, from their own entry', () => {
  it('the advanced section defers to renderCareerCard for a held career', () => {
    // The catalog stub can only describe rung 0. A player working the career
    // needs their level, progress, raise premium and the Manage Job / promote
    // controls — which only `renderCareerCard` draws.
    expect(workTabSource).toMatch(/const held = gameState\.careers\.find\(c => c\.id === career\.id\);/);
    expect(workTabSource).toMatch(/if \(held\) return renderCareerCard\(held\);/);
  });

  it('and the stub it falls back to quotes pay in the shared money', () => {
    // Was `$${salary.toLocaleString()}/wk` off `levels[0].salary` — a fourth
    // format on a screen that now speaks one.
    expect(workTabSource).not.toMatch(/\$\$\{salary\.toLocaleString\(\)\}\/wk/);
    expect(workTabSource).toMatch(/paidWeeklySalaryForLevel\(gameState, career, 0\)/);
  });
});

describe('the Current Job hero quotes the paycheck', () => {
  it('reads paidWeeklyCareerSalary, not the ladder base', () => {
    // It prints the salary and the negotiated premium on ONE line
    // ("$13,000/wk · Lv 5/8 · +100%"), so the base here stated the premium and
    // withheld it in the same breath.
    expect(workTabSource).toMatch(/const currentJobSalary = paidWeeklyCareerSalary\(gameState\)\.total;/);
    expect(workTabSource).not.toMatch(/const currentJobSalary = currentJobLevel\?\.salary/);
    expect(workTabSource).toMatch(/\{formatMoney\(currentJobSalary\)\}\/wk/);
  });
});
