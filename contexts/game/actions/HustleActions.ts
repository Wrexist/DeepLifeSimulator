/**
 * Hustle Actions — premium business overlay (v17+).
 *
 * Pattern: takes setGameState first, mutates via setGameState(prev => ...),
 * does NOT call saveGame (UI does). Time-stamped fields use weeksLived.
 *
 * Coverage: refresh candidates · hire / fire · launch / cancel campaign ·
 * resolve scandal · IPO launch · accept/decline acquisition · board votes ·
 * supplier deals · notification management.
 *
 * The existing Company[] array and CompanyActions remain canonical for
 * upgrades, employees, R&D, and weekly income. Hustle layers on top.
 */
import React from 'react';
import { GameState } from '../types';
import type {
  HustleCampaign,
  HustleCampaignKind,
  HustleCandidate,
  HustleCompanyOverlay,
  HustleScandalKind,
  HustleScandalResolution,
  HustleNotification,
  HustleActiveScandal,
} from '../types';
import { logger } from '@/utils/logger';
import { applyMoneyDelta } from './MoneyActions';
import { clampStatByKey } from '@/utils/statUtils';
import { companyIncomeMultiplier } from '../company';
import {
  generateCandidates,
  evaluateOffer,
  projectCampaignROI,
  campaignCostFloor,
  brandLiftForCampaign,
  SCANDAL_BASE_SEVERITY,
  SCANDAL_HEADLINES,
  scandalRevenueDrag,
  computeIPOSharePrice,
  createDefaultCompanyOverlay,
  estimateScandalRevenueLoss,
} from '@/lib/business/hustleLogic';

const log = logger.scope('HustleActions');

const NOTIFICATION_CAP = 80;

// ── Internal helpers ─────────────────────────────────────────────────────

// P1-14: apply a reputation delta INSIDE an atomic updater — mirrors updateStats'
// clamp + daily-summary tracking. resolveScandal / fireNamedHire / acceptAcquisition
// previously granted reputation via a trailing updateStats(...) that fired even when the
// in-updater money step bailed (`return prev`), so a same-batch funds race could grant
// free reputation on a deal/resolution that never committed. Folding it in closes that
// vector (same root cause as the P0-2 money fold already applied at each site).
function withReputationDelta(state: GameState, rep: number): GameState {
  if (!rep) return state;
  const newRep = clampStatByKey('reputation', state.stats.reputation + rep);
  const actualDelta = newRep - state.stats.reputation;
  if (!actualDelta) return state;
  return {
    ...state,
    stats: { ...state.stats, reputation: newRep },
    dailySummary: {
      ...state.dailySummary,
      moneyChange: state.dailySummary?.moneyChange ?? 0,
      statsChange: {
        ...(state.dailySummary?.statsChange ?? {}),
        reputation: (state.dailySummary?.statsChange?.reputation ?? 0) + actualDelta,
      },
      events: state.dailySummary?.events ?? [],
    },
  };
}

function ensureHustle(prev: GameState) {
  const existing = prev.hustleApp;
  if (existing) {
    // R2-G: clone lifetimeStats (the writers do `ha.lifetimeStats.totalX += 1`
    // which would mutate `prev` in place — under React 19 StrictMode the
    // updater runs twice, so counters would double. The clone keeps the
    // outer `hustleApp` reference for memo-equality, but isolates the writes.
    return {
      ...existing,
      lifetimeStats: { ...existing.lifetimeStats },
    };
  }
  return {
    companies: {} as Record<string, HustleCompanyOverlay>,
    lifetimeStats: {
      totalCompaniesFounded: 0,
      totalCompaniesSold: 0,
      totalIPOsLaunched: 0,
      totalAcquisitionsCompleted: 0,
      totalScandalsSurvived: 0,
      totalCampaignsRun: 0,
      totalNamedHires: 0,
      totalFires: 0,
      peakBrandScore: 0,
      peakMarketShare: 0,
      peakSharePrice: 0,
    },
  };
}

