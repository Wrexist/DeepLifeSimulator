import {
  DIRECT_USD_PER_APPROVAL_POINT,
  INITIAL_PAC,
  PAC_EFFICIENCY_MULTIPLIER,
  PAC_USD_PER_APPROVAL_POINT,
  raiseClean,
  raiseDirty,
  spendPAC,
  totalPAC,
} from '../pac';

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

/**
 * The PAC's whole reason to exist is that it beats spending cash directly.
 *
 * It documented that advantage in two places — this module's `spendPAC`
 * docstring and `PoliticalActions.lobby` — and implemented the opposite: a
 * hard-coded `spent / 10_000` against direct spending's `amount / 5_000`, so
 * banking money into the PAC to spend it bought HALF the approval of just
 * spending it. Nothing on screen said so, which is why it survived.
 *
 * The caps were the tell: `Math.min(15, …)` for the PAC against
 * `Math.min(10, …)` for direct spend is already exactly 1.5x, so the ceiling
 * encoded the intended advantage all along and only the rate was wrong.
 *
 * These pin the RELATIONSHIP rather than either number, so tuning one without
 * the other fails here instead of silently re-opening the gap.
 */
describe('PAC efficiency against direct campaign spending', () => {
  /** Mirrors `runCampaignSpending` in contexts/game/actions/PoliticalActions.ts. */
  const directApproval = (usd: number) =>
    usd > 0 ? Math.min(10, Math.max(1, Math.round(usd / DIRECT_USD_PER_APPROVAL_POINT))) : 0;

  it('is exactly the documented 1.5x per dollar', () => {
    expect(PAC_EFFICIENCY_MULTIPLIER).toBe(1.5);
    expect(PAC_USD_PER_APPROVAL_POINT).toBeCloseTo(DIRECT_USD_PER_APPROVAL_POINT / 1.5, 6);
  });

  it('buys MORE approval than the same dollar spent directly', () => {
    // The regression this exists for: before the fix a $10k PAC spend bought
    // +1 where direct bought +2.
    for (const usd of [10_000, 20_000, 30_000]) {
      const pac = spendPAC({ ...INITIAL_PAC, cleanUSD: usd }, usd).approvalGain;
      expect(pac).toBeGreaterThan(directApproval(usd));
    }
  });

  it('the caps carry the same 1.5x, so the advantage holds at the ceiling too', () => {
    const bigSpend = 1_000_000;
    const pacCap = spendPAC({ ...INITIAL_PAC, cleanUSD: bigSpend }, bigSpend).approvalGain;
    expect(pacCap).toBe(15);
    expect(directApproval(bigSpend)).toBe(10);
    expect(pacCap / directApproval(bigSpend)).toBeCloseTo(PAC_EFFICIENCY_MULTIPLIER, 6);
  });

  it('spends no more than the PAC holds, however efficient it is', () => {
    const r = spendPAC({ ...INITIAL_PAC, cleanUSD: 5_000 }, 999_999);
    expect(r.spentUSD).toBe(5_000);
    expect(r.pac.cleanUSD).toBe(0);
  });
});
