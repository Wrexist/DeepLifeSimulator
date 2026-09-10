import { Platform } from 'react-native';

type TrackingModule = typeof import('@/utils/trackingTransparency');

describe('iOS tracking permission requires an affirmative native result', () => {
  let tracking: TrackingModule;
  let native: {
    getTrackingPermissionsAsync?: jest.Mock;
    requestTrackingPermissionsAsync?: jest.Mock;
  };
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    Platform.OS = 'ios';
    native = {
      getTrackingPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
      requestTrackingPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    };
  });

  afterEach(() => {
    Platform.OS = originalOS;
    jest.useRealTimers();
    jest.dontMock('expo-tracking-transparency');
    jest.dontMock('react-native');
  });

  async function load(throws = false) {
    jest.doMock('react-native', () => ({ Platform }));
    jest.doMock('expo-tracking-transparency', () => {
      if (throws) throw new Error('native module unavailable');
      return native;
    });
    tracking = await import('@/utils/trackingTransparency');
  }

  async function resolve(operation: Promise<boolean>) {
    await jest.advanceTimersByTimeAsync(100);
    return operation;
  }

  it('does not grant consent when the native module cannot load', async () => {
    await load(true);
    expect(await resolve(tracking.isTrackingAllowed())).toBe(false);
    expect(await resolve(tracking.requestTrackingPermission())).toBe(false);
  });

  it('does not grant consent when required native methods are missing', async () => {
    native = {};
    await load();
    expect(await resolve(tracking.isTrackingAllowed())).toBe(false);
    expect(await resolve(tracking.requestTrackingPermission())).toBe(false);
  });

  it.each([undefined, {}, { status: 'denied' }, { status: 'restricted' }])(
    'does not grant consent for a non-granted status: %p', async result => {
      native.getTrackingPermissionsAsync!.mockResolvedValue(result);
      await load();
      expect(await resolve(tracking.isTrackingAllowed())).toBe(false);
      expect(await resolve(tracking.requestTrackingPermission())).toBe(false);
    },
  );

  it('does not grant consent after a failed native read', async () => {
    native.getTrackingPermissionsAsync!.mockRejectedValue(new Error('status failed'));
    await load();
    expect(await resolve(tracking.isTrackingAllowed())).toBe(false);
    expect(await resolve(tracking.requestTrackingPermission())).toBe(false);
  });

  it('does not grant consent when the prompt method is unavailable', async () => {
    delete native.requestTrackingPermissionsAsync;
    await load();
    expect(await resolve(tracking.requestTrackingPermission())).toBe(false);
  });

  it('does not grant consent after a failed prompt', async () => {
    native.requestTrackingPermissionsAsync!.mockRejectedValue(new Error('prompt failed'));
    await load();
    expect(await resolve(tracking.requestTrackingPermission())).toBe(false);
  });

  it('accepts an explicit grant without prompting again', async () => {
    native.getTrackingPermissionsAsync!.mockResolvedValue({ status: 'granted' });
    await load();
    expect(await resolve(tracking.isTrackingAllowed())).toBe(true);
    expect(await resolve(tracking.requestTrackingPermission())).toBe(true);
    expect(native.getTrackingPermissionsAsync).toHaveBeenCalled();
    expect(native.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('uses the actual prompt outcome', async () => {
    await load();
    expect(await resolve(tracking.requestTrackingPermission())).toBe(true);
    native.requestTrackingPermissionsAsync!.mockResolvedValue({ status: 'denied' });
    expect(await resolve(tracking.requestTrackingPermission())).toBe(false);
  });
});
