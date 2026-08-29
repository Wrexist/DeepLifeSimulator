import {
  DEDUPE_WINDOW_MS,
  DuplicateSuppressor,
  MAX_PROP_KEYS,
  MAX_STRING_LENGTH,
  REDACTED,
  dedupeKey,
  sanitizeProps,
} from '../validation';

describe('sanitizeProps', () => {
  it('redacts sensitive keys rather than dropping them', () => {
    // Redaction, not removal: a leaking call site must be VISIBLE in the data
    // so it can be fixed, instead of looking like a key nobody ever set.
    const out = sanitizeProps({ receipt: 'abc', email: 'a@b.c', weeksLived: 4 });
    expect(out).toEqual({ receipt: REDACTED, email: REDACTED, weeksLived: 4 });
  });

  it('redacts player-authored free text', () => {
    const out = sanitizeProps({ playerName: 'Alex Smith', message: 'private' });
    expect(out).toEqual({ playerName: REDACTED, message: REDACTED });
  });

  it('DROPS non-finite numbers instead of sending them', () => {
    // NaN/Infinity JSON-serialise to `null`, which reads downstream as a
    // measured empty value. Absence is the honest encoding.
    const out = sanitizeProps({ a: NaN, b: Infinity, c: -Infinity, d: 0 });
    expect(out).toEqual({ d: 0 });
  });

  it('keeps zero and false, which are real measurements', () => {
    expect(sanitizeProps({ n: 0, b: false })).toEqual({ n: 0, b: false });
  });

  it('drops null and undefined', () => {
    expect(sanitizeProps({ a: null, b: undefined, c: 1 })).toEqual({ c: 1 });
  });

  it('drops values outside the declared prop contract', () => {
    const props = { obj: { x: 1 }, arr: [1, 2], fn: () => 1, ok: 'yes' };
    // The declared type is string|number|boolean; anything else would arrive
    // downstream as "[object Object]", which is worse than no column.
    expect(sanitizeProps(props as never)).toEqual({ ok: 'yes' });
  });

  it('truncates over-long strings rather than dropping the property', () => {
    const long = 'x'.repeat(MAX_STRING_LENGTH + 50);
    const out = sanitizeProps({ path: long });
    expect((out?.path as string).length).toBe(MAX_STRING_LENGTH);
  });

  it('caps the number of properties', () => {
    const props: Record<string, number> = {};
    for (let i = 0; i < MAX_PROP_KEYS + 10; i++) props[`k${i}`] = i;
    expect(Object.keys(sanitizeProps(props) ?? {}).length).toBe(MAX_PROP_KEYS);
  });

  it('returns undefined for an empty or fully-dropped bag', () => {
    expect(sanitizeProps(undefined)).toBeUndefined();
    expect(sanitizeProps({})).toBeUndefined();
    expect(sanitizeProps({ a: NaN })).toBeUndefined();
  });
});

describe('dedupeKey', () => {
  it('is stable regardless of property order', () => {
    expect(dedupeKey('screen_view', { a: 1, b: 2 })).toBe(dedupeKey('screen_view', { b: 2, a: 1 }));
  });

  it('separates different values', () => {
    expect(dedupeKey('screen_view', { path: '/a' })).not.toBe(dedupeKey('screen_view', { path: '/b' }));
  });
});

describe('DuplicateSuppressor', () => {
  it('collapses a repeated idempotent event inside the window', () => {
    const s = new DuplicateSuppressor();
    expect(s.shouldDrop('screen_view', { path: '/home' }, 1000)).toBe(false);
    expect(s.shouldDrop('screen_view', { path: '/home' }, 1100)).toBe(true);
  });

  it('lets the same event through once the window has passed', () => {
    const s = new DuplicateSuppressor();
    expect(s.shouldDrop('screen_view', { path: '/home' }, 1000)).toBe(false);
    expect(s.shouldDrop('screen_view', { path: '/home' }, 1000 + DEDUPE_WINDOW_MS)).toBe(false);
  });

  it('NEVER collapses a value-transfer event, even an identical one', () => {
    // This is the load-bearing case. A repeated `ad_rewarded` is the
    // double-grant bug class this repo keeps shipping (CLAUDE.md §4.4);
    // suppressing it would delete the only evidence of it.
    const s = new DuplicateSuppressor();
    expect(s.shouldDrop('ad_rewarded', { amount: 100 }, 1000)).toBe(false);
    expect(s.shouldDrop('ad_rewarded', { amount: 100 }, 1001)).toBe(false);
    expect(s.shouldDrop('purchase_succeeded', { productId: 'p' }, 1000)).toBe(false);
    expect(s.shouldDrop('purchase_succeeded', { productId: 'p' }, 1001)).toBe(false);
  });

  it('treats different properties as different occurrences', () => {
    const s = new DuplicateSuppressor();
    expect(s.shouldDrop('screen_view', { path: '/a' }, 1000)).toBe(false);
    expect(s.shouldDrop('screen_view', { path: '/b' }, 1000)).toBe(false);
  });

  it('is bounded — a long session cannot grow the map without limit', () => {
    const s = new DuplicateSuppressor(DEDUPE_WINDOW_MS, 4);
    // All inside one window, so nothing is swept; eviction is what bounds it.
    for (let i = 0; i < 50; i++) s.shouldDrop('screen_view', { path: `/p${i}` }, 1000);
    // The earliest entries were evicted, so the first path is accepted again.
    expect(s.shouldDrop('screen_view', { path: '/p0' }, 1000)).toBe(false);
  });

  it('a REWOUND clock cannot pin entries in the map', () => {
    const s = new DuplicateSuppressor();
    s.shouldDrop('screen_view', { path: '/home' }, 10_000);
    // Clock moved backwards. The stale entry is swept rather than suppressing
    // every future event for the rest of the session.
    expect(s.shouldDrop('screen_view', { path: '/home' }, 500)).toBe(false);
  });
});
