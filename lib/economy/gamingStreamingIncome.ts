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
  currentWeek: number = 0
): GamingStreamingIncomeResult {
  let gaming = 0;
  let streaming = 0;
  
  if (!gamingData) {
    return { gaming, streaming };
  }
  
  // Calculate gaming earnings from videos with decay (newer videos first in array)
  // LONG-TERM DEGRADATION FIX: Only process last 100 videos (older ones have <10% income anyway)
  // NOTE: Assumes videos array is in reverse chronological order (newest first, index 0 = newest)
  // WARNING: If array order changes (e.g., sorted by views), this calculation breaks
  if (gamingData.videos && gamingData.videos.length > 0) {
    const recentVideos = gamingData.videos.slice(0, 100);
    gaming = recentVideos.reduce((sum, video, index) => {
      // Estimate age: index 0 = newest, higher index = older (roughly weekly uploads)
      // WARNING: If array order changes, this calculation breaks
      const estimatedAge = index;
      // Decay: 5% per week, minimum 10% of original views
      const decayFactor = Math.max(0.1, 1 - (estimatedAge * 0.05));
      const effectiveViews = Math.floor(video.views * decayFactor);
      const baseEarnings = effectiveViews * 0.01; // $0.01 per effective view
      return sum + baseEarnings;
    }, 0);
  }
  
  // Calculate streaming earnings from stream history with decay (newer streams first)
  // LONG-TERM DEGRADATION FIX: Only process last 100 streams (older ones have <10% income anyway)
  if (gamingData.streamHistory && gamingData.streamHistory.length > 0) {
    const recentStreams = gamingData.streamHistory.slice(0, 100);
    streaming = recentStreams.reduce((sum, stream, index) => {
      // Estimate age: index 0 = newest, higher index = older (roughly weekly streams)
      const estimatedAge = index;
      // Decay: 5% per week, minimum 10% of original viewers
      const decayFactor = Math.max(0.1, 1 - (estimatedAge * 0.05));
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

