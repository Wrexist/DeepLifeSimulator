import { GameState } from '@/contexts/game/types';
import { PrestigeData, PrestigeRecord, defaultPrestigeData } from './prestigeTypes';
import { calculatePrestigePoints, calculateLifetimeStats } from './prestigePoints';
import { initialGameState } from '@/contexts/game/initialState';
import { netWorth } from '@/lib/progress/achievements';
import { FamilyMemberNode , FamilyTree } from '@/lib/legacy/familyTree';
import { SCENARIOS, isScenarioCompleted } from '@/lib/scenarios/scenarioDefinitions';
import { MAX_PRESTIGE_HISTORY } from './prestigeConstants';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';


/**
 * Execute prestige - reset character based on chosen path
 * @param gameState Current game state
 * @param chosenPath 'reset' to age 18 or 'child' to continue as child
 * @param childId Optional child ID if choosing child path
 * @returns New game state after prestige
 */
export function executePrestige(
  gameState: GameState,
  chosenPath: 'reset' | 'child',
  childId?: string
): GameState {
  const currentNetWorth = netWorth(gameState);
  const prestigeData = gameState.prestige || defaultPrestigeData;

  // Calculate prestige points earned
  const pointsBreakdown = calculatePrestigePoints(
    gameState,
    currentNetWorth,
    prestigeData,
    chosenPath
  );

  // Update lifetime stats
  const updatedLifetimeStats = calculateLifetimeStats(
    gameState,
    prestigeData.lifetimeStats
  );

  // Create prestige record
  const completedAchievements = (gameState.achievements || []).filter(a => a.completed);
  const prestigeRecord: PrestigeRecord = {
    prestigeNumber: prestigeData.totalPrestiges + 1,
    netWorthAtPrestige: currentNetWorth,
    ageAtPrestige: Math.floor(gameState.date?.age || 18),
    weeksLived: gameState.weeksLived || 0,
    prestigePointsEarned: pointsBreakdown.total,
    timestamp: Date.now(),
    chosenPath,
    childId: chosenPath === 'child' ? childId : undefined,
    keyAchievements: completedAchievements.slice(0, 5).map(a => a.name), // Top 5 achievements
  };

  // STABILITY FIX: Cap prestige history to last MAX_PRESTIGE_HISTORY records to prevent unbounded growth
  // Older prestiges are rarely accessed, so keeping only recent history is sufficient
  // 
  // SAFETY: This is safe because:
  // - PrestigeHistoryModal.tsx displays history but doesn't require full history
  // - No other code depends on complete history (only displays recent records)
  // - Old records are truly archival (rarely accessed after many prestiges)
  // - Constant extracted to prestigeConstants.ts for easy tuning
  //
  // FUTURE BUG RISK: If any code assumes complete history exists, it will break.
  // Mitigation: PrestigeHistoryModal already handles empty history gracefully.
  const updatedHistory = [...prestigeData.prestigeHistory, prestigeRecord];
  const cappedHistory = updatedHistory.length > MAX_PRESTIGE_HISTORY
    ? updatedHistory.slice(-MAX_PRESTIGE_HISTORY) // Keep only last N records
    : updatedHistory;

  // Update prestige data
  const updatedPrestigeData: PrestigeData = {
    prestigeLevel: prestigeData.prestigeLevel + 1,
    prestigePoints: prestigeData.prestigePoints + pointsBreakdown.total,
    totalPrestiges: prestigeData.totalPrestiges + 1,
    lifetimeStats: updatedLifetimeStats,
    unlockedBonuses: [...prestigeData.unlockedBonuses], // Preserve unlocked bonuses
    prestigeHistory: cappedHistory,
  };

  // Award challenge scenario gems only on first prestige
  let gemsToAward = 0;
  const isFirstPrestige = prestigeData.totalPrestiges === 0;
  
  if (isFirstPrestige) {
    // Check all challenge scenarios and award gems for completed ones
    SCENARIOS.forEach(scenario => {
      const scenarioState = {
        stats: { money: gameState.stats.money, reputation: gameState.stats.reputation },
        age: gameState.date?.age || 18,
        education: (gameState.educations || []).map(e => ({ id: e.id, completed: e.completed })),
        careers: (gameState.careers || []).map(c => ({ id: c.id, accepted: c.accepted })),
        relationships: (gameState.relationships || []).map(r => ({ type: r.type })),
        achievements: (gameState.achievements || []).map(a => ({ id: a.id, completed: a.completed })),
        companies: (gameState.companies || []).map(c => ({ weeklyIncome: c.weeklyIncome || 0 })),
        realEstate: (gameState.realEstate || []).map(r => ({ owned: r.owned, value: r.price || 0 })),
        weeksLived: gameState.weeksLived || 0,
      };
      if (isScenarioCompleted(scenario.id, scenarioState)) {
        gemsToAward += scenario.rewards?.gems || 0;
      }
    });
  }

  // Create new game state based on path
  let newGameState: GameState;

  if (chosenPath === 'reset') {
    newGameState = createResetGameState(gameState, updatedPrestigeData);
  } else {
    // Validate childId for child prestige path
    if (!childId) {
      throw new Error('childId is required when choosing child prestige path');
    }
    const children = gameState.family?.children || [];
    if (!children.find(c => c.id === childId)) {
      throw new Error(
        `Child with ID "${childId}" not found in family. ` +
        `Available children: ${children.map(c => c.id).join(', ') || 'none'}`
      );
    }
    newGameState = createChildGameState(gameState, updatedPrestigeData, childId);
  }

  // Add gems to the new game state if any were earned
  if (gemsToAward > 0) {
    newGameState.stats.gems = (newGameState.stats.gems || 0) + gemsToAward;
  }

  return newGameState;
}