function ensureOverlay(
  ha: ReturnType<typeof ensureHustle>,
  companyId: string,
  weeksLived: number,
): HustleCompanyOverlay {
  // Single source of truth for the default overlay shape (shared with
  // createCompany + the v17 migration) so they never drift.
  return ha.companies[companyId] ?? createDefaultCompanyOverlay(companyId, weeksLived);
}

/**
 * Named hires ARE employees: apply a headcount delta to the canonical
 * Company record (gameState.companies) and recompute weeklyIncome with the
 * same diminishing-returns multiplier addWorker/removeWorker use. Floors at
 * 0 employees. No-op when the company is missing (defensive for stale ids).
 */
function withEmployeeDelta(state: GameState, companyId: string, delta: number): GameState {
  const companies = state.companies || [];
  const idx = companies.findIndex((c) => c && c.id === companyId);
  if (idx === -1) return state;
  const company = companies[idx];
  const employees = Math.max(0, (company.employees ?? 0) + delta);
  if (employees === company.employees) return state;
  const updated = {
    ...company,
    employees,
    weeklyIncome: Math.round(
      (company.baseWeeklyIncome ?? 0) * companyIncomeMultiplier(company.workerMultiplier ?? 1.1, employees),
    ),
  };
  const nextCompanies = [...companies];
  nextCompanies[idx] = updated;
  return {
    ...state,
    companies: nextCompanies,
    company: state.company?.id === companyId ? updated : state.company,
  };
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function pushNotif(
  overlay: HustleCompanyOverlay,
  type: HustleNotification['type'],
  text: string,
  weeksLived: number,
  extras: Partial<HustleNotification> = {},
): HustleCompanyOverlay {
  const notif: HustleNotification = {
    id: genId('hn'),
    type,
    text,
    timestamp: Date.now(),
    gameWeek: weeksLived,
    read: false,
    refCompanyId: overlay.companyId,
    ...extras,
  };
  return {
    ...overlay,
    notifications: [notif, ...overlay.notifications].slice(0, NOTIFICATION_CAP),
  };
}

function withOverlay(
  prev: GameState,
  companyId: string,
  weeksLived: number,
  // R-fix: the mutator receives the SAME `ha` clone that withOverlay persists, so
  // `ha.lifetimeStats.totalX += 1` writes land on the object we keep (previously the
  // mutator re-cloned via ensureHustle(prev), and that clone was discarded → lost write).
  mutator: (o: HustleCompanyOverlay, ha: ReturnType<typeof ensureHustle>) => HustleCompanyOverlay,
): GameState {
  const ha = ensureHustle(prev);
  const current = ensureOverlay(ha, companyId, weeksLived);
  const next = mutator(current, ha);
  return {
    ...prev,
    hustleApp: {
      ...ha,
      companies: { ...ha.companies, [companyId]: next },
    },
  };
}

// ── Hiring pipeline ──────────────────────────────────────────────────────

export const refreshCandidates = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
): void => {
  setGameState((prev) => {
    const weeksLived = prev.weeksLived ?? 0;
    return withOverlay(prev, companyId, weeksLived, (o) => ({
      ...o,
      hiringPipeline: {
        ...o.hiringPipeline,
        candidates: generateCandidates(companyId, weeksLived, 3),
      },
    }));
  });
};

export interface HireOfferResult {
  success: boolean;
  message: string;
  accepted: boolean;
  interestScore?: number;
}

/**
 * Make an offer to a candidate. Score >= 70 → guaranteed accept; 50-70
 * deterministic roll; < 50 reject. Pays sign-on bonus immediately on accept.
 */
