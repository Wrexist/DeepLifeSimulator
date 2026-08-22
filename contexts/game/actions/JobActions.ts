/**
 * Job & Career Actions
 */
import React from 'react';
import { wantedArrestBonus, hiringPenalty, criminalXpForNextLevel, CRIMINAL_XP_PER_ILLEGAL_JOB } from '@/lib/crime/criminalRecord';
import { GameState, CrimeSkillId, PromotionDetails } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';
import { commitDeterministicRolls, getDeterministicRoll } from '@/lib/randomness/deterministicRng';
import { applyKarmaChange, KARMA_ACTIONS, INITIAL_KARMA } from '@/lib/karma/karmaSystem';
import { rejectIfBlocked } from './_guards';
import { getPromotionEligibility } from '@/lib/careers/promotionGating';
import { paidWeeklySalaryForLevel } from '@/lib/careers/weeklySalary';
import {
  raisePremiumPct,
  isRaisePremiumMaxed,
  nextRaisePremium,
  RAISE_MIN_PERFORMANCE,
} from '@/lib/careers/raisePremium';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { getTransportTier, getDeliveryTerms } from '@/lib/vehicles/scooterRental';
import { jobOfferMultiplier, highestGpa } from '@/lib/education/gpa';
import { politicalPromotionBlocker } from '@/lib/careers/political';
/**
 * Re-exported so existing importers of `RAISE_MIN_PERFORMANCE` keep working.
 * The constant itself now lives in `lib/careers/raisePremium` — `lib/mail`
 * needs it too, and `lib/` must not import upward from `contexts/`.
 */
export { RAISE_MIN_PERFORMANCE };

/** Street-job requirement ids that any transport tier can satisfy. */
const TRANSPORT_REQUIREMENT_ITEMS = new Set(['bike']);

/**
 * The street jobs the transport system actually governs.
 *
 * The transport rules used to key on the REQUIREMENT id `bike` alone, but three
 * jobs list that requirement — `delivery`, `food_delivery`, and the illegal
 * `smuggling`. So owning a car both bypassed smuggling's requirement (it is
 * meant to gate on actually having a bike) and multiplied its $1,000 base pay by
 * the car tier's 1.8x, on an untaxed payout, three times a week. Scoping to the
 * delivery gigs is strictly narrowing: a player who owns the bike ITEM still
 * qualifies for smuggling exactly as before the rental wave.
 * 2026-07-28 audit econ-2.
 */
const TRANSPORT_GOVERNED_JOB_IDS = new Set(['delivery', 'food_delivery']);

/**
 * Global weekly cap across ALL street jobs (anti-farm).
 *
 * Exported so the Work screen can show the count and lock the cards at the
 * limit instead of letting the player tap into a rejection — the cap was
 * enforced only here, so it was invisible until it fired. 2026-07-28 audit UX-4.
 */
export const MAX_TOTAL_STREET_JOBS_PER_WEEK = 8;

/**
 * Energy a street job costs THIS player — the transport tier's figure for a
 * delivery gig, the job's flat cost otherwise.
 *
 * Exported so the Work screen charges, gates and LABELS from one number.
 * `getDeliveryTerms().energyCost` previously had no consumer at all: the tier
 * gradient was advertised on the Transport card and never charged, which also
 * made the scooter tier strictly dominated (lower pay, no energy saving).
 * 2026-07-28 audit econ-3.
 */
export function getStreetJobEnergyCost(
  gameState: GameState,
  job: { id?: string; energyCost: number; requirements?: string[] },
): number {
  const terms = getTransportTermsForJob(gameState, job, 0);
  return terms ? terms.energyCost : job.energyCost;
}

/** Transport terms for a job, or null when transport does not govern it. */
function getTransportTermsForJob(
  gameState: GameState,
  job: { id?: string; requirements?: string[] },
  basePay: number,
): ReturnType<typeof getDeliveryTerms> {
  if (!job.id || !TRANSPORT_GOVERNED_JOB_IDS.has(job.id)) return null;
  if (!job.requirements?.some(r => TRANSPORT_REQUIREMENT_ITEMS.has(r))) return null;
  return getDeliveryTerms(gameState, basePay);
}

const log = logger.scope('JobActions');

/**
 * Crime talent-tree payoffs (R3-C2), from `TALENT_TREES[*].description`:
 * "Each unlocked talent adds +5% success rate and +10% payment".
 */
const TALENT_SUCCESS_BONUS_PCT = 5;
const TALENT_PAY_BONUS_PCT = 0.10;
/** A fully-invested tree pays 1.5x, not unbounded. */
const TALENT_PAY_MULTIPLIER_MAX = 1.5;

/**
 * C5: criminal + crime-skill XP for a completed street job, computed as a PURE delta so it
 * can be folded into doStreetJob's atomic `setGameState` updater. These used to be separate
 * post-updater `gainCriminalXp`/`gainCrimeSkillXp` setState calls, so a same-batch double-tap
 * (whose money/energy job no-ops at the P1-1 energy guard) still double-granted XP. Mirrors
 * the leveling math in those hooks (level up at level*100 XP).
 */
