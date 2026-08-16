/**
 * Dating Actions
 * 
 * Handles romantic relationship progression including:
 * - Going on dates
 * - Giving gifts
 * - Proposals and engagement
 * - Wedding planning and execution
 * - Divorce
 */

import { GameState, WeddingPlan } from '../types';
import { logger } from '@/utils/logger';
import { applyMoneyDelta, updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';
import { rejectIfBlocked, isPlayerJailed } from './_guards';
import { getGiftMultiplier, updateOpinion, addMemory, createInitialOpinion, applyWantProgress } from '@/lib/social/npcDepth';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { clampRelationshipScore } from '@/utils/stateValidation';
import { commitDeterministicRolls, getDeterministicRoll } from '@/lib/randomness/deterministicRng';
import {
  getEngagementRing,
  calculateProposalSuccessRate,
} from '@/lib/dating/engagementRings';
import {
  getWeddingVenue,
  createWeddingPlan,
  calculateWeddingHappinessBonus,
  calculateWeddingReputationBonus,
} from '@/lib/dating/weddingVenues';
import type { Dispatch, SetStateAction } from 'react';
import { DIVORCE_LAWYER_BASE_FEE, WEEKS_PER_YEAR, WEDDING_DEPOSIT_RATE, DIVORCE_SETTLEMENT_BASE } from '@/lib/config/gameConstants';
import { findCommittedPartner } from '@/lib/dating/relationshipGuards';
import { buildSpouseRecord } from '@/lib/dating/spouseRecord';
import { bumpSparkLifetimeStat, clearPromotedSparkMatch } from '@/lib/dating/sparkStats';
import { formatMoney } from '@/utils/moneyFormatting';
import {
  milestoneToPulsePost,
  shouldAutoPostMilestone,
  type SparkMilestone,
} from '@/lib/dating/sparkPulseBridge';
import { getCommitmentModifiers } from '@/lib/commitments/commitmentSystem';
import { composePost } from './PulseActions';

const log = logger.scope('DatingActions');

const MIN_DIVORCE_CASH_BUFFER = 1000;
const FORCED_STOCK_LIQUIDATION_RATE = 0.97;
const FORCED_REAL_ESTATE_LIQUIDATION_RATE = 0.75;
const DIVORCE_DEBT_APR = 0.12;
const DIVORCE_DEBT_TERM_WEEKS = 104;

const safeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }
  return fallback;
};

const calculateDivorceNetWorth = (state: GameState): number => {
  let netWorth = safeNumber(state.stats?.money);
  netWorth += safeNumber(state.bankSavings);

  if (Array.isArray(state.stocks?.holdings)) {
    state.stocks.holdings.forEach(holding => {
      netWorth += safeNumber(holding.shares) * safeNumber(holding.currentPrice);
    });
  }

  if (Array.isArray(state.realEstate)) {
    state.realEstate.forEach(property => {
      if (!property?.owned) return;
      const currentValue = safeNumber(property.currentValue);
      const baseValue = safeNumber(property.price);
      netWorth += Math.max(0, currentValue || baseValue);
    });
  }

  if (Array.isArray(state.companies)) {
    state.companies.forEach(company => {
      netWorth += Math.max(0, safeNumber(company.weeklyIncome) * 10);
    });
  }

  return Math.max(0, netWorth);
};

const calculateForcedStockLiquidity = (state: GameState): number => {
  if (!Array.isArray(state.stocks?.holdings)) return 0;
  return state.stocks.holdings.reduce((total, holding) => {
    const gross = safeNumber(holding.shares) * safeNumber(holding.currentPrice);
    if (gross <= 0) return total;
    return total + Math.floor(gross * FORCED_STOCK_LIQUIDATION_RATE);
  }, 0);
};

const calculateForcedRealEstateLiquidity = (state: GameState): number => {
  if (!Array.isArray(state.realEstate)) return 0;
  return state.realEstate.reduce((total, property) => {
    if (!property?.owned) return total;
    const currentValue = safeNumber(property.currentValue);
    const baseValue = safeNumber(property.price);
    const liquidationBase = Math.max(0, currentValue || baseValue);
    if (liquidationBase <= 0) return total;
    return total + Math.floor(liquidationBase * FORCED_REAL_ESTATE_LIQUIDATION_RATE);
  }, 0);
};

/**
 * Date tiers — cost + effects for every date type goOnDate supports. Exported
 * so the Contacts date sheet renders accurate prices from ONE source of truth
 * (previously the sheet hard-coded 3 tiers at the wrong prices). `chat` is the
 * free maintain-the-bond tier for broke players.
 */
export const DATE_CONFIGS = {
  chat: { cost: 0, happiness: 2, relationshipBoost: 1, energy: 5 }, // Free option for maintaining relationships
  casual: { cost: 50, happiness: 5, relationshipBoost: 3, energy: 10 },
  coffee: { cost: 30, happiness: 3, relationshipBoost: 2, energy: 5 },
  dinner: { cost: 150, happiness: 10, relationshipBoost: 5, energy: 15 },
  romantic: { cost: 300, happiness: 20, relationshipBoost: 8, energy: 20 },
  adventure: { cost: 500, happiness: 25, relationshipBoost: 10, energy: 30 },
  luxury: { cost: 500, happiness: 30, relationshipBoost: 12, energy: 25 },
} as const;

export type DateType = keyof typeof DATE_CONFIGS;

/**
 * Fire-and-forget: translate a relationship milestone (engagement / wedding /
 * divorce / anniversary) into an auto-composed Pulse post via sparkPulseBridge,
 * but only when the player already uses Pulse (shouldAutoPostMilestone skips
 * never-posted accounts). composePost is idempotent per week + content-type, so
 * a same-week double-fire can't double-post. Best-effort: it never throws and
 * never blocks the milestone itself.
 */
function autoPostMilestone(
  setGameState: Dispatch<SetStateAction<GameState>>,
  gameState: GameState,
  milestone: SparkMilestone,
): void {
  if (!shouldAutoPostMilestone(gameState)) return;
  const args = milestoneToPulsePost(milestone);
  if (!args) return;
  composePost(setGameState, gameState, args);
}

/**
 * Go on a date with a partner
 */