export const hireCandidate = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  companyId: string,
  candidateId: string,
  offeredSalary: number,
  offeredBonus: number,
): HireOfferResult => {
  const overlay = gameState.hustleApp?.companies?.[companyId];
  const candidate = overlay?.hiringPipeline.candidates.find((c) => c.id === candidateId);
  if (!overlay || !candidate) return { success: false, message: 'Candidate not found', accepted: false };

  if (offeredBonus > 0 && (gameState.stats?.money ?? 0) < offeredBonus) {
    return { success: false, message: `Insufficient cash for $${offeredBonus} sign-on bonus`, accepted: false };
  }

  const reputation = gameState.stats?.reputation ?? 0;
  const score = evaluateOffer(candidate, offeredSalary, offeredBonus, reputation);

  let accepted: boolean;
  if (score >= 70) {
    accepted = true;
  } else if (score < 50) {
    accepted = false;
  } else {
    // 50-70 → deterministic roll seeded by candidate
    const seed = (candidateId + offeredSalary).split('').reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0);
    accepted = (Math.abs(seed) % 100) / 100 < (score - 50) / 20;
  }

  const weeksLived = gameState.weeksLived ?? 0;

  setGameState((prev) => {
    // Double-tap guard: if the candidate is already gone from the FRESH
    // pipeline, the offer was already processed — don't hire (or charge) twice.
    const freshCandidate = prev.hustleApp?.companies?.[companyId]?.hiringPipeline.candidates
      .some((c) => c.id === candidateId);
    if (!freshCandidate) return prev;

    let next = withOverlay(prev, companyId, weeksLived, (o, ha) => {
      if (!accepted) {
        // Remove the candidate from the pipeline regardless — they took
        // another offer (or stayed at their current job).
        return {
          ...o,
          hiringPipeline: {
            ...o.hiringPipeline,
            candidates: o.hiringPipeline.candidates.filter((c) => c.id !== candidateId),
          },
        };
      }
      // Accepted — move to namedHires and reset weeksSinceLastHire
      const newHire = {
        candidateId: candidate.id,
        hiredWeek: weeksLived,
        role: candidate.role,
        salary: offeredSalary,
        morale: Math.min(100, 60 + Math.floor(score / 5)),
        performance: candidate.skill,
      };
      ha.lifetimeStats.totalNamedHires += 1;
      return pushNotif(
        {
          ...o,
          hiringPipeline: {
            ...o.hiringPipeline,
            candidates: o.hiringPipeline.candidates.filter((c) => c.id !== candidateId),
            namedHires: [...o.hiringPipeline.namedHires, newHire],
            weeksSinceLastHire: 0,
          },
        },
        'candidate_applied',
        `${candidate.name} accepted your offer as ${candidate.role}`,
        weeksLived,
      );
    });
    // Named hires ARE employees — bump the canonical headcount (and income
    // multiplier) in the SAME state update so counts can never drift.
    if (accepted) {
      next = withEmployeeDelta(next, companyId, +1);
    }
    // P0-2: charge the sign-on bonus IN THE SAME updater so a double-tap / low-cash
    // race can't grant the hire while a separate `updateMoney` charge is rejected.
    if (accepted && offeredBonus > 0) {
      const spend = applyMoneyDelta(next, -offeredBonus, `Hustle sign-on bonus: ${candidate.name}`);
      if (!spend) return prev; // unaffordable → abort the hire entirely (no free hire)
      return { ...next, ...spend };
    }
    return next;
  });

  log.info(`Offer to ${candidate.name}: score=${score}, accepted=${accepted}`);
  return {
    success: true,
    message: accepted
      ? `${candidate.name} accepted!`
      : `${candidate.name} declined — they wanted $${candidate.salaryAsk}/week`,
    accepted,
    interestScore: score,
  };
};

