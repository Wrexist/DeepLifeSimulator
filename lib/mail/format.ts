/**
 * Formatting for mail documents.
 *
 * Deliberately NOT `utils/moneyFormatting.ts`. That formatter abbreviates —
 * `$2.5K`, `$1.2M` — which is right for a HUD pill and wrong for a payslip: an
 * invoice that says "$1.2M" reads as a mock-up, and a player checking a
 * deduction against their balance cannot. Documents get exact figures with
 * cents and thousands separators, because being checkable is the whole point.
 */

/** `$1,234.56`. Exact, always two decimals, sign outside the symbol. */
export function docMoney(amount: number): string {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);
  // Rounding cents to 100 must carry, or $9.999 renders as "$9.100".
  const carried = cents === 100 ? whole + 1 : whole;
  const shownCents = cents === 100 ? 0 : cents;
  return `${sign}$${carried.toLocaleString('en-US')}.${String(shownCents).padStart(2, '0')}`;
}

/** `$1,234` — whole dollars, for figures where cents are noise. */
export function docWhole(amount: number): string {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.floor(Math.abs(n)).toLocaleString('en-US')}`;
}

/** `12.5%` from a 0..1 fraction. */
export function docPercent(fraction: number): string {
  const n = typeof fraction === 'number' && Number.isFinite(fraction) ? fraction : 0;
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * The date shown on a list row and a document header.
 *
 * Derived from the absolute week rather than the device clock, so a save
 * reopened a year later still reads as the life the player is living. Month
 * comes from the week-of-year; the game's own `date.month` is the CURRENT
 * month and would stamp every archived message with today's.
 */
export function docDate(atWeek: number, startYear = 2025): string {
  const w = Math.max(0, Math.floor(typeof atWeek === 'number' && Number.isFinite(atWeek) ? atWeek : 0));
  const year = startYear + Math.floor(w / 52);
  const weekInYear = w % 52;
  const month = MONTHS[Math.min(11, Math.floor(weekInYear / 4.35))];
  const day = Math.min(28, 1 + (weekInYear % 4) * 7);
  return `${month} ${day}, ${year}`;
}

/** The compact form Gmail uses in a list row: `Aug 6`. */
export function docDateShort(atWeek: number, startYear = 2025): string {
  return docDate(atWeek, startYear).replace(/,.*$/, '');
}

/** A stable, real-looking reference like `INV-4417-22`. */
export function docReference(prefix: string, atWeek: number, salt = 0): string {
  const w = Math.max(0, Math.floor(atWeek || 0));
  const a = ((w * 7919 + salt * 104729) % 9000) + 1000;
  const b = (w % 90) + 10;
  return `${prefix}-${a}-${b}`;
}
