import { getInflatedPrice } from '@/lib/economy/inflation';
import type {
  GameState,
  GameStats,
  Company,
  CompanyUpgrade,
} from '../GameContext';
import type { Dispatch, SetStateAction } from 'react';

export function createCompany(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyType: string
): { success: boolean; message?: string; companyId?: string } {
  // Ensure companyType is a string
  if (typeof companyType !== 'string') {
    console.error('createCompany: companyType must be a string, received:', typeof companyType, companyType);
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
  const cost = getInflatedPrice(baseCost, gameState.economy.priceIndex);
  if (gameState.stats.money < cost) {
    return { success: false, message: 'Insufficient funds' };
  }
  if (gameState.companies.find(c => c.id === companyType)) {
    return { success: false, message: 'You already own this company type' };
  }

  const hasEntrepreneurshipEducation = gameState.educations.find(
    e => e.id === 'entrepreneurship'
  )?.completed;
  if (!hasEntrepreneurshipEducation) {
    return { success: false, message: 'You need to complete Entrepreneurship Course first!' };
  }

  const companyUpgrades: Record<string, CompanyUpgrade[]> = {
    factory: [
      {
        id: 'machinery',
        name: 'Better Machinery',
        description: 'Increase production efficiency',
        cost: 10000,
        weeklyIncomeBonus: 500,
        level: 0,
        maxLevel: 5,
      },
      {
        id: 'workers',
        name: 'More Workers',
        description: 'Hire additional staff',
        cost: 15000,
        weeklyIncomeBonus: 800,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'automation',
        name: 'Assembly Line',
        description: 'Automated production line',
        cost: 25000,
        weeklyIncomeBonus: 1200,
        level: 0,
        maxLevel: 4,
      },
      {
        id: 'quality_control',
        name: 'Quality Control',
        description: 'Advanced quality assurance',
        cost: 20000,
        weeklyIncomeBonus: 1000,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'warehouse',
        name: 'Smart Warehouse',
        description: 'Automated inventory management',
        cost: 30000,
        weeklyIncomeBonus: 1500,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'safety',
        name: 'Safety Systems',
        description: 'Workplace safety improvements',
        cost: 18000,
        weeklyIncomeBonus: 800,
        level: 0,
        maxLevel: 4,
      },
    ],
    ai: [
      {
        id: 'servers',
        name: 'Better Servers',
        description: 'Upgrade computing power',
        cost: 25000,
        weeklyIncomeBonus: 1200,
        level: 0,
        maxLevel: 4,
      },
      {
        id: 'algorithms',
        name: 'Advanced Algorithms',
        description: 'Improve AI capabilities',
        cost: 30000,
        weeklyIncomeBonus: 1500,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'gpu_cluster',
        name: 'GPU Cluster',
        description: 'Faster AI training',
        cost: 50000,
        weeklyIncomeBonus: 2500,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'data_center',
        name: 'Data Center',
        description: 'Scale operations',
        cost: 75000,
        weeklyIncomeBonus: 3500,
        level: 0,
        maxLevel: 2,
      },
      {
        id: 'ai_researchers',
        name: 'AI Researchers',
        description: 'Cutting-edge research team',
        cost: 40000,
        weeklyIncomeBonus: 2000,
        level: 0,
        maxLevel: 4,
      },
      {
        id: 'machine_learning',
        name: 'ML Platform',
        description: 'Machine learning infrastructure',
        cost: 60000,
        weeklyIncomeBonus: 3000,
        level: 0,
        maxLevel: 3,
      },
    ],
    restaurant: [
      {
        id: 'kitchen',
        name: 'Kitchen Upgrade',
        description: 'Modernize kitchen equipment',
        cost: 20000,
        weeklyIncomeBonus: 1000,
        level: 0,
        maxLevel: 4,
      },
      {
        id: 'staff',
        name: 'Professional Staff',
        description: 'Hire experienced chefs',
        cost: 18000,
        weeklyIncomeBonus: 900,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'delivery_service',
        name: 'Delivery Service',
        description: 'Expand customer reach',
        cost: 25000,
        weeklyIncomeBonus: 1200,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'michelin_chef',
        name: 'Michelin Chef',
        description: 'Premium dining experience',
        cost: 40000,
        weeklyIncomeBonus: 2000,
        level: 0,
        maxLevel: 2,
      },
      {
        id: 'interior_design',
        name: 'Interior Design',
        description: 'Upscale dining atmosphere',
        cost: 30000,
        weeklyIncomeBonus: 1500,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'wine_cellar',
        name: 'Wine Cellar',
        description: 'Premium wine selection',
        cost: 35000,
        weeklyIncomeBonus: 1800,
        level: 0,
        maxLevel: 2,
      },
    ],
    realestate: [
      {
        id: 'properties',
        name: 'More Properties',
        description: 'Expand property portfolio',
        cost: 50000,
        weeklyIncomeBonus: 2000,
        level: 0,
        maxLevel: 5,
      },
      {
        id: 'management',
        name: 'Property Management',
        description: 'Improve property management',
        cost: 30000,
        weeklyIncomeBonus: 1500,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'property_portfolio',
        name: 'Property Portfolio',
        description: 'More rental properties',
        cost: 75000,
        weeklyIncomeBonus: 3000,
        level: 0,
        maxLevel: 4,
      },
      {
        id: 'commercial_real_estate',
        name: 'Commercial Properties',
        description: 'Higher value investments',
        cost: 100000,
        weeklyIncomeBonus: 4000,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'property_management',
        name: 'Property Management',
        description: 'Professional management',
        cost: 40000,
        weeklyIncomeBonus: 2000,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'luxury_developments',
        name: 'Luxury Developments',
        description: 'High-end property development',
        cost: 150000,
        weeklyIncomeBonus: 6000,
        level: 0,
        maxLevel: 2,
      },
    ],
    bank: [
      {
        id: 'technology',
        name: 'Banking Technology',
        description: 'Upgrade banking systems',
        cost: 100000,
        weeklyIncomeBonus: 5000,
        level: 0,
        maxLevel: 4,
      },
      {
        id: 'services',
        name: 'Financial Services',
        description: 'Expand financial services',
        cost: 80000,
        weeklyIncomeBonus: 4000,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'investment_division',
        name: 'Investment Division',
        description: 'Wealth management services',
        cost: 200000,
        weeklyIncomeBonus: 10000,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'international_banking',
        name: 'International Banking',
        description: 'Global operations',
        cost: 300000,
        weeklyIncomeBonus: 15000,
        level: 0,
        maxLevel: 2,
      },
      {
        id: 'fintech_integration',
        name: 'FinTech Integration',
        description: 'Digital banking solutions',
        cost: 150000,
        weeklyIncomeBonus: 7500,
        level: 0,
        maxLevel: 3,
      },
      {
        id: 'private_banking',
        name: 'Private Banking',
        description: 'Exclusive client services',
        cost: 250000,
        weeklyIncomeBonus: 12000,
        level: 0,
        maxLevel: 2,
      },
    ],
  };

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
    upgrades: companyUpgrades[companyType] || [],
    employees: 0,
    workerSalary: workerConfig.salary,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0, // Start with 10 slots (0 level = 10 slots)
  };

  setGameState(prev => ({
    ...prev,
    companies: [...prev.companies, newCompany],
    company: prev.company ?? newCompany,
    stats: {
      ...prev.stats,
      money: prev.stats.money - cost,
    },
  }));
  return { success: true, companyId: newCompany.id };
}

