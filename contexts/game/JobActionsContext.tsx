import React, { createContext, useContext, useCallback, ReactNode, useMemo, useRef, useEffect } from 'react';
import * as JobActions from './actions/JobActions';
import { rejectIfBlocked, isPlayerJailed } from './actions/_guards';
import { updateStats } from './actions/StatsActions';
import { updateMoney as updateMoneyModule, applyMoneyDelta } from './actions/MoneyActions';
import { commitDeterministicRoll, getDeterministicRoll } from '@/lib/randomness/deterministicRng';
import { logger } from '@/utils/logger';
import { computeBailCost } from '@/lib/config/gameConstants';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { useGameState } from './GameStateContext';
import { useMoneyActions } from './MoneyActionsContext';
import { CrimeSkillId, GameState, GameStats, PromotionDetails } from './types';
import { haptic } from '@/utils/haptics';

interface JobActionsContextType {
  // Jobs & Careers
  performStreetJob: (jobId: string) => { success: boolean; message?: string; events?: string[]; inJail?: boolean } | void;
  gainCriminalXp: (amount: number) => void;
  gainCrimeSkillXp: (skillId: CrimeSkillId, amount: number) => void;
  unlockCrimeSkillUpgrade: (skillId: CrimeSkillId, upgradeId: string, cost: number, levelReq: number) => void;
  applyForJob: (jobId: string) => { success: boolean; message: string } | void;
  promoteCareer: (careerId: string) => { success: boolean; message: string; promotion?: PromotionDetails };
  requestRaise: (careerId: string) => { success: boolean; message: string; approved?: boolean };
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
/**
 * Pure criminal-XP application, with level-up carry.
 *
 * Extracted so `performJailActivity` can fold XP into its OWN updater rather
 * than calling `gainCriminalXp` after it. That call sat outside the updater and
 * was gated on `criminalXpToGain`, an outer variable assigned INSIDE it — so
 * whenever React deferred the updater (any time another state update is already
 * queued on the fiber) the variable was still 0 and the XP from Escape Attempt,
 * Contraband Trade and Join a Gang was silently dropped. R3-C11.
 */
function applyCriminalXp(
  state: GameState,
  amount: number,
): Pick<GameState, 'criminalXp' | 'criminalLevel'> {
  const gain = Number.isFinite(amount) && amount > 0 ? amount : 0;
  if (gain <= 0) {
    return { criminalXp: state.criminalXp || 0, criminalLevel: state.criminalLevel || 1 };
  }
  const newXp = (state.criminalXp || 0) + gain;
  const nextLevelXp = (state.criminalLevel || 1) * 100;
  if (newXp >= nextLevelXp) {
    return { criminalXp: newXp - nextLevelXp, criminalLevel: (state.criminalLevel || 1) + 1 };
  }
  return { criminalXp: newXp, criminalLevel: state.criminalLevel || 1 };
}