export const goOnDate = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  dateType: DateType,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  // P1-3: dead players can't date.
  const blocked = rejectIfBlocked(gameState);
  if (blocked) return blocked;

  // Can't go on a date from a jail cell.
  if (isPlayerJailed(gameState)) {
    return { success: false, message: "You can't go on a date while you're in jail." };
  }

  const partner = gameState.relationships?.find(r => r.id === partnerId && (r.type === 'partner' || r.type === 'spouse'));
  if (!partner) {
    return { success: false, message: 'Partner not found.' };
  }

  // Date costs and effects — sourced from the module-level DATE_CONFIGS export
  // (single source of truth shared with the Contacts date sheet).
  const config = DATE_CONFIGS[dateType];

  // ANTI-EXPLOIT: Limit dates per week per partner (prevent free chat date spam)
  const MAX_DATES_PER_WEEK = 2;
  const currentWeeksLived = gameState.weeksLived || 0;
  const lastDateWeek = partner.lastDateWeek || 0;
  const datesThisWeek = lastDateWeek === currentWeeksLived ? (partner.datesThisWeek || 0) : 0;
  if (datesThisWeek >= MAX_DATES_PER_WEEK) {
    return { success: false, message: `You've already been on ${MAX_DATES_PER_WEEK} dates with ${partner.name} this week.` };
  }

  // Check if can afford
  if (gameState.stats.money < config.cost) {
    return { success: false, message: `You need $${config.cost} for this date.` };
  }

  // Check energy
  if (gameState.stats.energy < config.energy) {
    return { success: false, message: "You're too tired for a date." };
  }

  // Atomic update: deduct cost + update stats + update relationship in single setGameState.
  // P2-14: re-check the per-partner cap inside the updater so two same-batch
  // taps can't both pass the outer gate above and bypass the 2/wk limit
  // (same pattern as giveGift below).
  setGameState(prev => {
    const prevPartner = (prev.relationships || []).find(r => r.id === partnerId && (r.type === 'partner' || r.type === 'spouse'));
    if (prevPartner) {
      const prevWeeksLived = prev.weeksLived || 0;
      const prevDatesThisWeek = prevPartner.lastDateWeek === prevWeeksLived ? (prevPartner.datesThisWeek || 0) : 0;
      if (prevDatesThisWeek >= MAX_DATES_PER_WEEK) {
        return prev;
      }
    }
    // Canonical money path: applyMoneyDelta accumulates dailySummary.moneyChange
    // (the direct stats.money write made date spend invisible to the daily
    // summary). Pre-clamped to cash on hand to keep the old "broke players can
    // still date" clamp semantics.
    const dateSpend = Math.min(prev.stats.money || 0, config.cost);
    const moneyPatch = applyMoneyDelta(prev, -dateSpend, 'Date');
    return ({
    ...prev,
    ...(moneyPatch ?? {}),
    // Spark lifetime stat: this date counts toward the dating profile readout.
    sparkApp: bumpSparkLifetimeStat(prev.sparkApp, 'totalDatesGoneOn'),
    stats: {
      ...(moneyPatch?.stats ?? prev.stats),
      // C-1: the Commitment focus moves a date's energy cost. Resolved from
      // `prev` so it uses the commitments in force when the updater runs.
      energy: Math.max(0, Math.min(100,
        (prev.stats.energy || 0) - getCommitmentModifiers(prev, 'relationships').energyCost(config.energy))),
      happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) + config.happiness)),
    },
    relationships: (prev.relationships || []).map(r => {
      if (r.id !== partnerId) return r;
      // A date is quality time — if they'd been wanting time together (or a real
      // talk / to meet your friends), it satisfies that want for a diminishing
      // bonus (additive; only when a matching want is present).
      const wp = applyWantProgress(r.npcWant, 'date', prev.weeksLived || 0);
      // Life Skills: Charisma/Social Master (relationship gains) + Persuasion
      // (dating success) both amplify a date's relationship boost. Bounded mults.
      const dateMods = getLifeSkillModifiers(prev);
      // C-1: and the relationship gain itself. A player whose primary focus is
      // relationships was promised up to +50% here and received none of it;
      // one who had deprioritised relationships took no penalty either.
      const relCommitment = getCommitmentModifiers(prev, 'relationships');
      const datedBoost = Math.round(
        config.relationshipBoost
        * dateMods.relationshipGainMult
        * dateMods.datingSuccessMult
        * relCommitment.progressMultiplier,
      );
      return {
            ...r,
            relationshipScore: clampRelationshipScore(r.relationshipScore + datedBoost + wp.bonus),
            datesCount: (r.datesCount || 0) + 1,
            lastDateWeek: prev.weeksLived || 0,
            // ANTI-EXPLOIT: Track dates this week to prevent spam (especially free chat dates)
            datesThisWeek: (r.lastDateWeek === (prev.weeksLived || 0) ? (r.datesThisWeek || 0) : 0) + 1,
            // A date is a real contact — stamp recency so the Contacts recency
            // dot warms and the Attention tab clears (weeklyInteractions resets
            // when the last interaction was in an earlier week).
            lastInteractionWeek: prev.weeksLived || 0,
            weeklyInteractions:
              (r.lastInteractionWeek === (prev.weeksLived || 0) ? (r.weeklyInteractions || 0) : 0) + 1,
            npcWant: wp.want,
            // NPC reactivity: a date builds trust/attraction and is remembered.
            npcOpinion: updateOpinion(
              r.npcOpinion ?? createInitialOpinion(r.type, r.relationshipScore),
              'date',
            ),
            npcMemories: addMemory(r.npcMemories ?? [], {
              type: 'date',
              description: `You took them on a ${dateType} date${wp.satisfied ? ' — exactly the time together they wanted' : ''}`,
              weeksLived: prev.weeksLived || 0,
              sentiment: 'positive',
            }),
          };
    }),
    // Only record first_date milestone if one doesn't already exist for this partner
    lifeMilestones: (prev.lifeMilestones || []).some(m => m.type === 'first_date' && m.partnerId === partnerId)
      ? prev.lifeMilestones
      : [
          ...(prev.lifeMilestones || []),
          {
            id: `date_${prev.weeksLived || 0}_${partnerId}`,
            type: 'first_date' as const,
            week: prev.weeksLived,
            year: prev.date.year,
            partnerId,
            details: { dateType },
          },
        ],
  });
  });

  log.info(`Date with ${partner.name} - type: ${dateType}`);
  return { success: true, message: `Had a wonderful ${dateType} date with ${partner.name}!` };
};

/**
 * Give a gift to a partner
 */
