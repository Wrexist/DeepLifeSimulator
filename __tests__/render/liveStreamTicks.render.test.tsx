import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import { useGame } from '@/contexts/GameContext';
import GamingStreamingApp from '@/components/computer/GamingStreamingApp';
import { LIVE_ENERGY_DRAIN_PER_SEC, LIVE_MAX_TICK_GAP_S } from '@/contexts/game/actions/ContentActions';

/**
 * A live broadcast must actually run.
 *
 * Tester report 2026-10-10: the Go Live console sat at "0:00 elapsed", 0
 * viewers and full energy - the stream never progressed. The drain loop's
 * effect depended on handler identities as well as `isLiveNow`, so a re-render
 * that produced a new identity restarted the one-second wait, and every
 * callback assumed exactly one second had passed. It now depends on
 * `isLiveNow` alone and accrues the wall-clock time between callbacks (capped,
 * so a background suspension is not billed at once).
 */
function Harness({ onRead }: { onRead: (elapsed: number, energy: number, viewers: number) => void }) {
  const { gameState, setGameState } = useGame();
  const seeded = React.useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    setGameState((prev) => ({
      ...prev,
      stats: { ...prev.stats, energy: 70 },
      gamingStreaming: {
        ...(prev.gamingStreaming ?? ({} as never)),
        currentStream: {
          id: 'live-test', game: 'RPG Marathon', duration: 0, viewers: 0, earnings: 0,
          followers: 0, subscribers: 0, chatMessages: 0, donations: 0,
          live: true, startedAtMs: Date.now(), elapsedSeconds: 0, uploadedAt: 0,
        },
      },
    }) as never);
  }, [setGameState]);
  const live = gameState.gamingStreaming?.currentStream?.live === true;
  const s = gameState.gamingStreaming?.currentStream;
  onRead(s?.elapsedSeconds ?? -1, gameState.stats.energy, s?.viewers ?? -1);
  return live ? <GamingStreamingApp onBack={() => {}} /> : null;
}

function mount() {
  const read = { elapsed: -1, energy: -1, viewers: -1 };
  const r = renderWithProviders(
    <Harness onRead={(elapsed, energy, viewers) => Object.assign(read, { elapsed, energy, viewers })} />,
  );
  act(() => {});
  return { read, unmount: r.unmount };
}

describe('live stream drain loop', () => {
  // Date is faked too: accrual is measured from the clock, and the fake clock
  // starts at real "now", so the session still reads as this runtime's own.
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  it('advances elapsed time, drains energy and grows the audience', () => {
    const { read, unmount } = mount();
    for (let i = 0; i < 5; i++) act(() => { jest.advanceTimersByTime(1000); });
    expect(read.elapsed).toBeCloseTo(5, 5);
    expect(read.energy).toBeCloseTo(70 - 5 * LIVE_ENERGY_DRAIN_PER_SEC, 5);
    expect(read.viewers).toBeGreaterThan(0);
    unmount();
  });

  it('never bills more than the cap for one late callback (app was suspended)', () => {
    const { read, unmount } = mount();
    // The clock jumps a minute while no timer callback runs, then one fires.
    act(() => { jest.setSystemTime(Date.now() + 60_000); });
    act(() => { jest.advanceTimersByTime(1000); });
    expect(read.elapsed).toBeLessThanOrEqual(LIVE_MAX_TICK_GAP_S + 1e-9);
    expect(read.elapsed).toBeGreaterThan(0);
    unmount();
  });
});
