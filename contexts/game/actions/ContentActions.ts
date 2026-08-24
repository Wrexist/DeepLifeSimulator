/**
 * ContentActions — publish videos / run streams / buy gear.
 *
 * Previously both GamingApp.tsx and GamingStreamingApp.tsx had divergent
 * inline implementations of these operations. This file makes them share the
 * pure libs in `lib/content/`.
 */

import type { Dispatch, SetStateAction } from 'react';
import { mintId } from '@/utils/uniqueId';
import { GameState, GamingStreamingState, Video, StreamHistoryItem } from '../types';
import { computeQuality, qualityMultiplier } from '@/lib/content/quality';
import { projectStreamOutcome, projectVideoOutcome } from '@/lib/content/algorithm';
import { streamEarnings, videoEarnings } from '@/lib/content/monetization';
import { creatorLevelFromExperience, creatorPerkTier } from '@/lib/content/creatorLevel';
import { rollingAverageViewers, nextHypeStreak, hypeChanceForStreak } from '@/lib/content/streamMeta';
import { logger } from '@/utils/logger';
// Every money flow in this module goes through the canonical applyMoneyDelta
// inside the same updater that grants the reward. The old `deps: { updateMoney }`
// parameter these actions carried was never read (2026-07-16 weekly audit LOW) —
// it advertised a second, non-atomic money path that does not exist here.
import { applyMoneyDelta } from './MoneyActions';

const log = logger.scope('ContentActions');
const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/**
 * ANTI-EXPLOIT: per-week caps on monetized content actions. Energy is the only
 * gate on streams/videos, but energy is cheaply refilled in-week via food, so
 * without these caps immediate stream/video earnings (paid before any passive
 * cap) are unbounded. Counters reset when `lastStreamWeek`/`lastVideoWeek` no
 * longer equals the current week.
 */
const MAX_STREAMS_PER_WEEK = 5;
const MAX_VIDEOS_PER_WEEK = 5;

/**
 * ANTI-EXPLOIT: per-component PC upgrade tier ceiling. Gear quality
 * (lib/content/quality.ts) clamps the combined score at 100 and the earnings
 * multiplier is flat above score 90 — a fully-kitted rig reaches that ceiling at
 * low single-digit tiers, so every tier beyond it costs (exponentially) more but
 * changes quality/earnings by EXACTLY 0: a pure money sink. Capping each
 * component here bounds that sink while still leaving ample headroom to reach the
 * elite tier. The cost formula doubles per tier, so the cap also stops prices
 * from escalating into the tens of millions.
 */
export const MAX_PC_TIER = 10;

type SetGS = Dispatch<SetStateAction<GameState>>;

function ensureChannel(state: GameState): GamingStreamingState {
  return (
    state.gamingStreaming ?? {
      followers: 0,
      subscribers: 0,
      totalViews: 0,
      totalEarnings: 0,
      totalDonations: 0,
      totalSubEarnings: 0,
      level: 1,
      experience: 0,
      gamesPlayed: [],
      streamHours: 0,
      averageViewers: 0,
      bestStream: null,
      currentStream: null,
      equipment: { microphone: false, webcam: false, gamingChair: false, greenScreen: false, lighting: false },
      pcComponents: { cpu: false, gpu: false, ram: false, ssd: false, motherboard: false, cooling: false, psu: false, case: false, network: false },
      pcUpgradeLevels: { cpu: 0, gpu: 0, ram: 0, ssd: 0, motherboard: 0, cooling: 0, psu: 0, case: 0, network: 0 },
      unlockedGames: [],
      ownedGames: [],
      streamHistory: [],
      videoTitleCounters: {},
      videos: [],
    }
  );
}

export interface PublishVideoResult {
  success: boolean;
  message: string;
  video?: Video;
  outcome?: { views: number; subscribersGained: number; viral: boolean };
  earnings?: number;
}

