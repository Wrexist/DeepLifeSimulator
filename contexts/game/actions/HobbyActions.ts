/**
 * Hobby Actions
 */
import { GameState, Contract, League } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';

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

  deps.updateStats(setGameState, {
    energy: -hobby.energyCost,
    happiness: 2,
  });

  setGameState(prev => {
    const hobbies = (prev.hobbies || []).map(h => {
      if (h.id === hobbyId) {
        const skillGain = 5 + (h.skillLevel || 0); // Simple scaling
        const newSkill = (h.skill || 0) + skillGain;
        const levelUp = newSkill >= (h.skillLevel + 1) * 100;
        
        return {
          ...h,
          skill: levelUp ? newSkill - (h.skillLevel + 1) * 100 : newSkill,
          skillLevel: levelUp ? h.skillLevel + 1 : h.skillLevel,
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

  // Simple tournament logic
  const winChance = 30 + (hobby.skillLevel * 5);
  const won = Math.random() * 100 < winChance;

  if (won) {
    const reward = hobby.tournamentReward * (1 + (hobby.skillLevel * 0.2));
    deps.updateMoney(setGameState, reward, `Won ${hobby.name} tournament`);
    return { success: true, message: `You won the tournament! Earned $${reward}` };
  }

  return { success: false, message: 'You lost the tournament. Keep training!' };
};


