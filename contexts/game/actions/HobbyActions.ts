/**
 * Hobby Actions
 */
import React from 'react';
import { GameState } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import { updateStats } from './StatsActions';
import { clampHobbySkill, clampHobbySkillLevel } from '@/utils/stateValidation';
import { getDeterministicRoll } from '@/lib/randomness/deterministicRng';

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
    return {
      success: false,
      message: `Need ${hobby.energyCost} energy to train ${hobby.name} — you have ${gameState.stats.energy}.`,
    };
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
    // ANTI-EXPLOIT: Re-check the 5/wk training cap inside the prev callback so
    // two rapid same-batch trains don't both pass the outer gate above and
    // bypass the cap.
    const prevHobby = (prev.hobbies || []).find(h => h.id === hobbyId);
    if (!prevHobby) return prev;
    const prevWeek = prev.weeksLived || 0;
    const prevTrainsThisWeek = prevHobby.lastTrainWeek === prevWeek ? (prevHobby.trainsThisWeek || 0) : 0;
    if (prevTrainsThisWeek >= MAX_HOBBY_TRAINS_PER_WEEK) return prev;

    // BUG FIX: Apply prestige skill gain multiplier
    const unlockedBonuses = prev.prestige?.unlockedBonuses || [];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSkillGainMultiplier } = require('@/lib/prestige/applyBonuses');
    const skillGainMultiplier = getSkillGainMultiplier(unlockedBonuses);
    const safeSkillGainMultiplier = typeof skillGainMultiplier === 'number' && isFinite(skillGainMultiplier) && skillGainMultiplier > 0 ? skillGainMultiplier : 1.0;

    // Apply Skill Mastery gold upgrade ("All skills level up 50% faster").
    // Was set on purchase but never read by any skill-gain path.
    const skillMasteryBonus = prev.goldUpgrades?.skill_mastery ? 1.5 : 1;

    const hobbies = (prev.hobbies || []).map(h => {
      if (h.id === hobbyId) {
        const baseSkillGain = 5 + (h.skillLevel || 0); // Simple scaling
        const skillGain = Math.round(baseSkillGain * safeSkillGainMultiplier * skillMasteryBonus); // prestige + Skill Mastery
        const newSkill = (h.skill || 0) + skillGain;
        const levelUp = newSkill >= (h.skillLevel + 1) * 100;

        return {
          ...h,
          skill: clampHobbySkill(levelUp ? newSkill - (h.skillLevel + 1) * 100 : newSkill),
          skillLevel: clampHobbySkillLevel(levelUp ? h.skillLevel + 1 : h.skillLevel),
          trainsThisWeek: prevTrainsThisWeek + 1,
          lastTrainWeek: prevWeek,
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
    return {
      success: false,
      message: `Need 20 energy for a tournament — you have ${gameState.stats.energy}.`,
    };
  }

  // R2-G: cap tournament entries to 1 per hobby per week. Previously the
  // deterministic roll was keyed only on (week, hobbyId) so if the player
  // won once, they could keep entering the same tournament that same week,
  // burn another 20 energy (restore via gym/coffee), and re-collect the
  // reward — unlimited money for the cost of energy.
  const currentWeeksLived = gameState.weeksLived || 0;
  const lastTournamentWeek = hobby.lastTournamentWeek ?? -1;
  if (lastTournamentWeek === currentWeeksLived) {
    return {
      success: false,
      message: `You've already entered the ${hobby.name} tournament this week. Come back next week.`,
    };
  }

  // Deterministic tournament logic — prevents save-reload exploits. Computed
  // from lineage-seeded state (stable within a batch), so the message below and
  // the authoritative recompute inside the updater agree.
  const winChance = 30 + (hobby.skillLevel * 5);
  const rollKey = `tournament:${currentWeeksLived}:${hobbyId}`;
  const roll = getDeterministicRoll(gameState, rollKey);
  const won = (roll || 0) * 100 < winChance;
  const reward = hobby.tournamentReward * (1 + (hobby.skillLevel * 0.2));

  // ANTI-EXPLOIT (H-8/H-9 same-batch double-tap): the once-per-week gate above
  // reads the stale render-time snapshot. Fold the cooldown re-check, energy
  // cost, entry marker, AND the reward into ONE atomic updater — mirroring
  // `trainHobby` and PetActions `enterCompetition` — so two rapid same-batch
  // entries can't both pass the gate and double-pay before `lastTournamentWeek`
  // commits. Previously the marker, energy, and reward were three separate
  // `setGameState`/dispatch calls with no re-check, so N taps → N payouts.
  setGameState(prev => {
    const prevHobby = (prev.hobbies || []).find(h => h.id === hobbyId);
    if (!prevHobby) return prev;
    const prevWeek = prev.weeksLived || 0;
    // Authoritative once-per-week re-check on fresh state.
    if ((prevHobby.lastTournamentWeek ?? -1) === prevWeek) return prev;
    // Re-check affordability (energy) against fresh state.
    if ((prev.stats.energy || 0) < 20) return prev;

    // Re-derive the deterministic result from `prev` (same seed → same roll).
    const wonNow =
      getDeterministicRoll(prev, `tournament:${prevWeek}:${hobbyId}`) * 100 <
      30 + prevHobby.skillLevel * 5;

    let stats = { ...prev.stats, energy: Math.max(0, (prev.stats.energy || 0) - 20) };
    let dailySummary = prev.dailySummary;
    if (wonNow) {
      const prize = prevHobby.tournamentReward * (1 + prevHobby.skillLevel * 0.2);
      const credit = applyMoneyDelta({ ...prev, stats }, prize, `Won ${prevHobby.name} tournament`);
      if (credit) {
        stats = credit.stats;
        dailySummary = credit.dailySummary;
      }
    }

    return {
      ...prev,
      stats,
      dailySummary,
      hobbies: (prev.hobbies || []).map(h =>
        h.id === hobbyId ? { ...h, lastTournamentWeek: prevWeek } : h
      ),
    };
  });

  if (won) {
    return { success: true, message: `You won the tournament! Earned $${reward}` };
  }

  return { success: false, message: 'You lost the tournament. Keep training!' };
};


