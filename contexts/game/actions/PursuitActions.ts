/**
 * Hobby Mastery actions (v21). `practicePursuit` is the weekly loop: spend
 * energy to practice a hobby, gain XP + an immediate reward, and level up for a
 * bonus + a stronger perk. Fully atomic (re-checks energy + weekly cap against
 * prev so a double-tap can't double-practice) and self-contained (no tick
 * changes). The "Skills" activity-commitment axis boosts XP gained here.
 */
import React from 'react';
import { GameState } from '../types';
import { logger } from '@/utils/logger';
import { MONEY_CEILING } from './MoneyActions';
import {
  getPursuitDef,
  levelFromXp,
  levelUpBonus,
  tierUpBonus,
  tierIndexForLevel,
  tierForLevel,
  PRACTICE_XP,
  MAX_PURSUIT_LEVEL,
  type PursuitReward,
} from '@/lib/pursuits/pursuitMastery';
import { getCommitmentModifiers, updateCommitmentLevel } from '@/lib/commitments/commitmentSystem';

const log = logger.scope('PursuitActions');

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

function applyReward(stats: GameState['stats'], rewards: PursuitReward[]): GameState['stats'] {
  const next = { ...stats };
  for (const rw of rewards) {
    if (rw.stat === 'money') {
      next.money = Math.min(MONEY_CEILING, Math.max(0, (next.money ?? 0) + rw.amount));
    } else {
      next[rw.stat] = clamp100((next[rw.stat] ?? 0) + rw.amount);
    }
  }
  return next;
}

export interface PracticeResult {
  success: boolean;
  message: string;
  leveledUp?: boolean;
  newLevel?: number;
  /** True when this practice crossed into a new named mastery tier. */
  tierUp?: boolean;
  /** Name of the mastery tier reached (only set when tierUp is true). */
  tierName?: string;
}