/**
 * Publish a video using the unified algorithm + monetization libs. The caller
 * picks the title/game; we compute view count, sub conversion, and earnings.
 */
export function publishVideo(
  gameState: GameState,
  setGameState: SetGS,
  args: {
    title: string;
    game?: string;
    energyCost?: number;
    rollViral?: number;
    rollOrganic?: number;
    trendBonus?: number;
  },
  currentWeek: number
): PublishVideoResult {
  const energy = safe(gameState.stats?.energy, 0);
  const cost = safe(args.energyCost, 15);
  if (energy < cost) {
    return { success: false, message: `Need ${cost} energy to record (have ${Math.round(energy)}).` };
  }

  const preChannel = ensureChannel(gameState);
  const videosThisWeek = preChannel.lastVideoWeek === currentWeek ? safe(preChannel.videosThisWeek, 0) : 0;
  if (videosThisWeek >= MAX_VIDEOS_PER_WEEK) {
    return { success: false, message: `You've published ${MAX_VIDEOS_PER_WEEK} videos this week - come back next week.` };
  }

  const channel = preChannel;
  const quality = computeQuality(channel.equipment, channel.pcUpgradeLevels);
  const outcome = projectVideoOutcome({
    quality,
    subscribers: channel.subscribers,
    rollViral: args.rollViral ?? Math.random(),
    // Live play seeds organic variance so each upload lands a different,
    // believable view count; tests pass an explicit roll for determinism.
    rollOrganic: args.rollOrganic ?? Math.random(),
    trendBonus: args.trendBonus,
  });
  const earnings = videoEarnings(outcome.views, quality);

  const video: Video = {
    id: mintId('vid'),
    title: args.title,
    game: args.game,
    views: outcome.views,
    earnings,
    quality: quality.total,
    subscribersGained: outcome.subscribersGained,
    timestamp: Date.now(),
    uploadedAt: currentWeek,
    rpm: Math.round(qualityMultiplier(quality) * 100) / 100,
  };

  // Atomic: re-check the weekly cap + energy against fresh state, fold the
  // earnings credit into the same updater, and increment the weekly counter.
  setGameState((prev) => {
    const ch = ensureChannel(prev);
    const count = ch.lastVideoWeek === currentWeek ? safe(ch.videosThisWeek, 0) : 0;
    if (count >= MAX_VIDEOS_PER_WEEK) return prev;
    const energyNow = safe(prev.stats?.energy, 0);
    if (energyNow < cost) return prev;
    const earn = applyMoneyDelta(prev, earnings, `Video: ${args.title}`);
    if (!earn) return prev;
    // Persist the shared creator level from accumulated XP so the "Lv N" badge
    // advances immediately on upload (the weekly tick keeps it in sync too).
    const nextExperience = ch.experience + Math.floor(outcome.views / 100);
    const nextLevel = creatorLevelFromExperience(nextExperience);
    return {
      ...prev,
      ...earn,
      stats: { ...earn.stats, energy: Math.max(0, energyNow - cost) },
      gamingStreaming: {
        ...ch,
        videos: [video, ...(ch.videos ?? [])].slice(0, 200),
        subscribers: ch.subscribers + outcome.subscribersGained,
        totalViews: ch.totalViews + outcome.views,
        totalEarnings: ch.totalEarnings + earnings,
        experience: nextExperience,
        level: nextLevel,
        perkTier: creatorPerkTier(nextLevel),
        videosThisWeek: count + 1,
        lastVideoWeek: currentWeek,
      },
    };
  });
  log.info(`Published video "${args.title}" (${outcome.views} views, $${earnings})`);
  return {
    success: true,
    message: outcome.viral
      ? `${args.title} went viral! +${outcome.views.toLocaleString()} views.`
      : `${args.title} published - ${outcome.views.toLocaleString()} views.`,
    video,
    outcome,
    earnings,
  };
}

