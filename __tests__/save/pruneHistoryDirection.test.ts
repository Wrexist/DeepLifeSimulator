/**
 * The save pruner must cap each history array from the right END.
 *
 * `gamingStreaming.streamHistory` and `.videos` are written NEWEST-FIRST
 * (`[stream, ...history].slice(0, 200)` in ContentActions), but the pruner ran
 * `slice(-100)` over them, which keeps the 100 OLDEST entries: once a streamer
 * passed 100 broadcasts, every save dropped the latest ones. And the trip log
 * lives at `travel.travelHistory`, while the pruner capped a top-level
 * `travelHistory` that does not exist. (2026-10-21 audit PERF-7 / PERF-8.)
 */
import { saveQueue } from '@/utils/saveQueue';
import { createTestGameState } from '../helpers/createTestGameState';

/** pruneSaveData is private; the behaviour is what matters, not the access. */
const prune = (data: unknown, aggressive = false) =>
  (saveQueue as unknown as { pruneSaveData: (d: unknown, a?: boolean) => any }).pruneSaveData(data, aggressive);

function streamerState(count: number) {
  const base = createTestGameState();
  // Newest first, as ContentActions writes them: id 0 is the latest.
  const streamHistory = Array.from({ length: count }, (_, i) => ({ id: `s${i}` }));
  const videos = Array.from({ length: count }, (_, i) => ({ id: `v${i}` }));
  return {
    ...base,
    gamingStreaming: { ...(base.gamingStreaming ?? {}), streamHistory, videos },
  };
}

describe('pruneSaveData keeps the newest entries of newest-first arrays', () => {
  it('stores the whole write-capped history on a normal save', () => {
    const pruned = prune(streamerState(200));
    expect(pruned.gamingStreaming.streamHistory).toHaveLength(200);
    expect(pruned.gamingStreaming.videos).toHaveLength(200);
    expect(pruned.gamingStreaming.streamHistory[0].id).toBe('s0');
  });

  it('keeps index 0 (the latest broadcast) when it has to trim', () => {
    const pruned = prune(streamerState(250));
    expect(pruned.gamingStreaming.streamHistory).toHaveLength(200);
    expect(pruned.gamingStreaming.streamHistory[0].id).toBe('s0');
    expect(pruned.gamingStreaming.videos[0].id).toBe('v0');

    const aggressive = prune(streamerState(250), true);
    expect(aggressive.gamingStreaming.streamHistory).toHaveLength(100);
    expect(aggressive.gamingStreaming.streamHistory[0].id).toBe('s0');
    expect(aggressive.gamingStreaming.streamHistory[99].id).toBe('s99');
    expect(aggressive.gamingStreaming.videos[0].id).toBe('v0');
  });
});

describe('pruneSaveData caps travel.travelHistory', () => {
  it('trims the nested trip log, keeping the most recent trips', () => {
    const base = createTestGameState();
    // Oldest first, as TravelActions appends.
    const travelHistory = Array.from({ length: 150 }, (_, i) => ({
      destinationId: `d${i}`,
      week: i,
      year: 2025,
    }));
    const state = { ...base, travel: { ...base.travel, travelHistory } };

    const pruned = prune(state);
    expect(pruned.travel.travelHistory).toHaveLength(100);
    expect(pruned.travel.travelHistory[99].destinationId).toBe('d149');
    expect('travelHistory' in pruned).toBe(false);
  });
});
