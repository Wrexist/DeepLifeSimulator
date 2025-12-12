import { GameState } from '@/contexts/GameContext';
import { getStockInfo } from './stockMarket';
import { getUpgradeTier } from '@/lib/realEstate/housing';
import { shouldAutoReinvestDividends } from '@/lib/prestige/applyQOLBonuses';
import { calculateInfluencerIncome } from '@/lib/social/brandPartnerships';
import { getSocialMediaData } from '@/lib/social/socialMedia';
import { POLITICAL_CAREER } from '@/lib/careers/political';

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
      // Calculate how many shares can be purchased with dividends
      const sharesToBuy = Math.floor(weeklyDividend / info.price);
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
  
  // Only process owned properties to avoid errors with unowned properties
  state.realEstate.forEach(property => {
    // Skip properties that aren't owned
    if (!property.owned) return;
    
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
    
    realEstateIncome += Math.round(rent + tier.rentBonus - (upkeep + tier.upkeepBonus));
  });

  let songsIncome = 0;
  const music = state.hobbies?.find(h => h.id === 'music');
  if (music && music.songs) {
    songsIncome = Math.round(music.songs.reduce((sum, song) => sum + song.weeklyIncome, 0));
  }

  let artIncome = 0;
  const art = state.hobbies?.find(h => h.id === 'art');
  if (art && art.artworks) {
    artIncome = Math.round(art.artworks.reduce((sum, a) => sum + a.weeklyIncome, 0));
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
    
    companyIncome += Math.round(weeklyIncome);
  });

  // Patent income from R&D
  let patentIncome = 0;
  (state.companies || []).forEach(company => {
    if (company.patents && company.patents.length > 0) {
      patentIncome += Math.round(
        company.patents.reduce((sum, patent) => {
          if (patent.duration > 0) {
            return sum + patent.weeklyIncome;
          }
          return sum;
        }, 0)
      );
    }
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
  
  // Company miners (higher earnings, no difficulty multiplier)
  const companyMinerEarnings: Record<string, number> = {
    basic: 175,
    advanced: 840,
    pro: 3500,
    industrial: 12600,
    quantum: 56000,
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
  let gamingStreamingIncome = 0;
  if (state.gamingStreaming) {
    const gamingData = state.gamingStreaming;
    
    // Calculate gaming earnings from videos
    if (gamingData.videos && gamingData.videos.length > 0) {
      const gamingEarnings = gamingData.videos.reduce((sum, video) => {
        // Calculate earnings based on views and engagement
        const baseEarnings = video.views * 0.01; // $0.01 per view
        return sum + baseEarnings;
      }, 0);
      gamingStreamingIncome += Math.round(gamingEarnings);
    }
    
    // Calculate streaming earnings from stream history
    if (gamingData.streamHistory && gamingData.streamHistory.length > 0) {
      const streamingEarnings = gamingData.streamHistory.reduce((sum, stream) => {
        // Calculate earnings based on viewers and duration (donations are added immediately)
        const viewerEarnings = stream.viewers * 0.005; // $0.005 per viewer per stream
        const durationEarnings = stream.duration * 0.02; // $0.02 per minute
        // Donations are added immediately during streaming, not in weekly calculation
        return sum + viewerEarnings + durationEarnings;
      }, 0);
      gamingStreamingIncome += Math.round(streamingEarnings);
    }
  }

  const total = Math.round(
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
