import React from 'react';
import { GameState, FamilyBusiness } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import { formatMoney } from '@/utils/moneyFormatting';

const log = logger.scope('FamilyBusinessActions');

export const createFamilyBusiness = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
  /** Unused — charges atomically via `applyMoneyDelta`. Optional so callers need not fake it. */
  _deps?: { updateMoney: typeof updateMoney }
) => {
  const company = gameState.companies.find(c => c.id === companyId);
  if (!company) {
    log.error(`Company ${companyId} not found`);
    return;
  }

  if (gameState.familyBusinesses?.some(fb => fb.companyId === companyId)) {
    log.warn(`Company ${companyId} is already a family business`);
    return;
  }

  const cost = 1000000;
  if (gameState.stats.money < cost) {
    log.warn('Insufficient funds to create family business');
    return;
  }

  // ATOMICITY FIX: fold the $1M debit and the familyBusinesses append into ONE
  // functional updater that reads `prev` (mirrors createCompany). The previous
  // code charged via a separate updateMoney call and then appended the business
  // UNCONDITIONALLY — so a same-batch double-tap (or a concurrent spend) charged
  // once (overdraft reject) while BOTH appends ran, granting a free, duplicated
  // family business and corrupting state with a duplicate companyId.
  setGameState(prev => {
    if (prev.familyBusinesses?.some(fb => fb.companyId === companyId)) return prev; // dedup vs fresh state
    const spend = applyMoneyDelta(prev, -cost, 'Create Family Business');
    if (!spend) return prev; // unaffordable against fresh state → reject
    const newFamilyBusiness: FamilyBusiness = {
      companyId,
      foundedGeneration: prev.generationNumber,
      generationsHeld: 0,
      brandValue: 0,
      reputation: 50, // Start with neutral reputation
    };
    return {
      ...prev,
      ...spend,
      familyBusinesses: [...(prev.familyBusinesses || []), newFamilyBusiness],
    };
  });

  log.info(`Created family business for company ${companyId}`);
};

export type FamilyBusinessManageAction = 'marketing' | 'branding' | 'reputation';

/**
 * Cost and effect of each manage action, in one table.
 *
 * Previously a `switch` inside `manageFamilyBusiness` that initialised
 * `cost = 0`. A value outside the union therefore fell through every case and
 * charged nothing — harmless only because the gains defaulted to 0 too.
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
 * banner reading `Need $10,000 for "marketing" — you have $40.25M.` — the
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
      message: `Need ${formatMoney(effect.cost)} for "${action}" — you have ${formatMoney(cash)} (${formatMoney(effect.cost - cash)} short).`,
    };
  }

  // ATOMICITY: the debit and the brand/reputation gain are built as ONE patch
  // (mirrors createFamilyBusiness above). The pre-fix code charged via a
  // standalone `deps.updateMoney(-cost)` and applied the gains in a SEPARATE,
  // UNCONDITIONAL updater — so a same-batch double-tap could apply the benefit
  // twice while the overdraft-guarded charge went through once. Here the gain
  // cannot exist without its matching debit: they are the same object.
  const spend = applyMoneyDelta(state, -effect.cost, `Family Business: ${action}`);
  if (!spend) {
    return {
      ok: false,
      message: `Need ${formatMoney(effect.cost)} for "${action}" — you have ${formatMoney(cash)}.`,
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
  /** Unused — charges atomically via `applyMoneyDelta`. Optional so callers need not fake it. */
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

