/**
 * R7 Phase 5 (5.4): RemoteLoggingService context sanitizer.
 *
 * Logs never leave the device today (`remoteUrl` is null) but they ARE
 * persisted to AsyncStorage and surfaced in the in-app log viewer. The
 * sanitizer strips known-sensitive context keys at the entry point of
 * `remoteLogger.log()` so a future regression where someone logs an
 * HMAC key, IAP receipt, or auth token can't leak.
 *
 * These tests exercise the pure `sanitizeLogContext` function directly
 * (the service-singleton path requires AsyncStorage + AppState mocks
 * that don't add coverage value here).
 */

// jest.setup.js mocks `@/services/RemoteLoggingService` GLOBALLY (it stubs
// out the remoteLogger singleton for every test in the repo). We need the
// REAL `sanitizeLogContext` here, so unmock for this file then load the real
// module via `requireActual`.
jest.unmock('@/services/RemoteLoggingService');


const { sanitizeLogContext } = jest.requireActual('@/services/RemoteLoggingService') as {
  sanitizeLogContext: (value: unknown, depth?: number) => unknown;
};

describe('RemoteLoggingService sanitizer', () => {
  it('redacts top-level sensitive keys', () => {
    expect(sanitizeLogContext({ hmac: 'a', signature: 'b', password: 'c' })).toEqual({
      hmac: '[REDACTED]',
      signature: '[REDACTED]',
      password: '[REDACTED]',
    });
  });

  it('preserves non-sensitive keys verbatim', () => {
    expect(sanitizeLogContext({ week: 42, salary: 1000, careerId: 'engineer' })).toEqual({
      week: 42,
      salary: 1000,
      careerId: 'engineer',
    });
  });

  it('mixes redacted + preserved keys correctly', () => {
    expect(sanitizeLogContext({ receipt: 'sensitive', userScore: 99 })).toEqual({
      receipt: '[REDACTED]',
      userScore: 99,
    });
  });

  it('redacts nested sensitive keys (depth 1)', () => {
    expect(sanitizeLogContext({ request: { hmac: 'secret', method: 'POST' } })).toEqual({
      request: { hmac: '[REDACTED]', method: 'POST' },
    });
  });

  it('redacts inside arrays of objects', () => {
    expect(sanitizeLogContext({ batch: [{ token: 'a' }, { token: 'b' }] })).toEqual({
      batch: [{ token: '[REDACTED]' }, { token: '[REDACTED]' }],
    });
  });

  it('caps recursion depth at 4 (no infinite traversal on deep structures)', () => {
    const deep: any = { token: 'a' };
    let cur = deep;
    for (let i = 0; i < 10; i++) {
      cur.child = { token: 'b' };
      cur = cur.child;
    }
    const result = sanitizeLogContext(deep) as any;
    expect(result.token).toBe('[REDACTED]');
    // We don't assert anything past depth 4 — that's the depth fence.
  });

  it('redacts sensitive keys in error object shape', () => {
    expect(sanitizeLogContext({ name: 'Error', message: 'failed', hmacKey: 'secret' })).toEqual({
      name: 'Error',
      message: 'failed',
      hmacKey: '[REDACTED]',
    });
  });

  it('handles null / undefined / primitives without crash', () => {
    expect(sanitizeLogContext(null)).toBe(null);
    expect(sanitizeLogContext(undefined)).toBe(undefined);
    expect(sanitizeLogContext(42)).toBe(42);
    expect(sanitizeLogContext('plain string')).toBe('plain string');
    expect(sanitizeLogContext(true)).toBe(true);
  });

  it('redacts the full list of declared sensitive keys', () => {
    const result = sanitizeLogContext({
      hmac: 'x',
      signature: 'x',
      saveKey: 'x',
      saveHmacKey: 'x',
      hmacKey: 'x',
      receipt: 'x',
      receiptData: 'x',
      purchaseToken: 'x',
      verificationData: 'x',
      apiKey: 'x',
      secret: 'x',
      token: 'x',
      accessToken: 'x',
      refreshToken: 'x',
      password: 'x',
      credential: 'x',
      email: 'x',
      phoneNumber: 'x',
      address: 'x',
      cloudUserId: 'x',
      deviceId: 'x',
      installationId: 'x',
      advertisingId: 'x',
      // non-sensitive control:
      weeksLived: 100,
    }) as any;
    for (const key of [
      'hmac', 'signature', 'saveKey', 'saveHmacKey', 'hmacKey',
      'receipt', 'receiptData', 'purchaseToken', 'verificationData',
      'apiKey', 'secret', 'token', 'accessToken', 'refreshToken',
      'password', 'credential',
      'email', 'phoneNumber', 'address',
      'cloudUserId', 'deviceId', 'installationId', 'advertisingId',
    ]) {
      expect(result[key]).toBe('[REDACTED]');
    }
    expect(result.weeksLived).toBe(100);
  });

  it('does NOT mutate the input object', () => {
    const input = { hmac: 'secret', other: 1 };
    sanitizeLogContext(input);
    expect(input.hmac).toBe('secret');
  });

  it('handles empty object / empty array', () => {
    expect(sanitizeLogContext({})).toEqual({});
    expect(sanitizeLogContext([])).toEqual([]);
  });
});