export const giveGift = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  giftType: 'flowers' | 'jewelry' | 'trip' | 'surprise' | 'luxury',
  /**
   * Unused, and optional so callers need not fake it.
   *
   * The charge flows through `applyMoneyDelta` inside the updater — the atomic
   * gate→debit→grant of §4.4 — so the injected `updateMoney`/`updateStats` have
   * had no reader since that migration. Kept in position (not deleted) because
   * production passes it and the sibling DatingActions that DO use their deps
   * take it here; see Hard Rule #5 for why that call shape matters.
   */
  _deps?: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && (r.type === 'partner' || r.type === 'spouse'));
  if (!partner) {
    return { success: false, message: 'Partner not found.' };
  }

  const giftConfigs = {
    flowers: { cost: 50, relationshipBoost: 2, message: 'flowers' },
    jewelry: { cost: 500, relationshipBoost: 8, message: 'beautiful jewelry' },
    trip: { cost: 2000, relationshipBoost: 15, message: 'a surprise trip' },
    surprise: { cost: 200, relationshipBoost: 5, message: 'a thoughtful surprise' },
    luxury: { cost: 2000, relationshipBoost: 15, message: 'a luxury gift' },
  };

  const config = giftConfigs[giftType];

  // ANTI-EXPLOIT: Limit gifts per week per partner to prevent relationship score farming
  const MAX_GIFTS_PER_WEEK = 2;
  const currentWeeksLived = gameState.weeksLived || 0;
  const lastGiftWeek = partner.lastGiftWeek || 0;
  const giftsThisWeek = lastGiftWeek === currentWeeksLived ? (partner.giftsThisWeek || 0) : 0;
  if (giftsThisWeek >= MAX_GIFTS_PER_WEEK) {
    return { success: false, message: `You've already given ${partner.name} ${MAX_GIFTS_PER_WEEK} gifts this week. Give them some space!` };
  }

  if (gameState.stats.money < config.cost) {
    return { success: false, message: `You need $${config.cost} for this gift.` };
  }

  // Atomic update: deduct cost + update relationship in single setGameState.
  // ANTI-EXPLOIT: Re-check the weekly gift cap INSIDE the prev callback so
  // two rapid same-batch gift clicks don't both pass the outer gate above and
  // bypass the 2/wk cap.
  setGameState(prev => {
    const prevPartner = (prev.relationships || []).find(r => r.id === partnerId);
    if (!prevPartner) return prev;
    const prevWeek = prev.weeksLived || 0;
    const prevGiftsThisWeek = prevPartner.lastGiftWeek === prevWeek ? (prevPartner.giftsThisWeek || 0) : 0;
    if (prevGiftsThisWeek >= MAX_GIFTS_PER_WEEK) return prev;
    const prevMoney = prev.stats.money || 0;
    if (prevMoney < config.cost) return prev;

    // Canonical money path (affordability was rejected above, so this only
    // adds the dailySummary tracking the direct write skipped).
    const giftPatch = applyMoneyDelta(prev, -config.cost, 'Gift');
    if (!giftPatch) return prev;
    return {
      ...prev,
      ...giftPatch,
      // Spark lifetime stat: this gift counts toward the dating profile readout.
      sparkApp: bumpSparkLifetimeStat(prev.sparkApp, 'totalGiftsGiven'),
      relationships: (prev.relationships || []).map(r => {
        if (r.id !== partnerId) return r;
        // NPC reactivity: scale the boost by how much THIS npc likes this gift
        // type (personality-driven), move their opinion, and record a memory so
        // they actually remember it. Previously every gift was identical.
        const mult = getGiftMultiplier(r, giftType);
        // Life Skills: Charisma / Social Master boost positive relationship gains.
        const giftGainMult = getLifeSkillModifiers(prev).relationshipGainMult;
        const scaledBoost = Math.max(1, Math.round(config.relationshipBoost * mult * giftGainMult));
        const disliked = mult < 1.0;
        // If they'd been WANTING a gift, satisfying that want adds a diminishing
        // bonus on top (additive — only fires when a matching want is present).
        const wp = applyWantProgress(r.npcWant, 'gift', prevWeek);
        return {
          ...r,
          relationshipScore: clampRelationshipScore(r.relationshipScore + scaledBoost + wp.bonus),
          giftsReceived: (r.giftsReceived || 0) + 1,
          giftsThisWeek: prevGiftsThisWeek + 1,
          lastGiftWeek: prevWeek,
          // A gift is a real contact — stamp recency (see goOnDate above).
          lastInteractionWeek: prevWeek,
          weeklyInteractions:
            (r.lastInteractionWeek === prevWeek ? (r.weeklyInteractions || 0) : 0) + 1,
          npcWant: wp.want,
          npcOpinion: updateOpinion(
            r.npcOpinion ?? createInitialOpinion(r.type, r.relationshipScore),
            disliked ? 'gift_disliked' : 'gift_liked',
          ),
          npcMemories: addMemory(r.npcMemories ?? [], {
            type: 'gift',
            description: `You gave them ${config.message}${wp.satisfied ? ' — just what they wanted' : mult > 1 ? ' — a favorite' : disliked ? " — not their taste" : ''}`,
            weeksLived: prevWeek,
            sentiment: disliked ? 'negative' : 'positive',
          }),
        };
      }),
    };
  });

  // Message reflects the NPC's actual taste — and whether it answered a want.
  const reactMult = getGiftMultiplier(partner, giftType);
  const wantedGift = applyWantProgress(partner.npcWant, 'gift', currentWeeksLived).satisfied;
  const reaction = reactMult > 1 ? `${partner.name} adored ${config.message}!`
    : reactMult < 1 ? `${partner.name} accepted ${config.message}, but it wasn't quite their taste.`
    : `${partner.name} appreciated ${config.message}.`;
  const finalReaction = wantedGift ? `${reaction} They'd been hoping for a gift — it really landed.` : reaction;
  log.info(`Gift to ${partner.name} - type: ${giftType}`);
  return { success: true, message: finalReaction };
};

/**
 * Propose marriage to a partner
 */
