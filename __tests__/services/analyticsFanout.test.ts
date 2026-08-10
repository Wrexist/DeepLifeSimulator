/**
 * `track()` must reach Firebase even when the self-hosted endpoint is absent.
 *
 * WHY THIS IS PINNED
 * ------------------
 * The app emits a full funnel — session_start, week_advanced, death,
 * paywall_viewed, paywall_cta_tapped, purchase_started/succeeded/failed. For a
 * long time that had exactly one sink: an HTTP queue requiring a self-hosted
 * endpoint. Without one, every event was computed on every device and dropped,
 * so a shipped release produced no payer rate, no ARPDAU, no retention curve
 * and no paywall funnel — none of which can be backfilled later.
 *
 * The fix was a second, independent sink. The failure mode it guards against is
 * subtle: moving the Firebase forward BELOW the `active` check would make "no
 * telemetry endpoint" silently disable Firebase too, and nothing would break,
 * fail, or warn. It would just quietly stop measuring the business again.
 */

const mockLogEvent = jest.fn();

jest.mock('@/services/FirebaseAnalyticsService', () => ({
  firebaseAnalyticsService: {
    logEvent: (...args: unknown[]) => mockLogEvent(...args),
    initialize: jest.fn(),
    setConsent: jest.fn(),
  },
}));

jest.mock('@/lib/config/featureFlags', () => ({
  FEATURE_FLAGS: { firebaseAnalytics: true, telemetry: false },
}));

import { analytics } from '@/lib/analytics/AnalyticsService';

describe('analytics fan-out', () => {
  beforeEach(() => {
    mockLogEvent.mockClear();
    // Endpoint deliberately absent — the exact production shape this guards.
    analytics.configure({ enabled: false, endpoint: null });
    analytics.setConsent(true);
  });

  it('forwards to Firebase with NO telemetry endpoint configured', () => {
    analytics.track('paywall_viewed', { surface: 'year_in_review' });
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    const [name, params] = mockLogEvent.mock.calls[0];
    expect(name).toBe('paywall_viewed');
    expect(params).toMatchObject({ surface: 'year_in_review' });
  });

  it('carries the session id so events can be grouped into funnels', () => {
    analytics.track('purchase_started', { product: 'deeplife_premium_monthly' });
    const [, params] = mockLogEvent.mock.calls[0];
    expect(params.session_id).toBeTruthy();
  });

  it('still drops unknown event names — the schema stays honest', () => {
    // @ts-expect-error deliberately not a member of AnalyticsEventName
    analytics.track('totally_made_up');
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('does not forward without consent', () => {
    analytics.setConsent(false);
    analytics.track('paywall_viewed');
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('forwards the whole purchase funnel, not just the first step', () => {
    analytics.track('paywall_viewed');
    analytics.track('paywall_cta_tapped');
    analytics.track('purchase_started');
    analytics.track('purchase_succeeded');
    expect(mockLogEvent.mock.calls.map((c) => c[0])).toEqual([
      'paywall_viewed',
      'paywall_cta_tapped',
      'purchase_started',
      'purchase_succeeded',
    ]);
  });

  it('never throws out of track(), whatever the sink does', () => {
    mockLogEvent.mockImplementationOnce(() => {
      throw new Error('firebase exploded');
    });
    expect(() => analytics.track('death')).not.toThrow();
  });
});
