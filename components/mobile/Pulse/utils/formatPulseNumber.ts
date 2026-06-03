/**
 * Format an integer as K / M / B suffix for engagement counts.
 * 1,234 → "1.2K"  ·  12,345,678 → "12M"  ·  999 → "999"
 */
export function formatPulseNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n < 1_000) return String(Math.floor(n));
  if (n < 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  if (n < 1_000_000) return `${Math.floor(n / 1_000)}K`;
  if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n < 1_000_000_000) return `${Math.floor(n / 1_000_000)}M`;
  return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
}
