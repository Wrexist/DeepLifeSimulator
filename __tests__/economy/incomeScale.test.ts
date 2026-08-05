/**
 * The income side of the economy, measured — and the relationships that must hold.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * "The game gives too much money" got answered from intuition more than once
 * before anyone measured it. The salary rescale that caused the report looked
 * reasonable in isolation: it fixed a real absurdity (a line cook on $2 080/yr
 * beside a $95 000 apartment). What it did not do was check the number that
 * actually matters — how much cash a default life accumulates — because nothing
 * in the suite computed that.
 *
 * So this file both ASSERTS the relationships and prints the model, and the
 * printed report is the artefact to read after any balance edit:
 *
 *     npx jest incomeScale
 *
 * ── The modelled life, and its assumptions ────────────────────────────────
 *
 * A DEFAULT life: no property, no diet plan, no subscriptions. Income tax is
 * then the only mandatory outgoing, so cash accumulates almost unopposed. That
 * is both the reported case and the harshest one for balance — if the numbers
 * work here they work everywhere.
 *
 * Street work is scored at EXPECTED value (base success rate x payment), capped
 * by the 40/week energy regen and the three-runs-per-job weekly cap. A
 * 30%-success job that pays $100 is not a $100 job, and scoring it as one is how
 * street grinding stayed invisibly ahead of every salary level.
 *
 * A career costs 5 energy/week, so it does NOT compete with street work for the
 * energy budget — a player can do both. The comparison here is career-only
 * against street-only, which keeps the two legible; the combined case is
 * strictly richer than either.
 */
