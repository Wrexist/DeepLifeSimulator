/**
 * R&D Lab System
 * 
 * Research and development labs for companies
 */
export type LabType = 'basic' | 'advanced' | 'cutting_edge';

export interface RDLab {
  type: LabType;
  builtWeek: number;
  researchProjects: ResearchProject[];
  completedResearch: string[]; // Technology IDs
}

export interface ResearchProject {
  id: string;
  technologyId: string;
  startWeek: number;
  duration: number; // weeks
  cost: number;
  progress: number; // 0-100
  completed: boolean;
}

export const LAB_TYPES: Record<LabType, {
  name: string;
  cost: number;
  maxConcurrentProjects: number;
  researchSpeedMultiplier: number;
  breakthroughChance: number;
}> = {
  basic: {
    name: 'Basic Lab',
    cost: 50000,
    maxConcurrentProjects: 1,
    researchSpeedMultiplier: 1.0,
    breakthroughChance: 0.01, // 1% chance
  },
  advanced: {
    name: 'Advanced Lab',
    cost: 200000,
    maxConcurrentProjects: 2,
    researchSpeedMultiplier: 1.5,
    breakthroughChance: 0.03, // 3% chance
  },
  cutting_edge: {
    name: 'Cutting-Edge Lab',
    cost: 1000000,
    maxConcurrentProjects: 3,
    researchSpeedMultiplier: 2.0,
    breakthroughChance: 0.05, // 5% chance
  },
};

export function getLabInfo(labType: LabType) {
  return LAB_TYPES[labType];
}

export function canBuildLab(companyType: string, labType: LabType): boolean {
  // All company types can build labs
  return true;
}

export function getLabUpgradeCost(currentType: LabType | null, targetType: LabType): number {
  if (!currentType) {
    return LAB_TYPES[targetType].cost;
  }
  
  const upgradeCosts: Record<string, Record<LabType, number>> = {
    basic: {
      advanced: 150000, // Cost to upgrade from basic to advanced
      cutting_edge: 950000, // Cost to upgrade from basic to cutting-edge
    },
    advanced: {
      cutting_edge: 800000, // Cost to upgrade from advanced to cutting-edge
    },
  };
  
  return upgradeCosts[currentType]?.[targetType] || LAB_TYPES[targetType].cost;
}

