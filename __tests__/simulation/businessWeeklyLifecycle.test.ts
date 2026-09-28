import { runPersona } from '../helpers/earlyGameSim';
import { businessState } from '../helpers/businessFixture';
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

it('the canonical weekly transition charges named salary exactly once', async () => {
  const run = (salary: number) => runPersona({ name: 'business-payroll', weeks: 1, policy: () => {}, mutateSeed: state => {
    const fixture = businessState();
    fixture.companies![0].employees = 1;
    fixture.hustleApp!.companies.factory.hiringPipeline.namedHires = [{ candidateId: 'hired', hiredWeek: state.weeksLived, role: 'engineer', salary, morale: 80, performance: 80 }];
    return { ...state, lineageId: 'business-payroll', stats: { ...state.stats, money: 1000000 }, companies: fixture.companies, company: fixture.companies![0], hustleApp: fixture.hustleApp };
  } });
  const normal = await run(2000.75); const higher = await run(2100.75);
  expect(normal.finalState.weeksLived).toBe(higher.finalState.weeksLived);
  expect(normal.finalState.stats.money - higher.finalState.stats.money).toBeCloseTo(100, 6);
  expect(normal.finalState.hustleApp!.companies.factory.hiringPipeline.namedHires).toHaveLength(1);
}, 120000);
