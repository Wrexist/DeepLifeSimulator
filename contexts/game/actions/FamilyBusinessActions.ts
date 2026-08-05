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

/** What one management action costs and what it buys. */
const MANAGE_EFFECTS: Record<
  'marketing' | 'branding' | 'reputation',
  { cost: number; brandGain: number; reputationGain: number }
> = {
  marketing: { cost: 10_000, brandGain: 5, reputationGain: 0 },
  branding: { cost: 50_000, brandGain: 15, reputationGain: 2 },
  reputation: { cost: 25_000, brandGain: 0, reputationGain: 10 },
};

export interface FamilyBusinessActionResult {
  success: boolean;
  message: string;
}

interface ManageTransition {
  next: GameState;
  result: FamilyBusinessActionResult;
}

/**
 * Pure: what managing `companyId` does to `state`, and what to tell the player.
 *
 * Returns `state` unchanged on every rejection, so the caller's updater can use
 * it directly and a second tap in the same batch is a genuine no-op.
 */
export function resolveManageFamilyBusiness(
  state: GameState,
  companyId: string,
  action: 'marketing' | 'branding' | 'reputation',
): ManageTransition {
  const business = state.familyBusinesses?.find(fb => fb.companyId === companyId);
  if (!business) {
    return { next: state, result: { success: false, message: 'Family business not found' } };
  }

  const effects = MANAGE_EFFECTS[action];
  if (!effects) {
    return { next: state, result: { success: false, message: 'That action is no longer available.' } };
  }
  const { cost, brandGain, reputationGain } = effects;

  const spend = applyMoneyDelta(state, -cost, `Family Business: ${action}`);
  if (!spend) {
    const cash = typeof state.stats?.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
    return {
      next: state,
      result: {
        success: false,
        message: `Need ${formatMoney(cost)} for "${action}" — you have ${formatMoney(cash)} (${formatMoney(Math.max(0, cost - cash))} short).`,
      },
    };
  }

  return {
    next: {
      ...state,
      // Charge and grant in ONE object, so a same-batch double tap cannot pay
      // once and apply the benefit twice (§4.4).
      ...spend,
      familyBusinesses: state.familyBusinesses?.map(fb =>
        fb.companyId === companyId
          ? {
              ...fb,
              brandValue: Math.min(100, fb.brandValue + brandGain),
              reputation: Math.min(100, fb.reputation + reputationGain),
            }
          : fb
      ),
    },
    result: { success: true, message: `${action} completed successfully` },
  };
}

/**
 * Spend on marketing / branding / reputation for a family business.
 *
 * ── Why this is a pure resolver called twice ──────────────────────────────
 *
 * It used to assign `didManage = true` INSIDE the `setGameState` updater and
 * read it on the next line. That is the pessimistic capture the C-9 ratchet's
 * own header rules out: React runs the first functional update of a batch
 * eagerly (so the capture reads) and DEFERS the second (so it does not).
 *
 * In the field it read `false` on a successful spend, so the updater charged the
 * $10,000 and applied the brand gain while the caller showed
 * `Need $10,000 for "marketing" — you have $1.54M.` A player reported exactly
 * that, having tapped through roughly $1.3M of real charges while being told
 * every single one had failed. The money was right; the answer was not — the
 * same shape as C-8, in the opposite direction.
 *
 * The outcome is now a pure function of state, called in both places, so no
 * variable crosses the updater boundary (the C-10 pattern).
 */
export const manageFamilyBusiness = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
  action: 'marketing' | 'branding' | 'reputation',
  /** Unused — charges atomically via `applyMoneyDelta`. Optional so callers need not fake it. */
  _deps?: { updateMoney: typeof updateMoney }
): FamilyBusinessActionResult => {
  void _deps; // charge flows through applyMoneyDelta, not deps.updateMoney

  const { result } = resolveManageFamilyBusiness(gameState, companyId, action);
  if (!result.success) {
    if (result.message === 'Family business not found') log.warn(`Family business not found for ${companyId}`);
    return result;
  }

  setGameState(prev => resolveManageFamilyBusiness(prev, companyId, action).next);
  return result;
};

export const inheritFamilyBusinesses = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  prevGameState: GameState
) => {
  if (!prevGameState.familyBusinesses || prevGameState.familyBusinesses.length === 0) return;

  setGameState(prev => ({
    ...prev,
    familyBusinesses: prev.familyBusinesses?.map(fb => ({
      ...fb,
      generationsHeld: fb.generationsHeld + 1,
      // Brand value might decay slightly on inheritance if not managed well?
      // For now, keep it.
    })),
  }));
  
  log.info('Inherited family businesses to next generation');
};

