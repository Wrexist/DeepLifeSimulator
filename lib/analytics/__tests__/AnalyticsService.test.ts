import { analytics } from '../AnalyticsService';
import { isKnownAnalyticsEvent } from '../events';

const OK_FETCH = () =>
  jest.fn().mockResolvedValue({ ok: true } as Partial<Response>);

/** Drain any queued events so each test starts from zero. */
async function drain(): Promise<void> {
  analytics.configure({ enabled: true, consent: true, endpoint: 'https://drain.test', installId: 'drain' });
  (global as any).fetch = OK_FETCH();
  let guard = 0;
  while (analytics.getPendingCount() > 0 && guard < 10) {
    await analytics.flush();
    guard += 1;
  }
}

describe('AnalyticsService', () => {
  beforeEach(async () => {
    await drain();
    analytics.shutdown();
    jest.clearAllMocks();
  });

  describe('gating', () => {
    it('is a no-op when disabled', () => {
      analytics.configure({ enabled: false, consent: true, endpoint: 'https://x.test' });
      analytics.track('week_advanced', { weeksLived: 5 });
      expect(analytics.getPendingCount()).toBe(0);
    });

    it('is a no-op when enabled but consent not granted', () => {
      analytics.configure({ enabled: true, consent: false, endpoint: 'https://x.test' });
      analytics.track('week_advanced', { weeksLived: 5 });
      expect(analytics.getPendingCount()).toBe(0);
    });

    it('records when enabled AND consented', () => {
      analytics.configure({ enabled: true, consent: true, endpoint: 'https://x.test' });
      analytics.track('week_advanced', { weeksLived: 5 });
      expect(analytics.getPendingCount()).toBe(1);
    });

    it('setConsent(false) re-gates tracking', () => {
      analytics.configure({ enabled: true, consent: true, endpoint: 'https://x.test' });
      analytics.setConsent(false);
      analytics.track('death', {});
      expect(analytics.getPendingCount()).toBe(0);
    });
  });

  describe('schema validation', () => {
    it('drops unknown event names', () => {
      analytics.configure({ enabled: true, consent: true, endpoint: 'https://x.test' });
      // @ts-expect-error — intentionally invalid name
      analytics.track('totally_made_up', {});
      expect(analytics.getPendingCount()).toBe(0);
    });

    it('isKnownAnalyticsEvent guards the catalogue', () => {
      expect(isKnownAnalyticsEvent('purchase_succeeded')).toBe(true);
      expect(isKnownAnalyticsEvent('nope')).toBe(false);
    });
  });

  describe('flush / transport', () => {
    it('POSTs a batch and clears the queue on success', async () => {
      const fetchMock = OK_FETCH();
      (global as any).fetch = fetchMock;
      analytics.configure({ enabled: true, consent: true, endpoint: 'https://send.test', installId: 'abc' });

      analytics.track('session_start', {});
      analytics.track('week_advanced', { weeksLived: 1 });
      await analytics.flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://send.test');
      const body = JSON.parse((opts as RequestInit).body as string);
      expect(body.events).toHaveLength(2);
      expect(body.events[0].installId).toBe('abc');
      expect(analytics.getPendingCount()).toBe(0);
    });

    it('keeps the queue and never throws when fetch rejects', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
      (global as any).fetch = fetchMock;
      analytics.configure({ enabled: true, consent: true, endpoint: 'https://fail.test' });

      analytics.track('challenge_completed', { tier: 'hard' });
      await expect(analytics.flush()).resolves.toBeUndefined();
      expect(analytics.getPendingCount()).toBe(1);
    });

    it('does not call fetch when there is no endpoint', async () => {
      const fetchMock = OK_FETCH();
      (global as any).fetch = fetchMock;
      analytics.configure({ enabled: true, consent: true, endpoint: null });

      analytics.track('paywall_viewed', {});
      await analytics.flush();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(analytics.getPendingCount()).toBe(1);
    });
  });

  describe('privacy', () => {
    it('redacts sensitive prop keys before transport', async () => {
      const fetchMock = OK_FETCH();
      (global as any).fetch = fetchMock;
      analytics.configure({ enabled: true, consent: true, endpoint: 'https://priv.test' });

      analytics.track('purchase_succeeded', {
        email: 'player@example.com',
        receipt: 'SECRET-RECEIPT',
        sku: 'gems_1000',
      });
      await analytics.flush();

      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      const props = body.events[0].props;
      expect(props.email).toBe('[REDACTED]');
      expect(props.receipt).toBe('[REDACTED]');
      expect(props.sku).toBe('gems_1000'); // non-sensitive passes through
    });
  });
});