export const fireNamedHire = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  companyId: string,
  candidateId: string,
): { success: boolean; message: string; severance: number } => {
  const overlay = gameState.hustleApp?.companies?.[companyId];
  const hire = overlay?.hiringPipeline.namedHires.find((h) => h.candidateId === candidateId);
  if (!overlay || !hire) return { success: false, message: 'Hire not found', severance: 0 };

  const severance = Math.floor(hire.salary * 4); // 4 weeks severance
  if ((gameState.stats?.money ?? 0) < severance) {
    return { success: false, message: `Need $${severance.toLocaleString()} to cover severance`, severance: 0 };
  }
  const weeksLived = gameState.weeksLived ?? 0;

  setGameState((prev) => {
    // Double-tap guard: if the hire is already gone from FRESH state, the fire
    // already happened — don't pay severance or decrement headcount twice.
    const freshHire = prev.hustleApp?.companies?.[companyId]?.hiringPipeline.namedHires
      .some((h) => h.candidateId === candidateId);
    if (!freshHire) return prev;

    let next = withOverlay(prev, companyId, weeksLived, (o, ha) => {
      ha.lifetimeStats.totalFires += 1;
      return pushNotif(
        {
          ...o,
          hiringPipeline: {
            ...o.hiringPipeline,
            namedHires: o.hiringPipeline.namedHires.filter((h) => h.candidateId !== candidateId),
            totalSeverance: o.hiringPipeline.totalSeverance + severance,
          },
        },
        'system',
        `Fired employee. Severance paid: $${severance.toLocaleString()}`,
        weeksLived,
      );
    });
    // Named hires ARE employees — decrement the canonical headcount (floor 0)
    // in the SAME state update.
    next = withEmployeeDelta(next, companyId, -1);
    // P0-2: pay severance IN THE SAME updater (atomic — closes the fire-without-paying race).
    const spend = applyMoneyDelta(next, -severance, `Hustle severance payout`);
    if (!spend) return prev; // can't cover severance → don't fire
    // P1-14: -1 reputation hit folded into the SAME updater (was a trailing updateStats
    // that docked reputation even when the severance bailed and the fire didn't happen).
    return withReputationDelta({ ...next, ...spend }, -1);
  });

  return { success: true, message: `Fired. Severance: $${severance.toLocaleString()}`, severance };
};

// ── Campaigns ────────────────────────────────────────────────────────────

export const launchCampaign = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  companyId: string,
  kind: HustleCampaignKind,
  spendPerWeek: number,
  durationWeeks: number,
): { success: boolean; message: string; projectedROI?: number } => {
  const floor = campaignCostFloor(kind);
  if (spendPerWeek < floor) {
    return { success: false, message: `Min spend for ${kind} campaign is $${floor.toLocaleString()}/week` };
  }
  const company = gameState.companies?.find((c) => c.id === companyId);
  if (!company) return { success: false, message: 'Company not found' };

  const upfront = spendPerWeek;
  if ((gameState.stats?.money ?? 0) < upfront) {
    return { success: false, message: 'Insufficient cash for first week of spend' };
  }

  const weeksLived = gameState.weeksLived ?? 0;
  const projectedROI = projectCampaignROI(kind, spendPerWeek, company.weeklyIncome ?? 0);

  setGameState((prev) => {
    const next = withOverlay(prev, companyId, weeksLived, (o, ha) => {
      ha.lifetimeStats.totalCampaignsRun += 1;
      const campaign: HustleCampaign = {
        id: genId('camp'),
        kind,
        spendPerWeek,
        startedWeek: weeksLived,
        durationWeeks,
        projectedROI,
        active: true,
      };
      const brandLift = brandLiftForCampaign(kind);
      return pushNotif(
        {
          ...o,
          activeCampaigns: [...o.activeCampaigns, campaign],
          brand: {
            score: Math.min(100, o.brand.score + brandLift),
            trend: 'rising',
            lastUpdatedWeek: weeksLived,
          },
        },
        'campaign_complete',
        `${kind} campaign launched: $${spendPerWeek}/wk for ${durationWeeks} weeks`,
        weeksLived,
      );
    });
    // P0-2: charge the first-week spend IN THE SAME updater (atomic — no free campaign).
    const spend = applyMoneyDelta(next, -upfront, `${kind} campaign first-week spend`);
    if (!spend) return prev; // unaffordable → don't launch
    return { ...next, ...spend };
  });

  return { success: true, message: 'Campaign launched', projectedROI };
};