export interface RunStreamResult {
  success: boolean;
  message: string;
  stream?: StreamHistoryItem;
  outcome?: { viewers: number; newFollowers: number; newSubs: number; donations: number; hypeTrain: boolean };
  earnings?: number;
}

/**
 * Run a stream session of a given duration in minutes. Caller has already
 * agreed to the energy cost.
 */
export function runStream(
  gameState: GameState,
  setGameState: SetGS,
  args: { game: string; duration: number; energyCost?: number; rollHype?: number; rollOrganic?: number },
  currentWeek: number
): RunStreamResult {
  const energy = safe(gameState.stats?.energy, 0);
  const cost = safe(args.energyCost, Math.max(20, Math.floor(args.duration / 3)));
  if (energy < cost) {
    return { success: false, message: `Need ${cost} energy to stream (have ${Math.round(energy)}).` };
  }

  const preChannel = ensureChannel(gameState);
  const streamsThisWeek = preChannel.lastStreamWeek === currentWeek ? safe(preChannel.streamsThisWeek, 0) : 0;
  if (streamsThisWeek >= MAX_STREAMS_PER_WEEK) {
    return { success: false, message: `You've streamed ${MAX_STREAMS_PER_WEEK} times this week - come back next week.` };
  }

  const channel = preChannel;
  const quality = computeQuality(channel.equipment, channel.pcUpgradeLevels);
  // Hype-train streak: consecutive weekly streams raise the hype chance toward a
  // bounded ceiling (≤25%, enforced in both hypeChanceForStreak and the algo).
  const streamStreak = nextHypeStreak(channel.hypeStreak, channel.lastStreamWeek, currentWeek);
  const hypeChance = hypeChanceForStreak(streamStreak);
  const outcome = projectStreamOutcome({
    quality,
    followers: channel.followers,
    duration: args.duration,
    rollHype: args.rollHype ?? Math.random(),
    rollOrganic: args.rollOrganic ?? Math.random(),
    hypeChance,
  });
  const earnings = streamEarnings(outcome.viewers, args.duration, outcome.donations, quality);

  const stream: StreamHistoryItem = {
    id: mintId('stream'),
    game: args.game,
    duration: args.duration,
    viewers: outcome.viewers,
    earnings,
    followers: outcome.newFollowers,
    subscribers: outcome.newSubs,
    chatMessages: Math.round(outcome.viewers * 2),
    donations: outcome.donations,
    timestamp: Date.now(),
    uploadedAt: currentWeek,
  };

  // Atomic: re-check the weekly cap + energy against fresh state, fold the
  // earnings credit into the same updater, and increment the weekly counter.
  setGameState((prev) => {
    const ch = ensureChannel(prev);
    const count = ch.lastStreamWeek === currentWeek ? safe(ch.streamsThisWeek, 0) : 0;
    if (count >= MAX_STREAMS_PER_WEEK) return prev;
    const energyNow = safe(prev.stats?.energy, 0);
    if (energyNow < cost) return prev;
    const earn = applyMoneyDelta(prev, earnings, `Stream: ${args.game}`);
    if (!earn) return prev;
    const nextHistory = [stream, ...ch.streamHistory].slice(0, 200);
    // averageViewers: rolling mean of the most-recent broadcasts (the dashboard
    // hero + History summary read this - it was pinned to 0 forever).
    const nextAverageViewers = rollingAverageViewers(nextHistory);
    // Persist the shared creator level from accumulated XP (badge advances now).
    const nextExperience = ch.experience + Math.floor(outcome.viewers / 50);
    const nextLevel = creatorLevelFromExperience(nextExperience);
    // Advance the hype streak for the next stream (bounded; reset after a gap).
    const nextStreak = nextHypeStreak(ch.hypeStreak, ch.lastStreamWeek, currentWeek);
    return {
      ...prev,
      ...earn,
      stats: { ...earn.stats, energy: Math.max(0, energyNow - cost) },
      gamingStreaming: {
        ...ch,
        followers: ch.followers + outcome.newFollowers,
        subscribers: ch.subscribers + outcome.newSubs,
        totalDonations: ch.totalDonations + outcome.donations,
        totalEarnings: ch.totalEarnings + earnings,
        streamHours: ch.streamHours + args.duration / 60,
        streamHistory: nextHistory,
        averageViewers: nextAverageViewers,
        experience: nextExperience,
        level: nextLevel,
        perkTier: creatorPerkTier(nextLevel),
        hypeStreak: nextStreak,
        bestStream:
          !ch.bestStream || outcome.viewers > ch.bestStream.viewers ? stream : ch.bestStream,
        streamsThisWeek: count + 1,
        lastStreamWeek: currentWeek,
      },
    };
  });
  log.info(
    `Stream complete (${args.game}): ${outcome.viewers} viewers, $${earnings}, hype=${outcome.hypeTrain}`
  );
  return {
    success: true,
    message: outcome.hypeTrain
      ? `Hype train! ${outcome.viewers} viewers, +${outcome.newSubs} subs.`
      : `Stream ended - ${outcome.viewers} viewers, $${earnings}.`,
    stream,
    outcome,
    earnings,
  };
}

