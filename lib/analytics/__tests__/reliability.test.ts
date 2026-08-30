import {
  classifySaveFailure,
  SAVE_FAILURE_CATEGORIES,
  trackSaveFailure,
  trackSaveRepaired,
  trackStartupDuration,
} from '../reliability';

/**
 * The transport is stubbed so these tests assert what is SENT, which is the
 * whole point: the privacy contract here ("a category, never the message") is
 * only meaningful if it is checked on the outgoing payload.
 *
 * `mock`-prefixed, because a `jest.mock` factory is hoisted above the imports
 * and may only reference out-of-scope bindings whose names begin with `mock`.
 */
const mockTracked: { name: string; props?: Record<string, unknown> }[] = [];
jest.mock('../AnalyticsService', () => ({
  track: (name: string, props?: Record<string, unknown>) => {
    mockTracked.push({ name, props });
  },
}));

describe('classifySaveFailure', () => {
  it('recognises a full device across platform spellings', () => {
    // The same condition surfaces three different ways; a strict matcher would
    // file two of them as `unknown`, which is the bucket that tells you nothing.
    expect(classifySaveFailure(new Error('QuotaExceededError'))).toBe('quota');
    expect(classifySaveFailure(new Error('database or disk is full'))).toBe('quota');
    expect(classifySaveFailure('ENOSPC: no space left on device')).toBe('quota');
  });

  it('recognises unreadable data', () => {
    expect(classifySaveFailure(new SyntaxError('Unexpected token < in JSON'))).toBe('corruption');
    expect(classifySaveFailure(new Error('CRC checksum mismatch'))).toBe('corruption');
  });

  it('recognises a rejected write', () => {
    expect(classifySaveFailure(new Error('EACCES: permission denied'))).toBe('permission');
  });

  it('falls back to unknown for anything it cannot place', () => {
    expect(classifySaveFailure(new Error('something odd'))).toBe('unknown');
    expect(classifySaveFailure(null)).toBe('unknown');
    expect(classifySaveFailure(undefined)).toBe('unknown');
    expect(classifySaveFailure({})).toBe('unknown');
    expect(classifySaveFailure(42)).toBe('unknown');
  });

  it('only ever returns a declared category', () => {
    const declared = new Set<string>(SAVE_FAILURE_CATEGORIES);
    for (const input of [new Error('x'), 'quota', null, {}, Symbol('s')]) {
      expect(declared.has(classifySaveFailure(input))).toBe(true);
    }
  });
});

describe('trackSaveFailure', () => {
  beforeEach(() => {
    mockTracked.length = 0;
  });

  it('sends a CATEGORY, never the error text', () => {
    // An error message can quote the save it failed on, which is the player's
    // own data — and free text fragments into one-row buckets.
    trackSaveFailure(new Error('QuotaExceededError: user "Alex" slot data'), 2, 3);
    expect(mockTracked).toHaveLength(1);
    expect(mockTracked[0].name).toBe('save_failed');
    expect(mockTracked[0].props).toEqual({ category: 'quota', slot: 2, attempts: 3 });
    expect(JSON.stringify(mockTracked[0])).not.toContain('Alex');
  });
});

describe('trackSaveRepaired', () => {
  beforeEach(() => {
    mockTracked.length = 0;
  });

  it('sends the count and the save version, never the field list', () => {
    trackSaveRepaired(3, 48);
    expect(mockTracked[0]).toEqual({ name: 'save_repaired', props: { repairs: 3, saveVersion: 48 } });
  });

  it('omits an absent version and normalises a bad count', () => {
    trackSaveRepaired(NaN);
    expect(mockTracked[0].props).toEqual({ repairs: 0 });
  });
});

describe('trackStartupDuration', () => {
  beforeEach(() => {
    mockTracked.length = 0;
  });

  it('reports a rounded duration', () => {
    trackStartupDuration(1234.6);
    expect(mockTracked[0]).toEqual({ name: 'app_startup', props: { durationMs: 1235 } });
  });

  it('REFUSES a nonsense duration rather than sending it', () => {
    // A clock that moved between the two reads produces a negative figure, and
    // one negative outlier in a mean is worse than a missing row.
    trackStartupDuration(-5);
    trackStartupDuration(NaN);
    trackStartupDuration(Infinity);
    expect(mockTracked).toHaveLength(0);
  });
});
