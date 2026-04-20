/**
 * Political Actions
 * 
 * Core political gameplay mechanics
 */
import { GameState, PoliticsState } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';
import { POLITICAL_CAREER, POLITICAL_CAREER_REQUIREMENTS, canRunForOffice } from '@/lib/careers/political';
import { POLICIES, getPolicyById, calculatePolicyEffects } from '@/lib/politics/policies';
import { AVAILABLE_LOBBYISTS, getLobbyistById, calculateTotalLobbyistInfluence } from '@/lib/politics/lobbyists';
import { getNextElectionWeek } from '@/lib/politics/elections';
import type { Dispatch, SetStateAction } from 'react';
import { CAMPAIGN_MINIMUM_AMOUNT } from '@/lib/config/gameConstants';

const log = logger.scope('PoliticalActions');

/**
 * Calculate aggregated active policy effects from all enacted policies
 */
function calculateActivePolicyEffects(policiesEnacted: string[]): PoliticsState['activePolicyEffects'] {
  const effects: PoliticsState['activePolicyEffects'] = {
    stocks: { volatilityModifier: 1, dividendBonus: 0 },
    realEstate: { priceModifier: 1, rentModifier: 1 },
    education: { weeksReduction: 0, costReduction: 0 },
    crypto: { miningBonus: 0, priceStability: 0 },
    technology: { rdBonus: 0, patentBonus: 0 },
    healthcare: { healthBonus: 0, medicalCostReduction: 0 },
    transportation: { travelCostReduction: 0 },
  };

  policiesEnacted.forEach(policyId => {
    const policy = getPolicyById(policyId);
    if (!policy) return;

    // Aggregate stock effects
    if (policy.effects.stocks && effects.stocks) {
      if (policy.effects.stocks.volatilityModifier !== undefined) {
        effects.stocks.volatilityModifier *= policy.effects.stocks.volatilityModifier;
      }
      if (policy.effects.stocks.dividendBonus !== undefined) {
        effects.stocks.dividendBonus += policy.effects.stocks.dividendBonus;
      }
      if (policy.effects.stocks.companyBoost) {
        effects.stocks.companyBoost = [
          ...(effects.stocks.companyBoost || []),
          ...policy.effects.stocks.companyBoost,
        ];
      }
    }

    // Aggregate real estate effects
    if (policy.effects.realEstate && effects.realEstate) {
      if (policy.effects.realEstate.priceModifier !== undefined) {
        effects.realEstate.priceModifier *= policy.effects.realEstate.priceModifier;
      }
      if (policy.effects.realEstate.rentModifier !== undefined) {
        effects.realEstate.rentModifier *= policy.effects.realEstate.rentModifier;
      }
      if (policy.effects.realEstate.propertyTaxRate !== undefined) {
        effects.realEstate.propertyTaxRate = (effects.realEstate.propertyTaxRate || 0) + policy.effects.realEstate.propertyTaxRate;
      }
    }

    // Aggregate education effects (take maximum for weeks reduction, sum for cost reduction)
    if (policy.effects.education && effects.education) {
      if (policy.effects.education.weeksReduction !== undefined) {
        effects.education.weeksReduction = Math.max(
          effects.education.weeksReduction || 0,
          policy.effects.education.weeksReduction
        );
      }
      if (policy.effects.education.costReduction !== undefined) {
        effects.education.costReduction = Math.min(
          50,
          (effects.education.costReduction || 0) + policy.effects.education.costReduction
        );
      }
      if (policy.effects.education.scholarshipAmount !== undefined) {
        effects.education.scholarshipAmount = (effects.education.scholarshipAmount || 0) + policy.effects.education.scholarshipAmount;
      }
    }

    // Aggregate crypto effects
    if (policy.effects.crypto && effects.crypto) {
      if (policy.effects.crypto.miningBonus !== undefined) {
        effects.crypto.miningBonus += policy.effects.crypto.miningBonus;
      }
      if (policy.effects.crypto.priceStability !== undefined) {
        effects.crypto.priceStability = Math.min(1, (effects.crypto.priceStability || 0) + policy.effects.crypto.priceStability);
      }
      if (policy.effects.crypto.regulationLevel !== undefined) {
        effects.crypto.regulationLevel = (effects.crypto.regulationLevel || 0) + policy.effects.crypto.regulationLevel;
      }
    }

    // Aggregate technology effects
    if (policy.effects.technology && effects.technology) {
      if (policy.effects.technology.rdBonus !== undefined) {
        effects.technology.rdBonus += policy.effects.technology.rdBonus;
      }
      if (policy.effects.technology.patentBonus !== undefined) {
        effects.technology.patentBonus += policy.effects.technology.patentBonus;
      }
      if (policy.effects.technology.innovationGrants !== undefined) {
        effects.technology.innovationGrants = (effects.technology.innovationGrants || 0) + policy.effects.technology.innovationGrants;
      }
    }

    // Aggregate healthcare effects
    if (policy.effects.healthcare && effects.healthcare) {
      if (policy.effects.healthcare.healthBonus !== undefined) {
        effects.healthcare.healthBonus += policy.effects.healthcare.healthBonus;
      }
      if (policy.effects.healthcare.medicalCostReduction !== undefined) {
        effects.healthcare.medicalCostReduction = Math.min(
          50,
          (effects.healthcare.medicalCostReduction || 0) + policy.effects.healthcare.medicalCostReduction
        );
      }
    }

    // Aggregate transportation effects
    if (policy.effects.transportation && effects.transportation) {
      if (policy.effects.transportation.travelCostReduction !== undefined) {
        effects.transportation.travelCostReduction = Math.min(
          50,
          (effects.transportation.travelCostReduction || 0) + policy.effects.transportation.travelCostReduction
        );
      }
      if (policy.effects.transportation.commuteTimeReduction !== undefined) {
        effects.transportation.commuteTimeReduction = Math.min(
          50,
          (effects.transportation.commuteTimeReduction || 0) + policy.effects.transportation.commuteTimeReduction
        );
      }
    }
  });

  return effects;
}

