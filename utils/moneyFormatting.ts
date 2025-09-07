/**
 * Centralized money formatting utility
 * Formats money with M, B, T, Q abbreviations and max 2 decimals
 */

export function formatMoney(amount: number, showDollarSign: boolean = true): string {
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
  } else if (absAmount >= 1_000) {
    // Thousands (K)
    formatted = `${(absAmount / 1_000).toFixed(2)}K`;
  } else {
    // Regular numbers
    formatted = Math.floor(absAmount).toString();
  }
  
  // Remove trailing zeros and decimal point if not needed
  formatted = formatted.replace(/\.00$/, '').replace(/\.0$/, '');
  
  return showDollarSign ? `$${sign}${formatted}` : `${sign}${formatted}`;
}

export function formatMoneyNoSign(amount: number): string {
  return formatMoney(amount, false);
}

export function formatMoneyWithSign(amount: number): string {
  return formatMoney(amount, true);
}

// For gems and other currencies that don't use dollar sign
export function formatCurrency(amount: number, currency: string = ''): string {
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
  } else if (absAmount >= 1_000) {
    // Thousands (K)
    formatted = `${(absAmount / 1_000).toFixed(2)}K`;
  } else {
    // Regular numbers
    formatted = Math.floor(absAmount).toString();
  }
  
  // Remove trailing zeros and decimal point if not needed
  formatted = formatted.replace(/\.00$/, '').replace(/\.0$/, '');
  
  return `${sign}${formatted}${currency ? ` ${currency}` : ''}`;
}
