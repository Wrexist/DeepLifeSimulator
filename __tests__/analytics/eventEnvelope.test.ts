/**
 * The common envelope, end to end through `track()`.
 *
 * WHAT THIS PROTECTS. Before the envelope existed, an event carried its name, a
 * timestamp and two ids — enough to count events and nothing more. A regression
 * in 2.9.0 and one in 2.8.1 landed in the same bucket, an iOS-only funnel drop
 * looked global, and an experiment could not be read without a join back to an
 * exposure table. These tests pin that every accepted event carries the four
 * fields that answer those questions, and that BOTH sinks agree about what
 * leaves the device.
 */
import { analytics } from '@/lib/analytics/AnalyticsService';
import { experiments } from '@/lib/analytics/ExperimentService';
import type { AnalyticsEvent } from '@/lib/analytics/events';
import { ANALYTICS_SCHEMA_VERSION } from '@/lib/analytics/context';
import { REDACTED } from '@/lib/analytics/validation';
import type { ExperimentDefinition } from '@/lib/analytics/experiments';

const mockLogEvent = jest.fn();
jest.mock('@/services/FirebaseAnalyticsService', () => ({
  firebaseAnalyticsService: {
    logEvent: (...args: unknown[]) => mockLogEvent(...args),
    initialize: jest.fn(),
    setConsent: jest.fn(),
  },
}));

jest.mock('@/lib/config/featureFlags', () => ({
  FEATURE_FLAGS: { firebaseAnalytics: true, telemetry: true },
}));

const experiment: ExperimentDefinition = {
  id: 'envelope_fixture',
  hypothesis: 'h',
  primaryMetric: 'purchase_succeeded',
  secondaryMetrics: [],
  guardrailMetrics: ['retention_day'],
  minimumSamplePerVariant: 100,
  decisionRule: 'ship on win',
  enabled: true,
  variants: [
    { id: 'control', weight: 1 },
    { id: 'treatment', weight: 1 },
  ],
};

