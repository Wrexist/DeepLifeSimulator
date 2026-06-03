/**
 * ContentActions — publish videos / run streams / buy gear.
 *
 * Previously both GamingApp.tsx and GamingStreamingApp.tsx had divergent
 * inline implementations of these operations. This file makes them share the
 * pure libs in `lib/content/`.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GameState, GamingStreamingState, Video, StreamHistoryItem } from '../types';
import { computeQuality, qualityMultiplier } from '@/lib/content/quality';
import { projectStreamOutcome, projectVideoOutcome } from '@/lib/content/algorithm';
import { streamEarnings, videoEarnings } from '@/lib/content/monetization';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';

const log = logger.scope('ContentActions');
const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

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
    trendBonus?: number;
  },
  deps: { updateMoney: typeof updateMoney },
  currentWeek: number
): PublishVideoResult {
  const energy = safe(gameState.stats?.energy, 0);
  const cost = safe(args.energyCost, 15);
  if (energy < cost) {
    return { success: false, message: `Need ${cost} energy to record (have ${Math.round(energy)}).` };
  }

  const channel = ensureChannel(gameState);
  const quality = computeQuality(channel.equipment, channel.pcUpgradeLevels);
  const outcome = projectVideoOutcome({
    quality,
    subscribers: channel.subscribers,
    rollViral: args.rollViral ?? Math.random(),
    trendBonus: args.trendBonus,
  });
  const earnings = videoEarnings(outcome.views, quality);

  const video: Video = {
    id: `vid_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
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

  deps.updateMoney(setGameState, earnings, `Video: ${args.title}`);
  setGameState((prev) => {
    const ch = ensureChannel(prev);
    return {
      ...prev,
      stats: { ...prev.stats, energy: Math.max(0, safe(prev.stats?.energy, 0) - cost) },
      gamingStreaming: {
        ...ch,
        videos: [video, ...(ch.videos ?? [])].slice(0, 200),
        subscribers: ch.subscribers + outcome.subscribersGained,
        totalViews: ch.totalViews + outcome.views,
        totalEarnings: ch.totalEarnings + earnings,
        experience: ch.experience + Math.floor(outcome.views / 100),
      },
    };
  });
  log.info(`Published video "${args.title}" (${outcome.views} views, $${earnings})`);
  return {
    success: true,
    message: outcome.viral
      ? `${args.title} went viral! +${outcome.views.toLocaleString()} views.`
      : `${args.title} published — ${outcome.views.toLocaleString()} views.`,
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
  args: { game: string; duration: number; energyCost?: number; rollHype?: number },
  deps: { updateMoney: typeof updateMoney },
  currentWeek: number
): RunStreamResult {
  const energy = safe(gameState.stats?.energy, 0);
  const cost = safe(args.energyCost, Math.max(20, Math.floor(args.duration / 3)));
  if (energy < cost) {
    return { success: false, message: `Need ${cost} energy to stream (have ${Math.round(energy)}).` };
  }

  const channel = ensureChannel(gameState);
  const quality = computeQuality(channel.equipment, channel.pcUpgradeLevels);
  const outcome = projectStreamOutcome({
    quality,
    followers: channel.followers,
    duration: args.duration,
    rollHype: args.rollHype ?? Math.random(),
  });
  const earnings = streamEarnings(outcome.viewers, args.duration, outcome.donations, quality);

  const stream: StreamHistoryItem = {
    id: `stream_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    game: args.game,
    duration: args.duration,
    viewers: outcome.viewers,
    earnings,
    followers: outcome.newFollowers,
    subscribers: outcome.newSubs,
    chatMessages: Math.round(outcome.viewers * 2),
    donations: outcome.donations,
    timestamp: Date.now(),
  };

  deps.updateMoney(setGameState, earnings, `Stream: ${args.game}`);
  setGameState((prev) => {
    const ch = ensureChannel(prev);
    return {
      ...prev,
      stats: { ...prev.stats, energy: Math.max(0, safe(prev.stats?.energy, 0) - cost) },
      gamingStreaming: {
        ...ch,
        followers: ch.followers + outcome.newFollowers,
        subscribers: ch.subscribers + outcome.newSubs,
        totalDonations: ch.totalDonations + outcome.donations,
        totalEarnings: ch.totalEarnings + earnings,
        streamHours: ch.streamHours + args.duration / 60,
        streamHistory: [stream, ...ch.streamHistory].slice(0, 200),
        experience: ch.experience + Math.floor(outcome.viewers / 50),
        bestStream:
          !ch.bestStream || outcome.viewers > ch.bestStream.viewers ? stream : ch.bestStream,
        streamsThisWeek: (ch.streamsThisWeek ?? 0) + 1,
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
      : `Stream ended — ${outcome.viewers} viewers, $${earnings}.`,
    stream,
    outcome,
    earnings,
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
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } {
  const channel = ensureChannel(gameState);
  if (channel.equipment[id]) return { success: false, message: 'Already owned.' };
  if (safe(gameState.stats?.money, 0) < price) {
    return { success: false, message: `Need $${price.toLocaleString()}.` };
  }
  deps.updateMoney(setGameState, -price, `Bought ${String(id)}`);
  setGameState((prev) => {
    const ch = ensureChannel(prev);
    return {
      ...prev,
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
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string; newTier?: number } {
  const channel = ensureChannel(gameState);
  const currentTier = channel.pcUpgradeLevels[id] || 0;
  const nextTier = currentTier + 1;
  const cost = Math.round(basePrice * Math.pow(2, currentTier));
  if (safe(gameState.stats?.money, 0) < cost) {
    return { success: false, message: `Need $${cost.toLocaleString()}.` };
  }
  deps.updateMoney(setGameState, -cost, `Upgraded ${String(id)} tier ${nextTier}`);
  setGameState((prev) => {
    const ch = ensureChannel(prev);
    return {
      ...prev,
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
