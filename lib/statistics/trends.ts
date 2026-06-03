/**
 * Trend helpers — turn time-series arrays into compact direction + magnitude
 * signals the dashboard can show without rendering a chart.
 *
 * Pure functions.
 */

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface TrendSignal {
  direction: 'up' | 'down' | 'flat';
  /** Magnitude relative to baseline (e.g. +15 means +15% over baseline). */
  pctChange: number;
  recentAverage: number;
  baselineAverage: number;
  /** Sample size that fed the trend; <4 means low confidence. */
  sampleSize: number;
}

/**
 * Compute a trend from a numeric time-series. Compares the most recent
 * window vs. the prior window.
 */
export function trendOf(series: number[] | undefined, window = 4): TrendSignal {
  if (!series || series.length === 0) {
    return { direction: 'flat', pctChange: 0, recentAverage: 0, baselineAverage: 0, sampleSize: 0 };
  }
  const clean = series.filter((v) => typeof v === 'number' && isFinite(v));
  if (clean.length < 2) {
    return { direction: 'flat', pctChange: 0, recentAverage: clean[0] ?? 0, baselineAverage: clean[0] ?? 0, sampleSize: clean.length };
  }
  const w = Math.max(1, Math.min(window, Math.floor(clean.length / 2)));
  const recent = clean.slice(-w);
  const baseline = clean.slice(0, clean.length - w);
  const recentAvg = recent.reduce((s, n) => s + n, 0) / recent.length;
  const baseAvg = baseline.length > 0 ? baseline.reduce((s, n) => s + n, 0) / baseline.length : recentAvg;
  const pct = baseAvg === 0 ? (recentAvg === 0 ? 0 : 100) : ((recentAvg - baseAvg) / Math.abs(baseAvg)) * 100;
  const direction: TrendSignal['direction'] =
    Math.abs(pct) < 2 ? 'flat' : pct > 0 ? 'up' : 'down';
  return {
    direction,
    pctChange: Math.round(pct),
    recentAverage: Math.round(recentAvg),
    baselineAverage: Math.round(baseAvg),
    sampleSize: clean.length,
  };
}

/**
 * Convenience — extract the slope (delta per index) of a series. Useful for
 * straight-line projections.
 */
export function slopeOf(series: number[] | undefined): number {
  if (!series || series.length < 2) return 0;
  const clean = series.filter((v) => typeof v === 'number' && isFinite(v));
  if (clean.length < 2) return 0;
  const n = clean.length;
  const meanX = (n - 1) / 2;
  const meanY = clean.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (safe(clean[i], 0) - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
