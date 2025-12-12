/**
 * Formats money with suffixes (K, M, B, T, Q) with max 2 decimal places
 * Follows user preference for money formatting
 * 
 * @param amount - The amount to format
 * @returns Formatted money string (e.g., "$1.50M", "$500K")
 */
export function formatMoney(amount: number): string {
  const a = Math.floor(Math.abs(amount) || 0);
  const sign = amount < 0 ? '-' : '';
  
  let formatted: string;
  
  if (a >= 1_000_000_000_000_000) {
    // Quadrillions (Q)
    formatted = `${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
  } else if (a >= 1_000_000_000_000) {
    // Trillions (T)
    formatted = `${(a / 1_000_000_000_000).toFixed(2)}T`;
  } else if (a >= 1_000_000_000) {
    // Billions (B)
    formatted = `${(a / 1_000_000_000).toFixed(2)}B`;
  } else if (a >= 1_000_000) {
    // Millions (M)
    formatted = `${(a / 1_000_000).toFixed(2)}M`;
  } else if (a >= 1_000) {
    // Thousands (K)
    formatted = `${(a / 1_000).toFixed(2)}K`;
  } else {
    // Regular numbers
    formatted = a.toString();
  }
  
  // Remove trailing zeros and decimal point if not needed
  formatted = formatted.replace(/\.00$/, '').replace(/\.0$/, '');
  
  return `$${sign}${formatted}`;
}

