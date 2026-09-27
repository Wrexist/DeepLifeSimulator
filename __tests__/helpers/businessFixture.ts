import { createTestGameState } from './createTestGameState';
import { createDefaultCompanyOverlay } from '@/lib/business/hustleLogic';
import { initialGameState } from '@/contexts/game/initialState';
import type { GameState, Company } from '@/contexts/game/types';

export function businessState(): GameState {
  const base = createTestGameState();
  const company: Company = { id: 'factory', name: 'My Factory', type: 'factory', weeklyIncome: 20000, baseWeeklyIncome: 20000, upgrades: [], employees: 0, workerSalary: 500, workerMultiplier: 1.1, marketingLevel: 1, miners: {}, warehouseLevel: 0 };
  const overlay = createDefaultCompanyOverlay(company.id, 104);
  overlay.hiringPipeline.candidates = [{ id: 'candidate', name: 'Alex Reed', role: 'engineer', skill: 80, experience: 40, salaryAsk: 1000, postedWeek: 104, expiresWeek: 108, interestLevel: 80 }];
  overlay.pendingAcquisitions = [{ id: 'offer', targetName: 'Ironworks', targetIndustry: 'factory', askingPrice: 200000, estimatedAnnualRevenue: 52000, synergyBonusPercent: 20, offeredWeek: 104, expiresWeek: 108, status: 'pending' }];
  return { ...base, weeksLived: 104, lifeStartWeek: 104, stats: { ...base.stats, money: 1000000, energy: 100, reputation: 50 }, companies: [company], company, hustleApp: { ...initialGameState.hustleApp!, companies: { factory: overlay } } };
}
