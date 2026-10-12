import { resolveCalendar } from '@/utils/weekCounters';
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

/** `$1,234` - whole dollars, for figures where cents are noise. */
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
export function docDate(atWeek: number, anchor?: MailCalendarAnchor | number): string {
  const w = Math.max(0, Math.floor(typeof atWeek === 'number' && Number.isFinite(atWeek) ? atWeek : 0));
  if (anchor && typeof anchor === 'object') {
    const { monthIndex, year, day } = calendarAt(w, anchor);
    return `${MONTHS[monthIndex]} ${day}, ${year}`;
  }
  const startYear = typeof anchor === 'number' ? anchor : 2025;
  const year = startYear + Math.floor(w / 52);
  const weekInYear = w % 52;
  const month = MONTHS[Math.min(11, Math.floor(weekInYear / 4.35))];
  const day = Math.min(28, 1 + (weekInYear % 4) * 7);
  return `${month} ${day}, ${year}`;
}

/** The compact form Gmail uses in a list row: `Aug 6`. */
export function docDateShort(atWeek: number, anchor?: MailCalendarAnchor | number): string {
  return docDate(atWeek, anchor).replace(/,.*$/, '');
}

/** Calendar year a given absolute week fell in, on the game's own calendar. */
export function docYear(atWeek: number, anchor: MailCalendarAnchor): number {
  return calendarAt(Math.max(0, Math.floor(atWeek || 0)), anchor).year;
}

/**
 * Where the game's calendar stands NOW, so a message's absolute week can be
 * placed on the same calendar the HUD shows.
 *
 * Without it every date was `2025 + weeksLived / 52`. `weeksLived` is seeded
 * from the starting age (an age-20 life starts at week 104), so mail ran two
 * years ahead of the HUD: statements "Nov 22, 2028" in a game reading January
 * 2027, and "Tax year 4" after two years of play (tester pass, 2026-10-10).
 * CLAUDE.md §4.2 - this is that trap.
 */
export interface MailCalendarAnchor {
  /** `weeksLived` now. */
  nowWeek: number;
  /** `weeksLived` when this life began (`lifeStartWeek`, 0 on old saves). */
  lifeStartWeek: number;
  /** The HUD's year and month (0-11) now. */
  year: number;
  monthIndex: number;
}

const FULL_MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export function mailCalendarAnchor(state: {
  weeksLived?: number;
  lifeStartWeek?: number;
  date?: { year?: number; month?: string };
} | null | undefined): MailCalendarAnchor {
  const monthIndex = Math.max(0, FULL_MONTHS.indexOf(String(state?.date?.month ?? '').toLowerCase()));
  const year = typeof state?.date?.year === 'number' && Number.isFinite(state.date.year) ? state.date.year : 2025;
  return {
    nowWeek: Math.max(0, Math.floor(state?.weeksLived ?? 0)),
    lifeStartWeek: Math.max(0, Math.floor(state?.lifeStartWeek ?? 0)),
    year,
    monthIndex,
  };
}

function calendarAt(atWeek: number, anchor: MailCalendarAnchor): { monthIndex: number; year: number; day: number } {
  const start = anchor.lifeStartWeek;
  const msg = resolveCalendar(Math.max(0, atWeek - start));
  const now = resolveCalendar(Math.max(0, anchor.nowWeek - start));
  const absMonth = anchor.year * 12 + anchor.monthIndex - (now.monthsElapsed - msg.monthsElapsed);
  return {
    year: Math.floor(absMonth / 12),
    monthIndex: ((absMonth % 12) + 12) % 12,
    day: Math.min(28, 1 + (msg.weekOfMonth - 1) * 7),
  };
}

/** A stable, real-looking reference like `INV-4417-22`. */
export function docReference(prefix: string, atWeek: number, salt = 0): string {
  const w = Math.max(0, Math.floor(atWeek || 0));
  const a = ((w * 7919 + salt * 104729) % 9000) + 1000;
  const b = (w % 90) + 10;
  return `${prefix}-${a}-${b}`;
}