// ── LIVE streaming (real-time drain loop) ────────────────────────────────────
//
// Unlike runStream (one-shot: pick duration → pay energy upfront → instant
// result), a LIVE session is an active broadcast the player starts and stops.
// While live, a UI-driven interval (NOT the weekly tick) drains stats.energy in
// real time and accrues viewers; stopping finalises the session through the SAME
// monetization path as runStream. Money stays canonical (applyMoneyDelta only);
// energy is clamped ≥ 0; the session lives in `gamingStreaming.currentStream`.

/** Energy drained per real second while live. 100 energy ≈ 62s of streaming. */
export const LIVE_ENERGY_DRAIN_PER_SEC = 1.6;
/** Minimum energy required to go live at all. */
export const LIVE_MIN_ENERGY = 8;
/** Recommended tick cadence for the UI loop (ms). */
export const LIVE_TICK_MS = 1000;

/** Type guard: is `currentStream` an in-progress live broadcast? */
export function isLiveSession(ch: GamingStreamingState | null | undefined): boolean {
  return !!ch?.currentStream?.live;
}

export interface StartLiveResult {
  success: boolean;
  message: string;
}

/**
 * Go live. Reserves one weekly stream slot up-front (a live session counts as
 * one stream, so start/stop can't farm slots), seeds a live `currentStream`, and
 * does NOT charge energy here - the drain loop does that in real time.
 */
export function startLiveStream(
  gameState: GameState,
  setGameState: SetGS,
  args: { game: string },
  currentWeek: number
): StartLiveResult {
  const channel = ensureChannel(gameState);
  if (isLiveSession(channel)) return { success: false, message: 'You are already live.' };

  const energy = safe(gameState.stats?.energy, 0);
  if (energy < LIVE_MIN_ENERGY) {
    return { success: false, message: `Need ${LIVE_MIN_ENERGY} energy to go live (have ${Math.round(energy)}).` };
  }

  const streamsThisWeek = channel.lastStreamWeek === currentWeek ? safe(channel.streamsThisWeek, 0) : 0;
  if (streamsThisWeek >= MAX_STREAMS_PER_WEEK) {
    return { success: false, message: `You've streamed ${MAX_STREAMS_PER_WEEK} times this week - come back next week.` };
  }

  setGameState((prev) => {
    const ch = ensureChannel(prev);
    if (isLiveSession(ch)) return prev;
    const count = ch.lastStreamWeek === currentWeek ? safe(ch.streamsThisWeek, 0) : 0;
    if (count >= MAX_STREAMS_PER_WEEK) return prev;
    if (safe(prev.stats?.energy, 0) < LIVE_MIN_ENERGY) return prev;
    // Advance the hype-train streak now (bounded; reset after a gap) — mirrors
    // runStream so consecutive-week live broadcasts still build the streak.
    const nextStreak = nextHypeStreak(ch.hypeStreak, ch.lastStreamWeek, currentWeek);
    const live = {
      id: mintId('live'),
      game: args.game,
      duration: 0,
      viewers: 0,
      earnings: 0,
      followers: 0,
      subscribers: 0,
      chatMessages: 0,
      donations: 0,
      live: true,
      startedAtMs: Date.now(),
      elapsedSeconds: 0,
      uploadedAt: currentWeek,
    };
    return {
      ...prev,
      gamingStreaming: {
        ...ch,
        currentStream: live,
        hypeStreak: nextStreak,
        // Reserve the weekly slot now (finalize does NOT re-increment).
        streamsThisWeek: count + 1,
        lastStreamWeek: currentWeek,
      },
    };
  });
  log.info(`Went live (${args.game}).`);
  return { success: true, message: `You're live with ${args.game}!` };
}

