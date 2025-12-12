/**
 * Technology Tree System
 * 
 * Technologies that can be researched and unlocked
 */
export type TechnologyCategory = 'manufacturing' | 'ai_ml' | 'food_service';

export interface Technology {
  id: string;
  name: string;
  description: string;
  category: TechnologyCategory;
  tier: 1 | 2 | 3;
  researchTime: number; // weeks
  researchCost: number;
  prerequisites: string[]; // Technology IDs that must be completed first
  unlocks: {
    companyUpgrades?: string[]; // Company upgrade IDs
    features?: string[]; // Feature IDs
    incomeMultiplier?: number; // Income multiplier for company
  };
  companyTypes: string[]; // Company types this applies to
}

export const TECHNOLOGIES: Technology[] = [
  // Manufacturing Technologies (Factory)
  {
    id: 'automation_lvl1',
    name: 'Basic Automation',
    description: 'Automate basic manufacturing processes',
    category: 'manufacturing',
    tier: 1,
    researchTime: 4,
    researchCost: 10000,
    prerequisites: [],
    unlocks: {
      companyUpgrades: ['automation'],
      incomeMultiplier: 1.1,
    },
    companyTypes: ['factory'],
  },
  {
    id: 'automation_lvl2',
    name: 'Advanced Automation',
    description: 'Advanced robotics and automation systems',
    category: 'manufacturing',
    tier: 2,
    researchTime: 8,
    researchCost: 50000,
    prerequisites: ['automation_lvl1'],
    unlocks: {
      incomeMultiplier: 1.2,
    },
    companyTypes: ['factory'],
  },
  {
    id: 'quality_systems',
    name: 'Quality Control Systems',
    description: 'Advanced quality assurance and testing',
    category: 'manufacturing',
    tier: 1,
    researchTime: 6,
    researchCost: 25000,
    prerequisites: [],
    unlocks: {
      companyUpgrades: ['quality_control'],
      incomeMultiplier: 1.15,
    },
    companyTypes: ['factory'],
  },
  {
    id: 'supply_chain',
    name: 'Supply Chain Optimization',
    description: 'Optimize supply chain for efficiency',
    category: 'manufacturing',
    tier: 2,
    researchTime: 10,
    researchCost: 75000,
    prerequisites: ['automation_lvl1'],
    unlocks: {
      incomeMultiplier: 1.25,
    },
    companyTypes: ['factory'],
  },
  
  // AI/ML Technologies (AI Company)
  {
    id: 'ml_models',
    name: 'Machine Learning Models',
    description: 'Develop advanced ML models',
    category: 'ai_ml',
    tier: 1,
    researchTime: 6,
    researchCost: 30000,
    prerequisites: [],
    unlocks: {
      companyUpgrades: ['machine_learning'],
      incomeMultiplier: 1.15,
    },
    companyTypes: ['ai'],
  },
  {
    id: 'neural_networks',
    name: 'Neural Networks',
    description: 'Deep learning neural network systems',
    category: 'ai_ml',
    tier: 2,
    researchTime: 10,
    researchCost: 100000,
    prerequisites: ['ml_models'],
    unlocks: {
      incomeMultiplier: 1.3,
    },
    companyTypes: ['ai'],
  },
  {
    id: 'quantum_computing',
    name: 'Quantum Computing',
    description: 'Quantum computing capabilities',
    category: 'ai_ml',
    tier: 3,
    researchTime: 20,
    researchCost: 500000,
    prerequisites: ['neural_networks'],
    unlocks: {
      incomeMultiplier: 1.5,
    },
    companyTypes: ['ai'],
  },
  
  // Food Service Technologies (Restaurant)
  {
    id: 'molecular_gastronomy',
    name: 'Molecular Gastronomy',
    description: 'Advanced culinary techniques',
    category: 'food_service',
    tier: 2,
    researchTime: 8,
    researchCost: 40000,
    prerequisites: [],
    unlocks: {
      incomeMultiplier: 1.2,
    },
    companyTypes: ['restaurant'],
  },
  {
    id: 'sustainable_sourcing',
    name: 'Sustainable Sourcing',
    description: 'Eco-friendly ingredient sourcing',
    category: 'food_service',
    tier: 1,
    researchTime: 6,
    researchCost: 25000,
    prerequisites: [],
    unlocks: {
      incomeMultiplier: 1.1,
    },
    companyTypes: ['restaurant'],
  },
  {
    id: 'delivery_optimization',
    name: 'Delivery Optimization',
    description: 'Optimize delivery routes and systems',
    category: 'food_service',
    tier: 1,
    researchTime: 4,
    researchCost: 15000,
    prerequisites: [],
    unlocks: {
      incomeMultiplier: 1.15,
    },
    companyTypes: ['restaurant'],
  },
];

export function getTechnologiesForCompany(companyType: string): Technology[] {
  return TECHNOLOGIES.filter(t => t.companyTypes.includes(companyType));
}

export function getAvailableTechnologies(
  companyType: string,
  completedTechnologies: string[]
): Technology[] {
  const allTechs = getTechnologiesForCompany(companyType);
  return allTechs.filter(tech => {
    // Check if already completed
    if (completedTechnologies.includes(tech.id)) return false;
    
    // Check prerequisites
    return tech.prerequisites.every(prereq => completedTechnologies.includes(prereq));
  });
}

export function getTechnologyById(id: string): Technology | undefined {
  return TECHNOLOGIES.find(t => t.id === id);
}

