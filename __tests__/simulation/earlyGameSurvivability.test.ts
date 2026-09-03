/**
 * EARLY-GAME SURVIVABILITY — the CI gates behind Master Program 7.
 *
 * These run the real production tick on the real onboarding seeds with the
 * shared personas (`__tests__/helpers/earlyGamePersonas.ts`) and pin
 * PLAYER-VISIBLE outcomes, not implementation details:
 *
 *   - the starting state of every scenario is the same known shape and has a
 *     recovery path a week-1 player can afford;
 *   - what the recap names is what the tick applies - the drains are additive,
 *     with no hidden multiplication between them;
 *   - a reasonable player survives the first 20 weeks; a careful one is
 *     comfortable; the player who ignores every warning still fails, but only
 *     after a warning window; a player who starts recovering at the critical
 *     tip gets back to safety within weeks; money without action does not
 *     buy survival, and the death screen says why.
 *
 * Deterministic (seeded RNG). If a balance change moves one of these, the
 * table in `tasks/early-game-balance-2026-09-02.md` is where the target came
 * from - re-measure before loosening a bound.
 */
import {
  runPersona,
  seedScenario,
  findScenario,
  type SimResult,
} from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import * as scenarioData from '@/src/features/onboarding/scenarioData';
import { computeHousingWellbeing, RENTAL_TIERS, canRent } from '@/lib/realEstate/rentals';
import { getJobBoard } from '@/lib/careers/jobMarket';
import { projectWeeklyVitalDrift } from '@/lib/economy/vitalDrift';
import { explainVitalDeath } from '@/lib/economy/deathCauses';
import { CRITICAL_VITAL } from '@/lib/config/hierarchy';
import { ZERO_STAT_DEATH_WEEKS } from '@/lib/config/gameConstants';

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

jest.setTimeout(600_000);

const ALL_SCENARIO_IDS: string[] = Object.values(scenarioData)
  .filter((v): v is any[] => Array.isArray(v))
  .flat()
  .map((s) => s?.id)
  .filter((id): id is string => typeof id === 'string');

/** The starts the brief is about: no wealth, ages 18-30. */
const POOR_STARTS = ['food_courier', 'highschool_dropout', 'corporate_intern', 'immigrant_story', 'second_chance'];

const run = (persona: keyof typeof PERSONAS, scenarioId: string): Promise<SimResult> =>
  runPersona({ name: String(persona), policy: PERSONAS[persona](), scenarioId, seed: 1, weeks: 20 });

const firstCriticalWeek = (r: SimResult): number | null => {
  const row = r.rows.find((x) => x.health <= CRITICAL_VITAL || x.happiness <= CRITICAL_VITAL);
  return row ? row.week : null;
};

// ── 1. Starting state ───────────────────────────────────────────────────────

describe('every scenario starts from a known, recoverable state', () => {
  it.each(ALL_SCENARIO_IDS)('%s: full vitals, no home, and a room and a job within reach on day one', (id) => {
    const s = seedScenario(id);
    expect(s.stats.health).toBe(100);
    expect(s.stats.happiness).toBe(100);
    expect(s.stats.energy).toBeGreaterThanOrEqual(80);

    // Every scenario starts with nowhere to live - a documented starting
    // pressure, not a hidden one: the recap projection names it on tick one.
    expect(computeHousingWellbeing(s).homeless).toBe(true);
    expect(projectWeeklyVitalDrift(s).causes.some((c) => c.id === 'home' && c.label === 'No home')).toBe(true);

    // ...and the bottom rung of the ladder is affordable from the first frame
    // (no income requirement, first week payable from starting cash).
    const cheapest = RENTAL_TIERS.reduce((a, b) => (b.weeklyRent < a.weeklyRent ? b : a), RENTAL_TIERS[0]);
    expect(cheapest.incomeRequirement).toBe(0);
    expect(canRent(s, cheapest).allowed).toBe(true);

    // ...and the job board always has an opening the character qualifies for.
    expect(getJobBoard(s).some((o) => o.verdict.eligible)).toBe(true);
    expect(findScenario(id).start.cash).toBeGreaterThanOrEqual(cheapest.weeklyRent);
  });
});

// ── 2. Drains are additive - the recap's sum is the tick's delta ────────────