export const proposeMarriage = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  ringId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string; accepted: boolean } => {
  // Can't propose from a jail cell.
  if (isPlayerJailed(gameState)) {
    return { success: false, message: "You can't propose while you're in jail.", accepted: false };
  }

  const partner = gameState.relationships?.find(r => r.id === partnerId && r.type === 'partner');
  if (!partner) {
    return { success: false, message: 'Partner not found.', accepted: false };
  }

  // ANTI-BIGAMY: can't propose while committed (engaged / married / living
  // with) to someone else.
  const committedElsewhere = findCommittedPartner(gameState.relationships, partnerId);
  if (committedElsewhere) {
    return {
      success: false,
      message: `You are already with ${committedElsewhere.name}. You can't propose to ${partner.name}.`,
      accepted: false,
    };
  }

  const ring = getEngagementRing(ringId);
  if (!ring) {
    return { success: false, message: 'Ring not found.', accepted: false };
  }

  // Check if can afford
  if (gameState.stats.money < ring.price) {
    return {
      success: false,
      message: `This ring costs ${formatMoney(ring.price)} — you have ${formatMoney(gameState.stats.money)} (${formatMoney(ring.price - gameState.stats.money)} short).`,
      accepted: false,
    };
  }

  // Check relationship score
  if (partner.relationshipScore < 60) {
    return { success: false, message: "Your relationship isn't strong enough yet. Keep building trust!", accepted: false };
  }

  // Calculate success rate
  const successRate = calculateProposalSuccessRate(
    partner.relationshipScore,
    ring,
    partner.datesCount || 0,
    partner.livingTogether || false
  );

  // RANDOMNESS FIX: Soft guarantee - if calculated rate is 95%+, guarantee success
  // This prevents frustrating failures at high relationship scores
  // PRIORITY 2 FIX: Use constant from randomnessConstants
  const { SOFT_GUARANTEE_PROPOSAL } = require('@/lib/randomness/randomnessConstants');
  const guaranteedSuccess = successRate >= SOFT_GUARANTEE_PROPOSAL;
  const proposalRollKey = `proposal:${gameState.weeksLived || 0}:${partnerId}:${ringId}:score:${Math.floor(partner.relationshipScore)}:dates:${partner.datesCount || 0}`;
  const proposalRoll = guaranteedSuccess ? null : getDeterministicRoll(gameState, proposalRollKey);
  const rngCommitKeys = guaranteedSuccess ? [] : [proposalRollKey];
  const accepted = guaranteedSuccess ? true : ((proposalRoll || 0) * 100 < successRate);

  if (accepted) {
    // Atomic update: deduct ring cost + update stats + update relationship + milestone.
    // R4-D: re-check affordability AND that the partner is still a `partner`
    // (not already-engaged / already-spouse) inside the updater so a same-batch
    // double-tap can't double-charge for one proposal.
    setGameState(prev => {
      const prevPartner = (prev.relationships || []).find(r => r.id === partnerId);
      if (!prevPartner || prevPartner.type !== 'partner' || prevPartner.engagementWeek != null) {
        return prev;
      }
      // ANTI-BIGAMY recheck — a same-batch propose to a second partner must
      // not go through (or charge for the ring) once the first is engaged.
      if (findCommittedPartner(prev.relationships, partnerId)) {
        return prev;
      }
      if ((prev.stats?.money ?? 0) < ring.price) {
        return prev;
      }
      const nextRngCommitLog = commitDeterministicRolls(prev, rngCommitKeys, prev.weeksLived || 0);
      return {
        ...prev,
        // Spark lifetime stat: a proposal was made (accepted).
        sparkApp: bumpSparkLifetimeStat(prev.sparkApp, 'totalProposals'),
        stats: {
          ...prev.stats,
          money: Math.max(0, (prev.stats.money || 0) - ring.price),
          happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) + 30)),
        },
        relationships: (prev.relationships || []).map(r =>
          r.id === partnerId
            ? {
                ...r,
                engagementWeek: prev.weeksLived || 0,
                engagementRing: ring,
                relationshipScore: clampRelationshipScore(r.relationshipScore + 15),
              }
            : r
        ),
        // R2-B: cap to 200 milestones — pruned at save time, but the
        // in-memory cap stops the per-action O(N) spread from dominating.
        lifeMilestones: [
          ...(prev.lifeMilestones || []),
          {
            id: `engagement_${prev.weeksLived || 0}_${partnerId}`,
            type: 'engagement' as const,
            week: prev.weeksLived || 0,
            year: prev.date.year,
            partnerId,
            details: { ringId, ringName: ring.name },
          },
        ].slice(-200),
        rngCommitLog: nextRngCommitLog,
      };
    });

    // Auto-post the engagement to the player's Pulse feed (fire-and-forget).
    autoPostMilestone(setGameState, gameState, {
      kind: 'engagement',
      partnerName: partner.name,
      ringTier: ring.name,
    });

    log.info(`Proposal accepted by ${partner.name}`);
    return { success: true, message: `${partner.name} said YES! You're engaged!`, accepted: true };
  } else {
    // Atomic update: deduct ring cost + update stats + reduce relationship.
    // R4-D: same recheck as the accepted branch — a same-batch double-tap can't
    // double-charge the ring.
    setGameState(prev => {
      const prevPartner = (prev.relationships || []).find(r => r.id === partnerId);
      if (!prevPartner || prevPartner.type !== 'partner' || prevPartner.engagementWeek != null) {
        return prev;
      }
      // ANTI-BIGAMY recheck — a same-batch propose to a second partner must
      // not go through (or charge for the ring) once the first is engaged.
      if (findCommittedPartner(prev.relationships, partnerId)) {
        return prev;
      }
      if ((prev.stats?.money ?? 0) < ring.price) {
        return prev;
      }
      const nextRngCommitLog = commitDeterministicRolls(prev, rngCommitKeys, prev.weeksLived || 0);
      return {
        ...prev,
        // Spark lifetime stat: a proposal was made (declined).
        sparkApp: bumpSparkLifetimeStat(prev.sparkApp, 'totalProposals'),
        stats: {
          ...prev.stats,
          money: Math.max(0, (prev.stats.money || 0) - ring.price),
          happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) - 20)),
        },
        relationships: (prev.relationships || []).map(r =>
          r.id === partnerId
            ? { ...r, relationshipScore: clampRelationshipScore(r.relationshipScore - 10) }
            : r
        ),
        rngCommitLog: nextRngCommitLog,
      };
    });

    log.info(`Proposal rejected by ${partner.name}`);
    return {
      success: true,
      message: `${partner.name} said they're not ready... The relationship needs more time.`,
      accepted: false
    };
  }
};

/**
 * Plan a wedding
 */
export const planWedding = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  venueId: string,
  guestCount: number,
  weeksFromNow: number,
  options: { catering?: boolean; photography?: boolean; music?: boolean; decorations?: boolean }
): { success: boolean; message: string; plan?: WeddingPlan } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && r.engagementWeek);
  if (!partner) {
    return { success: false, message: 'You must be engaged first!' };
  }

  if (partner.weddingPlanned) {
    return { success: false, message: 'A wedding is already planned!' };
  }

  // ANTI-BIGAMY: pre-fix saves can carry two engagements (the old propose stub
  // had no exclusivity guard). Let such players marry ONE of them, but never
  // schedule a second wedding or plan one while already married.
  const otherCommitted = (gameState.relationships || []).find(
    r => r.id !== partnerId && (r.type === 'spouse' || r.weddingPlanned)
  );
  if (otherCommitted) {
    return {
      success: false,
      message: otherCommitted.type === 'spouse'
        ? `You're already married to ${otherCommitted.name}.`
        : `You're already planning a wedding with ${otherCommitted.name}.`,
    };
  }

  const venue = getWeddingVenue(venueId);
  if (!venue) {
    return { success: false, message: 'Venue not found.' };
  }

  if (guestCount > venue.guestCapacity) {
    return { success: false, message: `This venue can only accommodate ${venue.guestCapacity} guests.` };
  }

  const scheduledWeek = (gameState.weeksLived || 0) + weeksFromNow;
  const plan = createWeddingPlan(venueId, partnerId, guestCount, scheduledWeek, options);

  if (!plan) {
    return { success: false, message: 'Could not create wedding plan.' };
  }

  // Check if can afford deposit (25% upfront)
  const deposit = Math.floor(plan.budget * WEDDING_DEPOSIT_RATE);
  if (gameState.stats.money < deposit) {
    return {
      success: false,
      message: `Wedding deposit is ${formatMoney(deposit)} (25% of budget) — you have ${formatMoney(gameState.stats.money)} (${formatMoney(deposit - gameState.stats.money)} short).`,
    };
  }

  // Save wedding plan
  setGameState(prev => {
    // ANTI-BIGAMY recheck — a same-batch double-plan must not schedule two.
    const prevOtherCommitted = (prev.relationships || []).some(
      r => r.id !== partnerId && (r.type === 'spouse' || r.weddingPlanned)
    );
    if (prevOtherCommitted) return prev;

    /**
     * R3-F2: re-check THIS partner too.
     *
     * The bigamy guard above deliberately excludes `partnerId`, and the outer
     * `if (partner.weddingPlanned) return …` runs against the render-time
     * `gameState`. So the one case neither covered was a double-tap on the SAME
     * partner: both updaters passed, the deposit was charged twice, and the
     * second write overwrote `weddingPlanned` with an identical plan — one
     * wedding, two deposits, silently. On the Tropical Island Resort that is
     * ~$25k charged twice. The modal's button is gated only on
     * `!selectedVenueId || !canAfford`, with `canAfford` derived from the stale
     * `gameState.stats.money` and no in-flight flag.
     *
     * The affordability re-check below cannot substitute for this: a player who
     * can afford the deposit twice passes it twice. CLAUDE.md §4.4.
     */
    const thisPartnerAlreadyPlanned = (prev.relationships || []).some(
      r => r.id === partnerId && r.weddingPlanned
    );
    if (thisPartnerAlreadyPlanned) return prev;

    // Re-check affordability inside the updater (matches proposeMarriage /
    // executeWedding).
    if ((prev.stats?.money ?? 0) < deposit) return prev;
    return {
      ...prev,
      relationships: (prev.relationships || []).map(r =>
        r.id === partnerId ? { ...r, weddingPlanned: plan } : r
      ),
      stats: {
        ...prev.stats,
        money: Math.max(0, (prev.stats.money || 0) - deposit),
      },
    };
  });

  log.info(`Wedding planned at ${venue.name} for week ${scheduledWeek}`);
  return { 
    success: true, 
    message: `Wedding planned for ${weeksFromNow} weeks from now at ${venue.name}! Deposit paid: $${deposit.toLocaleString()}`,
    plan,
  };
};