export const runForOffice = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  office: 'council_member' | 'mayor' | 'state_representative' | 'governor' | 'senator' | 'president',
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  const requirements = POLITICAL_CAREER_REQUIREMENTS[office];
  let career = gameState.careers.find(c => c.id === 'political');
  
  // Create political career if it doesn't exist
  if (!career) {
    const newCareer = {
      ...POLITICAL_CAREER,
      level: 0,
      progress: 0,
      applied: false,
      accepted: false,
    };
    setGameState(prev => ({
      ...prev,
      careers: [...(prev.careers || []), newCareer],
    }));
    career = newCareer;
  }

  // Check if can run for office
  const hasEducation = (id: string) => 
    (gameState.educations || []).some(e => e.id === id && e.completed);
  
  const weeksInCurrentLevel = career.level > 0 ? career.progress : 0;
  
  // Check requirements individually to provide specific error messages
  if (gameState.date.age < requirements.minAge) {
    return { success: false, message: `You must be at least ${requirements.minAge} years old to run for this office. You are ${Math.floor(gameState.date.age)} years old.` };
  }
  
  if (gameState.stats.reputation < requirements.minReputation) {
    return { success: false, message: `You need at least ${requirements.minReputation} reputation to run for this office. You have ${gameState.stats.reputation} reputation.` };
  }
  
  if ('education' in requirements && requirements.education) {
    const missingEducation = requirements.education.filter(edu => !hasEducation(edu));
    if (missingEducation.length > 0) {
      const educationNames: Record<string, string> = {
        business_degree: 'Business Degree',
        law_degree: 'Law Degree',
        political_science: 'Political Science Degree',
      };
      const missingNames = missingEducation.map(edu => educationNames[edu] || edu).join(', ');
      return { success: false, message: `You need the following education: ${missingNames}` };
    }
  }
  
  if ('previousLevel' in requirements && requirements.previousLevel) {
    // Safe to use non-null assertion here because we checked requirements.previousLevel exists above
    const previousLevelStr = requirements.previousLevel;
    // Safe string split - ensure string is not empty
    const levelPrefix = previousLevelStr && previousLevelStr.length > 0
      ? previousLevelStr.split('_')[0]
      : '';
    
    const previousLevelIndex = levelPrefix
      ? POLITICAL_CAREER.levels.findIndex(
          l => l.name.toLowerCase().includes(levelPrefix)
        )
      : -1;
    
    // CRITICAL: Check if findIndex found a valid index (not -1) before accessing array
    if (previousLevelIndex >= 0 && career.level <= previousLevelIndex) {
      const previousOfficeName = POLITICAL_CAREER.levels[previousLevelIndex]?.name || requirements.previousLevel;
      return { success: false, message: `You must first serve as ${previousOfficeName} before running for this office.` };
    }
    if ('minWeeksInPrevious' in requirements && requirements.minWeeksInPrevious && weeksInCurrentLevel < requirements.minWeeksInPrevious) {
      const weeksNeeded = requirements.minWeeksInPrevious - weeksInCurrentLevel;
      return { success: false, message: `You need ${weeksNeeded} more weeks in your current position before running for this office.` };
    }
  }
  
  // Final check using canRunForOffice for safety
  if (!canRunForOffice(
    office,
    gameState.date.age,
    gameState.stats.reputation,
    career.level,
    weeksInCurrentLevel,
    hasEducation
  )) {
    return { success: false, message: 'You do not meet the requirements for this office' };
  }

  // Calculate campaign cost (based on office level)
  const campaignCosts = {
    council_member: 5000,
    mayor: 20000,
    state_representative: 50000,
    governor: 200000,
    senator: 500000,
    president: 2000000,
  };

  const campaignCost = campaignCosts[office];
  
  if (gameState.stats.money < campaignCost) {
    return { success: false, message: `You need $${campaignCost.toLocaleString()} to run for this office` };
  }

  // Pre-roll impure values before updater
  const electionRoll = Math.random() * 100;

  // Calculate election success chance (based on approval rating, reputation, karma, and campaign funds)
  const baseChance = 50;
  const approvalBonus = politics.approvalRating * 0.3;
  const reputationBonus = gameState.stats.reputation * 0.2;
  let karmaApprovalBonus = 0;
  if (gameState.karma) {
    const { getKarmaModifiers } = require('@/lib/karma/karmaSystem');
    karmaApprovalBonus = getKarmaModifiers(gameState.karma).politicalApprovalModifier;
  }
  const successChance = Math.min(95, baseChance + approvalBonus + reputationBonus + karmaApprovalBonus);

  const won = electionRoll < successChance;

  if (won) {
    // Determine new level based on office
    const levelMap: Record<string, number> = {
      council_member: 0,
      mayor: 1,
      state_representative: 2,
      governor: 3,
      senator: 4,
      president: 5,
    };

    const newLevel = levelMap[office];
    const currentWeek = gameState.weeksLived;
    const nextElection = getNextElectionWeek(currentWeek, newLevel as 0 | 1 | 2 | 3 | 4 | 5, currentWeek);

    // Calculate election win reward based on office level
    const electionRewards: Record<string, number> = {
      council_member: 10000,
      mayor: 50000,
      state_representative: 150000,
      governor: 500000,
      senator: 1000000,
      president: 5000000,
    };

    const reward = electionRewards[office] || 0;

    // Atomic: merge campaign cost + election reward + politics update into single update
    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: Math.max(0, prev.stats.money - campaignCost + reward),
      },
      careers: prev.careers.map(c => {
        if (c.id !== 'political') return c;
        return {
          ...c,
          level: newLevel,
          progress: 0,
        };
      }),
      politics: {
        ...prev.politics || {
          careerLevel: 0,
          approvalRating: 50,
          policyInfluence: 0,
          electionsWon: 0,
          policiesEnacted: [],
          activePolicies: [],
          lobbyists: [],
          alliances: [],
          campaignFunds: 0,
        },
        careerLevel: newLevel,
        electionsWon: (prev.politics?.electionsWon || 0) + 1,
        approvalRating: Math.min(100, (prev.politics?.approvalRating || 50) + 10),
        lastElectionWeek: currentWeek,
        nextElectionWeek: nextElection,
      },
      currentJob: 'political',
    }));

    log.info(`Won election for ${office}, now at level ${newLevel}, reward: $${reward}`);
    const rewardMessage = reward > 0 ? ` You received $${reward.toLocaleString()} as an election bonus!` : '';
    // Validate newLevel is within bounds before accessing levels array
    const safeLevel = Math.max(0, Math.min(newLevel, POLITICAL_CAREER.levels.length - 1));
    const levelName = POLITICAL_CAREER.levels[safeLevel]?.name || 'Unknown Office';
    return { success: true, message: `Congratulations! You won the election and are now ${levelName}!${rewardMessage}` };
  } else {
    // Lost election - deduct campaign cost + small approval hit
    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: Math.max(0, prev.stats.money - campaignCost),
      },
      politics: {
        ...prev.politics || {
          careerLevel: 0,
          approvalRating: 50,
          policyInfluence: 0,
          electionsWon: 0,
          policiesEnacted: [],
          lobbyists: [],
          alliances: [],
          campaignFunds: 0,
        },
        approvalRating: Math.max(0, (prev.politics?.approvalRating || 50) - 5),
      },
    }));

    log.info(`Lost election for ${office}`);
    return { success: false, message: 'You lost the election. Better luck next time!' };
  }
};

