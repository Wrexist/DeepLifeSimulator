/**
 * Hustle logic — Wave A additions.
 *
 * Covers the organic-scandal roll (brand/size-gated, cooldown, deterministic),
 * the scandal-ledger estimators (real totalRevenueLoss/finalReputationLoss),
 * the named-hire productivity factor (bounded income lift), and the shared
 * company-overlay factory used by createCompany + ensureOverlay + the v17
 * migration.
 */
import type { Company, HustleCompanyOverlay, HustleHire } from '@/contexts/game/types';
import {
  scandalSpawnChance,
  rollScandalForWeek,
  estimateScandalRevenueLoss,
  scandalReputationLoss,
  namedHirePerformanceFactor,
  createDefaultCompanyOverlay,
  generateCandidates,
  realizedCampaignROI,
  scandalRevenueDrag,
  SCANDAL_MIN_WEEKLY_INCOME,
  SCANDAL_COOLDOWN_WEEKS,
  SCANDAL_BASE_CHANCE,
  SCANDAL_MAX_CHANCE,
  SCANDAL_BASE_SEVERITY,
  SCANDAL_HEADLINES,
  CAMPAIGN_ROI_VARIANCE_MIN,
  CAMPAIGN_ROI_VARIANCE_MAX,
} from '../hustleLogic';

function company(id: string, weeklyIncome: number, type: Company['type'] = 'factory'): Company {
  return {
    id,
    name: `My ${id}`,
    type,
    weeklyIncome,
    baseWeeklyIncome: weeklyIncome,
    upgrades: [],
    employees: 0,
    workerSalary: 500,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0,
  } as Company;
}

function hire(performance: number): HustleHire {
  return {
    candidateId: `h-${performance}`,
    hiredWeek: 0,
    role: 'engineer',
    salary: 2000,
    morale: 60,
    performance,
  };
}

describe('scandalSpawnChance', () => {
  it('is roughly the base chance at neutral brand + small income', () => {
    // brand 50 → 1× brand mult; income 10k → 1.05× size mult.
    expect(scandalSpawnChance(50, 10_000)).toBeCloseTo(SCANDAL_BASE_CHANCE * 1.05, 6);
  });

  it('raises risk as brand falls (weak brand → up to 2×)', () => {
    const strong = scandalSpawnChance(50, 10_000);
    const weak = scandalSpawnChance(0, 10_000);
    expect(weak).toBeGreaterThan(strong);
    // brand 0 → 2× brand mult
    expect(weak).toBeCloseTo(SCANDAL_BASE_CHANCE * 2 * 1.05, 6);
  });

  it('never exceeds the absolute per-week ceiling', () => {
    expect(scandalSpawnChance(0, 100_000_000)).toBeLessThanOrEqual(SCANDAL_MAX_CHANCE);
  });

  it('treats non-finite inputs as neutral defaults', () => {
    expect(scandalSpawnChance(NaN, NaN)).toBeCloseTo(SCANDAL_BASE_CHANCE, 6);
  });
});

