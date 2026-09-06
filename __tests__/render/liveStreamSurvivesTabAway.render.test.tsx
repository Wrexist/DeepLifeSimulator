import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import { useGame } from '@/contexts/GameContext';
import GamingStreamingApp from '@/components/computer/GamingStreamingApp';
import { isLiveSessionFromThisRuntime } from '@/contexts/game/actions/ContentActions';

/**
 * Tabbing away from a live broadcast must not end it.
 *
 * `GamingStreamingApp` finalizes a live session it finds on mount, so a session
 * that survived an app kill cannot stream forever. But a remount is
 * indistinguishable from a relaunch by inspection - switching tabs for two
 * seconds unmounts this screen exactly as an app kill does - so the guard also
 * killed every broadcast the player navigated away from and back to. That is
 * the "it never goes all the way through on its own" a tester reported on
 * 2026-09-06.
 *
 * The distinction comes from the session's existing `startedAtMs`: a session
 * stamped after this JS runtime began is one we started, and must be left
 * alone. Nothing is added to the save format.
 */
/**
 * The app must mount with the session ALREADY in state, or the mount-time
 * resolver runs against an empty channel, marks itself done, and every
 * assertion below passes for the wrong reason. That is the silent-staleness
 * trap `capture-rich-state.mjs` documents, and it caught this test first time
 * out: both cases "passed" while the resolver had never seen a live session.
 */
function Harness({
  startedAtMs,
  onRead,
}: {
  startedAtMs: number;
  onRead: (live: boolean) => void;
}) {
  const { gameState, setGameState } = useGame();
  const seeded = React.useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    setGameState((prev) => ({
      ...prev,
      gamingStreaming: {
        ...(prev.gamingStreaming ?? ({} as never)),
        currentStream: {
          id: 'live-test',
          game: 'Test Game',
          duration: 0,
          viewers: 12,
          earnings: 0,
          followers: 0,
          subscribers: 0,
          chatMessages: 0,
          donations: 0,
          live: true,
          startedAtMs,
          elapsedSeconds: 4,
          uploadedAt: 0,
        },
      },
    }) as never);
  }, [setGameState, startedAtMs]);

  const live = gameState.gamingStreaming?.currentStream?.live === true;
  onRead(live);
  // Mount the app only once the session exists, so the resolver actually runs
  // against it - the whole point of the test.
  return live ? <GamingStreamingApp onBack={() => {}} /> : null;
}

function mountWith(startedAtMs: number) {
  let live = false;
  let sawLive = false;
  const { unmount } = renderWithProviders(
    <Harness
      startedAtMs={startedAtMs}
      onRead={(l) => {
        live = l;
        if (l) sawLive = true;
      }}
    />,
  );
  act(() => {});
  // `sawLive` proves the app was actually mounted against a live session, so a
  // green assertion cannot mean "the seed never landed".
  return { stillLive: () => live, everWentLive: () => sawLive, unmount };
}

describe('the predicate that tells a tab switch from an app relaunch', () => {
  it('a session stamped after this runtime began is OURS', () => {
    const ch = { currentStream: { live: true, startedAtMs: Date.now() } } as never;
    expect(isLiveSessionFromThisRuntime(ch)).toBe(true);
  });

  it('a session from before this runtime is stale', () => {
    // An hour before the module was imported: only a previous app launch.
    const ch = { currentStream: { live: true, startedAtMs: Date.now() - 3_600_000 } } as never;
    expect(isLiveSessionFromThisRuntime(ch)).toBe(false);
  });

  it('a session with no marker at all keeps the old, safe behaviour', () => {
    // Written before `startedAtMs` existed: treated as stale, because
    // finalizing pays out what accrued while resuming would stream against an
    // app launch that is gone.
    const ch = { currentStream: { live: true } } as never;
    expect(isLiveSessionFromThisRuntime(ch)).toBe(false);
  });

  it('is false when nothing is live', () => {
    expect(isLiveSessionFromThisRuntime({ currentStream: { live: false } } as never)).toBe(false);
    expect(isLiveSessionFromThisRuntime(null)).toBe(false);
    expect(isLiveSessionFromThisRuntime(undefined)).toBe(false);
  });
});

describe('render - the Streaming app on mount', () => {
  // The component owns a real 1-second drain interval while a session is live.
  // Fake timers keep it from firing (and from holding the run open); `Date` is
  // deliberately NOT faked, because the predicate under test compares the
  // session's stamp against a runtime start captured at import - before any
  // fake clock is installed.
  beforeEach(() => { jest.useFakeTimers({ doNotFake: ['Date'] }); });
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  it('LEAVES a broadcast this runtime started still live', () => {
    // The regression: pre-fix this mount finalized the session unconditionally,
    // so returning to the tab ended the stream.
    const { stillLive, everWentLive, unmount } = mountWith(Date.now());
    expect(everWentLive()).toBe(true); // the app really did mount on a live session
    expect(stillLive()).toBe(true);
    unmount();
  });

  it('still finalizes a session that survived an app kill', () => {
    // The guard must keep doing its original job, or a killed-app session
    // streams forever.
    const { stillLive, everWentLive, unmount } = mountWith(Date.now() - 3_600_000);
    expect(everWentLive()).toBe(true); // it was live before the resolver ran
    expect(stillLive()).toBe(false);
    unmount();
  });
});
