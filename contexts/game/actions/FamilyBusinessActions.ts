import { GameState, FamilyBusiness, Company } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';

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

  deps.updateMoney(setGameState, -cost, 'Create Family Business');

  const newFamilyBusiness: FamilyBusiness = {
    companyId,
    foundedGeneration: gameState.generationNumber,
    generationsHeld: 0,
    brandValue: 0,
    reputation: 50, // Start with neutral reputation
  };

  setGameState(prev => ({
    ...prev,
    familyBusinesses: [...(prev.familyBusinesses || []), newFamilyBusiness],
  }));

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
    return;
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
    // Should handle insufficient funds in UI, but check here too
    return { success: false, message: 'Insufficient funds' };
  }

  deps.updateMoney(setGameState, -cost, `Family Business: ${action}`);

  setGameState(prev => ({
    ...prev,
    familyBusinesses: prev.familyBusinesses?.map(fb => 
      fb.companyId === companyId
        ? {
            ...fb,
            brandValue: Math.min(100, fb.brandValue + brandGain),
            reputation: Math.min(100, fb.reputation + reputationGain),
          }
        : fb
    ),
  }));

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