export function buyCompanyUpgrade(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  upgradeId: string,
  companyId?: string
): void {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) return;

  const companyIndex = gameState.companies.findIndex(c => c.id === targetId);
  if (companyIndex === -1) return;

  // Get the company's available upgrades
  const company = gameState.companies.find(c => c.id === targetId);
  if (!company) return;
  
  const companyType = company.type;
  
  // Define company upgrades locally
  const companyUpgrades: Record<string, any[]> = {
    factory: [
      { id: 'machinery', name: 'Better Machinery', description: 'Increase production efficiency', cost: 10000, weeklyIncomeBonus: 500, level: 1, maxLevel: 5 },
      { id: 'workers', name: 'More Workers', description: 'Hire additional staff', cost: 15000, weeklyIncomeBonus: 800, level: 1, maxLevel: 3 },
      { id: 'automation', name: 'Assembly Line', description: 'Automated production line', cost: 25000, weeklyIncomeBonus: 1200, level: 1, maxLevel: 4 },
      { id: 'quality_control', name: 'Quality Control', description: 'Advanced quality assurance', cost: 20000, weeklyIncomeBonus: 1000, level: 1, maxLevel: 3 },
      { id: 'warehouse', name: 'Smart Warehouse', description: 'Automated inventory management', cost: 30000, weeklyIncomeBonus: 1500, level: 1, maxLevel: 3 },
      { id: 'safety', name: 'Safety Systems', description: 'Workplace safety improvements', cost: 18000, weeklyIncomeBonus: 800, level: 1, maxLevel: 4 },
    ],
    ai: [
      { id: 'servers', name: 'Better Servers', description: 'Upgrade computing power', cost: 25000, weeklyIncomeBonus: 1200, level: 1, maxLevel: 4 },
      { id: 'algorithms', name: 'Advanced Algorithms', description: 'Improve AI capabilities', cost: 30000, weeklyIncomeBonus: 1500, level: 1, maxLevel: 3 },
      { id: 'gpu_cluster', name: 'GPU Cluster', description: 'Faster AI training', cost: 50000, weeklyIncomeBonus: 2500, level: 1, maxLevel: 3 },
      { id: 'data_center', name: 'Data Center', description: 'Scale operations', cost: 75000, weeklyIncomeBonus: 3500, level: 1, maxLevel: 2 },
      { id: 'ai_researchers', name: 'AI Researchers', description: 'Cutting-edge research team', cost: 40000, weeklyIncomeBonus: 2000, level: 1, maxLevel: 4 },
      { id: 'machine_learning', name: 'ML Platform', description: 'Machine learning infrastructure', cost: 60000, weeklyIncomeBonus: 3000, level: 1, maxLevel: 3 },
    ],
    restaurant: [
      { id: 'kitchen', name: 'Kitchen Upgrade', description: 'Modernize kitchen equipment', cost: 20000, weeklyIncomeBonus: 1000, level: 1, maxLevel: 4 },
      { id: 'staff', name: 'Professional Staff', description: 'Hire experienced chefs', cost: 18000, weeklyIncomeBonus: 900, level: 1, maxLevel: 3 },
      { id: 'delivery_service', name: 'Delivery Service', description: 'Expand customer reach', cost: 25000, weeklyIncomeBonus: 1200, level: 1, maxLevel: 3 },
      { id: 'michelin_chef', name: 'Michelin Chef', description: 'Premium dining experience', cost: 40000, weeklyIncomeBonus: 2000, level: 1, maxLevel: 2 },
      { id: 'interior_design', name: 'Interior Design', description: 'Upscale dining atmosphere', cost: 30000, weeklyIncomeBonus: 1500, level: 1, maxLevel: 3 },
      { id: 'wine_cellar', name: 'Wine Cellar', description: 'Premium wine selection', cost: 35000, weeklyIncomeBonus: 1800, level: 1, maxLevel: 2 },
    ],
    realestate: [
      { id: 'properties', name: 'More Properties', description: 'Expand property portfolio', cost: 50000, weeklyIncomeBonus: 2000, level: 1, maxLevel: 5 },
      { id: 'management', name: 'Property Management', description: 'Improve property management', cost: 30000, weeklyIncomeBonus: 1500, level: 1, maxLevel: 3 },
      { id: 'property_portfolio', name: 'Property Portfolio', description: 'More rental properties', cost: 75000, weeklyIncomeBonus: 3000, level: 1, maxLevel: 4 },
      { id: 'commercial_real_estate', name: 'Commercial Properties', description: 'Higher value investments', cost: 100000, weeklyIncomeBonus: 4000, level: 1, maxLevel: 3 },
      { id: 'property_management', name: 'Property Management', description: 'Professional management', cost: 40000, weeklyIncomeBonus: 2000, level: 1, maxLevel: 3 },
      { id: 'luxury_developments', name: 'Luxury Developments', description: 'High-end property development', cost: 150000, weeklyIncomeBonus: 6000, level: 1, maxLevel: 2 },
    ],
    bank: [
      { id: 'technology', name: 'Banking Technology', description: 'Upgrade banking systems', cost: 100000, weeklyIncomeBonus: 5000, level: 1, maxLevel: 4 },
      { id: 'services', name: 'Financial Services', description: 'Expand financial services', cost: 80000, weeklyIncomeBonus: 4000, level: 1, maxLevel: 3 },
      { id: 'investment_division', name: 'Investment Division', description: 'Wealth management services', cost: 200000, weeklyIncomeBonus: 10000, level: 1, maxLevel: 3 },
      { id: 'international_banking', name: 'International Banking', description: 'Global operations', cost: 300000, weeklyIncomeBonus: 15000, level: 1, maxLevel: 2 },
      { id: 'fintech_integration', name: 'FinTech Integration', description: 'Digital banking solutions', cost: 150000, weeklyIncomeBonus: 7500, level: 1, maxLevel: 3 },
      { id: 'private_banking', name: 'Private Banking', description: 'Exclusive client services', cost: 250000, weeklyIncomeBonus: 12000, level: 1, maxLevel: 2 },
    ],
  };
  
  const availableUpgrades = companyUpgrades[companyType] || [];
  const upgradeDefinition = availableUpgrades.find((u: any) => u.id === upgradeId);
  if (!upgradeDefinition) return;

  setGameState(prev => {
    const companies = [...prev.companies];
    const company = companies[companyIndex];
    
    // Find existing upgrade or create new one
    let existingUpgrade = company.upgrades.find(u => u.id === upgradeId);
    const currentLevel = existingUpgrade?.level || 0;
    
    if (currentLevel >= upgradeDefinition.maxLevel) return prev;

    // Calculate cost based on current level (using a simple multiplier for now)
    const costMultiplier = 1.5; // Simple cost increase per level
    const nextLevelCost = currentLevel === 0 
      ? upgradeDefinition.cost 
      : Math.round(upgradeDefinition.cost * Math.pow(costMultiplier, currentLevel));
    
    const cost = getInflatedPrice(nextLevelCost, prev.economy.priceIndex);
    if (prev.stats.money < cost) return prev;

    // Calculate bonus for this level
    const bonus = upgradeDefinition.weeklyIncomeBonus;

    // Update or add the upgrade
    const updatedUpgrades = existingUpgrade 
      ? company.upgrades.map(u => u.id === upgradeId ? { ...u, level: u.level + 1 } : u)
      : [...company.upgrades, { id: upgradeId, level: 1, maxLevel: upgradeDefinition.maxLevel }];

    // Calculate new base weekly income with all upgrade bonuses
    let totalBonus = 0;
    updatedUpgrades.forEach(upgrade => {
      const upgradeDef = availableUpgrades.find(u => u.id === upgrade.id);
      if (upgradeDef) {
        totalBonus += upgradeDef.weeklyIncomeBonus * upgrade.level;
      }
    });

    const updated: Company = {
      ...company,
      baseWeeklyIncome: company.baseWeeklyIncome + bonus,
      weeklyIncome: Math.round(
        (company.baseWeeklyIncome + bonus) *
          Math.pow(company.workerMultiplier, company.employees)
      ),
      upgrades: updatedUpgrades as CompanyUpgrade[],
    };
    companies[companyIndex] = updated;

    return {
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - cost },
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });
}

