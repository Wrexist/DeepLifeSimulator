import { fnv1a32, mulberry32 } from '@/utils/seededRoll';

/** Presentation only: a stable illustrative curve, never a price/history input. */
export function illustrativeStockTrend(symbol: string, changePct?: number): number[] {
  const roll = mulberry32(fnv1a32(`stock-chart:${symbol.toUpperCase()}`));
  const hasChange = changePct != null && Number.isFinite(changePct);
  const end = hasChange ? Math.max(-1, Math.min(1, changePct * 12)) : (roll() - 0.5) * 1.4;
  const walk = [0];
  for (let i = 1; i < 12; i++) walk.push(walk[i - 1] + (roll() - 0.5) * 0.7);
  const last = walk[walk.length - 1];
  // Bridge noise back to the endpoint so a real gain/loss keeps its direction.
  return walk.map((value, i) => {
    const t = i / (walk.length - 1);
    return value - last * t + end * t;
  });
}
