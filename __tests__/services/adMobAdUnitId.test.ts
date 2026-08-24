/**
 * L2 launch-blocker regression — a production AdMob build must NEVER fall back
 * to Google TEST ad-unit IDs when the EXPO_PUBLIC_ADMOB_* env vars are unset.
 * Serving test ads in production is a store-policy violation and earns $0.
 *
 * `resolveAdUnitId` resolves with three-tier priority: configured env value →
 * (dev only) Google TEST id → committed real production default (or '' when a
 * slot has none). A production build therefore serves either a real configured
 * ID, a real committed default, or no ad — never a Google test ad.
 */
import { resolveAdUnitId } from '@/services/AdMobService';

const TEST_ID = 'ca-app-pub-3940256099942544/2934735716'; // a Google sample/test unit
const REAL_ID = 'ca-app-pub-1234567890123456/1111111111';
const PROD_DEFAULT = 'ca-app-pub-2286247955186424/8520540300'; // a real committed default

describe('resolveAdUnitId - production never serves Google test ads', () => {
  it('production + unset env + no prod default → "" (no ad), NOT the Google test ID', () => {
    expect(resolveAdUnitId(undefined, TEST_ID, false)).toBe('');
  });

  it('production + empty-string env + no prod default → "" (no ad)', () => {
    expect(resolveAdUnitId('', TEST_ID, false)).toBe('');
  });

  it('production + whitespace-only env + no prod default → "" (no ad)', () => {
    expect(resolveAdUnitId('   ', TEST_ID, false)).toBe('');
  });

  it('production + configured env → the real configured ID', () => {
    expect(resolveAdUnitId(REAL_ID, TEST_ID, false)).toBe(REAL_ID);
  });

  it('production + unset env + committed prod default → the prod default (real, never test)', () => {
    const resolved = resolveAdUnitId(undefined, TEST_ID, false, PROD_DEFAULT);
    expect(resolved).toBe(PROD_DEFAULT);
    expect(resolved).not.toBe(TEST_ID);
  });

  it('production + configured env overrides the committed prod default', () => {
    expect(resolveAdUnitId(REAL_ID, TEST_ID, false, PROD_DEFAULT)).toBe(REAL_ID);
  });

  it('development + unset env → the Google test ID (dev/test builds still show ads)', () => {
    expect(resolveAdUnitId(undefined, TEST_ID, true)).toBe(TEST_ID);
  });

  it('development + unset env ignores the prod default (dev keeps the test ID)', () => {
    expect(resolveAdUnitId(undefined, TEST_ID, true, PROD_DEFAULT)).toBe(TEST_ID);
  });

  it('development + configured env → the real configured ID (env always wins)', () => {
    expect(resolveAdUnitId(REAL_ID, TEST_ID, true)).toBe(REAL_ID);
  });
});