describe('rollScandalForWeek', () => {
  const overlay = createDefaultCompanyOverlay('co-56', 0);

  it('spawns a well-formed scandal for a seed under the chance threshold', () => {
    // co-56 wk3 produces a very low seeded roll (~0.005), below even the
    // neutral-brand chance (~0.026) → deterministic spawn.
    const scandal = rollScandalForWeek(company('co-56', 10_000), overlay, 3);
    expect(scandal).not.toBeNull();
    expect(scandal!.startedWeek).toBe(3);
    expect(scandal!.weeksRemaining).toBe(6);
    expect(scandal!.resolutionMethod).toBeNull();
    // severity + drag are consistent with the chosen kind's base
    expect(scandal!.severity).toBe(SCANDAL_BASE_SEVERITY[scandal!.kind]);
    expect(scandal!.revenueDragPercent).toBeCloseTo(scandalRevenueDrag(scandal!.severity), 6);
    // factory-industry scandals only
    expect(['product_defect', 'labor_abuse', 'environmental']).toContain(scandal!.kind);
    // headline drawn from that kind's pool
    expect(SCANDAL_HEADLINES[scandal!.kind]).toContain(scandal!.headline);
  });

  it('is deterministic — same company + week yields the same scandal', () => {
    const a = rollScandalForWeek(company('co-56', 10_000), overlay, 3);
    const b = rollScandalForWeek(company('co-56', 10_000), overlay, 3);
    expect(a).toEqual(b);
  });

  it('does not spawn when the seeded roll is above the chance (most weeks)', () => {
    // factory wk0 rolls ~0.29 — far above any chance.
    expect(rollScandalForWeek(company('factory', 10_000), overlay, 0)).toBeNull();
  });

  it('never spawns a second concurrent scandal', () => {
    const withActive: HustleCompanyOverlay = {
      ...overlay,
      activeScandal: {
        id: 'scn-x',
        kind: 'pr_disaster',
        severity: 45,
        startedWeek: 0,
        weeksRemaining: 6,
        headline: 'x',
        resolutionMethod: null,
        revenueDragPercent: scandalRevenueDrag(45),
      },
    };
    expect(rollScandalForWeek(company('co-56', 10_000), withActive, 3)).toBeNull();
  });

  it('size-gates: companies below the minimum weekly income never draw a scandal', () => {
    expect(
      rollScandalForWeek(company('co-56', SCANDAL_MIN_WEEKLY_INCOME - 1), overlay, 3),
    ).toBeNull();
  });

  it('respects the post-resolution cooldown', () => {
    const recentlyResolved: HustleCompanyOverlay = {
      ...overlay,
      scandalHistory: [
        {
          id: 'scn-old',
          kind: 'pr_disaster',
          severity: 45,
          survivedAtWeek: 3 - (SCANDAL_COOLDOWN_WEEKS - 1), // inside the cooldown window
          finalReputationLoss: 4,
          totalRevenueLoss: 1000,
          resolutionMethod: 'apology',
        },
      ],
    };
    expect(rollScandalForWeek(company('co-56', 10_000), recentlyResolved, 3)).toBeNull();
  });

  it('allows a new scandal once the cooldown has elapsed', () => {
    const cooledDown: HustleCompanyOverlay = {
      ...overlay,
      scandalHistory: [
        {
          id: 'scn-old',
          kind: 'pr_disaster',
          severity: 45,
          survivedAtWeek: 3 - SCANDAL_COOLDOWN_WEEKS, // exactly at the boundary → allowed
          finalReputationLoss: 4,
          totalRevenueLoss: 1000,
          resolutionMethod: 'apology',
        },
      ],
    };
    expect(rollScandalForWeek(company('co-56', 10_000), cooledDown, 3)).not.toBeNull();
  });
});

describe('estimateScandalRevenueLoss', () => {
  it('is zero when no weeks were active or income is zero', () => {
    expect(estimateScandalRevenueLoss(50, 0, 10_000)).toBe(0);
    expect(estimateScandalRevenueLoss(50, 5, 0)).toBe(0);
  });

  it('produces a positive, drag-proportional value', () => {
    const loss = estimateScandalRevenueLoss(80, 6, 10_000);
    expect(loss).toBeGreaterThan(0);
    // upper bound: can never exceed weeks × income × the 30% drag cap
    expect(loss).toBeLessThanOrEqual(6 * 10_000 * 0.3);
  });

  it('scales up with a higher initial severity', () => {
    const low = estimateScandalRevenueLoss(45, 6, 10_000);
    const high = estimateScandalRevenueLoss(80, 6, 10_000);
    expect(high).toBeGreaterThan(low);
  });
});

describe('scandalReputationLoss', () => {
  it('is always at least 1 and scales with severity', () => {
    expect(scandalReputationLoss(45)).toBeGreaterThanOrEqual(1);
    expect(scandalReputationLoss(80)).toBeGreaterThan(scandalReputationLoss(45));
  });

  it('handles non-finite severity gracefully', () => {
    expect(scandalReputationLoss(NaN)).toBe(1);
  });
});

