/**
 * ContentActions Wave A wiring (YouVideo + Streamly, shared gamingStreaming):
 *   - publishVideo/runStream now persist the shared creator `level` (+perkTier)
 *     from accumulated XP so the "Lv N" badge advances on upload/stream.
 *   - runStream writes the rolling `averageViewers` and advances the Streamly
 *     `hypeStreak` (consecutive weeks → higher hype chance; gap → reset).
 *   - publishVideo threads the (pre-clamped) trendBonus into reach.
 */
import {
  publishVideo,
  runStream,
  startLiveStream,
  tickLiveStream,
  finalizeLiveStream,
  LIVE_ENERGY_DRAIN_PER_SEC,
} from '@/contexts/game/actions/ContentActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { creatorLevelFromExperience } from '@/lib/content/creatorLevel';
import type { GameState, GamingStreamingState } from '@/contexts/game/types';

function channel(overrides: Partial<GamingStreamingState> = {}): GamingStreamingState {
  return {
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
    ...overrides,
  };
}

function baseState(ch: GamingStreamingState): GameState {
  return {
    // High energy so multi-stream streak tests aren't gated by the energy cost.
    stats: { money: 1000, energy: 100_000 },
    weeksLived: 5,
    gamingStreaming: ch,
  } as unknown as GameState;
}

