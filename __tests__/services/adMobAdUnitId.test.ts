/**
 * L2 launch-blocker regression — a production AdMob build must NEVER fall back
 * to Google TEST ad-unit IDs when the EXPO_PUBLIC_ADMOB_* env vars are unset.
 * Serving test ads in production is a store-policy violation and earns $0.
 * `resolveAdUnitId` returns '' in production for an unset/empty value; real IDs
 * come only from the configured env vars. (Dev keeps the test-ID fallback.)
 */
import { resolveAdUnitId } from '@/services/AdMobService';

const TEST_ID = 'ca-app-pub-3940256099942544/2934735716'; // a Google sample/test unit
const REAL_ID = 'ca-app-pub-1234567890123456/1111111111';

describe('resolveAdUnitId — production never serves Google test ads', () => {
  it('production + unset env → "" (no ad), NOT the Google test ID', () => {
    expect(resolveAdUnitId(undefined, TEST_ID, false)).toBe('');
  });

  it('production + empty-string env → "" (no ad)', () => {
    expect(resolveAdUnitId('', TEST_ID, false)).toBe('');
  });

  it('production + configured env → the real configured ID', () => {
    expect(resolveAdUnitId(REAL_ID, TEST_ID, false)).toBe(REAL_ID);
  });

  it('development + unset env → the Google test ID (dev/test builds still show ads)', () => {
    expect(resolveAdUnitId(undefined, TEST_ID, true)).toBe(TEST_ID);
  });

  it('development + configured env → the real configured ID (env always wins)', () => {
    expect(resolveAdUnitId(REAL_ID, TEST_ID, true)).toBe(REAL_ID);
  });
});
