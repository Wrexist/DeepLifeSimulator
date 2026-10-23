import { GameState , RealEstate, Company, Heirloom, DynastyStats, Loan } from '@/contexts/game/types';
import { getEarnedAchievementCount } from '@/lib/progress/earnedAchievements';
import { Memory, MEMORY_TEMPLATES, generateMemoryId } from './memories';
import {
  generateHeirloom,
  updateHeirloomGenerations,
  updateDynastyOnDeath,
  getHeirloomBonuses,
} from './dynasty';
import { netWorth } from '@/lib/progress/achievements';
import { vaultItemIds } from '@/lib/dynasty/state';
import { capLegacyBonuses } from './legacyBonuses';

export interface InheritanceSummary {
  totalNetWorth: number;
  realEstateIds: string[];
  companyIds: string[];
  cash: number;
  bankSavings: number;
  debts: number;
  
  // New Systems
  familyBusinessIds: string[];
  generatedMemories: Memory[];
  legacyBonuses: {
    incomeMultiplier: number;
    learningMultiplier: number;
    reputationBonus: number;
  };
  
  // Dynasty & Heirloom System
  newHeirloom?: Heirloom;
  updatedHeirlooms: Heirloom[];
  updatedDynastyStats: DynastyStats;
}

/**
 * The company ids that cross a life boundary IN KIND, as live companies - the
 * family businesses both prestige builders carry (`prestigeExecution`).
 */