/**
 * Execute a wedding (convert engaged partner to spouse)
 */
export const executeWedding = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && r.weddingPlanned);
  if (!partner || !partner.weddingPlanned) {
    return { success: false, message: 'No wedding planned!' };
  }

  const plan = partner.weddingPlanned;

  // Check if it's the scheduled week
  if ((gameState.weeksLived || 0) < plan.scheduledWeek) {
    return { success: false, message: `The wedding isn't until week ${plan.scheduledWeek}.` };
  }

  // Pay remaining balance (75%)
  const remainingBalance = Math.floor(plan.budget * 0.75);
  if (gameState.stats.money < remainingBalance) {
    return {
      success: false,
      message: `Wedding balance is ${formatMoney(remainingBalance)} (the remaining 75%) — you have ${formatMoney(gameState.stats.money)} (${formatMoney(remainingBalance - gameState.stats.money)} short).`,
    };
  }

  // Calculate bonuses
  const happinessBonus = calculateWeddingHappinessBonus(plan);
  const reputationBonus = calculateWeddingReputationBonus(plan);

  // Atomic update: pay remaining balance + update stats + convert partner to spouse.
  // R4-D: re-check affordability inside the updater and bail if the partner is
  // already a spouse — a same-batch double-tap can't double-charge the wedding.
  setGameState(prev => {
    const prevPartner = (prev.relationships || []).find(r => r.id === partnerId);
    if (!prevPartner || prevPartner.type === 'spouse') return prev;
    if ((prev.stats?.money ?? 0) < remainingBalance) return prev;
    // RELATIONSHIP STATE FIX: Remove existing spouse if different person (prevent duplicates)
    let relationships = prev.relationships || [];
    const existingSpouse = prev.family?.spouse;
    if (existingSpouse && existingSpouse.id !== partnerId) {
      relationships = relationships.filter(r => r.id !== existingSpouse.id);
      log.warn('Replacing existing spouse during wedding', { oldSpouseId: existingSpouse.id, newSpouseId: partnerId });
    }

    const updatedRelationships = relationships.map(r =>
      r.id === partnerId
        ? {
            // Shared spouse-record factory — keeps this manual path identical to
            // the weekly-tick auto path (applyScheduledWedding). Sets type,
            // marriageWeek/anniversaryWeek, clears engagement fields, and sets
            // livingTogether.
            ...buildSpouseRecord(r, prev.weeksLived || 0),
          }
        : r
    );

    // Also set as family spouse
    const spouse = updatedRelationships.find(r => r.id === partnerId);

    return {
      ...prev,
      // Spark lifetime stat: a marriage happened.
      sparkApp: bumpSparkLifetimeStat(prev.sparkApp, 'totalMarriages'),
      stats: {
        ...prev.stats,
        money: Math.max(0, (prev.stats.money || 0) - remainingBalance),
        happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) + happinessBonus)),
        reputation: Math.max(0, Math.min(100, (prev.stats.reputation || 0) + reputationBonus)),
      },
      relationships: updatedRelationships,
      family: {
        ...prev.family,
        spouse: spouse,
      },
      // R2-B: cap to 200 milestones (see engagement above).
      lifeMilestones: [
        ...(prev.lifeMilestones || []),
        {
          id: `wedding_${prev.weeksLived || 0}_${partnerId}`,
          type: 'wedding' as const,
          week: prev.weeksLived || 0,
          year: prev.date.year,
          partnerId,
          details: {
            venueName: plan.venueName,
            guestCount: plan.guestCount,
            totalCost: plan.budget,
          },
        },
      ].slice(-200),
    };
  });

  // Auto-post the wedding to the player's Pulse feed (fire-and-forget).
  autoPostMilestone(setGameState, gameState, {
    kind: 'wedding',
    partnerName: partner.name,
    venue: plan.venueName,
  });

  log.info(`Wedding executed for ${partner.name}`);
  return {
    success: true,
    message: `Congratulations! You and ${partner.name} are now married! 💒`
  };
};

/**
 * Calculate divorce costs without actually divorcing (for preview)
 */
export const calculateDivorceCosts = (gameState: GameState, spouseId: string): {
  netWorth: number;
  settlement: number;
  settlementPercent: number;
  lawyerFees: number;
  totalCost: number;
  moneyAfter: number;
  immediateLiquidity: number;
  projectedDebt: number;
} | null => {
  const spouse = gameState.relationships?.find(r => r.id === spouseId && r.type === 'spouse');
  if (!spouse) {
    return null;
  }

  const netWorth = calculateDivorceNetWorth(gameState);
  // Use a deterministic settlement percent based on spouse ID for consistency
  // This ensures preview matches actual divorce
  const spouseForCalc = gameState.relationships?.find(r => r.id === spouseId && r.type === 'spouse');
  const spouseHash = spouseForCalc ? spouseForCalc.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const settlementRatio = DIVORCE_SETTLEMENT_BASE + ((spouseHash % 20) / 100); // 15-35% of net worth (deterministic)
  const settlement = Math.floor(netWorth * settlementRatio);
  const lawyerFees = DIVORCE_LAWYER_BASE_FEE;
  const liquidAssets = safeNumber(gameState.stats.money) + safeNumber(gameState.bankSavings);
  const forcedStockLiquidity = calculateForcedStockLiquidity(gameState);
  const forcedRealEstateLiquidity = calculateForcedRealEstateLiquidity(gameState);
  const immediateLiquidity = Math.max(
    0,
    liquidAssets + forcedStockLiquidity + forcedRealEstateLiquidity - MIN_DIVORCE_CASH_BUFFER
  );
  const totalCost = settlement + lawyerFees;
  const projectedDebt = Math.max(0, totalCost - immediateLiquidity);
  const immediatePaid = Math.min(totalCost, immediateLiquidity);
  const moneyAfter = Math.max(MIN_DIVORCE_CASH_BUFFER, liquidAssets + forcedStockLiquidity + forcedRealEstateLiquidity - immediatePaid);

  return {
    netWorth,
    settlement,
    settlementPercent: netWorth > 0 ? (settlement / netWorth) * 100 : 0,
    lawyerFees,
    totalCost,
    moneyAfter,
    immediateLiquidity,
    projectedDebt,
  };
};

/**
 * File for divorce
 */
