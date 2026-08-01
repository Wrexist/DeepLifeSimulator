import { GameState } from '@/contexts/game/types';
import { PrestigeData, PrestigeRecord, defaultPrestigeData, getPrestigeThreshold } from './prestigeTypes';
import { carryAccountLevelEntitlements } from './accountEntitlements';
import { calculatePrestigePoints, calculateLifetimeStats } from './prestigePoints';
import { collectNewlyEarnedPrestigeAchievements } from './prestigeAchievements';
import { initialGameState } from '@/contexts/game/initialState';
import { netWorth } from '@/lib/progress/achievements';
import { nonMirrorDeposits } from '@/lib/banking/operations';
import { getEarnedAchievementCount, getEarnedAchievementNames, getSatisfiedAchievementIds } from '@/lib/progress/earnedAchievements';
import { FamilyMemberNode , FamilyTree } from '@/lib/legacy/familyTree';
import { SCENARIOS, isScenarioCompleted } from '@/lib/scenarios/scenarioDefinitions';
import { MAX_PRESTIGE_HISTORY } from './prestigeConstants';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import { simulateChildToAge } from '@/lib/legacy/childSimulation';
import { heirStartingBonuses } from '@/lib/legacy/legacyShop';


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

  // Model-layer gate (M-4): the net-worth requirement was enforced ONLY in
  // PrestigeModal — executePrestige trusted its caller, so any non-modal entry
  // point (or a modified client) could prestige at $0 net worth and still mint
  // prestige points and first-prestige gems. Re-validate here, matching the
  // modal which gates both the reset and child paths.
  if (currentNetWorth < getPrestigeThreshold(prestigeData.prestigeLevel)) {
    return gameState; // below threshold — no-op
  }

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
  const earnedAchievementNames = getEarnedAchievementNames(gameState);
  const prestigeRecord: PrestigeRecord = {
    prestigeNumber: prestigeData.totalPrestiges + 1,
    netWorthAtPrestige: currentNetWorth,
    ageAtPrestige: Math.floor(gameState.date?.age || 18),
    weeksLived: gameState.weeksLived || 0,
    prestigePointsEarned: pointsBreakdown.total,
    timestamp: Date.now(),
    chosenPath,
    childId: chosenPath === 'child' ? childId : undefined,
    keyAchievements: earnedAchievementNames.slice(0, 5), // Top 5 achievements
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
    // H-5: record how many achievements have now been credited toward points so
    // they can't be farmed again on the next prestige. Two things are required for
    // this to actually close the farm:
    //   1. Credit from the SAME source `calculatePrestigePoints` reads
    //      (`getEarnedAchievementCount` / claimedProgressAchievements). The old
    //      deprecated `achievements[].completed` source is never set in normal
    //      play, so the stamp was always 0 and the guard no-oped.
    //   2. The stamp must be a MONOTONIC high-water mark. claimedProgressAchievements
    //      resets to [] each prestige, so writing the raw current-life count would
    //      let a low-achievement life erode the stamp below the lifetime peak and
    //      let the next life re-credit the difference (a throttled but real farm) —
    //      and it would strip honest players of credit for genuinely new
    //      achievements. Math.max keeps it non-decreasing: points are only ever
    //      paid for pushing the peak per-life earned count higher.
    achievementsCreditedForPoints: Math.max(
      prestigeData.achievementsCreditedForPoints ?? 0,
      getEarnedAchievementCount(gameState)
    ),
    // Preserve the prestige-achievement claimed store across the reset. This
    // object is rebuilt field-by-field (not spread), so without carrying it over
    // every prestige would reset the store and re-award each achievement — the
    // award pass below relies on it to stay one-time / idempotent.
    claimedPrestigeAchievements: [...(prestigeData.claimedPrestigeAchievements ?? [])],
    // Preserve the cross-life one-time-payout stamps across the reset. Like the
    // prestige-achievement store above, this object is rebuilt field-by-field
    // (not spread), so these MUST be carried over explicitly — otherwise every
    // prestige would clear them and re-enable the ambition/achievement gem farms.
    claimedAmbitions: [...(prestigeData.claimedAmbitions ?? [])],
    claimedAchievementIds: [...(prestigeData.claimedAchievementIds ?? [])],
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
        // GL-4: `level` must survive the projection. The Political Dynasty
        // scenario's "Become President" condition is checked with
        // `'level' in politicalCareer && politicalCareer.level >= 5`, and this
        // map dropped the field — so `'level' in ...` was false, `isPresident`
        // was always false, and the 200-gem expert scenario could never score
        // at prestige no matter how the player played.
        careers: (gameState.careers || []).map(c => ({
          id: c.id,
          accepted: c.accepted,
          level: c.level,
        })),
        relationships: (gameState.relationships || []).map(r => ({ type: r.type })),
        // Project from the LIVE achievement system, not `gameState.achievements`.
        //
        // That array is the deprecated catalogue in `initialState.ts`; its
        // `completed` flag has NO writer in shipping code — `evaluateAchievements`
        // is an explicit no-op stub (`lib/progress/achievements.ts:232`). So every
        // `type: 'achievement'` win condition evaluated against an all-false list
        // and could never be met, whichever id it named. The real system is
        // `src/features/onboarding/achievementsData`, where completion is derived
        // from each achievement's `progressSpec` against current state.
        //
        // "Earned", not "claimed": `claimedProgressAchievements` records which
        // rewards were collected, which is a different question from whether the
        // life met the condition. 2026-07-31 audit round 3.
        achievements: getSatisfiedAchievementIds(gameState).map(id => ({ id, completed: true })),
        companies: (gameState.companies || []).map(c => ({ weeklyIncome: c.weeklyIncome || 0 })),
        realEstate: (gameState.realEstate || []).map(r => ({ owned: r.owned, value: r.price || 0 })),
        weeksLived: gameState.weeksLived || 0,
        // Bank balances count toward the five net-worth scenarios. The
        // evaluator always read this; nothing ever passed it. Legacy pool plus
        // the modern per-account balances, which is where savings actually
        // lives since STATE_VERSION 14.
        //
        // R4 correction: `nonMirrorDeposits`, not a raw sum. `banking.accounts`
        // always holds `checking-default` and `savings-default`, which
        // `mirrorAccountsFromLegacy` overwrites with `stats.money` and
        // `bankSavings` on every tick. The evaluator computes
        // `stats.money + bankSavings + …`, so a raw sum counted BOTH legacy
        // pools twice and handed out the five net-worth scenarios' gems to
        // players at roughly half the stated threshold.
        bankSavings:
          (gameState.bankSavings || 0) + nonMirrorDeposits(gameState.banking?.accounts ?? []),
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

  // --- Award prestige achievements (idempotent) ------------------------------
  // Evaluate against a MERGED view of the life that just ended plus the freshly
  // updated prestige accumulators:
  //   • old life (gameState): stats / loans / relationships / educations — lets
  //     the "prestige with 100 stats / zero debt / all educations / 20+
  //     relationships" conditions read the ending life (post-reset stats would
  //     be wrong).
  //   • new prestige data + previousLives (newGameState): incremented
  //     totalPrestiges, preserved unlockedBonuses, and the just-appended life
  //     with weeksLivedAtEnd/netWorth — lets the count / speed / net-worth
  //     conditions read the accumulators.
  // The claimed store (carried into updatedPrestigeData) makes each award
  // one-time and gives existing veterans a one-shot retroactive catch-up on
  // their next prestige.
  const updatedPrestige = newGameState.prestige;
  if (updatedPrestige) {
    const evalState: GameState = {
      ...gameState,
      prestige: updatedPrestige,
      previousLives: newGameState.previousLives,
    };
    const { newlyAwarded, pointsAwarded } = collectNewlyEarnedPrestigeAchievements(evalState);
    if (newlyAwarded.length > 0) {
      const alreadyClaimed = updatedPrestige.claimedPrestigeAchievements ?? [];
      newGameState.prestige = {
        ...updatedPrestige,
        prestigePoints: updatedPrestige.prestigePoints + pointsAwarded,
        claimedPrestigeAchievements: [
          ...alreadyClaimed,
          ...newlyAwarded.map(a => a.id),
        ],
      };
    }
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

  // A purchase belongs to the PLAYER, not the character. `settings` above comes
  // from initialGameState, so without this every purchased entitlement flag —
  // Remove Ads, lifetime premium, the nine gem-bought gold upgrades, unspent
  // youth pills — was erased by prestige AND by the ungated death -> heir flow.
  // Carrying the DeepLife+ claim stamps also closes the printer that let a
  // player re-mint the 500-gem welcome bonus once per prestige.
  // 2026-07-30 audit MON-1/2/3, ECON-R1-01/02.
  carryAccountLevelEntitlements(oldState, newState);

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

  /**
   * C-11: legacy points and purchases are lineage data, so they survive a
   * prestige RESET too — otherwise prestiging would silently destroy them, the
   * same class of bug as the entitlement wipe above (MON-1/2/3).
   *
   * The heir STARTING BONUSES are deliberately NOT applied here. Every upgrade
   * is worded "Your heir starts with…", and a reset is the same character
   * starting over, not a new generation. The purchase is not wasted — it is
   * permanent and applies to every future heir.
   */
  newState.legacyPoints = oldState.legacyPoints || 0;
  newState.legacyUpgrades = [...(oldState.legacyUpgrades || [])];

  // Legacy Pass is SEASONAL (account-level), not per-life — preserve it across
  // prestige so a reset doesn't wipe the player's battle-pass progress.
  if (oldState.legacyPass) {
    newState.legacyPass = {
      ...oldState.legacyPass,
      claimedFreeTiers: [...(oldState.legacyPass.claimedFreeTiers || [])],
      claimedPremiumTiers: [...(oldState.legacyPass.claimedPremiumTiers || [])],
      ownedCosmetics: [...(oldState.legacyPass.ownedCosmetics || [])],
    };
  }
  
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

  // Preserve previous lives AND append the life that just ended. This was
  // copy-only before, so previousLives stayed permanently empty and the whole
  // Legacy Timeline UI, the IdentityCard generations counter, and the
  // secret_full_circle event never populated.
  newState.previousLives = [
    ...(oldState.previousLives || []),
    {
      generation: oldState.generationNumber || 1,
      netWorth: Math.round(netWorth(oldState)),
      ageAtDeath: Math.floor(oldState.date?.age || 0),
      deathReason: oldState.deathReason,
      timestamp: Date.now(),
      summaryAchievements: getEarnedAchievementNames(oldState),
      // Weeks lived when this life ended — feeds the prestige-speed achievements.
      weeksLivedAtEnd: oldState.weeksLived || 0,
    },
  ];

  // Preserve ribbon collection across prestiges
  newState.ribbonCollection = oldState.ribbonCollection;

  // Preserve discovered secrets across prestiges
  newState.discoveredSecrets = oldState.discoveredSecrets;

  // BUG FIX: Calculate and set legacy bonuses for lineage display
  // Legacy bonuses should be calculated from previous life's net worth and achievements
  // This ensures the "Inherited Bonuses" section shows correct values
  const previousNetWorth = netWorth(oldState);
  const completedAchievements = getEarnedAchievementCount(oldState);
  
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

  // Preserve the chosen Life Ambition — the prestige RESET keeps the SAME
  // character, so their aspiration carries over. Milestones + reward-claimed
  // are already reset via initialGameState, so it's a fresh run of the same
  // ambition. Without this, ambitionId was wiped and the feature went
  // permanently dark after the first prestige (there is no in-game re-picker).
  // The child/heir path deliberately does NOT copy it (the heir never chose one).
  if (oldState.ambitionId) {
    newState.ambitionId = oldState.ambitionId;
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

  // A purchase belongs to the PLAYER, not the character. `settings` above comes
  // from initialGameState, so without this every purchased entitlement flag —
  // Remove Ads, lifetime premium, the nine gem-bought gold upgrades, unspent
  // youth pills — was erased by prestige AND by the ungated death -> heir flow.
  // Carrying the DeepLife+ claim stamps also closes the printer that let a
  // player re-mint the 500-gem welcome bonus once per prestige.
  // 2026-07-30 audit MON-1/2/3, ECON-R1-01/02.
  carryAccountLevelEntitlements(oldState, newState);

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

  /**
   * C-11: Legacy Points and what they bought are LINEAGE data, not character
   * data, so both carry. `legacyPoints` is the lifetime total earned and
   * `legacyUpgrades` the ids bought; the spendable balance is the difference,
   * so carrying both means the heir keeps accumulating rather than starting
   * from zero with their parent's purchases already deducted.
   *
   * Bounded by construction: the upgrades are once-per-id unlocks, six of
   * them, so no amount of accumulation makes generation N strictly stronger
   * than generation N-1 forever. Compounding power is prestige's job.
   */
  newState.legacyPoints = oldState.legacyPoints || 0;
  newState.legacyUpgrades = [...(oldState.legacyUpgrades || [])];

  // ...and the heir actually starts with what was bought for them.
  const heirBonuses = heirStartingBonuses(newState.legacyUpgrades);
  if (heirBonuses.money > 0) {
    newState.stats.money = (newState.stats.money || 0) + heirBonuses.money;
  }
  if (heirBonuses.reputation > 0) {
    newState.stats.reputation = Math.min(100, (newState.stats.reputation || 0) + heirBonuses.reputation);
  }
  for (const [stat, amount] of Object.entries(heirBonuses.stats)) {
    const current = (newState.stats as unknown as Record<string, number>)[stat];
    if (typeof current === 'number' && typeof amount === 'number') {
      (newState.stats as unknown as Record<string, number>)[stat] = Math.min(100, current + amount);
    }
  }

  // Legacy Pass is SEASONAL (account-level) — carry it to the heir too.
  if (oldState.legacyPass) {
    newState.legacyPass = {
      ...oldState.legacyPass,
      claimedFreeTiers: [...(oldState.legacyPass.claimedFreeTiers || [])],
      claimedPremiumTiers: [...(oldState.legacyPass.claimedPremiumTiers || [])],
      ownedCosmetics: [...(oldState.legacyPass.ownedCosmetics || [])],
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
        // career.level is 0-indexed everywhere else (salary reads levels[level]
        // directly). The old `level - 1` mislabeled every promoted career one
        // rung low in the family tree. Clamp into bounds.
        const currentLevel = career.levels[Math.min(Math.max(0, career.level), career.levels.length - 1)] || career.levels[0];
        return currentLevel.name || 'Unknown';
      }
      return 'Unknown';
    })(),
    netWorth: currentNetWorth,
    causeOfDeath: 'Prestige',
    // Live store — the dead flag made every obituary and legacy summary list
    // no achievements at all. GP-3.
    achievements: [...(oldState.claimedProgressAchievements || [])],
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

  // Preserve previous lives AND append the life that just ended (heir path),
  // so the Legacy Timeline and generations counter populate across generations.
  newState.previousLives = [
    ...(oldState.previousLives || []),
    {
      generation: oldState.generationNumber || 1,
      netWorth: Math.round(netWorth(oldState)),
      ageAtDeath: Math.floor(oldState.date?.age || 0),
      deathReason: oldState.deathReason,
      timestamp: Date.now(),
      summaryAchievements: getEarnedAchievementNames(oldState),
      // Weeks lived when this life ended — feeds the prestige-speed achievements.
      weeksLivedAtEnd: oldState.weeksLived || 0,
    },
  ];

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

  // v13 Pulse: hatch the new life with a follower head start derived from
  // dynasty's accumulated peak followers. Formula: floor(carry × 0.001).
  // 1M lifetime peak across generations → ~1,000 starter followers next life.
  const carry = newState.dynastyStats?.pulseLifetimeFollowersCarry ?? 0;
  const starterFollowers = Math.floor(carry * 0.001);
  if (starterFollowers > 0 && newState.socialMedia) {
    newState.socialMedia = {
      ...newState.socialMedia,
      followers: (newState.socialMedia.followers || 0) + starterFollowers,
    };
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

  // Preserve only genuine extended family for the heir. The deceased's personal
  // relationships (spouse/partner/friend/parent/ex) must NOT carry over —
  // otherwise the heir starts already dating the deceased's romantic partner,
  // inherits stale-age "friends", keeps the wrong parents, and a leaked pregnant
  // partner produces a negative pregnancy duration (stuck pregnant forever).
  const DROP_FOR_HEIR = new Set(['spouse', 'partner', 'child', 'friend', 'parent', 'ex']);
  newState.relationships = (oldState.relationships || []).filter(
    r => !DROP_FOR_HEIR.has(r.type) && r.id !== selectedChild.id
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