export const enactPolicy = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  policyId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  const policy = getPolicyById(policyId);
  if (!policy) {
    return { success: false, message: 'Policy not found' };
  }

  // Check if player has required level
  if (politics.careerLevel < policy.requiredLevel) {
    return { success: false, message: `You need to be at level ${policy.requiredLevel} to enact this policy` };
  }

  // Check if already enacted
  if (politics.policiesEnacted.includes(policyId)) {
    return { success: false, message: 'This policy is already enacted' };
  }

  // Check implementation cost
  if (gameState.stats.money < policy.implementationCost) {
    return { success: false, message: `You need $${policy.implementationCost.toLocaleString()} to implement this policy` };
  }

  // Apply approval impact
  const newApproval = Math.max(0, Math.min(100, politics.approvalRating + policy.approvalImpact));

  // Calculate active policy effects
  const updatedPoliciesEnacted = [...(politics.policiesEnacted || []), policyId];
  const activePolicyEffects = calculateActivePolicyEffects(updatedPoliciesEnacted);

  // Atomic: merge cost + stats effects + politics update into single update
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: Math.max(0, prev.stats.money - (policy.implementationCost || 0) + (policy.effects.money || 0)),
      happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) + (policy.effects.happiness || 0))),
      health: Math.max(0, Math.min(100, (prev.stats.health || 0) + (policy.effects.health || 0))),
      reputation: Math.max(0, Math.min(100, (prev.stats.reputation || 0) + (policy.effects.reputation || 0))),
    },
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        activePolicies: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      approvalRating: newApproval,
      policiesEnacted: updatedPoliciesEnacted,
      activePolicies: [
        ...(prev.politics?.activePolicies || []),
        {
          policyId,
          enactedWeek: prev.weeksLived || 0,
          expiresWeek: policy.duration ? (prev.weeksLived || 0) + policy.duration : undefined,
        },
      ],
      policyInfluence: Math.min(100, (prev.politics?.policyInfluence || 0) + 5),
      activePolicyEffects,
    },
  }));

  log.info(`Enacted policy: ${policy.name}`);
  return { success: true, message: `Policy "${policy.name}" has been enacted!` };
};

