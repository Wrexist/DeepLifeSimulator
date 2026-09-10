describe('analytics permission on native lifecycle transitions', () => {
  let change: (state: string) => void;
  const remove = jest.fn();
  const consent = jest.fn();
  const nativeConsent = jest.fn();
  const allowed = jest.fn();
  const settle = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

  beforeEach(() => {
    jest.resetModules();
    remove.mockReset(); consent.mockReset();
    nativeConsent.mockReset().mockResolvedValue(true);
    allowed.mockReset().mockResolvedValue(true);
    jest.doMock('react-native', () => ({ AppState: {
      currentState: 'active',
      addEventListener: (_event: string, listener: typeof change) => { change = listener; return { remove }; },
    } }));
    jest.doMock('@/lib/analytics/AnalyticsService', () => ({ analytics: { setConsent: consent } }));
    jest.doMock('@/services/FirebaseAnalyticsService', () => ({ firebaseAnalyticsService: {
      setConsent: nativeConsent, suspendCollection: () => { void nativeConsent(false); },
    } }));
    jest.doMock('@/utils/usageAnalyticsConsent', () => ({ isUsageAnalyticsAllowed: allowed }));
  });
  afterEach(() => {
    jest.dontMock('react-native');
    jest.dontMock('@/lib/analytics/AnalyticsService');
    jest.dontMock('@/services/FirebaseAnalyticsService');
    jest.dontMock('@/utils/usageAnalyticsConsent');
  });

  it('immediately pauses in background and stays denied after system revocation', async () => {
    const { observeAnalyticsConsentLifecycle } = await import('@/utils/analyticsConsentLifecycle');
    const { isAnalyticsForeground } = await import('@/utils/analyticsForeground');
    const stop = observeAnalyticsConsentLifecycle(true);
    change('inactive');
    expect(isAnalyticsForeground()).toBe(false);
    expect(consent).toHaveBeenLastCalledWith(false);
    expect(nativeConsent).toHaveBeenLastCalledWith(false);
    allowed.mockResolvedValue(false);
    change('active'); await settle();
    expect(consent).not.toHaveBeenCalledWith(true);
    expect(nativeConsent).not.toHaveBeenCalledWith(true);
    stop();
  });

  it('resumes only after fresh permission and native consent have completed', async () => {
    const { observeAnalyticsConsentLifecycle } = await import('@/utils/analyticsConsentLifecycle');
    const stop = observeAnalyticsConsentLifecycle(true);
    change('background'); change('active');
    expect(consent).not.toHaveBeenCalledWith(true);
    await settle();
    expect(allowed).toHaveBeenCalledTimes(2);
    expect(nativeConsent).toHaveBeenCalledWith(true);
    expect(consent).toHaveBeenLastCalledWith(true);
    stop();
  });

  it('keeps collection off if reading current permission fails', async () => {
    const { observeAnalyticsConsentLifecycle } = await import('@/utils/analyticsConsentLifecycle');
    const stop = observeAnalyticsConsentLifecycle(true);
    allowed.mockRejectedValue(new Error('native permission unavailable'));
    change('background'); change('active'); await settle();
    expect(consent).not.toHaveBeenCalledWith(true);
    expect(nativeConsent).not.toHaveBeenCalledWith(true);
    stop();
  });

  it('discards a granted result from an older foreground transition', async () => {
    const { observeAnalyticsConsentLifecycle } = await import('@/utils/analyticsConsentLifecycle');
    const stop = observeAnalyticsConsentLifecycle(true);
    let finish!: (value: boolean) => void;
    allowed.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; }));
    change('background'); change('active');
    change('background'); allowed.mockResolvedValue(false); change('active');
    finish(true); await settle();
    expect(consent).not.toHaveBeenCalledWith(true);
    expect(nativeConsent).not.toHaveBeenCalledWith(true);
    stop();
  });

  it('rechecks withdrawal that happens while the native bridge waits', async () => {
    const { observeAnalyticsConsentLifecycle } = await import('@/utils/analyticsConsentLifecycle');
    const stop = observeAnalyticsConsentLifecycle(true);
    allowed.mockResolvedValueOnce(true).mockResolvedValue(false);
    change('background'); change('active'); await settle();
    expect(consent).not.toHaveBeenCalledWith(true);
    expect(nativeConsent).toHaveBeenLastCalledWith(false);
    stop();
  });

  it('removes the listener and ignores a read completing after cleanup', async () => {
    const { observeAnalyticsConsentLifecycle } = await import('@/utils/analyticsConsentLifecycle');
    const stop = observeAnalyticsConsentLifecycle(false);
    let finish!: (value: boolean) => void;
    allowed.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; }));
    change('background'); change('active'); stop(); finish(true); await settle();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(consent).not.toHaveBeenCalledWith(true);
    expect(nativeConsent).not.toHaveBeenCalled();
  });
});