/** Capture whatever the transport POSTs, so assertions run on the real payload. */
function captureFetch(): { sent: AnalyticsEvent[] } {
  const sent: AnalyticsEvent[] = [];
  const fetchMock = jest.fn(async (_url: string, init?: { body?: string }) => {
    if (init?.body) sent.push(...(JSON.parse(init.body).events as AnalyticsEvent[]));
    return { ok: true } as Response;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { sent };
}

async function drain(): Promise<AnalyticsEvent[]> {
  const { sent } = captureFetch();
  let guard = 0;
  while (analytics.getPendingCount() > 0 && guard < 10) {
    await analytics.flush();
    guard += 1;
  }
  return sent;
}

describe('the common envelope', () => {
  beforeEach(async () => {
    analytics.configure({ enabled: true, consent: true, endpoint: 'https://x.test', installId: 'install-fixture' });
    await drain();
    analytics.shutdown();
    mockLogEvent.mockClear();
    experiments.configure({ installId: 'install-fixture', registry: [], assignments: {} });
  });

  it('every queued event carries the envelope', async () => {
    analytics.track('week_advanced', { weeksLived: 5 });
    analytics.track('death', { age: 80 });
    const sent = await drain();

    expect(sent).toHaveLength(2);
    for (const event of sent) {
      expect(event.ctx).toBeDefined();
      expect(event.ctx?.schemaVersion).toBe(ANALYTICS_SCHEMA_VERSION);
      // The values themselves depend on the host (expo-constants is absent in
      // the node test environment, which is itself the degradation contract:
      // 'unknown', never a throw and never a dropped event).
      expect(typeof event.ctx?.appVersion).toBe('string');
      expect(typeof event.ctx?.buildNumber).toBe('string');
      expect(typeof event.ctx?.platform).toBe('string');
      expect(typeof event.ctx?.osMajor).toBe('string');
    }
  });

  it('each event gets its OWN envelope object, not a shared reference', async () => {
    // One shared object referenced by every queued event would let a single
    // consumer mutating it rewrite the envelope of the whole batch.
    analytics.track('week_advanced', { weeksLived: 1 });
    analytics.track('week_advanced', { weeksLived: 2 });
    const sent = await drain();
    expect(sent[0].ctx).not.toBe(sent[1].ctx);
  });

  it('carries experiment arms on EVERY event, not just on exposure', async () => {
    // This is what makes any metric splittable by arm with a filter instead of
    // a join — the difference between a readout taking a minute and a day.
    experiments.configure({
      installId: 'install-fixture',
      registry: [experiment],
      assignments: { envelope_fixture: 'treatment' },
    });
    analytics.track('week_advanced', { weeksLived: 3 });
    const sent = await drain();
    expect(sent[0].ctx?.experiments).toBe('envelope_fixture:treatment');
  });

  it('omits the experiments key entirely when nothing is running', async () => {
    analytics.track('week_advanced', { weeksLived: 3 });
    const sent = await drain();
    expect(sent[0].ctx?.experiments).toBeUndefined();
  });
});

describe('both sinks agree about what leaves the device', () => {
  beforeEach(async () => {
    analytics.configure({ enabled: true, consent: true, endpoint: 'https://x.test', installId: 'install-fixture' });
    await drain();
    analytics.shutdown();
    mockLogEvent.mockClear();
    experiments.configure({ installId: 'install-fixture', registry: [], assignments: {} });
  });

  it('scrubs sensitive properties on the FIREBASE path too', async () => {
    // The bug this closes: scrubbing used to happen only on the way into the
    // self-hosted queue, so the Firebase fan-out forwarded the caller's raw
    // property bag. There is no reading of that split where the looser one is
    // right.
    analytics.track('purchase_succeeded', { receipt: 'RAW-RECEIPT-DATA', productId: 'plus_monthly' });

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    const params = mockLogEvent.mock.calls[0][1] as Record<string, unknown>;
    expect(params.receipt).toBe(REDACTED);
    expect(params.productId).toBe('plus_monthly');

    const sent = await drain();
    expect(sent[0].props?.receipt).toBe(REDACTED);
  });

  it('prefixes envelope fields on Firebase so they cannot collide with game props', async () => {
    // `platform` is a plausible name for both an envelope field and a game
    // property; the prefix is what keeps one from overwriting the other.
    analytics.track('session_start', { platform: 'in-game-value' });
    const params = mockLogEvent.mock.calls[0][1] as Record<string, unknown>;
    expect(params.platform).toBe('in-game-value');
    expect(params.ctx_platform).toBeDefined();
    expect(params.ctx_schema_version).toBe(ANALYTICS_SCHEMA_VERSION);
  });

  it('drops a NaN property before EITHER sink sees it', async () => {
    // NaN serialises to `null`, which reads downstream as a measured value.
    analytics.track('economy_week', { netWorth: NaN, money: 100 });
    const params = mockLogEvent.mock.calls[0][1] as Record<string, unknown>;
    expect('netWorth' in params).toBe(false);
    expect(params.money).toBe(100);

    const sent = await drain();
    expect(sent[0].props).toEqual({ money: 100 });
  });
});

describe('de-duplication inside track()', () => {
  beforeEach(async () => {
    analytics.configure({ enabled: true, consent: true, endpoint: 'https://x.test', installId: 'install-fixture' });
    await drain();
    analytics.shutdown();
    mockLogEvent.mockClear();
    experiments.configure({ installId: 'install-fixture', registry: [], assignments: {} });
  });

  it('collapses a re-rendered screen_view', async () => {
    analytics.track('screen_view', { path: '/home' });
    analytics.track('screen_view', { path: '/home' });
    analytics.track('screen_view', { path: '/home' });
    expect(analytics.getPendingCount()).toBe(1);
  });

  it('does NOT collapse a repeated reward, in either sink', async () => {
    // A second identical `ad_rewarded` is the double-grant bug this telemetry
    // exists to catch; suppressing it would delete the evidence.
    analytics.track('ad_rewarded', { amount: 100 });
    analytics.track('ad_rewarded', { amount: 100 });
    expect(analytics.getPendingCount()).toBe(2);
    expect(mockLogEvent).toHaveBeenCalledTimes(2);
  });
});
