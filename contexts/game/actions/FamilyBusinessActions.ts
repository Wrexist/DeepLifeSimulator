import React from 'react';
import { GameState, FamilyBusiness } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import { formatMoney } from '@/utils/moneyFormatting';

const log = logger.scope('FamilyBusinessActions');

/** One-time price of turning a company into a family business. The screen imports it. */
export const FAMILY_BUSINESS_COST = 1_000_000;

/**
 * PURE: what founding a family business on `companyId` does to `state`, and
 * what to tell the player. Returns `state` itself on every refusal, so the
 * updater below can use it directly and a same-batch double tap is a no-op
 * (C-10 shape: the message and the commit come from one function).
 */
export function resolveCreateFamilyBusiness(
  state: GameState,
  companyId: string,
): { success: boolean; message: string; next: GameState } {
  const company = state.companies.find(c => c.id === companyId);
  if (!company) {
    return { success: false, message: 'Company not found.', next: state };
  }
  if (state.familyBusinesses?.some(fb => fb.companyId === companyId)) {
    return { success: false, message: `${company.name} is already a family business.`, next: state };
  }
  const cost = FAMILY_BUSINESS_COST;
  // ATOMICITY: the $1M debit and the familyBusinesses append land in ONE
  // object (mirrors createCompany). The old code charged via a separate
  // updateMoney and appended unconditionally, so a double tap charged once and
  // granted twice.
  const spend = applyMoneyDelta(state, -cost, 'Create Family Business');
  if (!spend) {
    return { success: false, message: `You need ${formatMoney(cost)} to make ${company.name} a family business.`, next: state };
  }
  const newFamilyBusiness: FamilyBusiness = {
    companyId,
    foundedGeneration: state.generationNumber,
    generationsHeld: 0,
    brandValue: 0,
    reputation: 50, // Start with neutral reputation
  };
  return {
    success: true,
    message: `${company.name} is now a family business. It will pass to your heir.`,
    next: {
      ...state,
      ...spend,
      familyBusinesses: [...(state.familyBusinesses || []), newFamilyBusiness],
    },
  };
}

export const createFamilyBusiness = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
  /** Unused - charges atomically via `applyMoneyDelta`. Optional so callers need not fake it. */
  _deps?: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const { success, message } = resolveCreateFamilyBusiness(gameState, companyId);
  if (!success) {
    log.warn(`Family business refused for ${companyId}: ${message}`);
    return { success, message };
  }
  setGameState(prev => resolveCreateFamilyBusiness(prev, companyId).next);
  log.info(`Created family business for company ${companyId}`);
  return { success, message };
};

export type FamilyBusinessManageAction = 'marketing' | 'branding' | 'reputation';

/**
 * Cost and effect of each manage action, in one table.
 *
 * Previously a `switch` inside `manageFamilyBusiness` that initialised
 * `cost = 0`. A value outside the union therefore fell through every case and
 * charged nothing - harmless only because the gains defaulted to 0 too.
 * `resolveFamilyBusinessManage` now rejects an unknown action outright.
 */
const MANAGE_EFFECTS: Record<
  FamilyBusinessManageAction,
  { cost: number; brandGain: number; reputationGain: number }
> = {
  marketing: { cost: 10000, brandGain: 5, reputationGain: 0 }, // Scale this based on company size later
  branding: { cost: 50000, brandGain: 15, reputationGain: 2 },
  reputation: { cost: 25000, brandGain: 0, reputationGain: 10 },
};

export type FamilyBusinessManageOutcome =
  | { ok: false; message: string; next?: undefined }
  | { ok: true; message: string; next: GameState };

