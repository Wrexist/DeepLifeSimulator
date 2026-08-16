/**
 * Stock sectors + sector rotation.
 *
 * Each stock is tagged with a sector. Sectors rotate through "strong" and
 * "weak" states over multiple weeks — when a sector is strong, all its stocks
 * tend to outperform; when weak, they underperform. This adds depth without
 * touching the legacy stockMarket.ts simulation (we layer ON TOP).
 *
 * Pure functions, no game state.
 */

import type { StockSymbol } from '@/lib/economy/stockMarket';

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type Sector = 'tech' | 'finance' | 'healthcare' | 'consumer' | 'industrial' | 'energy';

/**
 * Stock symbol → sector, for EVERY symbol in the universe.
 *
 * Keyed by {@link StockSymbol}, derived from `DEFAULT_PRICES` in
 * `lib/economy/stockMarket.ts` — the registry that defines which stocks exist
 * (M19). `Record<StockSymbol, Sector>` is exhaustive in both directions: a
 * symbol added to the universe without a sector fails the type-check here, and
 * a sector entry for a symbol that no longer exists does too. It used to be
 * `Record<string, Sector>` hand-synced with a comment saying "the 20 default
 * stocks" while the universe had grown to 25 — a 26th would have rendered in
 * the sector UI as an untagged stock with no rotation tilt, silently.
 *
 * The import is `import type`, so it is erased at compile time and cannot form
 * a runtime cycle between `lib/stocks` and `lib/economy`.
 */
export const STOCK_SECTORS: Record<StockSymbol, Sector> = {
  // Tech
  AAPL: 'tech',
  GOOGL: 'tech',
  MSFT: 'tech',
  TSLA: 'tech',
  AMZN: 'tech',
  META: 'tech',
  NVDA: 'tech',
  NFLX: 'tech',
  IBM: 'tech',
  // Finance
  JPM: 'finance',
  V: 'finance',
  MA: 'finance',
  // Healthcare
  JNJ: 'healthcare',
  PFE: 'healthcare',
  UNH: 'healthcare',
  // Consumer
  WMT: 'consumer',
  PG: 'consumer',
  KO: 'consumer',
  DIS: 'consumer',
  HD: 'consumer',
  // Industrial
  BA: 'industrial',
  CAT: 'industrial',
  // Energy
  XOM: 'energy',
  CVX: 'energy',
  SLB: 'energy',
};

export type SectorState = 'strong' | 'neutral' | 'weak';

/** Per-state weekly return modifier applied on top of the legacy stockMarket sim. */
export const SECTOR_MODIFIER: Record<SectorState, number> = {
  strong: 0.008,   // +0.8% per week tilt
  neutral: 0,
  weak: -0.005,    // -0.5% per week tilt
};

export interface SectorSnapshot {
  sector: Sector;
  state: SectorState;
  /** Weeks remaining in this state before re-roll. */
  weeksRemaining: number;
}

/**
 * Pick the next state given the current one and a roll in [0, 1).
 * Sectors tend to stay neutral; transitions to strong/weak are momentary.
 */
export function nextState(current: SectorState, roll: number): SectorState {
  const r = Math.max(0, Math.min(0.9999, safe(roll, 0.5)));
  if (current === 'neutral') {
    if (r < 0.15) return 'strong';
    if (r < 0.30) return 'weak';
    return 'neutral';
  }
  if (current === 'strong') {
    if (r < 0.5) return 'neutral';
    if (r < 0.85) return 'strong';
    return 'weak';
  }
  // weak
  if (r < 0.5) return 'neutral';
  if (r < 0.85) return 'weak';
  return 'strong';
}

/**
 * Sample how long the new state lasts (geometric-ish around the mean).
 * Strong/weak runs are shorter than neutral runs.
 */
export function sampleDuration(state: SectorState, roll: number): number {
  const mean = state === 'neutral' ? 12 : 6;
  const r = Math.max(0.01, Math.min(0.99, safe(roll, 0.5)));
  const d = Math.round(-mean * Math.log(1 - r));
  return Math.max(2, Math.min(mean * 3, d));
}

/**
 * Resolve the sector tag for a stock symbol. Unknown symbols → 'tech' (most common).
 */
export function sectorForSymbol(symbol: string): Sector {
  // Widened deliberately: the argument is an arbitrary string (a symbol off a
  // save or a UI list), and the point of this function is to answer for one
  // that may not be in the universe. Callers holding a real `StockSymbol` can
  // index `STOCK_SECTORS` directly and get the exhaustiveness check.
  const table = STOCK_SECTORS as Record<string, Sector>;
  return table[symbol?.toUpperCase()] ?? 'tech';
}

/**
 * Convenience — return the weekly return tilt that should be added to a stock's
 * deterministic baseline price change given the current sector state.
 */
export function sectorTiltFor(symbol: string, snapshots: SectorSnapshot[]): number {
  const sector = sectorForSymbol(symbol);
  const snap = snapshots.find((s) => s.sector === sector);
  return snap ? SECTOR_MODIFIER[snap.state] : 0;
}

/** All sectors as a list (handy for iteration). */
export const ALL_SECTORS: Sector[] = ['tech', 'finance', 'healthcare', 'consumer', 'industrial', 'energy'];
