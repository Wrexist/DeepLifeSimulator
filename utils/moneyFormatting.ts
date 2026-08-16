/**
 * Centralized money formatting utility
 * Formats money with M, B, T, Q abbreviations and max 2 decimals
 */

export function formatMoney(amount: number, showDollarSign: boolean = true): string {
  // BUGFIX: NaN/Infinity/undefined from upstream calc bugs would otherwise
  // render as "$NaN" or "$Infinity" in the UI — actively confusing for players.
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return showDollarSign ? '$0' : '0';
  }
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  let formatted: string;
  
  if (absAmount >= 1_000_000_000_000_000) {
    // Quadrillions (Q)
    formatted = `${(absAmount / 1_000_000_000_000_000).toFixed(2)}Q`;
  } else if (absAmount >= 1_000_000_000_000) {
    // Trillions (T)
    formatted = `${(absAmount / 1_000_000_000_000).toFixed(2)}T`;
  } else if (absAmount >= 1_000_000_000) {
    // Billions (B)
    formatted = `${(absAmount / 1_000_000_000).toFixed(2)}B`;
  } else if (absAmount >= 1_000_000) {
    // Millions (M)
    formatted = `${(absAmount / 1_000_000).toFixed(2)}M`;
  } else if (absAmount > 10_000) {
    // Thousands (K) - only for numbers above 10,000
    formatted = `${(absAmount / 1_000).toFixed(2)}K`;
  } else {
    // Regular numbers (0-10,000) - show full number
    formatted = Math.floor(absAmount).toLocaleString();
  }
  
  // Remove trailing zeros and the decimal point when not needed. The lookahead
  // matters: suffixed values end in K/M/B/T/Q, so an end-of-string anchor alone
  // never fires and "$250.00K" ships to the UI.
  formatted = formatted.replace(/\.00(?=[KMBTQ]?$)/, '').replace(/(\.\d)0(?=[KMBTQ]?$)/, '$1');

  // Sign goes OUTSIDE the dollar sign so negatives read "-$5M", not "$-5M".
  return showDollarSign ? `${sign}$${formatted}` : `${sign}${formatted}`;
}

/**
 * Tighter sibling of `formatMoney` for dense, numeric-heavy screens (the crypto
 * mining dashboard) where a column of "$12.34K" values is harder to scan than
 * "$12.3k". Same finite guard and the same sign-OUTSIDE-the-dollar rule; the
 * only differences are the lowercase `k` and one decimal on the thousands tier.
 *
 * This is the ONLY sanctioned variant — every other surface uses `formatMoney`.
 * Do not add a third money format; divergent local copies are what this module
 * exists to replace.
 */
export function formatMoneyCompact(amount: number, showDollarSign: boolean = true): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return showDollarSign ? '$0' : '0';
  }
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  let formatted: string;
  if (absAmount >= 1_000_000_000_000_000) {
    formatted = `${(absAmount / 1_000_000_000_000_000).toFixed(2)}Q`;
  } else if (absAmount >= 1_000_000_000_000) {
    formatted = `${(absAmount / 1_000_000_000_000).toFixed(2)}T`;
  } else if (absAmount >= 1_000_000_000) {
    formatted = `${(absAmount / 1_000_000_000).toFixed(2)}B`;
  } else if (absAmount >= 1_000_000) {
    formatted = `${(absAmount / 1_000_000).toFixed(2)}M`;
  } else if (absAmount >= 10_000) {
    formatted = `${(absAmount / 1_000).toFixed(1)}k`;
  } else {
    formatted = Math.round(absAmount).toLocaleString();
  }

  // Same trailing-zero trim as formatMoney — the lookahead has to include the
  // lowercase k, or "$10.0k" ships.
  formatted = formatted
    .replace(/\.00(?=[kKMBTQ]?$)/, '')
    .replace(/(\.\d)0(?=[kKMBTQ]?$)/, '$1')
    .replace(/\.0(?=[kKMBTQ]?$)/, '');

  return showDollarSign ? `${sign}$${formatted}` : `${sign}${formatted}`;
}

export function formatMoneyNoSign(amount: number): string {
  return formatMoney(amount, false);
}

export function formatMoneyWithSign(amount: number): string {
  return formatMoney(amount, true);
}

// For gems and other currencies that don't use dollar sign
export function formatCurrency(amount: number, currency: string = ''): string {
  // BUGFIX: same NaN/Infinity guard as formatMoney.
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return currency ? `0 ${currency}` : '0';
  }
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  let formatted: string;
  
  if (absAmount >= 1_000_000_000_000_000) {
    // Quadrillions (Q)
    formatted = `${(absAmount / 1_000_000_000_000_000).toFixed(2)}Q`;
  } else if (absAmount >= 1_000_000_000_000) {
    // Trillions (T)
    formatted = `${(absAmount / 1_000_000_000_000).toFixed(2)}T`;
  } else if (absAmount >= 1_000_000_000) {
    // Billions (B)
    formatted = `${(absAmount / 1_000_000_000).toFixed(2)}B`;
  } else if (absAmount >= 1_000_000) {
    // Millions (M)
    formatted = `${(absAmount / 1_000_000).toFixed(2)}M`;
  } else if (absAmount > 10_000) {
    // Thousands (K) - only for numbers above 10,000
    formatted = `${(absAmount / 1_000).toFixed(2)}K`;
  } else {
    // Regular numbers (0-10,000) - show full number
    formatted = Math.floor(absAmount).toLocaleString();
  }
  
  // Remove trailing zeros and the decimal point when not needed (lookahead:
  // suffixed values end in K/M/B/T/Q — same fix as formatMoney above).
  formatted = formatted.replace(/\.00(?=[KMBTQ]?$)/, '').replace(/(\.\d)0(?=[KMBTQ]?$)/, '$1');

  return `${sign}${formatted}${currency ? ` ${currency}` : ''}`;
}
