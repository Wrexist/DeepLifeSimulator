import { GameState } from '@/contexts/GameContext';
import { getStockInfo } from './stockMarket';
import { getUpgradeTier } from '@/lib/realEstate/housing';
import { shouldAutoReinvestDividends } from '@/lib/prestige/applyQOLBonuses';
import { calculateInfluencerIncome } from '@/lib/social/brandPartnerships';
import { getSocialMediaData } from '@/lib/social/socialMedia';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { netWorth } from '@/lib/progress/achievements';
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
  songs: number;
  art: number;
  contracts: number;
  sponsors: number;
  socialMedia: number;
  patents: number;
  businessOpportunities: number;
  political: number;
  cryptoMining: number;
  companies: number;
  gamingStreaming: number;
}

export function calcWeeklyPassiveIncome(state: GameState): { total: number; breakdown: PassiveIncomeBreakdown; reinvested?: number } {
  let stocksIncome = 0;
  let reinvestedAmount = 0;
  const holdings = state.stocksOwned || {};
  const unlockedBonuses = state.prestige?.unlockedBonuses || [];
  const shouldReinvest = shouldAutoReinvestDividends(unlockedBonuses);
  
  for (const [stockId, shares] of Object.entries(holdings)) {
    const info = getStockInfo(stockId);
    if (!info) continue;
    const annualDividend = info.price * info.dividendYield * shares;
    const weeklyDividend = Math.round(annualDividend / 52);
    
    if (shouldReinvest) {
      // ECONOMY FIX: Apply 1% transaction cost to auto-reinvest to prevent exponential growth
      const reinvestAmount = weeklyDividend * 0.99; // 1% transaction cost
      const sharesToBuy = Math.floor(reinvestAmount / info.price);
      if (sharesToBuy > 0) {
        reinvestedAmount += sharesToBuy * info.price;
        // Note: Actual stock purchase will be handled in GameActionsContext
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
  const ownedProperties = state.realEstate.filter(p => p.owned);
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
    let rent = property.rent ?? 0;
    let upkeep = property.upkeep ?? 0;
    const upgradeLevel = property.upgradeLevel ?? 0;
    const tier = getUpgradeTier(upgradeLevel) || getUpgradeTier(0)!;
    
    // Apply rent modifier from policies
    rent = Math.round(rent * rentModifier);
    
    // Apply political tax break to upkeep
    if (realEstateTaxBreak > 0) {
      const upkeepReduction = Math.round((upkeep + tier.upkeepBonus) * (realEstateTaxBreak / 100));
      upkeep = Math.max(0, upkeep - upkeepReduction);
    }
    
    const propertyIncome = Math.round(rent + tier.rentBonus - (upkeep + tier.upkeepBonus));
    // Apply diminishing returns multiplier
    realEstateIncome += Math.round(propertyIncome * propertyEfficiencyMultiplier);
  });

  // ECONOMY FIX: Apply decay to hobby income (songs/art) to prevent unlimited stacking
  // Decay: 5% per week, minimum 10% of original income (matches gaming/streaming decay)
  // This prevents hobby income from becoming a dominant strategy in long play sessions
  // MONEY FLOW FIX: Use weeksLived instead of week (1-4) for correct age calculation
  let songsIncome = 0;
  const music = state.hobbies?.find(h => h.id === 'music');
  if (music && music.songs) {
    const currentWeeksLived = state.weeksLived || 0;
    songsIncome = Math.round(music.songs.reduce((sum, song) => {
      // Calculate age of song (weeks since upload)
      // MONEY FLOW FIX: Use uploadWeeksLived if available, fallback to uploadWeek for old saves
      const uploadWeeksLived = (song as any).uploadWeeksLived ?? (song.uploadWeek ?? 0);
      const songAge = Math.max(0, currentWeeksLived - uploadWeeksLived);
      // Decay: 5% per week, minimum 10% of original income
      const decayFactor = Math.max(0.1, 1 - (songAge * 0.05));
      const effectiveIncome = song.weeklyIncome * decayFactor;
      return sum + effectiveIncome;
    }, 0));
  }

  let artIncome = 0;
  const art = state.hobbies?.find(h => h.id === 'art');
  if (art && art.artworks) {
    // MONEY FLOW FIX: Use weeksLived instead of week (1-4) for correct age calculation
    const currentWeeksLived = state.weeksLived || 0;
    artIncome = Math.round(art.artworks.reduce((sum, artwork) => {
      // Calculate age of artwork (weeks since upload)
      // MONEY FLOW FIX: Use uploadWeeksLived if available, fallback to uploadWeek for old saves
      const uploadWeeksLived = (artwork as any).uploadWeeksLived ?? (artwork.uploadWeek ?? 0);
      const artworkAge = Math.max(0, currentWeeksLived - uploadWeeksLived);
      // Decay: 5% per week, minimum 10% of original income
      const decayFactor = Math.max(0.1, 1 - (artworkAge * 0.05));
      const effectiveIncome = artwork.weeklyIncome * decayFactor;
      return sum + effectiveIncome;
    }, 0));
  }

  let contractsIncome = 0;

  let sponsorsIncome = 0;
  state.hobbies.forEach(h => {
    if (h.sponsors && h.sponsors.length > 0) {
      sponsorsIncome += Math.round(h.sponsors.reduce((sum, s) => sum + s.weeklyPay, 0));
    }
  });

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
    let weeklyIncome = company.weeklyIncome || 0;
    
    // Apply political perks (business income bonus)
    if (state.politics && state.politics.careerLevel > 0) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCombinedPerkEffects } = require('@/lib/politics/perks');
      const perkEffects = getCombinedPerkEffects(state.politics.careerLevel);
      if (perkEffects.businessIncomeBonus > 0) {
        const bonus = Math.round(weeklyIncome * (perkEffects.businessIncomeBonus / 100));
        weeklyIncome += bonus;
      }
    }
    
    // Add government contract bonus
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { calculateGovernmentContractBonus } = require('@/lib/politics/governmentContracts');
    const contractBonus = calculateGovernmentContractBonus(state, company.id);
    if (contractBonus > 0) {
      weeklyIncome += contractBonus;
    }
    
    // Apply diminishing returns multiplier
    weeklyIncome = Math.round(weeklyIncome * efficiencyMultiplier);
    
    companyIncome += Math.round(weeklyIncome);
  });

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
    if (company.patents && company.patents.length > 0) {
      company.patents.forEach(patent => {
          if (patent.duration > 0) {
          totalActivePatents++;
          allPatents.push({ weeklyIncome: patent.weeklyIncome });
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
  allPatents.forEach(patent => {
    patentIncome += Math.round(patent.weeklyIncome * patentEfficiencyMultiplier);
  });

  // Business opportunity income from travel
  let businessOpportunitiesIncome = 0;
  if (state.travel?.businessOpportunities) {
    Object.values(state.travel.businessOpportunities).forEach(opp => {
      if (opp.invested && opp.unlocked) {
        businessOpportunitiesIncome += Math.round(opp.weeklyIncome);
      }
    });
  }

  // Social media influencer income (if player has 10,000+ followers)
  let socialMediaIncome = 0;
  const socialData = getSocialMediaData(state);
  if (socialData.followers >= 10_000) {
    socialMediaIncome = calculateInfluencerIncome(socialData.followers, socialData.engagementRate);
  }
  
  // Active brand deals income (weekly payments from ongoing deals)
  const activeBrandDeals = state.socialMedia?.activeBrandDeals || [];
  activeBrandDeals.forEach((deal: any) => {
    if (deal.expiresAt && deal.expiresAt > state.week) {
      // Calculate remaining weeks
      const remainingWeeks = deal.expiresAt - state.week;
      if (remainingWeeks > 0) {
        // Weekly payment from active brand deal (total payment / total weeks)
        // Use expiresIn from deal if available, otherwise estimate from remaining weeks
        const dealDuration = deal.expiresIn || remainingWeeks;
        const weeklyPayment = Math.floor(deal.payment / Math.max(1, dealDuration));
        socialMediaIncome += weeklyPayment;
      }
    }
  });

  // Political career salary (weekly income from political office)
  let politicalIncome = 0;
  if (state.politics && state.politics.careerLevel > 0) {
    const politicalCareer = state.careers.find(c => c.id === 'political');
    if (politicalCareer && politicalCareer.level >= 0 && politicalCareer.level < POLITICAL_CAREER.levels.length) {
      const level = POLITICAL_CAREER.levels[politicalCareer.level];
      // Convert annual salary to weekly (salary is annual in POLITICAL_CAREER)
      politicalIncome = Math.round(level.salary / 52);
    }
  }

  // Crypto mining income (Bitcoin mining from companies and warehouse)
  let cryptoMiningIncome = 0;
  
  // Get crypto mining bonus from policies
  const cryptoPolicyEffects = state.politics?.activePolicyEffects?.crypto;
  const miningBonus = cryptoPolicyEffects?.miningBonus || 0;
  const miningBonusMultiplier = 1 + (miningBonus / 100);
  
  // Company miners (balanced to match warehouse efficiency after difficulty multiplier)
  // ECONOMY FIX: Reduced from 8x warehouse earnings to match warehouse efficiency
  // Warehouse miners have difficulty multipliers (0.1-1.0), company miners don't
  // To balance: Company miners should earn similar to warehouse at BTC difficulty (1.0)
  const companyMinerEarnings: Record<string, number> = {
    basic: 22,      // Match warehouse basic (was 175, 8x reduction)
    advanced: 105,  // Match warehouse advanced (was 840, 8x reduction)
    pro: 438,       // Match warehouse pro (was 3500, 8x reduction)
    industrial: 1575, // Match warehouse industrial (was 12600, 8x reduction)
    quantum: 7000,   // Match warehouse quantum (was 56000, 8x reduction)
  };
  
  (state.companies || []).forEach(company => {
    if (company.selectedCrypto && company.miners && Object.keys(company.miners).length > 0) {
      const weeklyMiningEarnings = Object.entries(company.miners).reduce(
        (sum, [id, count]) => sum + (companyMinerEarnings[id] || 0) * (count as number),
        0
      ) * miningBonusMultiplier;
      cryptoMiningIncome += Math.round(weeklyMiningEarnings);
    }
  });
  
  // Warehouse miners (lower base earnings, but with difficulty multiplier)
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
  
  // Crypto mining difficulty multipliers
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
  
  if (state.warehouse?.selectedCrypto && state.warehouse.miners && Object.keys(state.warehouse.miners).length > 0) {
    const selectedCrypto = state.warehouse.selectedCrypto;
    const difficultyMultiplier = cryptoMiningMultipliers[selectedCrypto] || 1.0;
    
    const weeklyMiningEarnings = Object.entries(state.warehouse.miners).reduce(
      (sum, [id, count]) => sum + (warehouseMinerEarnings[id] || 0) * (count as number) * difficultyMultiplier,
      0
    ) * miningBonusMultiplier;
    cryptoMiningIncome += Math.round(weeklyMiningEarnings);
  }

  // Gaming/Streaming passive income (from videos and stream history)
  // LONG-TERM DEGRADATION FIX: Use shared calculation function to avoid duplication
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { calcGamingStreamingIncome } = require('./gamingStreamingIncome');
  const gamingStreamingResult = calcGamingStreamingIncome(state.gamingStreaming, state.week || 0);
  const gamingStreamingIncome = gamingStreamingResult.gaming + gamingStreamingResult.streaming;

  const rawTotal = Math.round(
    stocksIncome +
    realEstateIncome +
    songsIncome +
    artIncome +
    contractsIncome +
    sponsorsIncome +
    socialMediaIncome +
    patentIncome +
    businessOpportunitiesIncome +
    politicalIncome +
    cryptoMiningIncome +
    companyIncome +
    gamingStreamingIncome
  );

  // STABILITY FIX: Apply soft cap to passive income for ultra-rich players
  // After $10M net worth, passive income has diminishing returns (90% efficiency per $10M above threshold)
  // This prevents passive income from making the game trivial for ultra-rich players
  // while still allowing wealth growth, just at a slower rate
  let total = rawTotal;
  const currentNetWorth = netWorth(state);
  const softCapThreshold = 10_000_000; // $10M threshold
  
  if (currentNetWorth > softCapThreshold && rawTotal > 0) {
    // Calculate how many $10M increments above threshold
    const incrementsAboveThreshold = Math.floor((currentNetWorth - softCapThreshold) / 10_000_000);
    // Apply diminishing returns: 90% efficiency per $10M above threshold
    // At $20M: 90% efficiency, at $30M: 81% efficiency, at $40M: 72.9% efficiency, etc.
    const efficiencyMultiplier = Math.pow(0.9, incrementsAboveThreshold);
    // Minimum efficiency: 50% (prevents complete stagnation)
    const finalEfficiency = Math.max(0.5, efficiencyMultiplier);
    total = Math.round(rawTotal * finalEfficiency);
  }

  return {
    total,
    breakdown: {
      stocks: stocksIncome,
      realEstate: realEstateIncome,
      songs: songsIncome,
      art: artIncome,
      contracts: contractsIncome,
      sponsors: sponsorsIncome,
      socialMedia: socialMediaIncome,
      patents: patentIncome,
      businessOpportunities: businessOpportunitiesIncome,
      political: politicalIncome,
      cryptoMining: cryptoMiningIncome,
      companies: companyIncome,
      gamingStreaming: gamingStreamingIncome,
    },
    reinvested: shouldReinvest ? reinvestedAmount : undefined,
  };
}

export type { PassiveIncomeBreakdown };
