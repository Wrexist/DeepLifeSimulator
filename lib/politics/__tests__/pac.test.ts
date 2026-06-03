import { INITIAL_PAC, raiseClean, raiseDirty, spendPAC, totalPAC } from '../pac';

describe('PAC raises', () => {
  it('clean raise adds to cleanUSD only', () => {
    const r = raiseClean(INITIAL_PAC, 5_000, 1);
    expect(r.cleanUSD).toBe(5_000);
    expect(r.dirtyUSD).toBe(0);
    expect(r.lifetimeDirtyUSD).toBe(0);
    expect(r.lastRaiseWeek).toBe(1);
  });

  it('dirty raise adds to dirtyUSD and lifetimeDirtyUSD', () => {
    const r = raiseDirty(INITIAL_PAC, 0.5, 50_000, 2);
    expect(r.usdConverted).toBe(25_000);
    expect(r.pac.dirtyUSD).toBe(25_000);
    expect(r.pac.lifetimeDirtyUSD).toBe(25_000);
    expect(r.pac.cleanUSD).toBe(0);
  });

  it('dirty raises accumulate lifetime amount even after spending', () => {
    let pac = raiseDirty(INITIAL_PAC, 1, 100_000, 1).pac;
    const sp = spendPAC(pac, 50_000);
    pac = sp.pac;
    expect(pac.dirtyUSD).toBeLessThan(100_000);
    expect(pac.lifetimeDirtyUSD).toBe(100_000);
  });

  it('rejects negative amounts', () => {
    expect(raiseClean(INITIAL_PAC, -100, 1).cleanUSD).toBe(0);
    expect(raiseDirty(INITIAL_PAC, -1, 50_000, 1).pac.dirtyUSD).toBe(0);
  });
});

describe('spendPAC', () => {
  it('pulls from clean first, then dirty', () => {
    const pac = { cleanUSD: 1000, dirtyUSD: 5000, lifetimeDirtyUSD: 5000 };
    const r = spendPAC(pac, 3000);
    expect(r.spentUSD).toBe(3000);
    expect(r.spentFromDirty).toBe(2000);
    expect(r.pac.cleanUSD).toBe(0);
    expect(r.pac.dirtyUSD).toBe(3000);
  });

  it('caps spend at total pool', () => {
    const pac = { cleanUSD: 100, dirtyUSD: 200, lifetimeDirtyUSD: 200 };
    const r = spendPAC(pac, 10_000);
    expect(r.spentUSD).toBe(300);
  });

  it('produces approval gain', () => {
    const r = spendPAC({ cleanUSD: 100_000, dirtyUSD: 0, lifetimeDirtyUSD: 0 }, 100_000);
    expect(r.approvalGain).toBeGreaterThan(0);
  });

  it('approval gain capped at 15', () => {
    const r = spendPAC({ cleanUSD: 10_000_000, dirtyUSD: 0, lifetimeDirtyUSD: 0 }, 10_000_000);
    expect(r.approvalGain).toBeLessThanOrEqual(15);
  });

  it('returns no spend on empty pool', () => {
    const r = spendPAC(INITIAL_PAC, 1000);
    expect(r.spentUSD).toBe(0);
    expect(r.approvalGain).toBe(0);
  });
});

describe('totalPAC', () => {
  it('sums both buckets', () => {
    expect(totalPAC({ cleanUSD: 100, dirtyUSD: 200, lifetimeDirtyUSD: 200 })).toBe(300);
  });
});
