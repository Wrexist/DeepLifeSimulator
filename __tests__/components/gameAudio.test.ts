const mockPlayers: { play: jest.Mock; pause: jest.Mock; remove: jest.Mock; seekTo: jest.Mock; volume: number }[] = [];
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  createAudioPlayer: jest.fn(() => {
    const player = { play: jest.fn(), pause: jest.fn(), remove: jest.fn(), seekTo: jest.fn().mockResolvedValue(undefined), volume: 0 };
    mockPlayers.push(player);
    return player;
  }),
}));
import { SoundManager } from '@/utils/soundManager';

describe('game audio lifecycle', () => {
  beforeEach(() => { mockPlayers.length = 0; jest.clearAllMocks(); });
  it('does not load or play audio until settings enable it', async () => {
    const manager = new SoundManager();
    await manager.playSound('week');
    expect(mockPlayers).toHaveLength(0);
    manager.setEnabled(true);
    await manager.playSound('week');
    expect(mockPlayers.reduce((n, p) => n + p.play.mock.calls.length, 0)).toBe(1);
  });
  it('mute/background stops loaded audio and cancels a pending seek', async () => {
    const manager = new SoundManager();
    manager.setEnabled(true);
    await manager.initialize();
    const week = mockPlayers[6];
    let finish: () => void = () => {};
    week.seekTo.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const pending = manager.playSound('week');
    await Promise.resolve();
    manager.setEnabled(false);
    finish();
    await pending;
    expect(week.play).not.toHaveBeenCalled();
    expect(mockPlayers.every(p => p.pause.mock.calls.length > 0)).toBe(true);
  });
  it('does not multiply resources or replay the same rapid cue concurrently', async () => {
    const manager = new SoundManager();
    manager.setEnabled(true);
    await Promise.all([manager.playSound('success'), manager.playSound('success')]);
    expect(mockPlayers).toHaveLength(7);
    expect(mockPlayers.reduce((n, p) => n + p.play.mock.calls.length, 0)).toBe(1);
    await manager.unloadAllSounds();
    expect(mockPlayers.every(p => p.remove.mock.calls.length === 1)).toBe(true);
  });
});
