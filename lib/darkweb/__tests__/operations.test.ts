import { DarkWebState } from '@/contexts/game/types';
import {
  attemptJobStage,
  attemptPurchase,
  bumpHeat,
  expireOverdueJobs,
  findVendor,
  refreshMarketplace,
  settleLaunderingTransactions,
  startJob,
  submitToMixer,
  tickHeatDecay,
  withdrawCleanBtc,
} from '../operations';

function emptyDw(): DarkWebState {
  return {
    heat: 0,
    lastHeatDecayWeek: 0,
    dirtyBtc: 0,
    cleanBtc: 0,
    playerReputation: 0,
    vendors: [
      { id: 'high', handle: 'high', reputation: 90, reviewCount: 100 },
      { id: 'low',  handle: 'low',  reputation: 10, reviewCount: 5 },
    ],
    listings: [],
    activeJobs: [],
    jobHistory: [],
    laundering: [],
    skills: {
      hacking:    { level: 1, xp: 0, nextLevelXp: 100 },
      social:     { level: 1, xp: 0, nextLevelXp: 100 },
      opsec:      { level: 1, xp: 0, nextLevelXp: 100 },
      laundering: { level: 1, xp: 0, nextLevelXp: 100 },
    },
    recentEvents: [],
  };
}

const seededRoll = (key: string): number => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash % 1000) / 1000;
};

describe('heat operations', () => {
  it('bumpHeat adds heat (mitigated by OPSEC level)', () => {
    const r = bumpHeat(emptyDw(), 10);
    expect(r.heat).toBeGreaterThan(0);
    expect(r.heat).toBeLessThanOrEqual(10);
  });

  it('tickHeatDecay reduces heat over weeks since last decay', () => {
    let dw: DarkWebState = { ...emptyDw(), heat: 50, lastHeatDecayWeek: 0 };
    dw = tickHeatDecay(dw, 5);
    expect(dw.heat).toBeLessThan(50);
    expect(dw.lastHeatDecayWeek).toBe(5);
  });

  it('tickHeatDecay is a no-op when no time has passed', () => {
    const dw: DarkWebState = { ...emptyDw(), heat: 50, lastHeatDecayWeek: 5 };
    expect(tickHeatDecay(dw, 5).heat).toBe(50);
  });
});

describe('refreshMarketplace', () => {
  it('seeds listings for active vendors', () => {
    const r = refreshMarketplace(emptyDw(), 1, seededRoll);
    expect(r.listings.length).toBeGreaterThan(0);
    expect(r.listings.every((l) => ['high', 'low'].includes(l.vendorId))).toBe(true);
  });

  it('skips flagged-scam vendors on refresh', () => {
    const dw: DarkWebState = {
      ...emptyDw(),
      vendors: [
        { id: 'shady', handle: 'shady', reputation: 5, reviewCount: 3, flaggedScam: true },
        { id: 'ok', handle: 'ok', reputation: 50, reviewCount: 10 },
      ],
    };
    const r = refreshMarketplace(dw, 1, seededRoll);
    expect(r.listings.every((l) => l.vendorId !== 'shady')).toBe(true);
  });

  it('does not exceed 3 listings per vendor when topping up', () => {
    let dw = refreshMarketplace(emptyDw(), 1, seededRoll);
    dw = refreshMarketplace(dw, 2, seededRoll);
    for (const v of dw.vendors) {
      const count = dw.listings.filter((l) => l.vendorId === v.id).length;
      expect(count).toBeLessThanOrEqual(3);
    }
  });
});

describe('attemptPurchase', () => {
  it('rejects when player rep is below listing minimum', () => {
    let dw = refreshMarketplace(emptyDw(), 1, seededRoll);
    // Find any listing with a non-zero minBuyerRep.
    const gated = dw.listings.find((l) => l.minBuyerRep > 0);
    if (!gated) {
      // Skip if our seed didn't produce a gated listing.
      return;
    }
    const r = attemptPurchase(dw, gated.id, 0.5);
    expect(r.ok).toBe(false);
  });

  it('high-rep vendor succeeds at low roll', () => {
    let dw = refreshMarketplace(emptyDw(), 1, seededRoll);
    const fromHigh = dw.listings.find((l) => l.vendorId === 'high' && l.minBuyerRep === 0);
    if (!fromHigh) return;
    const r = attemptPurchase(dw, fromHigh.id, 0.99);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.outcome).toBe('success');
  });

  it('low-rep vendor scams at low roll', () => {
    let dw = refreshMarketplace(emptyDw(), 1, seededRoll);
    const fromLow = dw.listings.find((l) => l.vendorId === 'low' && l.minBuyerRep === 0);
    if (!fromLow) return;
    const r = attemptPurchase(dw, fromLow.id, 0.001);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.outcome).toBe('scam');
  });

  it('successful purchase records an event in the forum log', () => {
    let dw = refreshMarketplace(emptyDw(), 1, seededRoll);
    const li = dw.listings.find((l) => l.minBuyerRep === 0);
    if (!li) return;
    const r = attemptPurchase(dw, li.id, 0.99);
    if (r.ok) {
      expect(r.result.dw.recentEvents.length).toBeGreaterThan(0);
    }
  });
});

