/**
 * `trackSessionStart` is the only sanctioned way to emit a session.
 *
 * It exists so that "fold this launch into the cohort, then emit" has a single
 * enforceable home. A bare `track('session_start', …)` compiles fine and
 * produces a session with no day index — which is the state that made
 * D1/D7/D30 uncomputable from this funnel in the first place.
 */
import { analytics } from '@/lib/analytics/AnalyticsService';

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

const eventsNamed = (name: string) =>
  mockLogEvent.mock.calls.filter((call) => call[0] === name);

describe('trackSessionStart', () => {
  // ORDER MATTERS: `init()` before `configure()`. `configure()` sets
  // `initialized = true`, so calling it first makes `init()` early-return and
  // the cohort is never loaded — the service then reports sessions with no
  // cohort at all. That is the CORRECT production degradation (a null cohort
  // must not be replaced with an ephemeral one, or a device with broken
  // storage would mint a fresh day-0 record every launch and inflate the
  // cohort denominator), so the ordering is the test's job to get right.
  beforeAll(async () => {
    await analytics.init();
    analytics.configure({ enabled: false, endpoint: null, consent: true, installId: 'test' });
  });

  beforeEach(() => {
    mockLogEvent.mockClear();
  });

  it('loads a cohort during init', () => {
    // The control for everything below: without this, the cohort assertions
    // could pass vacuously on a service that never loaded one.
    expect(analytics.getCohort()).not.toBeNull();
  });

  it('attaches the cohort to session_start, and opens the day', () => {
    analytics.trackSessionStart({ platform: 'ios' });

    const [session] = eventsNamed('session_start');
    expect(session).toBeDefined();
    const props = session[1] as Record<string, unknown>;
    expect(props.platform).toBe('ios');
    expect(props.dayIndex).toBe(0);
    expect(props.daysSeen).toBe(1);
    expect(props.sessions).toBe(1);
    expect(typeof props.anchorEstimated).toBe('boolean');

    // First session of a new day index → the once-per-day event fires too.
    const [day] = eventsNamed('retention_day');
    expect(day).toBeDefined();
    expect((day[1] as Record<string, unknown>).dayIndex).toBe(0);
  });

  it('counts a second launch as a session without re-opening the day', () => {
    // Otherwise "installs that returned on day N" would double-count anyone
    // who opened the app twice, which is most of them.
    analytics.trackSessionStart();
    const [session] = eventsNamed('session_start');
    expect((session[1] as Record<string, unknown>).sessions).toBe(2);
    expect((session[1] as Record<string, unknown>).daysSeen).toBe(1);
    expect(eventsNamed('retention_day')).toHaveLength(0);
  });

  it('never throws', () => {
    expect(() => analytics.trackSessionStart()).not.toThrow();
  });
});