export const lobby = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  policyId: string,
  amount: number,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const policy = getPolicyById(policyId);
  if (!policy) {
    return { success: false, message: 'Policy not found' };
  }

  if (gameState.stats.money < amount) {
    return { success: false, message: 'Insufficient funds' };
  }

  if (amount < 1000) {
    return { success: false, message: 'Minimum lobbying amount is $1,000' };
  }

  // Increase policy influence (lobbying makes policies easier to pass)
  const influenceGain = Math.min(10, Math.floor(amount / 10000));

  // Atomic: merge money deduction + influence update into single update
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: Math.max(0, prev.stats.money - amount),
    },
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      policyInfluence: Math.min(100, (prev.politics?.policyInfluence || 0) + influenceGain),
    },
  }));

  log.info(`Lobbied for ${policy.name} with $${amount}`);
  return { success: true, message: `Lobbied for ${policy.name}. Policy influence increased!` };
};

export const joinParty = (
  _gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  party: 'democratic' | 'republican' | 'independent'
): { success: boolean; message: string } => {
  setGameState(prev => ({
    ...prev,
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      party,
      approvalRating: Math.min(100, (prev.politics?.approvalRating || 50) + 5),
    },
  }));

  log.info(`Joined ${party} party`);
  return { success: true, message: `You joined the ${party} party!` };
};

