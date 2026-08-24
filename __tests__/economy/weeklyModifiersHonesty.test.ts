/**
 * C-4 — the Weekly Modifiers card promised a penalty no code applies.
 *
 * `IdentityCard` renders a "Weekly Modifiers" list: what the player's stats
 * will do on the next Next Week. One row claimed that at 30 health or below a
 * "Sickness" modifier costs -10 health, -15 energy and -10 happiness EVERY
 * WEEK.
 *
 * Nothing applied it. The weekly health change is a flat decay
 * (`effectiveDecayRate * 0.6`) that does not vary with how low health already
 * is; the only health-driven death is health at ZERO for four consecutive
 * weeks; and no module in `contexts/game/actions/weekly/`, nor `applyDiseases`,
 * nor the week loop keys off a 30 threshold at all.
 *
 * Removed rather than implemented — the reasoning is in the code comment, and
 * the short version is that a -10 health/week penalty switching on at 30 is a
 * compounding death spiral no save has ever had, so inventing it to match a
 * label would be a balance change wearing a bug fix's clothes. The card
 * already warns about the same state honestly in `healthIssues`.
 *
 * This is the same class as GL-3 (PoliticalApp rendering a weekly health bonus
 * nothing added) and the diet-plan x7 a player reported, and the third one
 * found: the card is a contract, and it was writing cheques the tick did not
 * cash.
 *
 * 2026-08-01 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import { ZERO_STAT_DEATH_WEEKS } from '@/lib/config/gameConstants';

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const CARD = read('components/IdentityCard.tsx');

/** The card's `weeklyModifiers` memo, isolated from the rest of the file. */
function weeklyModifiersBlock(): string {
  const start = CARD.indexOf('const weeklyModifiers = useMemo(');
  expect(start).toBeGreaterThan(-1);
  const end = CARD.indexOf('return modifiers;', start);
  expect(end).toBeGreaterThan(start);
  return CARD.slice(start, end);
}

describe('C-4 - no weekly tick applies a low-health penalty', () => {
  /**
   * The premise, asserted rather than assumed. If a sickness penalty is ever
   * genuinely implemented, this test fails and whoever implemented it is told
   * to put the card row back — which is the correct outcome, not a nuisance.
   */
  it('no weekly subsystem keys off a low-health threshold', () => {
    const dir = path.join(ROOT, 'contexts/game/actions/weekly');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

    expect(files.length).toBeGreaterThan(30); // the ~37 apply* subsystems

    for (const file of files) {
      const code = fs.readFileSync(path.join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

      expect(`${file}: ${/health\s*(<=|<)\s*(30|20|25)\b/.test(code)}`)
        .toBe(`${file}: false`);
    }
  });

  it('the week loop only kills on health at ZERO, and only after four weeks', () => {
    const loop = read('contexts/game/GameActionsContext.tsx');

    expect(loop).toMatch(/newStats\.health <= 0/);
    // The threshold moved from a bare `4` to `ZERO_STAT_DEATH_WEEKS`, which had
    // been sitting in gameConstants with no code consumer while another module
    // cited it by name as authoritative. Assert BOTH halves: the loop reads the
    // constant, and the constant is still four. Pinning only the literal let the
    // named copy drift; pinning only the name would let "four weeks" become ten
    // without this test noticing.
    expect(loop).toMatch(/newHealthZeroWeeks >= ZERO_STAT_DEATH_WEEKS/);
    expect(ZERO_STAT_DEATH_WEEKS).toBe(4);
    // And nothing between 1 and 30 is special.
    expect(/newStats\.health\s*(<=|<)\s*(30|20|25)\b/.test(loop)).toBe(false);
  });

  it('the weekly health change does not vary with how low health is', () => {
    const loop = read('contexts/game/GameActionsContext.tsx');

    // A single unconditional decay term is the whole of it.
    expect(loop).toMatch(
      /newStats\.health = Math\.max\(0, \(newStats\.health \|\| 0\) - effectiveDecayRate \* 0\.6\)/,
    );
  });
});

describe('C-4 - the card no longer advertises it', () => {
  it('the Sickness row and its invented numbers are gone', () => {
    const block = weeklyModifiersBlock();

    expect(block).not.toMatch(/label: 'Sickness'/);
    expect(block).not.toMatch(/health: -10, energy: -15, happiness: -10/);
    expect(block).not.toMatch(/stats\.health <= 30/);
  });

  it('and the memo no longer recomputes on a stat it does not read', () => {
    // health decays every tick; keeping it as a dependency rebuilt this list
    // on every week advance for nothing.
    expect(CARD).toMatch(/\}, \[dietPlans\]\);/);
  });
});

describe('C-4 - the honest warning for the same state survives (the control)', () => {
  /**
   * Deleting the false row must not have left a player at 12 health with no
   * warning at all. `healthIssues` tests the SAME condition and says something
   * true, with the fix attached.
   */
  it('healthIssues still raises Low health on the same threshold', () => {
    const start = CARD.indexOf('const healthIssues = useMemo(');
    expect(start).toBeGreaterThan(-1);
    const block = CARD.slice(start, CARD.indexOf('return issues;', start));

    expect(block).toMatch(/health <= 30/);
    expect(block).toMatch(/title: 'Low health'/);
    expect(block).toMatch(/fix: 'Improve your diet, rest, and exercise/);
  });

  it('and still counts down the four weeks once health hits zero', () => {
    expect(CARD).toMatch(/4 - \(gameState\.healthZeroWeeks \|\| 0\)/);
  });

  it('the modifiers list still shows the effects that ARE real', () => {
    // The diet plan row is applied by applyDietPlan every tick - removing the
    // false row must not have emptied the card.
    const block = weeklyModifiersBlock();

    expect(block).toMatch(/activeDietPlan/);
    expect(block).toMatch(/Diet`/);
    expect(read('contexts/game/actions/weekly/applyDietPlan.ts').length).toBeGreaterThan(0);
  });
});