/**
 * Advance a live session by `deltaSeconds`: drain energy (clamped ≥ 0), accrue
 * elapsed time, and tick the concurrent-viewer count organically toward a
 * follower/quality-derived target with per-tick wobble. Touches NO money. A
 * no-op if there is no live session.
 */
export function tickLiveStream(setGameState: SetGS, deltaSeconds = 1): void {
  // Normalize the delta (guards NaN / Infinity / negative from a bad timer).
  const seconds = Math.max(0, safe(deltaSeconds, 0));
  if (seconds === 0) return;
  setGameState((prev) => {
    const ch = ensureChannel(prev);
    const live = ch.currentStream;
    if (!live?.live) return prev;

    const energyNow = safe(prev.stats?.energy, 0);
    // Accrue only up to the energy actually available: once energy is spent a
    // tick charges 0s and leaves elapsed/viewers untouched, so the session
    // self-limits at 0 energy even if the UI's auto-stop is delayed.
    const chargedSeconds = Math.min(seconds, energyNow / LIVE_ENERGY_DRAIN_PER_SEC);
    if (chargedSeconds <= 0) return prev;

    const energyNext = Math.max(0, energyNow - LIVE_ENERGY_DRAIN_PER_SEC * chargedSeconds);
    const elapsed = safe(live.elapsedSeconds, 0) + chargedSeconds;

    // Organic viewer ramp: climb from ~0.4× toward a follower/quality-derived
    // plateau over the first ~45s, wobble each tick, smooth toward the target.
    const quality = computeQuality(ch.equipment, ch.pcUpgradeLevels);
    const qMult = qualityMultiplier(quality);
    const base = (5 + safe(ch.followers, 0) * 0.015) * qMult;
    const ramp = Math.min(1, elapsed / 45);
    const wobble = 0.85 + Math.random() * 0.35; // 0.85..1.20
    const target = base * (0.4 + 0.9 * ramp) * wobble;
    const prevViewers = safe(live.viewers, 0);
    const viewers = Math.max(0, Math.round(prevViewers + (target - prevViewers) * 0.4));

    return {
      ...prev,
      stats: { ...prev.stats, energy: energyNext },
      gamingStreaming: {
        ...ch,
        currentStream: {
          ...live,
          elapsedSeconds: elapsed,
          duration: Math.max(0, Math.round(elapsed / 60)),
          viewers,
          chatMessages: Math.round(viewers * 2),
        },
      },
    };
  });
}

export interface FinalizeLiveResult extends RunStreamResult {
  /** True when the stream ended because energy ran out (vs. a manual Stop). */
  autoStopped?: boolean;
}

/**
 * End a live session and finalise it through the shared monetization path:
 * viewers/followers/subs/donations/earnings scale by how long the player
 * actually streamed, earnings credited via applyMoneyDelta, the session is
 * appended to streamHistory, and `currentStream` is cleared. Idempotent — a
 * no-op (success:false) if nothing is live, so a reload that resolves a stale
 * session and a user Stop can't both pay out.
 */