export function addWorker(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId?: string
): void {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) return;

  const companyIndex = gameState.companies.findIndex(c => c.id === targetId);
  if (companyIndex === -1) return;

  setGameState(prev => {
    const companies = [...prev.companies];
    const company = companies[companyIndex];
    const { workerSalary, employees, baseWeeklyIncome, workerMultiplier } =
      company;
    if (employees >= 10 || prev.stats.money < workerSalary) return prev;

    const updated: Company = {
      ...company,
      employees: company.employees + 1,
      weeklyIncome: Math.round(
        baseWeeklyIncome * Math.pow(workerMultiplier, company.employees + 1)
      ),
    };
    companies[companyIndex] = updated;

    return {
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - workerSalary },
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });
}

export function removeWorker(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId?: string
): void {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) return;

  const companyIndex = gameState.companies.findIndex(c => c.id === targetId);
  if (companyIndex === -1) return;

  setGameState(prev => {
    const companies = [...prev.companies];
    const company = companies[companyIndex];
    if (company.employees <= 0) return prev;

    const updated: Company = {
      ...company,
      employees: company.employees - 1,
      weeklyIncome: Math.round(
        company.baseWeeklyIncome *
          Math.pow(company.workerMultiplier, company.employees - 1)
      ),
    };
    companies[companyIndex] = updated;

    return {
      ...prev,
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });
}


