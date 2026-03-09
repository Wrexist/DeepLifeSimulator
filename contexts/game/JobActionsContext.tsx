import React, { createContext, useContext, useCallback, ReactNode, useMemo, useRef, useEffect } from 'react';
import * as JobActions from './actions/JobActions';
import { updateStats } from './actions/StatsActions';
import { logger } from '@/utils/logger';
import { useGameState } from './GameStateContext';
import { useMoneyActions } from './MoneyActionsContext';
import { CrimeSkillId, GameState } from './types';
import { haptic } from '@/utils/haptics';

interface JobActionsContextType {
  // Jobs & Careers
  performStreetJob: (jobId: string) => { success: boolean; message: string; events?: string[] } | void;
  gainCriminalXp: (amount: number) => void;
  gainCrimeSkillXp: (skillId: CrimeSkillId, amount: number) => void;
  unlockCrimeSkillUpgrade: (skillId: CrimeSkillId, upgradeId: string, cost: number, levelReq: number) => void;
  applyForJob: (jobId: string) => void;
  promoteCareer: (careerId: string) => { success: boolean; message: string };
  quitJob: () => void;

  // Jail
  performJailActivity: (activityId: string) => { success: boolean; message: string };
  payBail: () => void;
  serveJailTime: () => { events: string[]; statsChange: Partial<GameStats> };
}

const JobActionsContext = createContext<JobActionsContextType | undefined>(undefined);

export function useJobActions() {
  const context = useContext(JobActionsContext);
  if (!context) {
    throw new Error('useJobActions must be used within JobActionsProvider');
  }
  return context;
}

interface JobActionsProviderProps {
  children: ReactNode;
}