export const fileDivorce = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  spouseId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats },
  lawyerId?: string // Optional lawyer ID to fight the settlement
): { success: boolean; message: string; settlement?: number; lawyerResult?: any } => {
  const spouse = gameState.relationships?.find(r => r.id === spouseId && r.type === 'spouse');
  if (!spouse) {
    return { success: false, message: 'Spouse not found.' };
  }

  // ANTI-EXPLOIT: Divorce cooldown - prevent marry/divorce/remarry loop for stat/money manipulation
  const DIVORCE_COOLDOWN_WEEKS = 26; // 6 months cooldown
  const currentWeeksLived = gameState.weeksLived || 0;
  const lastDivorceWeek = gameState.lastDivorceWeek || 0;
  if (lastDivorceWeek > 0 && (currentWeeksLived - lastDivorceWeek) < DIVORCE_COOLDOWN_WEEKS) {
    const weeksToWait = DIVORCE_COOLDOWN_WEEKS - (currentWeeksLived - lastDivorceWeek);
    return { success: false, message: `You must wait ${weeksToWait} more weeks before filing for divorce again.` };
  }

  const netWorth = calculateDivorceNetWorth(gameState);
  const spouseHash = spouse.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const settlementRatio = 0.15 + ((spouseHash % 20) / 100);
  const baseSettlement = Math.floor(netWorth * settlementRatio);

  let lawyerResult: any = null;
  let settlementObligation = baseSettlement;
  let lawyerFees = 5000;
  let lawyerCost = 0;
  const rngCommitKeys: string[] = [];

  if (lawyerId) {
    const lawyerModule = require('@/lib/dating/divorceLawyers');
    const lawyer = lawyerModule.DIVORCE_LAWYERS.find((entry: any) => entry.id === lawyerId);
    if (lawyer) {
      const lawyerSuccessRollKey = `divorce_lawyer_success:${gameState.weeksLived || 0}:${spouseId}:${lawyerId}:${baseSettlement}`;
      const lawyerReductionRollKey = `divorce_lawyer_reduction:${gameState.weeksLived || 0}:${spouseId}:${lawyerId}:${baseSettlement}`;
      const lawyerSuccessRoll = getDeterministicRoll(gameState, lawyerSuccessRollKey);
      const lawyerReductionRoll = getDeterministicRoll(gameState, lawyerReductionRollKey);
      rngCommitKeys.push(lawyerSuccessRollKey, lawyerReductionRollKey);

      lawyerResult = lawyerModule.calculateLawyerOutcome(baseSettlement, lawyer, {
        successRoll: lawyerSuccessRoll,
        reductionRoll: lawyerReductionRoll,
      });
      settlementObligation = Math.max(0, Math.floor(safeNumber(lawyerResult?.reducedSettlement, baseSettlement)));
      lawyerCost = Math.max(0, Math.floor(safeNumber(lawyerResult?.lawyerCost, 0)));

      log.info(
        `[DIVORCE] Lawyer ${lawyer.name} ${lawyerResult?.success ? 'SUCCEEDED' : 'FAILED'}. ` +
        `Settlement: $${baseSettlement} -> $${settlementObligation}`
      );
    }
  }

  const totalObligation = settlementObligation + lawyerFees + lawyerCost;
  const quoteRollKey = `divorce_quote:${gameState.weeksLived || 0}:${spouseId}:${totalObligation}`;
  const quoteRoll = getDeterministicRoll(gameState, quoteRollKey);
  rngCommitKeys.push(quoteRollKey);

  // Two-phase commit so we don't trample concurrent updates (e.g. the weekly
  // tick firing between this action's snapshot and the actual setGameState
  // apply, modifying money/loans/relationships):
  //
  // Phase 1 (eager, against gameState): compute the SETTLEMENT terms — the
  //   numbers the user just agreed to via the confirmation modal. These are
  //   stable across re-renders and feed both the log and the return message.
  //   We also compute the resulting portfolio (updatedHoldings, updatedRealEstate)
  //   here, since liquidation against the portfolio the user saw is the
  //   reasonable expectation.
  //
  // Phase 2 (inside setGameState(prev =>): RE-DERIVE money / savings / loans /
  //   relationships / rngCommitLog from prev. The user owes `totalObligation`
  //   plus the proceeds from `stockLiquidationGained + propertyLiquidationGained`
  //   come in on top of prev's current cash, then the obligation is drained
  //   from money → savings → debt. This keeps any in-flight income or
  //   loan-payment updates from the weekly tick.
  const currentMoneyAtSnapshot = Math.max(0, safeNumber(gameState.stats?.money));
  const currentSavingsAtSnapshot = Math.max(0, safeNumber(gameState.bankSavings));

  const availableAtSnapshot =
    Math.max(0, currentMoneyAtSnapshot - MIN_DIVORCE_CASH_BUFFER) + currentSavingsAtSnapshot;
  let requiredFromAssetLiquidation = Math.max(0, totalObligation - availableAtSnapshot);

  const originalHoldings = Array.isArray(gameState.stocks?.holdings) ? gameState.stocks.holdings : [];
  const updatedHoldings: NonNullable<GameState['stocks']>['holdings'] = [];
  let stockLiquidationGained = 0;

  originalHoldings.forEach(holding => {
    const shares = Math.max(0, safeNumber(holding.shares));
    const currentPrice = Math.max(0, safeNumber(holding.currentPrice));
    const proceedsPerShare = currentPrice * FORCED_STOCK_LIQUIDATION_RATE;

    if (requiredFromAssetLiquidation <= 0 || shares <= 0 || proceedsPerShare <= 0) {
      updatedHoldings.push(holding);
      return;
    }

    const maxProceeds = shares * proceedsPerShare;
    if (maxProceeds <= requiredFromAssetLiquidation + 0.0001) {
      const realized = Math.floor(maxProceeds);
      stockLiquidationGained += realized;
      requiredFromAssetLiquidation = Math.max(0, requiredFromAssetLiquidation - realized);
      return;
    }

    const sharesToSell = Math.min(shares, Math.ceil(requiredFromAssetLiquidation / proceedsPerShare));
    const realized = Math.floor(sharesToSell * proceedsPerShare);
    if (realized <= 0) {
      updatedHoldings.push(holding);
      return;
    }

    stockLiquidationGained += realized;
    requiredFromAssetLiquidation = Math.max(0, requiredFromAssetLiquidation - realized);

    const remainingShares = Math.max(0, shares - sharesToSell);
    if (remainingShares > 0) {
      updatedHoldings.push({
        ...holding,
        shares: remainingShares,
      });
    }
  });

  let propertyLiquidationGained = 0;
  let updatedRealEstate = Array.isArray(gameState.realEstate) ? [...gameState.realEstate] : [];
  if (requiredFromAssetLiquidation > 0 && updatedRealEstate.length > 0) {
    const liquidationCandidates = updatedRealEstate
      .filter(property => property?.owned)
      .map(property => {
        const currentValue = safeNumber(property.currentValue);
        const baseValue = safeNumber(property.price);
        const liquidationBase = Math.max(0, currentValue || baseValue);
        const proceeds = Math.floor(liquidationBase * FORCED_REAL_ESTATE_LIQUIDATION_RATE);
        return { id: property.id, proceeds };
      })
      .filter(candidate => candidate.proceeds > 0)
      .sort((a, b) => b.proceeds - a.proceeds);

    const liquidatedPropertyIds = new Set<string>();
    liquidationCandidates.forEach(candidate => {
      if (requiredFromAssetLiquidation <= 0) return;
      liquidatedPropertyIds.add(candidate.id);
      propertyLiquidationGained += candidate.proceeds;
      requiredFromAssetLiquidation = Math.max(0, requiredFromAssetLiquidation - candidate.proceeds);
    });

    if (liquidatedPropertyIds.size > 0) {
      updatedRealEstate = updatedRealEstate.map(property => {
        if (!property?.owned || !liquidatedPropertyIds.has(property.id)) {
          return property;
        }

        const { currentResidence: _ignoredCurrentResidence, ...withoutResidence } = property;
        return {
          ...withoutResidence,
          owned: false,
          status: 'vacant' as const,
          rent: 0,
          upkeep: 0,
          currentValue: safeNumber(property.price),
        };
      });
    }
  }

  // Audit estimates against the snapshot — these are what the modal/log show.
  // The actual amounts applied to state are recomputed below against `prev`
  // and will match these in the common case (no concurrent state change in
  // the gap between snapshot and commit).
  let estimatedRemaining = totalObligation;
  let estimatedMoney = currentMoneyAtSnapshot + stockLiquidationGained + propertyLiquidationGained;
  let estimatedSavings = currentSavingsAtSnapshot;
  const estFromMoney = Math.min(
    estimatedRemaining,
    Math.max(0, estimatedMoney - MIN_DIVORCE_CASH_BUFFER),
  );
  estimatedMoney -= estFromMoney;
  estimatedRemaining -= estFromMoney;
  const estFromSavings = Math.min(estimatedRemaining, Math.max(0, estimatedSavings));
  estimatedSavings -= estFromSavings;
  estimatedRemaining -= estFromSavings;
  const estimatedDebtShortfall = Math.max(0, Math.ceil(estimatedRemaining));
  const estimatedImmediatePayment = totalObligation - estimatedDebtShortfall;

  const immediatePaymentApplied = estimatedImmediatePayment;
  const divorceDebtCreated = estimatedDebtShortfall;
  const forcedStockLiquidationPaid = stockLiquidationGained;
  const forcedPropertyLiquidationPaid = propertyLiquidationGained;

  setGameState(prev => {
    /**
     * R3-F1: re-check the gates against `prev`, INSIDE the updater.
     *
     * Everything above — the spouse lookup and the 26-week cooldown — runs
     * against the render-time `gameState`. The updater derived money from
     * `prev` but never re-checked either gate, so two taps in one React batch
     * both applied the FULL settlement: `remaining = totalObligation` drained
     * from money then savings then debt twice over, the lawyer fee landed
     * twice, -40 happiness / -10 reputation landed twice, and the divorce loan
     * id embeds `newLoans.length` so the second one got a different id and
     * escaped dedupe — two "Divorce Settlement Debt" loans for one divorce.
     * The confirm button has no in-flight guard, and the action reads
     * `gameStateRef.current`, which is stale within a batch.
     *
     * This updater writes `lastDivorceWeek`, so the second tap's re-check sees
     * the first tap's write and rejects. CLAUDE.md §4.4.
     */
    const stillMarried = prev.relationships?.some(r => r.id === spouseId && r.type === 'spouse');
    if (!stillMarried) return prev;

    const prevLastDivorce = prev.lastDivorceWeek || 0;
    const prevWeeks = prev.weeksLived || 0;
    if (prevLastDivorce > 0 && (prevWeeks - prevLastDivorce) < DIVORCE_COOLDOWN_WEEKS) {
      return prev;
    }

    // Phase 2: derive cash/loans/relationships/RNG from prev so a concurrent
    // weekly tick (or any other queued action) isn't clobbered.
    const prevMoney = Math.max(0, safeNumber(prev.stats?.money));
    const prevSavings = Math.max(0, safeNumber(prev.bankSavings));

    let remaining = totalObligation;
    let workingMoney = prevMoney + stockLiquidationGained + propertyLiquidationGained;
    let workingSavings = prevSavings;

    const fromMoney = Math.min(remaining, Math.max(0, workingMoney - MIN_DIVORCE_CASH_BUFFER));
    workingMoney -= fromMoney;
    remaining -= fromMoney;

    const fromSavings = Math.min(remaining, Math.max(0, workingSavings));
    workingSavings -= fromSavings;
    remaining -= fromSavings;

    const actualDebtShortfall = Math.max(0, Math.ceil(remaining));
    const actualImmediatePayment = totalObligation - actualDebtShortfall;

    const newLoans = [...(prev.loans || [])];
    if (actualDebtShortfall > 0) {
      const weeklyPayment = Math.max(
        50,
        Math.round(
          Math.max(
            actualDebtShortfall / DIVORCE_DEBT_TERM_WEEKS,
            actualDebtShortfall * 0.005,
          ),
        ),
      );
      newLoans.push({
        id: `divorce_loan_${spouseId}_${prev.weeksLived || 0}_${newLoans.length + 1}`,
        name: 'Divorce Settlement Debt',
        principal: actualDebtShortfall,
        remaining: actualDebtShortfall,
        rateAPR: DIVORCE_DEBT_APR,
        termWeeks: DIVORCE_DEBT_TERM_WEEKS,
        weeklyPayment,
        startWeek: prev.weeksLived || 0,
        autoPay: true,
        type: 'personal',
        weeksRemaining: DIVORCE_DEBT_TERM_WEEKS,
        interestRate: DIVORCE_DEBT_APR,
      });
    }

    const baseStats = prev.stats || ({} as GameState['stats']);
    const nextStats: GameState['stats'] = { ...baseStats };
    nextStats.money = Math.max(0, workingMoney);
    nextStats.happiness = Math.max(0, Math.min(100, safeNumber(nextStats.happiness) - 40));
    nextStats.reputation = Math.max(0, Math.min(100, safeNumber(nextStats.reputation) - 10));

    const nextRelationships = (prev.relationships || [])
      .map(r => (r.id === spouseId ? { ...r, livingTogether: false } : r))
      .filter(r => r.id !== spouseId);

    const nextRngCommitLog = commitDeterministicRolls(prev, rngCommitKeys, prev.weeksLived || 0);

    return {
      ...prev,
      // Spark lifetime stat: a divorce was finalized. Also clear the backing
      // match's `promoted` flag so the ex stops rendering as your partner in
      // Spark and can be re-dated later.
      sparkApp: clearPromotedSparkMatch(
        bumpSparkLifetimeStat(prev.sparkApp, 'totalDivorces'),
        spouseId
      ),
      stats: nextStats,
      bankSavings: Math.max(0, workingSavings),
      stocks: prev.stocks
        ? {
            ...prev.stocks,
            holdings: updatedHoldings,
          }
        : prev.stocks,
      realEstate: updatedRealEstate,
      loans: newLoans,
      relationships: nextRelationships,
      family: {
        ...prev.family,
        spouse: undefined,
      },
      // ANTI-EXPLOIT: Track divorce week for cooldown (prevent marry/divorce cycling)
      lastDivorceWeek: prev.weeksLived || 0,
      // Merge our deltas with whatever dailySummary `prev` has so a concurrent
      // weekly tick's summary entries aren't blown away. Use the ACTUAL
      // immediate payment (derived from prev) so the running money tally is
      // consistent with what we just deducted.
      dailySummary: {
        ...prev.dailySummary,
        moneyChange: (prev.dailySummary?.moneyChange || 0) - actualImmediatePayment,
        statsChange: {
          ...(prev.dailySummary?.statsChange || {}),
          happiness: (prev.dailySummary?.statsChange?.happiness || 0) - 40,
          reputation: (prev.dailySummary?.statsChange?.reputation || 0) - 10,
        },
        events: prev.dailySummary?.events || [],
      },
      rngCommitLog: nextRngCommitLog,
    };
  });

  // Auto-post the divorce to the player's Pulse feed (fire-and-forget).
  autoPostMilestone(setGameState, gameState, {
    kind: 'divorce',
    partnerName: spouse.name,
  });

  const funnyDivorceQuotes = [
    "'I thought till death do us part meant something.'",
    "'Congratulations, you won... the settlement bill.'",
    "'The prenup did not include emotional damages.'",
    "'You can keep the house, I kept the debt.'",
    "'Signed, sealed, billed.'",
    "'For better or worse definitely meant worse.'",
    "'Thanks for donating to the ex-spouse fund.'",
    "'Bank account: stressed. Lawyer: paid.'",
  ];
  const quoteIndex = Math.min(
    funnyDivorceQuotes.length - 1,
    Math.max(0, Math.floor(quoteRoll * funnyDivorceQuotes.length))
  );
  const randomQuote = funnyDivorceQuotes[quoteIndex];

  log.info(
    `Divorced ${spouse.name}, settlement: $${settlementObligation} ` +
    `(${(settlementRatio * 100).toFixed(1)}% of $${netWorth.toLocaleString()} net worth), ` +
    `immediate payment: $${Math.round(immediatePaymentApplied)}, debt: $${Math.round(divorceDebtCreated)}`
  );

  let message = `DIVORCE FINALIZED!\n\n${randomQuote}\n\n`;

  if (lawyerResult && lawyerResult.success) {
    message += `Your lawyer successfully reduced the settlement.\n`;
    message += `Original settlement: $${baseSettlement.toLocaleString()}\n`;
    message += `Reduced settlement: $${settlementObligation.toLocaleString()} (${safeNumber(lawyerResult.reductionPercent).toFixed(1)}% reduction)\n\n`;
  } else if (lawyerResult && !lawyerResult.success) {
    message += `Your lawyer failed to reduce the settlement.\n`;
    message += `Settlement: $${settlementObligation.toLocaleString()}\n\n`;
  } else {
    message += `Net worth settlement: $${settlementObligation.toLocaleString()} (${(settlementRatio * 100).toFixed(1)}% of your ${formatMoney(netWorth)} net worth)\n\n`;
  }

  message += `Base lawyer fees: $${lawyerFees.toLocaleString()}\n`;
  if (lawyerCost > 0) {
    message += `Lawyer cost: $${lawyerCost.toLocaleString()}\n`;
  }
  if (forcedStockLiquidationPaid > 0) {
    message += `Forced stock liquidation: $${Math.round(forcedStockLiquidationPaid).toLocaleString()}\n`;
  }
  if (forcedPropertyLiquidationPaid > 0) {
    message += `Forced property liquidation: $${Math.round(forcedPropertyLiquidationPaid).toLocaleString()}\n`;
  }
  if (divorceDebtCreated > 0) {
    message += `Settlement debt created: $${Math.round(divorceDebtCreated).toLocaleString()} (auto-paid weekly)\n`;
  }
  message += `Total obligation: $${totalObligation.toLocaleString()}\n`;
  message += `Immediate payment: $${Math.round(immediatePaymentApplied).toLocaleString()}`;

  return {
    success: true,
    message,
    settlement: totalObligation,
    lawyerResult,
  };
};
/**
 * Cancel engagement.
 *
 * Wired into the Family screen's partner card (`components/FamilyTab.tsx`,
 * "Call off the engagement", behind a destructive confirm) on 2026-08-16. For
 * most of its life it had NO caller in `components/` or `app/` — the engagement
 * screens offered only propose / plan / execute, so an engaged player's only
 * exit was "Break up", which ends the relationship outright. This is the softer
 * one it was designed for: the ring comes off, the partner stays.
 */