export function finalizeLiveStream(
  gameState: GameState,
  setGameState: SetGS,
  args: { rollHype?: number; rollOrganic?: number; autoStopped?: boolean },
  currentWeek: number
): FinalizeLiveResult {
  const channel = ensureChannel(gameState);
  const live = channel.currentStream;
  if (!live?.live) return { success: false, message: 'Not live.' };

  const quality = computeQuality(channel.equipment, channel.pcUpgradeLevels);
  const elapsedSeconds = safe(live.elapsedSeconds, 0);
  // Real minutes streamed (fractional), floored to a small minimum so a stream
  // stopped almost immediately still resolves cleanly.
  const durationMinutes = Math.max(0.5, elapsedSeconds / 60);
  const accruedViewers = Math.max(0, Math.round(safe(live.viewers, 0)));

  // Hype uses the same streak model as runStream; the streak was already
  // advanced for the reserved slot at go-live, so read it (don't re-advance).
  const hypeChance = hypeChanceForStreak(safe(channel.hypeStreak, 0) || 1);
  const outcome = projectStreamOutcome({
    quality,
    followers: channel.followers,
    duration: durationMinutes,
    rollHype: args.rollHype ?? Math.random(),
    rollOrganic: args.rollOrganic ?? Math.random(),
    hypeChance,
    // Everything scales off the viewers the player actually accrued live.
    viewersOverride: accruedViewers,
  });
  const earnings = streamEarnings(outcome.viewers, durationMinutes, outcome.donations, quality);

  const stream: StreamHistoryItem = {
    id: live.id,
    game: live.game,
    duration: Math.max(1, Math.round(durationMinutes)),
    viewers: outcome.viewers,
    earnings,
    followers: outcome.newFollowers,
    subscribers: outcome.newSubs,
    chatMessages: Math.round(outcome.viewers * 2),
    donations: outcome.donations,
    timestamp: Date.now(),
    uploadedAt: currentWeek,
  };

  setGameState((prev) => {
    const ch = ensureChannel(prev);
    // Only the session we're finalising may pay out — guards double-finalise.
    if (!ch.currentStream?.live || ch.currentStream.id !== live.id) return prev;
    const earn = applyMoneyDelta(prev, earnings, `Live stream: ${live.game}`);
    if (!earn) return prev;
    const nextHistory = [stream, ...ch.streamHistory].slice(0, 200);
    const nextAverageViewers = rollingAverageViewers(nextHistory);
    const nextExperience = ch.experience + Math.floor(outcome.viewers / 50);
    const nextLevel = creatorLevelFromExperience(nextExperience);
    return {
      ...prev,
      ...earn,
      gamingStreaming: {
        ...ch,
        currentStream: null,
        followers: ch.followers + outcome.newFollowers,
        subscribers: ch.subscribers + outcome.newSubs,
        totalDonations: ch.totalDonations + outcome.donations,
        totalEarnings: ch.totalEarnings + earnings,
        streamHours: ch.streamHours + durationMinutes / 60,
        streamHistory: nextHistory,
        averageViewers: nextAverageViewers,
        experience: nextExperience,
        level: nextLevel,
        perkTier: creatorPerkTier(nextLevel),
        bestStream:
          !ch.bestStream || outcome.viewers > ch.bestStream.viewers ? stream : ch.bestStream,
      },
    };
  });
  log.info(
    `Live stream ended (${live.game}): ${outcome.viewers} viewers, $${earnings}, ${Math.round(elapsedSeconds)}s${args.autoStopped ? ' (auto-stop)' : ''}`
  );
  return {
    success: true,
    message: args.autoStopped
      ? `Out of energy - stream ended. ${outcome.viewers} viewers, $${earnings}.`
      : outcome.hypeTrain
      ? `Hype train! ${outcome.viewers} viewers, +${outcome.newSubs} subs.`
      : `Stream ended - ${outcome.viewers} viewers, $${earnings}.`,
    stream,
    outcome,
    earnings,
    autoStopped: args.autoStopped,
  };
}

