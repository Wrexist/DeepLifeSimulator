/**
 * LIFE REPRODUCIBILITY AND VARIATION — Master Program 8.
 *
 * Runs the production tick with the game's OWN randomness (no Math.random
 * stub) and pins the two properties the brief asks for:
 *   same life seed + same actions  → the same life, byte for byte;
 *   different life seed + same actions → a different life.
 * Plus the defect that made every Quick Start the same life: a new game must
 * mint its own lineage id.
 */
import { runPersona, seedScenario, withStartingAge, type SimResult } from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import { lifeSalt } from '@/utils/seededRoll';

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

/** Everything a player would notice, week by week. */
const fingerprint = (r: SimResult): string =>
  r.rows
    .map((row) => `${row.week}|${row.cash}|${row.health}|${row.happiness}|${row.energy}|${row.fitness}|${row.housing}|${row.job}/${row.level}|${row.diseases.join(',')}`)
    .join('\n') + `\n${r.died ? `died@${r.deathWeek}:${r.deathReason}` : 'alive'}`;

const diseaseHistory = (r: SimResult): string => {
  const out: string[] = [];
  let prev: string[] = [];
  for (const row of r.rows) {
    for (const d of row.diseases) if (!prev.includes(d)) out.push(`${row.week}:${d}`);
    prev = row.diseases;
  }
  return out.join(' ');
};

const live = (lineageId: string, persona: keyof typeof PERSONAS = 'B text skipper', weeks = 26) =>
  runPersona({
    name: String(persona),
    policy: PERSONAS[persona](),
    scenarioId: 'food_courier',
    seed: 1,
    weeks,
    seedMathRandom: false,
    mutateSeed: (s) => ({ ...s, lineageId }),
  });

describe('a new game is a new life', () => {
  it('every Quick Start mints its own lineage id, so its salt is its own', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = seedScenario('food_courier');
      expect(s.lineageId).not.toBe('initial-lineage');
      ids.add(lifeSalt(s));
    }
    expect(ids.size).toBe(20);
  });
});

describe('same life, same actions, same outcome', () => {
  it('three runs of one life with the live RNG are byte-identical', async () => {
    const a = fingerprint(await live('life_repro'));
    const b = fingerprint(await live('life_repro'));
    const c = fingerprint(await live('life_repro'));
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('holds for a persona that acts every week too', async () => {
    const a = fingerprint(await live('life_repro_c', 'C careful', 16));
    const b = fingerprint(await live('life_repro_c', 'C careful', 16));
    expect(b).toBe(a);
  });
});

describe('different lives diverge', () => {
  it('twelve young lives with identical actions are twelve different lives', async () => {
    const fingerprints = new Set<string>();
    for (let i = 0; i < 12; i++) fingerprints.add(fingerprint(await live(`life_var_${i}`)));
    expect(fingerprints.size).toBe(12);
  });

  it('twelve 45-year-old lives with identical actions get at least eight different illness histories', async () => {
    // Older lives fall ill often enough to show the schedule is gone: under
    // the week-keyed roll all twelve had the SAME illnesses on the SAME weeks.
    const histories = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const r = await runPersona({
        name: 'C', policy: PERSONAS['C careful'](), scenarioId: 'food_courier', seed: 1, weeks: 40,
        seedMathRandom: false,
        mutateSeed: (s) => ({ ...withStartingAge(s, 45), lineageId: `life_var45_${i}` }),
      });
      histories.add(diseaseHistory(r));
    }
    expect(histories.size).toBeGreaterThanOrEqual(8);
  });
});