import fs from 'fs';
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import { calculateIncomeTax } from '@/lib/economy/constants';
import { RENT_INCOME_RATE, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { initialGameState } from '@/contexts/game/initialState';

/** `baseEnergyRegen` in the weekly tick. */
const ENERGY_PER_WEEK = 40;
/** Weekly per-job cap (the "0/3" counter on the Work tab). */
const RUNS_PER_JOB_PER_WEEK = 3;
/** The cheapest property on the board — the first real money goal. */
const STUDIO_PRICE = 95_000;

const report: string[] = [];
const line = (label: string, value: string) => report.push(`  ${label.padEnd(46)} ${value}`);

const fastFood = INITIAL_CAREERS.find((c) => c.id === 'fast_food')!;
const ENTRY = fastFood.levels[0].salary;
const LADDER_TOP = fastFood.levels[fastFood.levels.length - 1].salary;

/**
 * The best expected street income a week's energy can buy, played greedily by
 * expected-value-per-energy — which is what an optimising player converges on.
 * Gated jobs (requiring an item or a dark-web purchase) are excluded: this is
 * the income available to a brand new character.
 */
function bestStreetWeek(): number {
  const options = (initialGameState.streetJobs ?? [])
    .filter((j) => !j.requirements?.length && !j.darkWebRequirements?.length)
    .map((j) => {
      const energy = j.energyCost || 1;
      const expected = (j.basePayment || 0) * ((j.baseSuccessRate || 0) / 100);
      return { energy, expected, perEnergy: expected / energy };
    })
    .sort((a, b) => b.perEnergy - a.perEnergy);

  let energy = ENERGY_PER_WEEK;
  let income = 0;
  for (const option of options) {
    for (let run = 0; run < RUNS_PER_JOB_PER_WEEK && energy >= option.energy; run++) {
      energy -= option.energy;
      income += option.expected;
    }
  }
  return Math.round(income);
}

/** Years of net pay to reach a target, tax deducted, nothing else spent. */
function yearsToAfford(weeklyGross: number, target: number): number {
  const net = weeklyGross - calculateIncomeTax(weeklyGross);
  return net <= 0 ? Infinity : target / (net * WEEKS_PER_YEAR);
}

const STREET_WEEK = bestStreetWeek();
const WEEKLY_RENT = Math.round(STUDIO_PRICE * RENT_INCOME_RATE);
const RENT_YIELD_PCT = RENT_INCOME_RATE * WEEKS_PER_YEAR * 100;

beforeAll(() => {
  report.push('\nINCOME SCALE');
  line('Bottom-rung career (fast food)', `$${ENTRY}/wk`);
  line('Top of that ladder', `$${LADDER_TOP}/wk`);
  line('Best street week (expected, 40 energy)', `$${STREET_WEEK}/wk`);
  line('Street vs bottom-rung career', `${(STREET_WEEK / ENTRY).toFixed(2)}x`);

  report.push('\nTIME TO THE FIRST PROPERTY ($95,000 studio, no other outgoings)');
  line('On the bottom rung', `${yearsToAfford(ENTRY, STUDIO_PRICE).toFixed(1)} years`);
  line('At the top of that ladder', `${yearsToAfford(LADDER_TOP, STUDIO_PRICE).toFixed(1)} years`);
  line('Grinding street work only', `${yearsToAfford(STREET_WEEK, STUDIO_PRICE).toFixed(1)} years`);

  report.push('\nRENT');
  line('Weekly rent on the studio', `$${WEEKLY_RENT}`);
  line('Gross yield', `${RENT_YIELD_PCT.toFixed(1)}%/yr`);
  line('Years for it to repay its purchase price', `${(100 / RENT_YIELD_PCT).toFixed(1)} years`);
  line('Rent income vs bottom-rung career', `${(WEEKLY_RENT / ENTRY).toFixed(2)}x`);

  const starts = INITIAL_CAREERS.map((c) => c.levels[0].salary).sort((a, b) => a - b);
  report.push('\nCAREER LADDER');
  line('Lowest starting wage', `$${starts[0]}/wk`);
  line('Highest starting wage', `$${starts[starts.length - 1]}/wk`);
  line('Spread, lowest to highest start', `${(starts[starts.length - 1] / starts[0]).toFixed(1)}x`);
  report.push('');
});

afterAll(() => {
  // Written to a file rather than console.log: the jest setup silences console
  // in this project, so a report nobody can read is a report nobody reads.
  try {
    fs.writeFileSync('/tmp/income-scale.txt', report.join('\n'));
  } catch {
    /* reporting is best-effort; the assertions below are the gate */
  }
});

describe('a career is worth holding', () => {
  it('pays better than grinding the street, week for week', () => {
    // Street work also costs health, happiness and carries arrest risk, so equal
    // pay would already make it the worse deal — but it was AHEAD at every
    // salary level, which is why "careers should beat grinding" never held.
    expect(STREET_WEEK).toBeLessThan(ENTRY);
  });

  it('still leaves street work viable for someone with no job', () => {
    // It is the only income an unemployed character has. Crushing it does not
    // make careers attractive, it makes the early game a wall.
    expect(STREET_WEEK).toBeGreaterThan(ENTRY * 0.4);
  });

  it('rewards climbing the ladder', () => {
    expect(LADDER_TOP).toBeGreaterThan(ENTRY * 1.5);
  });
});

describe('the first property is a real goal', () => {
  it('takes a long time on the bottom rung', () => {
    // The reported problem: this had fallen to 6 years, so a minimum-wage
    // character bought property almost incidentally.
    expect(yearsToAfford(ENTRY, STUDIO_PRICE)).toBeGreaterThan(12);
  });

  it('but is not the 37-year impossibility it used to be', () => {
    // The pre-rescale figure. A goal nobody can reach is not a goal.
    expect(yearsToAfford(ENTRY, STUDIO_PRICE)).toBeLessThan(28);
  });

  it('comes within reach by climbing', () => {
    expect(yearsToAfford(LADDER_TOP, STUDIO_PRICE)).toBeLessThan(
      yearsToAfford(ENTRY, STUDIO_PRICE) / 2,
    );
  });
});

describe('rent is a return, not a money printer', () => {
  it('yields a believable gross percentage', () => {
    // It was 26%/yr, which repaid a property in under four years and made
    // landlording strictly dominant over every career in the game.
    expect(RENT_YIELD_PCT).toBeGreaterThan(4);
    expect(RENT_YIELD_PCT).toBeLessThan(12);
  });

  it('does not repay the purchase price in a handful of years', () => {
    expect(100 / RENT_YIELD_PCT).toBeGreaterThan(8);
  });
});

describe('the career board holds together', () => {
  it('starts no ladder below the floor', () => {
    for (const career of INITIAL_CAREERS) {
      expect(`${career.id}: ${career.levels[0].salary}`).toBe(
        `${career.id}: ${Math.max(career.levels[0].salary, 0)}`,
      );
      expect(career.levels[0].salary).toBeGreaterThanOrEqual(100);
    }
  });

  it('keeps every ladder monotonic', () => {
    for (const career of INITIAL_CAREERS) {
      for (let i = 1; i < career.levels.length; i++) {
        expect(career.levels[i].salary).toBeGreaterThanOrEqual(career.levels[i - 1].salary);
      }
    }
  });

  it('keeps the spread between the worst and best start believable', () => {
    const starts = INITIAL_CAREERS.map((c) => c.levels[0].salary);
    expect(Math.max(...starts) / Math.min(...starts)).toBeLessThan(20);
  });
});