/**
 * Buy or upgrade a piece of gear. Accessories are boolean (price flat),
 * PC components have tiers (price escalates by tier).
 */
export function buyAccessory(
  gameState: GameState,
  setGameState: SetGS,
  id: keyof GamingStreamingState['equipment'],
  price: number,
): { success: boolean; message: string } {
  const channel = ensureChannel(gameState);
  if (channel.equipment[id]) return { success: false, message: 'Already owned.' };
  if (safe(gameState.stats?.money, 0) < price) {
    return { success: false, message: `Need $${price.toLocaleString()}.` };
  }
  // Atomic gate→debit→grant: the old split (updateMoney dispatch + separate
  // flag setGameState) let a same-batch double-tap charge twice for one item.
  setGameState((prev) => {
    const ch = ensureChannel(prev);
    if (ch.equipment[id]) return prev;
    const spend = applyMoneyDelta(prev, -price, `Bought ${String(id)}`);
    if (!spend) return prev;
    return {
      ...prev,
      ...spend,
      gamingStreaming: { ...ch, equipment: { ...ch.equipment, [id]: true } },
    };
  });
  return { success: true, message: `${String(id)} acquired.` };
}

export function upgradePCComponent(
  gameState: GameState,
  setGameState: SetGS,
  id: keyof GamingStreamingState['pcUpgradeLevels'],
  basePrice: number,
): { success: boolean; message: string; newTier?: number } {
  const channel = ensureChannel(gameState);
  const currentTier = channel.pcUpgradeLevels[id] || 0;
  // Anti-exploit: refuse once a component hits the tier ceiling. Past this point
  // the upgrade is a no-op for quality/earnings, so charging for it would be a
  // pure money sink. Refuse BEFORE any debit - never charge on a failure path.
  if (currentTier >= MAX_PC_TIER) {
    return { success: false, message: `${String(id)} is maxed (tier ${MAX_PC_TIER}).` };
  }
  const nextTier = currentTier + 1;
  const cost = Math.round(basePrice * Math.pow(2, currentTier));
  if (safe(gameState.stats?.money, 0) < cost) {
    return { success: false, message: `Need $${cost.toLocaleString()}.` };
  }
  // Atomic: re-derive the tier and cost from prev so a same-batch double-tap
  // can't charge tier-N price twice for one upgrade.
  setGameState((prev) => {
    const ch = ensureChannel(prev);
    const prevTier = ch.pcUpgradeLevels[id] || 0;
    if (prevTier !== currentTier) return prev;
    // Cap re-guard inside the atomic updater (defends against a stale read that
    // slipped past the pre-check).
    if (prevTier >= MAX_PC_TIER) return prev;
    const spend = applyMoneyDelta(prev, -cost, `Upgraded ${String(id)} tier ${nextTier}`);
    if (!spend) return prev;
    return {
      ...prev,
      ...spend,
      gamingStreaming: {
        ...ch,
        pcComponents: { ...ch.pcComponents, [id]: true },
        pcUpgradeLevels: { ...ch.pcUpgradeLevels, [id]: nextTier },
      },
    };
  });
  return { success: true, message: `${String(id)} → tier ${nextTier}.`, newTier: nextTier };
}

// Pricing helpers re-exported for the UIs.
export const ACCESSORY_PRICES: Record<keyof GamingStreamingState['equipment'], number> = {
  microphone: 200,
  webcam: 350,
  gamingChair: 400,
  greenScreen: 250,
  lighting: 180,
};

export const PC_BASE_PRICES: Record<keyof GamingStreamingState['pcUpgradeLevels'], number> = {
  cpu: 500,
  gpu: 800,
  ram: 200,
  ssd: 250,
  motherboard: 300,
  cooling: 150,
  psu: 180,
  case: 120,
  network: 200,
};