export const cancelCampaign = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
  campaignId: string,
): void => {
  setGameState((prev) => {
    const weeksLived = prev.weeksLived ?? 0;
    return withOverlay(prev, companyId, weeksLived, (o) => ({
      ...o,
      activeCampaigns: o.activeCampaigns.filter((c) => c.id !== campaignId),
    }));
  });
};

// ── Scandals ─────────────────────────────────────────────────────────────

export const triggerScandal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
  kind: HustleScandalKind,
): void => {
  setGameState((prev) => {
    const weeksLived = prev.weeksLived ?? 0;
    return withOverlay(prev, companyId, weeksLived, (o) => {
      if (o.activeScandal) return o; // one at a time
      const severity = SCANDAL_BASE_SEVERITY[kind];
      const headlines = SCANDAL_HEADLINES[kind];
      const headline = headlines[Math.floor(Math.random() * headlines.length)];
      const scandal: HustleActiveScandal = {
        id: genId('scn'),
        kind,
        severity,
        startedWeek: weeksLived,
        weeksRemaining: 6,
        headline,
        revenueDragPercent: scandalRevenueDrag(severity),
      };
      return pushNotif(
        {
          ...o,
          activeScandal: scandal,
          brand: {
            score: Math.max(0, o.brand.score - 15),
            trend: 'declining',
            lastUpdatedWeek: weeksLived,
          },
        },
        'scandal_alert',
        `⚠ ${headline}`,
        weeksLived,
        { refId: scandal.id },
      );
    });
  });
};

export interface ScandalRecoveryResult {
  success: boolean;
  message: string;
  reputationDelta: number;
  costPaid: number;
}

export const resolveScandal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  companyId: string,
  method: HustleScandalResolution,
): ScandalRecoveryResult => {
  const overlay = gameState.hustleApp?.companies?.[companyId];
  const scandal = overlay?.activeScandal;
  if (!overlay || !scandal) {
    return { success: false, message: 'No active scandal', reputationDelta: 0, costPaid: 0 };
  }

  const COSTS_AND_EFFECTS: Record<HustleScandalResolution, { cost: number; rep: number; severityDrop: number; msg: string }> = {
    apology:    { cost: 0,      rep: 2,  severityDrop: 25, msg: 'You issued a public apology. Severity drops faster.' },
    recall:     { cost: 50_000, rep: 4,  severityDrop: 40, msg: 'Product recall executed. Customers appreciated the honesty.' },
    lawsuit:    { cost: 100_000, rep: -3, severityDrop: 50, msg: 'Legal team aggressively defended. Scandal contained but rep took a hit.' },
    cover_up:   { cost: 25_000, rep: -1, severityDrop: 30, msg: 'You quietly buried the story. 30% chance of resurge.' },
    restructure: { cost: 200_000, rep: 8, severityDrop: 70, msg: 'Leadership reshuffle + new policies. Strongest path back.' },
  };
  const { cost, rep, severityDrop, msg } = COSTS_AND_EFFECTS[method];

  if (cost > 0 && (gameState.stats?.money ?? 0) < cost) {
    return { success: false, message: `Need $${cost.toLocaleString()} for ${method}`, reputationDelta: 0, costPaid: 0 };
  }

  const weeksLived = gameState.weeksLived ?? 0;

  setGameState((prev) => {
    const next = withOverlay(prev, companyId, weeksLived, (o, ha) => {
      if (!o.activeScandal) return o;
      const newSeverity = Math.max(0, o.activeScandal.severity - severityDrop);

      if (newSeverity <= 0) {
        ha.lifetimeStats.totalScandalsSurvived += 1;
        // Real ledger value (was hardcoded 0): reconstruct the drag over the
        // scandal's active life from its initial (base) severity, weeks active,
        // and current company income.
        const initialSeverity = SCANDAL_BASE_SEVERITY[o.activeScandal.kind] ?? o.activeScandal.severity;
        const weeksActive = Math.max(1, weeksLived - o.activeScandal.startedWeek);
        const companyIncome = prev.companies?.find((c) => c.id === companyId)?.weeklyIncome ?? 0;
        const totalRevenueLoss = estimateScandalRevenueLoss(initialSeverity, weeksActive, companyIncome);
        return pushNotif(
          {
            ...o,
            activeScandal: null,
            scandalHistory: [
              ...o.scandalHistory,
              {
                id: o.activeScandal.id,
                kind: o.activeScandal.kind,
                severity: o.activeScandal.severity,
                survivedAtWeek: weeksLived,
                finalReputationLoss: rep < 0 ? -rep : 0,
                totalRevenueLoss,
                resolutionMethod: method,
              },
            ],
            brand: {
              score: Math.min(100, o.brand.score + 5),
              trend: 'rising',
              lastUpdatedWeek: weeksLived,
            },
          },
          'scandal_alert',
          'Scandal resolved.',
          weeksLived,
        );
      }
      // Partial recovery
      return {
        ...o,
        activeScandal: { ...o.activeScandal, severity: newSeverity, resolutionMethod: method },
      };
    });
    // P0-2: pay the resolution cost IN THE SAME updater (atomic — no free resolution).
    // P1-14: fold the reputation delta in too, so a money-bail can't grant free
    // reputation on a scandal that never resolved.
    let resolved: GameState;
    if (cost > 0) {
      const spend = applyMoneyDelta(next, -cost, `Hustle scandal ${method}`);
      if (!spend) return prev; // unaffordable → don't resolve (and don't grant rep)
      resolved = { ...next, ...spend };
    } else {
      resolved = next;
    }
    return withReputationDelta(resolved, rep);
  });

  return { success: true, message: msg, reputationDelta: rep, costPaid: cost };
};

