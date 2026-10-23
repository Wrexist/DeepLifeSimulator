/**
 * Every catalogue event must be loggable in Firebase (MON2-1).
 *
 * `@react-native-firebase/analytics` THROWS on a reserved event name before the
 * call reaches native code, and `FirebaseAnalyticsService.logEvent` swallows
 * that throw into a debug line. `session_start` - the event that carries the
 * retention cohort - is reserved, so it never reached Firebase at all.
 */
import { ANALYTICS_EVENT_NAME_LIST } from '@/lib/analytics/events';
import { firebaseEventName } from '@/services/FirebaseAnalyticsService';

// The SDK's list (node_modules/@react-native-firebase/analytics/lib/namespaced.ts).
const SDK_RESERVED = [
  'ad_activeview', 'ad_click', 'ad_exposure', 'ad_query', 'ad_reward', 'adunit_exposure',
  'app_background', 'app_clear_data', 'app_exception', 'app_remove', 'app_store_refund',
  'app_store_subscription_cancel', 'app_store_subscription_convert', 'app_store_subscription_renew',
  'app_update', 'app_upgrade', 'dynamic_link_app_open', 'dynamic_link_app_update',
  'dynamic_link_first_open', 'error', 'first_open', 'first_visit', 'in_app_purchase',
  'notification_dismiss', 'notification_foreground', 'notification_open', 'notification_receive',
  'os_update', 'session_start', 'session_start_with_rollout', 'user_engagement',
];

describe('firebaseEventName', () => {
  it('moves session_start out of the reserved namespace', () => {
    expect(firebaseEventName('session_start')).toBe('dl_session_start');
  });

  it('leaves ordinary catalogue names untouched', () => {
    expect(firebaseEventName('week_advanced')).toBe('week_advanced');
    expect(firebaseEventName('purchase_succeeded')).toBe('purchase_succeeded');
  });

  it('maps every catalogue event to a name the SDK accepts', () => {
    for (const name of ANALYTICS_EVENT_NAME_LIST) {
      if (name === 'screen_view') continue; // routed to logScreenView
      const out = firebaseEventName(name);
      expect(SDK_RESERVED).not.toContain(out);
      expect(out).toMatch(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/);
      expect(out).not.toMatch(/^(firebase_|google_|ga_)/);
    }
  });

  it('renames reserved prefixes and a leading non-letter', () => {
    expect(firebaseEventName('firebase_x')).toBe('dl_firebase_x');
    expect(firebaseEventName('1abc')).toBe('dl_1abc');
  });
});

describe('FirebaseAnalyticsService.logEvent with a reserved name', () => {
  const native = {
    setAnalyticsCollectionEnabled: jest.fn(),
    setConsent: jest.fn(),
    logScreenView: jest.fn(),
    // Behaves like the real SDK: throws synchronously on a reserved name.
    logEvent: jest.fn((name: string) => {
      if (SDK_RESERVED.includes(name)) throw new Error(`'${name}' is reserved`);
      return Promise.resolve();
    }),
  };
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    jest.doMock('@react-native-firebase/analytics', () => ({ default: () => native }));
    jest.doMock('@/utils/usageAnalyticsConsent', () => ({ isUsageAnalyticsAllowed: jest.fn().mockResolvedValue(true) }));
    jest.doMock('@/utils/analyticsForeground', () => ({ isAnalyticsForeground: () => true }));
  });
  afterEach(() => {
    jest.dontMock('react-native');
    jest.dontMock('@react-native-firebase/analytics');
    jest.dontMock('@/utils/usageAnalyticsConsent');
    jest.dontMock('@/utils/analyticsForeground');
  });

  it('delivers session_start under the renamed event', async () => {
    const { firebaseAnalyticsService: service } = await import('@/services/FirebaseAnalyticsService');
    await service.initialize();
    native.logEvent.mockClear();
    service.logEvent('session_start', { cohort_day: 3 });
    expect(native.logEvent).toHaveBeenCalledTimes(1);
    expect(native.logEvent).toHaveBeenCalledWith('dl_session_start', { cohort_day: 3 });
    expect(native.logEvent.mock.results[0].type).toBe('return');
  });
});
