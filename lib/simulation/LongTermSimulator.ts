/**
 * Long-Term Game Simulator
 * Simulates extended gameplay (500+ weeks) to find bugs that only appear after long play
 */

import { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import React from 'react';

const log = logger.scope('LongTermSimulator');

export interface LongTermSimulationReport {
  weeksSimulated: number;
  issuesFound: number;
  stateSnapshots: { week: number; issues: string[] }[];
  finalState: GameState;
  statistics: {
    maxMoney: number;
    minMoney: number;
    maxWeek: number;
    finalWeeksLived: number;
  };
  errors: { week: number; error: string }[];
}

export type SimulationSpeed = 'fast' | 'normal' | 'slow';

export function getSimulationDelay(speed: SimulationSpeed): number {
  switch (speed) {
    case 'fast':
      return 1; // Minimal delay
    case 'normal':
      return 5; // Small delay for state updates
    case 'slow':
      return 20; // Longer delay for thorough testing
    default:
      return 5;
  }
}

export class LongTermSimulator {
  /**
   * Simulate long-term gameplay
   */
  async simulateLongTerm(
    initialGameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    weeksToSimulate: number,
    speed: SimulationSpeed = 'normal',
    saveGame?: () => Promise<void>,
    saveInterval: number = 5
  ): Promise<LongTermSimulationReport> {
    log.info(`Starting long-term simulation: ${weeksToSimulate} weeks`);
    
    // Helper to save periodically
    const maybeSave = async (week: number) => {
      if (saveGame && saveInterval > 0 && week % saveInterval === 0 && week > 0) {
        try {
          await saveGame();
          log.debug(`[LongTermSim] Game saved at week ${week}`);
        } catch (error: any) {
          log.warn('[LongTermSim] Save failed:', error?.message || error);
        }
      }
    };
    
    // Create a copy of the initial state and reset weeksLived to 0 for accurate tracking
    const initialStateCopy = JSON.parse(JSON.stringify(initialGameState));
    initialStateCopy.weeksLived = 0; // Reset to 0 for accurate week counting
    let currentState: GameState = initialStateCopy;
    
    // Track state over time
    const stateSnapshots: { week: number; issues: string[] }[] = [];
    const errors: { week: number; error: string }[] = [];
    let totalIssues = 0;
    let maxMoney = currentState.stats?.money || 0;
    let minMoney = currentState.stats?.money || 0;
    let maxWeek = currentState.week || 1;
    
    // IMPROVEMENT: Track failed actions to avoid retrying
    const failedActions = new Set<string>(); // Track failed action IDs (e.g., "applyForJob:teacher")
    const failedJobIds = new Set<string>(); // Track jobs that failed due to missing requirements
    
    // Validation helpers
    const checkForNaN = (state: GameState): string[] => {
      const issues: string[] = [];
      if (isNaN(state.stats.money)) issues.push('stats.money');
      if (isNaN(state.stats.health)) issues.push('stats.health');
      if (isNaN(state.stats.happiness)) issues.push('stats.happiness');
      if (isNaN(state.week)) issues.push('week');
      if (isNaN(state.weeksLived)) issues.push('weeksLived');
      return issues;
    };
    
    const checkForInfinity = (state: GameState): string[] => {
      const issues: string[] = [];
      if (!isFinite(state.stats.money)) issues.push('stats.money');
      if (!isFinite(state.stats.health)) issues.push('stats.health');
      if (!isFinite(state.stats.happiness)) issues.push('stats.happiness');
      if (!isFinite(state.week)) issues.push('week');
      if (!isFinite(state.weeksLived)) issues.push('weeksLived');
      return issues;
    };
    
    const validateRelationships = (state: GameState): string[] => {
      const issues: string[] = [];
      if (!state.relationships || !Array.isArray(state.relationships)) {
        return issues;
      }
      state.relationships.forEach(rel => {
        if (typeof rel.relationshipScore !== 'number' || isNaN(rel.relationshipScore)) {
          issues.push(`${rel.id}: invalid relationshipScore`);
        } else if (rel.relationshipScore < 0 || rel.relationshipScore > 100) {
          issues.push(`${rel.id}: relationshipScore out of bounds (${rel.relationshipScore})`);
        }
      });
      return issues;
    };
    
    // Hobbies removed - no longer validating
    const validateHobbies = (_state: GameState): string[] => {
      return [];
    };
    
    // Simulate weeks
    for (let week = 0; week < weeksToSimulate; week++) {
      try {
        // Update state reference
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        
        // Track actions per week to prevent duplicates
        let cryptoPurchasedThisWeek = false;
        
        // Perform multiple random actions before advancing to next week
        // Do 2-5 actions per week to simulate realistic gameplay
        const numActionsThisWeek = 2 + Math.floor(Math.random() * 4); // 2-5 actions
        
        for (let actionIndex = 0; actionIndex < numActionsThisWeek; actionIndex++) {
          try {
            // Update state reference before each action
            setGameState(prev => {
              currentState = prev;
              return prev;
            });
            
            const money = currentState.stats?.money || 0;
            let actionPerformed = false;
            
            // Log action attempt for debugging (every 10 weeks, first action)
            if (week % 10 === 0 && actionIndex === 0) {
              log.info(`[LongTermSim] Week ${week + 1}, Action ${actionIndex + 1}, Money: $${money.toLocaleString()}, Health: ${currentState.stats?.health?.toFixed(1)}, Happiness: ${currentState.stats?.happiness?.toFixed(1)}, Job: ${currentState.currentJob || 'None'}`);
            }
            
            // ============================================
            // AGGRESSIVE EXPLOIT-SEEKING STRATEGY
            // Prioritize highest ROI investments first
            // ============================================
            
            // PRIORITY 1: Unlock essential items (computer, smartphone) - CRITICAL for accessing apps
            if (!actionPerformed && currentState.items && Array.isArray(currentState.items)) {
              const computer = currentState.items.find(item => item.id === 'computer' && !item.owned);
              const smartphone = currentState.items.find(item => item.id === 'smartphone' && !item.owned);
              if (computer && computer.price <= money && typeof gameActions.buyItem === 'function') {
                gameActions.buyItem('computer');
                await maybeSave(week + 1);
                await new Promise(resolve => setTimeout(resolve, 5));
                actionPerformed = true;
                continue;
              }
              if (!actionPerformed && smartphone && smartphone.price <= money && typeof gameActions.buyItem === 'function') {
                gameActions.buyItem('smartphone');
                await maybeSave(week + 1);
                await new Promise(resolve => setTimeout(resolve, 5));
                actionPerformed = true;
                continue;
              }
            }
            
            // PRIORITY 2: EDUCATION - Unlock education to access better opportunities (SMART: prioritize by ROI)
            // Education unlocks better jobs, companies, and other opportunities
            if (!actionPerformed && currentState.educations && Array.isArray(currentState.educations)) {
              // Check if we need education for failed jobs
              const neededEducationIds = new Set<string>();
              for (const jobId of failedJobIds) {
                const career = currentState.careers.find(c => c.id === jobId);
                if (career && 'education' in career.requirements && career.requirements.education && Array.isArray(career.requirements.education)) {
                  career.requirements.education.forEach((eduId: string) => neededEducationIds.add(eduId));
                }
              }
              
              // Prioritize: entrepreneurship (for companies) > needed education for jobs > cheapest available
              let educationToStart = currentState.educations.find(edu => 
                edu.id === 'entrepreneurship' && !edu.completed && edu.cost <= money
              );
              
              if (!educationToStart) {
                // Find education needed for failed jobs
                educationToStart = currentState.educations.find(edu => 
                  neededEducationIds.has(edu.id) && !edu.completed && edu.cost <= money
                );
              }
              
              if (!educationToStart) {
                // Find cheapest available education
                const availableEducation = currentState.educations.filter(edu => !edu.completed && edu.cost <= money);
                if (availableEducation.length > 0) {
                  educationToStart = availableEducation.reduce((cheapest, edu) => 
                    edu.cost < cheapest.cost ? edu : cheapest
                  );
                }
              }
              
              if (educationToStart && typeof gameActions.startEducation === 'function') {
                gameActions.startEducation(educationToStart.id);
                await maybeSave(week + 1);
                await new Promise(resolve => setTimeout(resolve, 5));
                actionPerformed = true;
                continue;
              }
            }
            
            // PRIORITY 3: Buy warehouse if don't have one (required for mining - HIGH ROI)
            if (!actionPerformed && !currentState.warehouse && money >= 50000 && typeof gameActions.buyWarehouse === 'function') {
              gameActions.buyWarehouse();
              await maybeSave(week + 1);
              await new Promise(resolve => setTimeout(resolve, 5));
              actionPerformed = true;
              continue;
            }
            
            // PRIORITY 4: MAXIMIZE MINERS - Buy best affordable miner (AGGRESSIVE: spend up to 80% of money)
            if (!actionPerformed && currentState.warehouse && money >= 2500) {
              const currentMiners = Object.values(currentState.warehouse.miners || {}).reduce((sum, count) => sum + (count || 0), 0);
              const maxCapacity = 10 + ((currentState.warehouse.level || 1) - 1) * 5;
              
              if (currentMiners < maxCapacity && typeof gameActions.buyMiner === 'function') {
                // AGGRESSIVE: Buy best miner we can afford (up to 80% of money)
                const maxSpend = Math.floor(money * 0.8);
                let minerToBuy: { id: string; name: string; price: number } | null = null;
                
                // Buy best miner we can afford
                if (maxSpend >= 50000000) minerToBuy = { id: 'tera', name: 'Tera Miner', price: 50000000 };
                else if (maxSpend >= 10000000) minerToBuy = { id: 'giga', name: 'Giga Miner', price: 10000000 };
                else if (maxSpend >= 2500000) minerToBuy = { id: 'mega', name: 'Mega Miner', price: 2500000 };
                else if (maxSpend >= 500000) minerToBuy = { id: 'quantum', name: 'Quantum Miner', price: 500000 };
                else if (maxSpend >= 125000) minerToBuy = { id: 'industrial', name: 'Industrial Miner', price: 125000 };
                else if (maxSpend >= 40000) minerToBuy = { id: 'pro', name: 'Pro Miner', price: 40000 };
                else if (maxSpend >= 10000) minerToBuy = { id: 'advanced', name: 'Advanced Miner', price: 10000 };
                else if (maxSpend >= 2500) minerToBuy = { id: 'basic', name: 'Basic Miner', price: 2500 };
                
                if (minerToBuy && money >= minerToBuy.price) {
                  gameActions.buyMiner(minerToBuy.id, minerToBuy.name, minerToBuy.price);
                  await maybeSave(week + 1);
                  await new Promise(resolve => setTimeout(resolve, 5));
                  actionPerformed = true;
                  continue;
                }
              }
              
              // Upgrade warehouse if full (AGGRESSIVE: upgrade immediately when full)
              if (!actionPerformed && currentMiners >= maxCapacity && money >= 100000 && typeof gameActions.upgradeWarehouse === 'function') {
                gameActions.upgradeWarehouse();
                await maybeSave(week + 1);
                await new Promise(resolve => setTimeout(resolve, 5));
                actionPerformed = true;
                continue;
              }
            }
            
            // PRIORITY 5: MAXIMIZE COMPANIES - Create ALL company types (AGGRESSIVE: create immediately when affordable)
            if (!actionPerformed && money >= 50000 && typeof gameActions.createCompany === 'function') {
              const companyTypes = ['factory', 'ai', 'restaurant', 'realestate', 'bank'];
              const costs: Record<string, number> = {
                factory: 50000,
                ai: 90000,
                restaurant: 130000,
                realestate: 200000,
                bank: 2000000,
              };
              
              // Find cheapest company type we don't have yet
              const availableTypes = companyTypes.filter(type => {
                const hasCompany = (currentState.companies || []).some(c => c.id === type);
                return !hasCompany && money >= (costs[type] || Infinity);
              });
              
              if (availableTypes.length > 0) {
                const cheapestType = availableTypes.reduce((cheapest, type) => 
                  (costs[type] || Infinity) < (costs[cheapest] || Infinity) ? type : cheapest
                );
                const result = gameActions.createCompany(cheapestType);
                if (result && result.success) {
                  await maybeSave(week + 1);
                  await new Promise(resolve => setTimeout(resolve, 5));
                  actionPerformed = true;
                  continue;
                }
              }
            }
            
            // PRIORITY 6: MAXIMIZE REAL ESTATE - Buy ALL affordable properties (AGGRESSIVE: buy immediately)
            if (!actionPerformed && currentState.realEstate && Array.isArray(currentState.realEstate)) {
              const availableProperties = currentState.realEstate.filter(
                p => p && !p.owned && typeof p.price === 'number' && p.price > 0 && p.price <= money
              );
              if (availableProperties.length > 0) {
                // Buy cheapest property first (fastest way to accumulate properties)
                const cheapestProperty = availableProperties.reduce((cheapest, prop) => 
                  (prop.price || Infinity) < (cheapest.price || Infinity) ? prop : cheapest
                );
                try {
                  const { updateMoney } = await import('@/contexts/game/actions/MoneyActions');
                  updateMoney(setGameState, -cheapestProperty.price, `Bought property: ${cheapestProperty.name || cheapestProperty.id}`);
                  setGameState(prev => ({
                    ...prev,
                    realEstate: prev.realEstate.map(p => 
                      p.id === cheapestProperty.id ? { ...p, owned: true } : p
                    ),
                  }));
                  await maybeSave(week + 1);
                  await new Promise(resolve => setTimeout(resolve, 5));
                  actionPerformed = true;
                  continue;
                } catch (error: any) {
                  log.warn('Failed to import updateMoney for property purchase:', error?.message);
                  setGameState(prev => ({
                    ...prev,
                    stats: { ...prev.stats, money: prev.stats.money - cheapestProperty.price },
                    realEstate: prev.realEstate.map(p => 
                      p.id === cheapestProperty.id ? { ...p, owned: true } : p
                    ),
                  }));
                  await maybeSave(week + 1);
                  await new Promise(resolve => setTimeout(resolve, 5));
                  actionPerformed = true;
                  continue;
                }
              }
            }
            
            // PRIORITY 7: MAXIMIZE CRYPTO - Buy crypto strategically (SMART: diversify, limit per purchase)
            // Crypto provides capital appreciation but no passive income, so limit investment
            // FIXED: Implement crypto purchase directly since buyCrypto is a stub
            // LIMIT: Only buy crypto once per week to prevent spam
            if (!actionPerformed && !cryptoPurchasedThisWeek && money >= 5000 && currentState.cryptos && !failedActions.has('buyCrypto:all')) {
              const cryptoIds = ['btc', 'eth', 'sol', 'ada', 'xrp', 'ltc', 'doge'];
              
              // Check current crypto holdings to diversify
              const currentHoldings = currentState.cryptos.filter(c => (c.owned || 0) > 0).map(c => c.id);
              const underInvested = cryptoIds.filter(id => 
                !currentHoldings.includes(id) || 
                (currentState.cryptos.find(c => c.id === id)?.owned || 0) < 10000
              );
              
              // Prioritize BTC and ETH (typically most stable), then diversify
              const targetCrypto = underInvested.length > 0 
                ? (underInvested.includes('btc') ? 'btc' : underInvested.includes('eth') ? 'eth' : underInvested[0])
                : cryptoIds[Math.floor(Math.random() * cryptoIds.length)];
              
              const crypto = currentState.cryptos.find(c => c.id === targetCrypto);
              if (crypto && crypto.price > 0) {
                // SMART: Invest 20% of money in crypto, max 30k per purchase for diversification
                const amount = Math.min(Math.floor(money * 0.2), 30000);
                if (amount >= 100) {
                  // Check if we can afford it
                  const cost = amount; // Amount is the dollar amount to invest
                  const sharesToBuy = amount / crypto.price;
                  
                  if (money >= cost && sharesToBuy > 0) {
                    // Implement crypto purchase directly (buyCrypto is a stub)
                    const initialOwned = crypto.owned || 0;
                    setGameState(prev => {
                      const updatedCryptos = prev.cryptos?.map(c => 
                        c.id === targetCrypto 
                          ? { ...c, owned: (c.owned || 0) + sharesToBuy }
                          : c
                      ) || [];
                      return {
                        ...prev,
                        cryptos: updatedCryptos,
                        stats: { ...prev.stats, money: prev.stats.money - cost },
                      };
                    });
                    await new Promise(resolve => setTimeout(resolve, 5));
                    
                    // Verify purchase worked
                    setGameState(prev => {
                      currentState = prev;
                      return prev;
                    });
                    await new Promise(resolve => setTimeout(resolve, 5));
                    
                    const updatedCrypto = currentState.cryptos?.find(c => c.id === targetCrypto);
                    if (updatedCrypto && (updatedCrypto.owned || 0) > initialOwned) {
                      // Purchase succeeded
                      cryptoPurchasedThisWeek = true; // Mark as purchased this week
                      await maybeSave(week + 1);
                      actionPerformed = true;
                      continue;
                    } else {
                      // Purchase failed - mark as failed and skip crypto purchases
                      failedActions.add('buyCrypto:all');
                      log.warn(`[LongTermSim] Crypto purchase failed for ${targetCrypto}, skipping future crypto purchases`);
                    }
                  }
                }
              }
            }
            
            // PRIORITY 7.5: GET ANY JOB IMMEDIATELY (CRITICAL for active income)
            // This should be higher priority than other investments if we don't have a job
            // CRITICAL: Get ANY job with no requirements (fast_food, retail, janitor) for immediate income
            if (!actionPerformed && !currentState.currentJob && currentState.careers && currentState.careers.length > 0) {
              // Find jobs with NO requirements (fast_food, retail, janitor)
              const noRequirementJobs = currentState.careers.filter(c => {
                if (c.applied || c.accepted) return false;
                const req = c.requirements || {};
                return Object.keys(req).length === 0; // No requirements
              });
              
              if (noRequirementJobs.length > 0 && typeof gameActions.applyForJob === 'function') {
                // Apply for first available no-requirement job
                const jobToApply = noRequirementJobs[0];
                const result = gameActions.applyForJob(jobToApply.id);
                if (result && result.success) {
                  log.info(`[LongTermSim] Successfully got job: ${jobToApply.id}`);
                  failedJobIds.delete(jobToApply.id);
                  failedActions.delete(`applyForJob:${jobToApply.id}`);
                } else if (result && !result.success) {
                  log.warn(`[LongTermSim] Failed to apply for job ${jobToApply.id}: ${result.message}`);
                  failedActions.add(`applyForJob:${jobToApply.id}`);
                }
                await new Promise(resolve => setTimeout(resolve, 5));
                actionPerformed = true;
                continue;
              }
            }
            
            // PRIORITY 8: Career operations (for active income) - IMPROVED: Prioritize ANY job first
            // CRITICAL: Get ANY job immediately for active income, even if low-paying
            if (!actionPerformed && currentState.careers && currentState.careers.length > 0) {
              // FIRST: Try to get ANY job that requires no education (fast_food, retail, janitor)
              // These provide immediate income and are critical for early game
              const noRequirementJobs = currentState.careers.filter(c => {
                if (c.applied || c.accepted || currentState.currentJob) return false;
                const req = c.requirements || {};
                // Check if job has NO requirements (empty object)
                return Object.keys(req).length === 0;
              });
              
              if (noRequirementJobs.length > 0 && typeof gameActions.applyForJob === 'function') {
                // Apply for first available no-requirement job (prioritize getting income)
                const jobToApply = noRequirementJobs[0];
                const result = gameActions.applyForJob(jobToApply.id);
                if (result && result.success) {
                  log.info(`[LongTermSim] Successfully applied for job: ${jobToApply.id}`);
                  failedJobIds.delete(jobToApply.id);
                  failedActions.delete(`applyForJob:${jobToApply.id}`);
                } else if (result && !result.success) {
                  log.warn(`[LongTermSim] Failed to apply for job ${jobToApply.id}: ${result.message}`);
                  failedActions.add(`applyForJob:${jobToApply.id}`);
                }
                await new Promise(resolve => setTimeout(resolve, 5));
                actionPerformed = true;
                continue;
              }
              
              // Helper: Check if job requirements are met (for jobs WITH requirements)
              const canApplyForJob = (career: any): boolean => {
                if (career.applied || career.accepted || currentState.currentJob) return false;
                if (failedJobIds.has(career.id)) return false; // Skip jobs that failed before
                
                const requirements = career.requirements || {};
                
                // Check fitness requirement
                if ('fitness' in requirements && requirements.fitness) {
                  if ((currentState.stats.fitness || 0) < requirements.fitness) return false;
                }
                
                // Check item requirements
                if ('items' in requirements && requirements.items && requirements.items.length > 0) {
                  const missingItems = requirements.items.filter((itemId: string) => {
                    const item = currentState.items.find(i => i.id === itemId);
                    return !item?.owned;
                  });
                  if (missingItems.length > 0) return false;
                }
                
                // Check education requirements
                if ('education' in requirements && requirements.education && requirements.education.length > 0) {
                  // Check for early career access bonus
                  let hasEarlyAccess = false;
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const { hasEarlyCareerAccess } = require('@/lib/prestige/applyUnlocks');
                    const unlockedBonuses = currentState.prestige?.unlockedBonuses || [];
                    hasEarlyAccess = hasEarlyCareerAccess(unlockedBonuses);
                  } catch {
                    // Ignore if module not found
                  }
                  
                  if (!hasEarlyAccess && requirements.education && Array.isArray(requirements.education)) {
                    const missingEducation = requirements.education.filter((eduId: string) => {
                      const education = currentState.educations.find(e => e.id === eduId);
                      return !education?.completed;
                    });
                    if (missingEducation.length > 0) {
                      // Track this job as needing education
                      failedJobIds.add(career.id);
                      return false;
                    }
                  }
                }
                
                return true;
              };
              
              // Find jobs we can actually apply for (meet requirements)
              const eligibleJobs = currentState.careers.filter(c => canApplyForJob(c));
              
              if (eligibleJobs.length > 0 && typeof gameActions.applyForJob === 'function') {
                // Find highest-paying eligible job
                const bestJob = eligibleJobs.reduce((best, job) => {
                  const bestSalary = best.levels && best.levels.length > 0 ? (best.levels[best.levels.length - 1]?.salary || 0) : 0;
                  const jobSalary = job.levels && job.levels.length > 0 ? (job.levels[job.levels.length - 1]?.salary || 0) : 0;
                  return jobSalary > bestSalary ? job : best;
                }, eligibleJobs[0]);
                
                // Apply and check result
                const result = gameActions.applyForJob(bestJob.id);
                if (result && !result.success) {
                  // Track failed action
                  failedActions.add(`applyForJob:${bestJob.id}`);
                  // If it's an education requirement, track it
                  if (result.message && result.message.includes('Missing required education')) {
                    failedJobIds.add(bestJob.id);
                  }
                } else if (result && result.success) {
                  // Success - clear any previous failures for this job
                  failedJobIds.delete(bestJob.id);
                  failedActions.delete(`applyForJob:${bestJob.id}`);
                }
                await new Promise(resolve => setTimeout(resolve, 5));
                actionPerformed = true;
                continue;
              }
              
              // Promote career if ready (increases salary)
              const promotableCareer = currentState.careers.find(c => c.accepted && c.progress >= 100);
              if (promotableCareer && typeof gameActions.promoteCareer === 'function') {
                gameActions.promoteCareer(promotableCareer.id);
                await new Promise(resolve => setTimeout(resolve, 5));
                actionPerformed = true;
                continue;
              }
            }
            
            // PRIORITY 10: Buy vehicles (if have driver's license and enough money)
            if (!actionPerformed && money >= 20000 && currentState.hasDriversLicense) {
              try {
                const { VEHICLE_TEMPLATES } = await import('@/lib/vehicles/vehicles');
                const { purchaseVehicle } = await import('@/contexts/game/actions/VehicleActions');
                const { updateMoney } = await import('@/contexts/game/actions/MoneyActions');
                const { updateStats } = await import('@/contexts/game/actions/StatsActions');
                
                const ownedVehicleIds = new Set((currentState.vehicles || []).map(v => v.id));
                const affordableVehicle = VEHICLE_TEMPLATES.find(v => 
                  v.price <= money && 
                  !ownedVehicleIds.has(v.id) &&
                  (!v.requiredReputation || (currentState.stats.reputation || 0) >= v.requiredReputation)
                );
                
                if (affordableVehicle) {
                  const result = purchaseVehicle(
                    currentState,
                    setGameState,
                    affordableVehicle.id,
                    { updateMoney, updateStats }
                  );
                  if (result.success) {
                    await maybeSave(week + 1);
                    await new Promise(resolve => setTimeout(resolve, 5));
                    actionPerformed = true;
                    continue;
                  }
                }
              } catch (error: any) {
                log.warn('Failed to purchase vehicle:', error?.message);
              }
            }
            
            // PRIORITY 11: Education (unlock more features) - Already handled in PRIORITY 2, but keep as fallback
            // This is now redundant but kept for safety
            
            // PRIORITY 12: Relationship actions (for social benefits)
            if (!actionPerformed && currentState.relationships && currentState.relationships.length > 0 && money >= 100 && typeof gameActions.goOnDate === 'function') {
              const randomRel = currentState.relationships[Math.floor(Math.random() * currentState.relationships.length)];
              if (randomRel) {
                gameActions.goOnDate(randomRel.id);
                await new Promise(resolve => setTimeout(resolve, 5));
                actionPerformed = true;
                continue;
              }
            }
            
            // If no action was performed, wait a bit before next iteration
            if (!actionPerformed) {
              await new Promise(resolve => setTimeout(resolve, 5));
            }
          } catch (error: any) {
            // Log but continue
            errors.push({ week: week + 1, error: error?.message || 'Unknown error' });
          }
        }
        
        // Advance to next week
        const delay = getSimulationDelay(speed);
        if (typeof gameActions.nextWeek === 'function') {
          await gameActions.nextWeek();
          await new Promise(resolve => setTimeout(resolve, delay));
          await maybeSave(week + 1); // Save after each week progression
        } else {
          // Manual week increment if nextWeek doesn't exist
          setGameState(prev => ({
            ...prev,
            week: ((prev.week || 1) >= 4 ? 1 : (prev.week || 1) + 1),
            weeksLived: (prev.weeksLived || 0) + 1,
          }));
          await new Promise(resolve => setTimeout(resolve, delay));
          await maybeSave(week + 1); // Save after manual week increment
        }
        
        // Get updated state
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        
        // CRITICAL: Maintain health and happiness above 0 to prevent early death during simulation
        // IMPROVED: More aggressive thresholds to prevent decline
        const healthThreshold = 30; // Restore if below this (raised from 10)
        const happinessThreshold = 30; // Restore if below this (raised from 10)
        const restoreHealth = 60; // Restore to this value (raised from 40)
        const restoreHappiness = 60; // Restore to this value (raised from 40)
        
        const currentHealth = currentState.stats?.health || 0;
        const currentHappiness = currentState.stats?.happiness || 0;
        const healthZeroWeeks = currentState.healthZeroWeeks || 0;
        const happinessZeroWeeks = currentState.happinessZeroWeeks || 0;
        
        // Restore stats if they're too low or if death is approaching
        // IMPROVED: Also restore if stats are declining rapidly (below 50)
        if (currentHealth < healthThreshold || healthZeroWeeks >= 1 || currentHealth < 50) {
          setGameState(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              health: Math.max(restoreHealth, prev.stats?.health || 0),
            },
            healthZeroWeeks: 0, // Reset death counter
            showZeroStatPopup: false, // Clear warning popup
            zeroStatType: prev.zeroStatType === 'health' ? undefined : prev.zeroStatType,
          }));
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        if (currentHappiness < happinessThreshold || happinessZeroWeeks >= 1 || currentHappiness < 50) {
          setGameState(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              happiness: Math.max(restoreHappiness, prev.stats?.happiness || 0),
            },
            happinessZeroWeeks: 0, // Reset death counter
            showZeroStatPopup: false, // Clear warning popup
            zeroStatType: prev.zeroStatType === 'happiness' ? undefined : prev.zeroStatType,
          }));
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Get updated state again after stat restoration
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        
        // Validate state every 50 weeks
        if (week % 50 === 0 && week > 0) {
          const issues: string[] = [];
          
          issues.push(...checkForNaN(currentState).map(i => `NaN: ${i}`));
          issues.push(...checkForInfinity(currentState).map(i => `Infinity: ${i}`));
          issues.push(...validateRelationships(currentState));
          issues.push(...validateHobbies(currentState));
          
          const money = currentState.stats?.money || 0;
          if (!isFinite(money) || money < -1000000) {
            issues.push(`Money is invalid: ${money}`);
          }
          
          const weekNum = currentState.week || 1;
          if (weekNum < 1 || weekNum > 4) {
            issues.push(`Week is out of bounds: ${weekNum}`);
          }
          
          const weeksLived = currentState.weeksLived || 0;
          // Account for initial weeksLived value - we reset it to 0, so expected is week + 1
          const expectedWeeksLived = week + 1; // week is 0-indexed, so +1
          if (!isFinite(weeksLived) || weeksLived < expectedWeeksLived - 5 || weeksLived > expectedWeeksLived + 5) {
            issues.push(`weeksLived is invalid: ${weeksLived} (expected ~${expectedWeeksLived})`);
          }
          
          // Track statistics
          if (isFinite(money)) {
            maxMoney = Math.max(maxMoney, money);
            minMoney = Math.min(minMoney, money);
          }
          maxWeek = Math.max(maxWeek, weekNum);
          
          if (issues.length > 0) {
            totalIssues += issues.length;
            stateSnapshots.push({ week: week + 1, issues });
          }
        }
        
        // Progress update every 100 weeks
        if (week % 100 === 0 && week > 0) {
          log.info(`Long-term simulation progress: ${week}/${weeksToSimulate} weeks, issues: ${totalIssues}`);
        }
      } catch (error: any) {
        errors.push({ week: week + 1, error: error?.message || 'Unknown error' });
        log.warn(`Error at week ${week + 1}: ${error?.message}`);
        // Continue simulation even on errors
      }
    }
    
    // Final state
    setGameState(prev => {
      currentState = prev;
      return prev;
    });
    
    return {
      weeksSimulated: weeksToSimulate,
      issuesFound: totalIssues,
      stateSnapshots,
      finalState: currentState,
      statistics: {
        maxMoney,
        minMoney,
        maxWeek,
        finalWeeksLived: currentState.weeksLived || 0,
      },
      errors,
    };
  }
}