export function sellCompany(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId: string
): { success: boolean; message?: string; sellValue?: number } {
  const companyIndex = gameState.companies.findIndex(c => c.id === companyId);
  if (companyIndex === -1) {
    return { success: false, message: 'Company not found' };
  }

  const company = gameState.companies[companyIndex];
  
  // Calculate total investment (company cost + all upgrade costs)
  const companyCosts = {
    factory: 50000,
    ai: 90000,
    restaurant: 130000,
    realestate: 200000,
    bank: 2000000,
  } as const;

  const baseCompanyCost = companyCosts[company.type as keyof typeof companyCosts] || 0;
  const inflatedCompanyCost = getInflatedPrice(baseCompanyCost, gameState.economy.priceIndex);
  
  // Calculate total upgrade costs using the same upgrade definitions as the upgrade system
  const companyUpgrades: Record<string, any[]> = {
    factory: [
      { id: 'machinery', cost: 10000, maxLevel: 5, costMultiplier: 1.5 },
      { id: 'workers', cost: 15000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'automation', cost: 25000, maxLevel: 4, costMultiplier: 1.5 },
      { id: 'quality_control', cost: 20000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'warehouse', cost: 30000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'safety', cost: 18000, maxLevel: 4, costMultiplier: 1.5 },
    ],
    ai: [
      { id: 'servers', cost: 25000, maxLevel: 4, costMultiplier: 1.5 },
      { id: 'algorithms', cost: 30000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'gpu_cluster', cost: 50000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'data_center', cost: 75000, maxLevel: 2, costMultiplier: 1.5 },
      { id: 'ai_researchers', cost: 40000, maxLevel: 4, costMultiplier: 1.5 },
      { id: 'machine_learning', cost: 60000, maxLevel: 3, costMultiplier: 1.5 },
    ],
    restaurant: [
      { id: 'kitchen', cost: 20000, maxLevel: 4, costMultiplier: 1.5 },
      { id: 'staff', cost: 18000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'delivery_service', cost: 25000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'michelin_chef', cost: 40000, maxLevel: 2, costMultiplier: 1.5 },
      { id: 'interior_design', cost: 30000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'wine_cellar', cost: 35000, maxLevel: 2, costMultiplier: 1.5 },
    ],
    realestate: [
      { id: 'properties', cost: 50000, maxLevel: 5, costMultiplier: 1.5 },
      { id: 'management', cost: 30000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'property_portfolio', cost: 75000, maxLevel: 4, costMultiplier: 1.5 },
      { id: 'commercial_real_estate', cost: 100000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'property_management', cost: 40000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'luxury_developments', cost: 150000, maxLevel: 2, costMultiplier: 1.5 },
    ],
    bank: [
      { id: 'technology', cost: 100000, maxLevel: 4, costMultiplier: 1.5 },
      { id: 'services', cost: 80000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'investment_division', cost: 200000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'international_banking', cost: 300000, maxLevel: 2, costMultiplier: 1.5 },
      { id: 'fintech_integration', cost: 150000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'private_banking', cost: 250000, maxLevel: 2, costMultiplier: 1.5 },
    ],
  };
  
  let totalUpgradeCost = 0;
  company.upgrades.forEach(upgrade => {
    const availableUpgrades = companyUpgrades[company.type] || [];
    const upgradeDef = availableUpgrades.find(u => u.id === upgrade.id);
    if (upgradeDef) {
      // Calculate cost for each level purchased
      for (let level = 1; level <= upgrade.level; level++) {
        const levelCost = level === 1 
          ? upgradeDef.cost 
          : Math.round(upgradeDef.cost * Math.pow(upgradeDef.costMultiplier, level - 1));
        totalUpgradeCost += getInflatedPrice(levelCost, gameState.economy.priceIndex);
      }
    }
  });

  const totalInvestment = inflatedCompanyCost + totalUpgradeCost;
  const sellValue = Math.round(totalInvestment * 0.5); // 50% of total investment

  setGameState(prev => {
    const companies = prev.companies.filter(c => c.id !== companyId);
    return {
      ...prev,
      companies,
      company: prev.company?.id === companyId ? undefined : prev.company,
      stats: { ...prev.stats, money: prev.stats.money + sellValue },
    };
  });

  return { success: true, sellValue };
}

