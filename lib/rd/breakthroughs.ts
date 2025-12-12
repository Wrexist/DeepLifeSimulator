/**
 * Scientific Breakthroughs
 * 
 * Rare events with major economic impact
 */
export type BreakthroughType = 'revolutionary_product' | 'industry_disruption' | 'global_impact';

export interface Breakthrough {
  id: string;
  name: string;
  description: string;
  type: BreakthroughType;
  technologyId: string;
  companyId: string;
  week: number;
  effects: {
    incomeMultiplier?: number;
    reputation?: number;
    unlockFeature?: string;
  };
}

export const BREAKTHROUGH_EFFECTS: Record<BreakthroughType, {
  name: string;
  description: string;
  incomeMultiplier: number;
  reputation: number;
  unlockFeature?: string;
}> = {
  revolutionary_product: {
    name: 'Revolutionary Product',
    description: 'Your research has led to a breakthrough product that revolutionizes the market!',
    incomeMultiplier: 2.0, // Double company income
    reputation: 50,
  },
  industry_disruption: {
    name: 'Industry Disruption',
    description: 'Your innovation disrupts the entire industry, giving you a competitive advantage!',
    incomeMultiplier: 1.5, // 50% income boost
    reputation: 30,
  },
  global_impact: {
    name: 'Global Impact',
    description: 'Your breakthrough has global significance, affecting the entire economy!',
    incomeMultiplier: 3.0, // Triple company income
    reputation: 100,
    unlockFeature: 'global_recognition',
  },
};

export function triggerBreakthrough(
  technologyId: string,
  companyId: string,
  week: number,
  labType: 'basic' | 'advanced' | 'cutting_edge'
): Breakthrough | null {
  // Base chance for breakthrough
  const baseChance = {
    basic: 0.001, // 0.1%
    advanced: 0.005, // 0.5%
    cutting_edge: 0.01, // 1%
  }[labType];

  // Higher tier technologies have higher breakthrough chance
  const technology = require('./technologyTree').getTechnologyById(technologyId);
  const tierMultiplier = technology?.tier === 3 ? 2.0 : technology?.tier === 2 ? 1.5 : 1.0;

  const chance = baseChance * tierMultiplier;

  if (Math.random() < chance) {
    // Determine breakthrough type based on technology tier
    let type: BreakthroughType;
    if (technology?.tier === 3) {
      type = Math.random() < 0.3 ? 'global_impact' : 'revolutionary_product';
    } else if (technology?.tier === 2) {
      type = Math.random() < 0.5 ? 'industry_disruption' : 'revolutionary_product';
    } else {
      type = 'industry_disruption';
    }

    const effects = BREAKTHROUGH_EFFECTS[type];

    return {
      id: `breakthrough_${technologyId}_${week}_${Date.now()}`,
      name: effects.name,
      description: effects.description,
      type,
      technologyId,
      companyId,
      week,
      effects: {
        incomeMultiplier: effects.incomeMultiplier,
        reputation: effects.reputation,
        unlockFeature: effects.unlockFeature,
      },
    };
  }

  return null;
}

export function applyBreakthroughEffects(
  company: { weeklyIncome: number; baseWeeklyIncome: number },
  breakthrough: Breakthrough
): { weeklyIncome: number; baseWeeklyIncome: number } {
  if (breakthrough.effects.incomeMultiplier) {
    return {
      weeklyIncome: Math.round(company.weeklyIncome * breakthrough.effects.incomeMultiplier),
      baseWeeklyIncome: Math.round(company.baseWeeklyIncome * breakthrough.effects.incomeMultiplier),
    };
  }
  return company;
}