describe('namedHirePerformanceFactor', () => {
  it('is neutral (0) for an empty or missing roster', () => {
    expect(namedHirePerformanceFactor([])).toBe(0);
    expect(namedHirePerformanceFactor(undefined)).toBe(0);
  });

  it('is 0 at neutral (50) average performance', () => {
    expect(namedHirePerformanceFactor([hire(50), hire(50)])).toBe(0);
  });

  it('lifts income for a high-performance roster, bounded at +0.08', () => {
    const f = namedHirePerformanceFactor([hire(100), hire(100)]);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThanOrEqual(0.08);
    expect(namedHirePerformanceFactor([hire(100)])).toBeCloseTo(0.08, 6);
  });

  it('drags income for a demoralized roster, bounded at -0.08', () => {
    const f = namedHirePerformanceFactor([hire(0)]);
    expect(f).toBeLessThan(0);
    expect(f).toBeGreaterThanOrEqual(-0.08);
    expect(f).toBeCloseTo(-0.08, 6);
  });

  it('averages across the roster and tolerates malformed performance', () => {
    // one valid (100), one malformed → treated as neutral 50 → avg 75
    const f = namedHirePerformanceFactor([hire(100), { ...hire(0), performance: NaN }]);
    expect(f).toBeCloseTo((75 - 50) / 625, 6);
  });
});

describe('realizedCampaignROI', () => {
  it('is deterministic per campaign id + week', () => {
    expect(realizedCampaignROI('camp-1', 3.2, 5)).toBe(realizedCampaignROI('camp-1', 3.2, 5));
  });

  it('stays within [MIN, MAX] × projected ROI', () => {
    for (let w = 0; w < 40; w++) {
      const roi = realizedCampaignROI('camp-1', 3.2, w);
      expect(roi).toBeGreaterThanOrEqual(3.2 * CAMPAIGN_ROI_VARIANCE_MIN - 1e-9);
      expect(roi).toBeLessThanOrEqual(3.2 * CAMPAIGN_ROI_VARIANCE_MAX + 1e-9);
    }
  });

  it('varies week to week (not a fixed per-id multiplier) and can dip below break-even', () => {
    const rois = Array.from({ length: 40 }, (_, w) => realizedCampaignROI('camp-1', 3.2, w + 1));
    // distinct values across weeks — real per-week variance, not clustered
    expect(new Set(rois).size).toBeGreaterThan(20);
    // at least one week realizes below the break-even ROI of 2 → a losing week
    expect(rois.some((r) => r < 2)).toBe(true);
    // at least one week realizes above break-even → a winning week (upside kept)
    expect(rois.some((r) => r > 2)).toBe(true);
  });

  it('makes even the highest-ROI kind non-guaranteed: expected net ≤ 0 over many weeks', () => {
    // net per week (spend 1) = realizedROI − 2. Averaged over a wide seed range,
    // guerrilla (projected 3.2) nets ≈ 0-or-negative — no risk-free printer.
    let netSum = 0;
    const N = 200;
    for (let w = 1; w <= N; w++) netSum += realizedCampaignROI('camp-1', 3.2, w) - 2;
    expect(netSum / N).toBeLessThanOrEqual(0);
  });

  it('guards non-finite / non-positive projected ROI', () => {
    expect(realizedCampaignROI('camp-1', NaN, 1)).toBe(0);
    expect(realizedCampaignROI('camp-1', 0, 1)).toBe(0);
  });
});

describe('generateCandidates — excludes already-hired ids', () => {
  it('never re-emits a candidate id passed in excludeIds', () => {
    const first = generateCandidates('co-1', 0, 3);
    const hiredId = first[0].id;
    const refreshed = generateCandidates('co-1', 0, 3, [hiredId]);
    // still returns the requested count, and the hired id is gone
    expect(refreshed).toHaveLength(3);
    expect(refreshed.some((c) => c.id === hiredId)).toBe(false);
    // ids remain distinct (deterministic slot advance, no collisions)
    expect(new Set(refreshed.map((c) => c.id)).size).toBe(3);
  });

  it('is a stable no-op when nothing is excluded', () => {
    expect(generateCandidates('co-1', 0, 3)).toEqual(generateCandidates('co-1', 0, 3, []));
  });
});

describe('createDefaultCompanyOverlay', () => {
  it('returns a fully-formed neutral overlay', () => {
    const o = createDefaultCompanyOverlay('factory', 7);
    expect(o.companyId).toBe('factory');
    expect(o.brand).toEqual({ score: 50, trend: 'flat', lastUpdatedWeek: 7 });
    expect(o.activeScandal).toBeNull();
    expect(o.scandalHistory).toEqual([]);
    expect(o.marketSharePercent).toBe(5);
    expect(o.ipo.status).toBe('private');
    expect(o.hiringPipeline.namedHires).toEqual([]);
    expect(o.notifications).toEqual([]);
  });
});
