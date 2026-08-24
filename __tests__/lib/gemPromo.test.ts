import { activeGemPromo, formatPromoCountdown, GEM_PACK_PROMO } from '@/lib/shop/gemPromo';

describe('gemPromo - honest, opt-in limited-time offer', () => {
  const now = new Date('2026-07-23T12:00:00Z');

  it('ships DISABLED - no promo renders by default', () => {
    expect(GEM_PACK_PROMO.enabled).toBe(false);
    expect(activeGemPromo(now)).toBeNull();
  });

  it('returns null when enabled but misconfigured (no product id)', () => {
    expect(activeGemPromo(now, { enabled: true, productId: '', headline: 'x' })).toBeNull();
  });

  it('returns the promo while it is live', () => {
    const promo = {
      enabled: true,
      productId: 'deeplife_gems_5000',
      headline: 'Weekend Gem Rush',
      endsAtIso: '2026-07-25T00:00:00Z',
    };
    expect(activeGemPromo(now, promo)).toBe(promo);
  });

  it('returns null once the offer has ended (no dead offers)', () => {
    const promo = {
      enabled: true,
      productId: 'deeplife_gems_5000',
      headline: 'Weekend Gem Rush',
      endsAtIso: '2026-07-20T00:00:00Z', // already past `now`
    };
    expect(activeGemPromo(now, promo)).toBeNull();
  });

  it('formats a real countdown and never a fake one', () => {
    expect(formatPromoCountdown(now, '2026-07-25T16:00:00Z')).toBe('Ends in 2d 4h');
    expect(formatPromoCountdown(now, undefined)).toBe(''); // open-ended → no timer
    expect(formatPromoCountdown(now, '2026-07-20T00:00:00Z')).toBe(''); // already ended
    expect(formatPromoCountdown(now, 'garbage')).toBe('');
  });
});
