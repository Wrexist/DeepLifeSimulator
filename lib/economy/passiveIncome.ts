import { GameState } from '@/contexts/GameContext';
import { getStockInfo } from './stockMarket';
import { getUpgradeTier } from '@/lib/realEstate/housing';
import { shouldAutoReinvestDividends } from '@/lib/prestige/applyQOLBonuses';
import { calculateInfluencerIncome } from '@/lib/social/brandPartnerships';
import { getSocialMediaData } from '@/lib/social/socialMedia';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { netWorth } from '@/lib/progress/achievements';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { 
  PROPERTY_THRESHOLD_1, 
  PROPERTY_THRESHOLD_2, 
  PROPERTY_THRESHOLD_3,
  PROPERTY_EFFICIENCY_TIER_1,
  PROPERTY_EFFICIENCY_TIER_2,
  PROPERTY_EFFICIENCY_TIER_3,
  PATENT_THRESHOLD_1,
  PATENT_THRESHOLD_2,
  PATENT_THRESHOLD_3,
  PATENT_EFFICIENCY_TIER_1,
  PATENT_EFFICIENCY_TIER_2,
  PATENT_EFFICIENCY_TIER_3
} from './balanceConstants';

interface PassiveIncomeBreakdown {
  stocks: number;
  realEstate: number;
  socialMedia: number;
  patents: number;
  businessOpportunities: number;
  political: number;
  cryptoMining: number;
  companies: number;
  gamingStreaming: number;
}

