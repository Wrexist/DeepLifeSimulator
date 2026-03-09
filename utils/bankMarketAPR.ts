import { resolveAbsoluteWeek } from '@/utils/weekCounters';

/**
 * Pseudo market-driven APR (deterministic by absolute week).
 * Smooth oscillation between 6% and 14%.
 */
export function getMarketAPRByAbsoluteWeek(absoluteWeek: number | undefined): number {
  const w = typeof absoluteWeek === 'number' ? absoluteWeek : 0;
  const base = 0.10;
  const amp = 0.04;
  const apr = base + amp * Math.sin(w * 0.35) * Math.cos(w * 0.17 + 1.2);
  return Math.max(0.06, Math.min(0.14, apr));
}

/**
 * Computes market APR from mixed counter state while prioritizing weeksLived.
 */
export function getMarketAPRForGameWeek(
  weeksLived: number | undefined,
  week: number | undefined
): number {
  const absoluteWeek = resolveAbsoluteWeek(weeksLived, week);
  return getMarketAPRByAbsoluteWeek(absoluteWeek);
}