/**
 * PURE: what does managing `companyId` do to `state`?
 *
 * Returns both the caller-facing outcome AND the next state, so the SAME
 * function answers "what will the player be told" and "what does the save
 * become". This is the C-10 / `purchaseLifeSkill` shape, and it is the sound
 * fix for the read-out-of-updater class documented in
 * `__tests__/refactor/updaterTimingContract.test.tsx`.
 *
 * ── The bug this replaces (player report, 2026-08-15) ─────────────────────
 *
 * `manageFamilyBusiness` used to set a `didManage` flag INSIDE its
 * `setGameState` updater and read it after, reporting failure when the flag was
 * still false. React only runs the FIRST functional update of a batch eagerly;
 * a second one is DEFERRED, so the flag was still `false` when it was read even
 * though the updater went on to charge and grant correctly. A player with
 * $40.25M tapping a $10,000 marketing push got the state change AND an error
 * banner reading `Need $10,000 for "marketing" — you have $40.25M.` - the
 * shortfall-less branch of that message, which is only reachable this way.
 *
 * Because `success` was false, `CompanyDetailScreen` also skipped its
 * `saveGame()` and played the error haptic for an action that had worked.
 *
 * No cross-updater variable exists here to be stale: the preview runs against
 * the caller's snapshot, the commit re-runs against `prev`.
 */
export function resolveFamilyBusinessManage(
  state: GameState,
  companyId: string,
  action: FamilyBusinessManageAction
): FamilyBusinessManageOutcome {
  const business = state.familyBusinesses?.find(fb => fb.companyId === companyId);
  if (!business) return { ok: false, message: 'Family business not found' };

  const effect = MANAGE_EFFECTS[action];
  if (!effect) return { ok: false, message: `Unknown family business action "${action}"` };

  // Mirror applyMoneyDelta's NaN/Infinity guard so a corrupted balance reads as
  // 0 (unaffordable) rather than making every comparison below false.
  const raw = state.stats.money;
  const cash = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
  if (cash < effect.cost) {
    return {
      ok: false,
      message: `Need ${formatMoney(effect.cost)} for "${action}" - you have ${formatMoney(cash)} (${formatMoney(effect.cost - cash)} short).`,
    };
  }

  // ATOMICITY: the debit and the brand/reputation gain are built as ONE patch
  // (mirrors createFamilyBusiness above). The pre-fix code charged via a
  // standalone `deps.updateMoney(-cost)` and applied the gains in a SEPARATE,
  // UNCONDITIONAL updater - so a same-batch double-tap could apply the benefit
  // twice while the overdraft-guarded charge went through once. Here the gain
  // cannot exist without its matching debit: they are the same object.
  const spend = applyMoneyDelta(state, -effect.cost, `Family Business: ${action}`);
  if (!spend) {
    return {
      ok: false,
      message: `Need ${formatMoney(effect.cost)} for "${action}" - you have ${formatMoney(cash)}.`,
    };
  }

  return {
    ok: true,
    message: `${action} completed successfully`,
    next: {
      ...state,
      ...spend,
      familyBusinesses: state.familyBusinesses?.map(fb =>
        fb.companyId === companyId
          ? {
              ...fb,
              brandValue: Math.min(100, fb.brandValue + effect.brandGain),
              reputation: Math.min(100, fb.reputation + effect.reputationGain),
            }
          : fb
      ),
    },
  };
}

export const manageFamilyBusiness = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
  action: FamilyBusinessManageAction,
  /** Unused - charges atomically via `applyMoneyDelta`. Optional so callers need not fake it. */
  _deps?: { updateMoney: typeof updateMoney }
) => {
  void _deps; // charge flows through applyMoneyDelta, not deps.updateMoney

  // The outcome the player is told, computed from the snapshot they tapped on.
  const preview = resolveFamilyBusinessManage(gameState, companyId, action);
  if (!preview.ok) {
    if (!gameState.familyBusinesses?.some(fb => fb.companyId === companyId)) {
      log.warn(`Family business not found for ${companyId}`);
    }
    return { success: false, message: preview.message };
  }

  // The state, committed against fresh `prev` so a same-batch double-tap (or a
  // concurrent spend) is still rejected atomically.
  setGameState(prev => {
    const commit = resolveFamilyBusinessManage(prev, companyId, action);
    return commit.ok ? commit.next : prev;
  });

  return { success: true, message: preview.message };
};

