import { capErrorBanners, isBlankNotification } from '@/contexts/UIUXContext';

/**
 * Regression: spamming the green "Next Week" button flooded the screen with
 * stacked blue info banners. Each week's notifications get unique, week-numbered
 * ids (e.g. `spark-tick-<weeksLived>-<i>`) so they don't collapse by id, and the
 * banner overlay (UIUXOverlay → ErrorMessage) staggers each one by 96px. The
 * `errorStates` queue was unbounded, so a burst piled up across the whole UI
 * before the ~5s auto-dismiss could clear it. capErrorBanners bounds it.
 */
type Banner = Parameters<typeof capErrorBanners>[0][number];

const banner = (id: string, severity: Banner['severity']): Banner => ({
  id,
  message: id,
  severity,
  autoDismiss: severity === 'info',
});

describe('capErrorBanners', () => {
  it('leaves the list untouched when at or under the cap', () => {
    const list = [banner('a', 'info'), banner('b', 'info'), banner('c', 'info')];
    expect(capErrorBanners(list, 3)).toBe(list);
  });

  it('caps a flood of info advisories to the most recent ones', () => {
    // Simulate spamming "Next Week": many unique week-numbered info banners.
    const flood = Array.from({ length: 12 }, (_, i) => banner(`week-${i}`, 'info'));
    const capped = capErrorBanners(flood, 3);

    expect(capped).toHaveLength(3);
    // Keeps the newest three, preserving arrival order.
    expect(capped.map(b => b.id)).toEqual(['week-9', 'week-10', 'week-11']);
  });

  it('never drops a real error/critical in favor of info advisories', () => {
    const list = [
      banner('save-error', 'error'),
      banner('w1', 'info'),
      banner('w2', 'info'),
      banner('w3', 'info'),
      banner('w4', 'info'),
    ];
    const capped = capErrorBanners(list, 3);

    expect(capped).toHaveLength(3);
    expect(capped.some(b => b.id === 'save-error')).toBe(true);
    // Real error retained; remaining 2 slots go to the newest advisories.
    expect(capped.map(b => b.id)).toEqual(['save-error', 'w3', 'w4']);
  });

  it('retains all real errors even when they exceed the cap', () => {
    const list = [
      banner('e1', 'error'),
      banner('e2', 'critical'),
      banner('e3', 'error'),
      banner('e4', 'critical'),
      banner('info1', 'info'),
    ];
    const capped = capErrorBanners(list, 3);

    // All four real errors kept (never dropped); every advisory squeezed out.
    expect(capped.map(b => b.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(capped.some(b => b.severity === 'info')).toBe(false);
  });
});

/**
 * Regression (bug report 2026-07-03): "blue banner with nothing on it" —
 * a notification whose message resolved to undefined/empty rendered as a
 * bare icon-only banner. Blank notifications are now dropped at the source.
 */
describe('isBlankNotification', () => {
  it('flags missing, empty, and whitespace-only content as blank', () => {
    expect(isBlankNotification(undefined, undefined)).toBe(true);
    expect(isBlankNotification('', '')).toBe(true);
    expect(isBlankNotification('   ', '\n')).toBe(true);
  });

  it('keeps notifications that have any visible text', () => {
    expect(isBlankNotification('Something happened', undefined)).toBe(false);
    expect(isBlankNotification(undefined, 'Title only')).toBe(false);
    expect(isBlankNotification('', 'Title')).toBe(false);
  });
});