export function carriedFamilyBusinessIds(state: GameState): string[] {
  const list = Array.isArray(state.familyBusinesses) ? state.familyBusinesses : [];
  return list.map(fb => fb?.companyId).filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * Whether a loan crosses the life boundary WITH a carried family business. One
 * predicate for the carry (`carryFamilyBusinessLoans`) and the estate below, so
 * a carried debt is never also charged against the cash inheritance.
 */
export function isCarriedFamilyBusinessLoan(
  loan: Pick<Loan, 'id' | 'name' | 'type' | 'remaining'> | null | undefined,
  familyBusinessCompanyIds: readonly string[],
): boolean {
  if (!loan || !(loan.remaining > 0) || familyBusinessCompanyIds.length === 0) return false;
  return (
    loan.type === 'business' ||
    familyBusinessCompanyIds.some(id => loan.id?.includes(id) || loan.name?.includes('Business'))
  );
}

/**
 * What the ESTATE is worth: the canonical `netWorth` (lib/progress/achievements)
 * of everything that does NOT pass to the heir in kind.
 *
 * It used to be its own sum - cash + bank + property price + 5x company income
 * - which never read stocks, crypto, the bank accounts a player opened, savings
 * goals, vehicles, luxury items or card debt. A parent with $50M in an index
 * fund left their heir almost nothing while the death screen quoted $50M
 * (LATE-3). And it counted every company, including the family businesses the
 * heir also receives as live companies, so those were paid twice.
 *
 * Carried in kind, and therefore left out here: family-business companies,
 * the loans that travel with them, and luxury items preserved in the Vault.
 */
export function estateValue(state: GameState): number {
  const familyIds = carriedFamilyBusinessIds(state);
  const vaulted = new Set(vaultItemIds(state));
  const companies = Array.isArray(state.companies) ? state.companies : [];
  const loans = Array.isArray(state.loans) ? state.loans : [];
  const luxuryItems = Array.isArray(state.luxuryItems) ? state.luxuryItems : [];
  const probate: GameState = {
    ...state,
    companies: familyIds.length > 0 ? companies.filter(c => !familyIds.includes(c?.id)) : companies,
    loans: familyIds.length > 0 ? loans.filter(l => !isCarriedFamilyBusinessLoan(l, familyIds)) : loans,
    luxuryItems: vaulted.size > 0 ? luxuryItems.filter(id => !vaulted.has(id)) : luxuryItems,
  };
  const value = netWorth(probate);
  return Number.isFinite(value) ? value : 0;
}

export function computeInheritance(state: GameState): InheritanceSummary {
  const cash = state.stats?.money ?? 0;
  const bankSavings = state.bankSavings ?? 0;

  const ownedRealEstate = (state.realEstate as RealEstate[] | undefined) ?? [];
  const realEstateIds: string[] = ownedRealEstate
    .filter(p => p.owned)
    .map(p => p.id);

  const companies = (state.companies as Company[] | undefined) ?? [];
  const companyIds: string[] = companies.map(c => c.id);

  // The companies that pass down as live family businesses (not as cash).
  const familyBusinessIds = carriedFamilyBusinessIds(state).filter(id => companyIds.includes(id));

  const loansTotal =
    state.loans?.reduce((sum, loan) => sum + (loan.remaining ?? 0), 0) ??
    0;

  const debts = loansTotal < 0 ? 0 : loansTotal;
  const totalNetWorth = estateValue(state);

  // Clamp starting debt for next life
  const clampedNetWorth =
    totalNetWorth < 0 ? Math.max(totalNetWorth, -5000) : totalNetWorth;

  // Calculate Legacy Bonuses
  const completedCount = getEarnedAchievementCount(state);
  
  const incomeMultiplier =
    1 + Math.min(Math.max(clampedNetWorth, 0), 10_000_000) / 10_000_000 / 10; // up to +10%
    
  const learningMultiplier = 
    1 + Math.min(completedCount, 20) / 200; // up to +10%
    
  // BUGFIX: state.stats.reputation may be undefined on legacy/corrupt saves —
  // undefined / 10 = NaN, Math.floor(NaN) = NaN, Math.min(NaN, 20) = NaN, which
  // propagates into legacyBonuses.reputationBonus and corrupts the next life.
  const safeReputation = typeof state.stats?.reputation === 'number' && Number.isFinite(state.stats.reputation)
    ? state.stats.reputation
    : 0;
  const reputationBonus = Math.min(
    Math.floor(safeReputation / 10),
    20,
  );

  // Generate Memories from this life
  const generatedMemories: Memory[] = [];
  const generation = state.generationNumber ?? 1;
  // BUGFIX: state.userProfile may be undefined on legacy/corrupt saves — direct
  // access crashed the inheritance flow.
  const userProfile = state.userProfile ?? ({} as Partial<GameState['userProfile']>);
  const ancestorName = userProfile.name || `${userProfile.firstName ?? 'Unknown'} ${userProfile.lastName ?? 'Heir'}`;

  // 1. Wealth Memory
  if (totalNetWorth > 1_000_000) {
    const template = MEMORY_TEMPLATES.fortune_made(`$${(totalNetWorth / 1000000).toFixed(1)}M`, ancestorName);
    generatedMemories.push({
      id: generateMemoryId(generation, 'wealth'),
      title: template.title!,
      description: template.description!,
      category: 'achievement',
      generation,
      ancestorName,
      date: Date.now(),
      effects: { reputation: 5 },
      unlocked: false,
      unlockCondition: { age: 25 },
      tags: template.tags || [],
    });
  } else if (totalNetWorth < -1000) {
    const template = MEMORY_TEMPLATES.bankruptcy(ancestorName);
    generatedMemories.push({
      id: generateMemoryId(generation, 'bankruptcy'),
      title: template.title!,
      description: template.description!,
      category: 'warning',
      generation,
      ancestorName,
      date: Date.now(),
      effects: { happiness: -5, reputation: 5 },
      unlocked: false,
      unlockCondition: { age: 20 },
      tags: template.tags || [],
    });
  }

  // 2. Skill Memories (Top skills)
  // Iterate through skills (crime, hobbies, etc. - need to access from state)
  // Simplified for now: Check Achievements
  if (completedCount > 5) {
    generatedMemories.push({
        id: generateMemoryId(generation, 'achiever'),
        title: 'A Life of Achievement',
        description: `${ancestorName} accomplished many great things.`,
        category: 'story',
        generation,
        ancestorName,
        date: Date.now(),
        effects: { happiness: 5 },
        unlocked: false,
        tags: ['achievement'],
    });
  }

  // ============================================
  // Dynasty & Heirloom System
  // ============================================
  
  // Get current dynasty stats or create defaults
  const currentDynastyStats: DynastyStats = state.dynastyStats || {
    totalGenerations: generation,
    totalWealth: 0,
    familyReputation: 0,
    heirlooms: [],
    familyAchievements: [],
    longestLivingMember: { name: '', age: 0 },
    wealthiestMember: { name: '', netWorth: 0 },
    totalChildrenAllGenerations: 0,
    dynastyFoundedYear: 2025,
    familyMotto: undefined,
  };
  
  // Get player age and children count
  const playerAge = state.date?.age || 18;
  const childrenCount = state.family?.children?.length || 0;
  // `achievements[].completed` is the DEPRECATED store - 52 entries that ship
  // `false` and are never set in normal play (`evaluateAchievements` is a
  // documented no-op). The live store is `claimedProgressAchievements`. Reading
  // the dead flag made this silently empty for every player. 2026-07-30 audit
  // GP-3; same fix as lib/careers/advancedCareers.ts.
  const unlockedAchievements = [...(state.claimedProgressAchievements || [])];
  
  // v13 Pulse: forward peak followers into dynasty carry so the next life
  // starts with a small head-start (floor(carry × 0.001)).
  const peakFollowersThisLife = state.socialMedia?.lifetimeStats?.peakFollowers
    ?? state.socialMedia?.followers
    ?? 0;

  // Update dynasty stats with this life's accomplishments
  const updatedDynastyStats = updateDynastyOnDeath(
    currentDynastyStats,
    ancestorName,
    playerAge,
    totalNetWorth,
    childrenCount,
    unlockedAchievements,
    peakFollowersThisLife,
  );
  
  // Try to generate a new heirloom if wealthy
  const newHeirloom = generateHeirloom(ancestorName, totalNetWorth, generation);
  
  // Update existing heirlooms (increment generations held)
  let updatedHeirlooms = updateHeirloomGenerations(currentDynastyStats.heirlooms);
  
  // Add new heirloom if generated
  if (newHeirloom) {
    updatedHeirlooms = [...updatedHeirlooms, newHeirloom];
  }
  
  // Update dynasty stats with heirlooms
  updatedDynastyStats.heirlooms = updatedHeirlooms;
  
  // Apply heirloom bonuses to legacy bonuses
  const heirloomBonuses = getHeirloomBonuses(updatedHeirlooms);
  const finalIncomeMultiplier = incomeMultiplier * (1 + heirloomBonuses.incomeBonus / 100);
  const finalLearningMultiplier = learningMultiplier * (1 + heirloomBonuses.learningBonus / 100);
  const finalReputationBonus = reputationBonus + heirloomBonuses.reputationBonus;

  return {
    totalNetWorth: clampedNetWorth,
    realEstateIds,
    companyIds,
    familyBusinessIds,
    cash,
    bankSavings,
    debts,
    generatedMemories,
    // Capped (D11): heirlooms stack without a bound, and these values are now
    // APPLIED, not just shown - see lib/legacy/legacyBonuses.ts.
    legacyBonuses: capLegacyBonuses({
      incomeMultiplier: finalIncomeMultiplier,
      learningMultiplier: finalLearningMultiplier,
      reputationBonus: finalReputationBonus,
    }),
    // Dynasty & Heirloom System
    newHeirloom: newHeirloom || undefined,
    updatedHeirlooms,
    updatedDynastyStats,
  };
}