export function selectMiningCrypto(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  cryptoId: string,
  companyId?: string
): void {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) return;

  const companyIndex = gameState.companies.findIndex(c => c.id === targetId);
  if (companyIndex === -1) return;
  const company = gameState.companies[companyIndex];

  setGameState(prev => {
    const companies = [...prev.companies];
    const updated: Company = { ...company, selectedCrypto: cryptoId };
    companies[companyIndex] = updated;
    return {
      ...prev,
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });
}

export function buyMiner(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  minerId: string,
  minerName: string,
  cost: number,
  companyId?: string
): { success: boolean; message?: string } {
  if (!gameState.warehouse) {
    return { success: false, message: 'You need a warehouse to buy miners' };
  }
  
  if (gameState.stats.money < cost) {
    return { success: false, message: 'Not enough money' };
  }
  
  // Check warehouse capacity
  const currentMiners = Object.values(gameState.warehouse.miners).reduce((sum, count) => sum + count, 0);
  const maxCapacity = 10 + (gameState.warehouse.level - 1) * 5; // Level 1 = 10 slots, Level 2 = 15 slots, etc.
  
  if (currentMiners >= maxCapacity) {
    return { success: false, message: 'Warehouse is full! Upgrade your warehouse to store more miners.' };
  }
  
  setGameState(prev => ({
    ...prev,
    warehouse: prev.warehouse ? {
      ...prev.warehouse,
      miners: {
        ...prev.warehouse.miners,
        [minerId]: (prev.warehouse.miners[minerId] || 0) + 1,
      },
    } : undefined,
    stats: {
      ...prev.stats,
      money: prev.stats.money - cost,
    },
  }));
  
  return { success: true, message: `Successfully purchased ${minerName}!` };
}
