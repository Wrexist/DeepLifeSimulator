/**
 * Patent System
 * 
 * Patents generate passive income from research breakthroughs
 */
export interface Patent {
  id: string;
  technologyId: string;
  name: string;
  filedWeek: number;
  weeklyIncome: number;
  duration: number; // weeks remaining
  totalDuration: number; // total weeks when filed
}

export function createPatent(
  technologyId: string,
  technologyName: string,
  week: number,
  labType: 'basic' | 'advanced' | 'cutting_edge'
): Patent {
  // Base patent values
  const baseValues: Record<string, { income: number; duration: number }> = {
    automation_lvl1: { income: 500, duration: 20 },
    automation_lvl2: { income: 1500, duration: 30 },
    quality_systems: { income: 800, duration: 25 },
    supply_chain: { income: 2000, duration: 35 },
    ml_models: { income: 1000, duration: 25 },
    neural_networks: { income: 3000, duration: 40 },
    quantum_computing: { income: 5000, duration: 50 },
    molecular_gastronomy: { income: 1200, duration: 30 },
    sustainable_sourcing: { income: 600, duration: 20 },
    delivery_optimization: { income: 400, duration: 20 },
  };

  const base = baseValues[technologyId] || { income: 500, duration: 20 };
  
  // Lab type multipliers
  const multipliers = {
    basic: 1.0,
    advanced: 1.5,
    cutting_edge: 2.0,
  };

  const weeklyIncome = Math.floor(base.income * multipliers[labType]);
  const duration = base.duration;

  return {
    id: `patent_${technologyId}_${week}_${Date.now()}`,
    technologyId,
    name: `${technologyName} Patent`,
    filedWeek: week,
    weeklyIncome,
    duration,
    totalDuration: duration,
  };
}

export function calculatePatentIncome(patents: Patent[]): number {
  return patents.reduce((sum, patent) => {
    if (patent.duration > 0) {
      return sum + patent.weeklyIncome;
    }
    return sum;
  }, 0);
}

export function updatePatents(patents: Patent[]): Patent[] {
  return patents
    .map(patent => ({
      ...patent,
      duration: Math.max(0, patent.duration - 1),
    }))
    .filter(patent => patent.duration > 0); // Remove expired patents
}

