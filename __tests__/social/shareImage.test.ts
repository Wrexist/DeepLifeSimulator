/**
 * The image share must never cost a player the share they had before: on web,
 * on a binary without the native modules, or when capture fails, it reports
 * false so the caller shares text. And the card must say what the text says.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { generateObituary } from '@/lib/legacy/obituaryGenerator';

const share = jest.fn();
let os = 'ios';

/** Load utils/shareImage against a react-native stub for the given platform. */
const load = (platform: string) => {
  os = platform;
  jest.doMock('react-native', () => ({ Platform: { get OS() { return os; } }, Share: { share } }));
  jest.doMock('@/utils/logger', () => ({ logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));
  return require('@/utils/shareImage') as typeof import('@/utils/shareImage');
};

describe('shareViewAsImage', () => {
  const ref = { current: {} };

  beforeEach(() => {
    jest.resetModules();
    share.mockReset().mockResolvedValue({ action: 'sharedAction' });
  });
  afterEach(() => {
    jest.dontMock('react-native');
    jest.dontMock('@/utils/logger');
    jest.dontMock('react-native-view-shot');
    jest.dontMock('expo-sharing');
  });

  it('falls back on web without touching the native modules', async () => {
    await expect(load('web').shareViewAsImage(ref, { message: 'm' })).resolves.toBe(false);
    expect(share).not.toHaveBeenCalled();
  });

  it('falls back when there is nothing to capture', async () => {
    await expect(load('ios').shareViewAsImage({ current: null }, { message: 'm' })).resolves.toBe(false);
  });

  it('falls back when the native capture module is missing (OTA onto an old binary)', async () => {
    jest.doMock('react-native-view-shot', () => { throw new Error('native module missing'); });
    await expect(load('ios').shareViewAsImage(ref, { message: 'm' })).resolves.toBe(false);
    expect(share).not.toHaveBeenCalled();
  });

  it('falls back when capture rejects', async () => {
    jest.doMock('react-native-view-shot', () => ({ captureRef: jest.fn().mockRejectedValue(new Error('no view')) }));
    await expect(load('ios').shareViewAsImage(ref, { message: 'm' })).resolves.toBe(false);
  });

  it('on iOS shares the image file together with the link text', async () => {
    jest.doMock('react-native-view-shot', () => ({ captureRef: jest.fn().mockResolvedValue('file:///tmp/card.png') }));
    await expect(load('ios').shareViewAsImage(ref, { message: 'RIP + link', title: 't' })).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith({ url: 'file:///tmp/card.png', message: 'RIP + link', title: 't' });
  });

  it('on Android shares the file through expo-sharing', async () => {
    const shareAsync = jest.fn().mockResolvedValue(undefined);
    jest.doMock('react-native-view-shot', () => ({ captureRef: jest.fn().mockResolvedValue('file:///tmp/card.png') }));
    jest.doMock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync }));
    await expect(load('android').shareViewAsImage(ref, { message: 'm' })).resolves.toBe(true);
    expect(shareAsync).toHaveBeenCalledWith('file:///tmp/card.png', expect.objectContaining({ mimeType: 'image/png' }));
  });

  it('on Android falls back when expo-sharing is missing', async () => {
    jest.doMock('react-native-view-shot', () => ({ captureRef: jest.fn().mockResolvedValue('file:///tmp/card.png') }));
    jest.doMock('expo-sharing', () => { throw new Error('native module missing'); });
    await expect(load('android').shareViewAsImage(ref, { message: 'm' })).resolves.toBe(false);
  });
});

describe('obituary card', () => {
  it('carries the same facts as the share text', () => {
    const state = createTestGameState();
    const { card, shareText } = generateObituary(state);
    expect(shareText).toContain(card.name);
    expect(shareText).toContain(`Age ${card.age}`);
    expect(shareText).toContain(card.netWorth);
    expect(shareText).toContain(card.cause);
    expect(shareText.toLowerCase()).toContain(card.verdict.toLowerCase());
    expect(card.facts.length).toBeLessThanOrEqual(3);
    expect(card.generation).toBeGreaterThanOrEqual(1);
  });
});