function applyStreetJobXp(
  prev: GameState,
  job: { illegal?: boolean; skill?: CrimeSkillId | null },
  success: boolean
): Partial<Pick<GameState, 'criminalXp' | 'criminalLevel' | 'crimeSkills'>> {
  const out: Partial<Pick<GameState, 'criminalXp' | 'criminalLevel' | 'crimeSkills'>> = {};
  if (job.illegal) {
    // Shared with the UI (lib/crime/criminalRecord) so the progress meter on the
    // Street Jobs tab cannot drift from the curve that actually levels you up.
    const newXp = (prev.criminalXp || 0) + CRIMINAL_XP_PER_ILLEGAL_JOB;
    const nextLevelXp = criminalXpForNextLevel(prev.criminalLevel);
    if (newXp >= nextLevelXp) {
      out.criminalXp = newXp - nextLevelXp;
      out.criminalLevel = (prev.criminalLevel || 1) + 1;
    } else {
      out.criminalXp = newXp;
    }
  }
  const skillId = job.skill;
  if (skillId && prev.crimeSkills?.[skillId]) {
    const skill = prev.crimeSkills[skillId];
    const newXp = skill.xp + (success ? 15 : 5);
    const nextLevelXp = skill.level * 100;
    out.crimeSkills = {
      ...prev.crimeSkills,
      [skillId]:
        newXp >= nextLevelXp
          ? { ...skill, xp: newXp - nextLevelXp, level: skill.level + 1 }
          : { ...skill, xp: newXp },
    };
  }
  return out;
}

