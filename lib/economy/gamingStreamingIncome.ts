/**
 * Gaming & Streaming Income Calculation
 * 
 * Shared calculation logic for gaming/streaming income to avoid duplication
 * between passive income calculation and weekly progression.
 */

import { GamingStreamingState } from '@/contexts/game/types';

export interface GamingStreamingIncomeResult {
  gaming: number;
  streaming: number;
}

/**
 * Calculate gaming and streaming income from videos and stream history
 * 
 * @param gamingData - Gaming/streaming data from game state
 * @param currentWeek - Current game week (for age calculation)
 * @returns Object with gaming and streaming income amounts
 */
export function calcGamingStreamingIncome(
  gamingData: GamingStreamingState | undefined,
  _currentWeek: number = 0
): GamingStreamingIncomeResult {
  let gaming = 0;
  let streaming = 0;
  
  if (!gamingData) {
    return { gaming, streaming };
  }
  
  // Calculate gaming earnings from videos with decay (newer videos first in array)
  // LONG-TERM DEGRADATION FIX: Only process last 100 videos (older ones have <10% income anyway)
  // CRASH FIX (C-4): Sort by timestamp descending to guarantee order, don't rely on insertion order
  if (gamingData.videos && gamingData.videos.length > 0) {
    const sortedVideos = [...gamingData.videos].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const recentVideos = sortedVideos.slice(0, 100);
    gaming = recentVideos.reduce((sum, video, index) => {
      // Estimate age: index 0 = newest, higher index = older (roughly weekly uploads)
      // WARNING: If array order changes, this calculation breaks
      const estimatedAge = index;
      // ANTI-EXPLOIT: Decay 5% per week, drops to 0 after 20 weeks (was 10% floor = permanent income)
      // Old videos should eventually stop generating income to prevent infinite passive income stacking
      const decayFactor = Math.max(0, 1 - (estimatedAge * 0.05));
      const effectiveViews = Math.floor(video.views * decayFactor);
      const baseEarnings = effectiveViews * 0.01; // $0.01 per effective view
      return sum + baseEarnings;
    }, 0);
  }
  
  // Calculate streaming earnings from stream history with decay (newer streams first)
  // LONG-TERM DEGRADATION FIX: Only process last 100 streams (older ones have <10% income anyway)
  // CRASH FIX (C-4): Sort by timestamp descending to guarantee order
  if (gamingData.streamHistory && gamingData.streamHistory.length > 0) {
    const sortedStreams = [...gamingData.streamHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const recentStreams = sortedStreams.slice(0, 100);
    streaming = recentStreams.reduce((sum, stream, index) => {
      // Estimate age: index 0 = newest, higher index = older (roughly weekly streams)
      const estimatedAge = index;
      // ANTI-EXPLOIT: Decay 5% per week, drops to 0 after 20 weeks (was 10% floor)
      const decayFactor = Math.max(0, 1 - (estimatedAge * 0.05));
      const effectiveViewers = Math.floor(stream.viewers * decayFactor);
      const viewerEarnings = effectiveViewers * 0.005; // $0.005 per effective viewer per stream
      const durationEarnings = stream.duration * 0.02; // $0.02 per minute
      return sum + viewerEarnings + durationEarnings;
    }, 0);
  }
  
  return {
    gaming: Math.round(gaming),
    streaming: Math.round(streaming),
  };
}