export const formAlliance = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  characterId: string,
  characterName: string
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  // Check if already allied
  if (politics.alliances.some(a => a.characterId === characterId)) {
    return { success: false, message: 'You already have an alliance with this character' };
  }

  const allianceTimestamp = Date.now();
  setGameState(prev => ({
    ...prev,
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      alliances: [
        ...(prev.politics?.alliances || []),
        {
          id: `alliance_${characterId}_${allianceTimestamp}`,
          characterId,
          name: characterName,
          influence: 10,
          formedWeek: prev.weeksLived || 0,
        },
      ],
      approvalRating: Math.min(100, (prev.politics?.approvalRating || 50) + 3),
    },
  }));

  log.info(`Formed alliance with ${characterName}`);
  return { success: true, message: `Formed political alliance with ${characterName}!` };
};

export const campaign = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  amount: number,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  if (gameState.stats.money < amount) {
    return { success: false, message: 'Insufficient funds' };
  }

  if (amount < CAMPAIGN_MINIMUM_AMOUNT) {
    return { success: false, message: `Minimum campaign amount is $${CAMPAIGN_MINIMUM_AMOUNT}` };
  }

  // Increase approval rating (diminishing returns)
  const approvalGain = Math.min(10, Math.floor(amount / 5000));

  // Atomic: merge money deduction + politics update into single update
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: Math.max(0, prev.stats.money - amount),
    },
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      approvalRating: Math.min(100, (prev.politics?.approvalRating || 50) + approvalGain),
      campaignFunds: (prev.politics?.campaignFunds || 0) + amount,
    },
  }));

  log.info(`Campaign spending: $${amount}, approval gain: ${approvalGain}`);
  return { success: true, message: `Campaign spending increased your approval rating by ${approvalGain}!` };
};

export const hireLobbyist = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  lobbyistId: string,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  const lobbyist = getLobbyistById(lobbyistId);
  if (!lobbyist) {
    return { success: false, message: 'Lobbyist not found' };
  }

  // Check if already hired
  if (politics.lobbyists.some(l => l.id === lobbyistId)) {
    return { success: false, message: 'This lobbyist is already hired' };
  }

  // Check if player has enough money
  if (gameState.stats.money < lobbyist.cost) {
    return { success: false, message: `You need $${lobbyist.cost.toLocaleString()} to hire ${lobbyist.name}` };
  }

  // Add lobbyist to list
  const newLobbyist = {
    id: lobbyist.id,
    name: lobbyist.name,
    cost: lobbyist.cost,
    influence: lobbyist.influence,
    active: true,
  };

  // Atomic: merge money deduction + lobbyist addition into single update
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: Math.max(0, prev.stats.money - lobbyist.cost),
    },
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      lobbyists: [...(prev.politics?.lobbyists || []), newLobbyist],
      policyInfluence: Math.min(100, (prev.politics?.policyInfluence || 0) + lobbyist.influence),
    },
  }));

  log.info(`Hired lobbyist: ${lobbyist.name}`);
  return { success: true, message: `Successfully hired ${lobbyist.name}! Policy influence increased by ${lobbyist.influence}.` };
};

export const fireLobbyist = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  lobbyistId: string
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  const lobbyist = politics.lobbyists.find(l => l.id === lobbyistId);
  if (!lobbyist) {
    return { success: false, message: 'Lobbyist not found' };
  }

  // Remove lobbyist and recalculate influence
  const remainingLobbyists = politics.lobbyists.filter(l => l.id !== lobbyistId);
  const remainingIds = remainingLobbyists.map(l => l.id);
  const totalInfluence = calculateTotalLobbyistInfluence(remainingIds);

  setGameState(prev => ({
    ...prev,
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      lobbyists: remainingLobbyists,
      policyInfluence: Math.max(0, Math.min(100, totalInfluence)),
    },
  }));

  log.info(`Fired lobbyist: ${lobbyist.name}`);
  return { success: true, message: `Fired ${lobbyist.name}. Policy influence decreased by ${lobbyist.influence}.` };
};

// Export calculateActivePolicyEffects for use in GameActionsContext
export { calculateActivePolicyEffects };

