import { buildCrossSystemSummary } from '../crossSystemSummary';
import { GameState } from '@/contexts/game/types';

function base(over: Partial<any> = {}): GameState {
  return {
    weeksLived: 100,
    ...over,
  } as any;
}

describe('buildCrossSystemSummary', () => {
  it('returns empty cards when no systems have data', () => {
    expect(buildCrossSystemSummary(base()).cards).toEqual([]);
  });

  it('produces a banking card with credit + interest details', () => {
    const s = base({
      banking: {
        creditScore: 720,
        lifetimeInterestPaid: 5000,
        lifetimeInterestEarned: 800,
        loans: [{ id: 'l1' }, { id: 'l2' }],
      },
    });
    const card = buildCrossSystemSummary(s).cards.find((c) => c.id === 'banking');
    expect(card).toBeDefined();
    expect(card!.lead.value).toBe('720');
    expect(card!.details.find((d) => d.label === 'Open loans')?.value).toBe('2');
  });

  it('flags credit warning when score < 600', () => {
    const s = base({ banking: { creditScore: 540 } });
    const card = buildCrossSystemSummary(s).cards.find((c) => c.id === 'banking');
    expect(card?.warning).toMatch(/credit/i);
  });

  it('produces a real-estate card from owned properties (regression: was always [])', () => {
    const s = base({
      realEstate: [
        { id: 'h1', owned: true, currentValue: 300000, price: 250000 },
        { id: 'h2', owned: true, price: 150000 }, // no currentValue → falls back to price
        { id: 'h3', owned: false, currentValue: 999999 }, // not owned → excluded
      ],
    });
    const card = buildCrossSystemSummary(s).cards.find((c) => c.id === 'realEstate');
    expect(card).toBeDefined();
    expect(card!.lead.value).toBe('2');
    expect(card!.details.find((d) => d.label === 'Value')?.value).toBe('$450.0k');
  });

  it('skips real-estate card when no owned properties', () => {
    const s = base({ realEstate: [{ id: 'h1', owned: false, currentValue: 100000 }] });
    expect(buildCrossSystemSummary(s).cards.find((c) => c.id === 'realEstate')).toBeUndefined();
  });

  it('skips politics card when no career level', () => {
    const s = base({ politics: { careerLevel: 0, approvalRating: 50 } });
    expect(buildCrossSystemSummary(s).cards.find((c) => c.id === 'politics')).toBeUndefined();
  });

  it('includes politics card when career level > 0', () => {
    const s = base({
      politics: { careerLevel: 1, approvalRating: 70, electionsWon: 1, policiesEnacted: [], scandals: [{ active: true }] },
    });
    const card = buildCrossSystemSummary(s).cards.find((c) => c.id === 'politics');
    expect(card?.warning).toBe('Active scandal');
  });

  it('computes net favor money from ledger', () => {
    const s = base({
      favorLedger: {
        favors: [
          { status: 'open', kind: 'money', direction: 'owed-to-player', value: 1000 },
          { status: 'open', kind: 'money', direction: 'owed-by-player', value: 300 },
          { status: 'redeemed', kind: 'money', direction: 'owed-to-player', value: 500 },
        ],
      },
    });
    expect(buildCrossSystemSummary(s).netFavorMoney).toBe(700);
  });

  it('warns when dark-web heat is critical', () => {
    const s = base({ darkWeb: { heat: 85, jobHistory: [], activeJobs: [] } });
    const card = buildCrossSystemSummary(s).cards.find((c) => c.id === 'darkweb');
    expect(card?.warning).toMatch(/heat/i);
  });

  it('skips darkweb card when no engagement', () => {
    const s = base({ darkWeb: { heat: 0, jobHistory: [], activeJobs: [], playerReputation: 0 } });
    expect(buildCrossSystemSummary(s).cards.find((c) => c.id === 'darkweb')).toBeUndefined();
  });

  it('includes contacts card from provided counts', () => {
    const card = buildCrossSystemSummary(base(), { family: 2, lobbyist: 1, vendor: 3 }).cards.find((c) => c.id === 'contacts');
    expect(card).toBeDefined();
    expect(card!.lead.value).toBe('6');
  });
});
