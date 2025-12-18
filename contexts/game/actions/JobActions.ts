/**
 * Job & Career Actions
 */
import { GameState, CrimeSkillId } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';

const log = logger.scope('JobActions');

export const performStreetJob = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  jobId: string,
  // We inject dependencies to avoid circular imports
  deps: {
    updateMoney: typeof updateMoney;
    updateStats: typeof updateStats;
    gainCriminalXp: (amount: number) => void;
    gainCrimeSkillXp: (skillId: CrimeSkillId, amount: number) => void;
  }
) => {
  const job = (gameState.streetJobs || []).find(j => j.id === jobId);
  if (!job) {
    log.error(`Street job not found: ${jobId}`);
    return { success: false, message: 'Job not found' };
  }

  // Check weekly limit - prevent spamming jobs
  const weeklyJobs = gameState.weeklyStreetJobs || {};
  const timesDoneThisWeek = weeklyJobs[jobId] || 0;
  const maxPerWeek = 3; // Allow each job to be done max 3 times per week
  
  if (timesDoneThisWeek >= maxPerWeek) {
    return { 
      success: false, 
      message: `You've already done "${job.name}" ${maxPerWeek} times this week. Advance to next week to do more.` 
    };
  }

  if (gameState.stats.energy < job.energyCost) {
    return { success: false, message: 'Not enough energy' };
  }

  // Check prerequisites - items
  if (job.requirements) {
    const items = gameState.items || [];
    const missingItems = job.requirements.filter(
      req => !items.find(item => item.id === req)?.owned
    );
    if (missingItems.length > 0) {
      const itemNames = missingItems.map(id => {
        const item = items.find(i => i.id === id);
        return item ? item.name : id;
      }).join(', ');
      return { 
        success: false, 
        message: `Missing required items: ${itemNames}` 
      };
    }
  }

  // Check prerequisites - dark web items (also check regular items for compatibility)
  if (job.darkWebRequirements) {
    const darkWebItems = gameState.darkWebItems || [];
    const items = gameState.items || [];
    const missingItems = job.darkWebRequirements.filter(
      req => {
        // Check both darkWebItems and regular items
        const darkWebItem = darkWebItems.find(item => item.id === req)?.owned;
        const regularItem = items.find(item => item.id === req)?.owned;
        return !darkWebItem && !regularItem;
      }
    );
    if (missingItems.length > 0) {
      const itemNames = missingItems.map(id => {
        const darkWebItem = darkWebItems.find(i => i.id === id);
        const regularItem = items.find(i => i.id === id);
        return darkWebItem ? darkWebItem.name : (regularItem ? regularItem.name : id);
      }).join(', ');
      return { 
        success: false, 
        message: `Missing required items: ${itemNames}` 
      };
    }
  }

  // Check criminal level requirement
  if (job.criminalLevelReq && gameState.criminalLevel < job.criminalLevelReq) {
    return { 
      success: false, 
      message: `Requires Criminal Level ${job.criminalLevelReq} (you are level ${gameState.criminalLevel})` 
    };
  }

  // Calculate success chance
  const baseSuccess = job.baseSuccessRate;
  const skillBonus = job.skill ? (gameState.crimeSkills[job.skill]?.level || 0) * 5 : 0;
  const successChance = Math.min(95, baseSuccess + skillBonus);
  // RANDOMNESS FIX: Pity system for street jobs - guaranteed success after 5 failures
  // Track consecutive failures per job (persists across weeks, resets on success)
  // PRIORITY 2 FIX: Use constant from randomnessConstants
  const { PITY_THRESHOLD_STREET_JOB } = require('@/lib/randomness/randomnessConstants');
  const pityThreshold = PITY_THRESHOLD_STREET_JOB; // Guaranteed success after 5 failures
  // Only count failures (success resets counter in state update below)
  const failureCount = gameState.streetJobFailureCount?.[jobId] || 0;
  const guaranteedSuccess = failureCount >= pityThreshold;
  const success = guaranteedSuccess ? true : Math.random() * 100 < successChance;

  // Calculate money - store original money BEFORE any changes
  const moneyBeforeJob = gameState.stats.money;
  const basePay = job.basePayment;
  const levelBonus = (gameState.criminalLevel - 1) * 0.1;
  
  // STABILITY FIX: Increase street job income by 50% for unemployed players
  // Street jobs are balanced for side income, but unemployed players need them as primary income
  // This prevents poverty trap where street jobs don't provide enough to survive
  const hasCareerJob = gameState.currentJob && gameState.currentJob.length > 0;
  const unemployedBonus = hasCareerJob ? 1.0 : 1.5; // 50% boost if no career job
  
  const moneyGained = success ? Math.round(basePay * (1 + levelBonus) * unemployedBonus) : 0;
  
  // Risk calculation
  const caughtChance = job.illegal ? (100 - successChance) / 2 : 0;
  const caught = Math.random() * 100 < caughtChance;
  
  // Calculate money lost from ORIGINAL money (before job), not after gaining money
  // This prevents taking 10% of an inflated amount if job succeeded
  // Also ensure we don't take more than the player actually has
  const moneyLost = caught ? Math.min(moneyBeforeJob, Math.round(moneyBeforeJob * 0.1)) : 0;

  // Apply effects - ensure we don't lose more than we have
  // If caught, apply money changes in the correct order: first gain (if any), then loss
  const netMoneyChange = moneyGained - moneyLost;
  
  // Calculate stat penalties based on job type
  // Illegal jobs: -7 happiness, -3 health
  // Dangerous jobs (jailWeeks >= 3 or wantedIncrease >= 3): -6 happiness, -4 health
  // Regular street jobs: -5 happiness, -2 health
  const isDangerous = (job.jailWeeks && job.jailWeeks >= 3) || (job.wantedIncrease && job.wantedIncrease >= 3);
  const happinessPenalty = job.illegal ? -7 : (isDangerous ? -6 : -5);
  const healthPenalty = job.illegal ? -3 : (isDangerous ? -4 : -2);
  
  // Debug logging
  log.info('Street job execution:', {
    jobId,
    moneyBeforeJob,
    moneyGained,
    moneyLost,
    netMoneyChange,
    caught,
    success,
    happinessPenalty,
    healthPenalty,
  });
  
  let message;
  if (caught) {
    // When caught, update everything in a single state update to prevent race conditions
    // Use moneyBeforeJob (snapshot) to ensure correct calculation, not prev.stats.money which might be stale
    setGameState(prev => {
      // Calculate final money from the snapshot we took at the start
      const finalMoney = Math.max(0, moneyBeforeJob + netMoneyChange);
      
      log.info('Updating state (caught):', {
        moneyBeforeJob,
        netMoneyChange,
        finalMoney,
        prevMoney: prev.stats.money,
      });
      
      return {
        ...prev,
        jailWeeks: job.jailWeeks || 1,
        wantedLevel: prev.wantedLevel + (job.wantedIncrease || 1),
        stats: {
          ...prev.stats,
          money: finalMoney, // Use calculated value from snapshot
          energy: Math.max(0, prev.stats.energy - job.energyCost),
          happiness: Math.max(0, Math.min(100, prev.stats.happiness + happinessPenalty)),
          health: Math.max(0, Math.min(100, prev.stats.health + healthPenalty)),
        },
      };
    });
    
    // Set caught message with penalty info
    const penaltyText = `This work took a toll on your wellbeing (${happinessPenalty} happiness, ${healthPenalty} health)`;
    if (moneyLost > 0) {
      message = `Caught! Jailed for ${job.jailWeeks} weeks. Lost $${moneyLost} in confiscated money. ${penaltyText}`;
    } else {
      message = `Caught! Jailed for ${job.jailWeeks} weeks. ${penaltyText}`;
    }
  } else {
    // Check if rank will increase (before state update)
    let rankIncreased = false;
    if (success) {
      const currentJob = (gameState.streetJobs || []).find(j => j.id === jobId);
      if (currentJob) {
        const newProgress = currentJob.progress + 1;
        const progressNeededForRankUp = 3; // Complete job 3 times to rank up
        rankIncreased = newProgress >= progressNeededForRankUp;
      }
    }
    
    // Not caught - update everything in a single state update to prevent race conditions
    setGameState(prev => {
      // Use moneyBeforeJob snapshot to ensure correct calculation
      const newMoney = Math.max(0, moneyBeforeJob + netMoneyChange);
      
      // Track weekly job usage
      const currentWeeklyJobs = prev.weeklyStreetJobs || {};
      const currentCount = currentWeeklyJobs[jobId] || 0;
      
      log.info('Updating state (not caught):', {
        moneyBeforeJob,
        netMoneyChange,
        newMoney,
        prevMoney: prev.stats.money,
      });
      
      // Update job progress and rank if successful
      const updatedStreetJobs = (prev.streetJobs || []).map(j => {
        if (j.id !== jobId) return j;
        
        // Only increase progress on successful completion
        if (success) {
          const newProgress = j.progress + 1;
          const progressNeededForRankUp = 3; // Complete job 3 times to rank up
          
          if (newProgress >= progressNeededForRankUp) {
            // Rank up and reset progress
            return {
              ...j,
              rank: j.rank + 1,
              progress: 0,
            };
          } else {
            // Just increase progress
            return {
              ...j,
              progress: newProgress,
            };
          }
        }
        
        return j;
      });
      
      // RANDOMNESS FIX: Track street job failures for pity system
      // Update failure count: reset on success, increment on failure
      //
      // SAFETY: This is safe because:
      // - State update is atomic (single setGameState call)
      // - Failure count is isolated per job (no cross-contamination)
      // - Counter persists across weeks (allows pity system to work over time)
      //
      // FRAGILE LOGIC WARNING:
      // - Failure count is updated AFTER success/failure is determined (correct order)
      // - If state update fails, failure count won't update (acceptable - retry will fix)
      // - No cleanup for old failure counts (acceptable - they decay naturally)
      //
      // FUTURE BUG RISK:
      // - If job is removed from streetJobs array, failure count becomes orphaned (acceptable - minor memory leak)
      // - If job ID changes, failure count is lost (shouldn't happen, but defensive code could check)
      const currentFailureCount = prev.streetJobFailureCount || {};
      const newFailureCount = success 
        ? { ...currentFailureCount, [jobId]: 0 } // Reset on success
        : { ...currentFailureCount, [jobId]: (currentFailureCount[jobId] || 0) + 1 }; // Increment on failure
      
      return {
        ...prev,
        streetJobs: updatedStreetJobs,
        weeklyStreetJobs: {
          ...currentWeeklyJobs,
          [jobId]: currentCount + 1,
        },
        streetJobFailureCount: newFailureCount,
        stats: {
          ...prev.stats,
          money: newMoney, // Use calculated value from snapshot
          energy: Math.max(0, prev.stats.energy - job.energyCost),
          happiness: Math.max(0, Math.min(100, prev.stats.happiness + happinessPenalty)),
          health: Math.max(0, Math.min(100, prev.stats.health + healthPenalty)),
        },
      };
    });
  }

  const events: string[] = [];

  if (job.illegal) {
    deps.gainCriminalXp(10);
  }

  if (job.skill) {
    deps.gainCrimeSkillXp(job.skill, success ? 15 : 5);
  }

  // Set message if not already set (i.e., if not caught)
  if (!caught) {
    if (success) {
      const penaltyText = `This work took a toll on your wellbeing (${happinessPenalty} happiness, ${healthPenalty} health)`;
      const rankUpText = rankIncreased ? ` Rank increased to ${job.rank + 1}!` : '';
      message = job.illegal
        ? `Crime succeeded! Gained $${moneyGained}.${rankUpText} ${penaltyText}`
        : `Earned $${moneyGained}!${rankUpText} ${penaltyText}`;
    } else {
      const penaltyText = `This work took a toll on your wellbeing (${happinessPenalty} happiness, ${healthPenalty} health)`;
      message = job.illegal
        ? `Crime failed. Wanted level increased. ${penaltyText}`
        : `No luck this time. ${penaltyText}`;
        
      if (job.illegal) {
        setGameState(prev => ({
          ...prev,
          wantedLevel: prev.wantedLevel + 1,
        }));
      }
    }
    
    // Handle combined cases (only if not caught)
    if (moneyLost > 0 && moneyGained > 0) {
      const penaltyText = `This work took a toll on your wellbeing (${happinessPenalty} happiness, ${healthPenalty} health)`;
      message = `Earned $${moneyGained} but robbed of $${moneyLost}. ${penaltyText}`;
    } else if (moneyLost > 0) {
      const penaltyText = `This work took a toll on your wellbeing (${happinessPenalty} happiness, ${healthPenalty} health)`;
      message = `Robbed! Lost $${moneyLost}. ${penaltyText}`;
    }
  }

  return {
    success,
    message,
    events,
    inJail: caught,
  };
};

export const gainCriminalXp = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  amount: number
) => {
  setGameState(prev => {
    const newXp = prev.criminalXp + amount;
    const nextLevelXp = prev.criminalLevel * 100;
    
    if (newXp >= nextLevelXp) {
      // Level up
      return {
        ...prev,
        criminalXp: newXp - nextLevelXp,
        criminalLevel: prev.criminalLevel + 1,
      };
    }
    
    return {
      ...prev,
      criminalXp: newXp,
    };
  });
};

export const gainCrimeSkillXp = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  skillId: CrimeSkillId,
  amount: number
) => {
  setGameState(prev => {
    const skill = prev.crimeSkills[skillId];
    if (!skill) return prev;

    const newXp = skill.xp + amount;
    const nextLevelXp = skill.level * 100;
    
    if (newXp >= nextLevelXp) {
      // Skill Level up
      return {
        ...prev,
        crimeSkills: {
          ...prev.crimeSkills,
          [skillId]: {
            ...skill,
            xp: newXp - nextLevelXp,
            level: skill.level + 1,
          },
        },
      };
    }
    
    return {
      ...prev,
      crimeSkills: {
        ...prev.crimeSkills,
        [skillId]: {
          ...skill,
          xp: newXp,
        },
      },
    };
  });
};


