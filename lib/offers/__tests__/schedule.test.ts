import {
  currentOffer,
  formatRotationCountdown,
  msUntilRotation,
  offerForWeek,
  offerWindow,
  ROTATION_EPOCH_MS,
  weekIndexAt,
} from '@/lib/offers/schedule';
import { OFFER_ROTATION } from '@/lib/offers/catalogue';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('offer rotation schedule', () => {
  it('puts the epoch in week 0', () => {
    expect(weekIndexAt(ROTATION_EPOCH_MS)).toBe(0);
    expect(weekIndexAt(ROTATION_EPOCH_MS + WEEK_MS - 1)).toBe(0);
    expect(weekIndexAt(ROTATION_EPOCH_MS + WEEK_MS)).toBe(1);
  });

  it('gives every player the same offer at the same instant', () => {
    // The whole point of a UTC-derived index: no timezone can put two players
    // on different offers, which would make the Offer Center's "next week"
    // strip a lie for one of them.
    const instant = Date.UTC(2026, 7, 19, 13, 45);
    expect(currentOffer(instant).offer.id).toBe(currentOffer(new Date(instant)).offer.id);
  });

  it('wraps rather than falling off the end of the catalogue', () => {
    const len = OFFER_ROTATION.length;
    expect(offerForWeek(0).offer.id).toBe(offerForWeek(len).offer.id);
    expect(offerForWeek(len * 3 + 2).offer.id).toBe(offerForWeek(2).offer.id);
  });

  it('stays inside the catalogue for a back-dated device clock', () => {
    // `n % len` on a negative index reads OFFER_ROTATION[-3] — undefined, and
    // an empty card. A true modulo is what keeps a wrong clock merely wrong
    // rather than broken.
    for (const week of [-1, -5, -13, -400]) {
      expect(offerForWeek(week).offer).toBeDefined();
      expect(OFFER_ROTATION).toContain(offerForWeek(week).offer);
    }
  });

  it('shows last, this and next as three consecutive weeks', () => {
    const at = Date.UTC(2026, 2, 3);
    const { previous, current, next } = offerWindow(at);
    expect(current.weekIndex - previous.weekIndex).toBe(1);
    expect(next.weekIndex - current.weekIndex).toBe(1);
    expect(previous.endsAt.getTime()).toBe(current.startsAt.getTime());
    expect(current.endsAt.getTime()).toBe(next.startsAt.getTime());
  });

  it('counts down to a real boundary and never past it', () => {
    // The countdown must correspond to the actual moment `currentOffer` starts
    // returning something else — a timer that resets on its own would be the
    // fake urgency the design explicitly rules out.
    const start = ROTATION_EPOCH_MS + 40 * WEEK_MS;
    expect(msUntilRotation(start)).toBe(WEEK_MS);
    expect(msUntilRotation(start + WEEK_MS - 1)).toBe(1);
    const justAfter = start + WEEK_MS;
    expect(currentOffer(justAfter).offer.id).not.toBe(currentOffer(start).offer.id);
    expect(msUntilRotation(justAfter)).toBe(WEEK_MS);
  });

  it('formats a coarse countdown', () => {
    expect(formatRotationCountdown(3 * 24 * 3600_000 + 14 * 3600_000)).toBe('3d 14h');
    expect(formatRotationCountdown(2 * 3600_000 + 30 * 60_000)).toBe('2h 30m');
    expect(formatRotationCountdown(8 * 60_000)).toBe('8m');
    expect(formatRotationCountdown(0)).toBe('rotating now');
    expect(formatRotationCountdown(NaN)).toBe('rotating now');
  });
});