/**
 * Create new game state for reset path (age 18, fresh start)
 */
function createResetGameState(
  oldState: GameState,
  prestigeData: PrestigeData
): GameState {
  // Start with initial state - use spread operator for proper type safety
  // initialGameState is a proper GameState, so spreading it maintains type safety
  const newState: GameState = {
    ...initialGameState,
    // Deep clone nested objects that need to be independent
    stats: { ...initialGameState.stats },
    date: { ...initialGameState.date },
    settings: { ...initialGameState.settings },
  };

  // Preserve prestige data
  newState.prestige = prestigeData;
  newState.prestigeAvailable = false; // Reset availability

  // Preserve gems
  newState.stats.gems = oldState.stats.gems;

  // Preserve achievements
  newState.achievements = JSON.parse(JSON.stringify(oldState.achievements || []));

  // Preserve progress
  newState.progress = JSON.parse(JSON.stringify(oldState.progress || { achievements: [] }));

  // Preserve lineage data
  // NOTE: Generation is NOT incremented on prestige reset - only when continuing as child
  // This allows players to prestige multiple times without increasing generation
  newState.generationNumber = oldState.generationNumber || 1; // Keep same generation on prestige reset
  newState.lineageId = oldState.lineageId || 'initial-lineage';
  newState.ancestors = [...(oldState.ancestors || [])];
  
  // BUG FIX: Properly preserve family tree data to prevent reverting to default
  if (oldState.familyTreeData) {
    try {
      // Deep clone family tree data to ensure it's preserved
      newState.familyTreeData = JSON.parse(JSON.stringify(oldState.familyTreeData));
    } catch (error) {
      // If parsing fails, try to preserve as-is
      newState.familyTreeData = oldState.familyTreeData;
    }
  } else {
    // Initialize empty family tree if none exists
    const { FamilyTree } = require('@/lib/legacy/familyTree');
    const familyTree = new FamilyTree(newState.lineageId);
    newState.familyTreeData = familyTree.toJSON();
  }

  // Preserve memories
  newState.memories = [...(oldState.memories || [])];

  // Preserve previous lives
  newState.previousLives = [...(oldState.previousLives || [])];

  // Preserve ribbon collection across prestiges
  newState.ribbonCollection = oldState.ribbonCollection;

  // Preserve discovered secrets across prestiges
  newState.discoveredSecrets = oldState.discoveredSecrets;

  // BUG FIX: Calculate and set legacy bonuses for lineage display
  // Legacy bonuses should be calculated from previous life's net worth and achievements
  // This ensures the "Inherited Bonuses" section shows correct values
  const previousNetWorth = netWorth(oldState);
  const completedAchievements = (oldState.achievements || []).filter(a => a.completed).length;
  
  const incomeMultiplier = 1 + Math.min(Math.max(previousNetWorth, 0), 10_000_000) / 10_000_000 / 10; // up to +10%
  const learningMultiplier = 1 + Math.min(completedAchievements, 20) / 200; // up to +10%
  const reputationBonus = Math.min(Math.floor((oldState.stats?.reputation || 0) / 10), 20);
  
  newState.legacyBonuses = {
    incomeMultiplier,
    learningMultiplier,
    reputationBonus,
  };

  // Preserve character name and profile when resetting (keep same character)
  if (oldState.userProfile) {
    newState.userProfile = {
      ...newState.userProfile,
      name: oldState.userProfile.name || newState.userProfile.name,
      firstName: oldState.userProfile.firstName || newState.userProfile.firstName,
      lastName: oldState.userProfile.lastName || newState.userProfile.lastName,
      sex: oldState.userProfile.sex || oldState.userProfile.gender || newState.userProfile.sex,
      gender: oldState.userProfile.gender || oldState.userProfile.sex || newState.userProfile.gender,
      sexuality: oldState.userProfile.sexuality || newState.userProfile.sexuality,
      seekingGender: oldState.userProfile.seekingGender || newState.userProfile.seekingGender,
    };
  }

  // BUG FIX: Preserve scenarioId to prevent "unknown" scenario title
  if (oldState.scenarioId) {
    newState.scenarioId = oldState.scenarioId;
  }
  
  // CRITICAL FIX: Preserve challengeScenarioId for challenge completion tracking
  if (oldState.challengeScenarioId) {
    newState.challengeScenarioId = oldState.challengeScenarioId;
  }

  // BUG FIX: Continue year progression instead of resetting to 2025
  // Calculate new year based on previous year + time progression
  const previousYear = oldState.date?.year || 2025;
  const previousAge = Math.floor(oldState.date?.age || 18);
  const yearsLived = previousAge - 18; // Years lived in previous life
  // Continue time progression: new year = previous year + years lived + 1 (for new life start)
  const newYear = previousYear + yearsLived + 1;

  // Apply starting bonuses (will be handled by bonus application system)
  // For now, just set age to 18
  newState.date = {
    year: newYear,
    month: 'January',
    week: 1,
    age: 18,
  };

  // BUG FIX: Apply starting bonuses and unlock bonuses after creating new state
  const { applyStartingBonuses, applyLegacyBonuses } = require('@/lib/prestige/applyBonuses');
  const { applyUnlockBonuses } = require('@/lib/prestige/applyUnlocks');
  const unlockedBonuses = prestigeData.unlockedBonuses || [];
  let finalState = applyStartingBonuses(newState, unlockedBonuses);
  finalState = applyUnlockBonuses(finalState, unlockedBonuses);
  
  // Apply legacy bonuses (from previous generations)
  // Note: previousNetWorth is already calculated above on line 183
  finalState = applyLegacyBonuses(finalState, unlockedBonuses, previousNetWorth, oldState);

  return finalState;
}

