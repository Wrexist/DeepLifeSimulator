/**
 * Company Actions
 */
import { GameState, Company } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { getInflatedPrice } from '@/lib/economy/inflation';

const log = logger.scope('CompanyActions');

export const createCompany = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyType: string,
  deps: { updateMoney: typeof updateMoney }
) => {
  // Ensure companyType is a string
  if (typeof companyType !== 'string') {
    log.error('createCompany: companyType must be a string', { companyType });
    return { success: false, message: 'Invalid company type' };
  }

  const companyCosts = {
    factory: 50000,
    ai: 90000,
    restaurant: 130000,
    realestate: 200000,
    bank: 2000000,
  } as const;

  const baseCost = companyCosts[companyType as keyof typeof companyCosts];
  if (!baseCost) {
    return { success: false, message: 'Unknown company type' };
  }

  const cost = getInflatedPrice(baseCost, gameState.economy.priceIndex);
  
  if (gameState.stats.money < cost) {
    return { success: false, message: 'Insufficient funds' };
  }

  if ((gameState.companies || []).find(c => c.id === companyType)) {
    return { success: false, message: 'You already own this company type' };
  }

  const hasEntrepreneurshipEducation = (gameState.educations || []).find(
    e => e.id === 'entrepreneurship'
  )?.completed;
  
  if (!hasEntrepreneurshipEducation) {
    return { success: false, message: 'You need to complete Entrepreneurship Course first!' };
  }

  // Logic moved from company.ts but adapted for split architecture
  const workerConfigs = {
    factory: { salary: 500 },
    ai: { salary: 2000 },
    restaurant: { salary: 400 },
    realestate: { salary: 1500 },
    bank: { salary: 5000 },
  } as const;

  const workerConfig = workerConfigs[companyType as keyof typeof workerConfigs];

  const newCompany: Company = {
    id: companyType,
    name: `My ${companyType.charAt(0).toUpperCase() + companyType.slice(1)}`,
    type: companyType as Company['type'],
    weeklyIncome: 2000,
    baseWeeklyIncome: 2000,
    upgrades: [], // Start with no upgrades
    employees: 0,
    workerSalary: workerConfig.salary,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0,
  };

  deps.updateMoney(setGameState, -cost, `Started company: ${newCompany.name}`);

  setGameState(prev => ({
    ...prev,
    companies: [...(prev.companies || []), newCompany],
    company: prev.company ?? newCompany,
  }));

  return { success: true, companyId: newCompany.id };
};

export const buyCompanyUpgrade = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  upgradeId: string,
  companyId?: string
) => {
  // Logic would mirror existing buyCompanyUpgrade from company.ts
  // For brevity in this split, invoking the existing logic would be ideal
  // or reimplementing it fully here.
  // For now, we'll rely on the original logic being imported in the main context
  // but this structure is ready for migration.
  log.info('buyCompanyUpgrade placeholder');
};


