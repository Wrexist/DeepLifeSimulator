import { GameState } from '@/contexts/game/types';
import { getStockInfo } from './stockMarket';
import { companyIncomeFactors } from '@/lib/business/hustleLogic';
import { getUpgradeTier } from '@/lib/realEstate/housing';
import { shouldAutoReinvestDividends } from '@/lib/prestige/applyQOLBonuses';
import { calculateInfluencerIncome } from '@/lib/social/brandPartnerships';
import { getSocialMediaData } from '@/lib/social/socialMedia';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { netWorth } from '@/lib/progress/achievements';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { getCombinedPerkEffects } from '@/lib/politics/perks';
import { calculateGovernmentContractBonus } from '@/lib/politics/governmentContracts';
import { calcGamingStreamingIncome } from './gamingStreamingIncome';
import { logger } from '@/utils/logger';
import { familyBrandIncomeMultiplier, findFamilyBusiness, legacyGenerationIncomeMultiplier } from '@/lib/business/familyBusinessEffects';
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

/**
 * The weekly passive-income answer, with the drag on it named.
 *
 * `breakdown` rows are per-source figures AFTER their per-source caps but
 * BEFORE the net-worth soft cap, so above $10M they do not sum to `total` on
 * their own. That silent gap is what made the cap invisible: a readout could
 * list nine sources adding to $360K and then show a paycheck a fraction of it,
 * with nothing on screen accounting for the difference.
 *
 * `gross`, `skillBonus`, `efficiency` and `overhead` close the arithmetic:
 *
 *   sum(breakdown, minus realEstate when excluded) === gross
 *   gross + skillBonus - overhead === total
 */
export interface PassiveIncomeResult {
  /** What the paycheck actually credits. */
  total: number;
  /** Sum of the capped per-source rows, pre-life-skill and pre-soft-cap. */
  gross: number;
  /** Dollars added by the Wealth Mastery life skill. */
  skillBonus: number;
  /** 0..1 — the net-worth soft-cap efficiency actually applied (1 = no drag). */
  efficiency: number;
  /** Dollars removed by the net-worth soft cap. */
  overhead: number;
  breakdown: PassiveIncomeBreakdown;
  reinvested?: number;
}

/**
 * Weekly pay from holding political office — 0 when not in office.
 *
 * Exported because TWO subsystems need this number and must not disagree about
 * it: `calcWeeklyPassiveIncome` below (which OWNS paying it — political money
 * deliberately does not flow through the generic career-salary path) and
 * `applyLifetimeStatistics` (which must count the work so a career politician
 * accrues a pension, 2026-07-28 audit GL-3). `POLITICAL_CAREER.levels[].salary`
 * is ANNUAL, and a second copy of this conversion that forgot the division would
 * produce a 52x pension — so there is exactly one copy.
 */
export function getPoliticalWeeklySalary(state: GameState): number {
  if (!state.politics || !(state.politics.careerLevel > 0)) return 0;
  // CRITICAL: Validate careers array exists before using find
  const careers = Array.isArray(state.careers) ? state.careers : [];
  const politicalCareer = careers.find(c => c && c.id === 'political');
  if (
    !politicalCareer ||
    typeof politicalCareer.level !== 'number' ||
    isNaN(politicalCareer.level) ||
    politicalCareer.level < 0 ||
    politicalCareer.level >= POLITICAL_CAREER.levels.length
  ) {
    return 0;
  }
  const level = POLITICAL_CAREER.levels[politicalCareer.level];
  if (!level || typeof level.salary !== 'number' || !isFinite(level.salary) || level.salary <= 0) {
    return 0;
  }
  // Convert annual salary to weekly (salary is annual in POLITICAL_CAREER)
  const weeklySalary = level.salary / WEEKS_PER_YEAR;
  return isFinite(weeklySalary) && weeklySalary > 0 ? Math.round(weeklySalary) : 0;
}

