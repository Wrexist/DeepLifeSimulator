/**
 * Pure transformers for the scandals + PAC slice of PoliticsState.
 *
 * Same pattern as lib/{banking,crypto,darkweb,realEstate}/operations.ts:
 * each function takes the current state (or a subset) and returns a new state
 * plus optional side-effect data the React-aware action layer applies.
 */

import {
  PACPoolState,
  PoliticalScandalEntry,
  PoliticsState,
} from '@/contexts/game/types';
import {
  createScandal,
  PoliticalScandal,
  SEVERITY_PARAMS,
  scandalProbability,
  suppressScandal,
  tickScandal,
} from './scandals';
import { INITIAL_PAC, raiseClean, raiseDirty, spendPAC, totalPAC } from './pac';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const SCANDAL_CAP = 30;

// ---------------------------------------------------------------------------
// Initialization helpers
// ---------------------------------------------------------------------------

export function ensurePoliticsHasNewFields(politics: PoliticsState): PoliticsState {
  if (politics.scandals && politics.pac) return politics;
  return {
    ...politics,
    scandals: politics.scandals ?? [],
    pac: politics.pac ?? INITIAL_PAC,
  };
}

// ---------------------------------------------------------------------------
// Scandal management
// ---------------------------------------------------------------------------

export function addScandal(politics: PoliticsState, scandal: PoliticalScandalEntry): PoliticsState {
  const list = (politics.scandals ?? []).slice();
  list.unshift(scandal);
  return {
    ...politics,
    scandals: list.slice(0, SCANDAL_CAP),
  };
}

/**
 * Settle everything that belongs to the OFFICE when the player leaves it —
 * whether by losing re-election, a scandal resignation, or any future exit.
 *
 * PLAYER REPORT (BBQ, 2026-08-21): "Scandals still appear even when you're a
 * citizen. (Lost office)" / "Lobbyist stay active."
 *
 * Both were the same hole: nothing cleaned up on exit. The weekly tick
 * early-returns for citizens (`careerLevel === 0`), so a scandal frozen
 * mid-news-cycle stayed `active: true` forever and the Politics app kept
 * listing it under Active; hired lobbyists kept their retainer, their contact
 * card in the Contacts app (the aggregator skips only INACTIVE lobbyists), and
 * their policy-influence contribution indefinitely.
 *
 * - Scandals resolve as 'survived' — they leave the news cycle when the office,
 *   and the microscope that comes with it, goes away. They stay in history.
 * - Lobbyists are deactivated, not deleted (history + analytics keep their
 *   records), and their influence contribution is stripped from
 *   `policyInfluence` the same way `fireLobbyist` strips one.
 */
export function applyOfficeExit(politics: PoliticsState): PoliticsState {
  const scandals = (politics.scandals ?? []).map((s) =>
    s.active ? { ...s, active: false, resolution: 'survived' as const } : s,
  );
  let strippedInfluence = 0;
  const lobbyists = (politics.lobbyists ?? []).map((l) => {
    if (!l || !l.active) return l;
    strippedInfluence += safe(l.influence, 0);
    return { ...l, active: false };
  });
  return {
    ...politics,
    scandals,
    lobbyists,
    policyInfluence: Math.max(0, Math.min(100, safe(politics.policyInfluence, 0) - strippedInfluence)),
  };
}

/**
 * Process all active scandals: drain approval each week, decay their lifetime,
 * mark them resolved when expired. Returns updated politics + total approval
 * damage so the caller applies it to politics.approvalRating.
 */
export function tickScandals(politics: PoliticsState, currentWeek: number): {
  politics: PoliticsState;
  approvalDamage: number;
  notifications: { id: string; title: string; message: string }[];
  forcedResignation: boolean;
} {
  if (!politics.scandals || politics.scandals.length === 0) {
    return { politics, approvalDamage: 0, notifications: [], forcedResignation: false };
  }
  let totalDamage = 0;
  let forcedResignation = false;
  const notifications: { id: string; title: string; message: string }[] = [];
  const updated: PoliticalScandalEntry[] = politics.scandals.map((s) => {
    // Guard the entry itself, matching the sibling reads (weeklyTick's
    // `filter(s => s && s.active)` and applyOfficeExit). A null/corrupt entry
    // is only reachable via a hand-corrupted save, but an unguarded `s.active`
    // would throw and abort the whole politics tick for that week (scandal
    // processing AND the later party-funding/embezzlement bookkeeping).
    if (!s || !s.active) return s;
    const tick = tickScandal(s as unknown as PoliticalScandal);
    totalDamage += tick.approvalDamage;
    const out = tick.scandal as unknown as PoliticalScandalEntry;
    if (!out.active && out.resolution) {
      if (out.resolution === 'forced-resignation') {
        forcedResignation = true;
        notifications.push({
          id: `scandal-resign-${out.id}`,
          title: '⚖️ Forced Resignation',
          message: `Scandal "${out.headline}" cost you your office.`,
        });
      } else if (out.resolution === 'image-restored') {
        notifications.push({
          id: `scandal-cleared-${out.id}`,
          title: '✨ Scandal Cleared',
          message: `Suppression worked. "${out.headline}" is yesterday's news.`,
        });
      } else {
        notifications.push({
          id: `scandal-faded-${out.id}`,
          title: '📰 Scandal Faded',
          message: `"${out.headline}" has left the news cycle.`,
        });
      }
    }
    return out;
  });
  return {
    politics: { ...politics, scandals: updated },
    approvalDamage: totalDamage,
    notifications,
    forcedResignation,
  };
}

