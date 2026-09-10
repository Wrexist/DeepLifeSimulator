describe('separate usage analytics permission', () => {
  const storage = { getItem: jest.fn(), setItem: jest.fn() };
  const tracking = jest.fn();
  beforeEach(() => {
    jest.resetModules();
    storage.getItem.mockReset().mockResolvedValue(null);
    storage.setItem.mockReset().mockResolvedValue(undefined);
    tracking.mockReset().mockResolvedValue(true);
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: storage }));
    jest.doMock('@/utils/trackingTransparency', () => ({ isTrackingAllowed: tracking }));
  });
  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@/utils/trackingTransparency');
  });

  it.each([null, 'true', 'denied', 'broken'])('does not turn ATT approval into usage consent: %s', async value => {
    storage.getItem.mockResolvedValue(value);
    const consent = await import('@/utils/usageAnalyticsConsent');
    expect(await consent.isUsageAnalyticsAllowed()).toBe(false);
    expect(tracking).not.toHaveBeenCalled();
  });

  it('requires both the separate choice and tracking permission', async () => {
    storage.getItem.mockResolvedValue('granted');
    const consent = await import('@/utils/usageAnalyticsConsent');
    expect(await consent.isUsageAnalyticsAllowed()).toBe(true);
    tracking.mockResolvedValue(false);
    expect(await consent.isUsageAnalyticsAllowed()).toBe(false);
  });

  it('fails closed on storage read or tracking failures', async () => {
    const consent = await import('@/utils/usageAnalyticsConsent');
    storage.getItem.mockRejectedValue(new Error('read failed'));
    expect(await consent.isUsageAnalyticsAllowed()).toBe(false);
    storage.getItem.mockResolvedValue('granted');
    tracking.mockRejectedValue(new Error('native failed'));
    expect(await consent.isUsageAnalyticsAllowed()).toBe(false);
  });

  it('denies this session when persisting a withdrawal fails', async () => {
    storage.getItem.mockResolvedValue('granted');
    storage.setItem.mockRejectedValue(new Error('disk full'));
    const consent = await import('@/utils/usageAnalyticsConsent');
    await expect(consent.saveUsageAnalyticsConsent(false)).rejects.toThrow('disk full');
    expect(await consent.isUsageAnalyticsAllowed()).toBe(false);
  });

  it('serializes a grant followed by withdrawal and never exposes the stale grant', async () => {
    let finish!: () => void;
    storage.setItem.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    storage.getItem.mockResolvedValue('granted');
    const consent = await import('@/utils/usageAnalyticsConsent');
    const grant = consent.saveUsageAnalyticsConsent(true);
    const withdraw = consent.saveUsageAnalyticsConsent(false);
    await new Promise(resolve => setImmediate(resolve));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(await consent.isUsageAnalyticsAllowed()).toBe(false);
    finish();
    await Promise.all([grant, withdraw]);
    expect(storage.setItem.mock.calls.map(call => call[1])).toEqual(['granted', 'denied']);
    expect(await consent.isUsageAnalyticsAllowed()).toBe(false);
  });

  it('denies an in-flight permission read when the app leaves the foreground', async () => {
    storage.getItem.mockResolvedValue('granted');
    let finish!: (value: boolean) => void;
    tracking.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const consent = await import('@/utils/usageAnalyticsConsent');
    const { setAnalyticsForeground } = await import('@/utils/analyticsForeground');
    const reading = consent.isUsageAnalyticsAllowed();
    await new Promise(resolve => setImmediate(resolve));
    setAnalyticsForeground(false);
    setAnalyticsForeground(true);
    finish(true);
    expect(await reading).toBe(false);
    expect(await consent.hasUsageAnalyticsConsent()).toBe(true);
  });
});