export function calcWeeklyPassiveIncome(
  state: GameState,
  // ANTI-EXPLOIT (rent double-count): when the weekly tick computes spendable
  // cash it ALSO pays realized tenant rent via the real-estate tenancy tick
  // (applyRentAndHousing → runRealEstateWeeklyTick). Counting the legacy
  // property.rent stream here as well paid rent TWICE for the same property,
  // and let a player-set, unbounded `property.rent` print money. The weekly
  // tick passes `excludeRealEstate: true` so the tenancy tick is the single,
  // market-bounded rent source for cash. Projections/UI (no opts) still show
  // the property-level estimate.
  opts?: { excludeRealEstate?: boolean }
): PassiveIncomeResult {
  // CRITICAL: Wrap entire function in try-catch to prevent crashes
  try {
    // STOCK DIVIDENDS ARE NOT PAID HERE. `lib/stocks/dividends.ts` pays them,
    // quarterly, and it is the only payer.
    //
    // This function used to pay `price × yield × shares / 52` EVERY week, off
    // the same `getStockInfo(symbol).dividendYield` and the same
    // `state.stocks.holdings` that the quarterly system reads. Both credited
    // `stats.money`. Over a year a holder collected:
    //
    //   52 × (annual / 52) = one full annual yield  ← here, untaxed and silent
    //    4 × (annual / 4)  = one full annual yield  ← lib/stocks, taxed, notified
    //
    // Two hundred percent of the advertised yield, while the market board, the
    // detail sheet and every strategy quote the single figure. The duplicate
    // survived because `lib/stocks/dividends.ts` opens by asserting that the
    // legacy yield "never pays anything out" — it did, right here.
    //
    // The quarterly system is kept: it is the newer deliberate design, it
    // withholds capital-gains tax at parity with crypto, and it emits the
    // payout notification. Auto-reinvest (the prestige QOL bonus) now consumes
    // the quarterly payout in the stocks tick instead of the weekly one that
    // used to be computed here. 2026-07-30 audit R1-01.
    const stocksIncome = 0;
    const reinvestedAmount = 0;

  let realEstateIncome = 0;
  
  // Get political perks for real estate tax breaks
  let realEstateTaxBreak = 0;
  if (state.politics && state.politics.careerLevel > 0) {
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

  // Company weekly income (base business income).
  //
  // The per-company payout chain and the portfolio-size efficiency penalty now
  // live in `calcCompanyWeeklyIncome` below, so the Hustle dashboard, the bank
  // apps and the company cards can show the SAME number this credits. They each
  // used to sum `company.weeklyIncome` themselves and were wrong by every step
  // of the chain — see the note on that function.
  const companyIncome = calcCompanyWeeklyIncome(state).afterEfficiency;

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
  // v13+ saves let the Pulse weekly tick own this entirely — running both paths
  // would double-pay influencer revenue + double-process brand-deal expiry.
  let socialMediaIncome = 0;
  const isV13Plus = (state.version ?? 0) >= 13;
  const socialData = getSocialMediaData(state);
  if (!isV13Plus && socialData.followers >= 10_000) {
    socialMediaIncome = calculateInfluencerIncome(socialData.followers, socialData.engagementRate);
  }

  // Active brand deals income (weekly payments from ongoing deals) — legacy path only.
  const activeBrandDeals = !isV13Plus && Array.isArray(state.socialMedia?.activeBrandDeals)
    ? state.socialMedia.activeBrandDeals
    : [];
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
  // (getPoliticalWeeklySalary already guarantees a finite, non-negative number.)
  const politicalIncome = getPoliticalWeeklySalary(state);

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

  // NOTE (double-pay fix): warehouse miners are intentionally NOT counted here.
  // They mint the player's SELECTED crypto directly in `applyMiningCryptos.ts`
  // (per-crypto difficulty, BTC halving, electricity cost, upgrades, pools) — that
  // is the canonical, richer representation of warehouse mining. Crediting cash here
  // too paid the same hardware twice (capped cash AND uncapped crypto). The split is
  // now clean: company miners → cash (above); warehouse miners → crypto (elsewhere).

  // ANTI-EXPLOIT: Hard cap on total mining income to prevent it from dominating all other income
  const MINING_INCOME_CAP = 100000; // $100K/week maximum from all mining combined
  if (cryptoMiningIncome > MINING_INCOME_CAP) {
    cryptoMiningIncome = MINING_INCOME_CAP;
  }
  // Final validation
  if (!isFinite(cryptoMiningIncome) || cryptoMiningIncome < 0) cryptoMiningIncome = 0;

  // Gaming/Streaming passive income (from videos and stream history)
  // LONG-TERM DEGRADATION FIX: Use shared calculation function to avoid duplication
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
    companies: COMPANY_INCOME_CAP, // $200K/week max from company income
    gamingStreaming: 75000, // $75K/week max from gaming/streaming
  };
  // Life Skills: Investing (+5% stock returns) used to scale the weekly
  // dividend here. That dividend is gone (see the note at the top of this
  // function), so the multiplier has nothing to scale and `stocksIncome` is
  // always 0. `getLifeSkillModifiers` is still needed for `taxMult` below.
  const lifeSkillMods = getLifeSkillModifiers(state);
  const safeStocksIncome = Math.min(PER_SOURCE_CAPS.stocks, isFinite(stocksIncome) && stocksIncome >= 0 ? stocksIncome : 0);
  const safeRealEstateIncome = Math.min(PER_SOURCE_CAPS.realEstate, isFinite(realEstateIncome) && realEstateIncome >= 0 ? realEstateIncome : 0);
  const safeSocialMediaIncome = Math.min(PER_SOURCE_CAPS.socialMedia, isFinite(socialMediaIncome) && socialMediaIncome >= 0 ? socialMediaIncome : 0);
  const safePatentIncome = Math.min(PER_SOURCE_CAPS.patents, isFinite(patentIncome) && patentIncome >= 0 ? patentIncome : 0);
  const safeBusinessOpportunitiesIncome = Math.min(PER_SOURCE_CAPS.businessOps, isFinite(businessOpportunitiesIncome) && businessOpportunitiesIncome >= 0 ? businessOpportunitiesIncome : 0);
  const safePoliticalIncome = Math.min(PER_SOURCE_CAPS.political, isFinite(politicalIncome) && politicalIncome >= 0 ? politicalIncome : 0);
  const safeCryptoMiningIncome = Math.min(PER_SOURCE_CAPS.cryptoMining, isFinite(cryptoMiningIncome) && cryptoMiningIncome >= 0 ? cryptoMiningIncome : 0);
  const safeCompanyIncome = Math.min(PER_SOURCE_CAPS.companies, isFinite(companyIncome) && companyIncome >= 0 ? companyIncome : 0);
  
  const realEstateForTotal = opts?.excludeRealEstate ? 0 : safeRealEstateIncome;
  const rawTotal = Math.round(
    safeStocksIncome +
    realEstateForTotal +
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
  const grossTotal = total;
  // Life Skills: Wealth Mastery (+25% passive income) scales the combined total
  // BEFORE the ultra-rich net-worth soft cap below, so it never breaks the cap.
  const passiveIncomeMult = lifeSkillMods.passiveIncomeMult;
  if (typeof passiveIncomeMult === 'number' && isFinite(passiveIncomeMult) && passiveIncomeMult > 1 && total > 0) {
    total = Math.round(total * passiveIncomeMult);
  }
  const preOverheadTotal = total;
  let appliedEfficiency = 1;
  const currentNetWorth = netWorth(state);
  // CRITICAL: Validate netWorth before comparison
  const safeNetWorth = isFinite(currentNetWorth) && currentNetWorth >= 0 ? currentNetWorth : 0;
  const softCapThreshold = 10_000_000; // $10M threshold
  
  if (safeNetWorth > softCapThreshold && total > 0) {
    // Diminishing returns: 90% efficiency per $10M above the threshold, floored
    // at 25%. At $20M: 90%, at $30M: 81%, at $40M: 72.9%, and so on.
    //
    // Derived from the SAME helper a readout uses (`passiveIncomeEfficiency`),
    // so the number shown to the player and the number charged can never drift
    // apart — the advertised-vs-actual class these audits keep finding.
    const finalEfficiency = passiveIncomeEfficiency(safeNetWorth, managementLevels(state.companies));
    if (isFinite(finalEfficiency) && finalEfficiency > 0) {
      const cappedTotal = Math.round(total * finalEfficiency);
      if (isFinite(cappedTotal) && cappedTotal >= 0) {
        total = cappedTotal;
        appliedEfficiency = finalEfficiency;
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
  
  // Always `undefined` now — the weekly dividend that fed it is gone, and
  // auto-reinvest is driven from the quarterly payout in the stocks tick.
  // Kept on the return type so the field does not vanish from callers.
  const safeReinvestedAmount = reinvestedAmount > 0 ? reinvestedAmount : undefined;
  
  return {
    total,
    gross: grossTotal,
    skillBonus: Math.max(0, preOverheadTotal - grossTotal),
    efficiency: appliedEfficiency,
    overhead: Math.max(0, preOverheadTotal - total),
    breakdown: safeBreakdown,
    reinvested: safeReinvestedAmount,
  };
  } catch (error) {
    // CRITICAL: If any error occurs, return safe defaults to prevent crash
    logger.error('[calcWeeklyPassiveIncome] Error calculating passive income:', error);
    return {
      total: 0,
      gross: 0,
      skillBonus: 0,
      efficiency: 1,
      overhead: 0,
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

/**
 * Operating overhead — the passive-income soft cap, made legible.
 *
 * Above $10M net worth, total passive income is silently multiplied by
 * `0.9^floor((netWorth - 10M) / 10M)`, floored at 25%. The mechanic is
 * defensible; being INVISIBLE is not. $10M is also the prestige threshold, so
 * the economy starts throttling at exactly the number where the game
 * congratulates the player — and nothing anywhere tells them.
 *
 * These two exports change no math. They let a readout state the drag as a
 * weekly cost the player can see and reason about, which is the prerequisite
 * for turning it into a decision (buying management to reduce it) rather than
 * a tax.
 */
export const PASSIVE_SOFT_CAP_THRESHOLD = 10_000_000;
export const PASSIVE_SOFT_CAP_FLOOR = 0.25;

/**
 * Operating-management levels owned across every company.
 *
 * Read from the EXISTING `company.upgrades` array (id + level), so the
 * management ladder needed no new stored field and no migration. The
 * `ops_management` line pays no weekly income — its entire value is here.
 */
export function managementLevels(
  companies: readonly { upgrades?: { id?: string; level?: number }[] }[] | undefined | null
): number {
  if (!Array.isArray(companies)) return 0;
  let total = 0;
  for (const company of companies) {
    for (const upgrade of company?.upgrades ?? []) {
      if (upgrade?.id !== 'ops_management') continue;
      const level = upgrade.level;
      if (typeof level === 'number' && Number.isFinite(level) && level > 0) total += level;
    }
  }
  return total;
}

/** Percentage points of efficiency floor bought per management level. */
export const MANAGEMENT_FLOOR_PER_LEVEL = 0.02;
/** Most the floor can be raised, however much management is bought. */
export const MAX_MANAGEMENT_FLOOR_GAIN = 0.20;

/**
 * The efficiency multiplier applied to passive income at this net worth.
 *
 * `managers` raises the FLOOR the decay bottoms out at — from 0.25 up to a
 * hard 0.45. Deliberately a floor and not a multiplier: management should make
 * a large empire survivable, never remove the cap. A wealthy player with full
 * management still loses more than half their passive income to overhead.
 */
export function passiveIncomeEfficiency(
  netWorthValue: number | undefined | null,
  managers: number = 0
): number {
  const worth =
    typeof netWorthValue === 'number' && isFinite(netWorthValue) && netWorthValue >= 0
      ? netWorthValue
      : 0;
  const levels =
    typeof managers === 'number' && Number.isFinite(managers) && managers > 0 ? managers : 0;
  const floor =
    PASSIVE_SOFT_CAP_FLOOR +
    Math.min(MAX_MANAGEMENT_FLOOR_GAIN, levels * MANAGEMENT_FLOOR_PER_LEVEL);

  if (worth <= PASSIVE_SOFT_CAP_THRESHOLD) return 1;
  const increments = Math.floor((worth - PASSIVE_SOFT_CAP_THRESHOLD) / 10_000_000);
  if (!isFinite(increments) || increments < 0) return 1;
  const raw = Math.pow(0.9, increments);
  if (!isFinite(raw) || raw <= 0) return floor;
  return Math.max(floor, raw);
}

export interface OperatingOverhead {
  /** 0..1 — what fraction of gross passive income survives. */
  efficiency: number;
  /** Weekly dollars lost to overhead. */
  weeklyCost: number;
  /** True once the drag is doing anything at all. */
  active: boolean;
}

/**
 * Describe the drag for a given gross weekly passive income.
 *
 * Takes the gross rather than reading state so a caller can report on any
 * figure it already has, and so this stays a pure function.
 */
export function getOperatingOverhead(
  grossWeeklyPassive: number | undefined | null,
  netWorthValue: number | undefined | null,
  managers: number = 0
): OperatingOverhead {
  const gross =
    typeof grossWeeklyPassive === 'number' && isFinite(grossWeeklyPassive) && grossWeeklyPassive > 0
      ? grossWeeklyPassive
      : 0;
  const efficiency = passiveIncomeEfficiency(netWorthValue, managers);
  return {
    efficiency,
    weeklyCost: Math.round(gross * (1 - efficiency)),
    active: efficiency < 1 && gross > 0,
  };
}

// ---------------------------------------------------------------------------
// Company weekly income — ONE definition, shared by the tick and every readout.
// ---------------------------------------------------------------------------

/**
 * Hard ceiling on TOTAL weekly company income, whatever the portfolio earns.
 *
 * Also the value in `PER_SOURCE_CAPS.companies`; exported so a readout can name
 * the number instead of the player having to infer it from a paycheck.
 */
export const COMPANY_INCOME_CAP = 200_000;

/**
 * Management efficiency for a portfolio of `companyCount` companies.
 *
 * Managing multiple companies gets harder, not easier: 1-3 companies pay 100%,
 * 4-6 pay 90%, 7-10 pay 80%, 11+ pay 70%.
 */
export function companyCountEfficiency(companyCount: number | undefined | null): number {
  const count =
    typeof companyCount === 'number' && Number.isFinite(companyCount) && companyCount > 0
      ? companyCount
      : 0;
  if (count > 10) return 0.7;
  if (count > 6) return 0.8;
  if (count > 3) return 0.9;
  return 1.0;
}

type CompanyLike = NonNullable<GameState['companies']>[number];

/**
 * What ONE company contributes to the weekly paycheck, before the portfolio-wide
 * `COMPANY_INCOME_CAP` and the net-worth soft cap.
 *
 * The full chain, in the order the tick applies it: stored `weeklyIncome` →
 * family brand → legacy generations → political business perk → government
 * contracts → the Hustle overlay's brand/share/hire multiplier → the
 * portfolio-size efficiency penalty.
 *
 * Pass `efficiencyMultiplier = 1` to get the company's own contribution with the
 * portfolio penalty left off (what a single company card should show).
 */
export function companyWeeklyIncomeFor(
  state: GameState,
  company: CompanyLike | null | undefined,
  efficiencyMultiplier: number = 1,
): number {
  if (!company) return 0;

  // CRITICAL: Validate weeklyIncome before calculation
  let weeklyIncome =
    typeof company.weeklyIncome === 'number' && isFinite(company.weeklyIncome) && company.weeklyIncome >= 0
      ? company.weeklyIncome
      : 0;

  /**
   * C-2: a family business's Brand lifts its weekly income. Applied FIRST,
   * before the political and contract bonuses below, so those keep compounding
   * on top exactly as they did — brand scales the business, it does not reorder
   * the existing stack.
   *
   * Neutral at brand 0, which is what `createFamilyBusiness` seeds, so no
   * existing save's income moves until the player spends on marketing.
   * Companies that are not family businesses are untouched.
   */
  const familyMeters = findFamilyBusiness(state.familyBusinesses, company.id);
  if (familyMeters && weeklyIncome > 0) {
    weeklyIncome = Math.round(weeklyIncome * familyBrandIncomeMultiplier(familyMeters.brandValue));

    /*
     * The `legacy_business` prestige bonus, applied on top of brand rather than
     * instead of it. Scales with `generationsHeld`, which the heir flow already
     * increments and which nothing else consumed.
     *
     * Neutral (1.0) for every player who does not own the bonus, and neutral at
     * generation 0 even for those who do, so no existing save's income moves on
     * upgrade. See lib/business/familyBusinessEffects.ts.
     */
    const held = (state.familyBusinesses || [])
      .find((fb) => fb && fb.companyId === company.id)?.generationsHeld;
    const legacyMult = legacyGenerationIncomeMultiplier(held, state.prestige?.unlockedBonuses);
    if (legacyMult !== 1) {
      weeklyIncome = Math.round(weeklyIncome * legacyMult);
    }
  }

  // Apply political perks (business income bonus)
  if (state.politics && state.politics.careerLevel > 0) {
    try {
      const perkEffects = getCombinedPerkEffects(state.politics.careerLevel);
      const businessIncomeBonus =
        typeof perkEffects?.businessIncomeBonus === 'number'
        && isFinite(perkEffects.businessIncomeBonus)
        && perkEffects.businessIncomeBonus > 0
          ? perkEffects.businessIncomeBonus
          : 0;
      if (businessIncomeBonus > 0 && weeklyIncome > 0) {
        const bonus = Math.round(weeklyIncome * (businessIncomeBonus / 100));
        if (isFinite(bonus) && bonus > 0) {
          weeklyIncome += bonus;
        }
      }
    } catch {
      // Skip perk bonus if calculation fails
    }
  }

  // Add government contract bonus
  try {
    const contractBonus = calculateGovernmentContractBonus(state, company.id);
    if (typeof contractBonus === 'number' && isFinite(contractBonus) && contractBonus > 0) {
      weeklyIncome += contractBonus;
    }
  } catch {
    // Skip contract bonus if calculation fails
  }

  // Brand & market share (Hustle overlay) now affect revenue: strong brand
  // (>50) and market share lift income, weak brand drags it. Named-hire roster
  // performance adds a bounded ±8% nudge (star hires lift income, a demoralized
  // roster drags it) so hiring quality/retention finally matter.
  // factor = 1 + (brand - 50)/200 + marketShare%/200 + hirePerf, clamped to
  // [0.75, 1.6] — the COMBINED multiplier stays within the existing cap.
  // Older saves without a hustleApp overlay get a neutral 1.0.
  try {
    // The arithmetic lives in `companyIncomeFactors` so the Hustle UI can show
    // the SAME number the player is paid.
    const overlay = state.hustleApp?.companies?.[company.id];
    if (overlay) {
      const { multiplier } = companyIncomeFactors(overlay);
      if (isFinite(multiplier) && multiplier > 0) {
        weeklyIncome = Math.round(weeklyIncome * multiplier);
      }
    }
  } catch {
    // Neutral on any overlay read failure — never zero company income.
  }

  // CRITICAL: Validate efficiencyMultiplier before applying
  const safeEfficiencyMultiplier =
    isFinite(efficiencyMultiplier) && efficiencyMultiplier > 0 ? efficiencyMultiplier : 1;
  weeklyIncome = Math.round(weeklyIncome * safeEfficiencyMultiplier);

  // Final validation
  return isFinite(weeklyIncome) && weeklyIncome > 0 ? weeklyIncome : 0;
}

export interface CompanyIncomeSummary {
  /** Sum of the raw stored `company.weeklyIncome` values. */
  stored: number;
  /** After every per-company bonus, before the portfolio-size penalty. */
  afterBonuses: number;
  /** The portfolio-size management efficiency (0.7 – 1.0). */
  efficiency: number;
  /** What actually enters the weekly passive-income total, pre-cap. */
  afterEfficiency: number;
  /** The portfolio-wide ceiling. */
  cap: number;
  /**
   * `min(cap, afterEfficiency)` — what the paycheck credits for companies
   * BEFORE the net-worth soft cap (`passiveIncomeEfficiency`) applies to the
   * combined passive total.
   */
  paid: number;
  /** Weekly dollars lost to the portfolio-size penalty and the cap. */
  lost: number;
  /** True once any of that drag is doing something. */
  capped: boolean;
}

/**
 * The company slice of the weekly paycheck, with every step of the drag named.
 *
 * THE SINGLE SOURCE for that number. The Hustle dashboard, both bank apps and
 * the real-estate/vehicle affordability checks each summed `company.weeklyIncome`
 * themselves, which omitted the family-brand and legacy multipliers, the
 * political business perk, government contracts, the Hustle overlay multiplier,
 * the portfolio-size efficiency penalty AND the $200K/wk ceiling. A player whose
 * companies stored $360K/wk was shown "$360,000/wk" and paid a fraction of it —
 * the advertised-vs-actual gap that reached support.
 */
export function calcCompanyWeeklyIncome(state: GameState): CompanyIncomeSummary {
  const companies = Array.isArray(state?.companies) ? state.companies : [];
  const efficiency = companyCountEfficiency(companies.length);

  let stored = 0;
  let afterBonuses = 0;
  let afterEfficiency = 0;
  for (const company of companies) {
    if (!company) continue;
    const raw = company.weeklyIncome;
    if (typeof raw === 'number' && isFinite(raw) && raw > 0) stored += raw;
    afterBonuses += companyWeeklyIncomeFor(state, company, 1);
    afterEfficiency += companyWeeklyIncomeFor(state, company, efficiency);
  }

  if (!isFinite(afterEfficiency) || afterEfficiency < 0) afterEfficiency = 0;
  if (!isFinite(afterBonuses) || afterBonuses < 0) afterBonuses = 0;
  if (!isFinite(stored) || stored < 0) stored = 0;

  const paid = Math.min(COMPANY_INCOME_CAP, afterEfficiency);
  return {
    stored,
    afterBonuses,
    efficiency,
    afterEfficiency,
    cap: COMPANY_INCOME_CAP,
    paid,
    lost: Math.max(0, afterBonuses - paid),
    capped: afterBonuses > paid,
  };
}

/**
 * Company income exactly as the weekly paycheck credits it.
 *
 * `calcCompanyWeeklyIncome(state).paid` stops at the portfolio ceiling; the
 * combined passive total is then scaled again by the net-worth soft cap. This
 * applies both, so a readout can print one number and be right.
 */
export function companyIncomePaidWeekly(state: GameState): number {
  const summary = calcCompanyWeeklyIncome(state);
  const efficiency = passiveIncomeEfficiency(netWorth(state), managementLevels(state?.companies));
  const paid = Math.round(summary.paid * efficiency);
  return isFinite(paid) && paid > 0 ? paid : 0;
}
