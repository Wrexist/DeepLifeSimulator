describe('Firebase measurement purposes', () => {
  const native = { setAnalyticsCollectionEnabled: jest.fn(), setConsent: jest.fn(), logEvent: jest.fn(), getAppInstanceId: jest.fn() };
  const allowed = jest.fn();
  beforeEach(() => {
    jest.resetModules();
    for (const fn of Object.values(native)) fn.mockReset().mockResolvedValue(undefined);
    allowed.mockReset().mockResolvedValue(false);
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    jest.doMock('@react-native-firebase/analytics', () => ({ default: () => native }));
    jest.doMock('@/utils/usageAnalyticsConsent', () => ({ isUsageAnalyticsAllowed: allowed }));
  });
  afterEach(() => {
    jest.dontMock('react-native');
    jest.dontMock('@react-native-firebase/analytics');
    jest.dontMock('@/utils/usageAnalyticsConsent');
  });

  it('starts with all purposes denied and drops direct events', async () => {
    const { firebaseAnalyticsService: service } = await import('@/services/FirebaseAnalyticsService');
    service.logEvent('before_init');
    await service.initialize();
    service.logEvent('after_init');
    expect(native.logEvent).not.toHaveBeenCalled();
    expect(native.setConsent).toHaveBeenCalledWith({ analytics_storage: false, ad_storage: false, ad_user_data: false, ad_personalization: false });
    expect(native.setAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true);
  });

  it('privacy lookup never starts analytics or changes consent', async () => {
    const { firebaseAnalyticsService: service } = await import('@/services/FirebaseAnalyticsService');
    expect(await service.getPrivacyRequestId()).toBeNull();
    expect(native.getAppInstanceId).not.toHaveBeenCalled();
    expect(native.setConsent).not.toHaveBeenCalled();
    await service.initialize();
    native.getAppInstanceId.mockResolvedValue('existing-instance');
    native.setConsent.mockClear();
    native.setAnalyticsCollectionEnabled.mockClear();
    expect(await service.getPrivacyRequestId()).toBe('existing-instance');
    expect(native.setConsent).not.toHaveBeenCalled();
    expect(native.setAnalyticsCollectionEnabled).not.toHaveBeenCalled();
    native.getAppInstanceId.mockRejectedValue(new Error('unavailable'));
    expect(await service.getPrivacyRequestId()).toBeNull();
  });

  it('enables only measurement on opt-in and stops events after withdrawal', async () => {
    allowed.mockResolvedValue(true);
    const { firebaseAnalyticsService: service } = await import('@/services/FirebaseAnalyticsService');
    await service.initialize();
    expect(native.setConsent).toHaveBeenLastCalledWith({ analytics_storage: true, ad_storage: false, ad_user_data: false, ad_personalization: false });
    service.logEvent('week_advanced');
    expect(native.logEvent).toHaveBeenCalledTimes(1);
    const withdrawal = service.setConsent(false);
    service.logEvent('after_withdrawal');
    await withdrawal;
    expect(native.logEvent).toHaveBeenCalledTimes(1);
    expect(native.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(false);
  });

  it('does not enable collection when native purpose updates fail', async () => {
    allowed.mockResolvedValue(true);
    native.setConsent.mockRejectedValue(new Error('native failed'));
    const { firebaseAnalyticsService: service } = await import('@/services/FirebaseAnalyticsService');
    expect(await service.setConsent(true)).toBe(false);
    service.logEvent('must_not_send');
    expect(native.logEvent).not.toHaveBeenCalled();
    expect(native.setAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true);
  });

  it('a withdrawal supersedes an unfinished grant', async () => {
    allowed.mockResolvedValue(true);
    let finish!: () => void;
    native.setConsent.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const { firebaseAnalyticsService: service } = await import('@/services/FirebaseAnalyticsService');
    const grant = service.setConsent(true);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const withdrawal = service.setConsent(false);
    finish();
    await Promise.all([grant, withdrawal]);
    expect(native.setAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true);
    expect(native.setConsent).toHaveBeenLastCalledWith(expect.objectContaining({ analytics_storage: false }));
  });
});