// ── IPO ──────────────────────────────────────────────────────────────────

export interface IPOResult {
  success: boolean;
  message: string;
  cashRaised: number;
  ownershipKept: number;
  sharePrice: number;
}

export const launchIPO = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  companyId: string,
  /** How much of the company to sell as float (10-40%). */
  floatPercent: number = 25,
): IPOResult => {
  const company = gameState.companies?.find((c) => c.id === companyId);
  const overlay = gameState.hustleApp?.companies?.[companyId];
  if (!company || !overlay) {
    return { success: false, message: 'Company not found', cashRaised: 0, ownershipKept: 0, sharePrice: 0 };
  }
  if (overlay.ipo.status === 'public') {
    return { success: false, message: 'Already public', cashRaised: 0, ownershipKept: overlay.ipo.ownershipPercent, sharePrice: overlay.ipo.sharePrice };
  }
  if ((company.weeklyIncome ?? 0) < 10_000) {
    return { success: false, message: 'Need at least $10K/week revenue to IPO', cashRaised: 0, ownershipKept: 100, sharePrice: 0 };
  }
  if (overlay.activeScandal) {
    return { success: false, message: 'Cannot IPO during an active scandal', cashRaised: 0, ownershipKept: 100, sharePrice: 0 };
  }

  const sharesK = 100;
  const sharePrice = computeIPOSharePrice(company, overlay, sharesK);
  const sharesSold = Math.floor(sharesK * 1000 * (floatPercent / 100));
  const cashRaised = Math.floor(sharesSold * sharePrice);
  const ownershipKept = 100 - floatPercent;
  const weeksLived = gameState.weeksLived ?? 0;

  setGameState((prev) => {
    // P1-7: re-check status against FRESH prev (the outer guard reads stale gameState,
    // so a double-tap could pass twice). Bail atomically if already public.
    const freshOverlay = prev.hustleApp?.companies?.[companyId];
    if (freshOverlay?.ipo.status === 'public') return prev;

    const next = withOverlay(prev, companyId, weeksLived, (o, ha) => {
      ha.lifetimeStats.totalIPOsLaunched += 1;
      ha.lifetimeStats.peakSharePrice = Math.max(ha.lifetimeStats.peakSharePrice, sharePrice);
      return pushNotif(
        {
          ...o,
          ipo: {
            status: 'public',
            listedWeek: weeksLived,
            ownershipPercent: ownershipKept,
            sharePrice,
            sharesOutstandingK: sharesK,
            lastEarningsWeek: weeksLived,
            recentEarnings: [],
          },
        },
        'ipo_milestone',
        `🎉 IPO complete! Raised $${cashRaised.toLocaleString()} at $${sharePrice}/share`,
        weeksLived,
      );
    });
    // P1-7: credit cashRaised + reputation IN THE SAME updater (was a trailing
    // updateMoney/updateStats → a double-tap double-credited the float proceeds).
    const credit = applyMoneyDelta(next, cashRaised, `IPO float (${floatPercent}%) of ${company.name}`);
    if (!credit) return next;
    return withReputationDelta({ ...next, ...credit }, 8);
  });

  log.info(`IPO ${company.name}: raised $${cashRaised} at $${sharePrice}`);

  return { success: true, message: 'IPO successful', cashRaised, ownershipKept, sharePrice };
};

