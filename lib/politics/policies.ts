/**
 * Policy System
 * 
 * Policies that can be enacted by political officials
 * Each policy affects game state and approval ratings
 */

export type PolicyType = 'economic' | 'social' | 'environmental' | 'criminal' | 'stock' | 'realestate' | 'education' | 'crypto' | 'technology' | 'healthcare' | 'transportation';

export interface Policy {
  id: string;
  name: string;
  description: string;
  type: PolicyType;
  approvalImpact: number; // -100 to +100
  implementationCost: number;
  requiredLevel: number; // Political career level required (0-5)
  effects: {
    money?: number; // Weekly income change
    happiness?: number; // Happiness change
    health?: number; // Health change
    reputation?: number; // Reputation change
    economy?: {
      inflationRate?: number; // Change to inflation rate
      priceIndex?: number; // Change to price index
    };
    stocks?: {
      volatilityModifier?: number; // Multiplier for stock volatility (0.5-2.0)
      dividendBonus?: number; // Bonus to dividend yields
      companyBoost?: string[]; // Specific stock symbols to boost
    };
    realEstate?: {
      priceModifier?: number; // Multiplier for property prices (0.8-1.2)
      rentModifier?: number; // Multiplier for rental income
      propertyTaxRate?: number; // Change to property tax
    };
    education?: {
      weeksReduction?: number; // Reduce education duration by X weeks
      costReduction?: number; // Percentage reduction (0-50%)
      scholarshipAmount?: number; // Direct scholarship funding
    };
    crypto?: {
      miningBonus?: number; // Percentage bonus to mining rates
      priceStability?: number; // Reduce crypto volatility
      regulationLevel?: number; // Affect crypto market
    };
    technology?: {
      rdBonus?: number; // R&D lab efficiency bonus
      patentBonus?: number; // Patent success rate bonus
      innovationGrants?: number; // Direct funding
    };
    healthcare?: {
      healthBonus?: number; // Weekly health gain
      medicalCostReduction?: number; // Reduce medical expenses
    };
    transportation?: {
      travelCostReduction?: number; // Reduce travel costs
      commuteTimeReduction?: number; // Reduce time/energy for travel
    };
  };
  duration?: number; // Weeks the policy is active (undefined = permanent)
}

