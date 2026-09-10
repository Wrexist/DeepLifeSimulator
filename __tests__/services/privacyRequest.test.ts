import { buildPrivacyRequest, privacyRequestMailUrl } from '@/utils/privacyRequest';

describe('minimal privacy request', () => {
  afterEach(() => jest.useRealTimers());

  it('includes available provider IDs in a reviewable draft, without diagnostics', async () => {
    const body = await buildPrivacyRequest({
      purchases: async () => '$RCAnonymousID:test-private',
      analytics: async () => 'test-instance',
    });
    expect(body).toContain('RevenueCat App User ID: $RCAnonymousID:test-private');
    expect(body).toContain('Firebase app instance ID: test-instance');
    expect(body).toContain('does not itself delete local saves or cancel store subscriptions');
    const url = privacyRequestMailUrl(body);
    expect(decodeURIComponent(url.split('&body=')[1])).toBe(body);
    expect(body).not.toMatch(/STATE VALIDATION|RECENT LOGS|money|receipt/i);
  });

  it('keeps support available when one provider fails and another has no ID', async () => {
    const body = await buildPrivacyRequest({
      purchases: async () => { throw new Error('private native error'); },
      analytics: async () => null,
    });
    expect(body.match(/Unavailable on this device\/session/g)).toHaveLength(2);
    expect(body).toContain('do not mean that no data exists');
    expect(body).not.toContain('private native error');
  });

  it('bounds a stalled native read without losing the other ID', async () => {
    jest.useFakeTimers();
    const result = buildPrivacyRequest({
      purchases: () => new Promise(() => {}), analytics: async () => 'available',
    });
    await jest.advanceTimersByTimeAsync(4000);
    expect(await result).toContain('Firebase app instance ID: available');
    expect(await result).toContain('RevenueCat App User ID: Unavailable');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects malformed identifiers rather than injecting extra request fields', async () => {
    const body = await buildPrivacyRequest({
      purchases: async () => 'id\nextra: injected', analytics: async () => 'a'.repeat(257),
    });
    expect(body).not.toContain('injected');
    expect(body.match(/Unavailable on this device\/session/g)).toHaveLength(2);
  });
});