describe('what the recap names is what the tick applies', () => {
  it('a homeless entry worker past the grace ramp loses exactly the named causes, within rounding', async () => {
    // One real tick from a state at full decay, then compare the vital
    // deltas to the sum of the projection's causes. If a penalty were
    // multiplying another (poverty × homeless, job × poverty...), the tick
    // would move further than the sum says.
    let projected = { health: 0, happiness: 0 };
    const r = await runPersona({
      name: 'additivity probe',
      scenarioId: 'food_courier',
      seed: 1,
      weeks: 1,
      mutateSeed: (st) => {
        const next = {
          ...st,
          weeksLived: st.weeksLived + 12,
          lifeStartWeek: st.weeksLived,
          currentJob: 'fast_food',
          careers: st.careers.map((c) => (c.id === 'fast_food' ? { ...c, applied: true, accepted: true, level: 0, startedWeeksLived: st.weeksLived } : c)),
          lastGymVisitWeek: st.weeksLived + 12,
          lastDiseaseWeek: st.weeksLived + 12, // no disease roll this tick
        };
        projected = projectWeeklyVitalDrift(next);
        return next;
      },
      policy: () => undefined,
    });
    const row = r.rows[0];
    expect(row.health - 100).toBeGreaterThanOrEqual(projected.health - 1.5);
    expect(row.health - 100).toBeLessThanOrEqual(projected.health + 1.5);
    expect(row.happiness - 100).toBeGreaterThanOrEqual(projected.happiness - 1.5);
    expect(row.happiness - 100).toBeLessThanOrEqual(projected.happiness + 1.5);
    // And natural decay is no longer the biggest drain - the one the player
    // can act on for $45 a week is.
    const causes = projectWeeklyVitalDrift(seedScenario('food_courier')).causes;
    const home = causes.find((c) => c.id === 'home')!;
    const decay = causes.find((c) => c.id === 'decay')!;
    expect(Math.abs(home.happiness)).toBeGreaterThanOrEqual(Math.abs(decay.happiness));
  });
});

// ── 3. Twenty weeks, five personas ─────────────────────────────────────────

describe('a reasonable new player survives the first 20 weeks', () => {
  it.each(POOR_STARTS)('%s: the careful player (rents, one walk + one meditation a week) is comfortable', async (id) => {
    const r = await run('C careful', id);
    expect(r.died).toBe(false);
    // The age-30 start (second_chance) sits past the disease system's
    // "young" gate and carries the 35%/week occurrence cap from week 3 - a
    // harder start by design, still survivable. Recorded as a proposal.
    const floor = id === 'second_chance' ? 30 : 60;
    expect(r.minHealth).toBeGreaterThanOrEqual(floor);
    expect(r.minHappiness).toBeGreaterThanOrEqual(60);
  });

  it.each(POOR_STARTS)('%s: the average player (reacts to a Low ring, rents by week 4) is alive at week 20', async (id) => {
    const r = await run('A average', id);
    expect(r.died).toBe(false);
    expect(r.rows[r.rows.length - 1].week).toBe(20);
  });

  it.each(['food_courier', 'highschool_dropout'])('%s: the struggling player (late job, steak every week, never rents) is alive at week 20', async (id) => {
    const r = await run('D struggling', id);
    expect(r.died).toBe(false);
  });

  it('food_courier: the strategic player is never in trouble', async () => {
    const r = await run('E strategic', 'food_courier');
    expect(r.died).toBe(false);
    expect(r.minHealth).toBeGreaterThanOrEqual(80);
    expect(r.minHappiness).toBeGreaterThanOrEqual(80);
  });
});

// ── 4. Inaction fails - fairly ──────────────────────────────────────────────

describe('the player who ignores every warning fails, after a warning window', () => {
  it.each(['food_courier', 'highschool_dropout'])('%s: the text-skipper dies, but not before week 12, and reads Critical for weeks first', async (id) => {
    const r = await run('B text skipper', id);
    expect(r.died).toBe(true);
    expect(r.deathWeek!).toBeGreaterThanOrEqual(12);
    const critical = firstCriticalWeek(r)!;
    expect(critical).not.toBeNull();
    // At least the four zero weeks plus one Critical week on screen before death.
    expect(r.deathWeek! - critical).toBeGreaterThanOrEqual(ZERO_STAT_DEATH_WEEKS + 1);
  });

  it('money paradox: the text-skipper dies with thousands in the bank, and the death screen says why', async () => {
    const r = await run('B text skipper', 'food_courier');
    expect(r.died).toBe(true);
    expect(r.rows[r.rows.length - 1].cash).toBeGreaterThan(2_000);
    const why = explainVitalDeath(r.finalState)!;
    expect(why).not.toBeNull();
    expect(why.what).toMatch(/sat at 0 for \d+ weeks/);
    expect(why.why).toContain('No home');
    expect(why.fix).toContain('Life → Health');
    expect(why.fix).toContain('Market → Housing');
  });
});

// ── 5. Recovery is real, and fast enough to matter ─────────────────────────

describe('recovery from the critical tip is possible in the time the player has', () => {
  it.each(['food_courier', 'immigrant_story'])('%s: a player who starts at the Critical tip is back above 60/60 within 6 weeks and alive at 20', async (id) => {
    const r = await run('R recovery', id);
    expect(r.died).toBe(false);
    const start = r.rows.findIndex((x) => x.notes.includes('RECOVERY STARTS'));
    expect(start).toBeGreaterThanOrEqual(0);
    const recoveredAt = r.rows.findIndex((x, i) => i >= start && x.health >= 60 && x.happiness >= 60);
    expect(recoveredAt).toBeGreaterThanOrEqual(0);
    expect(recoveredAt - start).toBeLessThanOrEqual(6);
  });
});
