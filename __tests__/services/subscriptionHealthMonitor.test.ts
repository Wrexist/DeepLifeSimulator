/**
 * The monitor's edge detection - the four moments that make renewals visible.
 *
 * `subscription_cancel_detected` is the churn signal; `subscription_recovered`
 * is the number the win-back effort is judged by. Both are diffs against a
 * device-local latch, so the suite drives the monitor through sequences of
 * observed customerInfo states and asserts exactly which events fire.
 */
import {
  checkSubscriptionHealth,
  __resetSubscriptionHealthMonitorForTests,
  lastObservedSubscriptionHealth,
} from '@/services/subscriptionHealthMonitor';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));

let storage: Record<string, string> = {};
jest.mock('@/utils/safeStorage', () => ({
  safeGetItem: jest.fn(async (k: string) => storage[k] ?? null),
  safeSetItem: jest.fn(async (k: string, v: string) => { storage[k] = v; }),
}));

let rcEnabled = true;
let rcInfo: unknown = null;
jest.mock('@/services/RevenueCatService', () => ({
  RC_ENTITLEMENT_PREMIUM: 'premium',
  RC_ENTITLEMENT_PRO: 'premium',
  revenueCatService: {
    isEnabled: () => rcEnabled,
    getCustomerInfoSnapshot: async () => rcInfo,
  },
}));

const DAY = 86_400_000;
const soon = (days: number) => new Date(Date.now() + days * DAY).toISOString();

function activeInfo(fields: Record<string, unknown>): unknown {
  return { entitlements: { active: { premium: fields }, all: { premium: fields } } };
}
const lapsedInfo = {
  entitlements: { active: {}, all: { premium: { expirationDate: soon(-3) } } },
};

/** Observe one customerInfo as a fresh session. */
async function observe(info: unknown): Promise<void> {
  __resetSubscriptionHealthMonitorForTests();
  rcInfo = info;
  await checkSubscriptionHealth();
}

const firedNames = () => mockTrack.mock.calls.map((c) => c[0]);

beforeEach(() => {
  storage = {};
  rcEnabled = true;
  rcInfo = null;
  mockTrack.mockClear();
  __resetSubscriptionHealthMonitorForTests();
});

describe('gating', () => {
  it('does nothing on non-RevenueCat builds', async () => {
    rcEnabled = false;
    await checkSubscriptionHealth();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('is idempotent within a session - the second call emits nothing', async () => {
    rcInfo = activeInfo({ willRenew: true, expirationDate: soon(10) });
    await checkSubscriptionHealth();
    const callsAfterFirst = mockTrack.mock.calls.length;
    await checkSubscriptionHealth();
    expect(mockTrack.mock.calls.length).toBe(callsAfterFirst);
  });

  it('a failed fetch says nothing AND leaves the latch alone', async () => {
    // First session: healthy renewing subscriber.
    await observe(activeInfo({ willRenew: true, expirationDate: soon(10) }));
    mockTrack.mockClear();
    // Second session: offline (snapshot null). No events, latch untouched...
    await observe(null);
    expect(mockTrack).not.toHaveBeenCalled();
    // ...so a third, successful session diffs against RENEWING, not a blank.
    await observe(activeInfo({ willRenew: false, expirationDate: soon(9) }));
    expect(firedNames()).toContain('subscription_cancel_detected');
    expect(firedNames()).not.toContain('subscription_lapsed');
  });

  it('never-subscribed players emit nothing at all', async () => {
    await observe({ entitlements: { active: {}, all: {} } });
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

describe('the edges', () => {
  it('renewing → cancelling fires subscription_cancel_detected', async () => {
    await observe(activeInfo({ willRenew: true, expirationDate: soon(10) }));
    mockTrack.mockClear();
    await observe(activeInfo({ willRenew: false, expirationDate: soon(9) }));
    expect(firedNames()).toEqual(
      expect.arrayContaining(['subscription_cancel_detected', 'subscription_state']),
    );
    const props = mockTrack.mock.calls.find((c) => c[0] === 'subscription_cancel_detected')?.[1];
    expect(props).toMatchObject({ phase: 'cancelling', prevPhase: 'renewing', firstObservation: false });
  });

  it('cancelling → renewing fires subscription_recovered - the win-back worked', async () => {
    await observe(activeInfo({ willRenew: false, expirationDate: soon(9) }));
    mockTrack.mockClear();
    await observe(activeInfo({ willRenew: true, expirationDate: soon(9) }));
    expect(firedNames()).toContain('subscription_recovered');
  });

  it('an advanced expiry while active fires subscription_renewed', async () => {
    await observe(activeInfo({ willRenew: true, expirationDate: soon(2) }));
    mockTrack.mockClear();
    await observe(activeInfo({ willRenew: true, expirationDate: soon(32) }));
    expect(firedNames()).toContain('subscription_renewed');
  });

  it('active → lapsed fires subscription_lapsed', async () => {
    await observe(activeInfo({ willRenew: false, expirationDate: soon(1) }));
    mockTrack.mockClear();
    await observe(lapsedInfo);
    expect(firedNames()).toContain('subscription_lapsed');
  });

  it('a stable renewing subscriber emits ONLY the state snapshot', async () => {
    await observe(activeInfo({ willRenew: true, expirationDate: soon(10) }));
    mockTrack.mockClear();
    await observe(activeInfo({ willRenew: true, expirationDate: soon(9) }));
    expect(firedNames()).toEqual(['subscription_state']);
  });

  it('first-ever sighting already cancelled is still news, marked firstObservation', async () => {
    await observe(activeInfo({ willRenew: false, expirationDate: soon(5) }));
    const props = mockTrack.mock.calls.find((c) => c[0] === 'subscription_cancel_detected')?.[1];
    expect(props).toMatchObject({ firstObservation: true });
  });
});

describe('the UI read', () => {
  it('lastObservedSubscriptionHealth exposes the session parse for the win-back line', async () => {
    expect(lastObservedSubscriptionHealth()).toBeNull();
    await observe(activeInfo({ willRenew: false, expirationDate: soon(5) }));
    expect(lastObservedSubscriptionHealth()?.phase).toBe('cancelling');
  });
});
