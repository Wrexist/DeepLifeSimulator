/**
 * The remembered collapse state is a UI preference, and the rules that keep it
 * from becoming a bug are worth pinning:
 *   - it must read SYNCHRONOUSLY (an async read paints sections open, then shut)
 *   - an unknown section falls back to the caller's default
 *   - a corrupted stored value must never make a section un-openable
 */
import {
  hydrateSectionCollapse,
  isSectionCollapsed,
  onSectionCollapseHydrated,
  setSectionCollapsed,
  __resetSectionCollapseForTests,
} from '@/utils/sectionCollapse';
import { safeAsyncStorage } from '@/utils/storageWrapper';

jest.mock('@/utils/storageWrapper', () => ({
  safeAsyncStorage: { getItem: jest.fn(), setItem: jest.fn() },
}));

const mockStorage = safeAsyncStorage as jest.Mocked<typeof safeAsyncStorage>;

describe('section collapse preferences', () => {
  beforeEach(() => {
    __resetSectionCollapseForTests();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('falls back to the caller default before anything is stored', () => {
    expect(isSectionCollapsed('health.vitals', false)).toBe(false);
    expect(isSectionCollapsed('health.vitals', true)).toBe(true);
  });

  it('reads a hydrated value synchronously', async () => {
    mockStorage.getItem.mockResolvedValueOnce({ 'health.vitals': true });
    await hydrateSectionCollapse();
    // No await here: this is the property the component depends on.
    expect(isSectionCollapsed('health.vitals', false)).toBe(true);
  });

  it('keeps the default for sections the store has never seen', async () => {
    mockStorage.getItem.mockResolvedValueOnce({ 'health.vitals': true });
    await hydrateSectionCollapse();
    expect(isSectionCollapsed('work.crimeSkills', false)).toBe(false);
  });

  it('drops non-boolean entries rather than trusting them', async () => {
    mockStorage.getItem.mockResolvedValueOnce({
      'health.vitals': 'yes',
      'work.crimeSkills': null,
      'home.goals': true,
    });
    await hydrateSectionCollapse();
    // A corrupted entry must not decide the section's state - it falls back to
    // the default, which is what keeps a section openable.
    expect(isSectionCollapsed('health.vitals', false)).toBe(false);
    expect(isSectionCollapsed('work.crimeSkills', false)).toBe(false);
    expect(isSectionCollapsed('home.goals', false)).toBe(true);
  });

  it('survives a storage read that throws', async () => {
    mockStorage.getItem.mockRejectedValueOnce(new Error('storage down'));
    await expect(hydrateSectionCollapse()).resolves.toBeUndefined();
    expect(isSectionCollapsed('health.vitals', true)).toBe(true);
  });

  it('applies a write immediately and persists it debounced', () => {
    setSectionCollapsed('health.vitals', true);
    // The UI must see the new value on the very next render.
    expect(isSectionCollapsed('health.vitals', false)).toBe(true);
    expect(mockStorage.setItem).not.toHaveBeenCalled();
    jest.advanceTimersByTime(400);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst of toggles into one write', () => {
    setSectionCollapsed('a', true);
    setSectionCollapsed('b', true);
    setSectionCollapsed('c', true);
    jest.advanceTimersByTime(400);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ a: true, b: true, c: true })
    );
  });
});

describe('hydration arriving late', () => {
  beforeEach(() => {
    __resetSectionCollapseForTests();
    jest.clearAllMocks();
  });

  it('notifies a section that rendered before the values landed', async () => {
    const seen: boolean[] = [];
    // A section renders now, reads the default, and registers for the real value.
    expect(isSectionCollapsed('home.goals', false)).toBe(false);
    onSectionCollapseHydrated(() => seen.push(isSectionCollapsed('home.goals', false)));

    mockStorage.getItem.mockResolvedValueOnce({ 'home.goals': true });
    await hydrateSectionCollapse();

    expect(seen).toEqual([true]);
  });

  it('runs the callback immediately when already hydrated', async () => {
    mockStorage.getItem.mockResolvedValueOnce({ 'home.goals': true });
    await hydrateSectionCollapse();
    const cb = jest.fn();
    onSectionCollapseHydrated(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes cleanly, so an unmounted section is never called', async () => {
    const cb = jest.fn();
    const off = onSectionCollapseHydrated(cb);
    off();
    mockStorage.getItem.mockResolvedValueOnce({});
    await hydrateSectionCollapse();
    expect(cb).not.toHaveBeenCalled();
  });

  it('one throwing listener does not stop the rest', async () => {
    const good = jest.fn();
    onSectionCollapseHydrated(() => { throw new Error('boom'); });
    onSectionCollapseHydrated(good);
    mockStorage.getItem.mockResolvedValueOnce({});
    await expect(hydrateSectionCollapse()).resolves.toBeUndefined();
    expect(good).toHaveBeenCalledTimes(1);
  });
});
