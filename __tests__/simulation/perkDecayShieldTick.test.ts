/**
 * ONB-2 on the production week loop: the perk decay shields
 * (lib/economy/perkDecayShield.ts) reach the real tick, not just the
 * projection. An idle life on food_courier, 12 weeks, same seed, with and
 * without each perk flag. The pure table is pinned in
 * __tests__/onboarding/perksCatalogue.test.ts.
 */
import fs from 'fs';
import { runPersona } from '../helpers/earlyGameSim';

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

const WEEKS = 12;

const run = (perkIds: string[]) => runPersona({
  name: `perk-shield:${perkIds.join('+') || 'none'}`,
  weeks: WEEKS,
  seed: 11,
  policy: () => {},
  mutateSeed: (s) => ({
    ...s,
    perks: { ...(s.perks ?? {}), ...Object.fromEntries(perkIds.map((id) => [id, true])) },
  }),
});

describe('ONB-2 - perk decay shields on the real weekly tick', () => {
  jest.setTimeout(180000);

  it('each shield keeps its vital higher than the same idle life without it', async () => {
    const none = await run([]);
    const longevity = await run(['longevity']);
    const ironWill = await run(['iron_will']);
    const innerPeace = await run(['inner_peace']);
    const optimist = await run(['optimist']);

    const last = (r: typeof none) => r.rows[r.rows.length - 1];
    const line = (label: string, r: typeof none) =>
      `${label.padEnd(12)} week ${last(r).week}: health ${Math.round(last(r).health)} (min ${Math.round(r.minHealth)}), happiness ${Math.round(last(r).happiness)} (min ${Math.round(r.minHappiness)})`;
    const report = [
      line('none', none), line('longevity', longevity), line('iron_will', ironWill),
      line('inner_peace', innerPeace), line('optimist', optimist),
    ].join('\n');
    // jest swallows console output from a --silent run; DUMP=<file> keeps it.
    if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, `${report}\n`);

    expect(none.died).toBe(false);
    expect(none.rows.length).toBeGreaterThanOrEqual(WEEKS);
    expect(last(longevity).health).toBeGreaterThan(last(none).health);
    expect(last(ironWill).health).toBeGreaterThan(last(none).health);
    expect(last(longevity).health).toBeGreaterThanOrEqual(last(ironWill).health);
    expect(last(innerPeace).happiness).toBeGreaterThan(last(none).happiness);
    expect(last(optimist).happiness).toBeGreaterThan(last(none).happiness);
    expect(last(innerPeace).happiness).toBeGreaterThanOrEqual(last(optimist).happiness);
    // A shield on one vital leaves the other alone.
    expect(Math.round(last(longevity).happiness)).toBe(Math.round(last(none).happiness));
  });
});