/**
 * Continue as child without prestiging (only increment generation)
 * Used when continuing legacy from death popup
 */
export function continueAsChild(
  gameState: GameState,
  childId: string
): GameState {
  const children = gameState.family?.children || [];
  let selectedChild = children.find(c => c.id === childId);

  if (!selectedChild) {
    throw new Error(`Child ${childId} not found`);
  }

  // Simulate child to age 18 if they're younger
  const { simulateChildToAge } = require('@/lib/legacy/childSimulation');
  if ((selectedChild.age || 0) < ADULTHOOD_AGE) {
    selectedChild = simulateChildToAge(selectedChild, gameState, ADULTHOOD_AGE);
  }

  // Preserve prestige data WITHOUT incrementing it
  const prestigeData = gameState.prestige || defaultPrestigeData;

  // Create new state using createChildGameState but with preserved prestige
  return createChildGameState(gameState, prestigeData, childId);
}

/**
 * Create new game state for child path (continue as child)
 */
function createChildGameState(
  oldState: GameState,
  prestigeData: PrestigeData,
  childId?: string
): GameState {
  const children = oldState.family?.children || [];
  let selectedChild = childId 
    ? children.find(c => c.id === childId)
    : children[0];

  if (!selectedChild) {
    // Fallback to reset if no child found
    return createResetGameState(oldState, prestigeData);
  }

  // Simulate child to age 18 if they're younger
  const { simulateChildToAge } = require('@/lib/legacy/childSimulation');
  if ((selectedChild.age || 0) < ADULTHOOD_AGE) {
    selectedChild = simulateChildToAge(selectedChild, oldState, ADULTHOOD_AGE);
  }

  // Start with initial state
  // Clone initialGameState properly - use spread operator for type safety
  // initialGameState is a proper GameState, so spreading it maintains type safety
  const newState: GameState = {
    ...initialGameState,
    // Deep clone nested objects that need to be independent
    stats: { ...initialGameState.stats },
    date: { ...initialGameState.date },
    settings: { ...initialGameState.settings },
  };

  // Preserve prestige data
  newState.prestige = prestigeData;
  newState.prestigeAvailable = false;

  // Preserve gems
  newState.stats.gems = oldState.stats.gems;

  // Preserve achievements
  newState.achievements = JSON.parse(JSON.stringify(oldState.achievements || []));

  // Preserve progress
  newState.progress = JSON.parse(JSON.stringify(oldState.progress || { achievements: [] }));

  // Preserve lineage data
  newState.generationNumber = (oldState.generationNumber || 1) + 1; // Increment generation for child
  newState.lineageId = oldState.lineageId || 'initial-lineage';
  newState.ancestors = [...(oldState.ancestors || [])];
  
  // BUG FIX: Preserve scenarioId to prevent "unknown" scenario title
  if (oldState.scenarioId) {
    newState.scenarioId = oldState.scenarioId;
  }
  
  // CRITICAL FIX: Preserve challengeScenarioId for challenge completion tracking
  if (oldState.challengeScenarioId) {
    newState.challengeScenarioId = oldState.challengeScenarioId;
  }
  
  // Add prestiged character to family tree
  const currentNetWorth = netWorth(oldState);
  const currentAge = Math.floor(oldState.date?.age || 18);
  const currentYear = oldState.date?.year || 2025;
  const birthYear = currentYear - currentAge;
  
  // Initialize or get existing family tree
  let familyTree: FamilyTree;
  if (oldState.familyTreeData) {
    familyTree = FamilyTree.fromJSON(oldState.familyTreeData);
  } else {
    familyTree = new FamilyTree(newState.lineageId);
  }
  
  // Create FamilyMemberNode for the prestiged character
  const prestigedCharacterId = `prestige_${prestigeData.totalPrestiges}_${Date.now()}`;
  const prestigedCharacter: FamilyMemberNode = {
    id: prestigedCharacterId,
    firstName: oldState.userProfile?.firstName || 'Player',
    lastName: oldState.userProfile?.lastName || 'Unknown',
    generation: oldState.generationNumber || 1,
    birthYear: birthYear,
    deathYear: currentYear, // Prestige year becomes "death" year
    parents: [],
    children: oldState.family?.children?.map(c => c.id) || [],
    spouse: oldState.family?.spouse?.id,
    traits: oldState.activeTraits || [],
    finalStats: {
      money: oldState.stats.money,
      health: oldState.stats.health,
      happiness: oldState.stats.happiness,
      energy: oldState.stats.energy,
      fitness: oldState.stats.fitness,
      reputation: oldState.stats.reputation,
    },
    occupation: (() => {
      if (!oldState.currentJob) return 'Unknown';
      const career = oldState.careers?.find(c => c.id === oldState.currentJob);
      if (career && career.levels && career.levels.length > 0) {
        const currentLevel = career.levels[career.level - 1] || career.levels[0];
        return currentLevel.name || 'Unknown';
      }
      return 'Unknown';
    })(),
    netWorth: currentNetWorth,
    causeOfDeath: 'Prestige',
    achievements: (oldState.achievements || []).filter(a => a.completed).map(a => a.name),
    gender: (oldState.userProfile?.gender || oldState.userProfile?.sex || 'male') as 'male' | 'female',
    avatarSeed: `${oldState.userProfile?.firstName}_${oldState.userProfile?.lastName}_${birthYear}`,
  };
  
  // Add parent to family tree
  familyTree.addMember(prestigedCharacter);
  
  // CRITICAL: Create child node in family tree with proper parent relationship
  const childAge = Math.max(ADULTHOOD_AGE, Math.floor(selectedChild.age || ADULTHOOD_AGE));
  const childBirthYear = currentYear - childAge;
  const childNodeId = selectedChild.id;
  
  const childNode: FamilyMemberNode = {
    id: childNodeId,
    firstName: selectedChild.name.split(' ')[0] || selectedChild.name,
    lastName: oldState.userProfile?.lastName || 'Unknown',
    generation: (oldState.generationNumber || 1) + 1,
    birthYear: childBirthYear,
    parents: [prestigedCharacterId], // Link to parent
    children: [],
    spouse: undefined,
    traits: selectedChild.geneticTraits || oldState.activeTraits || [],
    finalStats: undefined, // Will be set when this child dies/prestiges
    occupation: selectedChild.careerPath || (selectedChild.educationLevel === 'university' ? 'Student' : 'Unknown'),
    netWorth: selectedChild.savings || 0,
    achievements: [],
    gender: (selectedChild.gender || 'male') as 'male' | 'female',
    avatarSeed: `${selectedChild.name}_${childBirthYear}`,
  };
  
  // Add child to family tree
  familyTree.addMember(childNode);
  
  // Update parent's children array to include this child
  const updatedParent = familyTree.getMember(prestigedCharacterId);
  if (updatedParent && !updatedParent.children.includes(childNodeId)) {
    updatedParent.children.push(childNodeId);
    familyTree.addMember(updatedParent);
  }
  
  // Update family tree data
  newState.familyTreeData = familyTree.toJSON();

  // Preserve memories and add child-specific memories
  const { generateChildMemories } = require('./childStats');
  const childMemories = generateChildMemories(selectedChild, oldState, newState.generationNumber);
  newState.memories = [...(oldState.memories || []), ...childMemories];

  // Preserve previous lives
  newState.previousLives = [...(oldState.previousLives || [])];

  // Preserve ribbon collection and discovered secrets across legacy transitions
  newState.ribbonCollection = oldState.ribbonCollection;
  newState.discoveredSecrets = oldState.discoveredSecrets;

  // Set character to child (age already calculated above)
  newState.userProfile = {
    ...newState.userProfile,
    firstName: selectedChild.name.split(' ')[0] || selectedChild.name,
    lastName: oldState.userProfile?.lastName || newState.userProfile.lastName,
    name: selectedChild.name,
    sex: selectedChild.gender || oldState.userProfile?.sex || 'male',
    gender: selectedChild.gender || oldState.userProfile?.gender || 'male',
  };

  // BUG FIX: Continue year progression instead of resetting to 2025
  // Calculate new year based on previous year + time progression
  // childBirthYear is already calculated above (line 365)
  const newYear = Math.max(currentYear, childBirthYear + 18); // Ensure child is at least 18 in new year

  // Set age
  newState.date = {
    year: newYear,
    month: 'January',
    week: 1,
    age: childAge,
  };

  // Calculate inheritance using computeInheritance for proper calculation
  // This includes heirloom bonuses and proper net worth calculation
  const { computeInheritance } = require('@/lib/legacy/inheritance');
  const { calculateChildInheritance } = require('./childStats');
  const inheritanceSummary = computeInheritance(oldState);
  
  // CRITICAL FIX: Use inheritanceSummary.totalNetWorth instead of currentNetWorth
  // inheritanceSummary.totalNetWorth is the correct value calculated by computeInheritance
  // which includes cash, bank savings, real estate, companies, and debts properly
  const parentNetWorth = inheritanceSummary.totalNetWorth;
  
  // Calculate child-specific inheritance with education/career bonuses
  // This gives 10% of net worth (with bonuses for educated children)
  const childInheritance = calculateChildInheritance(parentNetWorth, selectedChild);
  
  // Add child's personal savings to inheritance
  const totalInheritance = childInheritance + (selectedChild.savings || 0);
  
  // Use inheritance summary's legacy bonuses (includes heirloom bonuses)
  newState.legacyBonuses = inheritanceSummary.legacyBonuses;
  
  // Update dynasty stats if available
  if (inheritanceSummary.updatedDynastyStats) {
    newState.dynastyStats = inheritanceSummary.updatedDynastyStats;
  }
  
  // Add new heirlooms if generated
  if (inheritanceSummary.newHeirloom && newState.dynastyStats) {
    newState.dynastyStats.heirlooms = inheritanceSummary.updatedHeirlooms;
  }
  
  // CRITICAL FIX: Set money to inheritance amount
  // This ensures the child receives the calculated inheritance
  newState.stats.money = totalInheritance;

  // Inherit family relationships (siblings, extended family)
  // Keep family tree but reset immediate family
  newState.family = {
    spouse: undefined,
    children: [],
  };

  // Preserve relationships that are not immediate family
  newState.relationships = (oldState.relationships || []).filter(
    r => r.type !== 'spouse' && r.type !== 'child' && r.id !== selectedChild.id
  );

  // BUG FIX: Preserve family businesses on prestige
  // Family businesses should be inherited, not lost
  if (oldState.familyBusinesses && oldState.familyBusinesses.length > 0) {
    newState.familyBusinesses = oldState.familyBusinesses.map(fb => ({
      ...fb,
      generationsHeld: (fb.generationsHeld || 0) + 1,
    }));
    
    // Preserve companies that are family businesses
    const familyBusinessCompanyIds = oldState.familyBusinesses.map(fb => fb.companyId);
    const familyBusinessCompanies = (oldState.companies || []).filter(c => 
      familyBusinessCompanyIds.includes(c.id)
    );
    
    if (familyBusinessCompanies.length > 0) {
      // Merge with existing companies (avoid duplicates)
      const existingCompanyIds = new Set((newState.companies || []).map(c => c.id));
      const newCompanies = familyBusinessCompanies.filter(c => !existingCompanyIds.has(c.id));
      newState.companies = [...(newState.companies || []), ...newCompanies];
    }

    // ANTI-EXPLOIT: Transfer loans associated with family business companies
    // Prevents prestige debt-shedding: take max loans against company assets, prestige as child,
    // keep companies but shed all debt = free money each prestige cycle
    if (Array.isArray(oldState.loans) && oldState.loans.length > 0) {
      // Transfer business-type loans AND any loans taken while owning family businesses
      const transferredLoans = oldState.loans.filter(loan =>
        loan && loan.remaining > 0 && (
          loan.type === 'business' ||
          familyBusinessCompanyIds.some(id => loan.id?.includes(id) || loan.name?.includes('Business'))
        )
      );
      if (transferredLoans.length > 0) {
        newState.loans = [...(newState.loans || []), ...transferredLoans];
      }
    }
  }

  // BUG FIX: Use calculateChildStats for proper stat calculation with percentages
  // This ensures stats are calculated properly and can be displayed with %
  const { calculateChildStats } = require('./childStats');
  const childStats = calculateChildStats(selectedChild, oldState, prestigeData);
  
  // Apply calculated child stats (includes parent influence, age bonus, prestige bonus)
  newState.stats = {
    ...newState.stats,
    ...childStats,
    money: totalInheritance, // Override money with inheritance
  };

  // BUG FIX: Apply starting bonuses and unlock bonuses after creating new state (child path)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { applyStartingBonuses, applyLegacyBonuses } = require('@/lib/prestige/applyBonuses');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { applyUnlockBonuses } = require('@/lib/prestige/applyUnlocks');
  const unlockedBonuses = prestigeData.unlockedBonuses || [];
  let finalState = applyStartingBonuses(newState, unlockedBonuses);
  finalState = applyUnlockBonuses(finalState, unlockedBonuses);
  
  // Apply legacy bonuses (from previous generations)
  // Note: currentNetWorth is already calculated above on line 344
  finalState = applyLegacyBonuses(finalState, unlockedBonuses, currentNetWorth, oldState);

  return finalState;
}

