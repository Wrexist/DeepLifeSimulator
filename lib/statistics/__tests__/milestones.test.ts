import { buildMilestones } from '../milestones';
import { GameState } from '@/contexts/game/types';

function base(over: Partial<any> = {}): GameState {
  return {
    weeksLived: 200,
    lifetimeStatistics: {},
    pets: [],
    ...over,
  } as any;
}

describe('buildMilestones', () => {
  it('returns empty list for fresh state', () => {
    expect(buildMilestones(base())).toEqual([]);
  });

  it('triggers first-million when peak net worth >= 1M', () => {
    const s = base({ lifetimeStatistics: { peakNetWorth: 1_500_000, peakNetWorthWeek: 120 } });
    const m = buildMilestones(s).find((x) => x.id === 'first-million');
    expect(m).toBeDefined();
    expect(m!.context).toBe('Week 120');
  });

  it('also triggers first-ten-million at $10M+', () => {
    const s = base({ lifetimeStatistics: { peakNetWorth: 12_000_000 } });
    const ms = buildMilestones(s);
    expect(ms.find((m) => m.id === 'first-million')).toBeDefined();
    expect(ms.find((m) => m.id === 'first-ten-million')).toBeDefined();
  });

  it('reports creator subscriber tiers', () => {
    const s = base({ gamingStreaming: { subscribers: 150_000 } });
    const ms = buildMilestones(s);
    expect(ms.find((m) => m.id === 'creator-1k')).toBeDefined();
    expect(ms.find((m) => m.id === 'creator-100k')).toBeDefined();
  });

  it('counts dark-web jobs', () => {
    const jobHistory = Array.from({ length: 15 }, (_, i) => ({ id: `j${i}` }));
    const s = base({ darkWeb: { jobHistory } });
    expect(buildMilestones(s).find((m) => m.id === 'fence')).toBeDefined();
  });

  it('orders weeked milestones chronologically before unweeked', () => {
    const s = base({
      lifetimeStatistics: {
        peakNetWorth: 1_500_000,
        peakNetWorthWeek: 50,
        totalCompaniesOwned: 1,
      },
    });
    const ms = buildMilestones(s);
    // weeked items come first
    expect(ms[0].week).toBe(50);
  });
});
