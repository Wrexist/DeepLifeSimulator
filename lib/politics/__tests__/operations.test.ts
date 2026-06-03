import { PoliticsState } from '@/contexts/game/types';
import {
  addScandal,
  applySuppression,
  driftApproval,
  ensurePoliticsHasNewFields,
  getPACTotal,
  pacRaiseClean,
  pacRaiseDirty,
  pacSpend,
  rollScandal,
  tickScandals,
} from '../operations';

function empty(): PoliticsState {
  return {
    careerLevel: 1,
    approvalRating: 60,
    policyInfluence: 0,
    electionsWon: 1,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };
}

describe('ensurePoliticsHasNewFields', () => {
  it('seeds scandals + pac when missing', () => {
    const r = ensurePoliticsHasNewFields(empty());
    expect(r.scandals).toEqual([]);
    expect(r.pac).toBeDefined();
    expect(r.pac!.cleanUSD).toBe(0);
  });

  it('passes through when already present', () => {
    const seeded = ensurePoliticsHasNewFields(empty());
    expect(ensurePoliticsHasNewFields(seeded)).toBe(seeded);
  });
});

describe('PAC helpers', () => {
  it('clean raise updates pac.cleanUSD', () => {
    const r = pacRaiseClean(empty(), 5000, 5);
    expect(r.pac!.cleanUSD).toBe(5000);
  });

  it('dirty raise updates pac.dirtyUSD + lifetimeDirtyUSD', () => {
    const r = pacRaiseDirty(empty(), 0.5, 60_000, 5);
    expect(r.usdConverted).toBe(30_000);
    expect(r.politics.pac!.dirtyUSD).toBe(30_000);
    expect(r.politics.pac!.lifetimeDirtyUSD).toBe(30_000);
  });

  it('spend bumps approval', () => {
    let p = pacRaiseClean(empty(), 100_000, 1);
    const r = pacSpend(p, 50_000);
    expect(r.approvalGain).toBeGreaterThan(0);
    expect(r.politics.approvalRating).toBeGreaterThan(60);
  });

  it('getPACTotal sums clean + dirty', () => {
    let p = pacRaiseClean(empty(), 10_000, 1);
    p = pacRaiseDirty(p, 1, 50_000, 2).politics;
    expect(getPACTotal(p)).toBe(60_000);
  });
});

describe('scandal management', () => {
  it('addScandal pushes onto the list (newest first)', () => {
    let p = ensurePoliticsHasNewFields(empty());
    p = addScandal(p, {
      id: 's1',
      category: 'corruption',
      severity: 'minor',
      headline: 'X',
      startedWeek: 1,
      weeksRemaining: 4,
      approvalLost: 0,
      suppressedUSD: 0,
      active: true,
    });
    expect(p.scandals).toHaveLength(1);
  });

  it('rollScandal returns null when fire roll is too high', () => {
    const p = ensurePoliticsHasNewFields(empty());
    const r = rollScandal(p, { darkWebHeat: 50 }, 1, { fire: 0.999, severity: 0.5, category: 0.5, headline: 0.5 });
    expect(r).toBeNull();
  });

  it('rollScandal fires when probability is high and roll is low', () => {
    const p = ensurePoliticsHasNewFields(empty());
    const r = rollScandal(
      p,
      { darkWebHeat: 100, pacDirtyUSD: 5_000_000, karma: -100 },
      1,
      { fire: 0.001, severity: 0.5, category: 0.5, headline: 0.5 }
    );
    expect(r).not.toBeNull();
    expect(r!.scandal.active).toBe(true);
  });

  it('tickScandals drains approval', () => {
    let p = ensurePoliticsHasNewFields(empty());
    p = addScandal(p, {
      id: 's1',
      category: 'corruption',
      severity: 'major',
      headline: 'X',
      startedWeek: 1,
      weeksRemaining: 12,
      approvalLost: 0,
      suppressedUSD: 0,
      active: true,
    });
    const r = tickScandals(p, 2);
    expect(r.approvalDamage).toBeGreaterThan(0);
  });

  it('tickScandals reports forced resignation on expired un-suppressed major scandal', () => {
    let p = ensurePoliticsHasNewFields(empty());
    p = addScandal(p, {
      id: 's1',
      category: 'corruption',
      severity: 'major',
      headline: 'X',
      startedWeek: 1,
      weeksRemaining: 1, // about to expire
      approvalLost: 0,
      suppressedUSD: 0,
      active: true,
    });
    const r = tickScandals(p, 2);
    expect(r.forcedResignation).toBe(true);
  });

  it('applySuppression accumulates spending on an active scandal', () => {
    let p = ensurePoliticsHasNewFields(empty());
    p = addScandal(p, {
      id: 's1',
      category: 'corruption',
      severity: 'minor',
      headline: 'X',
      startedWeek: 1,
      weeksRemaining: 4,
      approvalLost: 0,
      suppressedUSD: 0,
      active: true,
    });
    const next = applySuppression(p, 's1', 1500)!;
    expect(next.scandals![0].suppressedUSD).toBe(1500);
  });

  it('applySuppression returns null for unknown scandal', () => {
    const p = ensurePoliticsHasNewFields(empty());
    expect(applySuppression(p, 'nope', 1000)).toBeNull();
  });
});

describe('driftApproval', () => {
  it('drifts above-50 approval down toward 50', () => {
    const p = driftApproval({ ...empty(), approvalRating: 80 });
    expect(p.approvalRating).toBeLessThan(80);
    expect(p.approvalRating).toBeGreaterThanOrEqual(50);
  });

  it('drifts below-50 approval up toward 50', () => {
    const p = driftApproval({ ...empty(), approvalRating: 30 });
    expect(p.approvalRating).toBeGreaterThan(30);
    expect(p.approvalRating).toBeLessThanOrEqual(50);
  });

  it('is a no-op at exactly 50', () => {
    const p = driftApproval({ ...empty(), approvalRating: 50 });
    expect(p.approvalRating).toBe(50);
  });
});