/**
 * Apply suppression spending to a specific active scandal. Caller debits cash.
 */
export function applySuppression(
  politics: PoliticsState,
  scandalId: string,
  amountUSD: number
): PoliticsState | null {
  const list = politics.scandals ?? [];
  const idx = list.findIndex((s) => s.id === scandalId && s.active);
  if (idx === -1) return null;
  const updated = list.slice();
  updated[idx] = suppressScandal(updated[idx] as unknown as PoliticalScandal, amountUSD) as unknown as PoliticalScandalEntry;
  return { ...politics, scandals: updated };
}

/**
 * Roll for a fresh scandal this week given the drivers. Caller passes seeded rolls.
 * Returns the new state (or null if no scandal fired) and the created scandal.
 */
export function rollScandal(
  politics: PoliticsState,
  drivers: {
    darkWebHeat?: number;
    pacDirtyUSD?: number;
    karma?: number;
    contentiousPolicies?: number;
    careerLevel?: number;
  },
  currentWeek: number,
  rolls: { fire: number; severity: number; category: number; headline: number }
): { politics: PoliticsState; scandal: PoliticalScandalEntry } | null {
  const p = scandalProbability(drivers);
  if (p === 0 || rolls.fire >= p) return null;
  const fresh = createScandal({
    ...drivers,
    currentWeek,
    rolls: { severity: rolls.severity, category: rolls.category, headline: rolls.headline },
  }) as unknown as PoliticalScandalEntry;
  return { politics: addScandal(politics, fresh), scandal: fresh };
}

// ---------------------------------------------------------------------------
// PAC operations
// ---------------------------------------------------------------------------

export function ensurePAC(pac: PACPoolState | undefined): PACPoolState {
  return pac ?? INITIAL_PAC;
}

export function pacRaiseClean(politics: PoliticsState, amountUSD: number, currentWeek: number): PoliticsState {
  return { ...politics, pac: raiseClean(ensurePAC(politics.pac), amountUSD, currentWeek) };
}

export function pacRaiseDirty(
  politics: PoliticsState,
  btcAmount: number,
  btcPrice: number,
  currentWeek: number
): { politics: PoliticsState; usdConverted: number } {
  const r = raiseDirty(ensurePAC(politics.pac), btcAmount, btcPrice, currentWeek);
  return { politics: { ...politics, pac: r.pac }, usdConverted: r.usdConverted };
}

export function pacSpend(
  politics: PoliticsState,
  amountUSD: number
): { politics: PoliticsState; approvalGain: number; spentUSD: number; spentFromDirty: number } {
  const r = spendPAC(ensurePAC(politics.pac), amountUSD);
  const newApproval = Math.max(0, Math.min(100, safe(politics.approvalRating) + r.approvalGain));
  return {
    politics: { ...politics, pac: r.pac, approvalRating: newApproval },
    approvalGain: r.approvalGain,
    spentUSD: r.spentUSD,
    spentFromDirty: r.spentFromDirty,
  };
}

export function getPACTotal(politics: PoliticsState): number {
  return totalPAC(ensurePAC(politics.pac));
}

// ---------------------------------------------------------------------------
// Approval drift - natural decay between events
// ---------------------------------------------------------------------------

/**
 * Each week with no campaign activity, approval drifts toward 50 (the neutral
 * baseline) by 0.25 points. Models the natural "out of sight, out of mind"
 * fade. Caller applies this after scandal damage.
 */
export function driftApproval(politics: PoliticsState): PoliticsState {
  const cur = safe(politics.approvalRating, 50);
  if (cur === 50) return politics;
  const drift = 0.25;
  const next = cur > 50 ? Math.max(50, cur - drift) : Math.min(50, cur + drift);
  return { ...politics, approvalRating: next };
}

// Re-exports for the action layer.
export { SEVERITY_PARAMS };