export const cancelEngagement = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  deps: { updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && r.engagementWeek);
  if (!partner) {
    return { success: false, message: 'Engagement not found.' };
  }

  deps.updateStats(setGameState, { happiness: -15 });

  // Revert to regular partner
  setGameState(prev => ({
    ...prev,
    relationships: (prev.relationships || []).map(r =>
      r.id === partnerId
        ? {
            ...r,
            engagementWeek: undefined,
            engagementRing: undefined,
            weddingPlanned: undefined,
            relationshipScore: clampRelationshipScore(r.relationshipScore - 20),
          }
        : r
    ),
  }));

  log.info(`Engagement cancelled with ${partner.name}`);
  return { success: true, message: `Engagement with ${partner.name} has been called off.` };
};

/**
 * Check if it's the anniversary week (imperative helper).
 *
 * NOTE: the LIVE anniversary grant now runs in the weekly tick via
 * `contexts/game/actions/weekly/applyAnniversaries.ts` — that is the single
 * runtime code path, and it fires for every married player regardless of which
 * screen is open. This function is retained only for its existing unit/stress
 * tests (anniversaryIdempotence, marriageFlow.stress) which pin its signature and
 * per-year idempotence; it is no longer wired into any component.
 */
export const checkAnniversary = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  deps: { updateStats: typeof updateStats }
): { isAnniversary: boolean; yearsMarried?: number } => {
  const spouse = gameState.relationships?.find(r => r.type === 'spouse');
  if (!spouse || !spouse.anniversaryWeek) {
    return { isAnniversary: false };
  }

  // Use absolute timeline (weeksLived) to avoid 1..4 week wrap bugs.
  const absoluteWeek = gameState.weeksLived || 0;
  let marriageWeek = spouse.marriageWeek ?? spouse.anniversaryWeek;
  if (typeof marriageWeek !== 'number' || !isFinite(marriageWeek)) {
    return { isAnniversary: false };
  }
  // P0-12: legacy saves stored marriageWeek as the cyclic 1-4 value. We can't
  // reconstruct the original absolute week reliably, so skip the anniversary
  // check for those saves — better than firing a wrong-week anniversary every
  // week or so once `weeksMarried % WEEKS_PER_YEAR === 0` accidentally hits.
  if (marriageWeek <= 4 && absoluteWeek > 4) {
    return { isAnniversary: false };
  }

  const weeksMarried = Math.max(0, absoluteWeek - marriageWeek);
  const yearsMarried = Math.floor(weeksMarried / WEEKS_PER_YEAR);

  // Anniversary is every WEEKS_PER_YEAR weeks
  if (weeksMarried > 0 && weeksMarried % WEEKS_PER_YEAR === 0) {
    // Idempotent per year: the live caller re-checks whenever Contacts opens or
    // weeksLived changes, so a matching anniversary week could be evaluated more
    // than once. If this exact anniversary was already celebrated, don't
    // re-grant happiness, re-log the milestone, or re-post to Pulse.
    const alreadyCelebrated = (gameState.lifeMilestones || []).some(
      (m) =>
        m.type === 'anniversary' &&
        m.partnerId === spouse.id &&
        (m.details as { yearsMarried?: number } | undefined)?.yearsMarried === yearsMarried,
    );
    if (alreadyCelebrated) {
      return { isAnniversary: false };
    }

    deps.updateStats(setGameState, { happiness: 10 + yearsMarried });

    setGameState(prev => ({
      ...prev,
      // R2-B: cap to 200 milestones.
      lifeMilestones: [
        ...(prev.lifeMilestones || []),
        {
          id: `anniversary_${prev.weeksLived || 0}_${spouse.id}`,
          type: 'anniversary' as const,
          week: prev.weeksLived || 0,
          year: prev.date.year,
          partnerId: spouse.id,
          details: { yearsMarried },
        },
      ].slice(-200),
    }));

    // Auto-post the anniversary to the player's Pulse feed (fire-and-forget).
    autoPostMilestone(setGameState, gameState, {
      kind: 'anniversary',
      partnerName: spouse.name,
      yearsMarried,
    });

    return { isAnniversary: true, yearsMarried };
  }

  return { isAnniversary: false };
};


