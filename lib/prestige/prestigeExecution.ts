import { GameState } from '@/contexts/game/types';
import { PrestigeData, PrestigeRecord, PRESTIGE_THRESHOLD, defaultPrestigeData } from './prestigeTypes';
import { calculatePrestigePoints, calculateLifetimeStats } from './prestigePoints';
import { initialGameState } from '@/contexts/game/initialState';
import { netWorth } from '@/lib/progress/achievements';
import { FamilyMemberNode , FamilyTree } from '@/lib/legacy/familyTree';
import { SCENARIOS, isScenarioCompleted } from '@/lib/scenarios/scenarioDefinitions';


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

  // Update prestige data
  const updatedPrestigeData: PrestigeData = {
    prestigeLevel: prestigeData.prestigeLevel + 1,
    prestigePoints: prestigeData.prestigePoints + pointsBreakdown.total,
    totalPrestiges: prestigeData.totalPrestiges + 1,
    lifetimeStats: updatedLifetimeStats,
    unlockedBonuses: [...prestigeData.unlockedBonuses], // Preserve unlocked bonuses
    prestigeHistory: [...prestigeData.prestigeHistory, prestigeRecord],
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
  newState.generationNumber = oldState.generationNumber || 1;
  newState.lineageId = oldState.lineageId || 'initial-lineage';
  newState.ancestors = [...(oldState.ancestors || [])];
  newState.familyTreeData = oldState.familyTreeData ? JSON.parse(JSON.stringify(oldState.familyTreeData)) : undefined;

  // Preserve memories
  newState.memories = [...(oldState.memories || [])];

  // Preserve previous lives
  newState.previousLives = [...(oldState.previousLives || [])];

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

  // Apply starting bonuses (will be handled by bonus application system)
  // For now, just set age to 18
  newState.date = {
    year: 2025,
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
  newState.generationNumber = oldState.generationNumber || 1;
  newState.lineageId = oldState.lineageId || 'initial-lineage';
  newState.ancestors = [...(oldState.ancestors || [])];
  
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

  // Set age
  newState.date = {
    year: 2025,
    month: 'January',
    week: 1,
    age: childAge,
  };
  newState.week = 1;

  // Inherit some starting money (10% of parent's net worth, capped at $1M)
  const inheritance = Math.min(1_000_000, Math.floor(currentNetWorth * 0.1));
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

  // Apply child stat bonuses (will be enhanced by child stats calculation)
  // Base stats with parent influence
  const parentStats = oldState.stats;
  newState.stats.health = Math.min(100, 60 + Math.floor(parentStats.health / 10));
  newState.stats.happiness = Math.min(100, 60 + Math.floor(parentStats.happiness / 10));
  newState.stats.energy = Math.min(100, 70 + Math.floor(parentStats.energy / 10));
  newState.stats.fitness = Math.min(100, 50 + Math.floor(parentStats.fitness / 10));
  newState.stats.reputation = Math.min(100, Math.floor(parentStats.reputation * 0.3));

  // Prestige bonus: +10 to all stats if prestige level > 0
  if (prestigeData.prestigeLevel > 0) {
    newState.stats.health = Math.min(100, newState.stats.health + 10);
    newState.stats.happiness = Math.min(100, newState.stats.happiness + 10);
    newState.stats.energy = Math.min(100, newState.stats.energy + 10);
    newState.stats.fitness = Math.min(100, newState.stats.fitness + 10);
  }

  return newState;
}