export const practicePursuit = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  pursuitId: string,
): PracticeResult => {
  const def = getPursuitDef(pursuitId);
  if (!def) return { success: false, message: 'Unknown hobby.' };

  /**
   * C-1: the Commitment focus also moves the ENERGY cost, not just the XP.
   * `getEffectiveEnergyCost` was written for exactly this and had no caller —
   * so a player whose primary focus was hobbies was told the practice would
   * cost 20% less energy and was charged the full amount. Resolved once here
   * and used for the gate, the message and the debit, so the three cannot
   * disagree.
   */
  const commitment = getCommitmentModifiers(gameState, 'hobbies');
  const energyCost = commitment.energyCost(def.energyCost);

  const energy = gameState.stats?.energy ?? 0;
  if (energy < energyCost) {
    return { success: false, message: `Too tired — need ${energyCost} energy.` };
  }
  const practicedThisWeek = gameState.weeklyPursuitPractice?.[pursuitId] ?? 0;
  if (practicedThisWeek >= def.weeklyCap) {
    return { success: false, message: `You've practiced ${def.name} ${def.weeklyCap}× this week. Come back next week.` };
  }

  // Skills-axis commitment moves XP (Batch-2 relabel routes practice here).
  // C-1: now via the shared resolver, so the neglect PENALTY applies too — the
  // old call read bonuses only, so a player who had committed elsewhere took
  // no hit for practising a hobby they had explicitly deprioritised.
  const xpGainBase = commitment.progress(PRACTICE_XP);
  let xpGain = xpGainBase;

  // Skill Mastery gold upgrade — the skills-axis levels up 50% faster. This is
  // the honest wiring of the store's "All skills level up 50% faster" benefit,
  // which previously set a flag nothing read. Applied before the level-up
  // precompute below so the projected level and the committed XP agree.
  if (gameState.goldUpgrades?.skill_mastery) {
    xpGain = Math.round(xpGain * 1.5);
  }

  const prevPursuit = gameState.pursuits?.[pursuitId] ?? { xp: 0, level: 0 };
  const projectedLevel = levelFromXp(prevPursuit.xp + xpGain);
  const willLevelUp = projectedLevel > (prevPursuit.level ?? 0);
  const projectedTier = tierIndexForLevel(projectedLevel);
  const willTierUp = projectedTier > tierIndexForLevel(prevPursuit.level ?? 0);

  setGameState((prev) => {
    // Atomic re-checks against prev.
    if ((prev.stats?.energy ?? 0) < energyCost) return prev;
    if ((prev.weeklyPursuitPractice?.[pursuitId] ?? 0) >= def.weeklyCap) return prev;

    const cur = prev.pursuits?.[pursuitId] ?? { xp: 0, level: 0 };
    const newXp = cur.xp + xpGain;
    const newLevel = levelFromXp(newXp);

    // Spend energy, then apply the immediate practice reward + any level-up spike.
    let stats = { ...prev.stats, energy: clamp100((prev.stats?.energy ?? 0) - energyCost) };
    stats = applyReward(stats, def.reward(newLevel));
    if (newLevel > (cur.level ?? 0)) {
      // A tier-crossing level-up pays the (bigger) named-tier milestone spike
      // instead of the plain level-up spike; a within-tier level-up pays the
      // plain spike. They never stack.
      const prevTierIdx = tierIndexForLevel(cur.level ?? 0);
      const newTierIdx = tierIndexForLevel(newLevel);
      stats = applyReward(
        stats,
        newTierIdx > prevTierIdx ? tierUpBonus(def, newLevel, newTierIdx) : levelUpBonus(def, newLevel),
      );
    }

    // Fix 5b: practicing a hobby raises the "hobbies" activity-commitment level so
    // the ActivityCommitmentModal bar reflects the focus. `updateCommitmentLevel`
    // previously had no callers; a committed (primary/secondary) hobby grows
    // faster (+2/practice) than an uncommitted one (+1), capped at 100.
    const prevCommit = prev.activityCommitments;
    let nextCommitments = prevCommit;
    if (prevCommit) {
      const isHobbiesCommitted =
        prevCommit.primary === 'hobbies' || prevCommit.secondary === 'hobbies';
      const levels = prevCommit.commitmentLevels;
      nextCommitments = {
        ...prevCommit,
        commitmentLevels: {
          career: levels?.career ?? 0,
          hobbies: updateCommitmentLevel(levels?.hobbies ?? 0, 'hobbies', isHobbiesCommitted),
          relationships: levels?.relationships ?? 0,
          health: levels?.health ?? 0,
        },
      };
    }

    return {
      ...prev,
      stats,
      pursuits: { ...(prev.pursuits ?? {}), [pursuitId]: { xp: newXp, level: newLevel } },
      weeklyPursuitPractice: {
        ...(prev.weeklyPursuitPractice ?? {}),
        [pursuitId]: (prev.weeklyPursuitPractice?.[pursuitId] ?? 0) + 1,
      },
      ...(nextCommitments !== prevCommit && { activityCommitments: nextCommitments }),
    };
  });

  if (willLevelUp) {
    log.info(`Pursuit level up: ${pursuitId} → ${projectedLevel}${willTierUp ? ` (tier: ${tierForLevel(projectedLevel).name})` : ''}`);
    const tierName = tierForLevel(projectedLevel).name;
    return {
      success: true,
      leveledUp: true,
      newLevel: projectedLevel,
      tierUp: willTierUp,
      tierName: willTierUp ? tierName : undefined,
      message: projectedLevel >= MAX_PURSUIT_LEVEL
        ? `${def.name} mastered! You've reached the top tier.`
        : willTierUp
          ? `${def.name} reached ${tierName} — Lv ${projectedLevel}!`
          : `${def.name} leveled up to ${projectedLevel}!`,
    };
  }
  return { success: true, message: `Practiced ${def.name}.` };
};