export function calcWeeklyPassiveIncome(state: GameState): { total: number; breakdown: PassiveIncomeBreakdown; reinvested?: number } {
  // CRITICAL: Wrap entire function in try-catch to prevent crashes
  try {
    let stocksIncome = 0;
    let reinvestedAmount = 0;
    // BUG FIX: Support both old format (stocksOwned) and new format (stocks.holdings)
    // Old format: { [stockId]: shares }
    // New format: { holdings: [{ symbol, shares, averagePrice, currentPrice }] }
    const oldHoldings = state.stocksOwned || {};
    const newHoldings = state.stocks?.holdings || [];
    const unlockedBonuses = state.prestige?.unlockedBonuses || [];
    const shouldReinvest = shouldAutoReinvestDividends(unlockedBonuses);
    
    // Process new format holdings (preferred) - stocks.holdings array
    for (const holding of newHoldings) {
      if (!holding || !holding.symbol) continue;
      const stockId = holding.symbol.toUpperCase();
      const shares = typeof holding.shares === 'number' && isFinite(holding.shares) && holding.shares >= 0 ? holding.shares : 0;
      if (shares === 0) continue;
      
      const info = getStockInfo(stockId);
      if (!info) continue;
      
      // CRITICAL: Validate all inputs before calculation to prevent NaN/Infinity
      const safePrice = typeof info.price === 'number' && isFinite(info.price) && info.price > 0 ? info.price : 0;
      const safeDividendYield = typeof info.dividendYield === 'number' && isFinite(info.dividendYield) && info.dividendYield >= 0 ? info.dividendYield : 0;
      const safeShares = typeof shares === 'number' && isFinite(shares) && shares >= 0 ? shares : 0;
      
      if (safePrice === 0 || safeShares === 0) continue; // Skip invalid holdings
      
      const annualDividend = safePrice * safeDividendYield * safeShares;
      // Validate result before division
      if (!isFinite(annualDividend) || annualDividend < 0) continue;
      
      const weeklyDividend = Math.round(annualDividend / WEEKS_PER_YEAR);
      if (!isFinite(weeklyDividend) || weeklyDividend < 0) continue;

      if (shouldReinvest) {
        // ECONOMY FIX: Apply 2% transaction cost to auto-reinvest to prevent exponential growth
        const reinvestAmount = weeklyDividend * 0.98; // 2% transaction cost (matches sell fee)
        // CRITICAL: Validate price before division to prevent division by zero
        if (safePrice > 0 && isFinite(reinvestAmount) && reinvestAmount > 0) {
          const sharesToBuy = Math.floor(reinvestAmount / safePrice);
          if (sharesToBuy > 0 && isFinite(sharesToBuy)) {
            const reinvestValue = sharesToBuy * safePrice;
            if (isFinite(reinvestValue) && reinvestValue > 0) {
              reinvestedAmount += reinvestValue;
            } else {
              stocksIncome += weeklyDividend;
            }
            // Note: Actual stock purchase will be handled in GameActionsContext
          } else {
            stocksIncome += weeklyDividend;
          }
        } else {
          stocksIncome += weeklyDividend;
        }
      } else {
        stocksIncome += weeklyDividend;
      }
    }

    // Process old format holdings (legacy support) - stocksOwned object
    for (const [stockId, shares] of Object.entries(oldHoldings)) {
      // Skip if already processed in new format
      const normalizedId = stockId.toUpperCase();
      const alreadyProcessed = newHoldings.some(h => h?.symbol?.toUpperCase() === normalizedId);
      if (alreadyProcessed) continue;

      // BUG FIX (B-6): Use normalizedId (uppercase) — stock keys are uppercase
      const info = getStockInfo(normalizedId);
      if (!info) continue;
      
      // CRITICAL: Validate all inputs before calculation to prevent NaN/Infinity
      const safePrice = typeof info.price === 'number' && isFinite(info.price) && info.price > 0 ? info.price : 0;
      const safeDividendYield = typeof info.dividendYield === 'number' && isFinite(info.dividendYield) && info.dividendYield >= 0 ? info.dividendYield : 0;
      const safeShares = typeof shares === 'number' && isFinite(shares) && shares >= 0 ? shares : 0;
      
      if (safePrice === 0 || safeShares === 0) continue; // Skip invalid holdings
      
      const annualDividend = safePrice * safeDividendYield * safeShares;
      // Validate result before division
      if (!isFinite(annualDividend) || annualDividend < 0) continue;
      
      const weeklyDividend = Math.round(annualDividend / WEEKS_PER_YEAR);
      if (!isFinite(weeklyDividend) || weeklyDividend < 0) continue;

      if (shouldReinvest) {
        // ECONOMY FIX: Apply 2% transaction cost to auto-reinvest to prevent exponential growth
        const reinvestAmount = weeklyDividend * 0.98; // 2% transaction cost (matches sell fee)
        // CRITICAL: Validate price before division to prevent division by zero
        if (safePrice > 0 && isFinite(reinvestAmount) && reinvestAmount > 0) {
          const sharesToBuy = Math.floor(reinvestAmount / safePrice);
          if (sharesToBuy > 0 && isFinite(sharesToBuy)) {
            const reinvestValue = sharesToBuy * safePrice;
            if (isFinite(reinvestValue) && reinvestValue > 0) {
              reinvestedAmount += reinvestValue;
            } else {
              stocksIncome += weeklyDividend;
            }
            // Note: Actual stock purchase will be handled in GameActionsContext
          } else {
            stocksIncome += weeklyDividend;
          }
        } else {
          stocksIncome += weeklyDividend;
        }
      } else {
        stocksIncome += weeklyDividend;
      }
    }

  let realEstateIncome = 0;
  
  // Get political perks for real estate tax breaks
  let realEstateTaxBreak = 0;
  if (state.politics && state.politics.careerLevel > 0) {
    const { getCombinedPerkEffects } = require('@/lib/politics/perks');
    const perkEffects = getCombinedPerkEffects(state.politics.careerLevel);
    realEstateTaxBreak = perkEffects.realEstateTaxBreak || 0;
  }
  
  // Get real estate policy effects
  const realEstatePolicyEffects = state.politics?.activePolicyEffects?.realEstate;
  const rentModifier = realEstatePolicyEffects?.rentModifier ?? 1;
  
  // STABILITY FIX: Apply diminishing returns to real estate income after PROPERTY_THRESHOLD_1 properties
  // Managing many properties becomes harder, not easier (management overhead)
  //
  // SAFETY: This is safe because:
  // - Applied per-property (each property gets same multiplier)
  // - No dependencies on other systems
  // - Constants extracted to balanceConstants.ts for easy tuning
  //
  // ASSUMPTION: Property management overhead scales linearly with count
  // CRITICAL: Validate realEstate array exists before filtering
  const realEstate = Array.isArray(state.realEstate) ? state.realEstate : [];
  const ownedProperties = realEstate.filter(p => p && p.owned);
  const propertyCount = ownedProperties.length;
  
  let propertyEfficiencyMultiplier = 1.0;
  if (propertyCount > PROPERTY_THRESHOLD_3) {
    propertyEfficiencyMultiplier = PROPERTY_EFFICIENCY_TIER_3; // 30% penalty for 21+ properties
  } else if (propertyCount > PROPERTY_THRESHOLD_2) {
    propertyEfficiencyMultiplier = PROPERTY_EFFICIENCY_TIER_2; // 20% penalty for 16-20 properties
  } else if (propertyCount > PROPERTY_THRESHOLD_1) {
    propertyEfficiencyMultiplier = PROPERTY_EFFICIENCY_TIER_1; // 10% penalty for 11-15 properties
  }
  
  // Only process owned properties to avoid errors with unowned properties
  ownedProperties.forEach(property => {
    try {
      if (!property) return; // Skip invalid properties
      
      // CRITICAL: Validate all property values before calculation
      let rent = typeof property.rent === 'number' && isFinite(property.rent) && property.rent >= 0 ? property.rent : 0;
      let upkeep = typeof property.upkeep === 'number' && isFinite(property.upkeep) && property.upkeep >= 0 ? property.upkeep : 0;
      const upgradeLevel = typeof property.upgradeLevel === 'number' && isFinite(property.upgradeLevel) && property.upgradeLevel >= 0 ? property.upgradeLevel : 0;
      
      const tier = getUpgradeTier(upgradeLevel) || getUpgradeTier(0);
      if (!tier) return; // Skip if tier lookup fails
      
      const tierRentBonus = typeof tier.rentBonus === 'number' && isFinite(tier.rentBonus) ? tier.rentBonus : 0;
      const tierUpkeepBonus = typeof tier.upkeepBonus === 'number' && isFinite(tier.upkeepBonus) ? tier.upkeepBonus : 0;
      
      // Apply rent modifier from policies (validate rentModifier)
      const safeRentModifier = typeof rentModifier === 'number' && isFinite(rentModifier) && rentModifier > 0 ? rentModifier : 1;
      rent = Math.round(rent * safeRentModifier);
      if (!isFinite(rent) || rent < 0) rent = 0;
      
      // Apply political tax break to upkeep
      if (realEstateTaxBreak > 0 && isFinite(realEstateTaxBreak)) {
        const upkeepWithBonus = upkeep + tierUpkeepBonus;
        if (isFinite(upkeepWithBonus) && upkeepWithBonus > 0) {
          const upkeepReduction = Math.round(upkeepWithBonus * (realEstateTaxBreak / 100));
          upkeep = Math.max(0, upkeep - upkeepReduction);
        }
      }
      
      const propertyIncome = Math.round(rent + tierRentBonus - (upkeep + tierUpkeepBonus));
      // Validate income before applying multiplier
      if (isFinite(propertyIncome) && propertyIncome > 0) {
        const finalIncome = Math.round(propertyIncome * propertyEfficiencyMultiplier);
        if (isFinite(finalIncome) && finalIncome > 0) {
          realEstateIncome += finalIncome;
        }
      }
    } catch {
      // Skip only the bad property; do not zero all passive income.
    }
  });

  // Hobbies removed - no longer calculating hobby income
  const songsIncome = 0;
  const artIncome = 0;
  const contractsIncome = 0;
  const sponsorsIncome = 0;

  // Company weekly income (base business income)
  let companyIncome = 0;
  const companyCount = (state.companies || []).length;
  
  // ECONOMY FIX: Add diminishing returns across multiple companies
  // Managing multiple companies becomes harder, not easier (management overhead)
  // 1-3 companies: 100% efficiency (no penalty)
  // 4-6 companies: 90% efficiency (10% penalty)
  // 7-10 companies: 80% efficiency (20% penalty)
  // 11+ companies: 70% efficiency (30% penalty)
  let efficiencyMultiplier = 1.0;
  if (companyCount > 10) {
    efficiencyMultiplier = 0.7;
  } else if (companyCount > 6) {
    efficiencyMultiplier = 0.8;
  } else if (companyCount > 3) {
    efficiencyMultiplier = 0.9;
  }
  
  (state.companies || []).forEach(company => {
    if (!company) return; // Skip invalid companies
    
    // CRITICAL: Validate weeklyIncome before calculation
    let weeklyIncome = typeof company.weeklyIncome === 'number' && isFinite(company.weeklyIncome) && company.weeklyIncome >= 0 ? company.weeklyIncome : 0;
    
    // Apply political perks (business income bonus)
    if (state.politics && state.politics.careerLevel > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getCombinedPerkEffects } = require('@/lib/politics/perks');
        const perkEffects = getCombinedPerkEffects(state.politics.careerLevel);
        const businessIncomeBonus = typeof perkEffects?.businessIncomeBonus === 'number' && isFinite(perkEffects.businessIncomeBonus) && perkEffects.businessIncomeBonus > 0 ? perkEffects.businessIncomeBonus : 0;
        if (businessIncomeBonus > 0 && weeklyIncome > 0) {
          const bonus = Math.round(weeklyIncome * (businessIncomeBonus / 100));
          if (isFinite(bonus) && bonus > 0) {
            weeklyIncome += bonus;
          }
        }
      } catch (error) {
        // Skip perk bonus if calculation fails
      }
    }
    
    // Add government contract bonus
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { calculateGovernmentContractBonus } = require('@/lib/politics/governmentContracts');
      const contractBonus = calculateGovernmentContractBonus(state, company.id);
      if (typeof contractBonus === 'number' && isFinite(contractBonus) && contractBonus > 0) {
        weeklyIncome += contractBonus;
      }
    } catch (error) {
      // Skip contract bonus if calculation fails
    }
    
    // CRITICAL: Validate efficiencyMultiplier before applying
    const safeEfficiencyMultiplier = isFinite(efficiencyMultiplier) && efficiencyMultiplier > 0 ? efficiencyMultiplier : 1;
    weeklyIncome = Math.round(weeklyIncome * safeEfficiencyMultiplier);
    
    // Final validation before adding to total
    if (isFinite(weeklyIncome) && weeklyIncome > 0) {
      companyIncome += weeklyIncome;
    }
  });
  // Final validation
  if (!isFinite(companyIncome) || companyIncome < 0) companyIncome = 0;

  // Patent income from R&D
  // STABILITY FIX: Apply diminishing returns to patent income after PATENT_THRESHOLD_1 active patents
  // Too many patents create management overhead and market saturation
  //
  // SAFETY: This is safe because:
  // - Processes all companies and all patents (no missed income)
  // - Multiplier applied uniformly to all patents (fair)
  // - No dependencies on other systems
  // - Constants extracted to balanceConstants.ts for easy tuning
  //
  // ASSUMPTION: Patent management overhead scales linearly with count across ALL companies
  // NOTE: This applies globally (all companies combined), not per-company
  // This means a player with 5 companies and 4 patents each (20 total) gets penalty
  // vs a player with 1 company and 20 patents (same penalty) - intentional design
  let totalActivePatents = 0;
  const allPatents: { weeklyIncome: number }[] = [];
  
  (state.companies || []).forEach(company => {
    if (!company) return; // Skip invalid companies
    if (company.patents && Array.isArray(company.patents) && company.patents.length > 0) {
      company.patents.forEach(patent => {
        if (!patent) return; // Skip invalid patents
        // CRITICAL: Validate duration and weeklyIncome before adding
        const duration = typeof patent.duration === 'number' && isFinite(patent.duration) ? patent.duration : 0;
        const weeklyIncome = typeof patent.weeklyIncome === 'number' && isFinite(patent.weeklyIncome) && patent.weeklyIncome >= 0 ? patent.weeklyIncome : 0;
        if (duration > 0 && weeklyIncome > 0) {
          totalActivePatents++;
          allPatents.push({ weeklyIncome });
        }
      });
    }
  });
  
  // Calculate efficiency multiplier based on total active patents (across ALL companies)
  let patentEfficiencyMultiplier = 1.0;
  if (totalActivePatents > PATENT_THRESHOLD_3) {
    patentEfficiencyMultiplier = PATENT_EFFICIENCY_TIER_3; // 30% penalty for 61+ patents
  } else if (totalActivePatents > PATENT_THRESHOLD_2) {
    patentEfficiencyMultiplier = PATENT_EFFICIENCY_TIER_2; // 20% penalty for 41-60 patents
  } else if (totalActivePatents > PATENT_THRESHOLD_1) {
    patentEfficiencyMultiplier = PATENT_EFFICIENCY_TIER_1; // 10% penalty for 21-40 patents
  }
  
  let patentIncome = 0;
  // CRITICAL: Validate patentEfficiencyMultiplier before applying
  const safePatentEfficiencyMultiplier = isFinite(patentEfficiencyMultiplier) && patentEfficiencyMultiplier > 0 ? patentEfficiencyMultiplier : 1;
  allPatents.forEach(patent => {
    if (!patent) return; // Skip invalid patents
    const weeklyIncome = typeof patent.weeklyIncome === 'number' && isFinite(patent.weeklyIncome) && patent.weeklyIncome >= 0 ? patent.weeklyIncome : 0;
    if (weeklyIncome > 0) {
      const income = Math.round(weeklyIncome * safePatentEfficiencyMultiplier);
      if (isFinite(income) && income > 0) {
        patentIncome += income;
      }
    }
  });
  // Final validation
  if (!isFinite(patentIncome) || patentIncome < 0) patentIncome = 0;

  // Business opportunity income from travel
  let businessOpportunitiesIncome = 0;
  if (state.travel?.businessOpportunities && typeof state.travel.businessOpportunities === 'object') {
    Object.values(state.travel.businessOpportunities).forEach(opp => {
      if (!opp) return; // Skip invalid opportunities
      if (opp.invested && opp.unlocked) {
        const weeklyIncome = typeof opp.weeklyIncome === 'number' && isFinite(opp.weeklyIncome) && opp.weeklyIncome >= 0 ? opp.weeklyIncome : 0;
        if (weeklyIncome > 0) {
          businessOpportunitiesIncome += Math.round(weeklyIncome);
        }
      }
    });
  }
  // Final validation
  if (!isFinite(businessOpportunitiesIncome) || businessOpportunitiesIncome < 0) businessOpportunitiesIncome = 0;

  // Social media influencer income (if player has 10,000+ followers)
  let socialMediaIncome = 0;
  const socialData = getSocialMediaData(state);
  if (socialData.followers >= 10_000) {
    socialMediaIncome = calculateInfluencerIncome(socialData.followers, socialData.engagementRate);
  }
  
  // Active brand deals income (weekly payments from ongoing deals)
  const activeBrandDeals = Array.isArray(state.socialMedia?.activeBrandDeals) ? state.socialMedia.activeBrandDeals : [];
  // ANTI-EXPLOIT: Use weeksLived (absolute counter) NOT state.week (1-4 cycle) for expiry comparison
  // state.week cycles 1-4 (week-of-month UI only), so any expiresAt > 4 would NEVER expire
  const currentWeekAbsolute = typeof state.weeksLived === 'number' && !isNaN(state.weeksLived) && isFinite(state.weeksLived) ? state.weeksLived : 0;
  
  activeBrandDeals.forEach((deal: any) => {
    if (!deal) return; // Skip invalid deals
    
    // ANTI-EXPLOIT: Validate expiresAt and compare against absolute week counter
    const expiresAt = typeof deal.expiresAt === 'number' && !isNaN(deal.expiresAt) && isFinite(deal.expiresAt) ? deal.expiresAt : 0;
    if (expiresAt > 0 && expiresAt > currentWeekAbsolute) {
      // Calculate remaining weeks
      const remainingWeeks = expiresAt - currentWeekAbsolute;
      if (remainingWeeks > 0 && isFinite(remainingWeeks)) {
        // Weekly payment from active brand deal (total payment / total weeks)
        // Use expiresIn from deal if available, otherwise estimate from remaining weeks
        const dealExpiresIn = typeof deal.expiresIn === 'number' && !isNaN(deal.expiresIn) && isFinite(deal.expiresIn) && deal.expiresIn > 0 ? deal.expiresIn : remainingWeeks;
        const dealDuration = Math.max(1, dealExpiresIn); // Ensure at least 1 to prevent division by zero
        
        // CRITICAL: Validate payment before division
        const payment = typeof deal.payment === 'number' && isFinite(deal.payment) && deal.payment >= 0 ? deal.payment : 0;
        if (payment > 0 && dealDuration > 0) {
          const weeklyPayment = Math.floor(payment / dealDuration);
          if (isFinite(weeklyPayment) && weeklyPayment > 0) {
            socialMediaIncome += weeklyPayment;
          }
        }
      }
    }
  });
  // Final validation
  if (!isFinite(socialMediaIncome) || socialMediaIncome < 0) socialMediaIncome = 0;

  // Political career salary (weekly income from political office)
  let politicalIncome = 0;
  if (state.politics && state.politics.careerLevel > 0) {
    // CRITICAL: Validate careers array exists before using find
    const careers = Array.isArray(state.careers) ? state.careers : [];
    const politicalCareer = careers.find(c => c && c.id === 'political');
    if (politicalCareer && typeof politicalCareer.level === 'number' && !isNaN(politicalCareer.level) && politicalCareer.level >= 0 && politicalCareer.level < POLITICAL_CAREER.levels.length) {
      const level = POLITICAL_CAREER.levels[politicalCareer.level];
      if (level && typeof level.salary === 'number' && isFinite(level.salary) && level.salary > 0) {
        // Convert annual salary to weekly (salary is annual in POLITICAL_CAREER)
        const weeklySalary = level.salary / WEEKS_PER_YEAR;
        if (isFinite(weeklySalary) && weeklySalary > 0) {
          politicalIncome = Math.round(weeklySalary);
        }
      }
    }
  }
  // Final validation
  if (!isFinite(politicalIncome) || politicalIncome < 0) politicalIncome = 0;

  // Crypto mining income (Bitcoin mining from companies and warehouse)
  let cryptoMiningIncome = 0;
  
  // Get crypto mining bonus from policies
  const cryptoPolicyEffects = state.politics?.activePolicyEffects?.crypto;
  const miningBonus = typeof cryptoPolicyEffects?.miningBonus === 'number' && isFinite(cryptoPolicyEffects.miningBonus) && cryptoPolicyEffects.miningBonus >= 0 ? cryptoPolicyEffects.miningBonus : 0;
  // CRITICAL: Validate miningBonus before division
  const miningBonusMultiplier = 1 + (miningBonus / 100);
  // Final validation
  const safeMiningBonusMultiplier = isFinite(miningBonusMultiplier) && miningBonusMultiplier > 0 ? miningBonusMultiplier : 1;
  
  // ANTI-EXPLOIT: Count total miners across all sources for network difficulty scaling
  // More miners owned = lower per-unit yield (simulates real crypto network difficulty)
  let totalMinerCount = 0;
  (state.companies || []).forEach(company => {
    if (!company?.miners) return;
    Object.values(company.miners).forEach(count => {
      if (typeof count === 'number' && isFinite(count) && count > 0) totalMinerCount += count;
    });
  });
  if (state.warehouse?.miners) {
    Object.values(state.warehouse.miners).forEach(count => {
      if (typeof count === 'number' && isFinite(count) && count > 0) totalMinerCount += count;
    });
  }
  // Network difficulty: each additional miner reduces all mining yield
  // 1 miner = 1.0x, 5 miners = 0.75x, 10 miners = 0.56x, 20 miners = 0.32x
  // CRASH FIX (B-3): Floor at 5% to prevent ROI becoming effectively zero with many miners
  const rawDifficulty = Math.pow(0.95, Math.max(0, totalMinerCount - 1));
  const networkDifficultyPenalty = Math.max(0.05, rawDifficulty);
  const safeNetworkDifficulty = isFinite(networkDifficultyPenalty) && networkDifficultyPenalty > 0 ? networkDifficultyPenalty : 0.1;

  // Company miners (balanced to match warehouse efficiency after difficulty multiplier)
  const companyMinerEarnings: Record<string, number> = {
    basic: 22,
    advanced: 105,
    pro: 438,
    industrial: 1575,
    quantum: 7000,
  };

  (state.companies || []).forEach(company => {
    if (!company) return;
    const selectedCrypto = company.selectedCrypto || 'btc';
    if (company.miners && Object.keys(company.miners).length > 0) {
      const weeklyMiningEarnings = Object.entries(company.miners).reduce(
        (sum, [id, count]) => {
          const minerEarning = companyMinerEarnings[id] || 0;
          const minerCount = typeof count === 'number' && isFinite(count) && count >= 0 ? count : 0;
          const earnings = minerEarning * minerCount * safeNetworkDifficulty;
          if (isFinite(earnings) && earnings > 0) {
            return sum + earnings;
          }
          return sum;
        },
        0
      ) * safeMiningBonusMultiplier;
      if (isFinite(weeklyMiningEarnings) && weeklyMiningEarnings > 0) {
        cryptoMiningIncome += Math.round(weeklyMiningEarnings);
      }
    }
  });

  // Warehouse miners (with difficulty multiplier for crypto type + network difficulty)
  const warehouseMinerEarnings: Record<string, number> = {
    basic: 22,
    advanced: 105,
    pro: 438,
    industrial: 1575,
    quantum: 7000,
    mega: 35000,
    giga: 140000,
    tera: 700000,
  };

  // Crypto mining difficulty multipliers (per-crypto)
  const cryptoMiningMultipliers: Record<string, number> = {
    'btc': 1.0,
    'eth': 0.8,
    'sol': 0.6,
    'link': 0.5,
    'dot': 0.4,
    'matic': 0.3,
    'ada': 0.2,
    'xrp': 0.1,
  };

  if (state.warehouse && state.warehouse.miners && Object.keys(state.warehouse.miners).length > 0) {
    const selectedCrypto = state.warehouse.selectedCrypto || 'btc';
    const difficultyMultiplier = typeof cryptoMiningMultipliers[selectedCrypto] === 'number' && isFinite(cryptoMiningMultipliers[selectedCrypto]) && cryptoMiningMultipliers[selectedCrypto] > 0
      ? cryptoMiningMultipliers[selectedCrypto]
      : 1.0;

    const weeklyMiningEarnings = Object.entries(state.warehouse.miners).reduce(
      (sum, [id, count]) => {
        const minerEarning = warehouseMinerEarnings[id] || 0;
        const minerCount = typeof count === 'number' && isFinite(count) && count >= 0 ? count : 0;
        // ANTI-EXPLOIT: Apply both crypto difficulty AND network difficulty
        const earnings = minerEarning * minerCount * difficultyMultiplier * safeNetworkDifficulty;
        if (isFinite(earnings) && earnings > 0) {
          return sum + earnings;
        }
        return sum;
      },
      0
    ) * safeMiningBonusMultiplier;
    if (isFinite(weeklyMiningEarnings) && weeklyMiningEarnings > 0) {
      cryptoMiningIncome += Math.round(weeklyMiningEarnings);
    }
  }
  // ANTI-EXPLOIT: Hard cap on total mining income to prevent it from dominating all other income
  const MINING_INCOME_CAP = 100000; // $100K/week maximum from all mining combined
  if (cryptoMiningIncome > MINING_INCOME_CAP) {
    cryptoMiningIncome = MINING_INCOME_CAP;
  }
  // Final validation
  if (!isFinite(cryptoMiningIncome) || cryptoMiningIncome < 0) cryptoMiningIncome = 0;

  // Gaming/Streaming passive income (from videos and stream history)
  // LONG-TERM DEGRADATION FIX: Use shared calculation function to avoid duplication
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { calcGamingStreamingIncome } = require('./gamingStreamingIncome');
  // Use weeksLived (absolute counter) — state.week cycles 1-4 and is for display only
  const safeWeeksLived = typeof state.weeksLived === 'number' && !isNaN(state.weeksLived) && isFinite(state.weeksLived) && state.weeksLived >= 0 ? state.weeksLived : 0;
  const gamingStreamingResult = calcGamingStreamingIncome(state.gamingStreaming, safeWeeksLived);
  const gamingIncome = typeof gamingStreamingResult?.gaming === 'number' && isFinite(gamingStreamingResult.gaming) && gamingStreamingResult.gaming >= 0 ? gamingStreamingResult.gaming : 0;
  const streamingIncome = typeof gamingStreamingResult?.streaming === 'number' && isFinite(gamingStreamingResult.streaming) && gamingStreamingResult.streaming >= 0 ? gamingStreamingResult.streaming : 0;
  const gamingStreamingIncome = gamingIncome + streamingIncome;
  // Final validation
  const safeGamingStreamingIncome = Math.min(75000, isFinite(gamingStreamingIncome) && gamingStreamingIncome >= 0 ? gamingStreamingIncome : 0);

  // CRITICAL: Validate all income components before summing to prevent NaN propagation
  // ANTI-EXPLOIT: Apply per-source caps to prevent any single income stream from dominating
  const PER_SOURCE_CAPS: Record<string, number> = {
    stocks: 200000,       // $200K/week max from dividends
    realEstate: 150000,   // $150K/week max from rent
    socialMedia: 50000,   // $50K/week max from social
    patents: 75000,       // $75K/week max from patents
    businessOps: 50000,   // $50K/week max from travel business opportunities
    political: 50000,     // $50K/week max from political income
    cryptoMining: 100000, // $100K/week max (already capped above, this is defense-in-depth)
    companies: 200000,    // $200K/week max from company income
    gamingStreaming: 75000, // $75K/week max from gaming/streaming
  };
  const safeStocksIncome = Math.min(PER_SOURCE_CAPS.stocks, isFinite(stocksIncome) && stocksIncome >= 0 ? stocksIncome : 0);
  const safeRealEstateIncome = Math.min(PER_SOURCE_CAPS.realEstate, isFinite(realEstateIncome) && realEstateIncome >= 0 ? realEstateIncome : 0);
  const safeSocialMediaIncome = Math.min(PER_SOURCE_CAPS.socialMedia, isFinite(socialMediaIncome) && socialMediaIncome >= 0 ? socialMediaIncome : 0);
  const safePatentIncome = Math.min(PER_SOURCE_CAPS.patents, isFinite(patentIncome) && patentIncome >= 0 ? patentIncome : 0);
  const safeBusinessOpportunitiesIncome = Math.min(PER_SOURCE_CAPS.businessOps, isFinite(businessOpportunitiesIncome) && businessOpportunitiesIncome >= 0 ? businessOpportunitiesIncome : 0);
  const safePoliticalIncome = Math.min(PER_SOURCE_CAPS.political, isFinite(politicalIncome) && politicalIncome >= 0 ? politicalIncome : 0);
  const safeCryptoMiningIncome = Math.min(PER_SOURCE_CAPS.cryptoMining, isFinite(cryptoMiningIncome) && cryptoMiningIncome >= 0 ? cryptoMiningIncome : 0);
  const safeCompanyIncome = Math.min(PER_SOURCE_CAPS.companies, isFinite(companyIncome) && companyIncome >= 0 ? companyIncome : 0);
  
  const rawTotal = Math.round(
    safeStocksIncome +
    safeRealEstateIncome +
    safeSocialMediaIncome +
    safePatentIncome +
    safeBusinessOpportunitiesIncome +
    safePoliticalIncome +
    safeCryptoMiningIncome +
    safeCompanyIncome +
    safeGamingStreamingIncome
  );

  // STABILITY FIX: Apply soft cap to passive income for ultra-rich players
  // After $10M net worth, passive income has diminishing returns (90% efficiency per $10M above threshold)
  // This prevents passive income from making the game trivial for ultra-rich players
  // while still allowing wealth growth, just at a slower rate
  let total = isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : 0;
  const currentNetWorth = netWorth(state);
  // CRITICAL: Validate netWorth before comparison
  const safeNetWorth = isFinite(currentNetWorth) && currentNetWorth >= 0 ? currentNetWorth : 0;
  const softCapThreshold = 10_000_000; // $10M threshold
  
  if (safeNetWorth > softCapThreshold && total > 0) {
    // Calculate how many $10M increments above threshold
    const incrementsAboveThreshold = Math.floor((safeNetWorth - softCapThreshold) / 10_000_000);
    if (isFinite(incrementsAboveThreshold) && incrementsAboveThreshold >= 0) {
      // Apply diminishing returns: 90% efficiency per $10M above threshold
      // At $20M: 90% efficiency, at $30M: 81% efficiency, at $40M: 72.9% efficiency, etc.
      const efficiencyMultiplier = Math.pow(0.9, incrementsAboveThreshold);
      if (isFinite(efficiencyMultiplier) && efficiencyMultiplier > 0) {
        // ANTI-EXPLOIT: Reduced minimum efficiency from 50% to 25%
        // Ultra-wealthy players still earn, but can't dominate with pure passive income
        const finalEfficiency = Math.max(0.25, efficiencyMultiplier);
        if (isFinite(finalEfficiency) && finalEfficiency > 0) {
          const cappedTotal = Math.round(total * finalEfficiency);
          if (isFinite(cappedTotal) && cappedTotal >= 0) {
            total = cappedTotal;
          }
        }
      }
    }
  }
  
  // CRITICAL: Final validation - ensure total is always valid
  if (!isFinite(total) || total < 0) {
    total = 0;
  }

  // CRITICAL: Validate all breakdown values before returning
  const safeBreakdown: PassiveIncomeBreakdown = {
    stocks: isFinite(safeStocksIncome) && safeStocksIncome >= 0 ? safeStocksIncome : 0,
    realEstate: isFinite(safeRealEstateIncome) && safeRealEstateIncome >= 0 ? safeRealEstateIncome : 0,
    socialMedia: isFinite(safeSocialMediaIncome) && safeSocialMediaIncome >= 0 ? safeSocialMediaIncome : 0,
    patents: isFinite(safePatentIncome) && safePatentIncome >= 0 ? safePatentIncome : 0,
    businessOpportunities: isFinite(safeBusinessOpportunitiesIncome) && safeBusinessOpportunitiesIncome >= 0 ? safeBusinessOpportunitiesIncome : 0,
    political: isFinite(safePoliticalIncome) && safePoliticalIncome >= 0 ? safePoliticalIncome : 0,
    cryptoMining: isFinite(safeCryptoMiningIncome) && safeCryptoMiningIncome >= 0 ? safeCryptoMiningIncome : 0,
    companies: isFinite(safeCompanyIncome) && safeCompanyIncome >= 0 ? safeCompanyIncome : 0,
    gamingStreaming: isFinite(safeGamingStreamingIncome) && safeGamingStreamingIncome >= 0 ? safeGamingStreamingIncome : 0,
  };
  
  // CRITICAL: Validate reinvestedAmount
  const safeReinvestedAmount = shouldReinvest && isFinite(reinvestedAmount) && reinvestedAmount >= 0 ? reinvestedAmount : undefined;
  
  return {
    total,
    breakdown: safeBreakdown,
    reinvested: safeReinvestedAmount,
  };
  } catch (error) {
    // CRITICAL: If any error occurs, return safe defaults to prevent crash
    const logger = require('@/utils/logger').logger;
    logger.error('[calcWeeklyPassiveIncome] Error calculating passive income:', error);
    return {
      total: 0,
      breakdown: {
        stocks: 0,
        realEstate: 0,
        socialMedia: 0,
        patents: 0,
        businessOpportunities: 0,
        political: 0,
        cryptoMining: 0,
        companies: 0,
        gamingStreaming: 0,
      },
      reinvested: undefined,
    };
  }
}

export type { PassiveIncomeBreakdown };
