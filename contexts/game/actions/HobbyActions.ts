/**
 * Hobby Actions
 */
import React from 'react';
import { GameState, Contract, League } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';
import { clampHobbySkill, clampHobbySkillLevel } from '@/utils/stateValidation';
import { getDeterministicRoll, commitDeterministicRolls } from '@/lib/randomness/deterministicRng';

const log = logger.scope('HobbyActions');

export const trainHobby = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  hobbyId: string,
  deps: { updateStats: typeof updateStats }
) => {
  const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
  if (!hobby) {
    log.error(`Hobby not found: ${hobbyId}`);
    return { success: false, message: 'Hobby not found' };
  }

  if (gameState.stats.energy < hobby.energyCost) {
    return { success: false, message: 'Not enough energy' };
  }

  // ANTI-EXPLOIT: Limit hobby training to 5 sessions per hobby per week
  const MAX_HOBBY_TRAINS_PER_WEEK = 5;
  const currentWeeksLived = gameState.weeksLived || 0;
  const lastTrainWeek = hobby.lastTrainWeek || 0;
  const trainsThisWeek = lastTrainWeek === currentWeeksLived ? (hobby.trainsThisWeek || 0) : 0;
  if (trainsThisWeek >= MAX_HOBBY_TRAINS_PER_WEEK) {
    return { success: false, message: `You've trained ${hobby.name} ${MAX_HOBBY_TRAINS_PER_WEEK} times this week. Give your body a rest!` };
  }

  deps.updateStats(setGameState, {
    energy: -hobby.energyCost,
    happiness: 2,
  });

  setGameState(prev => {
    // BUG FIX: Apply prestige skill gain multiplier
    const unlockedBonuses = prev.prestige?.unlockedBonuses || [];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSkillGainMultiplier } = require('@/lib/prestige/applyBonuses');
    const skillGainMultiplier = getSkillGainMultiplier(unlockedBonuses);
    const safeSkillGainMultiplier = typeof skillGainMultiplier === 'number' && isFinite(skillGainMultiplier) && skillGainMultiplier > 0 ? skillGainMultiplier : 1.0;
    
    const hobbies = (prev.hobbies || []).map(h => {
      if (h.id === hobbyId) {
        const baseSkillGain = 5 + (h.skillLevel || 0); // Simple scaling
        const skillGain = Math.round(baseSkillGain * safeSkillGainMultiplier); // Apply prestige multiplier
        const newSkill = (h.skill || 0) + skillGain;
        const levelUp = newSkill >= (h.skillLevel + 1) * 100;
        
        return {
          ...h,
          skill: clampHobbySkill(levelUp ? newSkill - (h.skillLevel + 1) * 100 : newSkill),
          skillLevel: clampHobbySkillLevel(levelUp ? h.skillLevel + 1 : h.skillLevel),
          // ANTI-EXPLOIT: Track weekly training count
          trainsThisWeek: (h.lastTrainWeek === (prev.weeksLived || 0) ? (h.trainsThisWeek || 0) : 0) + 1,
          lastTrainWeek: prev.weeksLived || 0,
        };
      }
      return h;
    });

    return { ...prev, hobbies };
  });

  return { success: true, message: `Trained ${hobby.name}!` };
};

export const enterHobbyTournament = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  hobbyId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
) => {
  const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
  if (!hobby) return { success: false, message: 'Hobby not found' };

  if (gameState.stats.energy < 20) {
    return { success: false, message: 'Not enough energy' };
  }

  deps.updateStats(setGameState, { energy: -20 });

  // Deterministic tournament logic — prevents save-reload exploits
  const winChance = 30 + (hobby.skillLevel * 5);
  const rollKey = `tournament:${gameState.weeksLived || 0}:${hobbyId}`;
  const roll = getDeterministicRoll(gameState, rollKey);
  const won = (roll || 0) * 100 < winChance;

  if (won) {
    const reward = hobby.tournamentReward * (1 + (hobby.skillLevel * 0.2));
    deps.updateMoney(setGameState, reward, `Won ${hobby.name} tournament`);
    return { success: true, message: `You won the tournament! Earned $${reward}` };
  }

  return { success: false, message: 'You lost the tournament. Keep training!' };
};