function makeStore(initial: GameState) {
  let state = initial;
  const setState = ((update: unknown) => {
    state = typeof update === 'function' ? (update as (s: GameState) => GameState)(state) : (update as GameState);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

const deps = { updateMoney };

describe('publishVideo — creator level persistence', () => {
  it('recomputes level from XP after enough views cross a threshold', () => {
    // experience 90 + a big-subscriber upload crosses the 100-XP → level 2 mark.
    const store = makeStore(baseState(channel({ experience: 90, subscribers: 200_000 })));
    const r = publishVideo(store.get(), store.setState, { title: 'Big one', rollViral: 0.99 }, deps, 5);
    expect(r.success).toBe(true);
    const gs = store.get().gamingStreaming!;
    expect(gs.experience).toBeGreaterThanOrEqual(100);
    expect(gs.level).toBe(creatorLevelFromExperience(gs.experience));
    expect(gs.level).toBeGreaterThan(1);
    expect(gs.perkTier).toBe(0); // first perk tier unlocks at level 5
  });
});

describe('publishVideo — trending topic bonus', () => {
  it('a trend bonus raises reach vs no bonus at the same viral roll', () => {
    // Pin rollOrganic on both so the only difference is the trend bonus (the
    // action seeds Math.random() for organic in live play).
    const withoutStore = makeStore(baseState(channel({ subscribers: 50_000 })));
    publishVideo(withoutStore.get(), withoutStore.setState, { title: 'plain', rollViral: 0.99, rollOrganic: 0.5, trendBonus: 0 }, deps, 5);
    const withStore = makeStore(baseState(channel({ subscribers: 50_000 })));
    publishVideo(withStore.get(), withStore.setState, { title: 'hot', rollViral: 0.99, rollOrganic: 0.5, trendBonus: 0.5 }, deps, 5);
    const plain = withoutStore.get().gamingStreaming!.videos![0].views;
    const hot = withStore.get().gamingStreaming!.videos![0].views;
    expect(hot).toBeGreaterThan(plain);
  });
});

describe('runStream — averageViewers', () => {
  it('writes averageViewers equal to the recorded stream viewers on the first stream', () => {
    const store = makeStore(baseState(channel({ followers: 10_000 })));
    runStream(store.get(), store.setState, { game: 'Just Chatting', duration: 60, rollHype: 0.99 }, deps, 5);
    const gs = store.get().gamingStreaming!;
    expect(gs.streamHistory.length).toBe(1);
    expect(gs.averageViewers).toBe(gs.streamHistory[0].viewers);
    expect(gs.averageViewers).toBeGreaterThan(0);
  });
});

describe('runStream — hype streak', () => {
  it('starts at 1, increments on consecutive weeks, and resets after a gap', () => {
    const store = makeStore(baseState(channel({ followers: 5_000 })));

    // Week 5 — first stream ever → streak 1.
    runStream(store.get(), store.setState, { game: 'Just Chatting', duration: 60, rollHype: 0.99 }, deps, 5);
    expect(store.get().gamingStreaming!.hypeStreak).toBe(1);

    // Week 6 — consecutive → streak 2.
    runStream(store.get(), store.setState, { game: 'Just Chatting', duration: 60, rollHype: 0.99 }, deps, 6);
    expect(store.get().gamingStreaming!.hypeStreak).toBe(2);

    // Week 10 — multi-week gap → reset to 1.
    runStream(store.get(), store.setState, { game: 'Just Chatting', duration: 60, rollHype: 0.99 }, deps, 10);
    expect(store.get().gamingStreaming!.hypeStreak).toBe(1);
  });

  it('a long streak makes a mid-range hype roll land that would miss at 8%', () => {
    // Build a 5-week streak (chance 0.08 + 0.03*4 = 0.20), then roll 0.15.
    const store = makeStore(baseState(channel({ followers: 5_000 })));
    for (let w = 5; w <= 9; w++) {
      runStream(store.get(), store.setState, { game: 'Just Chatting', duration: 60, rollHype: 0.99 }, deps, w);
    }
    expect(store.get().gamingStreaming!.hypeStreak).toBe(5);
    const r = runStream(store.get(), store.setState, { game: 'Just Chatting', duration: 60, rollHype: 0.15 }, deps, 10);
    // week 10 is consecutive to 9 → streak 6, chance 0.23 > 0.15 → hype.
    expect(r.outcome?.hypeTrain).toBe(true);
  });
});

describe('live streaming — start / tick / finalize', () => {
  const lowEnergy = (ch: GamingStreamingState, energy: number, money = 1000): GameState =>
    ({ stats: { money, energy }, weeksLived: 5, gamingStreaming: ch } as unknown as GameState);

  it('startLiveStream goes live, reserves one weekly slot, and does NOT charge energy up-front', () => {
    const store = makeStore(baseState(channel({ followers: 1000 })));
    const energyBefore = store.get().stats.energy;
    const r = startLiveStream(store.get(), store.setState, { game: 'Just Chatting' }, 5);
    expect(r.success).toBe(true);
    const gs = store.get().gamingStreaming!;
    expect(gs.currentStream?.live).toBe(true);
    expect(gs.streamsThisWeek).toBe(1);
    expect(gs.lastStreamWeek).toBe(5);
    // Energy drains via the real-time loop, not at go-live.
    expect(store.get().stats.energy).toBe(energyBefore);
  });

  it('tickLiveStream drains energy in real time (clamped ≥ 0) and accrues elapsed seconds', () => {
    const store = makeStore(lowEnergy(channel({ followers: 10_000 }), 10));
    startLiveStream(store.get(), store.setState, { game: 'Just Chatting' }, 5);
    tickLiveStream(store.setState, 1);
    expect(store.get().gamingStreaming!.currentStream?.elapsedSeconds).toBe(1);
    expect(store.get().stats.energy).toBeCloseTo(10 - LIVE_ENERGY_DRAIN_PER_SEC, 5);
    // No amount of ticking pushes energy below zero.
    for (let i = 0; i < 50; i++) tickLiveStream(store.setState, 1);
    expect(store.get().stats.energy).toBe(0);
  });

  it('finalizeLiveStream banks earnings via money, appends history, clears the session, and is idempotent', () => {
    const store = makeStore(baseState(channel({ followers: 10_000 })));
    startLiveStream(store.get(), store.setState, { game: 'Just Chatting' }, 5);
    for (let i = 0; i < 10; i++) tickLiveStream(store.setState, 1);
    const moneyBefore = store.get().stats.money;
    const streamsBefore = store.get().gamingStreaming!.streamsThisWeek;
    const r = finalizeLiveStream(store.get(), store.setState, { rollHype: 0.99, rollOrganic: 0.5 }, deps, 5);
    expect(r.success).toBe(true);
    const gs = store.get().gamingStreaming!;
    expect(gs.currentStream).toBeNull();
    expect(gs.streamHistory.length).toBe(1);
    expect(store.get().stats.money).toBe(moneyBefore + (r.earnings ?? 0));
    // Finalize does NOT re-increment the weekly counter (start reserved it).
    expect(gs.streamsThisWeek).toBe(streamsBefore);
    // A second finalize is a no-op — no double pay, no duplicate history.
    const again = finalizeLiveStream(store.get(), store.setState, { rollHype: 0.99, rollOrganic: 0.5 }, deps, 5);
    expect(again.success).toBe(false);
    expect(store.get().gamingStreaming!.streamHistory.length).toBe(1);
  });

  it('auto-stop resolves with an out-of-energy message and still banks the session', () => {
    const store = makeStore(lowEnergy(channel({ followers: 5_000 }), 10, 0));
    startLiveStream(store.get(), store.setState, { game: 'Just Chatting' }, 5);
    for (let i = 0; i < 10; i++) tickLiveStream(store.setState, 1);
    expect(store.get().stats.energy).toBe(0);
    const r = finalizeLiveStream(store.get(), store.setState, { rollHype: 0.99, rollOrganic: 0.5, autoStopped: true }, deps, 5);
    expect(r.success).toBe(true);
    expect(r.autoStopped).toBe(true);
    expect(r.message).toMatch(/energy/i);
    expect(store.get().gamingStreaming!.currentStream).toBeNull();
    expect(store.get().gamingStreaming!.streamHistory.length).toBe(1);
  });

  it('respects the weekly stream cap (a live session counts as one stream)', () => {
    const store = makeStore(baseState(channel({ followers: 1000, streamsThisWeek: 5, lastStreamWeek: 5 })));
    const r = startLiveStream(store.get(), store.setState, { game: 'Just Chatting' }, 5);
    expect(r.success).toBe(false);
    expect(store.get().gamingStreaming!.currentStream).toBeNull();
  });
});