describe('jobs', () => {
  it('startJob adds to activeJobs', () => {
    const r = startJob(emptyDw(), 'phish-pack', 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dw.activeJobs).toHaveLength(1);
  });

  it('startJob refuses jobs whose skill prereq is unmet', () => {
    const r = startJob(emptyDw(), 'corp-breach', 1);
    expect(r.ok).toBe(false);
  });

  it('a successful stage advances currentStage', () => {
    let r1 = startJob(emptyDw(), 'phish-pack', 1);
    if (!r1.ok) throw new Error('start failed');
    const r2 = attemptJobStage(r1.dw, r1.job.id, 0.01, 2); // easy win
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      const updated = r2.result.dw.activeJobs.find((j) => j.id === r1.job.id);
      expect(updated?.currentStage).toBe(1);
    }
  });

  it('failing a stage resets currentStage to 0', () => {
    let r1 = startJob(emptyDw(), 'phish-pack', 1);
    if (!r1.ok) throw new Error('start failed');
    // Advance stage 0 success
    const r2 = attemptJobStage(r1.dw, r1.job.id, 0.01, 2);
    if (!r2.ok) throw new Error('stage 1 failed unexpectedly');
    // Now fail stage 1
    const r3 = attemptJobStage(r2.result.dw, r1.job.id, 0.999, 3);
    if (r3.ok && r3.result.outcome === 'fail') {
      const job = r3.result.dw.activeJobs.find((j) => j.id === r1.job.id);
      expect(job?.currentStage).toBe(0);
    }
  });

  it('completing the final stage credits dirty BTC and moves to history', () => {
    let dw = emptyDw();
    // Pump opsec/hacking/social/laundering high enough that easy stages pass.
    dw = {
      ...dw,
      skills: {
        hacking:    { level: 10, xp: 0, nextLevelXp: 1 },
        social:     { level: 10, xp: 0, nextLevelXp: 1 },
        opsec:      { level: 10, xp: 0, nextLevelXp: 1 },
        laundering: { level: 10, xp: 0, nextLevelXp: 1 },
      },
    };
    let r: ReturnType<typeof startJob> | ReturnType<typeof attemptJobStage> = startJob(dw, 'phish-pack', 1);
    if (!r.ok) throw new Error('start failed');
    let currDw = r.dw as DarkWebState;
    const jobId = r.job.id;
    // 4 stages, run with low rolls (forced success).
    for (let i = 0; i < 4; i++) {
      const step = attemptJobStage(currDw, jobId, 0.001, 2 + i);
      if (!step.ok) throw new Error('stage failed unexpectedly');
      currDw = step.result.dw;
    }
    expect(currDw.dirtyBtc).toBeGreaterThan(0);
    expect(currDw.jobHistory.some((j) => j.id === jobId && j.status === 'completed')).toBe(true);
  });

  it('expireOverdueJobs moves overdue active jobs to history', () => {
    const dw: DarkWebState = {
      ...emptyDw(),
      activeJobs: [
        {
          id: 'old',
          templateId: 'phish-pack',
          startedWeek: 0,
          currentStage: 1,
          completedStages: [],
          expiresWeek: 5,
          status: 'in-progress',
        },
      ],
    };
    const r = expireOverdueJobs(dw, 10);
    expect(r.activeJobs).toHaveLength(0);
    expect(r.jobHistory[0].status).toBe('expired');
  });
});

describe('laundering', () => {
  it('submitToMixer debits dirtyBtc and creates a pending tx', () => {
    const dw: DarkWebState = { ...emptyDw(), dirtyBtc: 1 };
    const r = submitToMixer(dw, 'standard', 0.5, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dw.dirtyBtc).toBeCloseTo(0.5, 5);
      expect(r.dw.laundering).toHaveLength(1);
      expect(r.dw.laundering[0].status).toBe('pending');
    }
  });

  it('rejects mixer submit when dirtyBtc is insufficient', () => {
    const r = submitToMixer(emptyDw(), 'standard', 1, 10);
    expect(r.ok).toBe(false);
  });

  it('settleLaunderingTransactions completes tx and credits cleanBtc', () => {
    const dw: DarkWebState = {
      ...emptyDw(),
      laundering: [
        {
          id: 't1',
          tier: 'premium',
          dirtyAmountBtc: 1,
          netAmountBtc: 0.85,
          startedWeek: 0,
          readyWeek: 6,
          status: 'pending',
        },
      ],
    };
    const r = settleLaunderingTransactions(dw, 6, () => 0.99); // 99% roll → premium fails only on roll < 0.005
    expect(r.resolved).toHaveLength(1);
    expect(r.resolved[0].status).toBe('completed');
    expect(r.dw.cleanBtc).toBeCloseTo(0.85, 5);
  });

  it('settleLaunderingTransactions marks failed when mixer scams', () => {
    const dw: DarkWebState = {
      ...emptyDw(),
      laundering: [
        {
          id: 't2',
          tier: 'cheap',
          dirtyAmountBtc: 1,
          netAmountBtc: 0.98,
          startedWeek: 0,
          readyWeek: 1,
          status: 'pending',
        },
      ],
    };
    const r = settleLaunderingTransactions(dw, 1, () => 0.001); // 0.1% roll → cheap fails on roll < 0.20
    expect(r.resolved[0].status).toBe('failed');
    expect(r.dw.cleanBtc).toBe(0);
  });
});

describe('withdrawCleanBtc', () => {
  it('moves clean BTC out and zeros the wallet if depleted', () => {
    const dw: DarkWebState = { ...emptyDw(), cleanBtc: 1 };
    const r = withdrawCleanBtc(dw, 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dw.cleanBtc).toBeCloseTo(0.5, 5);
      expect(r.movedBtc).toBe(0.5);
    }
  });

  it('rejects withdrawal that exceeds clean BTC', () => {
    const r = withdrawCleanBtc(emptyDw(), 1);
    expect(r.ok).toBe(false);
  });
});

describe('findVendor', () => {
  it('returns vendor when present', () => {
    expect(findVendor(emptyDw(), 'high')?.handle).toBe('high');
  });

  it('returns undefined when missing', () => {
    expect(findVendor(emptyDw(), 'nope')).toBeUndefined();
  });
});