export const performStreetJob = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  jobId: string,
  // C5: street-job XP is now applied atomically inside the updater (applyStreetJobXp); this
  // dependency bag is retained for call-site compatibility but is no longer read here.
  _deps: {
    updateMoney: typeof updateMoney;
    updateStats: typeof updateStats;
    gainCriminalXp: (amount: number) => void;
    gainCrimeSkillXp: (skillId: CrimeSkillId, amount: number) => void;
  }
) => {
  // P1-3: dead players can't work street jobs.
  const blocked = rejectIfBlocked(gameState);
  if (blocked) return blocked;

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
  const totalStreetJobsThisWeek = Object.values(weeklyJobs).reduce((sum: number, count) => sum + (typeof count === 'number' ? count : 0), 0);
  if (totalStreetJobsThisWeek >= MAX_TOTAL_STREET_JOBS_PER_WEEK) {
    return {
      success: false,
      message: `You've already done ${MAX_TOTAL_STREET_JOBS_PER_WEEK} street jobs this week. Rest up and try again next week.`
    };
  }

  // Transport-aware: a delivery run on a car costs less energy than on foot.
  // The same helper backs the Work screen's gate and label, so the button, the
  // message and the charge can never disagree (econ-3).
  const energyCost = getStreetJobEnergyCost(gameState, job);
  if (gameState.stats.energy < energyCost) {
    return {
      success: false,
      message: `This job needs ${energyCost} energy — you have ${gameState.stats.energy}. Rest up or eat something first.`,
    };
  }

  // Check prerequisites - items
  if (job.requirements) {
    const items = gameState.items || [];
    // TRANSPORT: the delivery gig lists `bike` because that used to be the only
    // way to move. Any transport tier satisfies it now — a rented scooter is a
    // valid (if slower and lower-paid) way to run deliveries, which is the
    // whole point of the rental being reachable on a $200 starting wallet.
    const transportTier = getTransportTier(gameState);
    // Scoped to the delivery gigs — see TRANSPORT_GOVERNED_JOB_IDS. Without the
    // job-id check this also unlocked the illegal `smuggling` job (which lists
    // `bike` as a requirement) off a $5 scooter rental.
    const transportGovernsThisJob = !!job.id && TRANSPORT_GOVERNED_JOB_IDS.has(job.id);
    const satisfiedByTransport = (req: string) =>
      transportGovernsThisJob && TRANSPORT_REQUIREMENT_ITEMS.has(req) && transportTier !== 'none';
    const missingItems = job.requirements.filter(
      req => !satisfiedByTransport(req) && !items.find(item => item.id === req)?.owned
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
  const skillBonus = job.skill ? (gameState.crimeSkills?.[job.skill]?.level || 0) * 5 : 0;

  /**
   * R3-C2: the 15 crime talent-tree nodes finally do something.
   *
   * `unlockCrimeSkillUpgrade` charges `pointsCost * 100` dollars AND a
   * permanently-limited skill point (`availablePoints = skillLevel - 1`, max 8
   * across 5 nodes), then appends the node id to `crimeSkills[skill].upgrades`.
   * Every read of that array in shipping code was display or point-budget:
   * `SkillTalentTree`'s `spentPoints` and `isNodeUnlocked`, and the Work tab's
   * counter. The job math used `level` alone, so a player could spend money and
   * an unrecoverable point on a node promising "+50% stealth success rate" and
   * receive nothing.
   *
   * The per-node `effect` strings ("+10%" … "+50%") are DISPLAY text and
   * disagree with the tree's own rule — `TALENT_TREES[*].description` says
   * "Each unlocked talent adds +5% success rate and +10% payment". The rule is
   * what is implemented here: parsing the display strings would be fragile and
   * would also stack to +150% on a single tree.
   */
  const unlockedTalents = job.skill
    ? (gameState.crimeSkills?.[job.skill]?.upgrades || []).length
    : 0;
  const talentSuccessBonus = unlockedTalents * TALENT_SUCCESS_BONUS_PCT;
  let karmaBonus = 0;
  if (gameState.karma) {
    const { getKarmaModifiers } = require('@/lib/karma/karmaSystem');
    const modifiers = getKarmaModifiers(gameState.karma);
    karmaBonus = Math.round(modifiers.crimeSuccessBonus * 100);
  }
  const successChance = Math.min(95, baseSuccess + skillBonus + talentSuccessBonus + karmaBonus);
  const attemptNumber = timesDoneThisWeek + 1;
  const rngCommitKeys: string[] = [];
  // RANDOMNESS FIX: Pity system for street jobs - guaranteed success after 5 failures
  // Track consecutive failures per job (persists across weeks, resets on success)
  // PRIORITY 2 FIX: Use constant from randomnessConstants
  const { PITY_THRESHOLD_STREET_JOB } = require('@/lib/randomness/randomnessConstants');
  const pityThreshold = PITY_THRESHOLD_STREET_JOB; // Guaranteed success after 5 failures
  // P1-10 note: the failure count is read from the outer (snapshot) state and
  // can be momentarily stale during rapid same-batch taps — but the failure
  // counter itself is incremented inside `setGameState(prev => …)` below, so
  // the persisted state remains correct. A same-batch double-tap can miss
  // pity by one attempt, which is acceptable.
  const failureCount = gameState.streetJobFailureCount?.[jobId] || 0;
  const guaranteedSuccess = failureCount >= pityThreshold;
  const successRollKey = `street_job_success:${gameState.weeksLived || 0}:${jobId}:attempt:${attemptNumber}`;
  const successRoll = guaranteedSuccess ? null : getDeterministicRoll(gameState, successRollKey);
  if (!guaranteedSuccess) {
    rngCommitKeys.push(successRollKey);
  }
  const success = guaranteedSuccess ? true : ((successRoll || 0) * 100 < successChance);

  // Celebratory feedback for crime-skill / criminal level-ups, which were
  // previously silent. Computed from the snapshot, mirroring applyStreetJobXp's
  // leveling math (+15 XP on success / +5 on fail for the skill; +10 criminal XP
  // per illegal job; level up at level*100). Best-effort UI text only.
  let levelUpText = '';
  if (job.skill && gameState.crimeSkills[job.skill]) {
    const sk = gameState.crimeSkills[job.skill];
    if (sk.xp + (success ? 15 : 5) >= sk.level * 100) {
      const label = job.skill.charAt(0).toUpperCase() + job.skill.slice(1);
      levelUpText += ` ${label} lv.${sk.level + 1}.`;
    }
  }
  if (job.illegal && (gameState.criminalXp || 0) + 10 >= (gameState.criminalLevel || 1) * 100) {
    levelUpText += ` Criminal lv.${(gameState.criminalLevel || 1) + 1}.`;
  }

  // Calculate money - store original money BEFORE any changes
  const moneyBeforeJob = gameState.stats.money;
  const basePay = job.basePayment;
  const levelBonus = (gameState.criminalLevel - 1) * 0.1;

  // STABILITY FIX: modest income boost for unemployed players so street jobs
  // remain viable as primary income (prevents a poverty trap). BALANCE: trimmed
  // from 1.5× to 1.25× so that grinding street jobs while jobless is no longer
  // strictly better than holding a career — the scaled-down career penalties
  // (applyCareerSalaryAndPenalty) close the rest of the gap.
  const hasCareerJob = !!gameState.currentJob && gameState.currentJob.length > 0;
  const unemployedBonus = hasCareerJob ? 1.0 : 1.25;

  // Transport multiplier: a rented scooter pays 0.7x, your own bike 1x, a moped
  // 1.35x, a car 1.8x. That gradient is the progression — the rental unlocks
  // the work, and every upgrade you buy out of it pays you more for the
  // same run.
  const transportTerms = getTransportTermsForJob(gameState, job, basePay);
  const effectiveBasePay = transportTerms ? transportTerms.payment : basePay;

  // R3-C2: +10% payment per unlocked talent, the other half of the tree's
  // documented rule. Bounded so a fully-invested tree pays 1.5x, not unbounded.
  const talentPayMultiplier = Math.min(
    TALENT_PAY_MULTIPLIER_MAX,
    1 + unlockedTalents * TALENT_PAY_BONUS_PCT,
  );
  const moneyGained = success
    ? Math.round(effectiveBasePay * (1 + levelBonus) * unemployedBonus * talentPayMultiplier)
    : 0;

  // Risk calculation — wanted level increases arrest chance
  const wantedLevel = gameState.wantedLevel || 0;
  const baseCaughtChance = job.illegal ? (100 - successChance) / 2 : 0;
  // Shared with the UI (lib/crime/criminalRecord) so the Street Jobs screen can
  // state this number instead of the player inferring it from arrest streaks.
  const wantedBonus = wantedArrestBonus(wantedLevel, !!job.illegal);
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
      // P1-1: re-check energy against fresh `prev` — the outer guard reads a stale
      // render snapshot, so without this a same-batch double-tap runs two jobs on one
      // job's worth of energy. A 2nd same-batch tap now no-ops here.
      // Recomputed from `prev`: the transport tier is part of state, so the
      // re-check and the deduction below must read the same snapshot.
      const freshEnergyCost = getStreetJobEnergyCost(prev, job);
      if (prev.stats.energy < freshEnergyCost) return prev;
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
        ...applyStreetJobXp(prev, job, success),
        // ADDS to any sentence already standing rather than replacing it.
        //
        // This was `Math.min(52, job.jailWeeks || 1)` — an assignment. Every
        // other writer accumulates (the weekly tick adds
        // `darkWebTick.jailWeeksAdded` on top of the decayed base), so a bare
        // `=` here meant getting caught could SHORTEN a sentence. It happens not
        // to be reachable today only because `app/(tabs)/work.tsx` swaps the
        // whole Work tab for `JailScreen` while `jailWeeks > 0` — an invariant
        // enforced in a UI file, three modules away, by coincidence. The next
        // surface that can hand out a sentence without also hiding Work turns
        // "get arrested" into a jailbreak.
        jailWeeks: Math.min(52, (prev.jailWeeks || 0) + (job.jailWeeks || 1)),
        wantedLevel: prev.wantedLevel + (job.wantedIncrease || 1),
        streetJobFailureCount: newFailureCount,
        streetJobsCompleted: prev.streetJobsCompleted || 0, // Don't count caught jobs as completed
        rngCommitLog: nextRngCommitLog,
        stats: {
          ...prev.stats,
          money: finalMoney, // Use calculated value from snapshot
          energy: Math.max(0, prev.stats.energy - freshEnergyCost),
          happiness: Math.max(0, Math.min(100, prev.stats.happiness + happinessPenalty)),
          health: Math.max(0, Math.min(100, prev.stats.health + healthPenalty)),
        },
      };
    });

    // Set caught message with penalty info
    // States the RULE rather than a figure.
    //
    // It used to quote `moneyLost`, computed from the render-time snapshot,
    // while the deduction used `freshMoneyLost` recomputed from `prev` inside
    // the updater. That recompute is correct — it is what stops a same-batch
    // double-tap charging twice — but it left the message as a second, divergent
    // source of truth, so the toast could name an amount never actually taken.
    // (And the updater's energy re-check can reject the whole action, in which
    // case the old message announced a confiscation that never happened at all.)
    //
    // Threading the real number back out is not possible here: `setGameState`'s
    // updater runs during the next render, not at the call, so anything it
    // assigns is still unset when this line executes. So say the thing that is
    // true under every ordering. Same lesson as the Legacy Pass claim toast
    // (lessons.md, 2026-06-24) — report what happened, not what you predicted.
    const penaltyText = ` (${happinessPenalty} happiness, ${healthPenalty} health)`;
    if (moneyBeforeJob > 0) {
      message = `Caught. Jailed ${job.jailWeeks} weeks, 10% of your cash seized.${penaltyText}`;
    } else {
      message = `Caught. Jailed ${job.jailWeeks} weeks.${penaltyText}`;
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
      // P1-1: re-check energy against fresh `prev` — the outer guard reads a stale
      // render snapshot, so without this a same-batch double-tap runs two jobs on one
      // job's worth of energy. The cap re-checks below only catch it once the cap is hit.
      // Recomputed from `prev`: the transport tier is part of state, so the
      // re-check and the deduction below must read the same snapshot.
      const freshEnergyCost = getStreetJobEnergyCost(prev, job);
      if (prev.stats.energy < freshEnergyCost) return prev;
      // ANTI-EXPLOIT: Re-check the per-job and global weekly caps INSIDE the
      // prev callback so two rapid same-batch street-job clicks don't both
      // pass the outer cap gate above and bypass the cap.
      const prevWeeklyJobs = prev.weeklyStreetJobs || {};
      const prevCountForJob = prevWeeklyJobs[jobId] || 0;
      if (prevCountForJob >= maxPerWeek) return prev;
      const prevTotal = Object.values(prevWeeklyJobs).reduce(
        (sum: number, count) => sum + (typeof count === 'number' ? count : 0),
        0,
      );
      if (prevTotal >= MAX_TOTAL_STREET_JOBS_PER_WEEK) return prev;

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
        ...applyStreetJobXp(prev, job, success),
        streetJobs: updatedStreetJobs,
        weeklyStreetJobs: {
          ...currentWeeklyJobs,
          [jobId]: currentCount + 1,
        },
        streetJobFailureCount: newFailureCount,
        streetJobsCompleted: (prev.streetJobsCompleted || 0) + (success ? 1 : 0),
        // Mirror successful crimes into the lifetime statistics ticker —
        // achievementsData and the Statistics screen both read
        // gs.lifetimeStatistics.totalCrimesCommitted, but no callsite
        // ever ran trackCrime() to actually increment it.
        lifetimeStatistics: prev.lifetimeStatistics && success
          ? {
              ...prev.lifetimeStatistics,
              totalCrimesCommitted: (prev.lifetimeStatistics.totalCrimesCommitted ?? 0) + 1,
            }
          : prev.lifetimeStatistics,
        rngCommitLog: nextRngCommitLog,
        karma: updatedKarma,
        wantedLevel: updatedWantedLevel,
        stats: {
          ...prev.stats,
          money: newMoney,
          energy: Math.max(0, prev.stats.energy - freshEnergyCost),
          happiness: Math.max(0, Math.min(100, prev.stats.happiness + happinessPenalty)),
          health: Math.max(0, Math.min(100, prev.stats.health + healthPenalty)),
        },
      };
    });
  }

  const events: string[] = [];

  // C5: criminal/crime-skill XP is granted atomically inside the updater branches above
  // (applyStreetJobXp), so a same-batch double-tap whose job no-ops at the energy guard no
  // longer double-grants XP via separate post-updater setState calls.

  // Set message if not already set (i.e., if not caught)
  //
  // Kept SHORT on purpose. This is the single most-fired toast in the game (a
  // street job is three taps a week, every week) and it used to read
  // "Crime failed. Wanted level increased. 🔓 Stealth skill is now level 2!
  // This work took a toll on your wellbeing (-7 happiness, -3 health)" — a
  // paragraph, of which a two-line toast showed the first half. The stat cost
  // is the part a player actually re-reads, so it survives as a compact
  // "-7 happiness, -3 health" and the sentence around it does not.
  if (!caught) {
    const costs: string[] = [];
    if (happinessPenalty) costs.push(`${happinessPenalty} happiness`);
    if (healthPenalty) costs.push(`${healthPenalty} health`);
    const penaltyText = costs.length > 0 ? ` (${costs.join(', ')})` : '';

    if (success) {
      const rankUpText = rankIncreased ? ` Rank ${job.rank + 1}.` : '';
      message = job.illegal
        ? `Crime paid off: +$${moneyGained}.${rankUpText}${levelUpText}${penaltyText}`
        : `Earned $${moneyGained}.${rankUpText}${levelUpText}${penaltyText}`;
    } else {
      message = job.illegal
        ? `Crime failed. Wanted level up.${levelUpText}${penaltyText}`
        : `No luck this time.${levelUpText}${penaltyText}`;
    }

    // Handle combined cases (only if not caught)
    if (moneyLost > 0 && moneyGained > 0) {
      message = `Earned $${moneyGained}, robbed of $${moneyLost}.${penaltyText}`;
    } else if (moneyLost > 0) {
      message = `Robbed of $${moneyLost}.${penaltyText}`;
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
  // P1-3: dead players can't apply for jobs.
  const blocked = rejectIfBlocked(gameState);
  if (blocked) return blocked;

  // Retirement is a one-way latch — a retired life draws a fixed pension and
  // cannot re-enter the career workforce (anti-farm: no un-retire via a new job).
  if (gameState.isRetired) {
    return { success: false, message: "You've retired — enjoy your pension. There's no going back to work." };
  }

  const career = (gameState.careers || []).find(c => c.id === careerId);
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
  const pendingApplication = (gameState.careers || []).some(c => c.applied && !c.accepted);
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
  // Same shared helper. This one is the least guessable of the record's
  // effects — it makes LEGITIMATE career applications fail more often, with the
  // cause sitting in a street-crime stat on a different screen.
  const criminalPenalty = hiringPenalty(criminalLevel, wantedLevel);

  // Base acceptance chance (50% for first attempt, increases with attempts)
  const baseAcceptanceChance = 50;
  // ANTI-EXPLOIT: the pity guarantee must NOT erase the criminal-background
  // penalty. Previously `guaranteedAcceptance` forced 100% regardless of
  // criminalLevel/wantedLevel, so a maxed-wanted player was auto-hired on the
  // 5th attempt. When there's a criminal penalty, the pity branch still helps
  // (caps the attempt at the best available chance) but employers can still
  // reject — it's a roll capped at `100 - criminalPenalty`, never a guarantee.
  const cleanGuarantee = guaranteedAcceptance && criminalPenalty <= 0;
  // Life Skills: Networking (+5% job application success). Additive percentage
  // points, folded in before the Math.min(90, …) ceiling so it stays bounded.
  const networkingBonus = getLifeSkillModifiers(gameState).jobApplicationBonus;
  /**
   * R3-P7: GPA finally counts toward getting hired.
   *
   * `jobOfferMultiplier` returns 0.85x-1.30x and documents itself as the
   * "hiring boost (better grades -> higher chance to land first job)". Its only
   * non-test caller was `EducationApp`, which renders "Hiring boost x1.30 on job
   * offers" on the hero card — while this roll, the one that decides, had no GPA
   * term at all and no file under `lib/careers/**` even mentioned `gpa`. So exam
   * grinding (energy, study actions, exam-failure risk) was advertised on the
   * Education screen as worth up to +30% and delivered 0%. GPA did still work
   * for scholarships, so this was specifically the hiring half.
   *
   * Applied to the BASE chance rather than the final total, so it scales the
   * part grades plausibly influence and leaves the criminal penalty and the
   * networking bonus intact. Still inside the existing 10-90 clamp, so a 4.0
   * cannot buy a guarantee and a poor GPA cannot lock the player out.
   */
  /**
   * R3-M9: the economy's `jobAvailability` finally reaches hiring.
   *
   * `economyEvents.modifiers.jobAvailability` (0.7 on a crash, 1.3 in a boom)
   * was rendered in the weekly event modal as "Jobs: -20%" and read by nothing.
   * A player told during a crash that jobs were scarce faced exactly the same
   * acceptance odds as in a boom.
   */
  const jobAvailability = Number(gameState.economy?.economyEvents?.modifiers?.jobAvailability);
  const safeJobAvailability =
    Number.isFinite(jobAvailability) && jobAvailability > 0 ? jobAvailability : 1;

  const gpaMultiplier = jobOfferMultiplier(highestGpa(gameState.educations || []));
  const safeGpaMultiplier = Number.isFinite(gpaMultiplier) && gpaMultiplier > 0 ? gpaMultiplier : 1;
  const gpaAdjustedBase = baseAcceptanceChance * safeGpaMultiplier * safeJobAvailability;
  const acceptanceChance = cleanGuarantee
    ? 100
    : guaranteedAcceptance
      ? Math.min(90, Math.max(10, 100 - criminalPenalty + networkingBonus))
      : Math.min(90, Math.max(10, gpaAdjustedBase + (applicationAttempts - 1) * 8 - criminalPenalty + networkingBonus));
  const applicationRollKey = `job_application:${gameState.weeksLived || 0}:${careerId}:attempt:${applicationAttempts}`;
  const applicationRoll = cleanGuarantee ? null : getDeterministicRoll(gameState, applicationRollKey);
  const rngCommitKeys: string[] = cleanGuarantee ? [] : [applicationRollKey];
  const accepted = cleanGuarantee || ((applicationRoll || 0) * 100 < acceptanceChance);

  setGameState(prev => {
    // R4-K: re-check pending application + current job inside the updater so
    // a same-batch double-tap for two different careers can't both mark
    // themselves accepted and corrupt careerHistory.
    if (prev.careers.some(c => c.applied && !c.accepted)) return prev;
    if (prev.currentJob) return prev;
    const updatedCareers = prev.careers.map(c => {
      if (c.id !== careerId) return c;

      return {
        ...c,
        applied: true,
        accepted: accepted,
        applicationAttempts: applicationAttempts,
        // If not immediately accepted, start tracking weeks pending
        applicationWeeksPending: accepted ? undefined : 0,
        // Stamp the career start on immediate acceptance so the raise-cooldown
        // baseline (and the early-career progress boost) are correct from week 1.
        // It was only backfilled a week later by applyCareerProgress, so on the
        // hire week the cooldown read -Infinity and one un-cooled raise slipped in.
        startedWeeksLived: accepted ? (prev.weeksLived || 0) : c.startedWeeksLived,
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
      // Append a CareerHistoryEntry on acceptance so the Statistics
      // screen's "Career History" section actually populates. Entries
      // are kept open-ended (no endWeek) until the player quits.
      lifetimeStatistics: accepted && prev.lifetimeStatistics
        ? {
            ...prev.lifetimeStatistics,
            careerHistory: [
              ...(prev.lifetimeStatistics.careerHistory || []),
              {
                job: careerId,
                weeks: 0,
                earnings: 0,
                startWeek: prev.weeksLived || 0,
              },
            ],
          }
        : prev.lifetimeStatistics,
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
): { success: boolean; message: string; promotion?: PromotionDetails } => {
  const career = (gameState.careers || []).find(c => c.id === careerId);
  if (!career) {
    log.error(`Career not found: ${careerId}`);
    return { success: false, message: 'Career not found' };
  }

  // Gate the promotion through the shared eligibility helper — the SAME check
  // the Work-tab UI uses to show lock reasons. Layers: must be accepted, not at
  // max level, progress 100%, PERFORMANCE >= threshold (ties promotions into the
  // weekly performance/review system), and the target level's EXPERIENCE (tenure)
  // requirement met (so a player can't leap to a high-salary rung without the time).
  const eligibility = getPromotionEligibility(career, gameState.weeksLived);
  if (!eligibility.eligible) {
    return { success: false, message: eligibility.reason ?? 'You cannot be promoted right now.' };
  }

  // Promote to next level
  const newLevel = career.level + 1;
  const levelData = career.levels[newLevel];

  if (!levelData) {
    log.error(`Level data not found for level ${newLevel} in career ${careerId}`);
    return { success: false, message: 'Invalid career level' };
  }

  /**
   * PLAYER REPORT (1.4 bug-reports): the political ladder had two doors and
   * only one of them was locked.
   *
   * `getPromotionEligibility` covers acceptance, progress, performance and
   * tenure — and knows nothing about `POLITICAL_CAREER_REQUIREMENTS`. So the
   * Politics app correctly refused a 27-year-old running for Mayor ("You must
   * be at least 30 years old") while this path promoted them into the very same
   * office from the Work tab. The two screens then disagreed about the player's
   * rank, because only `runForOffice` maintains `politics.careerLevel`.
   *
   * The office requirements now apply wherever the promotion comes from.
   */
  const politicalBlocker = careerId === 'political'
    ? politicalPromotionBlocker({
        targetLevel: newLevel,
        age: gameState.date?.age ?? 0,
        reputation: gameState.stats?.reputation ?? 0,
        currentLevel: career.level,
        weeksInCurrentLevel: Math.max(
          0,
          (gameState.weeksLived ?? 0) - (career.startedWeeksLived ?? 0),
        ),
        hasEducation: (id: string) =>
          (gameState.educations || []).some((e) => e.id === id && e.completed),
      })
    : null;
  if (politicalBlocker) {
    return { success: false, message: politicalBlocker };
  }

  // R4-K-style guard: re-validate against fresh `prev` INSIDE the updater. The
  // checks above read the stale `gameState` snapshot, so two promote taps in one
  // React batch would both pass and skip a level / over-grant salary. Re-running
  // the same eligibility gate against `prev` (not the snapshot) makes the
  // promotion atomic: the second tap sees progress already reset to 0 (and the
  // performance/experience gates) and is a no-op.
  setGameState(prev => {
    const cur = prev.careers.find(c => c.id === careerId);
    if (!cur) return prev;
    if (!getPromotionEligibility(cur, prev.weeksLived).eligible) return prev;
    const promotedLevel = cur.level + 1;
    if (!cur.levels[promotedLevel]) return prev;
    // Re-run the office gate against `prev` too — the check above read the
    // stale snapshot, and age/reputation can both move between them.
    if (careerId === 'political') {
      const blocked = politicalPromotionBlocker({
        targetLevel: promotedLevel,
        age: prev.date?.age ?? 0,
        reputation: prev.stats?.reputation ?? 0,
        currentLevel: cur.level,
        weeksInCurrentLevel: Math.max(
          0,
          (prev.weeksLived ?? 0) - (cur.startedWeeksLived ?? 0),
        ),
        hasEducation: (id: string) =>
          (prev.educations || []).some((e) => e.id === id && e.completed),
      });
      if (blocked) return prev;
    }

    const updatedCareers = prev.careers.map(c => {
      if (c.id !== careerId) return c;

      return {
        ...c,
        level: promotedLevel,
        progress: 0, // Reset progress after promotion
      };
    });

    return {
      ...prev,
      careers: updatedCareers,
      // Keep the Politics app's rank in step. `politics.careerLevel` is the
      // 1-based office RANK (0 = Citizen), maintained by `runForOffice` — so
      // promoting from the Work tab used to leave it stale and the two screens
      // reported different offices for the same player.
      // Only patch an EXISTING politics slice — `PoliticsState` has required
      // fields, and fabricating a partial one here would be worse than a stale
      // rank. A player holding political office always has it.
      ...(careerId === 'political' && prev.politics
        ? {
            politics: {
              ...prev.politics,
              careerLevel: Math.max(prev.politics.careerLevel ?? 0, promotedLevel + 1),
            },
          }
        : {}),
    };
  });

  log.info(`Career promoted: ${careerId} to level ${newLevel} (${levelData.name})`);

  // Snapshot the before/after story for the celebration. This is the only
  // moment both rungs are known — `career` is the pre-promotion snapshot, so
  // once state commits the old title and salary are unrecoverable.
  const previousLevelData = career.levels[career.level];
  // Both rungs priced the way payroll prices them. This used to apply the raise
  // premium alone, so a player with a Work Pay Boost, a salary life skill or
  // DeepLife+ was celebrated with a number the paycheck then beat — and the
  // work tab, which showed the raw base, disagreed with both. One function,
  // `paidWeeklySalaryForLevel`, now answers for all of them.
  const paid = (levelIndex: number) => paidWeeklySalaryForLevel(gameState, career, levelIndex);
  const topLevel = Math.max(0, career.levels.length - 1);

  return {
    success: true,
    message: `Congratulations! You've been promoted to ${levelData.name}! Your new salary is $${paid(newLevel).toLocaleString()}/week.`,
    promotion: {
      careerId,
      fromTitle: previousLevelData?.name ?? 'Your old role',
      toTitle: levelData.name,
      fromSalary: paid(career.level),
      toSalary: paid(newLevel),
      level: newLevel,
      topLevel,
      isTopRank: newLevel >= topLevel,
    },
  };
};

// --- Ask for a raise --------------------------------------------------------
// Player-driven career verb (beyond "work"/"quit"/"promote"): negotiate a
// permanent salary premium. Gated on job performance (a live signal of how
// well-kept your stats are) + a cooldown. Real risk: a denial bruises your
// standing (happiness) and can draw a formal warning (3 = fired).
export const RAISE_COOLDOWN_WEEKS = 8;
// `RAISE_MIN_PERFORMANCE` moved to `@/lib/careers/raisePremium` (imported and
// re-exported at the top of this file) — the mail app's recruiter-leverage
// letter uses the SAME floor, and `lib/` cannot import upward from `contexts/`.

export const requestRaise = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  careerId: string
): { success: boolean; message: string; approved?: boolean } => {
  const career = (gameState.careers || []).find(c => c.id === careerId);
  if (!career || !career.accepted || gameState.currentJob !== careerId) {
    return { success: false, message: 'You must be working this job to ask for a raise.' };
  }

  const ws = gameState.weeksLived ?? 0;
  const lastRequest = career.lastRaiseWeeksLived ?? career.startedWeeksLived ?? -Infinity;
  const weeksSince = ws - lastRequest;
  if (weeksSince < RAISE_COOLDOWN_WEEKS) {
    const wait = RAISE_COOLDOWN_WEEKS - weeksSince;
    return { success: false, message: `Too soon — wait ${wait} more week${wait === 1 ? '' : 's'} before asking again.` };
  }

  if (isRaisePremiumMaxed(career.raiseMultiplier)) {
    return { success: false, message: "You're already at the top of this role's pay band." };
  }

  const performance = typeof career.performance === 'number' ? career.performance : 50;
  if (performance < RAISE_MIN_PERFORMANCE) {
    return { success: false, message: `Your performance (${performance}) is too low to justify a raise. Keep your energy, health and happiness up.` };
  }

  // Deterministic (save-reload-proof) rolls: approval + a possible warning.
  const approveKey = `raise_request:${ws}:${careerId}`;
  const warnKey = `raise_warning:${ws}:${careerId}`;
  const approveRoll = getDeterministicRoll(gameState, approveKey);
  const warnRoll = getDeterministicRoll(gameState, warnKey);
  const approveChance = Math.min(0.9, Math.max(0.1, 0.2 + (performance - 50) * 0.012));
  const approved = (approveRoll ?? 0) < approveChance;
  const drawsWarning = !approved && (warnRoll ?? 1) < 0.3;

  setGameState(prev => {
    // Atomic re-check: still employed here AND cooldown still elapsed vs prev.
    const cur = (prev.careers || []).find(c => c.id === careerId);
    if (!cur || !cur.accepted || prev.currentJob !== careerId) return prev;
    const prevWs = prev.weeksLived ?? 0;
    const prevLast = cur.lastRaiseWeeksLived ?? cur.startedWeeksLived ?? -Infinity;
    if (prevWs - prevLast < RAISE_COOLDOWN_WEEKS) return prev;
    if (isRaisePremiumMaxed(cur.raiseMultiplier)) return prev;

    const updatedCareers = (prev.careers || []).map(c => {
      if (c.id !== careerId) return c;
      if (approved) {
        return {
          ...c,
          raiseMultiplier: nextRaisePremium(c.raiseMultiplier),
          lastRaiseWeeksLived: prevWs,
        };
      }
      return {
        ...c,
        warningsReceived: drawsWarning ? (c.warningsReceived ?? 0) + 1 : (c.warningsReceived ?? 0),
        lastRaiseWeeksLived: prevWs,
      };
    });

    // Denial stings: -5 happiness (feeds back into performance next tick).
    const nextStats = approved
      ? prev.stats
      : { ...prev.stats, happiness: Math.max(0, (prev.stats.happiness ?? 0) - 5) };

    const nextRngCommitLog = commitDeterministicRolls(prev, [approveKey, warnKey], prevWs);

    return { ...prev, careers: updatedCareers, stats: nextStats, rngCommitLog: nextRngCommitLog };
  });

  if (approved) {
    const pct = raisePremiumPct(nextRaisePremium(career.raiseMultiplier));
    log.info(`Raise approved for ${careerId}: premium now +${pct}%`);
    return { success: true, approved: true, message: `Raise approved! Your salary premium is now +${pct}%.` };
  }
  log.info(`Raise denied for ${careerId}${drawsWarning ? ' (formal warning issued)' : ''}`);
  return {
    success: true,
    approved: false,
    message: drawsWarning
      ? "Denied — and your manager logged a formal warning. Watch your step."
      : 'Denied. Your manager wasn\'t convinced this time. (-5 happiness)',
  };
};


