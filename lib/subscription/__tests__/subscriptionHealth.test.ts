/**
 * The subscription phase machine - every branch, and the precedence rules.
 *
 * The input is a raw customerInfo off the RevenueCat SDK, so malformed-input
 * tolerance is a first-class case, not an afterthought: a parser that throws
 * here takes AnalyticsTracker's mount effect down with it.
 */
import {
  readSubscriptionHealth,
  isActivePhase,
} from '@/lib/subscription/subscriptionHealth';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

/** customerInfo with one active `premium` entitlement carrying `fields`. */
function activeInfo(fields: Record<string, unknown>): unknown {
  return { entitlements: { active: { premium: fields }, all: { premium: fields } } };
}

const inTenDays = new Date(NOW + 10 * DAY).toISOString();

describe('readSubscriptionHealth phases', () => {
  it('none: empty, junk, or missing records', () => {
    expect(readSubscriptionHealth(undefined, NOW).phase).toBe('none');
    expect(readSubscriptionHealth(null, NOW).phase).toBe('none');
    expect(readSubscriptionHealth({}, NOW).phase).toBe('none');
    expect(readSubscriptionHealth('garbage', NOW).phase).toBe('none');
    expect(readSubscriptionHealth({ entitlements: 42 }, NOW).phase).toBe('none');
  });

  it('renewing: active, expiring, auto-renew on', () => {
    const h = readSubscriptionHealth(
      activeInfo({ willRenew: true, expirationDate: inTenDays, periodType: 'NORMAL', productIdentifier: 'dlp_monthly' }),
      NOW,
    );
    expect(h.phase).toBe('renewing');
    expect(h.daysUntilExpiry).toBe(10);
    expect(h.productId).toBe('dlp_monthly');
  });

  it('cancelling: willRenew false - THE win-back window', () => {
    const h = readSubscriptionHealth(
      activeInfo({ willRenew: false, expirationDate: inTenDays, periodType: 'NORMAL' }),
      NOW,
    );
    expect(h.phase).toBe('cancelling');
    expect(h.daysUntilExpiry).toBe(10);
  });

  it('cancelling: unsubscribeDetectedAt catches a lagging willRenew flag', () => {
    const h = readSubscriptionHealth(
      activeInfo({ willRenew: true, unsubscribeDetectedAt: new Date(NOW - DAY).toISOString(), expirationDate: inTenDays }),
      NOW,
    );
    expect(h.phase).toBe('cancelling');
  });

  it('billing_issue outranks cancelling - the player may not KNOW access is at risk', () => {
    const h = readSubscriptionHealth(
      activeInfo({
        willRenew: false,
        billingIssueDetectedAt: new Date(NOW - DAY).toISOString(),
        expirationDate: inTenDays,
      }),
      NOW,
    );
    expect(h.phase).toBe('billing_issue');
  });

  it('trial and intro read off periodType; a cancelled trial reads cancelling', () => {
    expect(readSubscriptionHealth(activeInfo({ willRenew: true, expirationDate: inTenDays, periodType: 'TRIAL' }), NOW).phase).toBe('trial');
    expect(readSubscriptionHealth(activeInfo({ willRenew: true, expirationDate: inTenDays, periodType: 'INTRO' }), NOW).phase).toBe('intro');
    expect(readSubscriptionHealth(activeInfo({ willRenew: false, expirationDate: inTenDays, periodType: 'TRIAL' }), NOW).phase).toBe('cancelling');
  });

  it('lifetime: active with no expiration - renewal is moot', () => {
    const h = readSubscriptionHealth(activeInfo({ productIdentifier: 'lifetime_premium' }), NOW);
    expect(h.phase).toBe('lifetime');
    expect(h.expiresAt).toBeUndefined();
  });

  it('lapsed: had it once (entitlements.all), not active now', () => {
    const info = {
      entitlements: {
        active: {},
        all: { premium: { expirationDate: new Date(NOW - 5 * DAY).toISOString(), productIdentifier: 'dlp_monthly' } },
      },
    };
    const h = readSubscriptionHealth(info, NOW);
    expect(h.phase).toBe('lapsed');
    expect(h.productId).toBe('dlp_monthly');
  });

  it('honors the configured entitlement keys (RC_ENTITLEMENT_PRO override)', () => {
    const info = { entitlements: { active: { pro_tier: { willRenew: true, expirationDate: inTenDays } }, all: {} } };
    expect(readSubscriptionHealth(info, NOW).phase).toBe('none');
    expect(readSubscriptionHealth(info, NOW, ['premium', 'pro_tier']).phase).toBe('renewing');
  });

  it('daysUntilExpiry floors at zero for an already-past date on an active record', () => {
    const h = readSubscriptionHealth(
      activeInfo({ willRenew: true, expirationDate: new Date(NOW - DAY).toISOString() }),
      NOW,
    );
    expect(h.daysUntilExpiry).toBe(0);
  });
});

describe('isActivePhase', () => {
  it('splits entitled from not-entitled exactly', () => {
    for (const p of ['trial', 'intro', 'renewing', 'cancelling', 'billing_issue', 'lifetime'] as const) {
      expect(isActivePhase(p)).toBe(true);
    }
    for (const p of ['none', 'lapsed'] as const) {
      expect(isActivePhase(p)).toBe(false);
    }
  });
});
