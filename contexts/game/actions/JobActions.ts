/**
 * Job & Career Actions
 */
import React from 'react';
import { GameState, CrimeSkillId } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';
import { commitDeterministicRolls, getDeterministicRoll } from '@/lib/randomness/deterministicRng';
import { applyKarmaChange, KARMA_ACTIONS, INITIAL_KARMA } from '@/lib/karma/karmaSystem';

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

  // ANTI-EXPLOIT: Global weekly street job cap (prevent farming 30+ jobs/week across all job types)
  const MAX_TOTAL_STREET_JOBS_PER_WEEK = 8;
  const totalStreetJobsThisWeek = Object.values(weeklyJobs).reduce((sum: number, count) => sum + (typeof count === 'number' ? count : 0), 0);
  if (totalStreetJobsThisWeek >= MAX_TOTAL_STREET_JOBS_PER_WEEK) {
    return {
      success: false,
      message: `You've already done ${MAX_TOTAL_STREET_JOBS_PER_WEEK} street jobs this week. Rest up and try again next week.`
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

  // Calculate success chance (karma affects crime success for experienced criminals)
  const baseSuccess = job.baseSuccessRate;
  const skillBonus = job.skill ? (gameState.crimeSkills[job.skill]?.level || 0) * 5 : 0;
  let karmaBonus = 0;
  if (gameState.karma) {
    const { getKarmaModifiers } = require('@/lib/karma/karmaSystem');
    const modifiers = getKarmaModifiers(gameState.karma);
    karmaBonus = Math.round(modifiers.crimeSuccessBonus * 100);
  }
  const successChance = Math.min(95, baseSuccess + skillBonus + karmaBonus);
  const attemptNumber = timesDoneThisWeek + 1;
  const rngCommitKeys: string[] = [];
  // RANDOMNESS FIX: Pity system for street jobs - guaranteed success after 5 failures
  // Track consecutive failures per job (persists across weeks, resets on success)
  // PRIORITY 2 FIX: Use constant from randomnessConstants
  const { PITY_THRESHOLD_STREET_JOB } = require('@/lib/randomness/randomnessConstants');
  const pityThreshold = PITY_THRESHOLD_STREET_JOB; // Guaranteed success after 5 failures
  // Only count failures (success resets counter in state update below)
  const failureCount = gameState.streetJobFailureCount?.[jobId] || 0;
  const guaranteedSuccess = failureCount >= pityThreshold;
  const successRollKey = `street_job_success:${gameState.weeksLived || 0}:${jobId}:attempt:${attemptNumber}`;
  const successRoll = guaranteedSuccess ? null : getDeterministicRoll(gameState, successRollKey);
  if (!guaranteedSuccess) {
    rngCommitKeys.push(successRollKey);
  }
  const success = guaranteedSuccess ? true : ((successRoll || 0) * 100 < successChance);

  // Calculate money - store original money BEFORE any changes
  const moneyBeforeJob = gameState.stats.money;
  const basePay = job.basePayment;
  const levelBonus = (gameState.criminalLevel - 1) * 0.1;
  
  // STABILITY FIX: Increase street job income by 50% for unemployed players
  // Street jobs are balanced for side income, but unemployed players need them as primary income
  // This prevents poverty trap where street jobs don't provide enough to survive
  const hasCareerJob = !!gameState.currentJob && gameState.currentJob.length > 0;
  const unemployedBonus = hasCareerJob ? 1.0 : 1.5; // 50% boost if no career job
  
  const moneyGained = success ? Math.round(basePay * (1 + levelBonus) * unemployedBonus) : 0;
  
  // Risk calculation — wanted level increases arrest chance
  const wantedLevel = gameState.wantedLevel || 0;
  const baseCaughtChance = job.illegal ? (100 - successChance) / 2 : 0;
  const wantedBonus = job.illegal ? Math.min(25, wantedLevel * 3) : 0; // +3% per wanted level, cap 25%
  const caughtChance = Math.min(80, baseCaughtChance + wantedBonus); // Cap at 80%
  const caughtRollKey = `street_job_caught:${gameState.weeksLived || 0}:${jobId}:attempt:${attemptNumber}`;
  const caughtRoll = caughtChance > 0 ? getDeterministicRoll(gameState, caughtRollKey) : null;
  if (caughtChance > 0) {
    rngCommitKeys.push(caughtRollKey);
  }
  const caught = caughtChance > 0 ? ((caughtRoll || 0) * 100 < caughtChance) : false;
  
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
  let rankIncreased = false;
  if (caught) {
    // When caught, update everything in a single state update to prevent race conditions
    // Use prev.stats.money (fresh from updater) — moneyBeforeJob is a stale render-time snapshot
    setGameState(prev => {
      // Recalculate money lost from fresh prev state to avoid stale-closure race
      const prevMoney = prev.stats.money;
      const freshMoneyLost = caught ? Math.min(prevMoney, Math.round(prevMoney * 0.1)) : 0;
      const freshNetChange = moneyGained - freshMoneyLost;
      const finalMoney = Math.max(0, prevMoney + freshNetChange);

      log.info('Updating state (caught):', {
        prevMoney,
        freshNetChange,
        finalMoney,
      });

      // Track street job failures for pity system (same pattern as not-caught path)
      const currentFailureCount = prev.streetJobFailureCount || {};
      const newFailureCount = success
        ? { ...currentFailureCount, [jobId]: 0 }
        : { ...currentFailureCount, [jobId]: (currentFailureCount[jobId] || 0) + 1 };
      const nextRngCommitLog = commitDeterministicRolls(prev, rngCommitKeys, prev.weeksLived || 0);

      return {
        ...prev,
        jailWeeks: job.jailWeeks || 1,
        wantedLevel: prev.wantedLevel + (job.wantedIncrease || 1),
        streetJobFailureCount: newFailureCount,
        streetJobsCompleted: prev.streetJobsCompleted || 0, // Don't count caught jobs as completed
        rngCommitLog: nextRngCommitLog,
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
      // Use prev.stats.money (fresh from updater) to avoid stale-closure race
      const newMoney = Math.max(0, prev.stats.money + moneyGained);

      // Track weekly job usage
      const currentWeeklyJobs = prev.weeklyStreetJobs || {};
      const currentCount = currentWeeklyJobs[jobId] || 0;

      log.info('Updating state (not caught):', {
        moneyGained,
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
      const nextRngCommitLog = commitDeterministicRolls(prev, rngCommitKeys, prev.weeksLived || 0);
      
      // Merge karma + wantedLevel changes atomically (avoids separate setGameState calls)
      let updatedKarma = prev.karma || INITIAL_KARMA;
      let updatedWantedLevel = prev.wantedLevel || 0;

      if (job.illegal && success) {
        const karmaAction = job.rank >= 3 ? KARMA_ACTIONS.COMMIT_SERIOUS_CRIME : KARMA_ACTIONS.COMMIT_CRIME;
        updatedKarma = applyKarmaChange(updatedKarma, karmaAction.dimension, karmaAction.amount, karmaAction.reason, prev.weeksLived);
      }
      if (job.illegal && !success) {
        updatedWantedLevel = updatedWantedLevel + 1;
      }

      return {
        ...prev,
        streetJobs: updatedStreetJobs,
        weeklyStreetJobs: {
          ...currentWeeklyJobs,
          [jobId]: currentCount + 1,
        },
        streetJobFailureCount: newFailureCount,
        streetJobsCompleted: (prev.streetJobsCompleted || 0) + (success ? 1 : 0),
        rngCommitLog: nextRngCommitLog,
        karma: updatedKarma,
        wantedLevel: updatedWantedLevel,
        stats: {
          ...prev.stats,
          money: newMoney,
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

/**
 * Apply for a career job
 * Checks requirements and applies with acceptance chance
 */
export const applyForJob = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  careerId: string
): { success: boolean; message: string } | void => {
  const career = gameState.careers.find(c => c.id === careerId);
  if (!career) {
    log.error(`Career not found: ${careerId}`);
    return { success: false, message: 'Career not found' };
  }

  // Check if already applied
  if (career.applied) {
    return { success: false, message: 'You have already applied for this job' };
  }

  // Check if already have a job
  if (gameState.currentJob) {
    return { success: false, message: 'You already have a job. Quit your current job first.' };
  }

  // Check if there's a pending application
  const pendingApplication = gameState.careers.some(c => c.applied && !c.accepted);
  if (pendingApplication) {
    return { success: false, message: 'You have a pending application. Wait for a response first.' };
  }

  // Check requirements
  const requirements = career.requirements;
  
  // Check fitness requirement
  if ('fitness' in requirements && requirements.fitness) {
    if ((gameState.stats.fitness || 0) < requirements.fitness) {
      return { 
        success: false, 
        message: `Requires Fitness ${requirements.fitness}+ (you have ${gameState.stats.fitness || 0})` 
      };
    }
  }

  // Check item requirements
  if ('items' in requirements && requirements.items && requirements.items.length > 0) {
    const missingItems = requirements.items.filter(itemId => {
      const item = gameState.items.find(i => i.id === itemId);
      return !item?.owned;
    });
    if (missingItems.length > 0) {
      const itemNames = missingItems.map(id => {
        const item = gameState.items.find(i => i.id === id);
        return item ? item.name : id;
      }).join(', ');
      return { success: false, message: `Missing required items: ${itemNames}` };
    }
  }

  // Check education requirements
  if ('education' in requirements && requirements.education && requirements.education.length > 0) {
    // Check for early career access bonus
    let hasEarlyAccess = false;
    try {
      const { hasEarlyCareerAccess } = require('@/lib/prestige/applyUnlocks');
      const unlockedBonuses = gameState.prestige?.unlockedBonuses || [];
      hasEarlyAccess = hasEarlyCareerAccess(unlockedBonuses);
    } catch {
      // Ignore if module not found
    }

    if (!hasEarlyAccess) {
      const missingEducation = requirements.education.filter(eduId => {
        const education = gameState.educations.find(e => e.id === eduId);
        return !education?.completed;
      });
      if (missingEducation.length > 0) {
        const eduNames = missingEducation.map(id => {
          const edu = gameState.educations.find(e => e.id === id);
          return edu ? edu.name : id;
        }).join(', ');
        return { success: false, message: `Missing required education: ${eduNames}` };
      }
    }
  }

  // All requirements met - apply for the job
  const applicationAttempts = (career.applicationAttempts || 0) + 1;

  // ANTI-EXPLOIT: Pity system - guaranteed acceptance after 5 attempts (was 3 - too generous)
  // Prevents bypassing all skill requirements by just applying 3 times
  const guaranteedAcceptance = applicationAttempts >= 5;

  // Criminal record penalty: high wanted level or criminal level reduces hiring chance
  // Represents employers doing background checks
  const criminalLevel = gameState.criminalLevel || 0;
  const wantedLevel = gameState.wantedLevel || 0;
  const criminalPenalty = Math.min(30, criminalLevel * 5 + wantedLevel * 2);

  // Base acceptance chance (50% for first attempt, increases with attempts)
  const baseAcceptanceChance = 50;
  const acceptanceChance = guaranteedAcceptance ? 100 : Math.min(90, Math.max(10, baseAcceptanceChance + (applicationAttempts - 1) * 8 - criminalPenalty));
  const applicationRollKey = `job_application:${gameState.weeksLived || 0}:${careerId}:attempt:${applicationAttempts}`;
  const applicationRoll = guaranteedAcceptance ? null : getDeterministicRoll(gameState, applicationRollKey);
  const rngCommitKeys: string[] = guaranteedAcceptance ? [] : [applicationRollKey];
  const accepted = guaranteedAcceptance || ((applicationRoll || 0) * 100 < acceptanceChance);

  setGameState(prev => {
    const updatedCareers = prev.careers.map(c => {
      if (c.id !== careerId) return c;
      
      return {
        ...c,
        applied: true,
        accepted: accepted,
        applicationAttempts: applicationAttempts,
        // If not immediately accepted, start tracking weeks pending
        applicationWeeksPending: accepted ? undefined : 0,
      };
    });

    // If accepted, set as current job
    const newCurrentJob = accepted ? careerId : prev.currentJob;
    const nextRngCommitLog = commitDeterministicRolls(prev, rngCommitKeys, prev.weeksLived || 0);

    return {
      ...prev,
      careers: updatedCareers,
      currentJob: newCurrentJob,
      rngCommitLog: nextRngCommitLog,
    };
  });

  if (accepted) {
    log.info(`Job application accepted: ${careerId}`, { applicationAttempts });
    // Validate career.level is within bounds before accessing levels array
    const safeLevel = career.levels && career.levels.length > 0 
      ? Math.max(0, Math.min(career.level, career.levels.length - 1))
      : 0;
    const levelName = career.levels?.[safeLevel]?.name || careerId;
    return { 
      success: true, 
      message: `Congratulations! You've been accepted for ${levelName}. You start immediately!` 
    };
  } else {
    log.info(`Job application submitted: ${careerId}`, { applicationAttempts, acceptanceChance });
    // Validate career.level is within bounds before accessing levels array
    const safeLevel = career.levels && career.levels.length > 0 
      ? Math.max(0, Math.min(career.level, career.levels.length - 1))
      : 0;
    const levelName = career.levels?.[safeLevel]?.name || careerId;
    return { 
      success: true, 
      message: `Application submitted for ${levelName}. You'll hear back in 1-2 weeks.` 
    };
  }
};

/**
 * Promote a career to the next level
 * Called when career progress reaches 100%
 */
export const promoteCareer = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  careerId: string
): { success: boolean; message: string } => {
  const career = gameState.careers.find(c => c.id === careerId);
  if (!career) {
    log.error(`Career not found: ${careerId}`);
    return { success: false, message: 'Career not found' };
  }

  // Check if career is accepted
  if (!career.accepted) {
    return { success: false, message: 'You must be working in this career to get promoted' };
  }

  // Check if already at max level
  if (career.level >= career.levels.length - 1) {
    return { success: false, message: 'You have reached the maximum level for this career' };
  }

  // Check if progress is at 100%
  if (career.progress < 100) {
    return { success: false, message: `Progress must be 100% to promote. Current: ${career.progress}%` };
  }

  // Promote to next level
  const newLevel = career.level + 1;
  const levelData = career.levels[newLevel];
  
  if (!levelData) {
    log.error(`Level data not found for level ${newLevel} in career ${careerId}`);
    return { success: false, message: 'Invalid career level' };
  }

  setGameState(prev => {
    const updatedCareers = prev.careers.map(c => {
      if (c.id !== careerId) return c;
      
      return {
        ...c,
        level: newLevel,
        progress: 0, // Reset progress after promotion
      };
    });

    return {
      ...prev,
      careers: updatedCareers,
    };
  });

  log.info(`Career promoted: ${careerId} to level ${newLevel} (${levelData.name})`);
  return { 
    success: true, 
    message: `Congratulations! You've been promoted to ${levelData.name}! Your new salary is $${levelData.salary}/week.` 
  };
};


