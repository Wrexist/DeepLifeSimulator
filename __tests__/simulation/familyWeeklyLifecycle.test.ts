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

it('the real weekly loop completes a pregnancy and preserves the child in the family', async () => {
  const run = await runPersona({ name: 'family-birth', weeks: 1, policy: () => {}, mutateSeed: state => ({
    ...state, stats: { ...state.stats, money: 50000, health: 100, happiness: 80 },
    relationships: [{ id: 'alex', name: 'Alex', type: 'partner', age: 24,
      gender: 'female', personality: 'kind', relationshipScore: 90, livingTogether: true,
      isPregnant: true, pregnancyStartWeek: state.weeksLived - 9,
      pregnancyChildGender: 'female', pregnancyChildName: 'Riley' }],
    family: { ...state.family, spouse: undefined, children: [] },
  }) });
  const state = run.finalState;
  expect(state.relationships.find(r => r.id === 'alex')?.isPregnant).toBeFalsy();
  const newborn = state.relationships.find(r => r.type === 'child' && r.name === 'Riley');
  expect(newborn).toBeDefined();
  expect(state.family.children.some(c => c.id === newborn!.id)).toBe(true);
  expect(state.stats.money).toBeLessThan(50000);
}, 120000);
