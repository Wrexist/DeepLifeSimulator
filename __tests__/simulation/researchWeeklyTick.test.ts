import { runPersona } from '../helpers/earlyGameSim';
import { researchState } from '../helpers/researchFixture';
import { hydrateLoadedState } from '@/utils/hydrateLoadedState';
import type { GameState } from '@/contexts/game/types';

// This suite verifies simulation, not asynchronous disk I/O. Avoid leaving a
// background save task alive after the mounted game has been torn down.
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

describe('R&D on the real weekly transition', () => {
  jest.setTimeout(120000);
  const run = async (weeks: number, starting?: GameState) => runPersona({
    name: 'research', weeks, policy: () => {}, seedMathRandom: false,
    mutateSeed: state => starting ?? {
      ...state,
      companies: researchState().companies,
      company: researchState().company,
      lineageId: 'research-life',
    },
  });

  it('advances once per played week and preserves the result across save/load continuation', async () => {
    const first = await run(1);
    expect(first.finalState.companies![0].rdLab!.researchProjects[0].progress).toBe(25);
    expect(first.finalState.companies![0].patents![0].duration).toBe(1);
    const loaded = hydrateLoadedState(JSON.parse(JSON.stringify(first.finalState)), { source: 'research-test', permanentPerks: [] }).state;
    const resumed = await run(3, loaded);
    const uninterrupted = await run(4);
    for (const result of [resumed, uninterrupted]) {
      expect(result.finalState.companies![0].rdLab!.researchProjects[0]).toMatchObject({ progress: 100, completed: true });
      expect(result.finalState.companies![0].patents).toEqual([]);
      expect(result.finalState.companies![0].unlockedTechnologies).toEqual(['ml_models']);
    }
    expect(resumed.finalState.companies).toEqual(uninterrupted.finalState.companies);
    expect(resumed.finalState.company).toEqual(uninterrupted.finalState.company);
  });
});