export const POLICIES: Policy[] = [
  // Level 0 Policies (Available immediately)
  {
    id: 'community_garden',
    name: 'Community Garden Initiative',
    description: 'Create community gardens in neighborhoods',
    type: 'social',
    approvalImpact: 10,
    implementationCost: 2000,
    requiredLevel: 0,
    effects: {
      happiness: 5,
      reputation: 3,
    },
  },
  {
    id: 'local_festival',
    name: 'Local Festival Funding',
    description: 'Fund annual local festivals and events',
    type: 'social',
    approvalImpact: 12,
    implementationCost: 5000,
    requiredLevel: 0,
    effects: {
      happiness: 8,
      reputation: 5,
    },
  },
  {
    id: 'park_cleanup',
    name: 'Park Cleanup Program',
    description: 'Organize regular park cleanup events',
    type: 'environmental',
    approvalImpact: 8,
    implementationCost: 1000,
    requiredLevel: 0,
    effects: {
      happiness: 3,
      health: 2,
      reputation: 3,
    },
  },
  {
    id: 'neighborhood_watch',
    name: 'Neighborhood Watch Program',
    description: 'Establish neighborhood watch groups',
    type: 'criminal',
    approvalImpact: 10,
    implementationCost: 3000,
    requiredLevel: 0,
    effects: {
      happiness: 5,
      reputation: 4,
    },
  },
  {
    id: 'small_business_grants',
    name: 'Small Business Grants',
    description: 'Provide grants to local small businesses',
    type: 'economic',
    approvalImpact: 12,
    implementationCost: 15000,
    requiredLevel: 0,
    effects: {
      money: 30,
      reputation: 5,
    },
  },
  
  // Economic Policies
  {
    id: 'tax_cut',
    name: 'Tax Cut',
    description: 'Reduce taxes to stimulate economic growth',
    type: 'economic',
    approvalImpact: 15,
    implementationCost: 0,
    requiredLevel: 1, // Council Member
    effects: {
      money: 50, // Weekly income bonus
      happiness: 5,
    },
  },
  {
    id: 'tax_increase',
    name: 'Tax Increase',
    description: 'Increase taxes to fund public services',
    type: 'economic',
    approvalImpact: -20,
    implementationCost: 0,
    requiredLevel: 1,
    effects: {
      money: -30, // Weekly income reduction
      happiness: -10,
      health: 5, // Better public health services
    },
  },
  {
    id: 'business_subsidy',
    name: 'Business Subsidy',
    description: 'Provide subsidies to local businesses',
    type: 'economic',
    approvalImpact: 10,
    implementationCost: 5000,
    requiredLevel: 2, // Mayor
    effects: {
      money: 100, // Weekly income bonus from business growth
      reputation: 5,
    },
  },
  {
    id: 'infrastructure_investment',
    name: 'Infrastructure Investment',
    description: 'Invest in roads, bridges, and public facilities',
    type: 'economic',
    approvalImpact: 25,
    implementationCost: 50000,
    requiredLevel: 2,
    effects: {
      happiness: 10,
      reputation: 10,
      economy: {
        priceIndex: -0.05, // Slight deflation from efficiency
      },
    },
  },
  {
    id: 'universal_basic_income',
    name: 'Universal Basic Income',
    description: 'Provide basic income to all citizens',
    type: 'economic',
    approvalImpact: 30,
    implementationCost: 200000,
    requiredLevel: 3, // State Representative
    effects: {
      money: 200, // Weekly UBI payment
      happiness: 15,
      economy: {
        inflationRate: 0.02, // Slight inflation increase
      },
    },
  },
  
  // Social Policies
  {
    id: 'education_funding',
    name: 'Education Funding Increase',
    description: 'Increase funding for public education',
    type: 'social',
    approvalImpact: 20,
    implementationCost: 10000,
    requiredLevel: 1,
    effects: {
      happiness: 8,
      reputation: 8,
    },
  },
  {
    id: 'healthcare_expansion',
    name: 'Healthcare Expansion',
    description: 'Expand access to healthcare services',
    type: 'social',
    approvalImpact: 25,
    implementationCost: 25000,
    requiredLevel: 2,
    effects: {
      health: 10,
      happiness: 10,
      reputation: 10,
    },
  },
  {
    id: 'housing_assistance',
    name: 'Housing Assistance Program',
    description: 'Provide assistance for affordable housing',
    type: 'social',
    approvalImpact: 20,
    implementationCost: 30000,
    requiredLevel: 2,
    effects: {
      happiness: 12,
      money: 50, // Reduced housing costs
    },
  },
  {
    id: 'social_security_boost',
    name: 'Social Security Boost',
    description: 'Increase social security benefits',
    type: 'social',
    approvalImpact: 15,
    implementationCost: 100000,
    requiredLevel: 3,
    effects: {
      money: 150, // Weekly benefit increase
      happiness: 10,
    },
  },
  
  // Environmental Policies
  {
    id: 'green_energy',
    name: 'Green Energy Initiative',
    description: 'Promote renewable energy sources',
    type: 'environmental',
    approvalImpact: 15,
    implementationCost: 50000,
    requiredLevel: 2,
    effects: {
      health: 5,
      happiness: 8,
      reputation: 10,
    },
  },
  {
    id: 'carbon_tax',
    name: 'Carbon Tax',
    description: 'Tax carbon emissions to reduce pollution',
    type: 'environmental',
    approvalImpact: -10,
    implementationCost: 0,
    requiredLevel: 3,
    effects: {
      money: -20, // Higher costs
      health: 8, // Better air quality
      happiness: -5,
    },
  },
  {
    id: 'public_transport',
    name: 'Public Transport Expansion',
    description: 'Expand public transportation network',
    type: 'environmental',
    approvalImpact: 20,
    implementationCost: 75000,
    requiredLevel: 2,
    effects: {
      happiness: 10,
      health: 5,
      money: 30, // Reduced transportation costs
    },
  },
  
  // Criminal Policies
  {
    id: 'police_funding',
    name: 'Police Funding Increase',
    description: 'Increase funding for law enforcement',
    type: 'criminal',
    approvalImpact: 10,
    implementationCost: 20000,
    requiredLevel: 1,
    effects: {
      happiness: 5,
      reputation: 5,
    },
  },
  {
    id: 'prison_reform',
    name: 'Prison Reform',
    description: 'Reform the prison system for rehabilitation',
    type: 'criminal',
    approvalImpact: 15,
    implementationCost: 40000,
    requiredLevel: 2,
    effects: {
      happiness: 10,
      reputation: 8,
    },
  },
  {
    id: 'drug_decriminalization',
    name: 'Drug Decriminalization',
    description: 'Decriminalize certain drugs',
    type: 'criminal',
    approvalImpact: -15,
    implementationCost: 0,
    requiredLevel: 3,
    effects: {
      happiness: 5,
      reputation: -10,
    },
  },
  
  // More Economic Policies
  {
    id: 'minimum_wage_increase',
    name: 'Minimum Wage Increase',
    description: 'Raise the minimum wage',
    type: 'economic',
    approvalImpact: 20,
    implementationCost: 0,
    requiredLevel: 2,
    effects: {
      money: 40,
      happiness: 8,
    },
  },
  {
    id: 'unemployment_benefits',
    name: 'Unemployment Benefits Expansion',
    description: 'Expand unemployment benefits',
    type: 'economic',
    approvalImpact: 18,
    implementationCost: 80000,
    requiredLevel: 2,
    effects: {
      money: 60,
      happiness: 10,
    },
  },
  {
    id: 'corporate_tax_break',
    name: 'Corporate Tax Break',
    description: 'Provide tax breaks to corporations',
    type: 'economic',
    approvalImpact: -10,
    implementationCost: 0,
    requiredLevel: 2,
    effects: {
      money: 80,
      happiness: -5,
      reputation: -5,
    },
  },
  {
    id: 'free_trade_agreement',
    name: 'Free Trade Agreement',
    description: 'Sign free trade agreements',
    type: 'economic',
    approvalImpact: 5,
    implementationCost: 0,
    requiredLevel: 3,
    effects: {
      money: 100,
      happiness: 3,
    },
  },
  {
    id: 'economic_stimulus',
    name: 'Economic Stimulus Package',
    description: 'Large economic stimulus to boost economy',
    type: 'economic',
    approvalImpact: 25,
    implementationCost: 300000,
    requiredLevel: 4,
    effects: {
      money: 200,
      happiness: 15,
      economy: {
        inflationRate: 0.03,
      },
    },
  },
  
  // More Social Policies
  {
    id: 'childcare_subsidy',
    name: 'Childcare Subsidy Program',
    description: 'Subsidize childcare costs for families',
    type: 'social',
    approvalImpact: 22,
    implementationCost: 60000,
    requiredLevel: 2,
    effects: {
      money: 50,
      happiness: 12,
      reputation: 8,
    },
  },
  {
    id: 'elderly_care',
    name: 'Elderly Care Program',
    description: 'Expand care services for elderly',
    type: 'social',
    approvalImpact: 20,
    implementationCost: 70000,
    requiredLevel: 2,
    effects: {
      health: 8,
      happiness: 10,
      reputation: 10,
    },
  },
  {
    id: 'mental_health_funding',
    name: 'Mental Health Funding',
    description: 'Increase funding for mental health services',
    type: 'social',
    approvalImpact: 18,
    implementationCost: 40000,
    requiredLevel: 2,
    effects: {
      health: 10,
      happiness: 12,
      reputation: 8,
    },
  },
  {
    id: 'public_libraries',
    name: 'Public Library Expansion',
    description: 'Expand public library services',
    type: 'social',
    approvalImpact: 15,
    implementationCost: 35000,
    requiredLevel: 1,
    effects: {
      happiness: 8,
      reputation: 8,
    },
  },
  {
    id: 'youth_programs',
    name: 'Youth Programs Funding',
    description: 'Fund after-school and youth programs',
    type: 'social',
    approvalImpact: 16,
    implementationCost: 25000,
    requiredLevel: 1,
    effects: {
      happiness: 10,
      reputation: 7,
    },
  },
  {
    id: 'disability_support',
    name: 'Disability Support Services',
    description: 'Expand support for disabled citizens',
    type: 'social',
    approvalImpact: 20,
    implementationCost: 50000,
    requiredLevel: 2,
    effects: {
      happiness: 12,
      reputation: 10,
    },
  },
  {
    id: 'immigration_reform',
    name: 'Immigration Reform',
    description: 'Reform immigration policies',
    type: 'social',
    approvalImpact: -10,
    implementationCost: 0,
    requiredLevel: 3,
    effects: {
      money: 30,
      happiness: -5,
      reputation: -8,
    },
  },
  {
    id: 'marriage_equality',
    name: 'Marriage Equality',
    description: 'Legalize same-sex marriage',
    type: 'social',
    approvalImpact: 15,
    implementationCost: 0,
    requiredLevel: 3,
    effects: {
      happiness: 10,
      reputation: 12,
    },
  },
  
  // More Environmental Policies
  {
    id: 'recycling_program',
    name: 'Recycling Program',
    description: 'Establish comprehensive recycling program',
    type: 'environmental',
    approvalImpact: 12,
    implementationCost: 20000,
    requiredLevel: 1,
    effects: {
      health: 5,
      happiness: 5,
      reputation: 6,
    },
  },
  {
    id: 'tree_planting',
    name: 'Tree Planting Initiative',
    description: 'Plant trees throughout the city',
    type: 'environmental',
    approvalImpact: 10,
    implementationCost: 15000,
    requiredLevel: 1,
    effects: {
      health: 6,
      happiness: 6,
      reputation: 5,
    },
  },
  {
    id: 'water_conservation',
    name: 'Water Conservation Program',
    description: 'Promote water conservation',
    type: 'environmental',
    approvalImpact: 8,
    implementationCost: 10000,
    requiredLevel: 1,
    effects: {
      health: 4,
      money: 20,
      reputation: 4,
    },
  },
  {
    id: 'renewable_energy_subsidy',
    name: 'Renewable Energy Subsidy',
    description: 'Subsidize renewable energy installations',
    type: 'environmental',
    approvalImpact: 18,
    implementationCost: 100000,
    requiredLevel: 3,
    effects: {
      health: 10,
      happiness: 8,
      reputation: 12,
      money: 40,
    },
  },
  {
    id: 'plastic_ban',
    name: 'Plastic Bag Ban',
    description: 'Ban single-use plastic bags',
    type: 'environmental',
    approvalImpact: 12,
    implementationCost: 0,
    requiredLevel: 1,
    effects: {
      health: 5,
      happiness: 3,
      reputation: 8,
    },
  },
  {
    id: 'emissions_regulations',
    name: 'Emissions Regulations',
    description: 'Strict emissions regulations for vehicles',
    type: 'environmental',
    approvalImpact: 15,
    implementationCost: 0,
    requiredLevel: 2,
    effects: {
      health: 12,
      money: -15,
      reputation: 10,
    },
  },
  
  // More Criminal Policies
  {
    id: 'community_policing',
    name: 'Community Policing',
    description: 'Implement community-oriented policing',
    type: 'criminal',
    approvalImpact: 18,
    implementationCost: 30000,
    requiredLevel: 2,
    effects: {
      happiness: 10,
      reputation: 12,
    },
  },
  {
    id: 'gun_control',
    name: 'Gun Control Measures',
    description: 'Implement stricter gun control',
    type: 'criminal',
    approvalImpact: -5,
    implementationCost: 0,
    requiredLevel: 3,
    effects: {
      happiness: 8,
      reputation: 5,
    },
  },
  {
    id: 'rehabilitation_programs',
    name: 'Rehabilitation Programs',
    description: 'Expand rehabilitation programs for offenders',
    type: 'criminal',
    approvalImpact: 12,
    implementationCost: 35000,
    requiredLevel: 2,
    effects: {
      happiness: 8,
      reputation: 10,
    },
  },
  {
    id: 'drug_treatment',
    name: 'Drug Treatment Centers',
    description: 'Open drug treatment and rehabilitation centers',
    type: 'criminal',
    approvalImpact: 15,
    implementationCost: 45000,
    requiredLevel: 2,
    effects: {
      health: 8,
      happiness: 10,
      reputation: 12,
    },
  },
  {
    id: 'surveillance_cameras',
    name: 'Surveillance Camera Network',
    description: 'Install surveillance cameras in public areas',
    type: 'criminal',
    approvalImpact: 8,
    implementationCost: 50000,
    requiredLevel: 2,
    effects: {
      happiness: 3,
      reputation: 5,
    },
  },
  {
    id: 'death_penalty',
    name: 'Death Penalty Reinstatement',
    description: 'Reinstate death penalty',
    type: 'criminal',
    approvalImpact: -20,
    implementationCost: 0,
    requiredLevel: 4,
    effects: {
      happiness: -10,
      reputation: -15,
    },
  },
  
  // High-Level Policies (Level 4-5)
  {
    id: 'national_healthcare',
    name: 'National Healthcare System',
    description: 'Implement universal healthcare',
    type: 'social',
    approvalImpact: 30,
    implementationCost: 500000,
    requiredLevel: 4,
    effects: {
      health: 20,
      happiness: 20,
      money: -50,
      reputation: 15,
    },
  },
  {
    id: 'climate_action_plan',
    name: 'Climate Action Plan',
    description: 'Comprehensive climate change action plan',
    type: 'environmental',
    approvalImpact: 25,
    implementationCost: 400000,
    requiredLevel: 4,
    effects: {
      health: 15,
      happiness: 12,
      reputation: 18,
      economy: {
        inflationRate: 0.02,
      },
    },
  },
  {
    id: 'tax_reform',
    name: 'Major Tax Reform',
    description: 'Comprehensive tax system reform',
    type: 'economic',
    approvalImpact: 10,
    implementationCost: 0,
    requiredLevel: 4,
    effects: {
      money: 150,
      happiness: 8,
      reputation: 5,
    },
  },
  {
    id: 'education_overhaul',
    name: 'Education System Overhaul',
    description: 'Complete overhaul of education system',
    type: 'social',
    approvalImpact: 28,
    implementationCost: 600000,
    requiredLevel: 4,
    effects: {
      happiness: 18,
      reputation: 20,
    },
  },
  {
    id: 'infrastructure_mega_project',
    name: 'Infrastructure Mega Project',
    description: 'Massive infrastructure development project',
    type: 'economic',
    approvalImpact: 30,
    implementationCost: 1000000,
    requiredLevel: 5,
    effects: {
      money: 300,
      happiness: 20,
      reputation: 25,
      economy: {
        priceIndex: -0.1,
      },
    },
  },
  
  // Stock Market Policies
  {
    id: 'market_stability_act',
    name: 'Market Stability Act',
    description: 'Regulate stock market to reduce volatility',
    type: 'stock',
    approvalImpact: 12,
    implementationCost: 0,
    requiredLevel: 2,
    effects: {
      stocks: {
        volatilityModifier: 0.7, // Reduce volatility by 30%
      },
      reputation: 5,
    },
  },
  {
    id: 'tech_company_tax_incentives',
    name: 'Tech Company Tax Incentives',
    description: 'Provide tax breaks to technology companies',
    type: 'stock',
    approvalImpact: 8,
    implementationCost: 0,
    requiredLevel: 2,
    effects: {
      stocks: {
        companyBoost: ['AAPL', 'GOOGL', 'MSFT', 'META', 'NVDA', 'AMZN'],
        dividendBonus: 0.002, // 0.2% bonus to dividends
      },
      money: 40,
      reputation: 3,
    },
  },
  {
    id: 'dividend_tax_exemption',
    name: 'Dividend Tax Exemption',
    description: 'Exempt dividends from taxation',
    type: 'stock',
    approvalImpact: 15,
    implementationCost: 0,
    requiredLevel: 3,
    effects: {
      stocks: {
        dividendBonus: 0.005, // 0.5% bonus to dividend yields
      },
      money: 50,
      reputation: 8,
    },
  },
  {
    id: 'market_crash_prevention_fund',
    name: 'Market Crash Prevention Fund',
    description: 'Establish fund to stabilize markets during crashes',
    type: 'stock',
    approvalImpact: 18,
    implementationCost: 200000,
    requiredLevel: 3,
    effects: {
      stocks: {
        volatilityModifier: 0.6, // Reduce volatility by 40%
      },
      reputation: 10,
    },
  },
  {
    id: 'small_cap_investment_program',
    name: 'Small Cap Investment Program',
    description: 'Encourage investment in small-cap stocks',
    type: 'stock',
    approvalImpact: 10,
    implementationCost: 50000,
    requiredLevel: 2,
    effects: {
      stocks: {
        volatilityModifier: 1.2, // Slight increase for small caps
        dividendBonus: 0.003,
      },
      money: 30,
      reputation: 6,
    },
  },
  {
    id: 'financial_literacy_program',
    name: 'Financial Literacy Program',
    description: 'Educate citizens about investing',
    type: 'stock',
    approvalImpact: 14,
    implementationCost: 30000,
    requiredLevel: 1,
    effects: {
      stocks: {
        dividendBonus: 0.001,
      },
      happiness: 5,
      reputation: 7,
    },
  },
  
  // Real Estate Policies
  {
    id: 'housing_market_stimulus',
    name: 'Housing Market Stimulus',
    description: 'Stimulate housing market with incentives',
    type: 'realestate',
    approvalImpact: 20,
    implementationCost: 150000,
    requiredLevel: 2,
    effects: {
      realEstate: {
        priceModifier: 1.1, // 10% increase in property prices
        rentModifier: 1.05, // 5% increase in rental income
      },
      happiness: 8,
      reputation: 10,
    },
  },
  {
    id: 'rent_control_act',
    name: 'Rent Control Act',
    description: 'Cap rental prices to protect tenants',
    type: 'realestate',
    approvalImpact: 15,
    implementationCost: 0,
    requiredLevel: 2,
    effects: {
      realEstate: {
        rentModifier: 0.85, // 15% reduction in rental income
        priceModifier: 0.9, // 10% reduction in property prices
      },
      happiness: 10,
      money: 40, // Reduced housing costs
      reputation: 8,
    },
  },
  {
    id: 'property_tax_reform',
    name: 'Property Tax Reform',
    description: 'Reform property tax system',
    type: 'realestate',
    approvalImpact: 12,
    implementationCost: 0,
    requiredLevel: 2,
    effects: {
      realEstate: {
        propertyTaxRate: -0.02, // 2% reduction in property tax
      },
      money: 60,
      reputation: 6,
    },
  },
  {
    id: 'affordable_housing_initiative',
    name: 'Affordable Housing Initiative',
    description: 'Build affordable housing units',
    type: 'realestate',
    approvalImpact: 22,
    implementationCost: 200000,
    requiredLevel: 2,
    effects: {
      realEstate: {
        priceModifier: 0.95, // 5% reduction in property prices
      },
      happiness: 12,
      reputation: 12,
    },
  },
  {
    id: 'first_time_buyer_program',
    name: 'First-Time Buyer Program',
    description: 'Assist first-time home buyers',
    type: 'realestate',
    approvalImpact: 18,
    implementationCost: 100000,
    requiredLevel: 2,
    effects: {
      realEstate: {
        priceModifier: 0.92, // 8% reduction for first-time buyers
      },
      happiness: 10,
      reputation: 10,
    },
  },
  
  // Education Policies
  {
    id: 'education_reform_act',
    name: 'Education Reform Act',
    description: 'Reform education system to reduce completion time',
    type: 'education',
    approvalImpact: 25,
    implementationCost: 150000,
    requiredLevel: 2,
    effects: {
      education: {
        weeksReduction: 10, // Reduce all education durations by 10 weeks
        costReduction: 5, // 5% cost reduction
      },
      happiness: 12,
      reputation: 15,
    },
  },
  {
    id: 'universal_scholarship_program',
    name: 'Universal Scholarship Program',
    description: 'Provide scholarships to all students',
    type: 'education',
    approvalImpact: 28,
    implementationCost: 300000,
    requiredLevel: 3,
    effects: {
      education: {
        costReduction: 20, // 20% cost reduction
        scholarshipAmount: 5000, // $5000 scholarship per education
      },
      happiness: 15,
      reputation: 18,
    },
  },
  {
    id: 'student_loan_forgiveness',
    name: 'Student Loan Forgiveness',
    description: 'Forgive student loan debt',
    type: 'education',
    approvalImpact: 30,
    implementationCost: 500000,
    requiredLevel: 4,
    effects: {
      education: {
        costReduction: 30, // 30% cost reduction
      },
      money: 100, // Reduced debt burden
      happiness: 20,
      reputation: 20,
    },
  },
  {
    id: 'accelerated_learning_initiative',
    name: 'Accelerated Learning Initiative',
    description: 'Promote faster learning methods',
    type: 'education',
    approvalImpact: 20,
    implementationCost: 80000,
    requiredLevel: 2,
    effects: {
      education: {
        weeksReduction: 15, // Reduce all education durations by 15 weeks
      },
      happiness: 10,
      reputation: 12,
    },
  },
  {
    id: 'vocational_training_expansion',
    name: 'Vocational Training Expansion',
    description: 'Expand vocational and technical training',
    type: 'education',
    approvalImpact: 16,
    implementationCost: 60000,
    requiredLevel: 1,
    effects: {
      education: {
        weeksReduction: 8,
        costReduction: 10,
      },
      happiness: 8,
      reputation: 10,
    },
  },
  
  // Crypto Policies
  {
    id: 'crypto_regulation_framework',
    name: 'Crypto Regulation Framework',
    description: 'Establish clear regulations for cryptocurrency',
    type: 'crypto',
    approvalImpact: 10,
    implementationCost: 0,
    requiredLevel: 3,
    effects: {
      crypto: {
        priceStability: 0.3, // Reduce volatility by 30%
        regulationLevel: 1,
      },
      reputation: 5,
    },
  },
  {
    id: 'blockchain_innovation_fund',
    name: 'Blockchain Innovation Fund',
    description: 'Fund blockchain and crypto innovation',
    type: 'crypto',
    approvalImpact: 12,
    implementationCost: 100000,
    requiredLevel: 3,
    effects: {
      crypto: {
        miningBonus: 15, // 15% bonus to mining rates
        priceStability: 0.2,
      },
      money: 40,
      reputation: 8,
    },
  },
  {
    id: 'digital_currency_adoption',
    name: 'Digital Currency Adoption',
    description: 'Promote adoption of digital currencies',
    type: 'crypto',
    approvalImpact: 8,
    implementationCost: 50000,
    requiredLevel: 2,
    effects: {
      crypto: {
        miningBonus: 10, // 10% bonus to mining rates
        priceStability: 0.15,
      },
      reputation: 5,
    },
  },
  {
    id: 'mining_tax_incentives',
    name: 'Mining Tax Incentives',
    description: 'Provide tax incentives for crypto mining',
    type: 'crypto',
    approvalImpact: 14,
    implementationCost: 0,
    requiredLevel: 3,
    effects: {
      crypto: {
        miningBonus: 20, // 20% bonus to mining rates
      },
      money: 50,
      reputation: 7,
    },
  },
  
  // Technology Policies
  {
    id: 'rd_tax_credits',
    name: 'R&D Tax Credits',
    description: 'Provide tax credits for research and development',
    type: 'technology',
    approvalImpact: 15,
    implementationCost: 0,
    requiredLevel: 2,
    effects: {
      technology: {
        rdBonus: 20, // 20% bonus to R&D efficiency
        patentBonus: 10, // 10% bonus to patent success rate
      },
      money: 60,
      reputation: 10,
    },
  },
  {
    id: 'innovation_grants_program',
    name: 'Innovation Grants Program',
    description: 'Provide grants to innovative companies',
    type: 'technology',
    approvalImpact: 18,
    implementationCost: 200000,
    requiredLevel: 3,
    effects: {
      technology: {
        innovationGrants: 50000, // $50k grants available
        rdBonus: 25,
        patentBonus: 15,
      },
      reputation: 12,
    },
  },
  {
    id: 'patent_reform_act',
    name: 'Patent Reform Act',
    description: 'Streamline patent application process',
    type: 'technology',
    approvalImpact: 12,
    implementationCost: 0,
    requiredLevel: 2,
    effects: {
      technology: {
        patentBonus: 20, // 20% bonus to patent success rate
      },
      reputation: 8,
    },
  },
  {
    id: 'tech_startup_support',
    name: 'Tech Startup Support',
    description: 'Support technology startups',
    type: 'technology',
    approvalImpact: 16,
    implementationCost: 150000,
    requiredLevel: 2,
    effects: {
      technology: {
        rdBonus: 15,
        innovationGrants: 30000,
      },
      money: 40,
      reputation: 10,
    },
  },
  
  // Healthcare Policies
  {
    id: 'public_health_initiative',
    name: 'Public Health Initiative',
    description: 'Improve public health services',
    type: 'healthcare',
    approvalImpact: 22,
    implementationCost: 120000,
    requiredLevel: 2,
    effects: {
      healthcare: {
        healthBonus: 5, // +5 health per week
        medicalCostReduction: 15, // 15% reduction in medical costs
      },
      happiness: 10,
      reputation: 12,
    },
  },
  {
    id: 'medical_cost_reduction_act',
    name: 'Medical Cost Reduction Act',
    description: 'Reduce medical costs for citizens',
    type: 'healthcare',
    approvalImpact: 25,
    implementationCost: 200000,
    requiredLevel: 3,
    effects: {
      healthcare: {
        medicalCostReduction: 25, // 25% reduction in medical costs
        healthBonus: 3,
      },
      money: 50,
      happiness: 12,
      reputation: 15,
    },
  },
  {
    id: 'wellness_program_funding',
    name: 'Wellness Program Funding',
    description: 'Fund wellness and prevention programs',
    type: 'healthcare',
    approvalImpact: 18,
    implementationCost: 80000,
    requiredLevel: 2,
    effects: {
      healthcare: {
        healthBonus: 4, // +4 health per week
      },
      happiness: 8,
      reputation: 10,
    },
  },
  
  // Transportation Policies
  {
    id: 'public_transit_expansion',
    name: 'Public Transit Expansion',
    description: 'Expand public transportation network',
    type: 'transportation',
    approvalImpact: 20,
    implementationCost: 250000,
    requiredLevel: 2,
    effects: {
      transportation: {
        travelCostReduction: 30, // 30% reduction in travel costs
        commuteTimeReduction: 20, // 20% reduction in commute time/energy
      },
      happiness: 10,
      health: 5,
      reputation: 12,
    },
  },
  {
    id: 'travel_subsidy_program',
    name: 'Travel Subsidy Program',
    description: 'Subsidize travel costs for citizens',
    type: 'transportation',
    approvalImpact: 16,
    implementationCost: 100000,
    requiredLevel: 2,
    effects: {
      transportation: {
        travelCostReduction: 25, // 25% reduction in travel costs
      },
      money: 40,
      happiness: 8,
      reputation: 10,
    },
  },
  {
    id: 'infrastructure_investment_transport',
    name: 'Transportation Infrastructure Investment',
    description: 'Invest in roads, bridges, and transit',
    type: 'transportation',
    approvalImpact: 22,
    implementationCost: 300000,
    requiredLevel: 3,
    effects: {
      transportation: {
        travelCostReduction: 35, // 35% reduction in travel costs
        commuteTimeReduction: 25, // 25% reduction in commute time/energy
      },
      happiness: 12,
      reputation: 15,
    },
  },
];

export function getAvailablePolicies(careerLevel: number): Policy[] {
  return POLICIES.filter(policy => policy.requiredLevel <= careerLevel);
}

export function getPolicyById(id: string): Policy | undefined {
  return POLICIES.find(p => p.id === id);
}

export function calculatePolicyEffects(policies: string[]): {
  money: number;
  happiness: number;
  health: number;
  reputation: number;
  economy: {
    inflationRate: number;
    priceIndex: number;
  };
} {
  const effects = {
    money: 0,
    happiness: 0,
    health: 0,
    reputation: 0,
    economy: {
      inflationRate: 0,
      priceIndex: 0,
    },
  };

  policies.forEach(policyId => {
    const policy = getPolicyById(policyId);
    if (policy) {
      effects.money += policy.effects.money || 0;
      effects.happiness += policy.effects.happiness || 0;
      effects.health += policy.effects.health || 0;
      effects.reputation += policy.effects.reputation || 0;
      if (policy.effects.economy) {
        effects.economy.inflationRate += policy.effects.economy.inflationRate || 0;
        effects.economy.priceIndex += policy.effects.economy.priceIndex || 0;
      }
    }
  });

  return effects;
}