export function JobActionsProvider({ children }: JobActionsProviderProps) {
  const { gameState, setGameState } = useGameState();
  const { updateMoney } = useMoneyActions();

  // Ref keeps latest state for callbacks without adding gameState to deps
  const stateRef = useRef<GameState>(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  // Jobs & Careers Actions
  const gainCriminalXp = useCallback((amount: number) => {
    setGameState(prevState => {
      const newXp = (prevState.criminalXp || 0) + amount;
      const nextLevelXp = (prevState.criminalLevel || 1) * 100;
      
      if (newXp >= nextLevelXp) {
        // Level up
        return {
          ...prevState,
          criminalXp: newXp - nextLevelXp,
          criminalLevel: (prevState.criminalLevel || 1) + 1,
        };
      }
      
      return {
        ...prevState,
        criminalXp: newXp,
      };
    });
  }, [setGameState]);

  const gainCrimeSkillXp = useCallback((skillId: CrimeSkillId, amount: number) => {
    setGameState(prevState => {
      const skill = prevState.crimeSkills[skillId];
      if (!skill) return prevState;

      const newXp = skill.xp + amount;
      const nextLevelXp = skill.level * 100;
      
      if (newXp >= nextLevelXp) {
        // Skill Level up
        logger.info(`Crime skill ${skillId} leveled up to ${skill.level + 1}`);
        return {
          ...prevState,
          crimeSkills: {
            ...prevState.crimeSkills,
            [skillId]: {
              ...skill,
              xp: newXp - nextLevelXp,
              level: skill.level + 1,
            },
          },
        };
      }
      
      return {
        ...prevState,
        crimeSkills: {
          ...prevState.crimeSkills,
          [skillId]: {
            ...skill,
            xp: newXp,
          },
        },
      };
    });
  }, [setGameState]);

  const performStreetJob = useCallback((jobId: string) => {
    const state = stateRef.current;
    if (!state) return;

    const result = JobActions.performStreetJob(state, setGameState, jobId, {
      updateMoney,
      updateStats: (newStats: Partial<import('./types').GameStats>, updateDailySummary?: boolean) =>
        updateStats(setGameState, newStats, updateDailySummary),
      gainCriminalXp,
      gainCrimeSkillXp,
    });
    return result;
  }, [setGameState, updateMoney, gainCriminalXp, gainCrimeSkillXp]);

  const unlockCrimeSkillUpgrade = useCallback((skillId: CrimeSkillId, upgradeId: string, cost: number, levelReq: number) => {
    setGameState(prevState => {
      const skill = prevState.crimeSkills?.[skillId];
      if (!skill || skill.level < levelReq) {
        return prevState;
      }

      if ((prevState.stats.money || 0) < cost) {
        return prevState;
      }

      // Atomic update: deduct money + add upgrade in a single return (no nested setGameState)
      return {
        ...prevState,
        stats: {
          ...prevState.stats,
          money: prevState.stats.money - cost,
        },
        crimeSkills: {
          ...prevState.crimeSkills,
          [skillId]: {
            ...skill,
            upgrades: [...(skill.upgrades || []), upgradeId],
          },
        },
      };
    });
  }, [setGameState]);

  const applyForJob = useCallback((jobId: string) => {
    const state = stateRef.current;
    if (!state) return;

    const result = JobActions.applyForJob(state, setGameState, jobId);
    if (result) {
      haptic.medium(); // Job application
      logger.info('Applied for job:', { jobId, result });
    }
  }, [setGameState]);

  const promoteCareer = useCallback((careerId: string) => {
    const state = stateRef.current;
    if (!state) return { success: false, message: 'Game state not available' };

    const result = JobActions.promoteCareer(state, setGameState, careerId);
    if (result?.success) {
      haptic.success(); // Promotion!
    }
    if (result) {
      logger.info('Promoted career:', { careerId, result });
    }
    return result;
  }, [setGameState]);

  const quitJob = useCallback(() => {
    const state = stateRef.current;
    if (!state?.currentJob) return;

    setGameState(prevState => ({
      ...prevState,
      currentJob: undefined,
      jobHistory: [
        ...(prevState.jobHistory || []),
        {
          ...prevState.currentJob,
          endWeek: prevState.week,
        }
      ],
    }));

    logger.info('Quit current job');
  }, [setGameState]);

  // Jail Actions
  const performJailActivity = useCallback((activityId: string) => {
    const state = stateRef.current;
    if (!state) return { success: false, message: 'Game state not available' };

    const activity = state.jailActivities.find(a => a.id === activityId);
    if (!activity) {
      return { success: false, message: 'Activity not found' };
    }

    // Check if already done this week
    const weeklyActivities = state.weeklyJailActivities || {};
    const currentWeek = state.date.week;
    if (weeklyActivities[activityId] === currentWeek) {
      return { success: false, message: 'You\'ve already completed this activity this week' };
    }

    // Check energy
    if (state.stats.energy < activity.energyCost) {
      return { success: false, message: `Not enough energy. Need ${activity.energyCost}, have ${state.stats.energy}` };
    }

    // Check cost
    if (activity.cost && state.stats.money < activity.cost) {
      return { success: false, message: `Insufficient funds. Need $${activity.cost}, have $${state.stats.money}` };
    }

    // Check education requirement
    if (activity.requiresEducation) {
      const hasEducation = state.educations.find(e => e.id === activity.requiresEducation)?.completed;
      if (!hasEducation) {
        return { success: false, message: `This activity requires ${activity.requiresEducation}` };
      }
    }

    // Check weeks requirement
    if (activity.requiresWeeks && state.jailWeeks < activity.requiresWeeks) {
      return { success: false, message: `This activity requires at least ${activity.requiresWeeks} weeks remaining` };
    }

    // Check success rate for activities with failure chance
    const success = !activity.successRate || Math.random() < activity.successRate;

    let resultMessage = '';
    let willBeReleased = false;
    let criminalXpToGain = 0;

    setGameState(prevState => {
      const newStats = { ...prevState.stats };
      let newJailWeeks = prevState.jailWeeks;
      const messages: string[] = [];

      // Deduct energy
      newStats.energy = Math.max(0, newStats.energy - activity.energyCost);

      if (success) {
        // Apply payment
        if (activity.payment) {
          newStats.money = (newStats.money || 0) + activity.payment;
          messages.push(`+$${activity.payment}`);
        }

        // Deduct cost
        if (activity.cost) {
          newStats.money = Math.max(0, (newStats.money || 0) - activity.cost);
        }

        // Apply sentence reduction
        if (activity.sentenceReduction) {
          newJailWeeks = Math.max(0, newJailWeeks - activity.sentenceReduction);
          messages.push(`-${activity.sentenceReduction} week${activity.sentenceReduction > 1 ? 's' : ''}`);
          willBeReleased = newJailWeeks <= 0;
        }

        // Apply stat gains
        if (activity.fitnessGain) {
          newStats.fitness = Math.min(100, (newStats.fitness || 0) + activity.fitnessGain);
          messages.push(`+${activity.fitnessGain} Fitness`);
        }
        if (activity.healthGain) {
          newStats.health = Math.min(100, (newStats.health || 0) + activity.healthGain);
          messages.push(`+${activity.healthGain} Health`);
        }
        if (activity.happinessGain) {
          newStats.happiness = Math.min(100, (newStats.happiness || 0) + activity.happinessGain);
          messages.push(`+${activity.happinessGain} Happiness`);
        }
        if (activity.reputationGain) {
          newStats.reputation = Math.min(100, (newStats.reputation || 0) + activity.reputationGain);
          messages.push(`+${activity.reputationGain} Reputation`);
        }

        // Store criminal XP gain for later application
        if (activity.criminalXpGain) {
          criminalXpToGain = activity.criminalXpGain;
        }
      } else {
        // Activity failed
        if (activity.failurePenalty) {
          newStats.happiness = Math.max(0, (newStats.happiness || 0) - activity.failurePenalty);
        }

        // Special failure consequences for risky activities
        if (activityId === 'escape_attempt') {
          newJailWeeks += 3; // Failed escape adds 3 weeks
          newStats.health = Math.max(0, (newStats.health || 0) - 10);
          messages.push('+3 weeks sentence, -10 health');
        } else if (activityId === 'contraband_trade') {
          newJailWeeks += 1; // Caught with contraband adds 1 week
          messages.push('+1 week sentence (caught with contraband)');
        }
      }

      // Escape attempt success boosts wanted level
      let newWantedLevel = prevState.wantedLevel || 0;
      if (success && activityId === 'escape_attempt') {
        newWantedLevel += 5; // Major wanted level spike for prison break
      }

      // Mark activity as done this week
      const newWeeklyActivities = {
        ...prevState.weeklyJailActivities,
        [activityId]: currentWeek,
      };

      resultMessage = success
        ? `Activity completed! ${messages.join(', ')}${willBeReleased ? ' You are released!' : ''}`
        : activityId === 'escape_attempt'
          ? 'Escape failed! Guards caught you. +3 weeks added to your sentence.'
          : activityId === 'contraband_trade'
            ? 'Busted! Guards found your contraband. +1 week added to your sentence.'
            : activity.failurePenalty
              ? `Activity failed. Lost ${activity.failurePenalty} happiness.`
              : 'Activity failed.';

      return {
        ...prevState,
        stats: newStats,
        jailWeeks: newJailWeeks,
        wantedLevel: newWantedLevel,
        weeklyJailActivities: newWeeklyActivities,
        // Mark escaped from jail for achievement tracking
        ...(success && activityId === 'escape_attempt' && willBeReleased && { escapedFromJail: true }),
      };
    });

    // Apply criminal XP gain after state update
    if (success && criminalXpToGain > 0) {
      gainCriminalXp(criminalXpToGain);
    }

    const message = resultMessage;

    logger.info('Jail activity performed:', { activityId, success, message });
    return { success, message };
  }, [setGameState]);

  const payBail = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;

    const estimatedBailCost = state.jailWeeks * 500;
    if (state.stats.money < estimatedBailCost) {
      logger.warn('Cannot pay bail: insufficient funds', { money: state.stats.money, bailCost: estimatedBailCost });
      return;
    }

    const now = Date.now();
    setGameState(prevState => {
      // Compute bail from prevState to avoid stale closure
      const bailCost = prevState.jailWeeks * 500;
      if ((prevState.stats.money || 0) < bailCost) {
        return prevState; // Insufficient funds at actual state — no-op
      }
      return {
        ...prevState,
        updatedAt: now,
        jailWeeks: 0,
        stats: {
          ...prevState.stats,
          money: Math.max(0, (prevState.stats.money || 0) - bailCost),
        },
      };
    });

    logger.info('Bail paid', { estimatedBailCost, remainingWeeks: 0 });
  }, [setGameState]);

  const serveJailTime = useCallback(() => {
    const state = stateRef.current;
    if (!state || state.jailWeeks <= 0) {
      return { events: [], statsChange: {} };
    }

    // This is called when advancing weeks - jail time is handled in nextWeek
    logger.info('Serving jail time', { weeksRemaining: state.jailWeeks });
    return { events: [], statsChange: {} };
  }, []);

  const value = useMemo<JobActionsContextType>(() => ({
    performStreetJob,
    gainCriminalXp,
    gainCrimeSkillXp,
    unlockCrimeSkillUpgrade,
    applyForJob,
    promoteCareer,
    quitJob,
    performJailActivity,
    payBail,
    serveJailTime,
  }), [performStreetJob, gainCriminalXp, gainCrimeSkillXp, unlockCrimeSkillUpgrade, applyForJob, promoteCareer, quitJob, performJailActivity, payBail, serveJailTime]);

  return (
    <JobActionsContext.Provider value={value}>
      {children}
    </JobActionsContext.Provider>
  );
}
