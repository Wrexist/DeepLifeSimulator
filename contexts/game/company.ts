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
  updateStats: (stats: Partial<GameStats>) => void,
  companyType: string
): { success: boolean; message?: string; companyId?: string } {
  const companyCosts = {
    factory: 25000,
    ai: 45000,
    restaurant: 65000,
    realestate: 100000,
    bank: 1000000,
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
        cost: 5000,
        weeklyIncomeBonus: 420,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'automation',
        name: 'Automation System',
        description: 'Reduce labor costs',
        cost: 15000,
        weeklyIncomeBonus: 1260,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'quality_control',
        name: 'Quality Control',
        description: 'Improve product quality',
        cost: 8000,
        weeklyIncomeBonus: 630,
        level: 0,
        maxLevel: 25,
      },
    ],
    ai: [
      {
        id: 'gpu_cluster',
        name: 'GPU Cluster',
        description: 'Faster AI training',
        cost: 20000,
        weeklyIncomeBonus: 2100,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'data_center',
        name: 'Data Center',
        description: 'Scale operations',
        cost: 50000,
        weeklyIncomeBonus: 4200,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'ai_researchers',
        name: 'AI Researchers',
        description: 'Cutting-edge research',
        cost: 30000,
        weeklyIncomeBonus: 2940,
        level: 0,
        maxLevel: 25,
      },
    ],
    restaurant: [
      {
        id: 'kitchen_upgrade',
        name: 'Kitchen Upgrade',
        description: 'Faster food preparation',
        cost: 10000,
        weeklyIncomeBonus: 840,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'delivery_service',
        name: 'Delivery Service',
        description: 'Expand customer reach',
        cost: 15000,
        weeklyIncomeBonus: 1680,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'michelin_chef',
        name: 'Michelin Chef',
        description: 'Premium dining experience',
        cost: 25000,
        weeklyIncomeBonus: 2520,
        level: 0,
        maxLevel: 25,
      },
    ],
    realestate: [
      {
        id: 'property_portfolio',
        name: 'Property Portfolio',
        description: 'More rental properties',
        cost: 50000,
        weeklyIncomeBonus: 3360,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'commercial_real_estate',
        name: 'Commercial Properties',
        description: 'Higher value investments',
        cost: 100000,
        weeklyIncomeBonus: 6300,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'property_management',
        name: 'Property Management',
        description: 'Professional management',
        cost: 30000,
        weeklyIncomeBonus: 2100,
        level: 0,
        maxLevel: 25,
      },
    ],
    bank: [
      {
        id: 'investment_division',
        name: 'Investment Division',
        description: 'Wealth management services',
        cost: 200000,
        weeklyIncomeBonus: 12600,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'international_banking',
        name: 'International Banking',
        description: 'Global operations',
        cost: 500000,
        weeklyIncomeBonus: 21000,
        level: 0,
        maxLevel: 25,
      },
      {
        id: 'fintech_integration',
        name: 'FinTech Integration',
        description: 'Digital banking solutions',
        cost: 300000,
        weeklyIncomeBonus: 16800,
        level: 0,
        maxLevel: 25,
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
    weeklyIncome: 700,
    baseWeeklyIncome: 700,
    upgrades: companyUpgrades[companyType] || [],
    employees: 0,
    workerSalary: workerConfig.salary,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
  };

  setGameState(prev => ({
    ...prev,
    companies: [...prev.companies, newCompany],
    company: prev.company ?? newCompany,
  }));
  updateStats({ money: gameState.stats.money - cost });
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

  // Define all available upgrades with their properties (sorted by cost)
  const allUpgrades = [
    { id: 'marketing', cost: 1000, weeklyIncomeBonus: 100, maxLevel: 3, costMultiplier: 1.5 },
    { id: 'automation', cost: 2000, weeklyIncomeBonus: 200, maxLevel: 2, costMultiplier: 2.0 },
    { id: 'assembly_line', cost: 3000, weeklyIncomeBonus: 300, maxLevel: 5, costMultiplier: 1.3 },
    { id: 'quality_control', cost: 4000, weeklyIncomeBonus: 400, maxLevel: 3, costMultiplier: 1.4 },
    { id: 'expansion', cost: 5000, weeklyIncomeBonus: 500, maxLevel: 1, costMultiplier: 1.0 },
    { id: 'machine_learning', cost: 5000, weeklyIncomeBonus: 500, maxLevel: 4, costMultiplier: 1.6 },
    { id: 'warehouse', cost: 6000, weeklyIncomeBonus: 600, maxLevel: 2, costMultiplier: 1.8 },
    { id: 'cybersecurity', cost: 7000, weeklyIncomeBonus: 700, maxLevel: 2, costMultiplier: 1.9 },
    { id: 'cloud_infrastructure', cost: 8000, weeklyIncomeBonus: 800, maxLevel: 3, costMultiplier: 1.7 },
    { id: 'supply_chain', cost: 9000, weeklyIncomeBonus: 900, maxLevel: 2, costMultiplier: 2.1 },
    { id: 'market_expansion', cost: 10000, weeklyIncomeBonus: 1000, maxLevel: 2, costMultiplier: 2.2 },
    { id: 'research_development', cost: 12000, weeklyIncomeBonus: 1200, maxLevel: 3, costMultiplier: 1.8 },
    { id: 'data_analytics', cost: 13000, weeklyIncomeBonus: 1300, maxLevel: 3, costMultiplier: 1.9 },
    { id: 'robotics', cost: 15000, weeklyIncomeBonus: 1500, maxLevel: 1, costMultiplier: 1.0 },
    { id: 'digital_transformation', cost: 15000, weeklyIncomeBonus: 1500, maxLevel: 2, costMultiplier: 2.0 },
    { id: 'customer_service', cost: 2500, weeklyIncomeBonus: 250, maxLevel: 4, costMultiplier: 1.4 },
    { id: 'brand_recognition', cost: 3500, weeklyIncomeBonus: 350, maxLevel: 3, costMultiplier: 1.6 },
    { id: 'efficiency_optimization', cost: 4500, weeklyIncomeBonus: 450, maxLevel: 3, costMultiplier: 1.5 },
    { id: 'product_innovation', cost: 8000, weeklyIncomeBonus: 800, maxLevel: 3, costMultiplier: 1.7 },
    { id: 'operational_excellence', cost: 6000, weeklyIncomeBonus: 600, maxLevel: 3, costMultiplier: 1.6 },
    { id: 'sustainability_initiative', cost: 7000, weeklyIncomeBonus: 700, maxLevel: 3, costMultiplier: 1.8 },
    { id: 'talent_development', cost: 5000, weeklyIncomeBonus: 500, maxLevel: 4, costMultiplier: 1.5 },
    { id: 'risk_management', cost: 9000, weeklyIncomeBonus: 900, maxLevel: 2, costMultiplier: 2.1 },
    { id: 'compliance_system', cost: 11000, weeklyIncomeBonus: 1100, maxLevel: 2, costMultiplier: 2.3 },
  ];

  const upgradeDefinition = allUpgrades.find(u => u.id === upgradeId);
  if (!upgradeDefinition) return;

  setGameState(prev => {
    const companies = [...prev.companies];
    const company = companies[companyIndex];
    
    // Find existing upgrade or create new one
    let existingUpgrade = company.upgrades.find(u => u.id === upgradeId);
    const currentLevel = existingUpgrade?.level || 0;
    
    if (currentLevel >= upgradeDefinition.maxLevel) return prev;

    // Calculate cost based on current level
    const nextLevelCost = currentLevel === 0 
      ? upgradeDefinition.cost 
      : Math.round(upgradeDefinition.cost * Math.pow(upgradeDefinition.costMultiplier, currentLevel));
    
    const cost = getInflatedPrice(nextLevelCost, prev.economy.priceIndex);
    if (prev.stats.money < cost) return prev;

    // Calculate bonus for this level
    const bonus = upgradeDefinition.weeklyIncomeBonus;

    // Update or add the upgrade
    const updatedUpgrades = existingUpgrade 
      ? company.upgrades.map(u => u.id === upgradeId ? { ...u, level: u.level + 1 } : u)
      : [...company.upgrades, { id: upgradeId, level: 1, maxLevel: upgradeDefinition.maxLevel }];

    const updated: Company = {
      ...company,
      baseWeeklyIncome: company.baseWeeklyIncome + bonus,
      weeklyIncome: Math.round(
        (company.baseWeeklyIncome + bonus) *
          Math.pow(company.workerMultiplier, company.employees)
      ),
      upgrades: updatedUpgrades,
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

export function buyMiner(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  updateStats: (stats: Partial<GameStats>) => void,
  minerId: string,
  companyId?: string
): void {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) return;

  const companyIndex = gameState.companies.findIndex(c => c.id === targetId);
  if (companyIndex === -1) return;
  const company = gameState.companies[companyIndex];

  const minerPrices = {
    basic: 500,
    advanced: 2000,
    pro: 8000,
    industrial: 25000,
    quantum: 100000,
  } as const;

  const basePrice = minerPrices[minerId as keyof typeof minerPrices];
  const price = getInflatedPrice(basePrice, gameState.economy.priceIndex);
  if (!basePrice || gameState.stats.money < price) return;

  setGameState(prev => {
    const companies = [...prev.companies];
    const updated: Company = {
      ...company,
      miners: {
        ...company.miners,
        [minerId]: (company.miners[minerId] || 0) + 1,
      },
    };
    companies[companyIndex] = updated;
    return {
      ...prev,
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });

  updateStats({ money: gameState.stats.money - price });
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
    factory: 25000,
    ai: 45000,
    restaurant: 65000,
    realestate: 100000,
    bank: 1000000,
  } as const;

  const baseCompanyCost = companyCosts[company.type as keyof typeof companyCosts] || 0;
  const inflatedCompanyCost = getInflatedPrice(baseCompanyCost, gameState.economy.priceIndex);
  
  // Calculate total upgrade costs
  let totalUpgradeCost = 0;
  company.upgrades.forEach(upgrade => {
    // Find upgrade definition to get base cost
    const allUpgrades = [
      { id: 'marketing', cost: 1000, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'automation', cost: 2000, maxLevel: 2, costMultiplier: 2.0 },
      { id: 'assembly_line', cost: 3000, maxLevel: 5, costMultiplier: 1.3 },
      { id: 'quality_control', cost: 4000, maxLevel: 3, costMultiplier: 1.4 },
      { id: 'expansion', cost: 5000, maxLevel: 1, costMultiplier: 1.0 },
      { id: 'machine_learning', cost: 5000, maxLevel: 4, costMultiplier: 1.6 },
      { id: 'warehouse', cost: 6000, maxLevel: 2, costMultiplier: 1.8 },
      { id: 'cybersecurity', cost: 7000, maxLevel: 2, costMultiplier: 1.9 },
      { id: 'cloud_infrastructure', cost: 8000, maxLevel: 3, costMultiplier: 1.7 },
      { id: 'supply_chain', cost: 9000, maxLevel: 2, costMultiplier: 2.1 },
      { id: 'market_expansion', cost: 10000, maxLevel: 2, costMultiplier: 2.2 },
      { id: 'research_development', cost: 12000, maxLevel: 3, costMultiplier: 1.8 },
      { id: 'data_analytics', cost: 13000, maxLevel: 3, costMultiplier: 1.9 },
      { id: 'robotics', cost: 15000, maxLevel: 1, costMultiplier: 1.0 },
      { id: 'digital_transformation', cost: 15000, maxLevel: 2, costMultiplier: 2.0 },
      { id: 'customer_service', cost: 2500, maxLevel: 4, costMultiplier: 1.4 },
      { id: 'brand_recognition', cost: 3500, maxLevel: 3, costMultiplier: 1.6 },
      { id: 'efficiency_optimization', cost: 4500, maxLevel: 3, costMultiplier: 1.5 },
      { id: 'product_innovation', cost: 8000, maxLevel: 3, costMultiplier: 1.7 },
      { id: 'operational_excellence', cost: 6000, maxLevel: 3, costMultiplier: 1.6 },
      { id: 'sustainability_initiative', cost: 7000, maxLevel: 3, costMultiplier: 1.8 },
      { id: 'talent_development', cost: 5000, maxLevel: 4, costMultiplier: 1.5 },
      { id: 'risk_management', cost: 9000, maxLevel: 2, costMultiplier: 2.1 },
      { id: 'compliance_system', cost: 11000, maxLevel: 2, costMultiplier: 2.3 },
    ];
    
    const upgradeDef = allUpgrades.find(u => u.id === upgrade.id);
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
      company: prev.company?.id === companyId ? null : prev.company,
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