  const gainCriminalXp = useCallback((amount: number) => {
    setGameState(prevState => ({ ...prevState, ...applyCriminalXp(prevState, amount) }));
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
      updateMoney: updateMoneyModule,
      updateStats,
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

      /**
       * R3-C6: re-check "already unlocked" against `prev`.
       *
       * The level and money gates were re-checked here, but the
       * already-unlocked gate lived entirely in the render-snapshot UI
       * (`SkillTalentTree`'s `canUnlockNode`). Two taps on the unlock chevron in
       * one React batch both read `status === 'available'`, both updaters
       * passed, and the same node id was appended twice — charging $200 for one
       * node and, worse, permanently burning TWO skill points, because
       * `spentPoints = skill.upgrades.length`. With only `skillLevel - 1` points
       * ever available and nothing that removes an entry from `upgrades`, that
       * loss is unrecoverable. CLAUDE.md §4.4.
       */
      if ((skill.upgrades || []).includes(upgradeId)) {
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
    // Fire the success haptic only on an ACTUAL success. The old check was
    // `if (result)` — truthy for a REJECTION object too, so a refused
    // application buzzed like an accepted one and the message was dropped on
    // the floor. Returning the result lets the screen say what happened
    // (2026-07-28 audit UX-2); mirrors promoteCareer below.
    if (result?.success) {
      haptic.medium(); // Job application
    }
    if (result) {
      logger.info('Applied for job:', { jobId, result });
    }
    return result;
  }, [setGameState]);

  const promoteCareer = useCallback((careerId: string) => {
    const state = stateRef.current;
    if (!state) return { success: false, message: 'Game state not available' };
    if (isPlayerJailed(state)) {
      return { success: false, message: "You can't chase a promotion from a jail cell." };
    }

    const result = JobActions.promoteCareer(state, setGameState, careerId);
    if (result?.success) {
      haptic.success(); // Promotion!
    }
    if (result) {
      logger.info('Promoted career:', { careerId, result });
    }
    return result;
  }, [setGameState]);

  const requestRaise = useCallback((careerId: string) => {
    const state = stateRef.current;
    if (!state) return { success: false, message: 'Game state not available' };
    if (isPlayerJailed(state)) {
      return { success: false, message: "You can't ask for a raise while you're in jail." };
    }

    const result = JobActions.requestRaise(state, setGameState, careerId);
    if (result?.approved) {
      haptic.success();
    } else if (result?.success) {
      haptic.warning();
    }
    return result;
  }, [setGameState]);

  const quitJob = useCallback(() => {
    const state = stateRef.current;
    if (!state?.currentJob) return;

    setGameState(prevState => {
      // Reset the career's accepted/applied status so they can reapply later
      const updatedCareers = (prevState.careers || []).map(c => {
        if (c.id === prevState.currentJob) {
          return { ...c, accepted: false, applied: false, progress: 0 };
        }
        return c;
      });

      // Close the open careerHistory entry for this job: set endWeek
      // on the most recent matching entry. The Statistics screen
      // shows the closed-out timeline.
      const quitWeek = prevState.weeksLived || 0;
      const updatedLifetimeStatistics = prevState.lifetimeStatistics
        ? (() => {
            const history = prevState.lifetimeStatistics.careerHistory || [];
            // Find the LAST open entry for this career id.
            const lastOpenIdx = (() => {
              for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].job === prevState.currentJob && history[i].endWeek === undefined) {
                  return i;
                }
              }
              return -1;
            })();
            if (lastOpenIdx === -1) return prevState.lifetimeStatistics;
            const updated = [...history];
            const entry = updated[lastOpenIdx];
            updated[lastOpenIdx] = {
              ...entry,
              endWeek: quitWeek,
              weeks: Math.max(0, quitWeek - entry.startWeek),
            };
            return { ...prevState.lifetimeStatistics, careerHistory: updated };
          })()
        : prevState.lifetimeStatistics;

      return {
        ...prevState,
        currentJob: undefined,
        careers: updatedCareers,
        lifetimeStatistics: updatedLifetimeStatistics,
      };
    });

