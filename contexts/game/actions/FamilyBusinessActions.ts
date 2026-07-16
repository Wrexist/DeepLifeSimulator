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
  deps: { updateMoney: typeof updateMoney }
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

export const manageFamilyBusiness = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyId: string,
  action: 'marketing' | 'branding' | 'reputation',
  deps: { updateMoney: typeof updateMoney }
) => {
  const business = gameState.familyBusinesses?.find(fb => fb.companyId === companyId);
  if (!business) {
    log.warn(`Family business not found for ${companyId}`);
    return { success: false, message: 'Family business not found' };
  }

  let cost = 0;
  let brandGain = 0;
  let reputationGain = 0;

  switch (action) {
    case 'marketing':
      cost = 10000; // Scale this based on company size later
      brandGain = 5;
      break;
    case 'branding':
      cost = 50000;
      brandGain = 15;
      reputationGain = 2;
      break;
    case 'reputation':
      cost = 25000;
      reputationGain = 10;
      break;
  }

  if (gameState.stats.money < cost) {
    const shortfall = cost - gameState.stats.money;
    return {
      success: false,
      message: `Need ${formatMoney(cost)} for "${action}" — you have ${formatMoney(gameState.stats.money)} (${formatMoney(shortfall)} short).`,
    };
  }

  // ATOMICITY FIX: fold the debit AND the brand/reputation gain into ONE
  // functional updater that reads `prev` (mirrors createFamilyBusiness above).
  // The previous code charged via a standalone `deps.updateMoney(-cost)` and then
  // applied the gains in a SEPARATE, UNCONDITIONAL updater — so a same-batch
  // double-tap (or a concurrent spend) could apply the benefit twice while the
  // overdraft-guarded charge only went through once (one charge, TWO benefits), or
  // apply the benefit even when the charge was rejected. `applyMoneyDelta` returns
  // null when the spend is unaffordable against fresh state → we `return prev`, so
  // the gain never lands without a matching debit. The `didManage` flag mirrors the
  // repairRig pattern for the caller-facing result.
  void deps; // charge now flows through applyMoneyDelta, not deps.updateMoney
  let didManage = false;
  setGameState(prev => {
    const fresh = prev.familyBusinesses?.find(fb => fb.companyId === companyId);
    if (!fresh) return prev; // dedup / business vanished between snapshot and commit
    const spend = applyMoneyDelta(prev, -cost, `Family Business: ${action}`);
    if (!spend) return prev; // unaffordable against fresh state → reject atomically
    didManage = true;
    return {
      ...prev,
      ...spend,
      familyBusinesses: prev.familyBusinesses?.map(fb =>
        fb.companyId === companyId
          ? {
              ...fb,
              brandValue: Math.min(100, fb.brandValue + brandGain),
              reputation: Math.min(100, fb.reputation + reputationGain),
            }
          : fb
      ),
    };
  });

  if (!didManage) {
    return {
      success: false,
      message: `Need ${formatMoney(cost)} for "${action}" — you have ${formatMoney(gameState.stats.money)}.`,
    };
  }
  return { success: true, message: `${action} completed successfully` };
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

