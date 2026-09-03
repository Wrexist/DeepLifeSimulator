/**
 * SOCIAL BOUNDARIES ON THE REAL TICK — Master Program 11 gates.
 *
 * The CI half of the persona measurement. The soak
 * (`socialPersonas.sim.test.ts`) prints the tables; these pin the outcomes that
 * must not regress, on the real `nextWeek()` with real action modules.
 *
 * What each gate is standing in front of:
 *
 *  - A partner used to be the strongest money engine in the game by two orders
 *    of magnitude (an annual salary spent weekly). The romance life must not
 *    out-earn the career life.
 *  - A tier-1 player used to have no way to meet anybody at all.
 *  - Relationships must stay OPTIONAL: the loner must survive, stay housed and
 *    keep progressing without ever opening a social surface.
 */
import { runPersona, rowAt, type SimResult } from '../helpers/earlyGameSim';
import { SOCIAL_PERSONAS } from '../helpers/socialPersonas';
import { MEET_MAX_INTRODUCED, MEET_WINDOW_WEEKS } from '@/lib/social/meetPeople';

jest.setTimeout(20 * 60 * 1000);

const WEEKS = 100;
const results: Record<string, SimResult> = {};

/**
 * Mean happiness over the run.
 *
 * A single sampled week is one draw: happiness oscillates with the tick's
 * events and a romance life that averages 92 can still be at 85 on week 100
 * while a career life sits at 94. Program 10's lesson, applied to a stat
 * instead of a market — assert on the statistic, not on one frame.
 */
function meanHappiness(r: SimResult): number {
  if (r.rows.length === 0) return 0;
  return r.rows.reduce((sum, row) => sum + row.happiness, 0) / r.rows.length;
}

async function run(name: keyof typeof SOCIAL_PERSONAS | string): Promise<SimResult> {
  if (results[name]) return results[name];
  const spec = SOCIAL_PERSONAS[name];
  results[name] = await runPersona({
    name: String(name),
    scenarioId: spec.scenarioId,
    seed: 1,
    weeks: WEEKS,
    policy: spec.make(),
  });
  return results[name];
}

describe('a relationship is a life, not an income stream', () => {
  it('the romance life does not out-earn the career life', async () => {
    const romance = await run('ROMANCE-FOCUSED');
    const career = await run('CAREER-OBSESSED');
    const r = rowAt(romance, WEEKS)!;
    const c = rowAt(career, WEEKS)!;

    // Before the annual/weekly fix this ratio was 57x the other way: $1.33M
    // against $23k, from one Spark promotion at week 13.
    expect(r.netWorth).toBeLessThan(c.netWorth * 2);
    // …and the romance life is paid in something else. Measured: mean
    // happiness 92 against 78, and a floor of 61 against 46.
    expect(meanHappiness(romance)).toBeGreaterThan(meanHappiness(career) + 5);
    expect(r.romance).not.toBe('none');
  });

  it('no persona compounds a partner into a fortune', async () => {
    for (const name of ['ROMANCE-FOCUSED', 'FAMILY-FOCUSED']) {
      const row = rowAt(await run(name), WEEKS)!;
      expect(row.netWorth).toBeLessThan(500_000);
    }
  });
});

describe('somebody can enter a life before tier 2', () => {
  it('the casual social player has met people well before Spark opens', async () => {
    const casual = await run('CASUAL SOCIAL');
    const early = rowAt(casual, MEET_WINDOW_WEEKS * 3)!;

    expect(early.chosen).toBeGreaterThan(0);
  });

  it('and the door is capped, so a social life never becomes an inbox', async () => {
    const friendly = await run('FRIENDSHIP-FOCUSED');
    const met = (friendly.finalState.relationships ?? []).filter(
      (r) => typeof r?.id === 'string' && r.id.startsWith('met-'),
    );
    expect(met.length).toBeLessThanOrEqual(MEET_MAX_INTRODUCED);
  });
});

describe('relationships are optional', () => {
  it('the loner survives a hundred weeks, housed, solvent and progressing', async () => {
    const loner = await run('LONER');
    const row = rowAt(loner, WEEKS)!;

    expect(loner.died).toBe(false);
    expect(row.chosen).toBe(0);
    expect(row.housing).not.toBe('homeless');
    expect(row.netWorth).toBeGreaterThan(0);
    // The chapter spine is not frozen behind a relationship: the tier still
    // climbs on the wealth and career milestones alone.
    expect(row.tier).toBeGreaterThanOrEqual(2);
  });

  it('and is not quietly miserable for refusing', async () => {
    const loner = await run('LONER');
    const career = await run('CAREER-OBSESSED');
    // Estrangement costs something (a standing drag) but never becomes a
    // death spiral for a playstyle the game supports.
    expect(rowAt(loner, WEEKS)!.happiness).toBeGreaterThan(40);
    expect(rowAt(career, WEEKS)!.happiness).toBeGreaterThan(40);
  });
});

describe('different social lives are actually different', () => {
  it('the friendship life and the loner life do not look the same', async () => {
    const friendly = rowAt(await run('FRIENDSHIP-FOCUSED'), WEEKS)!;
    const loner = rowAt(await run('LONER'), WEEKS)!;

    expect(friendly.chosen).toBeGreaterThan(loner.chosen + 4);
    expect(friendly.strong).toBeGreaterThan(loner.strong + 4);
    expect(friendly.avgBond).toBeGreaterThan(loner.avgBond + 20);
  });

  it('the romance life reaches a stage the friendship life never does', async () => {
    const romance = rowAt(await run('ROMANCE-FOCUSED'), WEEKS)!;
    const friendly = rowAt(await run('FRIENDSHIP-FOCUSED'), WEEKS)!;

    expect(romance.romance).not.toBe('none');
    expect(friendly.romance).toBe('none');
  });
});