    logger.info('Quit current job');
  }, [setGameState]);

  // Jail Actions
  const performJailActivity = useCallback((activityId: string) => {
    const state = stateRef.current;
    if (!state) return { success: false, message: 'Game state not available' };
    // A deceased player can't act, even from jail (matches sibling job actions).
    const blocked = rejectIfBlocked(state);
    if (blocked) return blocked;

    const activity = state.jailActivities.find(a => a.id === activityId);
    if (!activity) {
      return { success: false, message: 'Activity not found' };
    }

    // Check if already done this week. Use `weeksLived` (absolute timeline)
    // — `state.date.week` cycles 1–4 (week-of-month) and would let players
    // re-do an activity in the other 3 weeks of every month.
    const weeklyActivities = state.weeklyJailActivities || {};
    const currentWeek = state.weeksLived;
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

    // Check success rate for activities with failure chance.
    // Use a seeded, save-deterministic roll (keyed by week + activity) instead
    // of live Math.random(): a raw random could be re-rolled across a reload to
    // turn a failed escape/parole into a success. The roll is committed to
    // rngCommitLog inside the updater so it's stable for the rest of the week.
    const jailRollKey = `jail_activity:${currentWeek}:${activityId}`;
    const success = !activity.successRate || getDeterministicRoll(state, jailRollKey) < activity.successRate;

    let resultMessage = '';
    let willBeReleased = false;
    let criminalXpToGain = 0;

    setGameState(prevState => {
      // Authoritative once-per-week re-check on fresh state: the precondition
      // above reads stateRef (stale), so two taps in one React batch would both
      // pass and double-apply payments / sentence reductions before
      // weeklyJailActivities was committed.
      if ((prevState.weeklyJailActivities || {})[activityId] === currentWeek) {
        return prevState;
      }

      // Route money through applyMoneyDelta so it shares the central overdraft
      // reject + daily-summary accounting (P2-2). The previous raw
      // `Math.max(0, money - cost)` floored a fee to $0 instead of rejecting,
      // letting an underfunded player run paid activities (parole/appeal) free.
      let working: GameState = prevState;
      const newStats = { ...prevState.stats };
      let newJailWeeks = prevState.jailWeeks;
      const messages: string[] = [];

      // Deduct energy
      newStats.energy = Math.max(0, newStats.energy - activity.energyCost);

      if (success) {
        // Deduct cost first (atomic affordability) — reject the whole activity
        // if it can't be paid rather than silently flooring to free.
        if (activity.cost) {
          const spend = applyMoneyDelta(working, -activity.cost, `Jail: ${activity.name} fee`);
          if (!spend) return prevState;
          working = { ...working, ...spend };
          newStats.money = working.stats.money;
        }

        // Apply payment
        if (activity.payment) {
          const earn = applyMoneyDelta(working, activity.payment, `Jail: ${activity.name}`);
          if (earn) {
            working = { ...working, ...earn };
            newStats.money = working.stats.money;
          }
          messages.push(`+$${activity.payment}`);
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
          newJailWeeks = Math.min(52, newJailWeeks + 3); // Failed escape adds 3 weeks (capped at 52)
          newStats.health = Math.max(0, (newStats.health || 0) - 10);
          messages.push('+3 weeks sentence, -10 health');
        } else if (activityId === 'contraband_trade') {
          newJailWeeks = Math.min(52, newJailWeeks + 1); // Caught with contraband adds 1 week (capped at 52)
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
        // Preserve the money daily-summary accounting from applyMoneyDelta.
        dailySummary: working.dailySummary,
        jailWeeks: newJailWeeks,
        wantedLevel: newWantedLevel,
        weeklyJailActivities: newWeeklyActivities,
        // Commit the seeded success roll so it can't be re-rolled on reload.
        ...(activity.successRate
          ? { rngCommitLog: commitDeterministicRoll(prevState, jailRollKey, prevState.weeksLived || 0) }
          : {}),
        // Mark escaped from jail for achievement tracking
        ...(success && activityId === 'escape_attempt' && willBeReleased && { escapedFromJail: true }),
        // R3-C11: fold the XP into THIS updater. It used to be granted after,
        // gated on `criminalXpToGain` — an outer variable assigned inside this
        // very updater — so whenever React deferred the updater (any time
        // another update is already queued on the fiber) the check read 0 and
        // the XP was silently dropped.
        ...(success && criminalXpToGain > 0 ? applyCriminalXp(prevState, criminalXpToGain) : {}),
      };
    });

    const message = resultMessage;

    logger.info('Jail activity performed:', { activityId, success, message });
    return { success, message };
  }, [setGameState]);

  const payBail = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    // A deceased player's estate can't post bail (death popup is showing).
    if (rejectIfBlocked(state)) return;

    const estimatedBailCost = computeBailCost(state.jailWeeks, calculateNetWorth(state));
    // A corrupt save can make calculateNetWorth (and thus the clamp inside
    // computeBailCost) return NaN, which would poison stats.money below —
    // NaN comparisons are false, so the affordability gates wouldn't catch it.
    if (!Number.isFinite(estimatedBailCost)) {
      logger.warn('Cannot pay bail: bail cost is not a finite number', { bailCost: estimatedBailCost });
      return;
    }
    if (state.stats.money < estimatedBailCost) {
      logger.warn('Cannot pay bail: insufficient funds', { money: state.stats.money, bailCost: estimatedBailCost });
      return;
    }

    const now = Date.now();
    setGameState(prevState => {
      // Compute bail from prevState to avoid stale closure — same shared helper
      // JailScreen uses for display, so the charge matches what the player saw.
      /**
       * F3: the player must still BE in jail.
       *
       * The cost and the affordability check were both already re-derived from
       * `prevState` — but nothing re-checked `jailWeeks`. `JailScreen`'s Pay
       * Bail button has no in-flight guard, so two taps in one React batch both
       * ran: the first set `jailWeeks: 0` and charged, and the second charged
       * AGAIN for a player who was already out. `computeBailCost` has a $500
       * FLOOR and scales at 0.5% of net worth up to $250,000, so at zero weeks
       * it still returns a real bill — up to a quarter of a million dollars for
       * nothing. CLAUDE.md §4.4.
       */
      if ((prevState.jailWeeks || 0) <= 0) {
        return prevState;
      }

      const bailCost = computeBailCost(prevState.jailWeeks, calculateNetWorth(prevState));
      if (!Number.isFinite(bailCost) || (prevState.stats.money || 0) < bailCost) {
        return prevState; // Invalid cost or insufficient funds at actual state — no-op
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
    requestRaise,
    quitJob,
    performJailActivity,
    payBail,
    serveJailTime,
  }), [performStreetJob, gainCriminalXp, gainCrimeSkillXp, unlockCrimeSkillUpgrade, applyForJob, promoteCareer, requestRaise, quitJob, performJailActivity, payBail, serveJailTime]);

  return (
    <JobActionsContext.Provider value={value}>
      {children}
    </JobActionsContext.Provider>
  );
}
