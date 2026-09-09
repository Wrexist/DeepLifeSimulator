import { createTestGameState } from './createTestGameState';
import type { Company, GameState } from '@/contexts/game/types';

export function researchState(progress = 0): GameState {
  const company: Company = {
    id: 'research-co', name: 'Research Co', type: 'ai',
    weeklyIncome: 5000, baseWeeklyIncome: 5000, employees: 0,
    workerSalary: 0, workerMultiplier: 1.1, marketingLevel: 0,
    miners: {}, warehouseLevel: 0, upgrades: [],
    rdLab: { type: 'basic', builtWeek: 0, completedResearch: [], researchProjects: [
      { id: 'project-1', technologyId: 'ml_models', startWeek: 8, duration: 4, cost: 30000, progress, completed: false },
    ] },
    unlockedTechnologies: [],
    patents: [{ id: 'patent-1', technologyId: 'ml_models', name: 'Patent', filedWeek: 1, weeklyIncome: 1000, duration: 2, totalDuration: 2 }],
  };
  return createTestGameState({ weeksLived: 10, lineageId: 'research-life', companies: [company], company });
}

