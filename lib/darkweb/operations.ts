/**
 * Pure transformers for the dark-web slice.
 *
 * Each function takes the current DarkWebState (and any extra inputs) and
 * returns a new DarkWebState plus any required side-effect data (BTC delta,
 * stat delta). The React-aware action wrappers in CrimeActions.ts apply
 * the side effects via setGameState.
 */

import {
  DarkWebActiveJob,
  DarkWebLaunderingTx,
  DarkWebMarketListing,
  DarkWebMixerTier,
  DarkWebSkill,
  DarkWebSkillId,
  DarkWebState,
  DarkWebVendor,
} from '@/contexts/game/types';
import {
  addHeat,
  clampHeat,
  decayHeat as decayHeatPure,
} from './heat';
import {
  buildLaunderingTx,
  mixerFails,
  MIXER_TIERS,
} from './laundering';
import {
  attemptStage,
  awardSkillXp,
  DarkWebJobTemplate,
  JOB_TEMPLATES,
  startJob as buildJob,
} from './jobs';
import {
  generateListingsForVendor,
  pruneExpiredListings,
  updatePlayerReputation,
  updateVendorAfterPurchase,
  vendorScamProbability,
} from './marketplace';

const RECENT_EVENT_CAP = 20;
const JOB_HISTORY_CAP = 30;
// EXPLOIT FIX (H-4): a failed stage used to only reset progress to 0, so a job
// could be brute-forced indefinitely (energy-gated only, no cash/jail cost). Cap
// total failed attempts per job — exceed it and the job is lost ('failed'), so
// failure carries a real cost.
const MAX_STAGE_FAILS = 3;

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function findVendor(dw: DarkWebState, vendorId: string): DarkWebVendor | undefined {
  return dw.vendors.find((v) => v.id === vendorId);
}

export function findListing(dw: DarkWebState, listingId: string): DarkWebMarketListing | undefined {
  return dw.listings.find((l) => l.id === listingId);
}

export function jobTemplateById(templateId: string): DarkWebJobTemplate | undefined {
  return JOB_TEMPLATES.find((t) => t.id === templateId);
}

export function getSkill(dw: DarkWebState, id: DarkWebSkillId): DarkWebSkill {
  return dw.skills[id] ?? { level: 1, xp: 0, nextLevelXp: 100 };
}

// ---------------------------------------------------------------------------
// Heat management
// ---------------------------------------------------------------------------

export function bumpHeat(dw: DarkWebState, amount: number): DarkWebState {
  const opsec = getSkill(dw, 'opsec').level;
  return { ...dw, heat: addHeat(dw.heat, amount, opsec) };
}

