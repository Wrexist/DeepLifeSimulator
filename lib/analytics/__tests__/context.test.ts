import { ANALYTICS_SCHEMA_VERSION, getAnalyticsContext, majorVersion, resetAnalyticsContextCache } from '../context';

describe('majorVersion', () => {
  it('keeps only the major component', () => {
    // Coarse on purpose: "26" answers "is this an OS regression", which is the
    // only question the envelope is here to answer. "26.1.1" additionally
    // narrows a user.
    expect(majorVersion('26.1.1')).toBe('26');
    expect(majorVersion('15')).toBe('15');
    expect(majorVersion(34)).toBe('34');
  });

  it('degrades to unknown rather than throwing', () => {
    expect(majorVersion(undefined)).toBe('unknown');
    expect(majorVersion(null)).toBe('unknown');
    expect(majorVersion('')).toBe('unknown');
    expect(majorVersion('beta')).toBe('unknown');
    expect(majorVersion({})).toBe('unknown');
  });
});

describe('getAnalyticsContext', () => {
  beforeEach(() => resetAnalyticsContextCache());

  it('always returns a complete, string-valued envelope', () => {
    // expo-constants is absent in the node test environment, which exercises
    // the degradation contract directly: 'unknown' everywhere, never a throw.
    const ctx = getAnalyticsContext();
    expect(ctx.schemaVersion).toBe(ANALYTICS_SCHEMA_VERSION);
    for (const key of ['appVersion', 'buildNumber', 'platform', 'osMajor'] as const) {
      expect(typeof ctx[key]).toBe('string');
      expect(ctx[key].length).toBeGreaterThan(0);
    }
  });

  it('caches, because none of these can change inside a process', () => {
    // Re-reading per event would put a native bridge call on the hot path of
    // every track() for a value that is constant by construction.
    expect(getAnalyticsContext()).toBe(getAnalyticsContext());
  });

  it('never throws', () => {
    expect(() => getAnalyticsContext()).not.toThrow();
  });
});
