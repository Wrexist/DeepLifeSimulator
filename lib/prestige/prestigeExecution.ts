import { GameState } from '@/contexts/game/types';
import { PrestigeData, PrestigeRecord, PRESTIGE_THRESHOLD, defaultPrestigeData } from './prestigeTypes';
import { calculatePrestigePoints, calculateLifetimeStats } from './prestigePoints';
import { initialGameState } from '@/contexts/game/initialState';
import { netWorth } from '@/lib/progress/achievements';
import { FamilyMemberNode , FamilyTree } from '@/lib/legacy/familyTree';
import { SCENARIOS, isScenarioCompleted } from '@/lib/scenarios/scenarioDefinitions';
import { MAX_PRESTIGE_HISTORY } from './prestigeConstants';


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
      if (isScenarioCompleted(scenario.id, gameState)) {
        gemsToAward += scenario.rewards.gems || 0;
      }
    });
  }

  // Create new game state based on path
  let newGameState: GameState;

  if (chosenPath === 'reset') {
    newGameState = createResetGameState(gameState, updatedPrestigeData);
  } else {
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
  // Start with initial state
  const newState: GameState = JSON.parse(JSON.stringify(initialGameState)) as GameState;

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
  newState.generationNumber = (oldState.generationNumber || 1) + 1; // Increment generation
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
  newState.week = 1;

  return newState;
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
  const selectedChild = childId 
    ? children.find(c => c.id === childId)
    : children[0];

  if (!selectedChild) {
    // Fallback to reset if no child found
    return createResetGameState(oldState, prestigeData);
  }

  // Start with initial state
  const newState: GameState = JSON.parse(JSON.stringify(initialGameState)) as GameState;

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
  
  // Add to family tree
  familyTree.addMember(prestigedCharacter);
  
  // Update family tree data
  newState.familyTreeData = familyTree.toJSON();

  // Preserve memories
  newState.memories = [...(oldState.memories || [])];

  // Preserve previous lives
  newState.previousLives = [...(oldState.previousLives || [])];

  // BUG FIX: Calculate and set legacy bonuses for lineage display (child path)
  // Legacy bonuses should be calculated from previous life's net worth and achievements
  // This ensures the "Inherited Bonuses" section shows correct values
  const previousNetWorth = currentNetWorth;
  const completedAchievements = (oldState.achievements || []).filter(a => a.completed).length;
  
  const incomeMultiplier = 1 + Math.min(Math.max(previousNetWorth, 0), 10_000_000) / 10_000_000 / 10; // up to +10%
  const learningMultiplier = 1 + Math.min(completedAchievements, 20) / 200; // up to +10%
  const reputationBonus = Math.min(Math.floor((oldState.stats?.reputation || 0) / 10), 20);
  
  newState.legacyBonuses = {
    incomeMultiplier,
    learningMultiplier,
    reputationBonus,
  };

  // Set character to child
  const childAge = Math.max(18, Math.floor(selectedChild.age || 18));
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
  const previousYear = oldState.date?.year || 2025;
  const previousAge = Math.floor(oldState.date?.age || 18);
  const yearsLived = previousAge - 18; // Years lived in previous life
  // Continue time progression: new year = previous year + years lived + child age difference
  const childBirthYear = currentYear - childAge;
  const newYear = Math.max(currentYear, childBirthYear + 18); // Ensure child is at least 18 in new year

  // Set age
  newState.date = {
    year: newYear,
    month: 'January',
    week: 1,
    age: childAge,
  };
  newState.week = 1;

  // BUG FIX: Remove hardcoded $1M inheritance cap - use 10% of net worth (can exceed $1M)
  // Only cap at $1M if net worth is very low to prevent excessive inheritance from bugs
  const inheritancePercent = 0.1; // 10% inheritance
  const baseInheritance = Math.floor(currentNetWorth * inheritancePercent);
  // Cap only if net worth is suspiciously low (< $100K) to prevent inheritance bugs
  const inheritance = currentNetWorth < 100_000 
    ? Math.min(1_000_000, baseInheritance)
    : baseInheritance;
  newState.stats.money = inheritance;

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
  }

  // BUG FIX: Use calculateChildStats for proper stat calculation with percentages
  // This ensures stats are calculated properly and can be displayed with %
  const { calculateChildStats } = require('./childStats');
  const childStats = calculateChildStats(selectedChild, oldState, prestigeData);
  
  // Apply calculated child stats (includes parent influence, age bonus, prestige bonus)
  newState.stats = {
    ...newState.stats,
    ...childStats,
    money: inheritance, // Override money with inheritance
  };

  return newState;
}