// ── Acquisitions ─────────────────────────────────────────────────────────

export const acceptAcquisition = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  companyId: string,
  offerId: string,
): { success: boolean; message: string } => {
  const overlay = gameState.hustleApp?.companies?.[companyId];
  const offer = overlay?.pendingAcquisitions.find((a) => a.id === offerId);
  if (!overlay || !offer) return { success: false, message: 'Offer not found' };

  if ((gameState.stats?.money ?? 0) < offer.askingPrice) {
    return { success: false, message: `Need $${offer.askingPrice.toLocaleString()} to close` };
  }

  const weeksLived = gameState.weeksLived ?? 0;

  setGameState((prev) => {
    const next = withOverlay(prev, companyId, weeksLived, (o, ha) => {
      ha.lifetimeStats.totalAcquisitionsCompleted += 1;
      return pushNotif(
        {
          ...o,
          pendingAcquisitions: o.pendingAcquisitions.filter((a) => a.id !== offerId),
          // Synergy bonus: +X% to weekly market share; tick will recompute earnings
          marketSharePercent: Math.min(85, o.marketSharePercent + offer.synergyBonusPercent / 4),
        },
        'acquisition_offer',
        `Acquired ${offer.targetName} for $${offer.askingPrice.toLocaleString()}`,
        weeksLived,
      );
    });
    // P0-2: pay the acquisition price IN THE SAME updater (atomic — no free acquisition).
    const spend = applyMoneyDelta(next, -offer.askingPrice, `Acquisition: ${offer.targetName}`);
    if (!spend) return prev; // unaffordable → don't close the deal
    // P1-14: +3 reputation folded into the SAME updater (was a trailing updateStats
    // that granted reputation even when the price bailed and the deal didn't close).
    return withReputationDelta({ ...next, ...spend }, 3);
  });

  return { success: true, message: `Closed: ${offer.targetName} is now part of your empire` };
};

export const declineAcquisition = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
  offerId: string,
): void => {
  setGameState((prev) => {
    const weeksLived = prev.weeksLived ?? 0;
    return withOverlay(prev, companyId, weeksLived, (o) => ({
      ...o,
      pendingAcquisitions: o.pendingAcquisitions.filter((a) => a.id !== offerId),
    }));
  });
};

// ── Notifications ────────────────────────────────────────────────────────

export const markHustleNotificationRead = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
  notificationId: string,
): void => {
  setGameState((prev) => {
    const weeksLived = prev.weeksLived ?? 0;
    return withOverlay(prev, companyId, weeksLived, (o) => ({
      ...o,
      notifications: o.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    }));
  });
};

export const clearHustleNotifications = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
): void => {
  setGameState((prev) => {
    const weeksLived = prev.weeksLived ?? 0;
    return withOverlay(prev, companyId, weeksLived, (o) => ({
      ...o,
      notifications: [],
    }));
  });
};