export function tickHeatDecay(dw: DarkWebState, currentWeek: number): DarkWebState {
  if (currentWeek <= dw.lastHeatDecayWeek) return dw;
  const opsec = getSkill(dw, 'opsec').level;
  let h = dw.heat;
  // Freeze-proof: cap catch-up loops. If a save was migrated or the player
  // jumped many weeks via cheat/repair, iterating thousands of times can hitch
  // the JS thread on slow devices. Heat decays to ~0 in well under 50 weeks
  // regardless of opsec, so this cap is mathematically harmless.
  const weeks = Math.min(currentWeek - dw.lastHeatDecayWeek, 100);
  for (let i = 0; i < weeks; i++) {
    h = decayHeatPure(h, opsec);
    if (h <= 0) break;
  }
  return { ...dw, heat: clampHeat(h), lastHeatDecayWeek: currentWeek };
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

/**
 * Refresh the public marketplace: prune expired listings, then top up so each
 * vendor has 1–3 fresh listings posted this week.
 */
export function refreshMarketplace(
  dw: DarkWebState,
  currentWeek: number,
  rolls: (key: string) => number
): DarkWebState {
  let listings = pruneExpiredListings(dw.listings, currentWeek);
  for (const vendor of dw.vendors) {
    if (vendor.flaggedScam) continue;
    const owned = listings.filter((l) => l.vendorId === vendor.id);
    if (owned.length >= 3) continue;
    const fresh = generateListingsForVendor(vendor, currentWeek, rolls, 3 - owned.length);
    listings = [...listings, ...fresh];
  }
  return { ...dw, listings };
}

export interface PurchaseResult {
  dw: DarkWebState;
  /** BTC the player spent (always equals listing cost — paid even on scam). */
  spentBtc: number;
  outcome: 'success' | 'scam';
  /** XP awarded to which skill on success. */
  xpAwarded?: { skill: DarkWebSkillId; amount: number };
}

/**
 * Attempt to purchase a listing. Caller MUST verify player has the BTC; this
 * function doesn't read the wallet. Returns the outcome and the updated state.
 */
export function attemptPurchase(
  dw: DarkWebState,
  listingId: string,
  /** Seeded roll in [0,1) — determines scam vs success. */
  roll: number
): { ok: true; result: PurchaseResult } | { ok: false; reason: string } {
  const listing = findListing(dw, listingId);
  if (!listing) return { ok: false, reason: 'Listing not found' };
  if (dw.playerReputation < listing.minBuyerRep) {
    return { ok: false, reason: `Need buyer rep ≥ ${listing.minBuyerRep}` };
  }
  const vendor = findVendor(dw, listing.vendorId);
  if (!vendor) return { ok: false, reason: 'Vendor not found' };

  const scamProb = vendorScamProbability(vendor.reputation);
  const outcome: 'success' | 'scam' = roll < scamProb ? 'scam' : 'success';

  // Update vendor reputation and player reputation.
  const updatedVendor = updateVendorAfterPurchase(vendor, outcome);
  const newPlayerRep = updatePlayerReputation(dw.playerReputation, outcome, listing.tier);

  // Remove the consumed listing (whether or not it was a scam).
  const newListings = dw.listings.filter((l) => l.id !== listingId);
  const newVendors = dw.vendors.map((v) => (v.id === vendor.id ? updatedVendor : v));

  // Skills XP: only on success.
  let newSkills = dw.skills;
  let xpAwarded: { skill: DarkWebSkillId; amount: number } | undefined;
  if (outcome === 'success' && listing.xpReward) {
    const skillId = listing.xpReward.skill as DarkWebSkillId;
    if (skillId in dw.skills) {
      newSkills = {
        ...dw.skills,
        [skillId]: awardSkillXp(dw.skills[skillId], listing.xpReward.amount),
      };
      xpAwarded = { skill: skillId, amount: listing.xpReward.amount };
    }
  }

  // Heat: only added on successful delivery (a scam doesn't leak you).
  const heatedDw =
    outcome === 'success'
      ? bumpHeat({ ...dw, listings: newListings, vendors: newVendors, skills: newSkills, playerReputation: newPlayerRep }, listing.heatCost)
      : { ...dw, listings: newListings, vendors: newVendors, skills: newSkills, playerReputation: newPlayerRep };

  // Record event for the forum log.
  const event = {
    id: `purchase-${listing.id}`,
    week: listing.postedWeek,
    text:
      outcome === 'scam'
        ? `Scammed by ${vendor.handle} on "${listing.title}". -${listing.costBtc.toFixed(4)} BTC.`
        : `Bought "${listing.title}" from ${vendor.handle}. +${listing.costBtc.toFixed(4)} BTC out.`,
  };
  const recentEvents = [event, ...heatedDw.recentEvents].slice(0, RECENT_EVENT_CAP);

  return {
    ok: true,
    result: {
      dw: { ...heatedDw, recentEvents },
      spentBtc: listing.costBtc,
      outcome,
      xpAwarded,
    },
  };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export function listAvailableJobs(dw: DarkWebState): DarkWebJobTemplate[] {
  return JOB_TEMPLATES.filter((tpl) => {
    if (!tpl.requiresSkills) return true;
    for (const [skill, min] of Object.entries(tpl.requiresSkills)) {
      if (getSkill(dw, skill as DarkWebSkillId).level < (min ?? 0)) return false;
    }
    return true;
  });
}

export function startJob(
  dw: DarkWebState,
  templateId: string,
  currentWeek: number
): { ok: true; dw: DarkWebState; job: DarkWebActiveJob } | { ok: false; reason: string } {
  const tpl = jobTemplateById(templateId);
  if (!tpl) return { ok: false, reason: 'Unknown job template' };
  // Reject a duplicate active job for the same template. The "Start job" button
  // has no in-flight guard, so a rapid double-tap would otherwise append two
  // identical active jobs (each with a fresh random id) from one intent.
  const activeJobs = dw.activeJobs || [];
  if (activeJobs.some((j) => j.templateId === templateId)) {
    return { ok: false, reason: 'This job is already active' };
  }
  const result = buildJob(tpl, dw.skills, currentWeek);
  if (!result.ok) return { ok: false, reason: result.reason };
  return {
    ok: true,
    dw: { ...dw, activeJobs: [...activeJobs, result.job as DarkWebActiveJob] },
    job: result.job as DarkWebActiveJob,
  };
}

export interface StageOutcome {
  dw: DarkWebState;
  outcome: 'success' | 'fail' | 'completed' | 'expired';
  heatAdded: number;
  dirtyBtcEarned: number;
  /** Cumulative XP awarded across all skills, for UI. */
  xpAwarded: Partial<Record<DarkWebSkillId, number>>;
  energyCost: number;
}

/**
 * Run the current stage of a job. If the stage succeeds and there are more
 * stages, advance. If it's the last stage, mark the job completed and award
 * the BTC payout into the dirty wallet.
 */
export function attemptJobStage(
  dw: DarkWebState,
  jobId: string,
  /** Seeded roll for the stage outcome. */
  roll: number,
  currentWeek: number
): { ok: true; result: StageOutcome } | { ok: false; reason: string } {
  const idx = dw.activeJobs.findIndex((j) => j.id === jobId);
  if (idx === -1) return { ok: false, reason: 'Job not found' };
  const job = dw.activeJobs[idx];
  if (job.status !== 'in-progress') return { ok: false, reason: 'Job not active' };
  const tpl = jobTemplateById(job.templateId);
  if (!tpl) return { ok: false, reason: 'Unknown template' };
  const stage = tpl.stages[job.currentStage];
  if (!stage) return { ok: false, reason: 'No stage to run' };

  const skill = getSkill(dw, stage.skill);
  const attempt = attemptStage(stage, skill.level, roll);

  // Award stage XP regardless of outcome.
  let newSkills: Record<DarkWebSkillId, DarkWebSkill> = {
    ...dw.skills,
    [stage.skill]: awardSkillXp(skill, attempt.xpAwarded),
  };

  // Add heat.
  let updatedDw: DarkWebState = bumpHeat({ ...dw, skills: newSkills }, attempt.heatAdded);

  const xpAwarded: Partial<Record<DarkWebSkillId, number>> = { [stage.skill]: attempt.xpAwarded };
  let dirtyBtcEarned = 0;
  let outcome: StageOutcome['outcome'] = 'success';

  if (!attempt.success) {
    // Reset progress on failure. After MAX_STAGE_FAILS total failures the job is
    // lost (terminal 'failed' status) — attemptJobStage rejects non-in-progress
    // jobs, so it can no longer be retried. This makes brute-forcing cost you the
    // job instead of being free.
    const priorFails = job.completedStages.filter((c) => c.outcome === 'fail').length;
    const failedOut = priorFails + 1 >= MAX_STAGE_FAILS;
    const updatedJob: DarkWebActiveJob = {
      ...job,
      currentStage: 0,
      status: failedOut ? 'failed' : job.status,
      completedStages: [...job.completedStages, { stage: job.currentStage, week: currentWeek, outcome: 'fail' }],
    };
    updatedDw = {
      ...updatedDw,
      activeJobs: updatedDw.activeJobs.map((j) => (j.id === jobId ? updatedJob : j)),
    };
    outcome = 'fail';
  } else {
    const newCompleted = [
      ...job.completedStages,
      { stage: job.currentStage, week: currentWeek, outcome: 'success' as const },
    ];
    const isLastStage = job.currentStage + 1 >= tpl.stages.length;
    if (isLastStage) {
      // Job completed: award payout into dirty wallet + full skill XP package.
      for (const [skillId, amount] of Object.entries(tpl.xpReward)) {
        if (skillId in newSkills && amount) {
          newSkills = {
            ...newSkills,
            [skillId as DarkWebSkillId]: awardSkillXp(
              newSkills[skillId as DarkWebSkillId],
              amount
            ),
          };
          xpAwarded[skillId as DarkWebSkillId] =
            (xpAwarded[skillId as DarkWebSkillId] ?? 0) + amount;
        }
      }
      const completedJob: DarkWebActiveJob = {
        ...job,
        currentStage: job.currentStage + 1,
        completedStages: newCompleted,
        status: 'completed',
      };
      dirtyBtcEarned = tpl.payoutBtc;
      updatedDw = {
        ...updatedDw,
        skills: newSkills,
        activeJobs: updatedDw.activeJobs.filter((j) => j.id !== jobId),
        jobHistory: [completedJob, ...updatedDw.jobHistory].slice(0, JOB_HISTORY_CAP),
        dirtyBtc: safe(updatedDw.dirtyBtc) + tpl.payoutBtc,
      };
      outcome = 'completed';
    } else {
      const advancedJob: DarkWebActiveJob = {
        ...job,
        currentStage: job.currentStage + 1,
        completedStages: newCompleted,
      };
      updatedDw = {
        ...updatedDw,
        activeJobs: updatedDw.activeJobs.map((j) => (j.id === jobId ? advancedJob : j)),
      };
    }
  }

  return {
    ok: true,
    result: {
      dw: updatedDw,
      outcome,
      heatAdded: attempt.heatAdded,
      dirtyBtcEarned,
      xpAwarded,
      energyCost: stage.energyCost,
    },
  };
}

export function expireOverdueJobs(dw: DarkWebState, currentWeek: number): DarkWebState {
  const stillActive: DarkWebActiveJob[] = [];
  const newlyExpired: DarkWebActiveJob[] = [];
  for (const j of dw.activeJobs) {
    if (j.status !== 'in-progress') continue;
    if (currentWeek >= j.expiresWeek) {
      newlyExpired.push({ ...j, status: 'expired' });
    } else {
      stillActive.push(j);
    }
  }
  if (newlyExpired.length === 0) return dw;
  return {
    ...dw,
    activeJobs: stillActive,
    jobHistory: [...newlyExpired, ...dw.jobHistory].slice(0, JOB_HISTORY_CAP),
  };
}

// ---------------------------------------------------------------------------
// Laundering
// ---------------------------------------------------------------------------

export function submitToMixer(
  dw: DarkWebState,
  tier: DarkWebMixerTier,
  amountBtc: number,
  currentWeek: number,
  /** Owned restaurant + bank companies, used to shorten delay + reduce fee. */
  frontCount: number = 0
): { ok: true; dw: DarkWebState; tx: DarkWebLaunderingTx } | { ok: false; reason: string } {
  if (amountBtc <= 0) return { ok: false, reason: 'Amount must be positive' };
  if (safe(dw.dirtyBtc) < amountBtc) return { ok: false, reason: 'Not enough dirty BTC' };
  const launderingSkill = getSkill(dw, 'laundering').level;
  const tx = buildLaunderingTx(amountBtc, tier, currentWeek, launderingSkill, frontCount);
  return {
    ok: true,
    dw: {
      ...dw,
      dirtyBtc: dw.dirtyBtc - amountBtc,
      laundering: [...dw.laundering, tx],
    },
    tx,
  };
}

/**
 * Resolve any laundering transactions due this week. Each pending tx that has
 * reached its readyWeek either succeeds (cleanBtc += netAmount) or fails
 * (funds lost). Returns the new state + a list of resolved tx records.
 */
export function settleLaunderingTransactions(
  dw: DarkWebState,
  currentWeek: number,
  rollFor: (txId: string) => number
): { dw: DarkWebState; resolved: DarkWebLaunderingTx[] } {
  const resolved: DarkWebLaunderingTx[] = [];
  const next: DarkWebLaunderingTx[] = [];
  let dirtyDelta = 0;
  let cleanDelta = 0;
  for (const tx of dw.laundering) {
    if (tx.status !== 'pending' || currentWeek < tx.readyWeek) {
      next.push(tx);
      continue;
    }
    const failed = mixerFails(tx.tier, rollFor(tx.id));
    const settled: DarkWebLaunderingTx = {
      ...tx,
      status: failed ? 'failed' : 'completed',
    };
    if (!failed) {
      cleanDelta += tx.netAmountBtc;
    }
    next.push(settled);
    resolved.push(settled);
  }
  if (resolved.length === 0) return { dw, resolved };
  // Freeze-proof: cap the laundering history. Settled txs accumulate forever
  // otherwise and bloat saves + slow renders of the wallet tab.
  const LAUNDERING_HISTORY_CAP = 100;
  const trimmedNext =
    next.length > LAUNDERING_HISTORY_CAP
      ? [
          ...next.filter((tx) => tx.status === 'pending'),
          ...next
            .filter((tx) => tx.status !== 'pending')
            .slice(-LAUNDERING_HISTORY_CAP),
        ]
      : next;
  return {
    dw: {
      ...dw,
      dirtyBtc: safe(dw.dirtyBtc) + dirtyDelta,
      cleanBtc: safe(dw.cleanBtc) + cleanDelta,
      laundering: trimmedNext,
    },
    resolved,
  };
}

// ---------------------------------------------------------------------------
// Cashing out clean BTC into the legacy `cryptos[btc].owned` wallet
// ---------------------------------------------------------------------------

/**
 * Move clean BTC from the dark-web wallet into the player's regular BTC holdings
 * tracked in `gameState.cryptos`. Returns the dw delta — caller handles the
 * crypto side.
 */
export function withdrawCleanBtc(
  dw: DarkWebState,
  amountBtc: number
): { ok: true; dw: DarkWebState; movedBtc: number } | { ok: false; reason: string } {
  if (amountBtc <= 0) return { ok: false, reason: 'Amount must be positive' };
  if (safe(dw.cleanBtc) < amountBtc) return { ok: false, reason: 'Not enough clean BTC' };
  return {
    ok: true,
    dw: { ...dw, cleanBtc: dw.cleanBtc - amountBtc },
    movedBtc: amountBtc,
  };
}

// Re-exports for action layer
export { JOB_TEMPLATES, MIXER_TIERS };
